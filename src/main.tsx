import { StrictMode, useEffect, useState, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const money = (amount: number) => `$${amount.toFixed(2)}`
type Service = { name: string; code: string; providerPrice: number; customerPrice: number; stock: number }
type Country = { id: number; name: string; services: Service[] }

function App() {
  const [screen, setScreen] = useState('Buy Number')
  const [countries, setCountries] = useState<Country[]>([])
  const [country, setCountry] = useState<Country>()
  const [service, setService] = useState<Service>()
  const [balance, setBalance] = useState<number>()
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authenticated, setAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const customerPrice = service?.customerPrice ?? 0
  useEffect(() => { fetch('/api/auth').then((response) => response.ok ? response.json() : Promise.reject()).then((data: { user: { balance: number } }) => { setAuthenticated(true); setBalance(data.user.balance) }).catch(() => undefined) }, [])
  useEffect(() => { fetch('/api/catalog').then((response) => { if (!response.ok) throw new Error('catalog'); return response.json() as Promise<{ countries: Country[] }> }).then((data) => { setCountries(data.countries); setCountry(data.countries[0]); setService(data.countries[0]?.services[0]) }).catch(() => setNotice('Live provider catalog is unavailable. No demo data is shown.')) }, [])
  const navigate = (next: string) => { setScreen(next); setNotice('') }

  const buy = async () => {
    if (!country || !service) return
    const response = await fetch('/api/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country: country.id, service: service.code }) })
    const data = await response.json() as { error?: string; phoneNumber?: string }
    if (!response.ok) { setNotice(data.error ?? 'Purchase failed'); return }
    navigate('My Numbers')
    setNotice(`Number allocated: ${data.phoneNumber ?? 'provider number'}. OTP monitoring is active.`)
  }

  const authenticate = async (event: FormEvent) => { event.preventDefault(); const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: authMode, email, password }) }); const data = await response.json() as { error?: string; user?: { balance: number } }; if (!response.ok) { setNotice(data.error ?? 'Authentication failed'); return }; setAuthenticated(true); setBalance(data.user?.balance ?? 0); setNotice('Signed in securely.') }
  if (!authenticated) return <main><section className="auth-card"><div className="brand"><span>N</span><strong>NI OTP</strong></div><small className="eyebrow">SECURE ACCOUNT ACCESS</small><h1>{authMode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1><p>Use your email to manage your wallet and verification numbers.</p><form onSubmit={authenticate}><input type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} required /><input type="password" placeholder="Password (8+ characters)" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /><button className="primary">{authMode === 'login' ? 'Log in' : 'Sign up'} <span>→</span></button></form>{notice && <div className="notice">{notice}</div>}<button className="switch" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>{authMode === 'login' ? 'Need an account? Sign up' : 'Already registered? Log in'}</button></section></main>
  return <main>
    <header><div className="brand"><span>N</span><strong>NI OTP</strong></div><div className="wallet"><small>WALLET BALANCE</small><b>{balance === undefined ? '—' : money(balance)}</b></div><button className="profile">👤</button></header>
    <nav className="tabs">{['Buy Number', 'My Numbers', 'Balance', 'Deposit', 'Transactions', 'Account', 'Help'].map((item) => <button className={screen === item ? 'active' : ''} onClick={() => navigate(item)} key={item}>{item}</button>)}</nav>
    <section className="intro"><div><small className="eyebrow">NI OTP / PRIVATE VERIFICATION</small><h1>Verification numbers,<br /><em>without the noise.</em></h1><p>Buy a temporary number and receive your OTP securely in one place.</p></div><div className="orb">✦<small>SECURE<br />CHECKOUT</small></div></section>
    {notice && <div className="notice">✓ {notice}</div>}
    {screen === 'Buy Number' && <section className="layout"><div><div className="section-title"><div><small className="eyebrow">01 / COUNTRY</small><h2>Where do you need a number?</h2></div><span className="live">● LIVE STOCK</span></div><div className="country-grid">{countries.map((item) => <button className={country?.id === item.id ? 'choice selected' : 'choice'} onClick={() => { setCountry(item); setService(item.services[0]) }} key={item.id}><strong>{item.name}</strong><span>{item.services.length} services available</span></button>)}</div><div className="section-title services-title"><div><small className="eyebrow">02 / SERVICE</small><h2>What is it for?</h2></div></div><div className="service-grid">{(country?.services ?? []).map((item) => <button className={service?.code === item.code ? 'service selected' : 'service'} onClick={() => setService(item)} key={item.code}><span className="service-icon">{item.name[0]}</span><strong>{item.name}</strong><small>{money(item.customerPrice)}</small></button>)}</div></div><aside className="checkout"><small className="eyebrow">ORDER SUMMARY</small><h2>{service ? 'Ready when you are.' : 'Select a live offer.'}</h2>{country && <div className="summary"><span>◎</span><div><small>COUNTRY</small><b>{country.name}</b></div></div>}{service && <><div className="summary"><span className="service-icon">{service.name[0]}</span><div><small>SERVICE</small><b>{service.name}</b></div></div><div className="prices"><p><span>Provider price</span><b>{money(service.providerPrice)}</b></p><p><span>NI OTP markup <i>100%</i></span><b>{money(customerPrice - service.providerPrice)}</b></p><hr /><p className="total"><span>Total today</span><strong>{money(customerPrice)}</strong></p></div><button className="primary" onClick={buy}>Buy number <span>→</span></button></>}<small className="footnote">Prices come from VirtualSMS and are validated on the backend.</small></aside></section>}
    {screen === 'My Numbers' && <section className="card page"><small className="eyebrow">ACTIVE NUMBERS</small><h2>Your numbers</h2><p className="muted">Numbers and incoming OTP messages appear here.</p><div className="placeholder">No active numbers yet. Purchase a live provider number to see it here.</div></section>}
    {screen === 'Deposit' && <section className="card page"><small className="eyebrow">NOWPAYMENTS</small><h2>Add funds to your wallet</h2><p className="muted">Choose an amount. Your balance is credited only after verified payment confirmation.</p><div className="amounts">{[5, 10, 20, 50, 100].map((amount) => <button onClick={async () => { const response = await fetch('/api/deposit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) }); const data = await response.json() as { error?: string; payAmount?: number; payCurrency?: string; payAddress?: string }; setNotice(response.ok ? `Send ${data.payAmount} ${data.payCurrency} to ${data.payAddress}. Balance updates after confirmation.` : data.error ?? 'Payment creation failed') }} key={amount}>{money(amount)}</button>)}</div></section>}
    {screen !== 'Buy Number' && screen !== 'My Numbers' && screen !== 'Deposit' && <section className="card page"><small className="eyebrow">{screen.toUpperCase()}</small><h2>{screen}</h2><p className="muted">This section is connected to your NI OTP account and backend ledger.</p><div className="placeholder">Secure account data will appear here.</div></section>}
    <footer><span>NI OTP © 2026</span><span>Provider connection secure · <i /></span></footer>
  </main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
