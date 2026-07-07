import { cookies } from 'next/headers'
import { ATLASSIAN_COOKIE, ATLASSIAN_REFRESH_COOKIE } from '@/lib/atlassian-auth'

export async function POST(): Promise<Response> {
  const cookieStore = await cookies()
  cookieStore.delete(ATLASSIAN_COOKIE)
  cookieStore.delete(ATLASSIAN_REFRESH_COOKIE)
  return Response.json({ ok: true })
}
