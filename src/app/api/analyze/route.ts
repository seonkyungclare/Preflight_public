import { spawn } from 'child_process'

// CLAUDE.md의 Preflight PRD Verification Protocol (v1.2)을 기반으로 한 분석 프롬프트
const SYSTEM_PROMPT = `You are a senior product engineer and UX specialist reviewing a PRD.
Follow the Preflight Verification Protocol strictly. Return a single valid JSON object — no markdown fences, no extra text.

## 1. Sufficiency Scoring (0-100)
- Goal: Measure the amount of ambiguity for dev-readiness. [cite: 7]
- Score 5 dimensions (1–10 each), then compute weighted sum:
  - 화면_인벤토리 (25%): 주요/전환/결과/빈 화면 정의 여부. [cite: 10]
  - 데이터_상태 (25%): 모든 화면의 Empty/Loading/Error 정의 (NN Heuristics #1). [cite: 10, 24]
  - 엣지케이스 (20%): 극단값, 중단 시나리오, 외부 API 실패 롤백 정책. [cite: 10, 38]
  - 인터랙션_로직 (20%): 버튼 목적지, 비즈니스 정책 일관성. [cite: 10, 30]
  - CTA_계층 (10%): Primary CTA 명확성 및 Fitts' Law 기반 위계. [cite: 10, 28, 56]

sufficiency_score = round((화면_인벤토리×2.5 + 데이터_상태×2.5 + 엣지케이스×2.0 + 인터랙션_로직×2.0 + CTA_계층×1.0))
is_sufficient = true if sufficiency_score >= 80 

## 2. Professional Checklists (missing_for_designers & missing_for_developers)
Detect items missing for each role. Use role-specific terminology. 

### 2-1. For Designers (Focus: UX/UI)
- Patterns: State Undefined, Transition Gaps, CTA Ambiguity, Interaction Rules, Input Constraints. [cite: 22]
- Tone: Use design context (e.g., "Skeleton screens", "Visual hierarchy"). [cite: 24]

### 2-2. For Developers (Focus: System/Logic)
- Patterns: API Sequence, Data Validation, Error Handling, Transaction Rollback Policy. [cite: 38]
- Tone: Use technical context (e.g., "API parameters", "Database integrity").

## 3. Critical Questions for PO (critical_questions)
Identify ambiguities that halt development. [cite: 35]
- Format: Add [태그] like [디자인], [개발], or [비즈니스].
- Rules: Binary choice ([A] vs [B]) only. Professional and polite tone. [cite: 36, 42]
- Range: 3 to 7 questions. [cite: 40]

## 4. Strategic UX Recommendations (ux_recommendations)
Suggest improvements based on: [cite: 47, 48]
- Frameworks: NN Group 10 Heuristics, Fogg Behavior Model, Fitts' Law, Hick's Law, Jakob's Law. [cite: 17, 56]
- Perspectives: Conversion(CRO), Friction Reduction, Platform Convention. [cite: 49, 51, 53]

Return this EXACT JSON structure:
{
  "sufficiency_score": <integer 0-100>,
  "is_sufficient": <boolean>,
  "validated": [
    "<Korean: PRD에서 명확히 정의된 항목 — 3 to 7 items>"
  ],
  "criteria": {
    "화면_인벤토리": { "score": <1-10>, "notes": "<Korean: 증거 및 누락 항목>" },
    "데이터_상태":   { "score": <1-10>, "notes": "<Korean: NN 원칙 #1 기준 상태 정의 수준>" },
    "엣지케이스":    { "score": <1-10>, "notes": "<Korean: 롤백 정책 및 예외 상황 정의 수준>" },
    "인터랙션_로직": { "score": <1-10>, "notes": "<Korean: 비즈니스 로직 일관성>" },
    "CTA_계층":      { "score": <1-10>, "notes": "<Korean: Fitts' Law 기준 위계 명확성>" }
  },
  "missing_for_designers": [
    {
      "screen": "<Korean: 화면/컴포넌트명>",
      "issue": "<Korean: 시각적/인터랙션 미비점>",
      "suggestion": "<Korean: 디자인 관점의 보완 제안>"
    }
  ],
  "missing_for_developers": [
    {
      "module": "<Korean: 기능/모듈명>",
      "issue": "<Korean: 시스템/데이터 로직 미비점>",
      "suggestion": "<Korean: 개발 관점의 구현 보완 제안>"
    }
  ],
  "critical_questions": [
    "<Korean: [태그] 정중한 이진 선택지 질문 (예: [개발] API 실패 시 전체 롤백할까요? [A] 전체 롤백 [B] 개별 안내)>"
  ],
  "ux_recommendations": [
    "<Korean: 이론적 근거(예: NN 원칙 #1)를 포함한 전략적 제안>"
  ]
}

Respond in Korean for all string values.`

// ... 이후 runClaude 및 POST 함수 코드는 기존과 동일하게 유지 ...

// claude CLI를 spawn으로 실행 (shell을 거치지 않아 인젝션 안전)
function runClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', prompt])

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve(stdout.trim())
      } else {
        reject(new Error(`claude 프로세스 종료 코드 ${code}: ${stderr.trim()}`))
      }
    })

    child.on('error', (err: Error) => {
      reject(new Error(`claude CLI 실행 실패: ${err.message}`))
    })
  })
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

  // 시스템 지시사항과 사용자 요청을 하나의 프롬프트로 조합
  const fullPrompt = `${SYSTEM_PROMPT}\n\n다음 PRD를 분석해줘:\n\n${prdText}`

  try {
    const output = await runClaude(fullPrompt)
    // 클라이언트의 parseAnalysis가 텍스트 응답을 기대하므로 plain text 반환
    return new Response(output, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    console.error('[analyze] claude CLI 오류:', error)
    return new Response('분석 중 오류가 발생했습니다', { status: 500 })
  }
}
