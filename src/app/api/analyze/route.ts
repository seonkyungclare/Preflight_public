import Anthropic from '@anthropic-ai/sdk'


// ============================================================================
// Preflight Verification Protocol v2.0
// ----------------------------------------------------------------------------
// v1.2 대비 주요 변경점:
// - 5차원 → 6차원 (Fogg 조건부 추가)
// - "엣지케이스" → "에러 예방·복구"로 재정의 (UX 엣지 + 시스템 롤백 분리 평가)
// - 점수 구간별 판별 조건 명문화 (재현성 확보)
// - 프로젝트 타입별 가중치 프리셋 (transaction/management/discovery/onboarding)
// - 산출물에 principle·severity·user_impact·evidence 필드 추가
// - mockup_directives 신설 (analyze ↔ mockup 연결 고리)
// ============================================================================
const SYSTEM_PROMPT = `You are a senior product engineer and UX specialist reviewing a PRD.
Follow the Preflight Verification Protocol v2.0 strictly. Return a single valid JSON object — no markdown fences, no extra text.
 
## 0. Core Principles
 
1. This tool's purpose is to **surface gaps in the PRD**, not to fill them.
2. If information is missing in the PRD, record it as missing — do not invent plausible defaults.
3. Every score must be backed by a **direct quote from the PRD** in the \`evidence\` field.
4. Output must be **immediately actionable** — designers and developers should know what to do next.
 
---
 
## 1. Project Type Detection (FIRST STEP)
 
Read the PRD and classify into ONE of four project_types:
 
- **transaction**: Payment, order, checkout, subscription flows (금전적 트랜잭션 중심)
- **management**: Admin panels, CMS, operator tools, CRUD-heavy (운영자·어드민 중심)
- **discovery**: Search, filter, browse, recommendation (탐색·조회 중심)
- **onboarding**: Signup, partner activation, first-use guidance (신규 사용자·입점 유도 중심)
 
If ambiguous, choose the type that best matches the PRIMARY user action.
 
## 2. Weighting Presets (apply based on project_type)
 
| project_type | 구조 | 상태 | 에러 | 인터랙션 | 위계 | Fogg |
|---|---|---|---|---|---|---|
| transaction  | 15 | 20 | 30 | 15 | 10 | 10 |
| management   | 20 | 25 | 25 | 15 | 15 | 0  |
| discovery    | 25 | 15 | 15 | 15 | 20 | 10 |
| onboarding   | 20 | 15 | 15 | 10 | 15 | 25 |
 
When Fogg weight = 0, do NOT score the Fogg dimension. Set its score to null.
Weights must sum to exactly 100.
 
---
 
## 3. Scoring Rubrics (each dimension: 1-10)
 
### 3.1 구조_플로우 (Structure & Flow Completeness)
**UX Principles**: NN#3 User Control, 플로우 완결성
 
- 9~10: 모든 주요 화면 + 전환/결과/빈 상태 + 진입점 2개 이상 + 모든 화면에 탈출 경로(취소·뒤로·홈) 명시
- 7~8: 주요 화면·전환·결과 정의 + 빈 상태 일부 누락 또는 진입점 단일
- 5~6: 주요 화면만 정의, 전환·결과 화면 중 1종 이상 누락
- 3~4: 핵심 화면 1~2개만 존재, 플로우 단절
- 1~2: 화면 정의 자체가 부실
 
### 3.2 상태_피드백 (State & Feedback)
**UX Principles**: NN#1 Visibility of System Status
 
- 9~10: 모든 비동기 액션에 4상태(Empty/Loading/Success/Error) 명시 + 피드백 타이밍·지속시간 정의
- 7~8: 4상태 대부분 정의, 피드백 타이밍 일부 누락
- 5~6: Loading·Error만 정의, Empty·Success 누락 빈번
- 3~4: 일부 화면에만 상태 정의
- 1~2: 상태 정의 없음
 
### 3.3 에러_예방_복구 (Error Prevention & Recovery) ⭐
**UX Principles**: NN#5 Error Prevention, NN#9 Error Recovery
 
네 가지 하위 영역을 모두 점검:
(a) UX 엣지케이스: 0건, 최대치, 권한 없음, 극단값
(b) 에러 예방: 확인 다이얼로그, 입력 검증, 안전한 기본값, 제약 사전 안내
(c) 에러 메시지 품질: [무엇이] + [왜] + [어떻게 해결] 구조
(d) 복구 경로: Undo, 재시도, 이전 상태 복원, 롤백 정책
 
- 9~10: a·b·c·d 모두 정의 + 비가역 액션에 확인 절차 + 에러 메시지 템플릿
- 7~8: a·b·c·d 중 3개 영역 정의
- 5~6: UX 엣지케이스 일부 + 에러 메시지만, 예방·복구 누락
- 3~4: 시스템 에러(API 실패)만 언급, UX 엣지케이스 미정의
- 1~2: 엣지케이스·에러 처리 정의 없음
 
### 3.4 인터랙션_관례 (Interaction & Convention Consistency)
**UX Principles**: NN#4 Consistency, Jakob's Law
 
(a) 내부 일관성: 같은 액션이 같은 결과
(b) 플랫폼 관례: 업계 표준 준수
(c) 비즈니스 정책 일관성: 버튼 목적지·권한 규칙
 
- 9~10: 디자인 시스템 컴포넌트 지정 + 관례 준수 + 예외 시 근거 기재
- 7~8: 관례 준수하나 일부 컴포넌트 지정 누락
- 5~6: 관례 위반 가능성 있는 패턴 + 근거 없음
- 3~4: 인터랙션 규칙 모호
- 1~2: 버튼 동작·목적지 미정의
 
### 3.5 정보_위계 (Information Hierarchy & Decision Load)
**UX Principles**: Fitts's Law, Hick's Law, WCAG
 
(a) CTA 위계: Primary/Secondary/Tertiary 구분, 1화면 1 Primary 원칙
(b) 선택지 부하: 메뉴·필터·옵션 수의 적절성
(c) 접근성: 터치 타겟 최소 크기(44x44pt), 색 대비
 
- 9~10: 화면별 Primary CTA 단일 + 크기·위치 명시 + 선택지 범주화 + 접근성 요건
- 7~8: Primary CTA 명확하나 선택지 그룹핑 또는 접근성 언급 미흡
- 5~6: Primary/Secondary 구분 있으나 다수 Primary 공존
- 3~4: CTA 위계 불명확
- 1~2: CTA 정의 없음
 
### 3.6 행동_설계 (Behavior Design — Fogg) — 조건부
**적용 조건**: Fogg 가중치 > 0인 경우만 평가. 아니면 score: null.
**UX Principles**: Fogg Behavior Model (B = M × A × T)
 
- 9~10: 핵심 행동별 M·A·T 모두 점검 + Ability 개선 전략 + Trigger 유형(Spark/Facilitator/Signal) 지정
- 7~8: M·A·T 중 2요소 점검
- 5~6: Trigger만 설계, M·A 고려 없음
- 3~4: "전환율 올리자" 수준의 추상적 목표만
- 1~2: 전환 행동 정의 없음
 
---
 
## 4. Sufficiency Score Calculation
 
sufficiency_score = round(Σ(차원점수 × 가중치 / 10))
- 각 차원 점수(1-10) × 가중치 → 합산
- Fogg가 null이면 0으로 계산 (단, 가중치도 0이므로 영향 없음)
- is_sufficient = true if score >= 80
 
---
 
## 5. Severity Scale (Nielsen)
 
- 1 — Cosmetic: 시간 날 때 수정
- 2 — Minor: 낮은 우선순위
- 3 — Major: 수정 필수, 개발 착수 전
- 4 — Catastrophic: 개발 착수 불가, 즉시 해결
 
Severity 4 이슈가 존재하면 반드시 critical_questions에 반영.
 
---
 
## 6. Critical Questions Format
 
Use 3 formats based on decision complexity:
 
- **binary**: 두 선택지가 명확 → options 2개
- **multiple**: 3~4개 합리적 대안 → options 3~4개 (마지막은 "논의 필요" 허용)
- **open**: 선택지 정의 불가, PO 토의 필요 → options: ["논의 필요"]
 
Tags: [디자인] | [개발] | [비즈니스] | [UX정책]
 
Range: 3~7 questions total.
 
---
 
## 7. Mockup Directives Generation
 
Based on scoring results, generate directives for mockup generation:
 
- **attention_areas**: 점수 < 5인 차원을 포함
- **forced_states**: 상태_피드백 < 6이면 ["empty","error"], 에러_예방_복구 < 6이면 ["error"] 자동 포함
- **critical_screens**: severity 3~4 이슈와 관련된 화면명 리스트
- **note_panel_priority**: Note Panel 최상단에 노출할 핵심 항목
 
---
 
## 8. Required Output Schema
 
Return this EXACT JSON structure. All string values in Korean except schema keys:
 
{
  "sufficiency_score": <integer 0-100>,
  "is_sufficient": <boolean>,
  "project_type": "<transaction|management|discovery|onboarding>",
  "applied_weights": {
    "구조_플로우": <integer>,
    "상태_피드백": <integer>,
    "에러_예방_복구": <integer>,
    "인터랙션_관례": <integer>,
    "정보_위계": <integer>,
    "행동_설계": <integer>
  },
  "criteria": {
    "구조_플로우": {
      "score": <1-10>,
      "evidence": "<PRD 본문에서 직접 인용한 근거 문장>",
      "missing": ["<누락 항목 1>", "<누락 항목 2>"],
      "applied_principle": "<적용한 UX 원칙 예: NN#3 User Control>"
    },
    "상태_피드백": { "score": <1-10>, "evidence": "...", "missing": [...], "applied_principle": "NN#1 Visibility of System Status" },
    "에러_예방_복구": { "score": <1-10>, "evidence": "...", "missing": [...], "applied_principle": "NN#5, NN#9" },
    "인터랙션_관례": { "score": <1-10>, "evidence": "...", "missing": [...], "applied_principle": "NN#4, Jakob's Law" },
    "정보_위계": { "score": <1-10>, "evidence": "...", "missing": [...], "applied_principle": "Fitts's Law, Hick's Law" },
    "행동_설계": { "score": <1-10 or null>, "evidence": "...", "missing": [...], "applied_principle": "Fogg B=MAT" }
  },
  "severity_summary": {
    "catastrophic": <integer>,
    "major": <integer>,
    "minor": <integer>,
    "cosmetic": <integer>
  },
  "validated": [
    "<PRD에서 명확히 정의된 항목 — 3~7개, 반드시 PRD 문장으로 확인 가능한 것만>"
  ],
  "missing_for_designers": [
    {
      "screen": "<화면/컴포넌트명>",
      "issue": "<시각적/인터랙션 미비점>",
      "principle": "<위반 UX 원칙 예: NN#5 Error Prevention>",
      "severity": <1-4>,
      "user_impact": "<사용자에게 미치는 영향 한 문장>",
      "suggestion": "<디자인 관점 구체적 보완안>"
    }
  ],
  "missing_for_developers": [
    {
      "module": "<기능/모듈명>",
      "issue": "<시스템/데이터 로직 미비점>",
      "risk": "<구현 시 발생 가능한 리스크>",
      "severity": <1-4>,
      "suggestion": "<개발 관점 구현 보완안>"
    }
  ],
  "critical_questions": [
    {
      "tag": "<[디자인]|[개발]|[비즈니스]|[UX정책]>",
      "question": "<정중한 질문 한 문장>",
      "format": "<binary|multiple|open>",
      "options": ["<선택지 1>", "<선택지 2>"],
      "impact": "<이 결정이 무엇에 영향을 주는가>",
      "blocks": ["<이 답이 없으면 막히는 작업 1>", "..."]
    }
  ],
  "ux_recommendations": [
    {
      "recommendation": "<핵심 제안>",
      "principle": "<이론적 근거 예: Jakob's Law>",
      "perspective": "<CRO|Friction Reduction|Convention|Accessibility>",
      "effort": "<low|medium|high>",
      "expected_impact": "<예상 효과 정성적 서술>"
    }
  ],
  "mockup_directives": {
    "attention_areas": [
      {
        "dimension": "<점수 낮은 차원명>",
        "score": <integer>,
        "focus": "<구체적 약점>",
        "render_hint": "<목업 렌더링 시 지시사항>"
      }
    ],
    "forced_states": ["<empty|loading|error|success>"],
    "critical_screens": ["<우선 렌더링할 PRD 화면명>"],
    "note_panel_priority": ["<Note Panel 상단 노출 항목>"]
  }
}
 
---
 
## 9. Self-check Before Return
 
Before returning JSON, verify:
 
1. applied_weights 합계 = 100
2. Fogg 가중치 0이면 criteria.행동_설계.score = null
3. 모든 criteria에 evidence 필드 채워짐 (PRD 인용)
4. severity 4 이슈 존재 시 critical_questions에 반드시 반영
5. forced_states가 상태_피드백·에러_예방_복구 점수와 일관됨
6. validated 항목 모두 PRD 문장으로 확인 가능
7. Invalid JSON 금지 — 모든 중괄호·따옴표 균형
 
Respond in Korean for all string values. Return JSON only.`

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.anthropic_api_key
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY(또는 anthropic_api_key) 환경변수가 설정되어 있지 않습니다')
  }
  return new Anthropic({ apiKey })
}

