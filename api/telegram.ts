import type { VercelRequest, VercelResponse } from '@vercel/node'
import { bot } from '../server/bot.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  try {
    const update = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    if (!update || typeof update !== 'object') return response.status(400).json({ error: 'Invalid Telegram update' })
    await bot.handleUpdate(update)
    return response.status(200).json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return response.status(200).json({ ok: false, accepted: true })
  }
}
