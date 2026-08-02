import Anthropic from '@anthropic-ai/sdk'
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt'
import { extractJson, validateAndNormalize } from '@/lib/analysis'
import type { AnalyzeEnvelope } from '@/lib/analysis'

export const maxDuration = 300

// 채점 기준의 원본은 src/lib/rubric.ts, 지시문 조립은 src/lib/prompt.ts.
// 이 파일은 실행·검증·응답만 담당한다.
//
// 2026-08 개편: 400줄짜리 SYSTEM_PROMPT 상수를 prompt.ts로 옮겼다.
// 기준이 코드 여러 곳에 흩어져 서로 어긋나는 것을 막기 위함이며,
// 총점·판정도 AI가 아니라 서버가 계산한다.

// 조립된 채점 지시문을 그대로 확인하는 통로 — 프롬프트 튜닝·검증용
// 확인: curl http://localhost:3000/api/analyze
//
// ?probe=model — 실제로 어떤 모델이 응답하는지 미리 확인하는 통로.
// 채점 한 번(2~3분)을 돌리기 전에 몇 초 만에 확인할 수 있다.
// 확인: curl 'http://localhost:3000/api/analyze?probe=model'
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  if (url.searchParams.get('probe') === 'model') {
    return Response.json(await probeModel())
  }
  return new Response(buildSystemPrompt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

// 실제 응답 모델 확인 — 채점과 같은 파라미터로 아주 짧게 한 번 호출한다.
//
// ⚠️ 왜 코드만 보고 판단하면 안 되는가: 코드의 기본값(claude-sonnet-5)보다
// 환경변수 ANTHROPIC_MODEL이 우선한다. 코드만 읽으면 sonnet-5로 보이지만
// 실제로는 환경변수의 모델이 돈다. 실측으로 이 사고가 확인됐다(변경 기록 21번).
// 그래서 '요청값'과 '응답값'을 함께 돌려준다.
async function probeModel(): Promise<{
  requested: string
  actual: string | null
  source: 'api' | 'cli'
  matched: boolean
  note?: string
}> {
  if (!hasAnthropicApiKey()) {
    return {
      requested: CLI_MODEL,
      actual: null,
      source: 'cli',
      matched: false,
      note: 'API 키가 없어 CLI 경로로 실행됩니다 — 응답에서 실제 모델을 확인할 수 없습니다',
    }
  }
  try {
    const anthropic = getAnthropicClient()
    // 채점과 같은 파라미터 조합을 쓴다 — 파라미터가 거부되는 경우도 함께 잡기 위함
    const res = (await anthropic.messages.create({
      model: ANALYZE_MODEL,
      max_tokens: 1024,
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: '1+1?' }],
    } as never)) as Anthropic.Messages.Message
    return {
      requested: ANALYZE_MODEL,
      actual: res.model,
      source: 'api',
      matched: typeof res.model === 'string' && res.model.startsWith(ANALYZE_MODEL),
    }
  } catch (error) {
    return {
      requested: ANALYZE_MODEL,
      actual: null,
      source: 'api',
      matched: false,
      note: `모델 확인 실패: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

function hasAnthropicApiKey(): boolean {
  const k = process.env.ANTHROPIC_API_KEY ?? process.env.anthropic_api_key
  return typeof k === 'string' && k.trim().length > 0 && k.startsWith('sk-ant-')
}

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.anthropic_api_key
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY(또는 anthropic_api_key) 환경변수가 설정되어 있지 않습니다')
  }
  return new Anthropic({ apiKey })
}

// Claude Code CLI를 직접 실행 (API 키 불필요, 로컬 인증 사용)
// next-server 프로세스가 launched 된 셸 환경에 따라 `claude` 가 PATH 에 없을 수
// 있다. 표준 후보 경로를 PATH 에 보강해 spawn 실패를 줄인다.
function resolveClaudePath(): { cmd: string; envPath: string } {
  const home = process.env.HOME ?? ''
  const extras = [
    `${home}/.local/bin`,
    `${home}/.bun/bin`,
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ].filter(Boolean)
  const currentPath = process.env.PATH ?? ''
  const segments = new Set(currentPath.split(':').filter(Boolean))
  for (const e of extras) segments.add(e)
  return { cmd: 'claude', envPath: Array.from(segments).join(':') }
}

// CLI 폴백 경로도 같은 모델을 쓴다 — 경로에 따라 채점 모델이 달라지면 안 된다
const CLI_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5'
const CLI_TIMEOUT_MS = 5 * 60 * 1000

// CLI 폴백 실행 — 격리를 적용한다.
//
// ⚠️ 격리가 필요한 이유: 격리 없이 실행하면 실행 위치 주변의 CLAUDE.md와
// 개인 전역 설정(~/.claude/CLAUDE.md)이 채점에 함께 읽힌다. 같은 PRD라도
// 사람·머신마다 점수가 달라진다. (실측 확인: 격리 없이 영어로 물으면 전역
// 설정의 "한국어로 답하라" 규칙이 작동하고, 격리하면 작동하지 않는다)
//
// - cwd            → 홈 밖 임시 폴더. 프로젝트·상위 폴더 CLAUDE.md 차단
// - --system-prompt → 기본 시스템 프롬프트를 대체. 전역 CLAUDE.md 주입 차단.
//                     부수 효과로 PRD 본문과 지시문이 섞이지 않게 분리된다
// - --model        → 시점·환경에 따라 다른 모델이 채점하는 것 방지
// - --strict-mcp-config → 외부 MCP 도구 차단
//
// 이 플래그 중 하나라도 빼면 격리가 조용히 깨진다. 특히 --system-prompt를
// "장식"으로 오해해 제거하지 말 것.
function runClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process')
    const os = require('os')
    const path = require('path')
    const fs = require('fs')
    const { cmd, envPath } = resolveClaudePath()

    const workDir = path.join(os.tmpdir(), 'preflight-claude-workdir')
    try {
      fs.mkdirSync(workDir, { recursive: true })
    } catch {
      /* 실패해도 tmpdir로 진행 */
    }

    const child = spawn(
      cmd,
      [
        '-p', userPrompt,
        '--system-prompt', systemPrompt,
        '--model', CLI_MODEL,
        '--strict-mcp-config',
      ],
      {
        shell: false,
        cwd: workDir,
        env: { ...process.env, PATH: envPath },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error(`분석 시간이 초과되었습니다 (${Math.round(CLI_TIMEOUT_MS / 1000)}초)`))
    }, CLI_TIMEOUT_MS)

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.on('close', (code: number | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code === 0) resolve(stdout.trim())
      else {
        // claude CLI 가 인증 실패시 stdout 으로 401 본문을 뱉으므로 같이 노출.
        const merged = (stderr.trim() || stdout.trim() || '(no output)').slice(0, 400)
        reject(new Error(`claude CLI 종료 코드 ${code}: ${merged}`))
      }
    })
    child.on('error', (err: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(`claude CLI 실행 실패: ${err.message}`))
    })
  })
}

// 채점에 쓰는 모델 — 하나로 고정한다.
//
// ⚠️ 폴백을 두지 않는 이유: 모델이 조용히 바뀌면 점수 차이가 문서 때문인지
// 모델 때문인지 구분할 수 없다. 이 도구의 목적이 "같은 문서를 여러 번 넣어도
// 판정이 흔들리지 않는가"를 재는 것이라, 조용한 대체는 측정을 무의미하게 만든다.
// 모델을 못 찾으면 폴백하지 말고 실패시켜 사람이 알게 한다.
const ANALYZE_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5'

function extractText(content: Anthropic.Messages.Message['content']): string {
  return content
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim()
}

// 고정 모델로 한 번 호출한다. 실패하면 다른 모델로 갈아타지 않고 그대로 던진다.
async function createMessage(
  anthropic: Anthropic,
  params: Omit<Anthropic.Messages.MessageCreateParams, 'model' | 'stream'> & { stream?: false },
): Promise<Anthropic.Messages.Message> {
  return (await anthropic.messages.create({
    ...params,
    model: ANALYZE_MODEL,
    stream: false,
  })) as Anthropic.Messages.Message
}

// 한 번 호출 — 실패는 예외로 던진다.
// 응답 원문과 함께 **실제로 응답한 모델**을 돌려준다(요청값이 아니라 응답값).
interface ClaudeCall {
  text: string
  model: string | null // CLI 경로는 응답에서 확인 불가라 null
}

async function callClaude(systemPrompt: string, userPrompt: string): Promise<ClaudeCall> {
  if (hasAnthropicApiKey()) {
    const anthropic = getAnthropicClient()
    const result = await createMessage(anthropic, {
      // Sonnet 5는 같은 글을 예전 모델보다 토큰으로 30%쯤 더 세므로 여유를 준다.
      // max_tokens는 요금이 아니라 상한선이다 — 실제 생성한 만큼만 과금되므로
      // 넉넉히 잡아도 비용이 늘지 않는다. 반대로 모자라면 응답이 잘려 채점이
      // 실패하고 재시도하게 되어 오히려 두 번 값을 낸다.
      max_tokens: 32000,
      // temperature는 지정하지 않는다 — Sonnet 5는 기본값이 아닌 값을 거부한다.
      // 일관성은 effort(생각 강도)로 잡는다.
      // ⚠️ Sonnet 5는 thinking을 안 쓰면 '켜짐'이 기본이다(예전 모델은 꺼짐).
      //    생각한 분량도 출력 토큰으로 과금되므로, 실측 후 low로 낮출지 판단한다.
      output_config: { effort: 'medium' },
      // 채점 지시문은 문서가 바뀌어도 글자 하나 안 바뀐다 → 캐싱해서 재사용한다.
      // 두 번째 호출부터 이 부분을 1/10 값으로 읽는다.
      // (효과 확인: 응답 usage의 cache_read_input_tokens가 0보다 큰지 본다)
      system: [
        { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    } as never)
    // 요청값(ANALYZE_MODEL)과 응답값(result.model)을 둘 다 남긴다 — 다르면 여기서 보인다
    console.log(
      `[analyze] 요청모델=${ANALYZE_MODEL} 응답모델=${result.model} ` +
      `stop_reason=${result.stop_reason} usage=${JSON.stringify(result.usage)}`
    )
    if (result.stop_reason === 'max_tokens') {
      throw new Error('분석 결과가 max_tokens에 도달해 잘렸습니다. 다시 시도해주세요.')
    }
    return { text: extractText(result.content), model: result.model ?? null }
  }
  const output = await runClaude(systemPrompt, userPrompt)
  console.log(`[analyze] CLI 요청모델=${CLI_MODEL} 응답 길이=${output.length} (응답에서 모델 확인 불가)`)
  return { text: output, model: null }
}

export async function POST(req: Request): Promise<Response> {
  const body: unknown = await req.json()

  // 입력값 유효성 검사
  if (
    typeof body !== 'object' ||
    body === null ||
    !('prdText' in body) ||
    typeof (body as Record<string, unknown>).prdText !== 'string'
  ) {
    return new Response('prdText is required', { status: 400 })
  }

  const { prdText } = body as { prdText: string }
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(prdText)

  // 파싱 실패 시 재시도는 서버에서 한다 — 클라이언트가 다시 요청하면 분석 비용이 2배
  const MAX_ATTEMPTS = 2
  const requestedModel = hasAnthropicApiKey() ? ANALYZE_MODEL : CLI_MODEL
  let lastRaw: string | null = null
  let lastReason = ''
  let lastModel: string | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let call: ClaudeCall
    try {
      call = await callClaude(systemPrompt, userPrompt)
    } catch (error) {
      console.error('[analyze] Claude 호출 오류:', error)
      const detail = error instanceof Error ? error.message : String(error)
      const envelope: AnalyzeEnvelope = {
        ok: false,
        raw: null,
        warnings: [],
        error: `분석 중 오류가 발생했습니다: ${detail}`,
        model: null,
        requested_model: requestedModel,
      }
      return Response.json(envelope, { status: 500 })
    }

    lastRaw = call.text
    lastModel = call.model
    const parsed = extractJson(call.text)
    const outcome =
      parsed === null
        ? ({ ok: false, reason: '응답에서 JSON을 찾지 못했습니다' } as const)
        : validateAndNormalize(parsed)

    if (outcome.ok) {
      // 실제 모델을 결과 안에도 심는다 — 저장·내보내기·기록에 따라다니게 하기 위함.
      // 봉투에만 두면 화면에 저장되는 순간 사라져 사후 확인이 안 된다.
      const analysis = { ...outcome.analysis, model: call.model, analyzed_at: new Date().toISOString() }
      const warnings = [...outcome.warnings]
      if (call.model === null) {
        warnings.push('실제 채점 모델을 확인하지 못했습니다 (CLI 경로) — 이 결과는 모델 비교에 쓰지 마세요')
      }
      const envelope: AnalyzeEnvelope = {
        ok: true,
        analysis,
        raw: call.text,
        warnings,
        model: call.model,
        requested_model: requestedModel,
      }
      return Response.json(envelope)
    }

    lastReason = outcome.reason
    console.error(`[analyze] 응답 검증 실패 (${attempt}/${MAX_ATTEMPTS}): ${outcome.reason}`)
  }

  // 재시도까지 실패 — 원문을 함께 돌려보내 결과 화면에서 폴백 표시
  const envelope: AnalyzeEnvelope = {
    ok: false,
    raw: lastRaw,
    warnings: [],
    error: `분석 결과를 읽지 못했습니다 (${lastReason}). 아래 원문을 확인해주세요.`,
    model: lastModel,
    requested_model: requestedModel,
  }
  return Response.json(envelope, { status: 200 })
}
