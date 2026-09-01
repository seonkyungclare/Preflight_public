import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_COOKIE, verifyAuthToken } from '@/lib/app-session'

/**
 * 외부망 접근 차단용 게이트.
 * 로그인 화면과 인증 콜백을 제외한 모든 페이지·API는 사내 Atlassian 계정 세션이 있어야 통과한다.
 */
const PUBLIC_PATHS = ['/login', '/api/auth/']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p))
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const user = await verifyAuthToken(req.cookies.get(AUTH_COOKIE)?.value)
  if (user) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: '인증이 필요합니다. 사내 Atlassian 계정으로 로그인해 주세요.' },
      { status: 401 }
    )
  }

  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('next', `${pathname}${search}`)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // 정적 자산과 파비콘은 제외 (그 외 모든 경로를 검사)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)'],
}
