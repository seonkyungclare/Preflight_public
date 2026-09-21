import { cookies } from 'next/headers'
import {
  exchangeCodeForToken,
  getAccessibleResource,
  getCurrentUser,
  encodeSessionCore,
  encodeRefreshToken,
  buildCallbackUri,
  ATLASSIAN_COOKIE,
  ATLASSIAN_REFRESH_COOKIE,
  ATLASSIAN_STATE_COOKIE,
  ATLASSIAN_SESSION_MAX_AGE,
} from '@/lib/atlassian-auth'
import {
  AUTH_COOKIE,
  AUTH_SESSION_MAX_AGE,
  RETURN_TO_COOKIE,
  createAuthToken,
  isEmailAllowed,
  sanitizeReturnTo,
} from '@/lib/app-session'

function loginError(origin: string, reason: string, detail?: string): Response {
  const params = new URLSearchParams({ error: reason })
  if (detail) params.set('detail', detail)
  return Response.redirect(`${origin}/login?${params.toString()}`, 302)
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateFromUrl = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  const cookieStore = await cookies()

  if (errorParam) return loginError(url.origin, errorParam)
  if (!code || !stateFromUrl) return loginError(url.origin, 'invalid_callback')

  const stateCookie = cookieStore.get(ATLASSIAN_STATE_COOKIE)?.value
  if (!stateCookie || stateCookie !== stateFromUrl) {
    return loginError(url.origin, 'state_mismatch')
  }

  try {
    const callbackUri = buildCallbackUri(req)
    const tokenRes = await exchangeCodeForToken(code, callbackUri)

    // ① 사내 계정 여부 검증 — 도메인이 다르면 세션을 만들지 않는다
    const profile = await getCurrentUser(tokenRes.access_token)
    if (!profile?.email) {
      return loginError(url.origin, 'no_email')
    }
    if (!isEmailAllowed(profile.email)) {
      console.warn(`[auth] 허용되지 않은 도메인 로그인 시도: ${profile.email}`)
      return loginError(url.origin, 'domain_not_allowed', profile.email)
    }

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    }

    // ② 앱 접근 세션 발급
    cookieStore.set(AUTH_COOKIE, await createAuthToken({
      email: profile.email,
      name: profile.name,
      accountId: profile.accountId,
    }), { ...cookieOpts, maxAge: AUTH_SESSION_MAX_AGE })

    // ③ Confluence 연동용 Atlassian 세션 (사이트 접근 권한이 없어도 로그인 자체는 허용)
    const resource = await getAccessibleResource(tokenRes.access_token)
    cookieStore.set(ATLASSIAN_COOKIE, encodeSessionCore({
      accessToken: tokenRes.access_token,
      cloudId: resource?.id,
      cloudUrl: resource?.url,
      expiresAt: Date.now() + tokenRes.expires_in * 1000,
    }), { ...cookieOpts, maxAge: ATLASSIAN_SESSION_MAX_AGE })
    if (tokenRes.refresh_token) {
      cookieStore.set(ATLASSIAN_REFRESH_COOKIE, encodeRefreshToken(tokenRes.refresh_token), {
        ...cookieOpts,
        maxAge: ATLASSIAN_SESSION_MAX_AGE,
      })
    }

    console.log(`[auth] 로그인 성공 email=${profile.email} confluence=${resource ? '연결됨' : '없음'}`)

    const returnTo = sanitizeReturnTo(cookieStore.get(RETURN_TO_COOKIE)?.value)
    cookieStore.delete(ATLASSIAN_STATE_COOKIE)
    cookieStore.delete(RETURN_TO_COOKIE)

    const target = new URL(returnTo, url.origin)
    target.searchParams.set('atlassian_connected', '1')
    return Response.redirect(target.toString(), 302)
  } catch (e) {
    console.error('[atlassian callback]', e)
    return loginError(url.origin, 'token_exchange_failed')
  }
}
