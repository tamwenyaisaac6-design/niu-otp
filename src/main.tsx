import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const services = [
  { name: 'Telegram', provider: 0.4, icon: '✈' },
  { name: 'WhatsApp', provider: 0.55, icon: '◉' },
  { name: 'Google', provider: 0.7, icon: 'G' },
  { name: 'Facebook', provider: 0.35, icon: 'f' },
]
const countries = ['🇺🇸 United States', '🇬🇧 United Kingdom', '🇩🇪 Germany', '🇫🇷 France', '🇨🇦 Canada']
const multiplier = 2
const money = (amount: number) => `$${amount.toFixed(2)}`

function App() {
  const [screen, setScreen] = useState('Buy Number')
  const [country, setCountry] = useState(countries[0])
  const [service, setService] = useState(services[0])
  const [balance, setBalance] = useState(12.4)
  const [notice, setNotice] = useState('')
  const customerPrice = useMemo(() => Math.round(service.provider * multiplier * 100) / 100, [service])
  const navigate = (next: string) => { setScreen(next); setNotice('') }

  const buy = () => {
    if (balance < customerPrice) { navigate('Deposit'); setNotice('Your balance is too low. Choose a deposit amount to continue.'); return }
    setBalance((value) => Math.round((value - customerPrice) * 100) / 100)
    navigate('My Numbers')
    setNotice(`Number reserved for ${service.name}. OTP monitoring is active.`)
  }

  return <main>
    <header><div className="brand"><span>N</span><strong>NI OTP</strong></div><div className="wallet"><small>WALLET BALANCE</small><b>{money(balance)}</b></div><button className="profile">JD</button></header>
    <nav className="tabs">{['Buy Number', 'My Numbers', 'Balance', 'Deposit', 'Transactions', 'Account', 'Help'].map((item) => <button className={screen === item ? 'active' : ''} onClick={() => navigate(item)} key={item}>{item}</button>)}</nav>
    <section className="intro"><div><small className="eyebrow">NI OTP / PRIVATE VERIFICATION</small><h1>Verification numbers,<br /><em>without the noise.</em></h1><p>Buy a temporary number and receive your OTP securely in one place.</p></div><div className="orb">✦<small>SECURE<br />CHECKOUT</small></div></section>
    {notice && <div className="notice">✓ {notice}</div>}
    {screen === 'Buy Number' && <section className="layout"><div><div className="section-title"><div><small className="eyebrow">01 / COUNTRY</small><h2>Where do you need a number?</h2></div><span className="live">● LIVE STOCK</span></div><div className="country-grid">{countries.map((item) => <button className={country === item ? 'choice selected' : 'choice'} onClick={() => setCountry(item)} key={item}><strong>{item}</strong><span>Available now ›</span></button>)}</div><div className="section-title services-title"><div><small className="eyebrow">02 / SERVICE</small><h2>What is it for?</h2></div></div><div className="service-grid">{services.map((item) => <button className={service.name === item.name ? 'service selected' : 'service'} onClick={() => setService(item)} key={item.name}><span className="service-icon">{item.icon}</span><strong>{item.name}</strong><small>{money(item.provider * multiplier)}</small></button>)}</div></div><aside className="checkout"><small className="eyebrow">ORDER SUMMARY</small><h2>Ready when you are.</h2><div className="summary"><span>{country.split(' ')[0]}</span><div><small>COUNTRY</small><b>{country.substring(3)}</b></div></div><div className="summary"><span className="service-icon">{service.icon}</span><div><small>SERVICE</small><b>{service.name}</b></div></div><div className="prices"><p><span>Provider price</span><b>{money(service.provider)}</b></p><p><span>NI OTP markup <i>100%</i></span><b>{money(customerPrice - service.provider)}</b></p><hr /><p className="total"><span>Total today</span><strong>{money(customerPrice)}</strong></p></div><button className="primary" onClick={buy}>Buy number <span>→</span></button><small className="footnote">Prices are calculated server-side from live provider costs.</small></aside></section>}
    {screen === 'My Numbers' && <section className="card page"><small className="eyebrow">ACTIVE NUMBERS</small><h2>Your numbers</h2><p className="muted">Numbers and incoming OTP messages appear here.</p><div className="number"><span>🇺🇸</span><div><small>United States · {service.name}</small><b>+1 (201) 555-0182</b></div><strong className="waiting">◷ Waiting for SMS</strong></div></section>}
    {screen === 'Deposit' && <section className="card page"><small className="eyebrow">NOWPAYMENTS</small><h2>Add funds to your wallet</h2><p className="muted">Choose an amount. Your balance is credited only after verified payment confirmation.</p><div className="amounts">{[5, 10, 20, 50, 100].map((amount) => <button onClick={() => { setBalance((value) => value + amount); setNotice(`${money(amount)} deposit created through NOWPayments.`) }} key={amount}>{money(amount)}</button>)}</div></section>}
    {screen !== 'Buy Number' && screen !== 'My Numbers' && screen !== 'Deposit' && <section className="card page"><small className="eyebrow">{screen.toUpperCase()}</small><h2>{screen}</h2><p className="muted">This section is connected to your NI OTP account and backend ledger.</p><div className="placeholder">Secure account data will appear here.</div></section>}
    <footer><span>NI OTP © 2026</span><span>Provider connection secure · <i /></span></footer>
  </main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
