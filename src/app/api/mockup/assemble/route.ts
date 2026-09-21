import { MCDS_CSS } from '@/lib/mcds-css'
import { assembleHifiApp, assembleLofiApp, validateJsx, type MockupSpec } from '@/lib/mockup/core'

export const maxDuration = 60

interface Body {
  spec?: MockupSpec
  codes?: Record<string, string>
  type?: 'lowfi' | 'hifi'
  dropped?: Array<{ id: string; name: string; reason: string }>
}

// 3단계: 화면 코드들을 App.js 로 조립하고 구문을 검증한다. LLM 호출 없음.
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as Body
  const { spec, codes, type = 'lowfi', dropped = [] } = body
  if (!spec || !Array.isArray(spec.screens) || !codes || typeof codes !== 'object') {
    return Response.json({ error: 'spec과 codes가 필요합니다' }, { status: 400 })
  }
  const screenCodes = new Map(Object.entries(codes).filter(([, v]) => typeof v === 'string' && v.trim()))
  if (screenCodes.size === 0) {
    return Response.json({ error: '화면 생성에 모두 실패했습니다. 다시 시도해주세요.' }, { status: 422 })
  }

  const reasonText: Record<string, string> = {
    timeout: '생성 시간 제한으로 이번 목업에서 제외됨. 재생성 시 다시 시도',
    skipped_budget: '생성 시간 제한으로 이번 목업에서 제외됨. 재생성 시 다시 시도',
    failed: '코드 생성 실패로 이번 목업에서 제외됨. 재생성 시 다시 시도',
  }
  const finalSpec: MockupSpec = {
    ...spec,
    note_items: [
      ...(spec.note_items ?? []),
      ...dropped.map(d => ({ category: 'omitted' as const, item: d.name, reason: reasonText[d.reason] ?? reasonText.failed })),
    ],
  }

  const appCode = type === 'hifi' ? assembleHifiApp(screenCodes, finalSpec) : assembleLofiApp(screenCodes, finalSpec)
  const err = validateJsx(appCode)
  if (err) {
    console.error('[mockup assemble] validation error:', err.message, `line ${err.line}`)
    return Response.json({ error: '목업 조립 후 구문 오류가 발생했습니다. 다시 시도해주세요.', detail: err.message }, { status: 500 })
  }
  const files: Record<string, string> = type === 'hifi' ? { '/App.js': appCode, '/mcds.css': MCDS_CSS } : { '/App.js': appCode }
  console.log(`[mockup assemble] ${type} screens=${screenCodes.size}/${spec.screens.length} dropped=${dropped.length}`)
  return Response.json({ files, spec: finalSpec })
}
