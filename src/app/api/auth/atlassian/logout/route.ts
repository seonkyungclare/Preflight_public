import { cookies } from 'next/headers'
import { ATLASSIAN_COOKIE } from '@/lib/atlassian-auth'

export async function POST(): Promise<Response> {
  cookies().delete(ATLASSIAN_COOKIE)
  return Response.json({ ok: true })
}
