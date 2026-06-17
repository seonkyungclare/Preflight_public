import { cookies } from 'next/headers'
import { ATLASSIAN_COOKIE, decodeSession } from '@/lib/atlassian-auth'

export async function GET(): Promise<Response> {
  const token = cookies().get(ATLASSIAN_COOKIE)?.value
  if (!token) return Response.json({ connected: false })

  const session = decodeSession(token)
  if (!session) return Response.json({ connected: false })

  return Response.json({
    connected: true,
    cloudUrl: session.cloudUrl,
    expiresAt: session.expiresAt,
  })
}
