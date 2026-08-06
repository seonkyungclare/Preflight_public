import { cookies } from 'next/headers'
import TurndownService from 'turndown'
import {
  ATLASSIAN_COOKIE,
  ATLASSIAN_REFRESH_COOKIE,
  ATLASSIAN_SESSION_MAX_AGE,
  decodeSession,
  encodeSessionCore,
  encodeRefreshToken,
  isAccessTokenValid,
  refreshAccessToken,
  type SessionData,
} from '@/lib/atlassian-auth'
import { resolveConfluencePage, type PageResolution } from '@/lib/confluence-page'

function hostOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * 입력 호스트가 **확실히 다른 Atlassian 사이트**인지 판정한다.
 *
 * ⚠️ 전제: 이 라우트는 입력 URL로 요청을 보내지 않는다(파싱만 한다).
 * 따라서 호스트 검사는 토큰 유출을 막는 장치가 아니다 — 유출은 요청 자체를
 * 없애서 막았다. 여기서 막는 것은 "다른 사이트의 URL을 붙여넣었을 때 그
 * page ID로 내 사이트를 조회해 엉뚱한 페이지가 나오는 것"뿐이다.
 *
 * 그래서 **확실할 때만 막는다(fail-open)**. 사내 위키(wiki.team.musinsa.com)처럼
 * 커스텀 도메인을 쓰는 Atlassian Cloud는 accessible-resources가 *.atlassian.net
 * 형태를 돌려줄 수 있어서, "세션 호스트와 다르다"는 이유로 막으면 정상적인
 * 사내 URL이 통째로 거부된다. 판단이 불확실하면 통과시킨다.
 */
function isForeignAtlassianSite(hostname: string, cloudUrl: string | undefined): boolean {
  const h = hostname.toLowerCase()
  // 커스텀 도메인일 수 있다 → 남의 것인지 알 수 없다 → 막지 않는다
  if (!h.endsWith('.atlassian.net')) return false

  const sessionHost = hostOf(cloudUrl)
  // 세션 호스트가 커스텀 도메인이면 같은 사이트의 정규 이름일 수 있다 → 막지 않는다
  if (!sessionHost || !sessionHost.endsWith('.atlassian.net')) return false

  // 양쪽 모두 *.atlassian.net → 이때는 비교가 믿을 만하다
  return h !== sessionHost
}

/**
 * Atlassian 단축 링크(/wiki/x/<code>) → pageId.
 * 인코딩 규칙: pageId를 8바이트 little-endian → base64 → 뒤쪽 'A'·'=' 제거 → '/'→'-', '+'→'_'.
 * 네트워크 호출 없이 로컬에서 역산하므로 외부 요청이 발생하지 않는다.
 * 디코딩 결과는 API 응답의 _links.tinyui와 대조해 검증한다.
 */
function decodeTinyLink(code: string): string | null {
  if (code.length === 0 || code.length > 11) return null
  const b64 = code.replace(/-/g, '/').replace(/_/g, '+').padEnd(11, 'A')
  let buf: Buffer
  try {
    buf = Buffer.from(b64, 'base64')
  } catch {
    return null
  }
  if (buf.length < 8) return null
  const lo = buf.readUInt32LE(0)
  const hi = buf.readUInt32LE(4)
  // hi가 2^21을 넘으면 Number.MAX_SAFE_INTEGER 초과 → 정확히 표현할 수 없다
  if (hi > 0x1fffff) return null
  const id = hi * 0x100000000 + lo
  if (id <= 0) return null
  return String(id)
}

type ParsedUrl =
  | { ok: true; pageId: string; tinyCode?: string }
  | { ok: false; error: string }

/**
 * 사용자가 입력한 Confluence URL에서 pageId를 뽑는다.
 * 입력 URL로는 절대 요청을 보내지 않는다 — 파싱만 한다.
 */
