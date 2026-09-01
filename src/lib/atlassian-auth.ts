import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const COOKIE_NAME = 'atlassian_session'
const REFRESH_COOKIE_NAME = 'atlassian_refresh'
const STATE_COOKIE_NAME = 'atlassian_oauth_state'
const SCOPES = ['read:me', 'read:page:confluence', 'read:space:confluence', 'offline_access']

export const ATLASSIAN_SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7일

export interface SessionData {
  accessToken: string
  refreshToken?: string
  cloudId?: string
  cloudUrl?: string
  expiresAt: number
}

interface SessionCore {
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
): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
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
  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
} | null> {
  const clientId = process.env.ATLASSIAN_CLIENT_ID
  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  try {
    const res = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    })
    if (!res.ok) return null
    return res.json() as Promise<{
      access_token: string
      refresh_token?: string
      expires_in: number
    }>
  } catch {
    return null
  }
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

export interface AtlassianProfile {
  accountId: string
  email?: string
  name?: string
}

/** 로그인한 Atlassian 계정 정보 조회 (read:me 스코프 필요) */
export async function getCurrentUser(accessToken: string): Promise<AtlassianProfile | null> {
  try {
    const res = await fetch('https://api.atlassian.com/me', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (!res.ok) {
      console.error(`[atlassian me] ${res.status} ${(await res.text()).slice(0, 200)}`)
      return null
    }
    const me = (await res.json()) as { account_id: string; email?: string; name?: string }
    return { accountId: me.account_id, email: me.email, name: me.name }
  } catch (e) {
    console.error('[atlassian me]', e)
    return null
  }
}

export function encodeSessionCore(session: SessionData): string {
  const core: SessionCore = {
    accessToken: session.accessToken,
    cloudId: session.cloudId,
    cloudUrl: session.cloudUrl,
    expiresAt: session.expiresAt,
  }
  return encrypt(JSON.stringify(core))
}

export function encodeRefreshToken(refreshToken: string): string {
  return encrypt(refreshToken)
}

export function decodeSession(coreToken: string | undefined, refreshCookieToken: string | undefined): SessionData | null {
  if (!coreToken) return null
  const corePlain = decrypt(coreToken)
  if (!corePlain) return null
  try {
    const core = JSON.parse(corePlain) as SessionCore
    const refreshToken = refreshCookieToken ? decrypt(refreshCookieToken) ?? undefined : undefined
    return { ...core, refreshToken }
  } catch {
    return null
  }
}

export function isAccessTokenValid(session: SessionData): boolean {
  // 60초 여유를 두고 만료 판정
  return session.expiresAt > Date.now() + 60_000
}

export const ATLASSIAN_COOKIE = COOKIE_NAME
export const ATLASSIAN_REFRESH_COOKIE = REFRESH_COOKIE_NAME
export const ATLASSIAN_STATE_COOKIE = STATE_COOKIE_NAME

export function buildCallbackUri(req: Request): string {
  const u = new URL(req.url)
  return `${u.protocol}//${u.host}/api/auth/atlassian/callback`
}
