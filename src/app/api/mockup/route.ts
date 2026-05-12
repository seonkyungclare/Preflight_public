import Anthropic from '@anthropic-ai/sdk'

// ============================================================================
// SHARED: PRD Fidelity Principle
// ============================================================================
const PRD_FIDELITY_PRINCIPLE = `
## PRD Fidelity Principle (HIGHEST PRIORITY — read before anything else)
 
The purpose of this mockup is to surface gaps in the PRD by rendering
ONLY what the PRD explicitly states. Adding plausible-but-unstated elements
defeats the entire purpose.
 
### The Two Rules (non-negotiable, with one controlled exception)
1. **No Omission** — every screen, field, action, and state explicitly stated
   in the PRD MUST appear in the output.
2. **No Invention** — nothing that is not explicitly stated in the PRD may
   appear in the output, regardless of how conventional or helpful it seems.
 
**Exception**: items explicitly listed in \`analysis.mockup_directives\` are
NOT inventions — they are analyst-flagged additions with required badge
labeling. See "Analysis-Driven Attention" section below.
 
### Decision Procedure for Every UI Element
Before rendering any element, ask in order:
  Q1: "Is this literally written in the PRD?"
    YES → include it, using the exact wording/label from the PRD
    NO  → go to Q2
  Q2: "Is this explicitly required by analysis.mockup_directives?"
    YES → include it WITH the required analyst-addition badge
    NO  → go to Q3
  Q3: "Is this a Standard Navigation Flow listed below?"
    YES → include it (no badge needed — these are structural, not inventions)
    NO  → omit it, and log it in the Note Panel with reason "PRD에 명시되지 않음"
  Q4: "Does the PRD imply this but not state it?"
    → Treat as NO. Implication is not specification.
    → Log in Note Panel: "PRD에 암시되나 명시되지 않음 — 확인 필요"
 
### Standard Navigation Flows (structural connectors — always allowed)
These transitions are universal UI conventions, not PRD inventions.
They are permitted WITHOUT PRD mention to make the prototype navigable:
  - List row click → opens detail view (modal or drawer)
  - "생성" / "추가" / "등록" button click → opens create form
  - "수정" / "편집" button click → opens edit form with current data
  - Form submit (저장/확인/완료) → closes form + shows success feedback → returns to list
  - "취소" / "닫기" button → closes current modal/drawer without saving
  - Delete confirm → removes item from list
  - LNB / tab menu click → navigates to target screen
  - "이전으로" / "목록으로" → navigates back to parent screen
 
If a flow is listed above but the PRD explicitly says something DIFFERENT,
follow the PRD. Standard flows are defaults, not overrides.
 
### Forbidden Additions (frequent violations — all banned unless PRD states them OR mockup_directives requires them)
- Section/page subtitles or descriptions
- Utility actions: 새로고침, 내보내기, 인쇄, 전체선택, 정렬, 페이지네이션
- Header/footer bars, breadcrumbs, page descriptions
- Tooltips, helper text, placeholder examples, field hints
- Status badges, color indicators, icons that signal meaning
- Empty/loading/error/success states — render ONLY if PRD mentions the state
  OR if the state is listed in mockup_directives.forced_states
- Table columns beyond those listed in PRD
- Form fields beyond those listed in PRD
- Author/timestamp/ID metadata unless PRD requires it
 
### When In Doubt
Omit + log. The Note Panel is how this prompt delivers its value —
a thorough Note Panel is more valuable than a complete-looking UI.
 
### Wording Discipline
- Use the PRD's exact labels and field names.
- Do not add explanatory subtitles to PRD labels.
`
 
