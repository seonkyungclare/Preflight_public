import { cookies } from 'next/headers'
import { ATLASSIAN_COOKIE, ATLASSIAN_REFRESH_COOKIE } from '@/lib/atlassian-auth'
import { AUTH_COOKIE } from '@/lib/app-session'

/** 앱 접근 세션과 Atlassian 연동 세션을 모두 정리 */
export async function POST(): Promise<Response> {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_COOKIE)
  cookieStore.delete(ATLASSIAN_COOKIE)
  cookieStore.delete(ATLASSIAN_REFRESH_COOKIE)
  return Response.json({ ok: true })
}
