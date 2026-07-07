import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import {
  buildAuthorizeUrl,
  buildCallbackUri,
  ATLASSIAN_STATE_COOKIE,
} from '@/lib/atlassian-auth'

export async function GET(req: Request): Promise<Response> {
  const state = randomBytes(16).toString('hex')
  const callbackUri = buildCallbackUri(req)

  const cookieStore = await cookies()
  cookieStore.set(ATLASSIAN_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  })

  const authorizeUrl = buildAuthorizeUrl(state, callbackUri)
  return Response.redirect(authorizeUrl, 302)
}
