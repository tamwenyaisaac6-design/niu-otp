import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_request: VercelRequest, response: VercelResponse) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const result: {
    ok: boolean
    environment: Record<string, boolean>
    telegram?: { ok: boolean; webhook?: { url?: string; pending_update_count?: number; last_error_message?: string } }
    error?: string
  } = {
    ok: Boolean(token && process.env.MINI_APP_URL),
    environment: {
      TELEGRAM_BOT_TOKEN: Boolean(token),
      VIRTUALSMS_API_URL: Boolean(process.env.VIRTUALSMS_API_URL),
      VIRTUALSMS_API_KEY: Boolean(process.env.VIRTUALSMS_API_KEY),
      NOWPAYMENTS_API_KEY: Boolean(process.env.NOWPAYMENTS_API_KEY),
      NOWPAYMENTS_IPN_SECRET: Boolean(process.env.NOWPAYMENTS_IPN_SECRET),
      MINI_APP_URL: Boolean(process.env.MINI_APP_URL),
    },
  }
  if (!token) return response.status(200).json(result)
  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    const telegram = await telegramResponse.json() as { ok: boolean; result?: { url?: string; pending_update_count?: number; last_error_message?: string } }
    result.telegram = { ok: telegram.ok, webhook: telegram.result }
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Telegram status request failed'
  }
  return response.status(200).json(result)
}
