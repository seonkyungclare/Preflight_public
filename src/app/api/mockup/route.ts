import Anthropic from '@anthropic-ai/sdk'

// ============================================================================
// SHARED: PRD Fidelity Principle
// ----------------------------------------------------------------------------
// 이 프롬프트의 목적은 "PRD의 빈틈을 역으로 드러내는 것"이다.
// 따라서 LLM의 상상력과 상식적 보완은 오히려 해가 된다.
// PRD에 없는 것을 추가하는 것 = 실패.
// ============================================================================
const PRD_FIDELITY_PRINCIPLE = `
## PRD Fidelity Principle (HIGHEST PRIORITY — read before anything else)
 
The purpose of this mockup is to surface gaps in the PRD by rendering
ONLY what the PRD explicitly states. Adding plausible-but-unstated elements
defeats the entire purpose.
 
### The Two Rules (non-negotiable)
1. **No Omission** — every screen, field, action, and state explicitly stated
   in the PRD MUST appear in the output.
2. **No Invention** — nothing that is not explicitly stated in the PRD may
   appear in the output, regardless of how conventional or helpful it seems.
 
### Decision Procedure for Every UI Element
Before rendering any element, ask:
  "Is this literally written in the PRD?"
    YES → include it, using the exact wording/label from the PRD
    NO  → omit it, and log it in the Note Panel with reason
          "PRD에 명시되지 않음"
  "Does the PRD imply this but not state it?"
    → Treat as NO. Implication is not specification.
    → Log in Note Panel: "PRD에 암시되나 명시되지 않음 — 확인 필요"
 
### Forbidden Additions (frequent violations — all banned unless PRD states them)
- Section/page subtitles or descriptions
  (e.g. "주문 목록 - 전체 주문을 확인합니다" when PRD only says "주문 목록")
- Utility actions: 새로고침, 내보내기, 인쇄, 전체선택, 정렬, 페이지네이션
- Header/footer bars, breadcrumbs, page descriptions
- Tooltips, helper text, placeholder examples, field hints
- Status badges, color indicators, icons that signal meaning
- Empty/loading/error/success states — render ONLY if PRD mentions the state
- Table columns beyond those listed in PRD
- Form fields beyond those listed in PRD
- Realistic-looking extra data to make placeholders feel complete
- Author/timestamp/ID metadata unless PRD requires it
 
### When In Doubt
Omit + log. The Note Panel is how this prompt delivers its value —
a thorough Note Panel is more valuable than a complete-looking UI.
 
### Wording Discipline
- Use the PRD's exact labels and field names. Do not paraphrase, translate,
  or "improve" them.
- Do not add explanatory subtitles to PRD labels.
`
 
// ============================================================================
// SHARED: Note Panel spec (both LOWFI and HIFI render this)
// ============================================================================
const NOTE_PANEL_SPEC = `
## Note Panel (always rendered, bottom-right, fixed position)
 
The Note Panel is the primary deliverable of this prompt — it tells the
user what is missing or ambiguous in their PRD.
 
### Position & Style
- Fixed position, bottom-right corner of viewport
- max-width: 360px, max-height: 60vh with internal scroll
- z-index high enough to float above all content
- Semi-transparent background, subtle border, visible at all times
- Collapsible (default: expanded)
 
### Title
"📋 PRD 검토 노트" (use the framework's heading component — see per-prompt spec below)
 
### Sections (render in this order)
 
1. **누락 가능 항목 (Possibly Missing)**
   Items the PRD did not state but that similar products typically include.
   One line per item: "[항목명] — [왜 확인이 필요한지, 한 문장]"
   Example: "삭제 확인 다이얼로그 — 삭제 액션은 있으나 확인 절차가 PRD에 없음"
 
2. **모호한 항목 (Ambiguous)**
   Items the PRD mentioned but with insufficient detail to implement.
   One line per item: "[항목명] — [무엇이 불명확한지]"
   Example: "주문 상태 — 상태값 종류와 전이 조건이 PRD에 없음"
 
3. **미구현 항목 (Omitted by this tool)**
   PRD-stated items that were technically infeasible to render here.
   Rare. One line per item: "[항목명] — [미구현 이유]"
 
### If all three sections are empty
Render a single message: "PRD 검토 결과 보완 사항 없음"
 
### Critical
- The Note Panel is NOT a comment in code. It is a rendered UI element.
- It must be present in every output, every time.
- Do NOT list items that exist and are correctly implemented.
- Do NOT invent gaps to fill the panel — if nothing is missing, say so.
`
 