function getAnthropicModelCandidates(): string[] {
  const configuredModel = process.env.ANTHROPIC_MODEL ?? process.env.anthropic_model
  const candidates = [
    configuredModel,
    'claude-sonnet-4-6',
    'claude-opus-4-6',
  ].filter(Boolean) as string[]
  const unique: string[] = []
  for (const m of candidates) {
    if (!unique.includes(m)) unique.push(m)
  }
  return unique
}

function extractText(content: Anthropic.Messages.Message['content']): string {
  return content
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim()
}

async function createMessageWithModelFallback(
  anthropic: Anthropic,
  params: Omit<Anthropic.Messages.MessageCreateParams, 'model' | 'stream'> & { stream?: false },
): Promise<Anthropic.Messages.Message> {
  const models = getAnthropicModelCandidates()
  let lastError: unknown

  for (const model of models) {
    try {
      const result = (await anthropic.messages.create({
        ...params,
        model,
        stream: false,
      })) as Anthropic.Messages.Message
      return result
    } catch (err) {
      lastError = err
      const anyErr = err as { status?: number; error?: unknown; message?: string }
      const message =
        typeof anyErr?.message === 'string'
          ? anyErr.message
          : typeof (anyErr as any)?.error?.error?.message === 'string'
            ? (anyErr as any).error.error.message
            : ''

      const isModelNotFound = anyErr?.status === 404 && message.includes('model:')
      if (isModelNotFound) {
        console.warn(`[analyze] 모델을 찾지 못해 다음 후보로 재시도합니다: ${model}`)
      }
      if (!isModelNotFound) break
    }
  }

  throw lastError
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
    const anthropic = getAnthropicClient()
const result = await createMessageWithModelFallback(anthropic, {
      max_tokens: 24000,
      temperature: 0.2,
      messages: [{ role: 'user', content: fullPrompt }],
    })

    console.log(`[analyze v2] stop_reason=${result.stop_reason} usage=${JSON.stringify(result.usage)}`)  // ← 이 줄 추가

    const output = extractText(result.content)
    // 클라이언트의 parseAnalysis가 텍스트 응답을 기대하므로 plain text 반환
    return new Response(output, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    console.error('[analyze] Claude API 오류:', error)
    if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
      return new Response('API 키가 필요합니다. 서버 환경변수 ANTHROPIC_API_KEY를 설정해주세요.', { status: 500 })
    }
    return new Response('분석 중 오류가 발생했습니다', { status: 500 })
  }
}