function parseConfluenceUrl(rawUrl: string, cloudUrl: string | undefined): ParsedUrl {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { ok: false, error: '올바른 URL 형식이 아닙니다. 브라우저 주소창의 URL을 그대로 복사해 붙여넣으세요.' }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'http/https 주소만 사용할 수 있습니다.' }
  }

  if (isForeignAtlassianSite(parsed.hostname, cloudUrl)) {
    return {
      ok: false,
      error: `연결된 Confluence 사이트(${hostOf(cloudUrl)})가 아닌 다른 사이트(${parsed.hostname})의 주소입니다. 연결된 사이트의 페이지 URL을 입력해주세요.`,
    }
  }

  // 1) /pages/<id> 형태
  const direct = parsed.pathname.match(/\/pages\/(\d+)/)
  if (direct) return { ok: true, pageId: direct[1] }

  // 2) 구형 ?pageId=<id> 형태
  const queryId = parsed.searchParams.get('pageId')
  if (queryId && /^\d+$/.test(queryId)) return { ok: true, pageId: queryId }

  // 3) 단축 링크 /x/<code>
  const tiny = parsed.pathname.match(/\/x\/([A-Za-z0-9_-]+)/)
  if (tiny) {
    const pageId = decodeTinyLink(tiny[1])
    if (pageId) return { ok: true, pageId, tinyCode: tiny[1] }
    return {
      ok: false,
      error: '단축 링크를 해석하지 못했습니다. 페이지를 연 뒤 브라우저 주소창의 전체 URL을 복사해 붙여넣으세요.',
    }
  }

  return {
    ok: false,
    error: 'Confluence 페이지 URL을 인식하지 못했습니다. 브라우저 주소창의 URL을 직접 복사해 붙여넣으세요.',
  }
}

function setSessionCookie(session: SessionData) {
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: ATLASSIAN_SESSION_MAX_AGE,
    path: '/',
  }
  cookies().set(ATLASSIAN_COOKIE, encodeSessionCore(session), cookieOpts)
  if (session.refreshToken) {
    cookies().set(ATLASSIAN_REFRESH_COOKIE, encodeRefreshToken(session.refreshToken), cookieOpts)
  }
}

async function ensureValidAccessToken(session: SessionData): Promise<SessionData | null> {
  if (isAccessTokenValid(session)) return session
  if (!session.refreshToken) return null

  const refreshed = await refreshAccessToken(session.refreshToken)
  if (!refreshed) return null

  const newSession: SessionData = {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? session.refreshToken,
    cloudId: session.cloudId,
    cloudUrl: session.cloudUrl,
    sites: session.sites,
    expiresAt: Date.now() + refreshed.expires_in * 1000,
  }
  setSessionCookie(newSession)
  return newSession
}

/**
 * 사이트 판별 실패를 사용자에게 보일 문구로 옮긴다.
 * 이 응답의 error는 화면이 그대로 출력하므로(UploadScreen의
 * ATLASSIAN_ERROR_MESSAGES 맵은 OAuth 콜백의 ?atlassian_error= 코드 전용이라
 * 여기엔 관여하지 않는다) 한국어 완성 문장으로 만든다.
 */
function describeResolutionFailure(
  r: Exclude<PageResolution, { kind: 'ok' }>
): { error: string; status: number } {
  switch (r.kind) {
    case 'expired':
      return { error: 'Atlassian 세션이 만료되었습니다. 다시 연결해주세요.', status: 401 }
    case 'site-mismatch':
      return {
        error:
          `연결된 계정(${r.connectedHosts.join(', ')})과 입력한 위키(${r.inputHost})가 다릅니다. ` +
          `해당 위키에 접근할 수 있는 계정으로 다시 연결하거나, 연결된 사이트의 페이지 URL을 넣어주세요.`,
        status: 403,
      }
    case 'ambiguous':
      return {
        error:
          `이 페이지 번호가 연결된 사이트 여러 곳(${r.hosts.join(', ')})에 모두 있어 ` +
          `어느 문서인지 가리지 못했습니다. 엉뚱한 문서를 채점하지 않도록 중단했습니다. ` +
          `페이지 제목이 포함된 전체 URL을 붙여넣어 주세요.`,
        status: 409,
      }
    case 'forbidden':
      return { error: '페이지에 접근할 수 없습니다. 권한이 있는지 확인하세요.', status: 403 }
    case 'unresolved':
      // 권한 문제인지 계정이 다른 건지 서버가 가릴 수 없는 경우.
      // 한쪽으로 단정하면 둘 중 하나는 반드시 오진이라 둘 다 적는다.
      return {
        error:
          `입력한 위키(${r.inputHost})에서 이 페이지를 읽지 못했습니다. ` +
          `두 가지 가능성이 있습니다 — ① 이 페이지에 대한 접근 권한이 없거나, ` +
          `② 연결된 계정(${r.connectedHosts.join(', ')})이 이 위키의 계정이 아닙니다. ` +
          `브라우저에서 그 페이지가 본인에게 보이는지 먼저 확인하고, 보인다면 다른 계정으로 다시 연결해 주세요.`,
        status: 403,
      }
    case 'api-error':
      return { error: `Confluence API 응답 오류 (${r.status})`, status: 502 }
  }
}