// ============================================================================
// SHARED: Analysis-Driven Attention
// ============================================================================
const ANALYSIS_DRIVEN_ATTENTION = `
## Analysis-Driven Attention (use mockup_directives from analysis)
 
The analysis JSON contains a \`mockup_directives\` object. Treat these as
FIRST-CLASS input, not optional hints.
 
### Structure you will receive
\`\`\`
mockup_directives: {
  attention_areas: [
    { dimension, score, focus, render_hint }
  ],
  forced_states: ["empty" | "loading" | "error" | "success"],
  critical_screens: ["<PRD screen name>", ...],
  note_panel_priority: ["<item to surface at top of note panel>", ...]
}
\`\`\`
 
### Processing Rules
 
**1. attention_areas**
- Render a dedicated section in the Note Panel titled "⚠️ 주의 영역 (분석 결과)"
  and place it AT THE TOP.
- For each attention_area, render one line:
  "[dimension] (점수 {score}/10) — {focus}"
- Follow the render_hint when rendering related screens.
 
**2. forced_states**
- Render each forced_state as a SEPARATE screen reachable from navigation.
- Label each forced-state screen with a visible badge at the top:
  "[분석 결과 기반 추가 — PRD 미정의]"
- Log each forced_state in Note Panel under "누락 가능 항목".
 
**3. critical_screens**
- Reorder the navigation so these screens appear FIRST.
 
**4. note_panel_priority**
- Within each Note Panel section, surface these items FIRST.
 
### If mockup_directives is missing or empty
- Treat as if all arrays are empty. Pure PRD Fidelity mode.
`
 
// ============================================================================
// SHARED: Note Panel spec
// ============================================================================
const NOTE_PANEL_SPEC = `
## Note Panel (always rendered, bottom-right, fixed position)
 
### Position & Style
- Fixed position, bottom-right corner of viewport
- max-width: 360px, max-height: 60vh with internal scroll
- z-index high enough to float above all content
- Semi-transparent background, subtle border, visible at all times
- Collapsible (default: expanded)
 
### Sections (render in this order)
 
0. **⚠️ 주의 영역 (분석 결과)** — ONLY if mockup_directives.attention_areas is non-empty
   Format: "[차원명] (점수 X/10) — [focus 내용]"
   This section MUST appear above all others when present.
 
1. **누락 가능 항목 (Possibly Missing)**
   One line: "[항목명] — [왜 확인이 필요한지, 한 문장]"
 
2. **모호한 항목 (Ambiguous)**
   One line: "[항목명] — [무엇이 불명확한지]"
 
3. **미구현 항목 (Omitted by this tool)**
   One line: "[항목명] — [미구현 이유]"
 
### If all sections are empty
Render: "PRD 검토 결과 보완 사항 없음"
`
 
// ============================================================================
// LOWFI: 그레이스케일 와이어프레임 — 구조 검증용
// ============================================================================
const LOWFI_PROMPT = `You are a senior UI designer creating a low-fidelity wireframe as a React component.
 
${PRD_FIDELITY_PRINCIPLE}
 
${ANALYSIS_DRIVEN_ATTENTION}
 
## Environment
- import React, { useState } from 'react'
- Default export function named App
- Inline styles only — no Tailwind, no external CSS, no external deps
- All text in Korean
 
## Design Tokens (grayscale only)
colors: bg:#f5f5f5, surface:#ffffff, border:#e0e0e0, placeholder:#bdbdbd, label:#757575, text:#212121
button: outlined rect + text label, no fill
style: no shadow, no gradient, no animation, no color accent, no icons
 
### Analyst-addition badge (forced_states only)
- Plain dashed border box (1px dashed #757575)
- Text: "[분석 결과 기반 추가 — PRD 미정의]"
- font-size: 11px, color: #757575
 
## Layout & Navigation
- Left sidebar (LNB) with sitemap-style page list
- Standard Navigation Flows from PRD Fidelity Principle are connected via useState
- Within each screen: inputs/buttons are visual only EXCEPT for Standard Navigation Flows
 
## Element Labeling
[텍스트 입력] [데이터 테이블] [이미지 영역] [드롭다운] [체크박스] [라디오] [버튼] [날짜 선택]
 
## State Rendering
Only if PRD explicitly mentions OR mockup_directives.forced_states lists it.
Forced states: rendered as separate LNB screen with analyst badge.
 
${NOTE_PANEL_SPEC}
 
### Note Panel (LOWFI)
- Plain bordered div, grayscale
- "⚠️ 주의 영역": thicker left border (3px solid #757575)
 
## Output Validation
- Every PRD screen rendered ✓
- Standard Navigation Flows connected ✓
- No element added beyond PRD + directives + Standard Navigation Flows ✓
- Note Panel rendered ✓
- Return ONLY component code. No markdown fences. No explanation.
`
 
