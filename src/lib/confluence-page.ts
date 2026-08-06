// 확장자를 명시한다 — 이 파일은 node --test로도 그대로 로드되는데
// Node의 ESM 로더는 확장자 없는 상대 경로를 찾지 못한다.
import { hostOf, matchesSite, sessionSites, type AtlassianSite, type SessionData } from './atlassian-auth.ts'

export interface ConfluencePage {
  id: string
  title: string
  body?: { storage?: { value: string }; atlas_doc_format?: { value: string } }
  /** 단축 링크를 로컬 디코딩했을 때 그 결과가 맞는지 대조하는 데 쓴다 */
  _links?: { tinyui?: string; webui?: string; base?: string }
}

/**
 * 페이지를 어느 사이트에서 읽을지 정한 결과.
 * 사용자에게 보일 문구는 담지 않는다 — 라우트가 정한다.
 */
export type PageResolution =
  | { kind: 'ok'; page: ConfluencePage; site: AtlassianSite }
  /** 같은 페이지 번호가 여러 사이트에 있어 어느 문서인지 못 가림 */
  | { kind: 'ambiguous'; hosts: string[] }
  /** 후보 전부가 401 — 토큰 자체가 만료 */
  | { kind: 'expired' }
  /** 붙여넣은 위키가 연결된 계정의 사이트가 **확실히** 아님 */
  | { kind: 'site-mismatch'; connectedHosts: string[]; inputHost: string }
  /** 사이트는 맞는데 그 페이지를 못 읽음 (권한·삭제 등) */
  | { kind: 'forbidden' }
  /**
   * 권한 문제인지 사이트가 다른 것인지 **가릴 수 없음**.
   * 커스텀 도메인 위키에서 404만 돌아온 경우가 여기다.
   */
  | { kind: 'unresolved'; connectedHosts: string[]; inputHost: string }
  | { kind: 'api-error'; status: number }

interface SiteProbe {
  site: AtlassianSite
  status: number
  page?: ConfluencePage
}

/**
 * /wiki/spaces/<KEY>/pages/<id>/<제목> 형태에서 제목 부분을 뽑는다.
 * 여러 사이트에서 같은 페이지 번호로 200이 떴을 때 어느 쪽인지 가리는 데 쓴다.
 */
