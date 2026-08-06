import { cookies } from 'next/headers'
import {
  ATLASSIAN_COOKIE,
  ATLASSIAN_REFRESH_COOKIE,
  decodeSession,
  isAccessTokenValid,
} from '@/lib/atlassian-auth'

export async function GET(): Promise<Response> {
  // OAuth 설정 자체가 없는 환경(로컬 등)과 "아직 로그인만 안 한 상태"를 구분한다.
  // 값이 아니라 존재 여부만 내보내므로 시크릿은 노출되지 않는다.
  const configured = !!(
    process.env.ATLASSIAN_CLIENT_ID &&
    process.env.ATLASSIAN_CLIENT_SECRET &&
    process.env.ATLASSIAN_SESSION_SECRET
  )

  const sessionToken = cookies().get(ATLASSIAN_COOKIE)?.value
  const refreshToken = cookies().get(ATLASSIAN_REFRESH_COOKIE)?.value
  const session = decodeSession(sessionToken, refreshToken)
  if (!session) return Response.json({ connected: false, configured })

  // access token이 만료됐어도 refresh token이 있으면 연결 상태로 간주
  // (실제 API 호출 시 자동 갱신됨)
  const stillConnectable = isAccessTokenValid(session) || !!session.refreshToken
  if (!stillConnectable) return Response.json({ connected: false, configured })

  return Response.json({
    connected: true,
    configured,
    cloudUrl: session.cloudUrl,
    expiresAt: session.expiresAt,
  })
}
