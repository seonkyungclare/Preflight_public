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

interface PageResponse {
  id: string
  title: string
  body?: { storage?: { value: string }; atlas_doc_format?: { value: string } }
}

function extractPageId(url: string): string | null {
  const m = url.match(/\/pages\/(\d+)/)
  return m ? m[1] : null
}

async function resolveToPageId(url: string, accessToken: string): Promise<string | null> {
  // 이미 /pages/<id> 형태면 바로 추출
  const direct = extractPageId(url)
  if (direct) return direct

  // /wiki/x/ 단축 링크 → 리다이렉트 따라가서 실제 URL 획득
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'text/html' },
      redirect: 'follow',
    })
    const finalUrl = res.url
    if (finalUrl && finalUrl !== url) {
      return extractPageId(finalUrl)
    }
  } catch {
    // 무시
  }
  return null
}

async function setSessionCookie(session: SessionData) {
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: ATLASSIAN_SESSION_MAX_AGE,
    path: '/',
  }
  const cookieStore = await cookies()
  cookieStore.set(ATLASSIAN_COOKIE, encodeSessionCore(session), cookieOpts)
  if (session.refreshToken) {
    cookieStore.set(ATLASSIAN_REFRESH_COOKIE, encodeRefreshToken(session.refreshToken), cookieOpts)
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
    expiresAt: Date.now() + refreshed.expires_in * 1000,
  }
  await setSessionCookie(newSession)
  return newSession
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

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ATLASSIAN_COOKIE)?.value
  const refreshToken = cookieStore.get(ATLASSIAN_REFRESH_COOKIE)?.value
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

  const pageId = await resolveToPageId(url, session.accessToken)
  if (!pageId) {
    return Response.json(
      { error: 'Confluence 페이지 URL을 인식하지 못했습니다. 브라우저 주소창의 URL을 직접 복사해 붙여넣으세요.' },
      { status: 400 }
    )
  }

  try {
    const apiUrl = `https://api.atlassian.com/ex/confluence/${session.cloudId}/wiki/api/v2/pages/${pageId}?body-format=storage`
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error(`[confluence] ${res.status}: ${errBody.slice(0, 300)}`)
      if (res.status === 401) {
        return Response.json(
          { error: 'Atlassian 세션이 만료되었습니다. 다시 연결해주세요.' },
          { status: 401 }
        )
      }
      if (res.status === 403 || res.status === 404) {
        return Response.json(
          { error: '페이지에 접근할 수 없습니다. 권한이 있는지 확인하세요.' },
          { status: 403 }
        )
      }
      return Response.json(
        { error: `Confluence API 응답 오류 (${res.status})` },
        { status: 502 }
      )
    }

    const data = (await res.json()) as PageResponse
    const html = data.body?.storage?.value ?? ''
    const title = data.title ?? '제목 없음'

    if (!html.trim()) {
      return Response.json({ error: '페이지 내용이 비어있습니다.' }, { status: 422 })
    }

    const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })

    // 표를 markdown 표로 보존 (유저스토리·스코프·매트릭스 등 표 기반 내용의 행/열 구조 유지).
    // 외부 gfm 플러그인은 사내 npm 레지스트리에서 차단되므로 간단한 표 변환을 직접 구현한다.
    td.addRule('tables', {
      filter: 'table',
      replacement: (_content, node) => {
        const rows = Array.from((node as Element).querySelectorAll('tr'))
        if (rows.length === 0) return ''
        const cellsOf = (tr: Element) =>
          Array.from(tr.querySelectorAll('th, td')).map(td =>
            (td.textContent ?? '').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|'),
          )
        const matrix = rows.map(cellsOf).filter(r => r.length > 0)
        if (matrix.length === 0) return ''
        const colCount = Math.max(...matrix.map(r => r.length))
        const pad = (r: string[]) => {
          const c = [...r]
          while (c.length < colCount) c.push('')
          return c
        }
        const line = (cells: string[]) => `| ${cells.join(' | ')} |`
        const header = pad(matrix[0])
        const sep = header.map(() => '---')
        const body = matrix.slice(1).map(pad)
        return `\n\n${[line(header), line(sep), ...body.map(line)].join('\n')}\n\n`
      },
    })

    // ac:* 컨테이너 매크로(layout/panel/expand 등)는 내부 content만 통과시킨다.
    td.addRule('confluenceMacros', {
      filter: (node) => node.nodeName.toLowerCase().startsWith('ac:'),
      replacement: (content) => content,
    })

    const cleanedHtml = html
      // 다이어그램 매크로(drawio/gliffy/mermaid/plantuml)는 텍스트가 아니라 살릴 수 없으므로 마커로 표시
      .replace(
        /<ac:structured-macro[^>]*ac:name="(?:drawio|gliffy|mermaid|plantuml)"[\s\S]*?<\/ac:structured-macro>/g,
        '\n[다이어그램]\n',
      )
      // 이미지/첨부 리소스 → 마커
      .replace(/<ac:image[^>]*>[\s\S]*?<\/ac:image>/g, '[이미지]')
      .replace(/<ri:[^>]*\/>/g, '')
      // 매크로 파라미터(width/layout 등 설정값)는 본문이 아니므로 제거 → "wide1800" 류 누수 방지
      .replace(/<ac:parameter[\s\S]*?<\/ac:parameter>/g, '')

    const markdown = td.turndown(cleanedHtml).trim()

    return Response.json({ title, text: markdown })
  } catch (err) {
    console.error('[confluence] fetch 오류:', err)
    return Response.json({ error: 'Confluence 페이지를 가져오지 못했습니다.' }, { status: 500 })
  }
}
