import Anthropic from '@anthropic-ai/sdk'
import { parse as babelParse } from '@babel/parser'

export const maxDuration = 300 // Vercel 최대 실행 시간 300초 (Pro plan)

// ============================================================================
// TYPES
// ============================================================================

interface ScreenSpec {
  id: string
  name: string
  type: 'list' | 'form' | 'detail' | 'dashboard' | 'other'
  columns: string[]
  fields: string[]
  actions: string[]
  navigates_to: string[]
  parent_id?: string  // set for 2nd-level screens; omitted for top-level menu screens
  ux_hints?: string[] // UX/UI-specific behaviors derived from user requirements (e.g. conditional fields, validation states, component types)
}

interface NoteItem {
  category: 'missing' | 'ambiguous' | 'omitted' | 'attention'
  item: string
  reason: string
}

interface MockupSpec {
  screens: ScreenSpec[]
  menu_screen_ids: string[]
  flows: Array<{ from: string; to: string; trigger: string }>
  forced_states: string[]
  critical_screen_ids: string[]
  attention_areas: Array<{ dimension: string; score: number; focus: string }>
  note_items: NoteItem[]
}

interface RequestBody {
  prdText: string
  analysisText: string
  type: 'lowfi' | 'hifi'
}

// ============================================================================
// PROMPTS
// ============================================================================

const SPEC_EXTRACTION_SYSTEM = `You are a PRD analyst. Extract structured screen specifications from the PRD and analysis JSON.
Return a single valid JSON object. No markdown fences, no extra text.

Output schema:
{
  "screens": [
    {
      "id": "unique_snake_case_id",
      "name": "화면명 (exact PRD wording)",
      "type": "list|form|detail|dashboard|other",
      "columns": ["컬럼명1"],
      "fields": ["필드명1"],
      "actions": ["버튼명1"],
      "navigates_to": ["target_screen_id"],
      "parent_id": "parent_screen_id_or_omit_if_top_level",
      "ux_hints": ["UX 패턴 설명1"]
    }
  ],
  "menu_screen_ids": ["id"],
  "flows": [{ "from": "id", "to": "id", "trigger": "트리거" }],
  "forced_states": [],
  "critical_screen_ids": [],
  "attention_areas": [{ "dimension": "차원명", "score": 5, "focus": "구체적 약점" }],
  "note_items": [
    { "category": "missing|ambiguous|omitted|attention", "item": "항목명", "reason": "이유" }
  ]
}

Rules:
- menu_screen_ids: TOP-LEVEL navigation only (main menu items, max 1-depth)
- columns: ALL PRD-defined table columns (list type) — do not omit any
- fields: ALL PRD-defined form/detail fields — do not omit any
- actions: ALL PRD-defined buttons/actions for this screen
- navigates_to: screen ids reachable from this screen — derive from PRD AND Standard Navigation Flows below
- forced_states, critical_screen_ids, attention_areas: derive from analysis.mockup_directives
- note_items: PRD gaps, ambiguities, missing specs, and attention areas from analysis

## Screen hierarchy (2-level max)
Decide per screen whether it's 1st-level (top menu) or 2nd-level (sub-page):

2nd-level screen (add to screens array with parent_id set, do NOT add to menu_screen_ids):
- 상세 페이지: viewing a single item's full detail (e.g., 캠페인 상세, 광고 상세)
- 생성/등록 폼: full-page creation form with many fields (e.g., 캠페인 생성, 소재 등록)
- 수정 폼: full-page edit form (e.g., 캠페인 수정)
- 서브 섹션: sub-feature under a parent (e.g., 소재 관리 under 캠페인 관리)
- Rule: set parent_id to the 1st-level screen id

NOT a separate screen (keep as action in parent, no separate screen entry):
- 삭제 확인 팝업, 인라인 수정, 필터 드롭다운, 컬럼 설정 모달 (<=5 fields in a modal)
- Rule: put in parent screen actions list only

## Standard Navigation Flows (ALWAYS derive these even if PRD doesn't state them explicitly)
These are universal UI conventions — populate navigates_to and flows based on these rules:
- list screen → detail screen of the same domain (trigger: "행 클릭")
- any screen with "생성/추가/등록" action → form screen or back to same screen (trigger: "생성 버튼")
- form screen → parent list screen after submit (trigger: "저장/확인")
- detail screen → parent list screen (trigger: "목록으로")
- any screen → any screen explicitly linked in PRD (trigger: PRD's exact wording)

## flows population rules
- Include ALL navigations: PRD-explicit + Standard Navigation Flows derived above
- Every menu screen should appear in at least one flow (as from or to)
- trigger: short Korean label describing what user does (예: "행 클릭", "저장 버튼", "취소", "생성 버튼")

## User Requirements Section
If the input contains a section starting with "=== 사용자 요구사항:", treat it as supplementary UX/UI requirements that OVERRIDE or EXTEND the PRD.
- Merge any additional fields, columns, actions, or flows mentioned there into the relevant screens
- If a requirement contradicts the PRD, prefer the requirement (it is more specific and up-to-date)
- If a screen is mentioned only in requirements (not in PRD), add it as a new screen entry with appropriate type and parent_id
- Reflect tone, terminology, and domain-specific wording from the requirements section into screen names and labels
- Extract UX-specific behaviors into each screen's ux_hints array using the rules below

### ux_hints extraction rules
ux_hints captures UI patterns and behaviors that go beyond simple field/action lists.
These rules apply to ANY requirements document, regardless of domain or writing style.
Read each requirement semantically — do not rely on exact Korean keywords. Infer intent.

For each screen, scan the requirements and extract hints using these categories:

**dropzone** — any mention of bulk upload, drag-and-drop, file import, batch registration via file
→ "dropzone: [설명] 파일 업로드 드롭존"

**timepicker** — any mention of time precision (hour/minute), scheduled time input, HH:MM, reservation time
→ "timepicker: [설명] 시간 입력 UI (HH:MM)"

**calendar** — any mention of timeline view, slot calendar, gantt-style grid, date × resource matrix
→ "calendar: [설명] 날짜×리소스 그리드 캘린더"

**timeline** — any mention of audit log, change history, edit log, who changed what when
→ "timeline: [설명] 변경 이력 타임라인 (수정자·일시·항목)"

**filter_chip** — any mention of status filter chips, tag-based filtering, quick filter toggles
→ "filter_chip: [설명] 상태 필터 칩"

**preview** — any mention of preview, thumbnail, simulated rendering, visual confirmation before publish
→ "preview: [설명] 미리보기 영역"

**stats** — any mention of KPI, metrics, performance indicators, comparison with past period
→ "stats: [설명] 지표 카드 (현재값 + 비교값)"

**conditional** — any mention of fields that appear/hide based on another field's value, type-based field switching
→ "conditional: [조건 필드] 값에 따라 [표시 필드] 노출/숨김"

**validation** — any mention of real-time validation, inline error, format check, auto-trim, dead link detection
→ "validation: [필드명] — [검증 내용 및 오류 표시 방식]"

**permission** — any mention of role-based access, account-type restrictions, feature gating by user type
→ "permission: [조건] 에 따라 [항목] 비활성화 또는 안내 메시지 표시"

**guard** — any mention of confirmation popup before destructive/impactful action, warning before edit/delete
→ "guard: [액션] 전 경고 팝업 — [경고 내용 요약]"

**notification** — any mention of alerts, subscriptions, event-based notifications, status change alarms
→ "notification: [이벤트] 발생 시 알림 구독 UI"

**copy_flow** — any mention of clone, duplicate then edit, one-click copy workflow
→ "copy_flow: [대상] 복제 후 수정 플로우"

General rule: if a requirement clearly describes a UI behavior not covered above, write a free-form hint in Korean that captures the intent concisely (e.g. "자동완성: [필드명] 입력 시 추천 목록 노출").
Only add hints that are actionable at the screen level — skip system-level or backend-only requirements.`

