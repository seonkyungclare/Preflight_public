import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const COOKIE_NAME = 'atlassian_session'
const STATE_COOKIE_NAME = 'atlassian_oauth_state'
const SCOPES = ['read:page:confluence', 'read:space:confluence']

export interface SessionData {
  accessToken: string
  cloudId?: string
  cloudUrl?: string
  expiresAt: number
}

function getSecretKey(): Buffer {
  const secret = process.env.ATLASSIAN_SESSION_SECRET
  if (!secret) throw new Error('ATLASSIAN_SESSION_SECRET이 설정되어 있지 않습니다')
  return scryptSync(secret, 'atlassian-session', 32)
}

function encrypt(plaintext: string): string {
  const key = getSecretKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

function decrypt(token: string): string | null {
  try {
    const data = Buffer.from(token, 'base64url')
    const iv = data.subarray(0, 12)
    const tag = data.subarray(12, 28)
    const encrypted = data.subarray(28)
    const key = getSecretKey()
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return plaintext.toString('utf8')
  } catch {
    return null
  }
}

export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const clientId = process.env.ATLASSIAN_CLIENT_ID
  if (!clientId) throw new Error('ATLASSIAN_CLIENT_ID이 설정되어 있지 않습니다')

  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId,
    scope: SCOPES.join(' '),
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    prompt: 'consent',
  })
  return `https://auth.atlassian.com/authorize?${params.toString()}`
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; expires_in: number }> {
  const clientId = process.env.ATLASSIAN_CLIENT_ID
  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Atlassian OAuth 환경변수가 설정되어 있지 않습니다')
  }

  const res = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`토큰 교환 실패 (${res.status}): ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>
}

export async function getAccessibleResource(accessToken: string): Promise<{
  id: string
  url: string
  name: string
} | null> {
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) return null
  const arr = (await res.json()) as Array<{ id: string; url: string; name: string }>
  return arr[0] ?? null
}

export function encodeSession(session: SessionData): string {
  return encrypt(JSON.stringify(session))
}

export function decodeSession(token: string): SessionData | null {
  const plain = decrypt(token)
  if (!plain) return null
  try {
    const data = JSON.parse(plain) as SessionData
    if (data.expiresAt < Date.now()) return null
    return data
  } catch {
    return null
  }
}

export const ATLASSIAN_COOKIE = COOKIE_NAME
export const ATLASSIAN_STATE_COOKIE = STATE_COOKIE_NAME

export function buildCallbackUri(req: Request): string {
  const u = new URL(req.url)
  return `${u.protocol}//${u.host}/api/auth/atlassian/callback`
}
