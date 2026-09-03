# NI OTP Web App

Standalone NI OTP web app for purchasing temporary verification numbers. Telegram is no longer required for the user interface.

## Setup

Copy `.env.example` to `.env`, fill in the provider/payment credentials, and create environment variables before starting:

```env
VIRTUALSMS_API_URL=
VIRTUALSMS_API_KEY=
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=
PRICE_MULTIPLIER=2
DATABASE_PATH=niu-otp.sqlite
```

Install and run:

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Deploy to Vercel with `npm run build`. The app is served at the project root. Provider and payment credentials are server-side only.

## Vercel NOWPayments webhook

Deploy this project to Vercel, add `NOWPAYMENTS_IPN_SECRET`, `DATABASE_PATH`, and the other environment variables in the Vercel project settings, then configure NOWPayments to send IPN callbacks to:

```text
https://your-vercel-project.vercel.app/api/nowpayments
```

The endpoint validates `x-nowpayments-sig`, credits only confirmed/finished payments, and ignores duplicate callbacks. Vercel uses temporary `/tmp` SQLite storage for this prototype; use a hosted database before production because serverless storage is not durable.

`handleNowPaymentsWebhook` validates the NOWPayments signature, ignores duplicate credits, and writes deposits to the wallet ledger.
