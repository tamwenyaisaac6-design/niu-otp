import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

declare global {
  interface Window { Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void } } }
}

const screen = new URLSearchParams(window.location.search).get('screen') ?? 'buy'
const labels: Record<string, string> = { buy: 'Buy Number', numbers: 'My Numbers', balance: 'Balance', deposit: 'Deposit', transactions: 'Transactions', referral: 'Referral', account: 'Account', help: 'Help' }

function App() {
  const webApp = window.Telegram?.WebApp
  const [authState, setAuthState] = useState<'checking' | 'verified' | 'failed'>('checking')
  webApp?.ready()
  webApp?.expand()
  useEffect(() => {
    fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initData: webApp?.initData ?? '' }) })
      .then((response) => { if (!response.ok) throw new Error('Authentication failed'); setAuthState('verified') })
      .catch(() => setAuthState('failed'))
  }, [webApp])
  return <main><header><div className="logo">N</div><div><small>NI OTP / TELEGRAM</small><h1>{labels[screen] ?? 'NI OTP'}</h1></div><span className="secure">● SECURE</span></header><section className="identity"><span>🔒</span><div><strong>{authState === 'verified' ? 'Telegram session verified by NI OTP' : authState === 'checking' ? 'Verifying Telegram session...' : 'Telegram session could not be verified'}</strong><small>{authState === 'failed' ? 'Open this screen from the Telegram bot.' : 'No separate login required'}</small></div></section>{authState === 'verified' ? <section className="card">{screen === 'buy' ? <><small className="eyebrow">MARKETPLACE</small><h2>Get a verification number.</h2><p>Select a country and service. Live prices are calculated by the NI OTP backend.</p><button>🇺🇸 United States <span>›</span></button><button>🇬🇧 United Kingdom <span>›</span></button><button>🇩🇪 Germany <span>›</span></button></> : <><small className="eyebrow">{(labels[screen] ?? 'NI OTP').toUpperCase()}</small><h2>{labels[screen] ?? 'NI OTP'}</h2><p>This Telegram Mini App screen is connected to your authenticated session.</p><div className="placeholder">Backend data will appear here securely.</div></>}</section> : <section className="card"><h2>Authentication required</h2><p>NI OTP only accepts sessions opened from Telegram.</p></section>}<footer>NI OTP · Powered by secure backend</footer></main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
