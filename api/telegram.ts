import type { VercelRequest, VercelResponse } from '@vercel/node'
import { bot } from '../server/bot.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  try {
    await bot.handleUpdate(request.body)
    return response.status(200).json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return response.status(500).json({ error: 'Telegram update failed' })
  }
}
