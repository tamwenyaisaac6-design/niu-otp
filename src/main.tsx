import { StrictMode, useEffect, useState, type FormEvent } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const money = (amount: number) => `$${amount.toFixed(2)}`
type Service = { name: string; code: string; providerPrice: number; customerPrice: number; stock: number }
type Country = { id: number; name: string; services: Service[] }
type View = 'Overview' | 'Buy Number' | 'My Numbers' | 'Wallet' | 'Transactions' | 'Settings' | 'Help'
type AccountData = { user: { id: number; email: string; balance: number }; purchases: Purchase[]; transactions: Transaction[] }
type Purchase = { id: number; country: number; service: string; phoneNumber?: string; customerPrice: number; status: string; createdAt: string }
type Transaction = { id: number; type: string; amount: number; reference?: string; status: string; createdAt: string }

const logoItems = [
  { label: 'Telegram', mark: 'T', color: '#229ed9' },
  { label: 'WhatsApp', mark: 'W', color: '#20b15a' },
  { label: 'Google', mark: 'G', color: '#ea4335' },
  { label: 'Facebook', mark: 'f', color: '#1877f2' },
]

function Brand() {
  return <div className="brand"><span className="brand-mark">N</span><strong>NI OTP</strong></div>
}

function App() {
  const [view, setView] = useState<View>('Overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [countries, setCountries] = useState<Country[]>([])
  const [country, setCountry] = useState<Country>()
  const [service, setService] = useState<Service>()
  const [account, setAccount] = useState<AccountData>()
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authenticated, setAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')

  const loadAccount = () => fetch('/api/account').then((r) => r.ok ? r.json() as Promise<AccountData> : Promise.reject()).then((data) => { setAccount(data); setAuthenticated(true) }).catch(() => undefined)
  useEffect(() => { loadAccount(); fetch('/api/catalog').then((r) => r.ok ? r.json() as Promise<{ countries: Country[] }> : Promise.reject()).then((data) => { setCountries(data.countries); setCountry(data.countries[0]); setService(data.countries[0]?.services[0]) }).catch(() => setNotice('Live provider inventory is unavailable. No demo offers are shown.')) }, [])

  const navigate = (next: View) => { setView(next); setMenuOpen(false); setNotice('') }
  const authenticate = async (event: FormEvent) => {
    event.preventDefault()
    const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: authMode, email, password }) })
    const data = await response.json() as { error?: string }
    if (!response.ok) return setNotice(data.error ?? 'Authentication failed')
    await loadAccount()
    navigate('Overview')
  }
  const buy = async () => {
    if (!country || !service) return
    const response = await fetch('/api/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ country: country.id, service: service.code }) })
    const data = await response.json() as { error?: string; phoneNumber?: string }
    if (!response.ok) return setNotice(data.error ?? 'Purchase failed')
    await loadAccount()
    navigate('My Numbers')
    setNotice(`Number allocated: ${data.phoneNumber}. OTP monitoring is active.`)
  }

  if (!authenticated) return <Welcome authMode={authMode} setAuthMode={setAuthMode} email={email} setEmail={setEmail} password={password} setPassword={setPassword} authenticate={authenticate} notice={notice} />
  return <main className="app-shell">
    <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open navigation">☰</button><Brand /><div className="top-actions"><div className="wallet"><small>WALLET BALANCE</small><b>{money(account?.user.balance ?? 0)}</b></div><button className="profile" onClick={() => navigate('Settings')}>{account?.user.email.slice(0, 1).toUpperCase()}</button></div></header>
    {menuOpen && <nav className="drawer"><button className="drawer-close" onClick={() => setMenuOpen(false)}>×</button><Brand /><small className="eyebrow">WORKSPACE</small>{(['Overview', 'Buy Number', 'My Numbers', 'Wallet', 'Transactions', 'Settings', 'Help'] as View[]).map((item) => <button className={view === item ? 'drawer-link active' : 'drawer-link'} onClick={() => navigate(item)} key={item}>{item}</button>)}</nav>}
    <section className="dashboard-heading"><div><small className="eyebrow">NI OTP / SECURE WORKSPACE</small><h1>{view === 'Overview' ? `Good to see you, ${account?.user.email.split('@')[0]}.` : view}</h1><p>Real-time verification infrastructure, built for calm and control.</p></div><button className="primary compact" onClick={() => navigate('Buy Number')}>Get a number <span>→</span></button></section>
    {notice && <div className="notice alert">⚠ {notice}</div>}
    {view === 'Overview' && <Overview account={account} navigate={navigate} />}
    {view === 'Buy Number' && <BuyNumber countries={countries} country={country} setCountry={(next) => { setCountry(next); setService(next.services[0]) }} service={service} setService={setService} buy={buy} />}
    {view === 'My Numbers' && <DataPage eyebrow="OTP NUMBERS" title="Your active numbers" empty="Numbers purchased from VirtualSMS will appear here." purchases={account?.purchases ?? []} />}
    {view === 'Wallet' && <Wallet balance={account?.user.balance ?? 0} setNotice={setNotice} />}
    {view === 'Transactions' && <Transactions items={account?.transactions ?? []} />}
    {view === 'Settings' && <section className="card page"><small className="eyebrow">ACCOUNT SETTINGS</small><h2>Profile and security</h2><p className="muted">Your account is secured with an HTTP-only session.</p><div className="setting-row"><span>Email address</span><b>{account?.user.email}</b></div><div className="setting-row"><span>Account ID</span><b>#{account?.user.id}</b></div></section>}
    {view === 'Help' && <section className="card page"><small className="eyebrow">SUPPORT</small><h2>How can we help?</h2><p className="muted">Choose a live offer, fund your wallet, and receive your OTP in My Numbers.</p><div className="placeholder">Need help with a provider order? Contact support with your transaction reference.</div></section>}
    <footer><span>NI OTP © 2026</span><span>Live provider connection · <i /></span></footer>
  </main>
}

function Welcome(props: { authMode: 'login' | 'signup'; setAuthMode: (mode: 'login' | 'signup') => void; email: string; setEmail: (value: string) => void; password: string; setPassword: (value: string) => void; authenticate: (event: FormEvent) => void; notice: string }) {
  return <main className="welcome"><div className="welcome-nav"><Brand /><div><button className="ghost" onClick={() => props.setAuthMode('login')}>Log in</button><button className="primary small" onClick={() => props.setAuthMode('signup')}>Create account</button></div></div><section className="hero"><div className="hero-copy"><small className="eyebrow">PRIVATE VERIFICATION, SIMPLIFIED</small><h1>One secure place<br />for every <em>code.</em></h1><p>Get reliable temporary numbers from the providers you trust. Fast checkout, clear pricing, and OTPs delivered privately.</p><div className="hero-actions"><button className="primary" onClick={() => props.setAuthMode('signup')}>Start with NI OTP <span>→</span></button><span>Free account · No commitment</span></div></div><div className="hero-card"><div className="hero-card-top"><span className="status-dot" /> LIVE PROVIDER NETWORK</div><div className="hero-code">••••••</div><div className="hero-card-line">Secure verification code</div><div className="hero-card-bottom"><span>NI OTP</span><b>ENCRYPTED</b></div></div></section><section className="trusted"><small>WORKS WITH THE SERVICES YOU USE</small><div>{logoItems.map((item) => <span key={item.label}><i style={{ background: item.color }}>{item.mark}</i>{item.label}</span>)}</div></section><div className="auth-modal"><div className="auth-panel"><small className="eyebrow">SECURE ACCOUNT ACCESS</small><h2>{props.authMode === 'login' ? 'Welcome back.' : 'Create your account.'}</h2><p>Manage your wallet and verification numbers with your email.</p><form onSubmit={props.authenticate}><input type="email" placeholder="Email address" value={props.email} onChange={(event) => props.setEmail(event.target.value)} required /><input type="password" placeholder="Password (8+ characters)" value={props.password} onChange={(event) => props.setPassword(event.target.value)} minLength={8} required /><button className="primary">{props.authMode === 'login' ? 'Log in' : 'Sign up'} <span>→</span></button></form>{props.notice && <div className="notice alert">{props.notice}</div>}<button className="switch" onClick={() => props.setAuthMode(props.authMode === 'login' ? 'signup' : 'login')}>{props.authMode === 'login' ? 'Need an account? Sign up' : 'Already registered? Log in'}</button></div></div></main>
}

function Overview({ account, navigate }: { account?: AccountData; navigate: (view: View) => void }) {
  return <><div className="red-banner"><strong>Protect your verification flow.</strong><span>Choose a live number and keep every OTP in one private workspace.</span><button onClick={() => navigate('Buy Number')}>Browse live stock →</button></div><section className="stat-grid"><div className="stat-card"><small>AVAILABLE BALANCE</small><strong>{money(account?.user.balance ?? 0)}</strong><button onClick={() => navigate('Wallet')}>Fund wallet →</button></div><div className="stat-card"><small>ACTIVE NUMBERS</small><strong>{account?.purchases.filter((item) => item.status === 'waiting').length ?? 0}</strong><button onClick={() => navigate('My Numbers')}>View numbers →</button></div><div className="stat-card"><small>TRANSACTIONS</small><strong>{account?.transactions.length ?? 0}</strong><button onClick={() => navigate('Transactions')}>View activity →</button></div></section><section className="card page overview-card"><small className="eyebrow">QUICK START</small><h2>Make your first secure purchase</h2><p className="muted">Inventory and pricing are fetched live from VirtualSMS. Nothing is simulated.</p><button className="primary compact" onClick={() => navigate('Buy Number')}>Choose country and service <span>→</span></button></section></>
}

function BuyNumber({ countries, country, setCountry, service, setService, buy }: { countries: Country[]; country?: Country; setCountry: (country: Country) => void; service?: Service; setService: (service: Service) => void; buy: () => void }) {
  return <section className="layout"><div><div className="section-title"><div><small className="eyebrow">01 / COUNTRY</small><h2>Where do you need a number?</h2></div><span className="live">● LIVE STOCK</span></div><div className="country-grid">{countries.map((item) => <button className={country?.id === item.id ? 'choice selected' : 'choice'} onClick={() => setCountry(item)} key={item.id}><strong>{item.name}</strong><span>{item.services.length} services available</span></button>)}</div><div className="section-title services-title"><div><small className="eyebrow">02 / SERVICE</small><h2>What is it for?</h2></div></div><div className="service-grid">{(country?.services ?? []).map((item) => <button className={service?.code === item.code ? 'service selected' : 'service'} onClick={() => setService(item)} key={item.code}><span className="service-icon">{item.name[0]}</span><strong>{item.name}</strong><small>{money(item.customerPrice)}</small></button>)}</div></div><aside className="checkout"><small className="eyebrow">ORDER SUMMARY</small><h2>{service ? 'Ready when you are.' : 'Select a live offer.'}</h2>{country && <div className="summary"><span>◎</span><div><small>COUNTRY</small><b>{country.name}</b></div></div>}{service && <><div className="summary"><span className="service-icon">{service.name[0]}</span><div><small>SERVICE</small><b>{service.name}</b></div></div><div className="prices"><p><span>Provider price</span><b>{money(service.providerPrice)}</b></p><p><span>NI OTP markup</span><b>{money(service.customerPrice - service.providerPrice)}</b></p><hr /><p className="total"><span>Total today</span><strong>{money(service.customerPrice)}</strong></p></div><button className="primary" onClick={buy}>Buy number <span>→</span></button></>}<small className="footnote">Prices are validated server-side at checkout.</small></aside></section>
}

function DataPage({ eyebrow, title, empty, purchases }: { eyebrow: string; title: string; empty: string; purchases: Purchase[] }) {
  return <section className="card page"><small className="eyebrow">{eyebrow}</small><h2>{title}</h2><p className="muted">{empty}</p>{purchases.length === 0 ? <div className="placeholder">{empty}</div> : purchases.map((item) => <div className="data-row" key={item.id}><div><b>{item.phoneNumber ?? 'Provider allocation'}</b><small>Service {item.service} · {item.status}</small></div><strong>{money(item.customerPrice)}</strong></div>)}</section>
}
function Wallet({ balance, setNotice }: { balance: number; setNotice: (notice: string) => void }) {
  return <section className="card page"><small className="eyebrow">WALLET / NOWPAYMENTS</small><h2>{money(balance)} available</h2><p className="muted">Funds are credited only after verified payment confirmation.</p><div className="amounts">{[5, 10, 20, 50, 100].map((amount) => <button onClick={async () => { const response = await fetch('/api/deposit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) }); const data = await response.json() as { error?: string; payAmount?: number; payCurrency?: string; payAddress?: string }; setNotice(response.ok ? `Send ${data.payAmount} ${data.payCurrency} to ${data.payAddress}.` : data.error ?? 'Payment creation failed') }} key={amount}>{money(amount)}</button>)}</div></section>
}
function Transactions({ items }: { items: Transaction[] }) {
  return <section className="card page"><small className="eyebrow">WALLET LEDGER</small><h2>Transactions</h2>{items.length === 0 ? <div className="placeholder">Your verified deposits and purchases will appear here.</div> : items.map((item) => <div className="data-row" key={item.id}><div><b>{item.type}</b><small>{item.reference ?? 'No reference'} · {item.status}</small></div><strong className={item.amount < 0 ? 'debit' : 'credit'}>{item.amount < 0 ? '-' : '+'}{money(Math.abs(item.amount))}</strong></div>)}</section>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
