import {
  getAnthropicClient,
  generateScreen,
  Deadline,
  LOFI_SYSTEM,
  HIFI_SYSTEM,
  HIFI_DETAIL_SYSTEM,
  SCREEN_MAX_TOKENS,
  SCREEN_MAX_TOKENS_DETAIL,
  SCREEN_MAX_TOKENS_LOFI,
  type ScreenSpec,
  type DropReason,
} from '@/lib/mockup/core'

export const maxDuration = 300

// 화면당 예산. 함수 하나가 화면 하나만 맡으므로 300초 대부분을 쓸 수 있다.
const SCREEN_BUDGET_MS = Number(process.env.MOCKUP_SCREEN_BUDGET_MS) || 270_000

interface Body {
  screen?: ScreenSpec
  allScreens?: ScreenSpec[]
  type?: 'lowfi' | 'hifi'
  mode?: 'structure' | 'detail'
}

// 2단계: 화면 1개 코드 생성. 브라우저가 화면마다 동시에 호출한다.
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as Body
  const { screen, allScreens, type = 'lowfi', mode = 'structure' } = body
  if (!screen || typeof screen.id !== 'string' || !Array.isArray(allScreens)) {
    return Response.json({ error: 'screen과 allScreens가 필요합니다' }, { status: 400 })
  }
  const t0 = Date.now()
  const deadline = new Deadline(t0, SCREEN_BUDGET_MS)
  const dropReasons = new Map<string, DropReason>()
  const systemPrompt = type === 'hifi' ? (mode === 'detail' ? HIFI_DETAIL_SYSTEM : HIFI_SYSTEM) : LOFI_SYSTEM
  const maxTokens = type === 'hifi' ? (mode === 'detail' ? SCREEN_MAX_TOKENS_DETAIL : SCREEN_MAX_TOKENS) : SCREEN_MAX_TOKENS_LOFI

  try {
    const anthropic = getAnthropicClient()
    const code = await generateScreen(anthropic, screen, allScreens, type, systemPrompt, deadline, dropReasons, maxTokens)
    const reason = code ? null : (dropReasons.get(screen.id) ?? 'failed')
    console.log(`[mockup screen] ${screen.id} ${type}/${mode} ${code ? 'ok' : `dropped(${reason})`} in ${Math.round((Date.now() - t0) / 1000)}s`)
    return Response.json({ id: screen.id, code, reason })
  } catch (err) {
    console.error(`[mockup screen] ${screen.id} threw after ${Math.round((Date.now() - t0) / 1000)}s:`, err)
    return Response.json({ id: screen.id, code: null, reason: 'failed' })
  }
}
