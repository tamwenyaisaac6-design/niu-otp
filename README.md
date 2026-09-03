# NI OTP Telegram Bot

Telegram bot and Telegram Mini App OTP marketplace. Primary navigation remains Telegram Reply Keyboard buttons; each button opens the Mini App on its corresponding screen.

## Setup

Copy `.env.example` to `.env`, fill in the rotated credentials, and create environment variables before starting:

```env
TELEGRAM_BOT_TOKEN=
VIRTUALSMS_API_URL=
VIRTUALSMS_API_KEY=
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=
MINI_APP_URL=https://your-domain.example/miniapp
PRICE_MULTIPLIER=2
DATABASE_PATH=niu-otp.sqlite
```

Install and run:

```bash
npm install
npm run typecheck
npm run build
npm start
```

Set `MINI_APP_URL` to the HTTPS URL where the built `dist-miniapp` directory is hosted. Telegram Web Apps require HTTPS in production. The bot's Reply Keyboard web-app buttons keep the outlined keyboard appearance while opening the matching Mini App screen.

To diagnose a deployment without exposing secrets, open `/api/status` on the Vercel domain. It reports which environment variable names are present and the Telegram webhook status.

## Vercel Telegram webhook

Set `MINI_APP_URL=https://niu-otp-mocha.vercel.app/miniapp` in Vercel, then register the Telegram webhook once using the Bot API:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://niu-otp-mocha.vercel.app/api/telegram
```

The token belongs only in Vercel environment variables. Do not put it in `vercel.json`, source files, or the Mini App.

## Vercel NOWPayments webhook

Deploy this project to Vercel, add `NOWPAYMENTS_IPN_SECRET`, `DATABASE_PATH`, and the other environment variables in the Vercel project settings, then configure NOWPayments to send IPN callbacks to:

```text
https://your-vercel-project.vercel.app/api/nowpayments
```

The endpoint validates `x-nowpayments-sig`, credits only confirmed/finished payments, and ignores duplicate callbacks. SQLite on Vercel is suitable for a prototype only; use a hosted database for production because serverless storage is not durable.

The bot uses Reply Keyboard web-app buttons for primary navigation. The Mini App sends Telegram `initData` to the backend; the backend validates it with the bot token and never accepts a client-supplied Telegram ID, balance, or price. VirtualSMS credentials are only used by the server. Prices are fetched from the provider and recalculated server-side using `PRICE_MULTIPLIER`.

`handleNowPaymentsWebhook` is exported for wiring into the HTTP webhook route used by the deployment. It validates the NOWPayments HMAC signature, ignores duplicate credits, and writes the deposit to the wallet transaction ledger.
