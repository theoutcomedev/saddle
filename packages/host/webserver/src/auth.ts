import { createHmac } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

const ADMIN_PASSWORD = process.env.SADDLE_ADMIN_PASSWORD || ''
const ADMIN_TOKEN = ADMIN_PASSWORD
  ? createHmac('sha256', ADMIN_PASSWORD).update('saddle-session-v1').digest('hex')
  : ''

function getSessionCookie(req: IncomingMessage): string | undefined {
  if (!req.headers.cookie) return undefined
  const match = req.headers.cookie.match(/saddle_session=([^;]+)/)
  return match ? match[1] : undefined
}

export async function handleAuth(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!ADMIN_PASSWORD) return true // No auth configured

  const rawPath = new URL(req.url ?? '/', 'http://x').pathname

  // We only protect the API routes. Static assets (the frontend SPA) are allowed to load
  // so that the browser can execute the React code and render the Login Screen.
  if (!rawPath.startsWith('/api/')) {
    return true
  }

  // Allow auth check
  if (rawPath === '/api/auth/status' && req.method === 'GET') {
    const isAuthenticated = getSessionCookie(req) === ADMIN_TOKEN
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ authEnabled: true, authenticated: isAuthenticated }))
    return false // Handled
  }

  // Allow login
  if (rawPath === '/api/auth/login' && req.method === 'POST') {
    const body = await new Promise<{ password?: string } | null>((resolve) => {
      let b = ''
      req.on('data', (chunk) => { b += chunk.toString() })
      req.on('end', () => {
        try { resolve(JSON.parse(b)) } catch(_e) { resolve(null) }
      })
    })

    if (body && body.password === ADMIN_PASSWORD) {
      // 30 days expiration
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': `saddle_session=${ADMIN_TOKEN}; HttpOnly; Path=/; SameSite=Strict; Expires=${expires}`,
      })
      res.end(JSON.stringify({ success: true }))
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
    }
    return false // Handled
  }

  // For all other /api/ routes, enforce the cookie
  if (getSessionCookie(req) !== ADMIN_TOKEN) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return false // Handled (rejected)
  }

  return true // Authenticated, proceed
}

import type { Duplex } from 'node:stream'

export function handleUpgradeAuth(req: IncomingMessage, socket: Duplex): boolean {
  if (!ADMIN_PASSWORD) return true

  const rawPath = new URL(req.url ?? '/', 'http://x').pathname

  // Only protect /api/ upgrades (which is where WebSocketDownlinks run)
  if (!rawPath.startsWith('/api/')) return true

  if (getSessionCookie(req) !== ADMIN_TOKEN) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
    socket.destroy()
    return false
  }

  return true
}
