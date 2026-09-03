import crypto from 'node:crypto'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import 'dotenv/config'
import Database from 'better-sqlite3'
import { Bot, Context, InlineKeyboard, Keyboard } from 'grammy'

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required')
const botToken = token

const providerUrl = process.env.VIRTUALSMS_API_URL
const providerKey = process.env.VIRTUALSMS_API_KEY
const nowPaymentsKey = process.env.NOWPAYMENTS_API_KEY
const nowPaymentsIpnSecret = process.env.NOWPAYMENTS_IPN_SECRET
const miniAppUrl = process.env.MINI_APP_URL
const multiplier = Number(process.env.PRICE_MULTIPLIER ?? '2')
if (!Number.isFinite(multiplier) || multiplier < 1) throw new Error('PRICE_MULTIPLIER must be a number >= 1')

const db = new Database(process.env.DATABASE_PATH ?? 'niu-otp.sqlite')
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, telegram_id TEXT UNIQUE NOT NULL, username TEXT, balance REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS purchases (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, provider_order_id TEXT, country TEXT NOT NULL, service TEXT NOT NULL, phone_number TEXT, provider_price REAL NOT NULL, customer_price REAL NOT NULL, profit REAL NOT NULL, status TEXT NOT NULL, otp TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT);
  CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, balance_before REAL NOT NULL, balance_after REAL NOT NULL, reference TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, telegram_id TEXT NOT NULL, nowpayments_payment_id TEXT UNIQUE NOT NULL, requested_amount REAL NOT NULL, pay_currency TEXT, pay_amount REAL, status TEXT NOT NULL, credited INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, confirmed_at TEXT);
  CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT NOT NULL, request TEXT, response TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`)

type ProviderOffer = { country: string; service: string; providerPrice: number; stock: number }
type ProviderOrder = { id: string; phone: string; expiresAt: string }

const menu = () => {
  if (!miniAppUrl) throw new Error('MINI_APP_URL is required')
  return new Keyboard()
    .webApp('📱 Buy Number', `${miniAppUrl}?screen=buy`).webApp('📋 My Numbers', `${miniAppUrl}?screen=numbers`).row()
    .webApp('💰 Balance', `${miniAppUrl}?screen=balance`).webApp('➕ Deposit', `${miniAppUrl}?screen=deposit`).webApp('👤 Account', `${miniAppUrl}?screen=account`).row()
    .webApp('📊 Transactions', `${miniAppUrl}?screen=transactions`).webApp('🎁 Referral', `${miniAppUrl}?screen=referral`).webApp('❓ Help', `${miniAppUrl}?screen=help`).resized()
}

function user(ctx: Context) {
  const from = ctx.from
  if (!from) throw new Error('Telegram user is missing')
  db.prepare('INSERT OR IGNORE INTO users (telegram_id, username) VALUES (?, ?)').run(String(from.id), from.username ?? null)
  return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(from.id)) as { id: number; balance: number; status: string }
}

function price(providerPrice: number) {
  return Math.round(providerPrice * multiplier * 100) / 100
}

function validateTelegramInitData(initData: string) {
  if (!initData) throw new Error('Telegram initData is required')
  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash')
  if (!receivedHash) throw new Error('Telegram initData hash is missing')
  params.delete('hash')
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n')
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  const expectedBuffer = Buffer.from(expectedHash)
  const receivedBuffer = Buffer.from(receivedHash)
  if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) throw new Error('Invalid Telegram initData signature')
  const authDate = Number(params.get('auth_date'))
  if (!Number.isFinite(authDate) || Math.floor(Date.now() / 1000) - authDate > 86400) throw new Error('Telegram initData has expired')
  const telegramUser = JSON.parse(params.get('user') ?? '{}') as { id?: number; username?: string }
  if (!telegramUser.id) throw new Error('Telegram user is missing')
  return telegramUser
}

async function provider<T>(path: string, body?: Record<string, string>) {
  if (!providerUrl || !providerKey) throw new Error('VirtualSMS is not configured')
  const response = await fetch(`${providerUrl.replace(/\/$/, '')}/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${providerKey}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`VirtualSMS ${response.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text) as T
}

async function offers() {
  return provider<ProviderOffer[]>('offers')
}

function log(userId: number | null, action: string, request: unknown, response: unknown) {
  db.prepare('INSERT INTO logs (user_id, action, request, response) VALUES (?, ?, ?, ?)').run(userId, action, JSON.stringify(request), JSON.stringify(response))
}

const bot = new Bot(token)
bot.command('start', async (ctx) => {
  user(ctx)
  await ctx.reply('Welcome to NI OTP. Choose an action below to open the secure Mini App.', { reply_markup: menu() })
})

bot.hears('💰 Balance', async (ctx) => {
  const account = user(ctx)
  await ctx.reply(`💰 Balance: $${account.balance.toFixed(2)}`, { reply_markup: menu() })
})

bot.hears('📱 Buy Number', async (ctx) => {
  const account = user(ctx)
  if (account.status !== 'active') return ctx.reply('Your account is blocked. Please contact support.')
  try {
    const available = await offers()
    const countries = [...new Set(available.map((offer) => offer.country))]
    const keyboard = new Keyboard(countries.map((country) => [country])).resized()
    await ctx.reply('Select a country:', { reply_markup: keyboard })
  } catch (error) {
    log(account.id, 'provider_offers_error', {}, String(error))
    await ctx.reply('The provider is temporarily unavailable. Please try again.')
  }
})

bot.hears(/^.+$/, async (ctx) => {
  const text = ctx.message?.text
  if (!text || text.startsWith('/') || text.includes(' ') === false) return
  const account = user(ctx)
  try {
    const available = await offers()
    const countryOffers = available.filter((offer) => offer.country === text)
    if (!countryOffers.length) return
    const keyboard = new Keyboard(countryOffers.map((offer) => [`${offer.service} · $${price(offer.providerPrice).toFixed(2)}`])).resized()
    await ctx.reply('Select a service. Prices include the configured backend multiplier.', { reply_markup: keyboard })
  } catch (error) {
    log(account.id, 'provider_service_error', { country: text }, String(error))
    await ctx.reply('Unable to load services right now.')
  }
})

bot.hears(/^(.+) · \$(\d+\.\d{2})$/, async (ctx) => {
  const match = ctx.match
  const account = user(ctx)
  if (!match) return
  const [service] = match
  try {
    const available = await offers()
    const selected = available.find((offer) => offer.service === service)
    if (!selected) return ctx.reply('That service is no longer available.')
    const customerPrice = price(selected.providerPrice)
    const confirm = new InlineKeyboard().text(`Buy for $${customerPrice.toFixed(2)}`, `buy:${selected.country}:${selected.service}`)
    await ctx.reply(`${selected.country} · ${selected.service}\nProvider cost: $${selected.providerPrice.toFixed(2)}\nYour price: $${customerPrice.toFixed(2)}\nBalance: $${account.balance.toFixed(2)}`, { reply_markup: confirm })
  } catch (error) {
    log(account.id, 'provider_price_error', { service }, String(error))
    await ctx.reply('Unable to verify the live price.')
  }
})

bot.callbackQuery(/^buy:(.+):(.+)$/, async (ctx) => {
  const account = user(ctx)
  const [, country, service] = ctx.match
  try {
    const selected = (await offers()).find((offer) => offer.country === country && offer.service === service)
    if (!selected) throw new Error('Offer is no longer available')
    const customerPrice = price(selected.providerPrice)
    if (account.balance < customerPrice) return ctx.answerCallbackQuery({ text: 'Insufficient balance', show_alert: true })
    const allocated = await provider<ProviderOrder>('orders', { country, service })
    const transaction = db.transaction(() => {
      const before = (db.prepare('SELECT balance FROM users WHERE id = ?').get(account.id) as { balance: number }).balance
      db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(customerPrice, account.id)
      db.prepare('INSERT INTO purchases (user_id, provider_order_id, country, service, phone_number, provider_price, customer_price, profit, status, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(account.id, allocated.id, country, service, allocated.phone, selected.providerPrice, customerPrice, customerPrice - selected.providerPrice, 'waiting', allocated.expiresAt)
      db.prepare('INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, reference, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(account.id, 'OTP_PURCHASE', -customerPrice, before, before - customerPrice, allocated.id, 'COMPLETED')
    })
    transaction()
    await ctx.answerCallbackQuery()
    await ctx.reply(`✅ Number allocated\n${country} · ${service}\n📱 ${allocated.phone}\nStatus: waiting for SMS`, { reply_markup: menu() })
  } catch (error) {
    log(account.id, 'provider_order_error', { country, service }, String(error))
    await ctx.answerCallbackQuery({ text: 'Purchase failed; your balance was not charged', show_alert: true })
  }
})

bot.hears('➕ Deposit', async (ctx) => {
  user(ctx)
  if (!nowPaymentsKey) return ctx.reply('NOWPayments is not configured yet. Please contact support.')
  const keyboard = new InlineKeyboard().text('$5', 'deposit:5').text('$10', 'deposit:10').text('$20', 'deposit:20').row().text('$50', 'deposit:50').text('$100', 'deposit:100')
  await ctx.reply('Choose a deposit amount. Balance is credited only after a verified NOWPayments webhook.', { reply_markup: keyboard })
})

bot.callbackQuery(/^deposit:(\d+)$/, async (ctx) => {
  const account = user(ctx)
  const amount = Number(ctx.match[1])
  try {
    const response = await fetch('https://api.nowpayments.io/v1/payment', { method: 'POST', headers: { 'x-api-key': nowPaymentsKey ?? '', 'Content-Type': 'application/json' }, body: JSON.stringify({ price_amount: amount, price_currency: 'usd', pay_currency: 'usdttrc20' }) })
    if (!response.ok) throw new Error(`NOWPayments ${response.status}`)
    const payment = await response.json() as { payment_id: string; pay_currency: string; pay_amount: number; pay_address: string }
    db.prepare('INSERT INTO payments (user_id, telegram_id, nowpayments_payment_id, requested_amount, pay_currency, pay_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(account.id, String(ctx.from.id), String(payment.payment_id), amount, payment.pay_currency, payment.pay_amount, 'waiting')
    await ctx.reply(`NOWPayments payment created for $${amount.toFixed(2)}.\nSend ${payment.pay_amount} ${payment.pay_currency} to:\n${payment.pay_address}\n\nYour balance will update after confirmation.`)
    await ctx.answerCallbackQuery()
  } catch (error) {
    log(account.id, 'nowpayments_create_error', { amount }, String(error))
    await ctx.answerCallbackQuery({ text: 'Unable to create payment', show_alert: true })
  }
})

export async function handleNowPaymentsWebhook(rawBody: string, signature: string) {
  if (!nowPaymentsIpnSecret) throw new Error('NOWPAYMENTS_IPN_SECRET is not configured')
  const expected = crypto.createHmac('sha512', nowPaymentsIpnSecret).update(rawBody).digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) throw new Error('Invalid NOWPayments signature')
  const payload = JSON.parse(rawBody) as { payment_id: string; payment_status: string }
  if (!['finished', 'confirmed'].includes(payload.payment_status)) return
  const payment = db.prepare('SELECT * FROM payments WHERE nowpayments_payment_id = ?').get(String(payload.payment_id)) as { id: number; user_id: number; requested_amount: number; credited: number } | undefined
  if (!payment || payment.credited) return
  const credit = db.transaction(() => {
    const account = db.prepare('SELECT balance FROM users WHERE id = ?').get(payment.user_id) as { balance: number }
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(payment.requested_amount, payment.user_id)
    db.prepare('UPDATE payments SET status = ?, credited = 1, confirmed_at = CURRENT_TIMESTAMP WHERE id = ?').run(payload.payment_status, payment.id)
    db.prepare('INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, reference, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run(payment.user_id, 'DEPOSIT', payment.requested_amount, account.balance, account.balance + payment.requested_amount, String(payload.payment_id), 'COMPLETED')
  })
  credit()
}

export { bot }

bot.catch((error) => console.error('Telegram bot error:', error))
const webhookServer = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, service: 'ni-otp' }))
    return
  }
  if (request.method === 'GET' && request.url?.startsWith('/miniapp')) {
    const requestedPath = new URL(request.url, 'http://localhost').pathname.replace('/miniapp', '') || '/index.html'
    const safePath = requestedPath.replace(/\.\./g, '')
    readFile(join(process.cwd(), 'dist-miniapp', safePath)).then((content) => {
      response.writeHead(200).end(content)
    }).catch(() => {
      response.writeHead(404).end('Mini App build not found. Run npm run build first.')
    })
    return
  }
  if (request.method === 'POST' && request.url === '/api/auth') {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { initData?: string }
        const telegramUser = validateTelegramInitData(payload.initData ?? '')
        db.prepare('INSERT OR IGNORE INTO users (telegram_id, username) VALUES (?, ?)').run(String(telegramUser.id), telegramUser.username ?? null)
        const account = db.prepare('SELECT id, telegram_id, username, balance, status FROM users WHERE telegram_id = ?').get(String(telegramUser.id))
        response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ user: account }))
      } catch (error) {
        console.error('Telegram Mini App authentication error:', error)
        response.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Unauthorized Telegram session' }))
      }
    })
    return
  }
  if (request.method !== 'POST' || request.url !== '/webhooks/nowpayments') {
    response.writeHead(404).end()
    return
  }
  const chunks: Buffer[] = []
  request.on('data', (chunk: Buffer) => chunks.push(chunk))
  request.on('end', async () => {
    try {
      const signatureHeader = request.headers['x-nowpayments-sig']
      const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader ?? ''
      await handleNowPaymentsWebhook(Buffer.concat(chunks).toString('utf8'), signature)
      response.writeHead(200).end('ok')
    } catch (error) {
      console.error('NOWPayments webhook error:', error)
      response.writeHead(400).end('invalid webhook')
    }
  })
})
if (process.env.VERCEL !== '1') {
  webhookServer.listen(Number(process.env.PORT ?? '3000'))
  await bot.start()
}
