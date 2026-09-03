import crypto from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

function validateInitData(initData: string, token: string) {
  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash')
  if (!receivedHash) throw new Error('Missing Telegram initData hash')
  params.delete('hash')
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest()
  const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(receivedHash)
  if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) throw new Error('Invalid Telegram initData signature')
  const authDate = Number(params.get('auth_date'))
  if (!Number.isFinite(authDate) || Math.floor(Date.now() / 1000) - authDate > 86400) throw new Error('Expired Telegram initData')
  const user = JSON.parse(params.get('user') ?? '{}') as { id?: number; username?: string }
  if (!user.id) throw new Error('Missing Telegram user')
  return user
}

export default function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return response.status(500).json({ error: 'Telegram bot is not configured' })
  try {
    const body = request.body as { initData?: string }
    const telegramUser = validateInitData(body.initData ?? '', token)
    return response.status(200).json({ user: { telegram_id: String(telegramUser.id), username: telegramUser.username ?? null } })
  } catch (error) {
    console.error('Telegram Mini App authentication error:', error)
    return response.status(401).json({ error: 'Unauthorized Telegram session' })
  }
}