export async function POST(req: Request): Promise<Response> {
  const body: unknown = await req.json()

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).url !== 'string'
  ) {
    return Response.json({ error: 'url이 필요합니다' }, { status: 400 })
  }

  const { url } = body as { url: string }

  const sessionToken = cookies().get(ATLASSIAN_COOKIE)?.value
  const refreshToken = cookies().get(ATLASSIAN_REFRESH_COOKIE)?.value
  const initialSession = decodeSession(sessionToken, refreshToken)
  if (!initialSession || !initialSession.cloudId) {
    return Response.json(
      { error: 'Atlassian 연결이 필요합니다. "Atlassian 연결" 버튼을 먼저 클릭해주세요.' },
      { status: 401 }
    )
  }

  const session = await ensureValidAccessToken(initialSession)
  if (!session) {
    return Response.json(
      { error: 'Atlassian 세션이 만료되었습니다. 다시 연결해주세요.' },
      { status: 401 }
    )
  }

  const parsed = parseConfluenceUrl(url, session.cloudUrl)
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 })
  }
  const { pageId, tinyCode } = parsed

  try {
    const resolved = await resolveConfluencePage(url, pageId, session)

    if (resolved.kind !== 'ok') {
      const { error, status } = describeResolutionFailure(resolved)
      return Response.json({ error }, { status })
    }

    const data = resolved.page

    // 단축 링크로 들어온 경우, 로컬 디코딩 결과가 맞는지 응답의 tinyui와 대조한다.
    // 알고리즘이 어긋나 엉뚱한 페이지를 가져오는 상황을 조용히 넘기지 않기 위함.
    // 사이트 판별(resolveConfluencePage)과 별개 검사다 — 사이트가 맞아도
    // 페이지 번호를 잘못 디코딩했을 수 있다.
    if (tinyCode) {
      const returned = data._links?.tinyui?.match(/\/x\/([A-Za-z0-9_-]+)/)?.[1]
      if (returned && returned !== tinyCode) {
        console.error(`[confluence] tinyui 불일치: 입력=${tinyCode} 응답=${returned}`)
        return Response.json(
          { error: '단축 링크를 해석하지 못했습니다. 페이지를 연 뒤 브라우저 주소창의 전체 URL을 복사해 붙여넣으세요.' },
          { status: 400 }
        )
      }
    }

    const html = data.body?.storage?.value ?? ''
    const title = data.title ?? '제목 없음'

    if (!html.trim()) {
      return Response.json({ error: '페이지 내용이 비어있습니다.' }, { status: 422 })
    }

    const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })

    td.addRule('confluenceMacros', {
      filter: (node) => node.nodeName.toLowerCase().startsWith('ac:'),
      replacement: (content) => content,
    })

    const cleanedHtml = html
      .replace(/<ac:image[^>]*>[\s\S]*?<\/ac:image>/g, '[이미지]')
      .replace(/<ri:[^>]*\/>/g, '')

    const markdown = td.turndown(cleanedHtml).trim()

    return Response.json({ title, text: markdown })
  } catch (err) {
    console.error('[confluence] fetch 오류:', err)
    return Response.json({ error: 'Confluence 페이지를 가져오지 못했습니다.' }, { status: 500 })
  }
}
