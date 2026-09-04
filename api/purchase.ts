import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, session } from './_db.js'

const baseUrl = process.env.VIRTUALSMS_API_URL ?? 'https://api.virtualsms.de/stubs/handler_api'
const apiKey = process.env.VIRTUALSMS_API_KEY
const multiplier = Number(process.env.PRICE_MULTIPLIER ?? '2')

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const account = session(request)
  if (!account) return response.status(401).json({ error: 'Please log in' })
  const { country, service } = request.body as { country?: number; service?: string }
  if (!Number.isInteger(country) || !service || !/^[a-z0-9_-]{1,20}$/i.test(service)) return response.status(400).json({ error: 'Invalid offer' })
  if (!apiKey) return response.status(503).json({ error: 'VirtualSMS is not configured' })
  try {
    const query = new URLSearchParams({ action: 'getPrices', api_key: apiKey, country: String(country), service })
    const priceResponse = await fetch(`${baseUrl}?${query}`)
    if (!priceResponse.ok) throw new Error(`VirtualSMS returned ${priceResponse.status}`)
    const prices = await priceResponse.json() as Record<string, Record<string, { cost: number; count: number }>>
    const offer = prices[String(country)]?.[service]
    if (!offer || offer.count < 1) return response.status(409).json({ error: 'This number is no longer available' })
    const customerPrice = Math.round(offer.cost * multiplier * 100) / 100
    if (account.balance < customerPrice) return response.status(402).json({ error: 'Insufficient balance' })
    const orderQuery = new URLSearchParams({ action: 'getNumberV2', api_key: apiKey, country: String(country), service, maxPrice: String(offer.cost) })
    const orderResponse = await fetch(`${baseUrl}?${orderQuery}`)
    const order = await orderResponse.json() as { activationId?: number; phoneNumber?: string; activationCost?: number; error?: string }
    if (!orderResponse.ok || !order.activationId || !order.phoneNumber) throw new Error(order.error ?? 'Number allocation failed')
    db.transaction(() => {
      const current = db.prepare('SELECT balance FROM users WHERE id = ?').get(account.id) as { balance: number }
      if (current.balance < customerPrice) throw new Error('Balance changed; please retry')
      db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(customerPrice, account.id)
      db.prepare('INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, reference, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(account.id, 'OTP_PURCHASE', -customerPrice, current.balance, current.balance - customerPrice, String(order.activationId), 'COMPLETED')
    })()
    return response.status(200).json({ activationId: order.activationId, phoneNumber: order.phoneNumber, providerPrice: offer.cost, customerPrice })
  } catch (error) {
    console.error('VirtualSMS purchase error:', error)
    return response.status(502).json({ error: 'Number allocation failed; your balance was not charged' })
  }
}
