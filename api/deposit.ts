import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db, session } from './_db.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const account = session(request)
  if (!account) return response.status(401).json({ error: 'Please log in' })
  const amount = Number((request.body as { amount?: number }).amount)
  const apiKey = process.env.NOWPAYMENTS_API_KEY
  if (!apiKey) return response.status(503).json({ error: 'NOWPayments is not configured' })
  if (!Number.isFinite(amount) || amount < 1 || amount > 1000) return response.status(400).json({ error: 'Deposit amount must be between $1 and $1000' })
  const paymentResponse = await fetch('https://api.nowpayments.io/v1/payment', { method: 'POST', headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ price_amount: amount, price_currency: 'usd', pay_currency: 'usdttrc20' }) })
  if (!paymentResponse.ok) return response.status(502).json({ error: 'NOWPayments could not create the payment' })
  const payment = await paymentResponse.json() as { payment_id: string; pay_currency: string; pay_amount: number; pay_address: string }
  db.prepare('INSERT INTO payments (user_id, nowpayments_payment_id, requested_amount, pay_currency, pay_amount, status) VALUES (?, ?, ?, ?, ?, ?)').run(account.id, String(payment.payment_id), amount, payment.pay_currency, payment.pay_amount, 'waiting')
  return response.status(200).json({ paymentId: payment.payment_id, payCurrency: payment.pay_currency, payAmount: payment.pay_amount, payAddress: payment.pay_address })
}
