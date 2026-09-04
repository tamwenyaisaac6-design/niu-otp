import Database from 'better-sqlite3'

const configured = process.env.DATABASE_PATH ?? 'niu-otp.sqlite'
const path = process.env.VERCEL === '1' && !configured.startsWith('/tmp/')
  ? `/tmp/${configured.split(/[\\/]/).pop() ?? 'niu-otp.sqlite'}`
  : configured

export const db = new Database(path)
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, balance REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, provider_order_id TEXT, country INTEGER NOT NULL, service TEXT NOT NULL, phone_number TEXT, provider_price REAL NOT NULL, customer_price REAL NOT NULL, profit REAL NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, balance_before REAL NOT NULL, balance_after REAL NOT NULL, reference TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, nowpayments_payment_id TEXT UNIQUE NOT NULL, requested_amount REAL NOT NULL, pay_currency TEXT, pay_amount REAL, status TEXT NOT NULL, credited INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confirmed_at TEXT);
`)

export type Account = { id: number; email: string; balance: number; status: string }

export function session(request: { headers: { cookie?: string } }) {
  const token = request.headers.cookie?.match(/(?:^|;\s*)niu_session=([^;]+)/)?.[1]
  if (!token) return undefined
  return db.prepare('SELECT users.id, users.email, users.balance, users.status FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ? AND sessions.expires_at > ?').get(token, Math.floor(Date.now() / 1000)) as Account | undefined
}

export function cookie(token: string) {
  return `niu_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`
}
