import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { gzipSync, gunzipSync } from 'zlib'

const COOKIE_NAME = 'atlassian_session'
const REFRESH_COOKIE_NAME = 'atlassian_refresh'
const STATE_COOKIE_NAME = 'atlassian_oauth_state'
const SCOPES = ['read:page:confluence', 'read:space:confluence', 'offline_access']

export const ATLASSIAN_SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7일

/** 토큰 하나로 접근 가능한 Atlassian 사이트 한 곳. */
export interface AtlassianSite {
  id: string
  url: string
}

export interface SessionData {
  accessToken: string
  refreshToken?: string
  /** 기본 사이트. sites가 없는 옛 쿠키와의 호환을 위해 계속 둔다. */
  cloudId?: string
  cloudUrl?: string
  /** 접근 가능한 사이트 전체. 옛 쿠키에는 없으므로 optional. */
  sites?: AtlassianSite[]
  expiresAt: number
}

interface SessionCore {
  accessToken: string
  cloudId?: string
  cloudUrl?: string
  sites?: AtlassianSite[]
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

/**
 * 세션 쿠키에 담을 사이트 수 상한.
 * 쿠키 한 개의 한계는 4KB인데 access token(JWT)만으로 이미 1KB 안팎을 쓴다.
 * 넘치면 브라우저가 쿠키를 통째로 버려 연결 자체가 깨지므로 개수를 자른다.
 */
const MAX_SESSION_SITES = 10

/**
 * 토큰으로 접근 가능한 사이트를 **전부** 돌려준다.
 *
 * 예전에는 여기서 arr[0]만 골라 세션에 박았는데, 계정이 여러 사이트에
 * 붙어 있으면(개인 *.atlassian.net, 다른 조직, 샌드박스) 엉뚱한 사이트가
 * 잡혀도 화면에는 "페이지에 접근할 수 없습니다"로만 보였다.
 * 고르는 일은 실제로 페이지를 읽는 쪽(fetch-confluence)에 맡긴다.
 */
export async function getAccessibleResources(accessToken: string): Promise<AtlassianSite[]> {
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) return []
  const arr: unknown = await res.json()
  if (!Array.isArray(arr)) return []
  return arr
    .filter(
      (r): r is { id: string; url: string } =>
        typeof r?.id === 'string' && typeof r?.url === 'string'
    )
    .map((r) => ({ id: r.id, url: r.url }))
    .slice(0, MAX_SESSION_SITES)
}

/** URL에서 호스트만 소문자로 뽑는다. 파싱 실패하면 null. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase()
  } catch {
    return null
  }
}

/**
 * 세션이 아는 사이트 목록. 옛 쿠키(sites 없음)는 기본 사이트 하나로 취급해
 * 기존과 똑같이 동작하게 한다.
 */
export function sessionSites(session: SessionData): AtlassianSite[] {
  if (session.sites?.length) return session.sites
  if (session.cloudId) return [{ id: session.cloudId, url: session.cloudUrl ?? '' }]
  return []
}

/**
 * 붙여넣은 URL이 이 사이트의 것인지 호스트로 판단한다.
 * 호스트를 비교하는 곳은 여기 하나로 모은다 — 같은 판단이 여러 군데
 * 따로 구현되면 한쪽만 고쳐졌을 때 조용히 어긋난다.
 *
 * ⚠️ **참(true)일 때만 믿을 수 있다.** 거짓이라고 해서 남의 호스트라는 뜻이
 * 아니다. 사내 위키(wiki.team.musinsa.com)처럼 커스텀 도메인을 쓰는
 * Atlassian Cloud는 accessible-resources가 *.atlassian.net 형태를 돌려주므로
 * 정상적인 사내 URL도 여기서 거짓이 된다.
 *
 * 따라서 **이 함수만으로 "토큰을 보내도 되는 호스트인지"를 판정하면 안 된다.**
 * 그렇게 쓰면 사내 위키가 통째로 차단된다. 그런 허용목록이 필요하면
 * 별도 기준(설정값 등)을 두고, 이 함수는 보조 신호로만 쓴다.
 */
export function matchesSite(inputUrl: string, site: AtlassianSite): boolean {
  const a = hostOf(inputUrl)
  const b = hostOf(site.url)
  return a !== null && b !== null && a === b
}

/**
 * 쿠키 값의 상한. 브라우저 한계는 이름·속성까지 합쳐 4096바이트이고,
 * 넘으면 오류 없이 **통째로 버려져** 연결이 끊긴 것처럼 보인다.
 * 이름과 속성 몫으로 300바이트 정도를 남겨둔다.
 */
const MAX_COOKIE_BYTES = 3800

/**
 * 세션을 암호화해 쿠키 값으로 만든다.
 *
 * access token 길이는 계정마다 다르고 sites까지 담으면 한계를 넘을 수 있다.
 * 넘치면 사이트 목록을 뒤에서부터 덜어낸다 — 사이트 목록을 잃으면
 * 사이트 자동 판별만 못 하게 되지만(기존 동작으로 후퇴), 쿠키가 버려지면
 * 로그인 자체가 안 된다.
 */
export function encodeSessionCore(session: SessionData): string {
  const build = (sites: AtlassianSite[] | undefined): string =>
    encrypt(
      JSON.stringify({
        accessToken: session.accessToken,
        cloudId: session.cloudId,
        cloudUrl: session.cloudUrl,
        sites,
        expiresAt: session.expiresAt,
      } satisfies SessionCore)
    )

  let sites = session.sites
  let encoded = build(sites)

  while (encoded.length > MAX_COOKIE_BYTES && sites && sites.length > 0) {
    sites = sites.slice(0, -1)
    encoded = build(sites.length > 0 ? sites : undefined)
    console.warn(
      `[atlassian] 세션 쿠키가 너무 커서 사이트 목록을 ${sites.length}곳으로 줄였습니다`
    )
  }

  if (encoded.length > MAX_COOKIE_BYTES) {
    // 사이트를 다 덜어내도 넘치는 경우 — access token 자체가 긴 계정이다.
    // 여기까지 오면 쿠키가 버려져 연결이 안 되므로 원인을 남긴다.
    console.error(
      `[atlassian] 세션 쿠키가 한계를 넘었습니다 (${encoded.length}바이트). 브라우저가 쿠키를 버려 연결이 실패할 수 있습니다`
    )
  }

  return encoded
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
  // Vercel 등 프록시 뒤에서는 req.url의 host·protocol이 내부값(localhost/http)일 수
  // 있다. 이 콜백은 authorize 단계와 token 교환 단계에서 동일해야 하고, 또 Atlassian
  // 콘솔에 등록한 redirect_uri와 한 글자도 달라선 안 된다(달라지면 로그인 실패).
  // 그래서 프록시가 넘겨주는 공개 host·protocol을 우선하고, 헤더가 없으면(로컬 dev)
  // req.url을 그대로 쓴다 — 로컬 동작은 이전과 같다.
  const fwdHost = req.headers.get('x-forwarded-host')
  const fwdProto = req.headers.get('x-forwarded-proto')
  const host = fwdHost || u.host
  const proto = fwdProto ? fwdProto.split(',')[0].trim() : u.protocol.replace(/:$/, '')
  return `${proto}://${host}/api/auth/atlassian/callback`
}