const LOFI_SYSTEM = `You generate grayscale wireframe React component functions for low-fidelity prototypes.

Output format (STRICT):
- Generate ONLY: function Screen_XXX({ navigate }) { ... }
- No imports. No export. No other functions or code outside the one function.
- Inline styles ONLY.

Design tokens:
- bg: #f5f5f5, surface: #fff, border: #e0e0e0, placeholder: #bdbdbd, label: #757575, text: #212121
- No color accents, no shadows, no icons, no animations

Rules:
- Use exact PRD field/column names as labels
- List type: render a basic table structure with 3 placeholder rows (use realistic Korean text for cells)
- Form type: each field as a labeled rectangle input box
- Detail type: key-value pairs in a simple grid
- All actions from spec: rendered as outlined rectangles with text labels
- Navigation actions (when target is in navigates_to): call navigate('targetId') onClick
- Actions without clear navigation target: render as visual-only (no onClick)
- Do NOT add elements not in the screen spec

## ux_hints rendering rules (wireframe level)
When the screen spec includes ux_hints, reflect the intent structurally using grayscale shapes:
- "dropzone:" → dashed rectangle with centered label "📂 파일 드롭 영역"
- "timepicker:" → input box with label "날짜 / 시간 (HH:MM)"
- "calendar:" → grid table skeleton (rows = 리소스, columns = 날짜, cells = colored bars)
- "timeline:" → 3-column table at bottom of screen: 수정자 | 수정일시 | 변경항목
- "filter_chip:" → row of small outlined rectangle chips with status text
- "preview:" → bordered rectangle labeled "미리보기" with placeholder thumbnail grid
- "stats:" → row of metric cards (label on top, large number below, small comparison below that)
- "conditional:" → field group with bracket label "[조건에 따라 노출]"
- "validation:" → input with red-dashed border + small error text placeholder below
- "permission:" → lighter-bordered rectangle with gray label + "🔒" prefix
- "guard:" → button with "⚠" prefix and small note "확인 팝업 발생"
- "copy_flow:" → action button labeled "복제 후 수정" with arrow indicator
- "notification:" → toggle row labeled "알림 구독" with on/off placeholder`