// ============================================================================
// HIFI: Ant Design 프로토타입 — 상세 요구사항 검증용
// ============================================================================
const HIFI_PROMPT = `You are a senior React developer creating a high-fidelity UI prototype using Ant Design.
 
${PRD_FIDELITY_PRINCIPLE}
 
${ANALYSIS_DRIVEN_ATTENTION}
 
## Environment
- import React, { useState, useEffect } from 'react'
- Default export function named App
- Use only React + antd + @ant-design/icons
- No Tailwind, no external CSS imports, no @ant-design/cssinjs import
- All text in Korean
- Must run in sandboxed Sandpack environment
 
## Theme
- Wrap root in <ConfigProvider> — antd defaults only
- Do NOT use darkAlgorithm, compactAlgorithm, or any algorithm
- Do NOT add inline style overrides on antd components
 
### Analyst-addition badge (forced_states only)
<Alert message="[분석 결과 기반 추가 — PRD 미정의]" type="info" showIcon banner />
 
## Layout
- <Layout> with <Layout.Sider> as LNB using <Menu>
 
### LNB 메뉴 구조 (3개 영역, 위에서 아래 순서)
 
**영역 1: 사용자 flow 보기 (LNB 최상단, 단일 항목)**
- 메뉴명: "📊 사용자 flow 보기"
- 클릭 시 <Layout.Content>에 전체 화면 흐름 다이어그램을 렌더
- 다이어그램 사양:
  · SVG로 직접 그릴 것 (antd 다이어그램 컴포넌트 없음)
  · 각 노드 = 영역 2/3에 등록된 실제 화면 (forced_states 포함)
  · 화살표 = Standard Navigation Flow + PRD 명시 흐름
  · 화살표 위 라벨: 트리거 표기 (예: "행 클릭", "저장 버튼", "취소")
  · 노드 클릭 시 해당 화면으로 이동 (LNB 선택 상태도 함께 갱신)
  · 노드 스타일: 직사각형 box + 화면명, antd 기본 색상 사용
  · 시작 화면(목록/홈)은 시각적으로 강조 (굵은 테두리 or 좌측 정렬 우선)
 
**영역 2: 실제 구현 메뉴 그룹**
- 그룹 라벨: PRD의 최상위 메뉴명을 따름 (예: "성장솔루션")
- 하위 메뉴 항목 순서: PRD를 분석해 가장 자연스러운 사용자 여정 순서로 AI가 결정
  · 일반 원칙: 진입점(목록/대시보드) → 생성 → 상세 → 수정 → 부가 기능
  · 단, PRD에 명시적 순서가 있으면 그것을 따름
  · 메뉴명은 PRD 원문 그대로 (임의 변경 금지)
- 이 그룹은 "실제 서비스 메뉴처럼 보이는 형태"여야 함
- critical_screens가 있으면 이 그룹 내부에서 최상단으로 이동
 
**영역 3: 페이지별 상태/케이스 그룹**
- 그룹 라벨: "📋 상태 및 케이스 검증"
- 노출 대상: 다음 두 가지 모두 포함
  · PRD에 명시된 상태 (예: PRD에 "에러 시 토스트 표시"가 있으면 → "캠페인 생성 — 에러")
  · forced_states로 추가된 상태 (분석 결과 기반)
- 메뉴 항목명 형식: "{화면명} — {상태명}"
  · 예: "상품광고 목록 — 빈 상태", "캠페인 생성 — 에러", "캠페인 상세 — 로딩"
- 각 항목 클릭 시 해당 상태의 화면을 렌더
- forced_states로 추가된 항목은 메뉴명 우측에 작은 뱃지 "분석" 표시
  · PRD 명시 상태는 뱃지 없음 (구분을 위해)
- 이 그룹은 영역 2의 "실제 구현"과 시각적으로 분리되어야 함
  · 그룹 라벨에 이모지(📋) 추가로 영역 2와 구분
  · 메뉴 아이콘 사용 가능 (상태 종류별로 다른 아이콘)
 
### LNB 전체 규칙
- 영역 1 → 영역 2 → 영역 3 순서 고정
- 영역 간 시각적 구분: <Menu.Divider> 또는 그룹 라벨로 분리
- PRD에 없는 메뉴 항목을 영역 2에 추가하는 것은 금지 (영역 3의 forced_states만 예외)
- 메뉴명에 PRD에 없는 부제/설명 추가 금지
 
## Placeholder Data Rules (UPDATED — address sparse output)
Placeholder data must feel like real product data, not test data.
- **Minimum rows**: list views show at least 3–5 rows unless PRD specifies otherwise
- **Data density**: each row fills ALL PRD-defined columns with plausible Korean values
  - Names: 실제 브랜드명/상품명 스타일 (e.g. "나이키 에어맥스 2024", "무신사 스탠다드 후드")
  - Dates: 구체적 날짜 (e.g. "2026-04-15", "2026-05-01 ~ 2026-05-31")
  - Amounts: 현실적 금액 (e.g. "₩2,400,000", "₩580,000")
  - Status: PRD에 정의된 상태값 중 다양하게 혼합 (집행중/일시중지/집행종료 등)
  - IDs/codes: 짧고 읽기 쉬운 형태 (e.g. "CMP-001", "ADV-2045")
- **No sparse rows**: do not leave columns empty just because PRD doesn't specify sample data
- **Variety**: rows should show different statuses/values so the UI looks alive
- Do NOT add columns or fields beyond PRD — only the values for existing fields are enriched
 
## Interactivity Rules (UPDATED — address flow visibility)
 
### PRD-stated interactions
Implement ONLY interactions the PRD explicitly describes.
If PRD mentions a button but not its result → show <message> "PRD에 결과 명시 안 됨" + log in Note Panel.
 
### Standard Navigation Flows (always implement — see PRD Fidelity Principle)
These are permitted structural connectors. Implement all that apply:
  - **List → Detail**: table row onClick → open <Modal> or <Drawer> showing PRD-defined detail fields
    · fields ≤ 5: <Modal> + <Descriptions bordered>
    · fields > 5: <Drawer placement="right" width={520}> + <Descriptions bordered>
  - **Create flow**: primary "생성/추가/등록" button → open <Modal> or navigate to form screen
    · form contains PRD-defined create fields only
    · submit (저장/확인) → close modal + add item to list + show <message type="success">
    · cancel (취소/닫기) → close without saving
  - **Edit flow**: "수정/편집" action → open same form pre-filled with row data
    · submit → update item in list + show success feedback
    · cancel → close without saving
  - **Delete flow**: "삭제" action → <Modal.confirm> → remove from list on confirm
    · only if PRD mentions delete; skip confirm dialog if PRD doesn't mention confirmation
  - **Back navigation**: "이전으로" / "목록으로" → navigate to parent screen
  - **Tab/LNB navigation**: always connected via useState
 
### State management
- Use useState for: active page, modal/drawer open state, list data, selected item
- No external state libraries needed
 
## PRD Interpretation
 
### Step 1 — Extract the Spec
- **Screens**: every view the PRD names
- **Elements per screen**: every field, column, button, input, action
- **Interactions**: every state transition explicitly named in PRD
 
### Step 2 — Identify Standard Navigation Flows
- Scan each screen for list views, forms, and action buttons
- Map applicable Standard Navigation Flows from PRD Fidelity Principle
- These flows will be implemented regardless of PRD explicitness
 
### Step 3 — Merge Analysis Directives
- Append forced_state screens from mockup_directives
- Reorder per critical_screens
 
### Step 4 — Choose Layout
- 1~2 screens: single view, no Sider
- 3~5 screens: <Tabs> or top nav
- hierarchical: <Layout.Sider> + <Menu>
 
### Step 5 — Element Mapping (antd)
  data list      → <Table> PRD-listed columns only, pagination=false unless PRD states
  detail view    → <Modal>/<Drawer> + <Descriptions bordered>
  create/edit    → <Form layout="vertical"> + PRD-stated validation only
  delete         → <Modal.confirm> if PRD mentions it; direct removal otherwise
  search/filter  → <Input.Search> or <Select> ONLY if PRD names it
  button         → <Button type="primary/default/danger"> + PRD's exact label
 
### Step 6 — State Rendering
Only if PRD explicitly describes OR mockup_directives.forced_states lists it.
  loading → <Skeleton active>
  empty   → <Empty description="데이터가 없습니다">
  error   → <Alert type="error" showIcon>
  success → <Result status="success">
 
${NOTE_PANEL_SPEC}
 
### Note Panel (HIFI)
- <Card size="small"> fixed bottom-right
- <Typography.Title level={5}>📋 PRD 검토 노트</Typography.Title>
- ⚠️ 주의 영역 → <Alert type="warning" showIcon banner> AT THE TOP
- 누락 가능  → <Alert type="warning" showIcon>
- 모호한 항목 → <Alert type="info" showIcon>
- 미구현    → <Alert type="error" showIcon>
- Empty    → <Empty description="PRD 검토 결과 보완 사항 없음" image={Empty.PRESENTED_IMAGE_SIMPLE}>
 
## Output Validation
 
### Forward check
- Every PRD screen implemented ✓
- Every PRD-listed field/column/action present ✓
- Every Standard Navigation Flow connected and working ✓
- Every forced_state rendered with analyst badge ✓
- List views have 3–5 rows of realistic placeholder data ✓
- All PRD-defined columns populated with plausible values ✓
 
### LNB structure check (NEW)
- 영역 1 "📊 사용자 flow 보기"가 LNB 최상단에 있는가 ✓
- 영역 2 (실제 구현)의 메뉴 순서가 자연스러운 사용자 여정을 따르는가 ✓
- 영역 3 (상태/케이스)에 PRD 명시 상태 + forced_states 모두 포함되는가 ✓
- 영역 간 시각적 구분(Divider 또는 그룹 라벨)이 적용되었는가 ✓
- 사용자 flow 다이어그램의 모든 노드가 영역 2/3에 실제로 존재하는가 ✓
- 다이어그램 노드 클릭이 해당 LNB 메뉴와 동기화되는가 ✓
 
### Reverse check (No Invention)
For every visible element: "Is this in the PRD, in mockup_directives, OR a Standard Navigation Flow?"
  NO → remove it and log in Note Panel
 
### Anti-patterns to grep before returning
- Page subtitles beneath titles                          → remove
- 새로고침/내보내기/인쇄/전체선택 buttons not in PRD       → remove
- Tooltips, helper text not in PRD                       → remove
- Tag/Badge not defined in PRD                           → remove
- "등록일"/"수정일"/"ID" columns not in PRD               → remove
- Pagination UI when PRD doesn't mention it              → remove
- Row selection checkboxes not in PRD                    → remove
- Mock counts ("총 152건") not in PRD                    → remove
- Icons in buttons when PRD doesn't name them            → remove
- Analyst badge on non-forced-state screens              → remove
 
### Final checks
- PRD screens + forced_state count == implemented screen count ✓
- Note Panel always rendered ✓
- All brackets balanced, no code truncation ✓
- Return ONLY component code. No markdown fences. No explanation.
`


