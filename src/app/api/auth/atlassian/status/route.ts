import { cookies } from 'next/headers'
import {
  ATLASSIAN_COOKIE,
  ATLASSIAN_REFRESH_COOKIE,
  decodeSession,
  isAccessTokenValid,
} from '@/lib/atlassian-auth'

export async function GET(): Promise<Response> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ATLASSIAN_COOKIE)?.value
  const refreshToken = cookieStore.get(ATLASSIAN_REFRESH_COOKIE)?.value
  const session = decodeSession(sessionToken, refreshToken)
  if (!session) return Response.json({ connected: false })

  // access token이 만료됐어도 refresh token이 있으면 연결 상태로 간주
  // (실제 API 호출 시 자동 갱신됨)
  const stillConnectable = isAccessTokenValid(session) || !!session.refreshToken
  if (!stillConnectable) return Response.json({ connected: false })

  return Response.json({
    connected: true,
    cloudUrl: session.cloudUrl,
    expiresAt: session.expiresAt,
  })
}