const HIFI_SYSTEM = `You generate high-fidelity Ant Design React component functions for interactive prototypes.

Output format (STRICT):
- Generate ONLY: function Screen_XXX({ navigate }) { ... }
- No imports. No export. No other functions or code outside the one function.

Pre-imported (DO NOT re-import):
- React, useState (from 'react')
- antd: Layout, Menu, Table, Form, Input, Button, Modal, Drawer, Select, DatePicker, Typography, Space, Tag, Descriptions, message, Empty, Alert, Card, Tabs, InputNumber, Radio, Checkbox, Switch, Badge, Divider, Tooltip, Popconfirm, Row, Col, Statistic, Upload, ConfigProvider
- @ant-design/icons: PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined, DownloadOutlined

Rules:
- All text Korean
- Realistic Korean placeholder data: brand/product names, dates "2026-04-15", amounts "₩2,400,000", mixed PRD-defined statuses
- List type: Table with 3–5 rows, ALL columns filled, no empty cells
- Full interactivity — NO dead ends:
  · Table rows: onClick → open Modal (≤5 detail fields) or Drawer (>5 detail fields) with Descriptions
  · "생성/추가/등록" actions: open Form Modal with PRD fields, submit → close + add to list + message.success
  · "수정/편집" actions: open same Form Modal pre-filled, submit → update list + message.success
  · "삭제" actions: Popconfirm or Modal.confirm → remove from list
  · Cross-screen navigation: call navigate('targetId')
- Use useState for: list data, modal/drawer open state, selected item, form visibility
- Primary action button: type="primary", top-right of content area
- Exact PRD field/column names — do not rename
- Do NOT add columns/fields not in spec

## ux_hints rendering rules
When the screen spec includes ux_hints, implement each hint with the appropriate Ant Design component:

- "dropzone:" → <Upload.Dragger> with drag-and-drop area; accept=".xlsx,.csv" or as described
- "timepicker:" → <DatePicker showTime format="YYYY-MM-DD HH:mm"> for time-precision input
- "calendar:" → resource × date grid table with colored <Tag> or div bars; use useState for selected date range
- "timeline:" → <Timeline> or <Table> with columns [수정자, 수정일시, 변경항목] placed at bottom of screen; use realistic mock history rows
- "filter_chip:" → <Space> with <Tag> chips toggling via useState (checked: color="blue", unchecked: default)
- "preview:" → Card grid of small thumbnail placeholders with segment labels (e.g. 여성 20대, 남성 30대)
- "stats:" → <Row> of <Col><Statistic> cards; include a comparison value with <Badge> or colored text
- "conditional:" → useState for condition selector (e.g. <Radio.Group>); use conditional rendering {value === 'A' && <Form.Item>} to show/hide field groups
- "validation:" → <Input> with onChange validation; show <Alert type="error" message="..."> below on invalid; use useState for error state
- "permission:" → disabled <Button> or <Form.Item> with <Tooltip title="권한이 없습니다"> wrapping restricted element
- "guard:" → <Popconfirm> or Modal.confirm before the action; title = warning message from hint
- "copy_flow:" → "복제 후 수정" <Button> that clones selected item into edit modal pre-filled via useState
- "notification:" → <List> of event types each with <Switch> for subscribe/unsubscribe; use useState for subscription state
- Do NOT add utility buttons not in spec (새로고침, 내보내기, 인쇄 etc.)
- Normal flow only — no empty/loading/error state screens`

// ============================================================================
// CODE UTILITIES
// ============================================================================

function extractCode(output: string): string | null {
  const fenceMatches = Array.from(output.matchAll(/```(?:jsx?|tsx?)?\n([\s\S]*?)```/g))
  if (fenceMatches.length > 0) {
    const longest = fenceMatches.reduce((a, b) => (a[1].length >= b[1].length ? a : b))
    return longest[1].trim()
  }
  const lines = output.split('\n')
  const startIdx = lines.findIndex(l => /^function\s+Screen_/.test(l.trim()))
  if (startIdx !== -1) return lines.slice(startIdx).join('\n').trim()
  return null
}

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

function validateJsx(code: string): { message: string; line?: number } | null {
  try {
    babelParse(code, { sourceType: 'module', plugins: ['jsx'], errorRecovery: false })
    return null
  } catch (err) {
    const e = err as Error & { loc?: { line: number; column: number } }
    return { message: e.message, line: e.loc?.line }
  }
}

// ============================================================================
// API HELPERS
// ============================================================================

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.anthropic_api_key
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY 환경변수가 없습니다')
  return new Anthropic({ apiKey })
}

function getModel(): string {
  return process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'
}

// 화면 생성에는 빠른 모델 사용 (Hobby 플랜 60초 제한 대응)
function getScreenModel(): string {
  return process.env.ANTHROPIC_SCREEN_MODEL ?? 'claude-haiku-4-5-20251001'
}

const MAX_SCREENS = 6 // 화면 수 상한 (60초 제한 대응)

function extractText(content: Anthropic.Messages.Message['content']): string {
  return content.map(b => (b.type === 'text' ? b.text : '')).join('').trim()
}

// Regular call — no cache
async function callClaude(
  anthropic: Anthropic,
  params: Omit<Anthropic.Messages.MessageCreateParams, 'model' | 'stream'>,
): Promise<Anthropic.Messages.Message> {
  return anthropic.messages.create({
    ...params,
    model: getModel(),
    stream: false,
  }) as Promise<Anthropic.Messages.Message>
}

// Cached call — system prompt cached for 5 min (prompt-caching beta)
async function callClaudeCached(
  anthropic: Anthropic,
  params: Omit<Anthropic.Messages.MessageCreateParams, 'model' | 'stream'>,
): Promise<Anthropic.Messages.Message> {
  const result = await anthropic.beta.messages.create({
    ...params,
    model: getModel(),
    stream: false,
    betas: ['output-128k-2025-02-19', 'prompt-caching-2024-07-31'],
  })
  return result as unknown as Anthropic.Messages.Message
}

// ============================================================================
// STEP 1: SPEC EXTRACTION
// ============================================================================

async function extractSpec(
  anthropic: Anthropic,
  prdText: string,
  analysisText: string,
): Promise<MockupSpec> {
  let directivesHint = ''
  try {
    const analysis = JSON.parse(analysisText)
    if (analysis?.mockup_directives) {
      directivesHint = `\n\nAnalysis mockup_directives:\n${JSON.stringify(analysis.mockup_directives, null, 2)}`
    }
  } catch { /* ignore — non-JSON analysisText */ }

  const result = await callClaudeCached(anthropic, {
    max_tokens: 6000,
    temperature: 0.1,
    system: [
      { type: 'text', text: SPEC_EXTRACTION_SYSTEM, cache_control: { type: 'ephemeral' } },
    ] as unknown as Anthropic.Messages.MessageCreateParams['system'],
    messages: [{
      role: 'user',
      content: `PRD:\n${prdText}${directivesHint}\n\nExtract the structured spec JSON.`,
    }],
  })

  const text = extractText(result.content)
  console.log(`[mockup v3] extractSpec stop_reason=${result.stop_reason} chars=${text.length} preview: ${text.slice(0, 200)}`)

  if (result.stop_reason === 'max_tokens') {
    throw new Error('Spec extraction hit max_tokens — JSON truncated')
  }

  // Robust JSON extraction: find outermost { ... }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in spec extraction response. Got: ${text.slice(0, 300)}`)
  }
  return JSON.parse(text.slice(start, end + 1)) as MockupSpec
}