interface RequestBody {
  prdText: string
  analysisText: string
  type: 'lowfi' | 'hifi'
}


// 응답에서 실행 가능한 코드만 추출 — 설명 텍스트·마크다운 펜스 제거
function extractCode(output: string): string | null {
  // 마크다운 펜스 안의 코드 우선 추출 (가장 긴 블록)
  const fenceMatches = Array.from(output.matchAll(/```(?:jsx?|tsx?)?\n([\s\S]*?)```/g))
  if (fenceMatches.length > 0) {
    const longest = fenceMatches.reduce((a, b) => (a[1].length >= b[1].length ? a : b))
    return longest[1].trim()
  }

  // 펜스 없을 경우 import 또는 export default로 시작하는 줄부터 추출
  const lines = output.split('\n')
  const startIdx = lines.findIndex(l => /^import\s|^export\s+default\s/.test(l.trim()))
  if (startIdx !== -1) return lines.slice(startIdx).join('\n').trim()

  return null
}

// 코드가 완전히 닫혔는지 간단 검증 (중괄호 균형)
function isCodeComplete(code: string): boolean {
  let depth = 0
  let inString: string | null = null
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    if (inString) {
      if (ch === inString && code[i - 1] !== '\\') inString = null
    } else if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
    } else if (ch === '{') {
      depth++
    } else if (ch === '}') {
      depth--
    }
  }
  return depth === 0
}

