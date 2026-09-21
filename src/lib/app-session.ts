/**
 * Preflight 접근 인증 세션.
 *
 * Atlassian OAuth 로그인 결과(사용자 이메일)를 HMAC-SHA256으로 서명한 쿠키에 담는다.
 * middleware(Edge 런타임)와 route handler(Node 런타임) 양쪽에서 쓰이므로
 * node:crypto 대신 Web Crypto API만 사용한다.
 */

export const AUTH_COOKIE = 'preflight_auth'
export const AUTH_SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7일
/** 로그인 후 돌아갈 경로를 담는 임시 쿠키 */
export const RETURN_TO_COOKIE = 'preflight_return_to'

export interface AuthUser {
  /** Atlassian 계정 이메일 (도메인 검증 통과한 값) */
  email: string
  name?: string
  accountId?: string
}

interface AuthPayload extends AuthUser {
  /** 만료 시각(ms) */
  exp: number
}

const encoder = new TextEncoder()

function getSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.ATLASSIAN_SESSION_SECRET
  if (!secret) {
    throw new Error('AUTH_SESSION_SECRET(또는 ATLASSIAN_SESSION_SECRET)이 설정되어 있지 않습니다')
  }
  return secret
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

function b64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 로그인 사용자 정보를 서명된 토큰으로 인코딩 */
export async function createAuthToken(user: AuthUser): Promise<string> {
  const payload: AuthPayload = { ...user, exp: Date.now() + AUTH_SESSION_MAX_AGE * 1000 }
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', await getKey(), encoder.encode(body))
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`
}

/** 서명·만료를 검증하고 사용자 정보를 돌려준다. 실패 시 null */
export async function verifyAuthToken(token: string | undefined): Promise<AuthUser | null> {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await getKey(),
      b64urlDecode(sig),
      encoder.encode(body)
    )
    if (!valid) return null

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as AuthPayload
    if (!payload.email || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    // 서명 이후 허용 도메인 정책이 바뀌었을 수 있으므로 매 요청 재확인
    if (!isEmailAllowed(payload.email)) return null

    return { email: payload.email, name: payload.name, accountId: payload.accountId }
  } catch {
    return null
  }
}

/** 허용 도메인 목록. 기본값은 사내 도메인 */
export function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? 'musinsa.com')
    .split(',')
    .map(d => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
}

/** 도메인 정책의 예외로 개별 허용할 이메일 (협력사 등) */
function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isEmailAllowed(email: string | undefined | null): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (allowedEmails().includes(normalized)) return true

  const domain = normalized.split('@')[1]
  if (!domain) return false
  // 서브도메인(예: team.musinsa.com)까지 허용
  return allowedDomains().some(allowed => domain === allowed || domain.endsWith(`.${allowed}`))
}

/** 오픈 리다이렉트 방지 — 같은 사이트의 절대경로만 허용 */
export function sanitizeReturnTo(value: string | undefined | null): string {
  if (!value) return '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  if (value.startsWith('/login')) return '/'
  return value
}