// ============================================================================
// STEP 1-B: FLOW EXTRACTION (dedicated small call)
// ============================================================================

const FLOW_EXTRACTION_SYSTEM = `You are a UX analyst. Given a list of screens and a PRD, generate ALL navigation flows between screens.
Return a JSON array only. No markdown, no explanation.

Output format:
[{ "from": "screen_id", "to": "screen_id", "trigger": "한국어 트리거" }]

Rules:
- Include BOTH PRD-explicit flows AND Standard Navigation Flows below
- trigger: short Korean action label (예: "행 클릭", "생성 버튼", "저장", "취소", "목록으로", "상세보기")
- Only include flows where BOTH from and to are in the given screen id list
- A list screen should have at least one outgoing flow (to detail or form)
- Every screen should appear in at least one flow (as from or to)

Standard Navigation Flows (always apply):
- list → detail/form via "행 클릭" or "상세보기"
- any screen with 생성/추가/등록 action → form screen or back to same screen via "생성 버튼"
- form → parent list via "저장" or "확인"
- detail → parent list via "목록으로" or "이전"
- any cross-screen button in PRD → add that flow`

async function extractFlows(
  anthropic: Anthropic,
  spec: MockupSpec,
  prdText: string,
): Promise<Array<{ from: string; to: string; trigger: string }>> {
  const screenList = spec.screens
    .map(s => `- ${s.id} ("${s.name}", type: ${s.type}, actions: [${s.actions.join(', ')}])`)
    .join('\n')

  const result = await callClaudeCached(anthropic, {
    max_tokens: 2000,
    temperature: 0.1,
    system: [
      { type: 'text', text: FLOW_EXTRACTION_SYSTEM, cache_control: { type: 'ephemeral' } },
    ] as unknown as Anthropic.Messages.MessageCreateParams['system'],
    messages: [{
      role: 'user',
      content: `Screens:\n${screenList}\n\nPRD (for flow context):\n${prdText.slice(0, 3000)}\n\nGenerate all flows as a JSON array.`,
    }],
  })

  const text = extractText(result.content)
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1) return []

  try {
    const flows = JSON.parse(text.slice(start, end + 1)) as Array<{ from: string; to: string; trigger: string }>
    const validIds = new Set(spec.screens.map(s => s.id))
    return flows.filter(f => validIds.has(f.from) && validIds.has(f.to) && f.from !== f.to)
  } catch {
    return []
  }
}

// ============================================================================
// STEP 2: SCREEN GENERATION (per-screen, runs in parallel)
// ============================================================================

function buildScreenUserPrompt(screen: ScreenSpec, allScreens: ScreenSpec[], type: 'lowfi' | 'hifi'): string {
  const navTargets = screen.navigates_to
    .map(id => {
      const t = allScreens.find(s => s.id === id)
      return t ? `${id} ("${t.name}")` : id
    })
    .join(', ')

  const lines: string[] = [
    `Generate the component for this screen.`,
    ``,
    `FUNCTION NAME: Screen_${screen.id}`,
    `SCREEN NAME: ${screen.name}`,
    `TYPE: ${screen.type}`,
  ]
  if (screen.columns.length > 0) lines.push(`COLUMNS (all required): ${screen.columns.join(', ')}`)
  if (screen.fields.length > 0) lines.push(`FIELDS (all required): ${screen.fields.join(', ')}`)
  if (screen.actions.length > 0) lines.push(`ACTIONS: ${screen.actions.join(', ')}`)
  if (navTargets) lines.push(`NAVIGATION TARGETS: ${navTargets}`)
  if (type === 'hifi') {
    lines.push(``, `Return ONLY: function Screen_${screen.id}({ navigate }) { ... }`)
  }
  return lines.join('\n')
}

async function generateScreen(
  anthropic: Anthropic,
  screen: ScreenSpec,
  allScreens: ScreenSpec[],
  type: 'lowfi' | 'hifi',
  systemPrompt: string,
): Promise<string | null> {
  const userPrompt = buildScreenUserPrompt(screen, allScreens, type)

  const result = await anthropic.messages.create({
    model: getScreenModel(),
    max_tokens: type === 'hifi' ? 4000 : 3000,
    temperature: type === 'hifi' ? 0.3 : 0.15,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    stream: false,
  }) as Anthropic.Messages.Message

  if (result.stop_reason === 'max_tokens') {
    console.warn(`[mockup] Screen ${screen.id} hit max_tokens`)
    return null
  }

  const output = extractText(result.content)
  const code = extractCode(output) ?? output.trim()

  if (!isCodeComplete(code)) {
    console.warn(`[mockup] Screen ${screen.id}: incomplete brackets`)
    return null
  }

  // Validate syntax in isolation (wrap with minimal shell to check)
  const wrapped = `import React, { useState } from 'react'\n${code}\nexport default function _Test() { return null }`
  const err = validateJsx(wrapped)
  if (err) {
    console.warn(`[mockup] Screen ${screen.id} syntax error: ${err.message} (line ${err.line})`)
    const repaired = await repairScreen(anthropic, code, err.message, screen.id)
    return repaired
  }

  return code
}

