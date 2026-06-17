import { cookies } from 'next/headers'
import TurndownService from 'turndown'
import { ATLASSIAN_COOKIE, decodeSession } from '@/lib/atlassian-auth'

interface PageResponse {
  id: string
  title: string
  body?: { storage?: { value: string }; atlas_doc_format?: { value: string } }
}

function extractPageId(url: string): string | null {
  const m = url.match(/\/pages\/(\d+)/)
  return m ? m[1] : null
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

  const pageId = extractPageId(url)
  if (!pageId) {
    return Response.json(
      { error: '페이지 ID를 찾지 못했습니다. URL에 /pages/<숫자>/ 형태가 포함되어야 합니다.' },
      { status: 400 }
    )
  }

  const token = cookies().get(ATLASSIAN_COOKIE)?.value
  const session = token ? decodeSession(token) : null
  if (!session || !session.cloudId) {
    return Response.json(
      { error: 'Atlassian 연결이 필요합니다. "Atlassian 연결" 버튼을 먼저 클릭해주세요.' },
      { status: 401 }
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
