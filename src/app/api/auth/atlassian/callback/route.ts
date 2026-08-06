import { cookies } from 'next/headers'
import {
  exchangeCodeForToken,
  getAccessibleResources,
  encodeSessionCore,
  encodeRefreshToken,
  buildCallbackUri,
  ATLASSIAN_COOKIE,
  ATLASSIAN_REFRESH_COOKIE,
  ATLASSIAN_STATE_COOKIE,
  ATLASSIAN_SESSION_MAX_AGE,
} from '@/lib/atlassian-auth'

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateFromUrl = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  if (errorParam) {
    return Response.redirect(`${url.origin}/?atlassian_error=${encodeURIComponent(errorParam)}`, 302)
  }

  if (!code || !stateFromUrl) {
    return Response.redirect(`${url.origin}/?atlassian_error=invalid_callback`, 302)
  }

  const stateCookie = cookies().get(ATLASSIAN_STATE_COOKIE)?.value
  if (!stateCookie || stateCookie !== stateFromUrl) {
    return Response.redirect(`${url.origin}/?atlassian_error=state_mismatch`, 302)
  }

  try {
    const callbackUri = buildCallbackUri(req)
    const tokenRes = await exchangeCodeForToken(code, callbackUri)
    const sites = await getAccessibleResources(tokenRes.access_token)

    if (sites.length === 0) {
      return Response.redirect(`${url.origin}/?atlassian_error=no_resource`, 302)
    }

    // 사이트가 2개 이상이면 "권한 없음"으로 보이는 오류의 진짜 원인이
    // 사이트 오선택일 수 있으므로 여기부터 확인한다.
    // 이제는 콜백에서 하나로 확정하지 않고 전부 세션에 담으므로,
    // "선택"이 아니라 "잡힌 목록 + 기본값"을 남긴다.
    console.log(
      `[atlassian callback] 사이트 ${sites.length}개: ${sites.map((s) => s.url).join(', ')} / 기본: ${sites[0].url}`
    )

    const sessionCookie = encodeSessionCore({
      accessToken: tokenRes.access_token,
      // 기본 사이트는 첫 번째로 두되, 실제 사용 사이트는 요청 때마다
      // 붙여넣은 URL을 보고 sites에서 고른다.
      cloudId: sites[0].id,
      cloudUrl: sites[0].url,
      sites,
      expiresAt: Date.now() + tokenRes.expires_in * 1000,
    })
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: ATLASSIAN_SESSION_MAX_AGE,
      path: '/',
    }
    cookies().set(ATLASSIAN_COOKIE, sessionCookie, cookieOpts)
    if (tokenRes.refresh_token) {
      cookies().set(ATLASSIAN_REFRESH_COOKIE, encodeRefreshToken(tokenRes.refresh_token), cookieOpts)
    }
    // 브라우저는 이름+값이 4096바이트를 넘는 쿠키를 오류 없이 버린다.
    // 그러면 OAuth는 성공했는데 로그인 안 된 화면으로 돌아와 단서가 없다.
    // 조용히 실패하지 않도록 여기서 크기를 남긴다.
    const cookieBytes = ATLASSIAN_COOKIE.length + sessionCookie.length
    console.log(
      `[atlassian callback] session=${sessionCookie.length}자(쿠키 ${cookieBytes}바이트) refresh=${tokenRes.refresh_token ? '있음' : '없음'}`
    )
    if (cookieBytes > 4096) {
      console.error(
        `[atlassian callback] ⚠️ 세션 쿠키가 4096바이트를 넘었습니다(${cookieBytes}). ` +
          `브라우저가 쿠키를 버려 로그인이 안 될 수 있습니다.`
      )
    }
    cookies().delete(ATLASSIAN_STATE_COOKIE)

    return Response.redirect(`${url.origin}/?atlassian_connected=1`, 302)
  } catch (e) {
    console.error('[atlassian callback]', e)
    return Response.redirect(`${url.origin}/?atlassian_error=token_exchange_failed`, 302)
  }
}