async function repairScreen(
  anthropic: Anthropic,
  brokenCode: string,
  errorMsg: string,
  screenId: string,
): Promise<string | null> {
  console.log(`[mockup] Repairing Screen_${screenId}...`)
  const result = await callClaude(anthropic, {
    max_tokens: 8000,
    temperature: 0.1,
    messages: [{
      role: 'user',
      content: `Fix the syntax error in this React component function.
Return ONLY the fixed function. No imports, no export, no explanation.

Error: ${errorMsg}

Code:
${brokenCode}`,
    }],
  })

  const output = extractText(result.content)
  const code = extractCode(output) ?? output.trim()
  if (!isCodeComplete(code)) return null

  const wrapped = `import React, { useState } from 'react'\n${code}\nexport default function _Test() { return null }`
  const err = validateJsx(wrapped)
  if (err) {
    console.warn(`[mockup] Screen ${screenId}: repair failed — ${err.message}`)
    return null
  }
  console.log(`[mockup] Screen ${screenId}: repair successful`)
  return code
}

// ============================================================================
// STEP 3: ASSEMBLY HELPERS (programmatic — no LLM)
// ============================================================================

function generateFlowDiagramHifi(spec: MockupSpec, codeFlows: Array<{ from: string; to: string; trigger: string }> = []): string {
  const nodeW1 = 180, nodeH1 = 60
  const nodeW2 = 160, nodeH2 = 52

  // 노드: 1depth(menu) + 2depth(parent_id 있는 screens)
  type DiagramNode = { id: string; name: string; depth: number }
  const nodes: DiagramNode[] = [
    ...spec.screens.filter(s => spec.menu_screen_ids.includes(s.id)).map(s => ({ id: s.id, name: s.name, depth: 1 })),
    ...spec.screens.filter(s => !!s.parent_id && spec.menu_screen_ids.includes(s.parent_id!)).map(s => ({ id: s.id, name: s.name, depth: 2 })),
  ]
  const diagramNodeIds = new Set(nodes.map(n => n.id))

  // 엣지: spec.flows + navigates_to + codeFlows 병합. 뒤로가기 성격 엣지 제외.
  type Edge = { from: string; to: string }
  const BACK_KEYWORDS = ['목록으로', '취소', '닫기', '뒤로', '돌아가']
  const edgeMap = new Map<string, Edge>()
  const addEdge = (f: { from: string; to: string; trigger: string }) => {
    if (f.from === f.to) return
    if (!diagramNodeIds.has(f.from) || !diagramNodeIds.has(f.to)) return
    if (BACK_KEYWORDS.some(k => f.trigger.includes(k))) return
    edgeMap.set(`${f.from}__${f.to}`, { from: f.from, to: f.to })
  }
  for (const f of spec.flows) addEdge(f)
  for (const s of spec.screens) {
    for (const targetId of (s.navigates_to ?? [])) {
      addEdge({ from: s.id, to: targetId, trigger: '이동' })
    }
  }
  for (const f of codeFlows) addEdge(f)
  const edges = Array.from(edgeMap.values())

  // 서버에서 계산 없이 노드 스타일 정의만 넘김. 위치는 클라이언트에서 dagre가 결정.
  const rfNodeDefs = nodes.map(n => ({
    id: n.id,
    data: { label: n.name },
    sourcePosition: 'right',
    targetPosition: 'left',
    style: n.depth === 1 ? {
      background: '#fff', border: '2px solid #1677ff', borderRadius: 8,
      color: '#1677ff', fontWeight: 600, fontSize: 13,
      width: nodeW1, height: nodeH1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '0 12px', cursor: 'pointer',
    } : {
      background: '#f0f5ff', border: '1.5px dashed #4096ff', borderRadius: 6,
      color: '#4096ff', fontWeight: 500, fontSize: 12,
      width: nodeW2, height: nodeH2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '0 10px', cursor: 'pointer',
    },
  }))

  const rfEdgeDefs = edges.map((e, i) => ({
    id: `e_${i}`, source: e.from, target: e.to,
    type: 'smoothstep',
    markerEnd: { type: 'arrowclosed', color: '#1677ff', width: 16, height: 16 },
    style: { stroke: '#1677ff', strokeWidth: 1.5, opacity: 0.65 },
  }))

  return `function FlowDiagram({ navigate }) {
  const rawNodes = ${JSON.stringify(rfNodeDefs)}
  const rawEdges = ${JSON.stringify(rfEdgeDefs)}
  const [flowKey, setFlowKey] = React.useState(0)

  // dagre로 레이아웃 계산 (LR 방향)
  const layoutedNodes = React.useMemo(() => {
    try {
      const g = new dagre.graphlib.Graph()
      g.setDefaultEdgeLabel(() => ({}))
      g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120, marginx: 40, marginy: 40 })
      rawNodes.forEach(n => g.setNode(n.id, { width: n.style.width, height: n.style.height }))
      rawEdges.forEach(e => g.setEdge(e.source, e.target))
      dagre.layout(g)
      return rawNodes.map(n => {
        const pos = g.node(n.id)
        return { ...n, position: { x: pos.x - n.style.width / 2, y: pos.y - n.style.height / 2 } }
      })
    } catch {
      return rawNodes.map((n, i) => ({ ...n, position: { x: (i % 3) * 280 + 40, y: Math.floor(i / 3) * 140 + 40 } }))
    }
  }, [flowKey])

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>사용자 Flow 다이어그램</Typography.Title>
        <Button size="small" onClick={() => setFlowKey(k => k + 1)}>↺ 새로고침</Button>
      </div>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>노드를 클릭하면 해당 화면으로 이동합니다.</Typography.Text>
      <div style={{ height: 520, border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden', background: '#fafafa' }}>
        <ReactFlow
          key={flowKey}
          nodes={layoutedNodes}
          edges={rawEdges}
          onNodeClick={(_, node) => navigate(node.id)}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={true}
        >
          <Controls />
          <Background color="#e8e8e8" gap={20} size={1} />
        </ReactFlow>
      </div>
    </div>
  )
}`
}