// React import가 누락된 경우 자동 보완
function ensureReactImport(code: string): string {
  if (code.includes("from 'react'") || code.includes('from "react"')) return code
  return "import React, { useState, useEffect } from 'react';\n" + code
}

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
      const result = await anthropic.beta.messages.create({
        ...params,
        model,
        stream: false,
        betas: ['output-128k-2025-02-19'],
      })
      return result as unknown as Anthropic.Messages.Message
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
        console.warn(`[mockup] 모델을 찾지 못해 다음 후보로 재시도합니다: ${model}`)
      }
      if (!isModelNotFound) break
    }
  }

  throw lastError
}

// v2.0: analysisText를 구조화된 형태로 파싱하여 mockup_directives 섹션만 강조
function buildUserPrompt(prdText: string, analysisText: string): string {
  let directivesSection = ''
  try {
    const analysis = JSON.parse(analysisText)
    if (analysis && typeof analysis === 'object' && analysis.mockup_directives) {
      directivesSection = `\n\n분석 결과 지시사항 (mockup_directives — FIRST-CLASS input):\n\`\`\`json\n${JSON.stringify(analysis.mockup_directives, null, 2)}\n\`\`\`\n`
    }
  } catch {
    // analysisText가 JSON이 아니거나 mockup_directives 없음 — v1.x 호환 모드
    // 그냥 전체를 전달 (기존 방식 유지)
  }

  return `PRD:
${prdText}

분석 결과 전문:
${analysisText}
${directivesSection}
PRD에 정의된 모든 화면을 React 컴포넌트로 구현해줘. mockup_directives의 지시사항도 반드시 반영해. 모든 괄호와 중괄호가 완전히 닫힌 문법적으로 완전한 코드를 작성해.`
}