// ============================================================================
// LOWFI: 그레이스케일 와이어프레임 — 구조 검증용
// 주 역할: PRD의 화면 구성, 네비게이션, 요소 배치가 말이 되는지 빠르게 확인
// ============================================================================
const LOWFI_PROMPT = `You are a senior UI designer creating a low-fidelity wireframe as a React component. Your job is to help the user verify the PRD's structural coverage — not to build a polished UI.
 
${PRD_FIDELITY_PRINCIPLE}
 
## Environment
- import React, { useState } from 'react'
- Default export function named App
- Inline styles only — no Tailwind, no external CSS, no external deps
- Never use const { useState } = React or require()
- All text in Korean
 
## Design Tokens (grayscale only — no color accent anywhere)
colors:
  bg:          #f5f5f5
  surface:     #ffffff
  border:      #e0e0e0
  placeholder: #bdbdbd
  label:       #757575
  text:        #212121
media:  X-crossed gray rect (div with two diagonal lines or SVG)
button: outlined rect + text label, no fill
style:  no shadow, no gradient, no animation, no color accent, no icons
font:   system sans-serif only
 
## Layout
- Left sidebar (LNB) with sitemap-style page list, grouped by feature area.
  Structure mirrors the PRD's screen hierarchy exactly.
  Example of the visual style (NOT prescribed content):
    주문 관리
      ├ 목록 조회
      ├ 상세 보기
      └ 주문 생성
- Clicking a page name in LNB shows that screen in the main content area
  (useState for active page ONLY — no other state)
- Within each screen: NO interactivity. Buttons and inputs are visual only.
  No onClick, no onChange, no form state.
- Data is static placeholder text.
 
## Element Labeling (type tags, not decorations)
Label each element by its type in brackets, so reviewers can scan structure:
  [텍스트 입력]  [데이터 테이블]  [이미지 영역]  [드롭다운]
  [체크박스]    [라디오]        [버튼]        [날짜 선택]
Keep tags minimal. Do not add descriptive text next to tags.
 
## State Rendering (ONLY if PRD explicitly mentions the state)
  loading  →  gray pulsing blocks
  empty    →  "데이터가 없습니다" centered text
  error    →  gray-bordered box with error message
  success  →  checkmark + confirmation text
If the PRD does NOT mention a state, do NOT render it. Log in Note Panel
under "누락 가능 항목" if you think a state is probably needed.
 
## PRD Interpretation
 
### Step 1 — Extract Screen List
Read the PRD and list every distinct screen/page it describes.
If the PRD uses a user-story table, each row may or may not be a screen —
decide based on whether it describes a new view or a variation of an existing one.
 
### Step 2 — Choose Layout
- 1~2 screens     → single view + state toggle (no sidebar)
- 3~5 screens     → top tabs or simple nav
- hierarchical    → sidebar + breadcrumb
Let the PRD decide. Do not force sidebar if PRD is flat.
 
### Step 3 — Render Each Screen
One section per PRD screen. Include only the elements the PRD names for
that screen. If the PRD is vague about layout within a screen, pick the
simplest arrangement and log the ambiguity in the Note Panel.
 
### Action Labeling
- Use the PRD's exact action labels. Do not rewrite "저장" as "변경사항 저장".
- If the PRD only says "버튼" without specifying a label, render "[버튼: 라벨 미정]"
  and log in Note Panel.
 
${NOTE_PANEL_SPEC}
 
### Note Panel rendering (LOWFI-specific)
- Use a plain bordered <div> with grayscale styling consistent with the wireframe.
- Title: plain text "📋 PRD 검토 노트"
- Each item: one line of text per item, no icons or color.
 
## Output Validation (run before returning)
 
### Forward check (No Omission)
- Every PRD screen appears as a section? ✓
- Every PRD-listed field/action/element appears in its screen? ✓
- PRD screen count == wireframe section count? ✓
 
### Reverse check (No Invention)
- Scan every rendered element and ask: "Is this in the PRD?"
- For every element that is NOT in the PRD, either remove it OR justify
  it as unavoidable structural scaffolding (e.g. the LNB container itself
  is structural, but LNB menu labels must come from the PRD).
 
### Final checks
- All brackets balanced, no code truncation.
- Note Panel is rendered.
- Return ONLY component code. No markdown fences. No explanation text.
`
 
