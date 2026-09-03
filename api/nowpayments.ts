import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = { api: { bodyParser: false } }

const db = new Database(process.env.DATABASE_PATH ?? '/tmp/niu-otp.sqlite')
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, telegram_id TEXT UNIQUE NOT NULL, username TEXT, balance REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, telegram_id TEXT NOT NULL, nowpayments_payment_id TEXT UNIQUE NOT NULL, requested_amount REAL NOT NULL, pay_currency TEXT, pay_amount REAL, status TEXT NOT NULL, credited INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confirmed_at TEXT);
  CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, balance_before REAL NOT NULL, balance_after REAL NOT NULL, reference TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`)

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const secret = process.env.NOWPAYMENTS_IPN_SECRET
  const signature = request.headers['x-nowpayments-sig']
  if (!secret || typeof signature !== 'string') return response.status(401).json({ error: 'Missing webhook signature' })
  const rawBody = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) return response.status(401).json({ error: 'Invalid webhook signature' })
  const payload = JSON.parse(rawBody) as { payment_id?: string; payment_status?: string }
  if (!payload.payment_id || !['finished', 'confirmed'].includes(payload.payment_status ?? '')) return response.status(200).json({ accepted: true })
  const payment = db.prepare('SELECT * FROM payments WHERE nowpayments_payment_id = ?').get(String(payload.payment_id)) as { id: number; user_id: number; requested_amount: number; credited: number } | undefined
  if (!payment || payment.credited) return response.status(200).json({ accepted: true, duplicate: Boolean(payment) })
  db.transaction(() => {
    const account = db.prepare('SELECT balance FROM users WHERE id = ?').get(payment.user_id) as { balance: number }
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(payment.requested_amount, payment.user_id)
    db.prepare('UPDATE payments SET status = ?, credited = 1, confirmed_at = CURRENT_TIMESTAMP WHERE id = ?').run(payload.payment_status, payment.id)
    db.prepare('INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, reference, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(payment.user_id, 'DEPOSIT', payment.requested_amount, account.balance, account.balance + payment.requested_amount, String(payload.payment_id), 'COMPLETED')
  })()
  return response.status(200).json({ accepted: true, credited: true })
}