function generateFlowDiagramLofi(spec: MockupSpec): string {
  const menuScreens = spec.screens.filter(s => spec.menu_screen_ids.includes(s.id))
  return `function FlowDiagram({ navigate }) {
  const screens = ${JSON.stringify(menuScreens.map(s => ({ id: s.id, name: s.name })))}
  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#212121', marginBottom: 12 }}>화면 목록</div>
      {screens.map(s => (
        <div key={s.id} onClick={() => navigate(s.id)}
          style={{ padding: '10px 14px', background: '#fff', border: '1px solid #e0e0e0', marginBottom: 6, cursor: 'pointer', color: '#212121', fontSize: 13 }}>
          {s.name}
        </div>
      ))}
    </div>
  )
}`
}

function generateNotePanelHifi(spec: MockupSpec): string {
  const allNotes = spec.note_items ?? []
  const attention = allNotes.filter(n => n.category === 'attention')
  const missing = allNotes.filter(n => n.category === 'missing')
  const ambiguous = allNotes.filter(n => n.category === 'ambiguous')
  const omitted = allNotes.filter(n => n.category === 'omitted')

  // Also fold attention_areas into attention notes
  const attentionAreas = (spec.attention_areas ?? []).map(a => ({
    category: 'attention' as const,
    item: `${a.dimension} (점수 ${a.score}/10)`,
    reason: a.focus,
  }))
  const allAttention = [...attentionAreas, ...attention]

  return `function NotePanel() {
  const [open, setOpen] = useState(true)
  const attention = ${JSON.stringify(allAttention)}
  const missing = ${JSON.stringify(missing)}
  const ambiguous = ${JSON.stringify(ambiguous)}
  const omitted = ${JSON.stringify(omitted)}
  const hasAny = attention.length > 0 || missing.length > 0 || ambiguous.length > 0 || omitted.length > 0
  return (
    <Card size="small"
      style={{ position: 'fixed', bottom: 16, right: 16, width: 360, maxHeight: '60vh', overflow: 'auto', zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
      title={<Typography.Text strong>📋 PRD 검토 노트</Typography.Text>}
      extra={<Button type="text" size="small" onClick={() => setOpen(v => !v)}>{open ? '닫기' : '열기'}</Button>}
    >
      {open && (
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          {attention.length > 0 && (
            <Alert type="warning" showIcon banner
              message={<><b>⚠️ 주의 영역 (분석 결과)</b>{attention.map((n, i) => <div key={i} style={{ marginTop: 4 }}>{n.item} — {n.reason}</div>)}</>}
            />
          )}
          {missing.length > 0 && (<>
            <Typography.Text type="warning" strong style={{ fontSize: 12 }}>누락 가능 항목</Typography.Text>
            {missing.map((n, i) => <Alert key={i} type="warning" showIcon message={n.item} description={n.reason} style={{ marginBottom: 4 }} />)}
          </>)}
          {ambiguous.length > 0 && (<>
            <Typography.Text type="secondary" strong style={{ fontSize: 12 }}>모호한 항목</Typography.Text>
            {ambiguous.map((n, i) => <Alert key={i} type="info" showIcon message={n.item} description={n.reason} style={{ marginBottom: 4 }} />)}
          </>)}
          {omitted.length > 0 && (<>
            <Typography.Text type="danger" strong style={{ fontSize: 12 }}>미구현 항목</Typography.Text>
            {omitted.map((n, i) => <Alert key={i} type="error" showIcon message={n.item} description={n.reason} style={{ marginBottom: 4 }} />)}
          </>)}
          {!hasAny && <Empty description="PRD 검토 결과 보완 사항 없음" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
        </Space>
      )}
    </Card>
  )
}`
}

function generateNotePanelLofi(spec: MockupSpec): string {
  const allNotes = spec.note_items ?? []
  const attentionAreas = (spec.attention_areas ?? []).map(a => ({
    category: 'attention' as const,
    item: `${a.dimension} (점수 ${a.score}/10)`,
    reason: a.focus,
  }))
  const attention = [...attentionAreas, ...allNotes.filter(n => n.category === 'attention')]
  const missing = allNotes.filter(n => n.category === 'missing')
  const ambiguous = allNotes.filter(n => n.category === 'ambiguous')
  const omitted = allNotes.filter(n => n.category === 'omitted')

  return `function NotePanel() {
  const [open, setOpen] = useState(true)
  const attention = ${JSON.stringify(attention)}
  const missing = ${JSON.stringify(missing)}
  const ambiguous = ${JSON.stringify(ambiguous)}
  const omitted = ${JSON.stringify(omitted)}
  const hasAny = attention.length > 0 || missing.length > 0 || ambiguous.length > 0 || omitted.length > 0
  const sSection = { fontWeight: 600, fontSize: 11, color: '#757575', marginTop: 8, marginBottom: 4, textTransform: 'uppercase' }
  const sItem = { fontSize: 12, color: '#212121', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }
  return (
    <div style={{ position: 'fixed', bottom: 16, right: 16, width: 340, maxHeight: '60vh', overflow: 'auto', background: '#fff', border: '1px solid #e0e0e0', zIndex: 1000, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#212121' }}>📋 PRD 검토 노트</span>
        <span style={{ cursor: 'pointer', fontSize: 12, color: '#757575' }} onClick={() => setOpen(v => !v)}>{open ? '닫기' : '열기'}</span>
      </div>
      {open && <>
        {attention.length > 0 && <>
          <div style={{ ...sSection, borderLeft: '3px solid #757575', paddingLeft: 6 }}>⚠️ 주의 영역 (분석 결과)</div>
          {attention.map((n, i) => <div key={i} style={sItem}>{n.item} — {n.reason}</div>)}
        </>}
        {missing.length > 0 && <>
          <div style={sSection}>누락 가능 항목</div>
          {missing.map((n, i) => <div key={i} style={sItem}>{n.item} — {n.reason}</div>)}
        </>}
        {ambiguous.length > 0 && <>
          <div style={sSection}>모호한 항목</div>
          {ambiguous.map((n, i) => <div key={i} style={sItem}>{n.item} — {n.reason}</div>)}
        </>}
        {omitted.length > 0 && <>
          <div style={sSection}>미구현 항목</div>
          {omitted.map((n, i) => <div key={i} style={sItem}>{n.item} — {n.reason}</div>)}
        </>}
        {!hasAny && <div style={{ fontSize: 12, color: '#757575' }}>PRD 검토 결과 보완 사항 없음</div>}
      </>}
    </div>
  )
}`
}

