import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import {
  buildAuthorizeUrl,
  buildCallbackUri,
  ATLASSIAN_STATE_COOKIE,
} from '@/lib/atlassian-auth'

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)

  // 환경변수가 없으면 throw 대신 홈으로 되돌린다.
  // throw하면 본문 0바이트 500이라 화면이 백지가 되고, 앱으로 돌아올 방법이 없다.
  if (
    !process.env.ATLASSIAN_CLIENT_ID ||
    !process.env.ATLASSIAN_CLIENT_SECRET ||
    !process.env.ATLASSIAN_SESSION_SECRET
  ) {
    return Response.redirect(`${url.origin}/?atlassian_error=not_configured`, 302)
  }

  const state = randomBytes(16).toString('hex')
  const callbackUri = buildCallbackUri(req)

  cookies().set(ATLASSIAN_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // 최초 연결은 Atlassian 로그인·SSO·사이트 선택까지 거쳐 10분을 넘길 수 있다.
    maxAge: 60 * 30,
    path: '/',
  })

  const authorizeUrl = buildAuthorizeUrl(state, callbackUri)
  return Response.redirect(authorizeUrl, 302)
}
