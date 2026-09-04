import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, session } from './_db.js'

export default function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })
  const account = session(request)
  if (!account) return response.status(401).json({ error: 'Please log in' })
  const purchases = db.prepare('SELECT id, country, service, phone_number AS phoneNumber, provider_price AS providerPrice, customer_price AS customerPrice, status, created_at AS createdAt FROM purchases WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(account.id)
  const transactions = db.prepare('SELECT id, type, amount, reference, status, created_at AS createdAt FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(account.id)
  return response.status(200).json({ user: account, purchases, transactions })
}
