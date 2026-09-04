import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { cookie, db, session } from './_db.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method === 'GET') {
    const account = session(request)
    return account ? response.status(200).json({ user: account }) : response.status(401).json({ error: 'Not authenticated' })
  }
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' })
  const { action, email, password } = request.body as { action?: 'signup' | 'login'; email?: string; password?: string }
  if (!email || !password || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return response.status(400).json({ error: 'Use a valid email and password of at least 8 characters' })
  const normalized = email.trim().toLowerCase()
  if (action === 'signup') {
    const hash = await bcrypt.hash(password, 12)
    try {
      db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(normalized, hash)
    } catch {
      return response.status(409).json({ error: 'An account with this email already exists' })
    }
  }
  const account = db.prepare('SELECT id, email, password_hash, balance, status FROM users WHERE email = ?').get(normalized) as { id: number; email: string; password_hash: string; balance: number; status: string } | undefined
  if (!account || !(await bcrypt.compare(password, account.password_hash))) return response.status(401).json({ error: 'Invalid email or password' })
  if (account.status !== 'active') return response.status(403).json({ error: 'This account is blocked' })
  const token = crypto.randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, account.id, Math.floor(Date.now() / 1000) + 604800)
  return response.status(200).setHeader('Set-Cookie', cookie(token)).json({ user: { id: account.id, email: account.email, balance: account.balance } })
}
