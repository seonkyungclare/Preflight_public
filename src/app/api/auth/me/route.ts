import { cookies } from 'next/headers'
import { AUTH_COOKIE, verifyAuthToken } from '@/lib/app-session'

export async function GET(): Promise<Response> {
  const cookieStore = await cookies()
  const user = await verifyAuthToken(cookieStore.get(AUTH_COOKIE)?.value)
  if (!user) return Response.json({ authenticated: false }, { status: 401 })
  return Response.json({ authenticated: true, ...user })
}
