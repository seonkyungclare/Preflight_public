import {
  getAnthropicClient,
  extractSpec,
  foldSectionScreens,
  MAX_SCREENS,
  type MockupSpec,
  type ScreenSpec,
} from '@/lib/mockup/core'

export const maxDuration = 300

// 1단계: PRD → 화면 구조(spec). 브라우저가 이 결과를 들고 화면별 생성 요청을 보낸다.
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as { prdText?: unknown; analysisText?: unknown }
  if (typeof body.prdText !== 'string' || typeof body.analysisText !== 'string') {
    return Response.json({ error: 'prdText와 analysisText가 필요합니다' }, { status: 400 })
  }
  const t0 = Date.now()
  try {
    const anthropic = getAnthropicClient()
    let spec: MockupSpec = await extractSpec(anthropic, body.prdText, body.analysisText, 250_000)

    // 화면 수 상한: 메뉴 화면 우선. 초과분은 NotePanel '미구현'으로 노출
    let dropped: ScreenSpec[] = []
    if (spec.screens.length > MAX_SCREENS) {
      const menuIds = new Set(spec.menu_screen_ids)
      const ordered = [...spec.screens.filter(s => menuIds.has(s.id)), ...spec.screens.filter(s => !menuIds.has(s.id))]
      dropped = ordered.slice(MAX_SCREENS)
      spec.screens = ordered.slice(0, MAX_SCREENS)
      spec.note_items = [
        ...(spec.note_items ?? []),
        ...dropped.map(s => ({ category: 'omitted' as const, item: s.name, reason: `화면 수 상한(${MAX_SCREENS}개)으로 이번 목업에서 제외됨. 디자이너 별도 구현 필요` })),
      ]
    }
    if (spec.screens.length === 0) {
      return Response.json({ error: 'PRD에서 화면을 추출하지 못했습니다.' }, { status: 422 })
    }
    spec = foldSectionScreens(spec)
    console.log(`[mockup spec] ${spec.screens.length} screens (${spec.menu_screen_ids.length} in menu, ${dropped.length} capped) in ${Math.round((Date.now() - t0) / 1000)}s`)
    return Response.json({ spec, capped: dropped.map(s => s.name) })
  } catch (err) {
    console.error(`[mockup spec] failed after ${Math.round((Date.now() - t0) / 1000)}s:`, err)
    const msg = err instanceof Error && err.message.includes('ANTHROPIC_API_KEY') ? 'API 키가 필요합니다.' : 'PRD 구조 추출에 실패했습니다. 다시 시도해주세요.'
    return Response.json({ error: msg }, { status: 500 })
  }
}