function extractTitleSlug(url: string): string | null {
  const m = url.match(/\/pages\/\d+\/([^/?#]+)/)
  if (!m) return null
  try {
    return decodeURIComponent(m[1].replace(/\+/g, ' '))
  } catch {
    return m[1].replace(/\+/g, ' ')
  }
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/[\s\-_+]+/g, '')
}

/**
 * accessible-resources가 돌려주는 정규 형태의 호스트인가.
 *
 * 이 형태의 호스트는 우리 사이트 목록과 **같은 표기법**이라 목록에 없으면
 * 정말 남의 사이트다. 반대로 커스텀 도메인은 표기법 자체가 달라서
 * 목록에 없는 게 정상이므로 같은 추론을 쓰면 안 된다.
 */
function isCanonicalAtlassianHost(host: string): boolean {
  return host === 'atlassian.net' || host.endsWith('.atlassian.net')
}

/**
 * 어느 사이트에서도 페이지를 못 읽었을 때 원인을 판정한다.
 * 네트워크와 분리된 순수 함수 — 분기 순서가 이 기능의 핵심이라 따로 뺐다.
 *
 * **분기 순서가 곧 정확도다.** 이전 버전은 "호스트가 안 맞으면 사이트 불일치"를
 * 권한 판정보다 먼저 뒀는데, 사내 위키는 커스텀 도메인이라 호스트가 **항상**
 * 안 맞는다. 그래서 올바른 계정으로 접속한 사람이 권한 없는 페이지를 넣으면
 * "계정이 다르니 다시 연결하라"는 엉뚱한 안내를 받았고, 권한 안내(forbidden)는
 * 커스텀 도메인 환경에서 영영 도달하지 못했다.
 *
 * 지금은 **확신할 수 있는 것부터** 판정하고, 못 가리는 경우는 단정하지 않는다.
 */
export function classifyFailure(input: {
  probeStatuses: number[]
  /** 입력 호스트가 우리 사이트 중 하나와 정확히 일치했는가 */
  hostMatched: boolean
  inputHost: string | null
  connectedHosts: string[]
}): Exclude<PageResolution, { kind: 'ok' } | { kind: 'ambiguous' }> {
  const { probeStatuses, hostMatched, inputHost, connectedHosts } = input

  // ① 전부 401 — 토큰 자체가 죽었다. 사이트 이야기를 꺼낼 필요가 없다.
  if (probeStatuses.length > 0 && probeStatuses.every((s) => s === 401)) {
    return { kind: 'expired' }
  }

  // ② 접근 계열(401·403·404)이 아닌 응답이 있으면 진단할 사안이 아니라
  //    Confluence 쪽 오류다. 500을 권한 문제로 안내하면 안 된다.
  const accessOnly =
    probeStatuses.length > 0 && probeStatuses.every((s) => s === 401 || s === 403 || s === 404)
  if (!accessOnly) {
    return { kind: 'api-error', status: probeStatuses.find((s) => s >= 400) ?? 502 }
  }

  // ③ 호스트가 우리 사이트와 일치했다면 사이트는 맞다. 남은 건 권한·삭제.
  if (hostMatched) return { kind: 'forbidden' }

  // ④ 입력이 *.atlassian.net인데 우리 목록에 없다 — 표기법이 같은데 없으므로
  //    확실히 남의 사이트다. 여기서만 "계정이 다르다"고 단정한다.
  if (inputHost && isCanonicalAtlassianHost(inputHost) && connectedHosts.length > 0) {
    return { kind: 'site-mismatch', connectedHosts, inputHost }
  }

  // ⑤ 사이트가 토큰은 받아들이고 그 페이지만 거부했다(403) — 권한 쪽에 가깝다.
  if (probeStatuses.includes(403)) return { kind: 'forbidden' }

  // ⑥ 커스텀 도메인 + 404만 — 권한이 없는 건지 남의 위키인지 **가릴 수 없다.**
  //    한쪽으로 단정하면 둘 중 하나는 반드시 오진이므로 둘 다 안내한다.
  if (inputHost && connectedHosts.length > 0) {
    return { kind: 'unresolved', connectedHosts, inputHost }
  }

  return { kind: 'forbidden' }
}

async function fetchPageFromSite(
  site: AtlassianSite,
  pageId: string,
  accessToken: string
): Promise<SiteProbe> {
  const apiUrl = `https://api.atlassian.com/ex/confluence/${site.id}/wiki/api/v2/pages/${pageId}?body-format=storage`
  try {
    const res = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (!res.ok) {
      const errBody = await res.text()
      console.error(`[confluence] ${site.url} → ${res.status}: ${errBody.slice(0, 200)}`)
      return { site, status: res.status }
    }
    return { site, status: res.status, page: (await res.json()) as ConfluencePage }
  } catch (err) {
    console.error(`[confluence] ${site.url} 요청 실패:`, err)
    return { site, status: 0 }
  }
}

/**
 * 붙여넣은 URL이 어느 사이트의 것인지 정한 뒤 그 사이트에서 페이지를 읽어온다.
 *
 * 예전에는 세션에 박아둔 cloudId 하나로만 조회해서, 계정이 여러 사이트에
 * 붙어 있으면 엉뚱한 사이트에 물어보고 404를 받았다. 화면에는 "권한이
 * 있는지 확인하세요"로만 보여서 없는 권한 문제를 쫓게 된다.
 *
 * 호스트가 맞는 사이트가 있으면 거기만 본다. 사내 위키는 커스텀 도메인을
 * 쓰는 Atlassian Cloud라(wiki.team.musinsa.com) accessible-resources가
 * *.atlassian.net 형태를 돌려줄 수 있어 문자열 비교로는 못 맞춘다.
 * 그때는 후보 전체를 실제로 찔러 보고 200이 뜬 곳을 고른다.
 *
 * 페이지 번호는 사이트마다 따로 매겨져서 두 사이트가 같은 번호를 가질 수
 * 있다. 그래서 200이 두 곳 이상이면 임의로 고르지 않고 제목으로 가리고,
 * 그래도 못 가리면 중단한다 — 엉뚱한 문서를 채점하는 것보다 낫다.
 */
export async function resolveConfluencePage(
  inputUrl: string,
  pageId: string,
  session: SessionData
): Promise<PageResolution> {
  const candidates = sessionSites(session)
  const inputHost = hostOf(inputUrl)

  // 호스트 비교는 atlassian-auth의 matchesSite 한 곳에만 둔다.
  // 같은 판단을 쓰는 곳(예: 토큰을 보내도 되는 호스트인지 검사)이
  // 생기면 각자 구현하지 말고 이 헬퍼를 함께 쓴다.
  const exact = candidates.filter((s) => matchesSite(inputUrl, s))
  const probeList = exact.length > 0 ? exact : candidates

  const probes = await Promise.all(
    probeList.map((s) => fetchPageFromSite(s, pageId, session.accessToken))
  )
  const hits = probes.filter((p): p is SiteProbe & { page: ConfluencePage } => !!p.page)

  if (hits.length === 1) return { kind: 'ok', page: hits[0].page, site: hits[0].site }

  if (hits.length > 1) {
    const slug = extractTitleSlug(inputUrl)
    const byTitle = slug
      ? hits.filter((h) => normalizeTitle(h.page.title ?? '') === normalizeTitle(slug))
      : []
    if (byTitle.length === 1) {
      return { kind: 'ok', page: byTitle[0].page, site: byTitle[0].site }
    }
    console.error(
      `[confluence] 페이지 ${pageId}가 사이트 ${hits.length}곳에서 발견됨: ${hits
        .map((h) => h.site.url)
        .join(', ')} — 어느 쪽인지 가리지 못해 중단`
    )
    return { kind: 'ambiguous', hosts: hits.map((h) => hostOf(h.site.url) ?? h.site.url) }
  }

  return classifyFailure({
    probeStatuses: probes.map((p) => p.status),
    hostMatched: exact.length > 0,
    inputHost,
    connectedHosts: candidates.map((s) => hostOf(s.url) ?? s.url).filter(Boolean),
  })
}