// ============================================================================
// STEP 3: FINAL ASSEMBLY
// ============================================================================

function assembleLofiApp(screenCodes: Map<string, string>, spec: MockupSpec): string {
  const menuScreens = spec.screens.filter(s => spec.menu_screen_ids.includes(s.id))
  const firstScreen = spec.critical_screen_ids[0] ?? spec.menu_screen_ids[0] ?? spec.screens[0]?.id ?? 'flow'

  const menuItems = menuScreens
    .map(s => `  { id: '${s.id}', label: '${s.name.replace(/'/g, "\\'")}' }`)
    .join(',\n')

  const screenFunctions = spec.screens
    .filter(s => screenCodes.has(s.id))
    .map(s => screenCodes.get(s.id)!)
    .join('\n\n')

  const screenRenders = spec.screens
    .filter(s => screenCodes.has(s.id))
    .map(s => `        {page === '${s.id}' && <Screen_${s.id} navigate={setPage} />}`)
    .join('\n')

  return `import React, { useState } from 'react'

${generateFlowDiagramLofi(spec)}

${screenFunctions}

${generateNotePanelLofi(spec)}

const MENU_ITEMS = [
  { id: 'flow', label: '🗺 화면 목록' },
${menuItems}
]

export default function App() {
  const [page, setPage] = useState('${firstScreen}')
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5', fontFamily: '-apple-system, sans-serif', fontSize: 13 }}>
      <div style={{ width: 200, minWidth: 200, background: '#fff', borderRight: '1px solid #e0e0e0', padding: '16px 0', flexShrink: 0 }}>
        <div style={{ padding: '0 16px 10px', fontSize: 11, color: '#bdbdbd', fontWeight: 600, letterSpacing: 1 }}>메뉴</div>
        {MENU_ITEMS.map(item => (
          <div key={item.id} onClick={() => setPage(item.id)}
            style={{ padding: '9px 16px', cursor: 'pointer', background: page === item.id ? '#f0f0f0' : 'transparent', color: page === item.id ? '#212121' : '#757575', fontWeight: page === item.id ? 600 : 400, borderLeft: page === item.id ? '3px solid #212121' : '3px solid transparent' }}>
            {item.label}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {page === 'flow' && <FlowDiagram navigate={setPage} />}
${screenRenders}
      </div>
      <NotePanel />
    </div>
  )
}`
}