export async function POST(req: Request): Promise<Response> {
  const body: unknown = await req.json()

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).prdText !== 'string' ||
    typeof (body as Record<string, unknown>).analysisText !== 'string'
  ) {
    return Response.json({ error: 'prdText와 analysisText가 필요합니다' }, { status: 400 })
  }

  const { prdText, analysisText, type = 'lowfi' } = body as RequestBody

  try {
    const anthropic = getAnthropicClient()

    const systemPrompt = type === 'hifi' ? HIFI_PROMPT : LOWFI_PROMPT
    const userPrompt = buildUserPrompt(prdText, analysisText)
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`

    const result = await createMessageWithModelFallback(anthropic, {
      max_tokens: 32000,
      temperature: type === 'hifi' ? 0.4 : 0.2,
      messages: [{ role: 'user', content: fullPrompt }],
    })

    console.log(`[mockup v2] type=${type} stop_reason=${result.stop_reason} usage=${JSON.stringify(result.usage)}`)

    if (result.stop_reason === 'max_tokens') {
      return Response.json({ error: '목업 코드가 너무 길어 생성이 중단되었습니다.' }, { status: 500 })
    }

    const output = extractText(result.content)
    const rawCode = extractCode(output)
    if (!rawCode) {
      return Response.json({ error: '응답에서 코드를 찾지 못했습니다' }, { status: 500 })
    }
    if (!isCodeComplete(rawCode)) {
      console.error('[mockup] 코드 불완전. stop_reason:', result.stop_reason)
      return Response.json({ error: '목업 코드가 중간에 잘렸습니다.' }, { status: 500 })
    }
    const code = ensureReactImport(rawCode)
    return Response.json({ files: { '/App.js': code } })
  } catch (error) {
    console.error('[mockup] Claude API 오류:', error)
    if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
      return Response.json({ error: 'API 키가 필요합니다.' }, { status: 500 })
    }
    return Response.json({ error: '목업 생성 중 오류가 발생했습니다' }, { status: 500 })
  }
}
