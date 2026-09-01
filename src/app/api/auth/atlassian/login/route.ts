import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import {
  buildAuthorizeUrl,
  buildCallbackUri,
  ATLASSIAN_STATE_COOKIE,
} from '@/lib/atlassian-auth'
import { RETURN_TO_COOKIE, sanitizeReturnTo } from '@/lib/app-session'

export async function GET(req: Request): Promise<Response> {
  const state = randomBytes(16).toString('hex')
  const callbackUri = buildCallbackUri(req)
  const returnTo = sanitizeReturnTo(new URL(req.url).searchParams.get('next'))

  const cookieStore = await cookies()
  const shortLivedOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 10,
    path: '/',
  }
  cookieStore.set(ATLASSIAN_STATE_COOKIE, state, shortLivedOpts)
  cookieStore.set(RETURN_TO_COOKIE, returnTo, shortLivedOpts)

  const authorizeUrl = buildAuthorizeUrl(state, callbackUri)
  return Response.redirect(authorizeUrl, 302)
}