function assembleHifiApp(screenCodes: Map<string, string>, spec: MockupSpec): string {
  // Critical screens first in menu
  const menuScreens = spec.screens
    .filter(s => spec.menu_screen_ids.includes(s.id))
    .sort((a, b) => {
      const ai = spec.critical_screen_ids.indexOf(a.id)
      const bi = spec.critical_screen_ids.indexOf(b.id)
      if (ai >= 0 && bi < 0) return -1
      if (bi >= 0 && ai < 0) return 1
      return 0
    })

  const firstScreen = spec.critical_screen_ids[0] ?? spec.menu_screen_ids[0] ?? spec.screens[0]?.id ?? 'flow'

  // 2depth: parent_id가 있는 screens를 부모별로 그룹화
  const subsByParent = new Map<string, ScreenSpec[]>()
  for (const screen of spec.screens) {
    if (!screen.parent_id) continue
    if (!subsByParent.has(screen.parent_id)) subsByParent.set(screen.parent_id, [])
    subsByParent.get(screen.parent_id)!.push(screen)
  }

  const menuItems = menuScreens.map(s => {
    const subs = subsByParent.get(s.id) ?? []
    const label = s.name.replace(/'/g, "\\'")
    if (subs.length === 0) {
      return `  { key: '${s.id}', label: '${label}' }`
    }
    const children = subs
      .map(sub => `    { key: '${sub.id}', label: '${sub.name.replace(/'/g, "\\'")}' }`)
      .join(',\n')
    return `  { key: '${s.id}', label: '${label}', children: [\n${children}\n  ] }`
  }).join(',\n')

  const screenFunctions = spec.screens
    .filter(s => screenCodes.has(s.id))
    .map(s => screenCodes.get(s.id)!)
    .join('\n\n')

  const screenRenders = spec.screens
    .filter(s => screenCodes.has(s.id))
    .map(s => `            {page === '${s.id}' && <Screen_${s.id} navigate={setPage} />}`)
    .join('\n')

  // 실제 생성된 prototype 코드에서 navigate('id') 호출을 파싱해 flow 추출 (1/2depth 모두)
  const codeFlows: Array<{ from: string; to: string; trigger: string }> = []
  for (const screen of spec.screens) {
    if (!spec.menu_screen_ids.includes(screen.id) && !screen.parent_id) continue
    const code = screenCodes.get(screen.id)
    if (!code) continue
    const re = /navigate\(['"]([^'"]+)['"]\)/g
    const seen = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = re.exec(code)) !== null) {
      const targetId = m[1]
      if (targetId === screen.id || seen.has(targetId)) continue
      seen.add(targetId)
      // 해당 navigate 호출 앞 100자에서 한글 버튼 레이블 추출 시도
      const ctx = code.slice(Math.max(0, m.index - 120), m.index)
      const labelMatch = ctx.match(/['"]([가-힣][가-힣\w\s]{1,10})['"]\s*[^{]*$/)
      codeFlows.push({ from: screen.id, to: targetId, trigger: labelMatch ? labelMatch[1] : '이동' })
    }
  }

  return `import React, { useState, useEffect } from 'react'
import ReactFlow, { Controls, Background } from 'reactflow'
import 'reactflow/dist/style.css'
import * as dagre from 'dagre'
import { Layout, Menu, Table, Form, Input, Button, Modal, Drawer, Select, DatePicker, Typography, Space, Tag, Descriptions, message, Empty, Alert, Card, Tabs, InputNumber, Radio, Checkbox, Switch, Badge, Divider, Tooltip, Popconfirm, Row, Col, Statistic, Upload, ConfigProvider } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons'

${generateFlowDiagramHifi(spec, codeFlows)}

${screenFunctions}

${generateNotePanelHifi(spec)}

const MENU_ITEMS = [
  { key: 'flow', label: '📊 사용자 flow 보기' },
${menuItems}
]

export default function App() {
  const [page, setPage] = useState('${firstScreen}')
  return (
    <ConfigProvider>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Sider width={220} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #f0f0f0' }}>
            <Typography.Text strong style={{ fontSize: 14 }}>Preflight</Typography.Text>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[page]}
            onClick={({ key }) => setPage(key)}
            style={{ borderRight: 0, marginTop: 4 }}
            items={MENU_ITEMS}
          />
        </Layout.Sider>
        <Layout>
          <Layout.Content style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
            {page === 'flow' && <FlowDiagram navigate={setPage} />}
${screenRenders}
          </Layout.Content>
        </Layout>
        <NotePanel />
      </Layout>
    </ConfigProvider>
  )
}`
}

// ============================================================================
// POST HANDLER
// ============================================================================

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

    // Step 1: Extract spec (small, fast, sequential)
    console.log(`[mockup v3] type=${type} — Step 1: extracting spec`)
    let spec: MockupSpec
    try {
      spec = await extractSpec(anthropic, prdText, analysisText)
    } catch (err) {
      console.error('[mockup v3] Spec extraction failed:', err)
      return Response.json({ error: 'PRD 구조 추출에 실패했습니다. 다시 시도해주세요.' }, { status: 500 })
    }
    // 화면 수 상한 적용 (60초 제한 대응): 메뉴 화면 우선, 나머지 순서대로
    if (spec.screens.length > MAX_SCREENS) {
      const menuIds = new Set(spec.menu_screen_ids)
      const menuScreens = spec.screens.filter(s => menuIds.has(s.id))
      const subScreens = spec.screens.filter(s => !menuIds.has(s.id))
      spec.screens = [...menuScreens, ...subScreens].slice(0, MAX_SCREENS)
      console.log(`[mockup v3] Capped screens to ${MAX_SCREENS}`)
    }

    console.log(`[mockup v3] Spec: ${spec.screens.length} screens, ${spec.menu_screen_ids.length} in menu`)

    if (spec.screens.length === 0) {
      return Response.json({ error: 'PRD에서 화면을 추출하지 못했습니다.' }, { status: 500 })
    }

    // Step 2: 화면 생성 + flows 추출 병렬 실행
    console.log(`[mockup v3] Step 2: generating ${spec.screens.length} screens + flows in parallel`)
    const systemPrompt = type === 'hifi' ? HIFI_SYSTEM : LOFI_SYSTEM

    const [results, extractedFlows] = await Promise.all([
      Promise.all(
        spec.screens.map(async screen => {
          try {
            return await generateScreen(anthropic, screen, spec.screens, type, systemPrompt)
          } catch (e) {
            console.warn(`[mockup v3] Screen "${screen.name}" threw:`, e)
            return null
          }
        })
      ),
      extractFlows(anthropic, spec, prdText).catch(e => {
        console.warn('[mockup v3] Flow extraction failed:', e)
        return [] as Array<{ from: string; to: string; trigger: string }>
      }),
    ])

    // spec.flows를 extractedFlows로 보강 (중복 제거)
    const existingKeys = new Set(spec.flows.map(f => `${f.from}__${f.to}`))
    for (const f of extractedFlows) {
      const key = `${f.from}__${f.to}`
      if (!existingKeys.has(key)) {
        spec.flows.push(f)
        existingKeys.add(key)
      }
    }
    console.log(`[mockup v3] Flows: ${spec.flows.length} total`)

    const screenCodes = new Map<string, string>()
    spec.screens.forEach((screen, i) => {
      const code = results[i]
      if (code) {
        screenCodes.set(screen.id, code)
      } else {
        console.warn(`[mockup v3] Screen "${screen.name}" (${screen.id}) failed — skipping`)
      }
    })

    if (screenCodes.size === 0) {
      return Response.json({ error: '화면 생성에 모두 실패했습니다. 다시 시도해주세요.' }, { status: 500 })
    }

    // Step 3: Assemble
    console.log(`[mockup v3] Step 3: assembling (${screenCodes.size}/${spec.screens.length} screens)`)
    const appCode = type === 'hifi'
      ? assembleHifiApp(screenCodes, spec)
      : assembleLofiApp(screenCodes, spec)

    // Final validation
    const finalError = validateJsx(appCode)
    if (finalError) {
      console.error('[mockup v3] Assembly validation error:', finalError.message, `line ${finalError.line}`)
      return Response.json({
        error: '목업 조립 후 구문 오류가 발생했습니다. 다시 시도해주세요.',
        detail: finalError.message,
      }, { status: 500 })
    }

    console.log(`[mockup v3] Done ✓ type=${type} screens=${screenCodes.size}/${spec.screens.length}`)
    return Response.json({ files: { '/App.js': appCode } })

  } catch (error) {
    console.error('[mockup v3] 오류:', error)
    if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
      return Response.json({ error: 'API 키가 필요합니다.' }, { status: 500 })
    }
    return Response.json({ error: '목업 생성 중 오류가 발생했습니다' }, { status: 500 })
  }
}
