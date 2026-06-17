import { cookies } from 'next/headers'
import {
  exchangeCodeForToken,
  getAccessibleResource,
  encodeSession,
  buildCallbackUri,
  ATLASSIAN_COOKIE,
  ATLASSIAN_STATE_COOKIE,
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

    const session = encodeSession({
      accessToken: tokenRes.access_token,
      cloudId: resource.id,
      cloudUrl: resource.url,
      expiresAt: Date.now() + tokenRes.expires_in * 1000,
    })

    cookies().set(ATLASSIAN_COOKIE, session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokenRes.expires_in,
      path: '/',
    })
    cookies().delete(ATLASSIAN_STATE_COOKIE)

    return Response.redirect(`${url.origin}/?atlassian_connected=1`, 302)
  } catch (e) {
    console.error('[atlassian callback]', e)
    return Response.redirect(`${url.origin}/?atlassian_error=token_exchange_failed`, 302)
  }
}