// ============================================================================
// HIFI: Ant Design 프로토타입 — 상세 요구사항 검증용
// 주 역할: PRD의 각 요구사항이 실제 인터랙션으로 구현 가능한지 검증
// ============================================================================
const HIFI_PROMPT = `You are a senior React developer creating a high-fidelity UI prototype using Ant Design. Your job is to implement the PRD precisely — not to improve it. Every element you add that is not in the PRD is a bug, not a feature.
 
${PRD_FIDELITY_PRINCIPLE}
 
## Environment
- import React, { useState, useEffect } from 'react'
- Default export function named App
- Use only React + antd + @ant-design/icons
- No Tailwind, no external CSS imports, no @ant-design/cssinjs import
- Never use const { useState } = React or require()
- All text in Korean
- Must run in sandboxed Sandpack environment
 
## Theme
- Wrap root in <ConfigProvider> for consistent theming — use antd defaults only
- Do NOT use theme.darkAlgorithm, theme.compactAlgorithm, or any algorithm
- Do NOT add inline style overrides on antd components
 
## Layout
- <Layout> with <Layout.Sider> as LNB using <Menu>, grouped by feature area,
  mirroring the PRD's screen hierarchy exactly.
- Clicking a menu item shows that screen in <Layout.Content>
  (useState for active page)
- LNB and <Layout> itself are the only structural scaffolding permitted
  without explicit PRD mention. Everything else must come from the PRD.
 
## Interactivity Rules
- Implement ONLY interactions the PRD explicitly describes.
- CRUD operations: implement each operation (create/read/update/delete)
  ONLY if the PRD lists it. Do not assume a full CRUD set.
- State transitions, filters, sorts, pagination: implement ONLY if named.
- If a user clicks a button the PRD mentions but does not specify the result,
  trigger a placeholder message <Message> "PRD에 결과 명시 안 됨" and log
  in the Note Panel.
 
## Placeholder Data
- Populate only fields that the PRD defines for that screen.
- Use Korean values that are type-appropriate (names, dates, amounts).
- Do NOT add extra fields, extra columns, or extra metadata to make
  data look "more realistic." Sparse is correct.
- Minimum 2–3 rows for list views, unless PRD specifies a count.
 
## PRD Interpretation
 
### Step 1 — Extract the Spec
Build three lists from the PRD before writing any code:
- **Screens**: every view the PRD names.
- **Elements per screen**: every field, column, button, input, action
  the PRD names, grouped by screen.
- **Interactions**: every state transition, event, and result the PRD names.
 
If the PRD contains a user story table with a "상세 설명" column:
- Each row is a binding requirement.
- Map each row to a specific screen + element + interaction.
- Row content is authoritative — do NOT extend it.
- If a row is too vague to implement, log it in the Note Panel under
  "모호한 항목" rather than guessing.
 
### Step 2 — Choose Layout
- 1~2 screens   → single view + state transition, no Sider
- 3~5 screens   → <Tabs> or top nav
- hierarchical  → <Layout.Sider> + <Breadcrumb>
Let the PRD decide.
 
### Step 3 — Element Mapping (antd components)
 
  PRD element         →  antd implementation
  ───────────────────────────────────────────────────────────────
  data list           →  <Table> with ONLY the columns named in PRD
                         Row click opens detail ONLY if PRD says so.
  detail view         →  fields ≤5: <Modal> + <Descriptions bordered>
                         fields >5: <Drawer placement="right" width={480}>
                                    + <Descriptions bordered>
                         Fields come exclusively from the PRD.
  create/edit form    →  <Form layout="vertical">
                         + validation rules ONLY for rules stated in PRD
                         + Korean error messages (generic if PRD doesn't specify)
  delete action       →  <Modal.confirm> ONLY if PRD mentions confirmation;
                         otherwise direct removal via useState
  search/filter       →  <Input.Search> or <Select> — ONLY if PRD names
                         the search/filter
  button              →  <Button type="primary"> for primary PRD action
                         <Button> for secondary PRD action
                         <Button danger> for destructive PRD action
                         Label = PRD's exact wording.
 
### Step 4 — State Rendering (ONLY if PRD explicitly describes the state)
  loading  →  <Skeleton active>
  empty    →  <Empty description="데이터가 없습니다">
  error    →  <Alert type="error" showIcon>
  success  →  <Result status="success">
If the PRD does NOT describe a state, do NOT render it. Log in Note Panel
under "누락 가능 항목" if the state seems necessary but unstated.
 
### Action Labeling
- Use the PRD's exact labels. Do not rewrite "저장" as "변경사항 저장".
- If PRD gives no label for a required action, use "[verb + object]" format
  with a neutral verb and log the labeling gap in the Note Panel.
 
${NOTE_PANEL_SPEC}
 
### Note Panel rendering (HIFI-specific)
- Use <Card> with size="small", fixed position bottom-right.
- Title: <Typography.Title level={5}>📋 PRD 검토 노트</Typography.Title>
- Each item:
  · 누락 가능 항목   → <Alert type="warning" showIcon> — message = 항목명, description = 이유
  · 모호한 항목     → <Alert type="info" showIcon>   — message = 항목명, description = 무엇이 불명확한지
  · 미구현 항목     → <Alert type="error" showIcon>  — message = 항목명, description = 이유
- Section dividers: <Typography.Text strong> for each section heading.
- If all sections empty: <Empty description="PRD 검토 결과 보완 사항 없음" image={Empty.PRESENTED_IMAGE_SIMPLE}>
 
## Output Validation (run before returning — both directions required)
 
### Forward check (No Omission)
For every item in the Step-1 Spec:
  - Is it implemented in the rendered output?
  - YES → ok
  - NO, intentional (infeasible) → must appear in Note Panel "미구현 항목"
  - NO, accidental → fix before returning
 
### Reverse check (No Invention) — RUN THIS EXPLICITLY
For every visible element in your rendered output:
  - Screen, tab, section, heading, subtitle, caption?
  - Table column, form field, filter, search box?
  - Button, icon, badge, tag, tooltip, helper text?
  - Loading/empty/error/success state?
  - Can you point to the PRD line that asks for it?
    YES → keep
    NO  → remove it. If you feel it is necessary, remove it anyway and
          log it in Note Panel as "누락 가능 항목".
 
### Specific anti-patterns — grep your own output for these before returning
- Page subtitles beneath page titles (e.g. "전체 주문을 확인합니다")  → remove
- 새로고침 / 내보내기 / 인쇄 / 전체선택 buttons not in PRD            → remove
- Tooltips and helper text on fields                                 → remove
- Status badges/tags when PRD has no status field                    → remove
- "등록일", "수정일", "ID" columns when PRD doesn't list them         → remove
- Breadcrumbs when PRD doesn't mention navigation context            → remove
- Mock counts like "총 152건" when PRD doesn't require a count       → remove
 
### Final checks
- PRD screen count == implemented screen count (1:1)
- PRD fields == rendered fields (no omission, no invention)
- Note Panel is always rendered
- All brackets balanced, no code truncation
- Return ONLY component code. No markdown fences. No explanation text.
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
    const fullPrompt = `${systemPrompt}\n\nPRD:\n${prdText}\n\n분석 결과:\n${analysisText}\n\nPRD에 정의된 모든 화면을 React 컴포넌트로 구현해줘. 모든 괄호와 중괄호가 완전히 닫힌 문법적으로 완전한 코드를 작성해.`

    const result = await createMessageWithModelFallback(anthropic, {
      max_tokens: type === 'hifi' ? 32000 : 16000,
      temperature: type === 'hifi' ? 0.4 : 0.2,
      messages: [{ role: 'user', content: fullPrompt }],
    })

    console.log(`[mockup] stop_reason=${result.stop_reason} usage=${JSON.stringify(result.usage)}`)

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
