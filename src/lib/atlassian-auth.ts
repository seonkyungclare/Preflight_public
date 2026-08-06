import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { gzipSync, gunzipSync } from 'zlib'

const COOKIE_NAME = 'atlassian_session'
const REFRESH_COOKIE_NAME = 'atlassian_refresh'
const STATE_COOKIE_NAME = 'atlassian_oauth_state'
const SCOPES = ['read:page:confluence', 'read:space:confluence', 'offline_access']

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

/**
 * 암호화 전에 gzip으로 줄인다.
 *
 * Atlassian 액세스 토큰은 JWT라 계정에 따라 3,000자에 가까워진다. 그대로
 * 암호화하면 base64url 확장까지 겹쳐 쿠키 값이 4,000자를 넘고, 브라우저는
 * **이름+값이 4,096바이트를 넘는 쿠키를 오류 없이 그냥 버린다.** 그러면
 * OAuth는 성공했는데 화면은 로그인 안 된 상태로 돌아와, 원인을 찾을 단서가
 * 전혀 남지 않는다(실제로 겪었다 — 세션 4,088자 + 이름 17자 = 4,105자).
 *
 * JWT는 base64라 6비트/바이트만 쓰는 구조적 중복이 있어 gzip이 잘 듣는다.
 * 위 사례를 실측하면 4,088자 → 2,288자(44% 감소)로 줄었다.
 */
function encrypt(plaintext: string): string {
  const key = getSecretKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const compressed = gzipSync(Buffer.from(plaintext, 'utf8'), { level: 9 })
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()])
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
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()])

    // gzip 매직 바이트(1f 8b)가 있으면 압축본, 없으면 압축을 넣기 전에
    // 발급된 쿠키다. 재로그인을 강제하지 않도록 둘 다 받아준다.
    if (plain.length >= 2 && plain[0] === 0x1f && plain[1] === 0x8b) {
      return gunzipSync(plain).toString('utf8')
    }
    return plain.toString('utf8')
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
