import { cookies } from 'next/headers'
import {
  exchangeCodeForToken,
  getAccessibleResource,
  encodeSessionCore,
  encodeRefreshToken,
  buildCallbackUri,
  ATLASSIAN_COOKIE,
  ATLASSIAN_REFRESH_COOKIE,
  ATLASSIAN_STATE_COOKIE,
  ATLASSIAN_SESSION_MAX_AGE,
} from '@/lib/atlassian-auth'

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateFromUrl = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  if (errorParam) {
    return Response.redirect(`${url.origin}/?atlassian_error=${encodeURIComponent(errorParam)}`, 302)
  }

  if (!code || !stateFromUrl) {
    return Response.redirect(`${url.origin}/?atlassian_error=invalid_callback`, 302)
  }

  const stateCookie = cookies().get(ATLASSIAN_STATE_COOKIE)?.value
  if (!stateCookie || stateCookie !== stateFromUrl) {
    return Response.redirect(`${url.origin}/?atlassian_error=state_mismatch`, 302)
  }

  try {
    const callbackUri = buildCallbackUri(req)
    const tokenRes = await exchangeCodeForToken(code, callbackUri)
    const resource = await getAccessibleResource(tokenRes.access_token)

    if (!resource) {
      return Response.redirect(`${url.origin}/?atlassian_error=no_resource`, 302)
    }

    const sessionCookie = encodeSessionCore({
      accessToken: tokenRes.access_token,
      cloudId: resource.id,
      cloudUrl: resource.url,
      expiresAt: Date.now() + tokenRes.expires_in * 1000,
    })
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: ATLASSIAN_SESSION_MAX_AGE,
      path: '/',
    }
    cookies().set(ATLASSIAN_COOKIE, sessionCookie, cookieOpts)
    if (tokenRes.refresh_token) {
      cookies().set(ATLASSIAN_REFRESH_COOKIE, encodeRefreshToken(tokenRes.refresh_token), cookieOpts)
    }
    console.log(`[atlassian callback] session=${sessionCookie.length}자 refresh=${tokenRes.refresh_token ? '있음' : '없음'}`)
    cookies().delete(ATLASSIAN_STATE_COOKIE)

    return Response.redirect(`${url.origin}/?atlassian_connected=1`, 302)
  } catch (e) {
    console.error('[atlassian callback]', e)
    return Response.redirect(`${url.origin}/?atlassian_error=token_exchange_failed`, 302)
  }
}
