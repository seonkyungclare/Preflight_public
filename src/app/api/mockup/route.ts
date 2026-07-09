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
  critical_screen_ids: string[]
  attention_areas: Array<{ dimension: string; score: number; focus: string }>
  note_items: NoteItem[]
}

interface RequestBody {
  prdText: string
  analysisText: string
  type: 'lowfi' | 'hifi'
  // 앞서 생성한 spec을 재사용하면 Lo-Fi/Hi-Fi가 동일 화면 집합을 공유한다.
  existingSpec?: MockupSpec
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
      "parent_id": "parent_screen_id_or_omit_if_top_level"
    }
  ],
  "menu_screen_ids": ["id"],
  "flows": [{ "from": "id", "to": "id", "trigger": "트리거" }],
  "critical_screen_ids": [],
  "attention_areas": [{ "dimension": "차원명", "score": 5, "focus": "구체적 약점" }],
  "note_items": [
    { "category": "missing|ambiguous|omitted", "item": "항목명", "reason": "이유" }
  ]
}

Rules:
- menu_screen_ids: TOP-LEVEL navigation only (main menu items, max 1-depth)
- columns: ALL PRD-defined table columns (list type) — do not omit any
- fields: ALL PRD-defined form/detail fields — do not omit any
- actions: ALL PRD-defined buttons/actions for this screen
- navigates_to: screen ids reachable from this screen — derive from PRD AND Standard Navigation Flows below
- critical_screen_ids, attention_areas: derive from analysis.mockup_directives
- note_items: PRD 갭만 (missing/ambiguous/omitted). 주의영역(attention)은 attention_areas가 담당하므로 note_items에 중복 기재하지 말 것

## Menu / Information Architecture (메뉴 구조 우선 채택)
PRD가 명시적으로 정의한 메뉴 구조를 IA의 최우선 근거로 삼는다. 메뉴 도식이 이미지/다이어그램으로만 존재해 텍스트가 없더라도, 아래 텍스트 단서에서 IA를 복원한다:
- **진입 경로(breadcrumb)**: "A > B > C > 화면명" 형태의 경로. 마지막 항목이 화면, 그 앞 경로가 상위 메뉴 계층이다.
  - 예: "Bizest > 파트너 > 성장솔루션 관리 > 디스플레이 광고 관리" → "디스플레이 광고 관리"를 1st-level 메뉴 화면으로, 같은 상위 경로를 공유하는 화면들을 형제 메뉴로 묶는다.
- **섹션 제목/목차**: 기능 요구사항 섹션 제목(예: "디스플레이 광고 관리", "인벤토리 관리", "검수 관리")도 메뉴 후보다.
- 여러 진입 경로가 같은 상위(예: "성장솔루션 관리")를 공유하면 그 하위 항목들을 menu_screen_ids로 채택한다.

## User Stories (유저스토리 → 화면·액션·권한 도출)
PRD에 "유저스토리"(액터/시스템 동작 표 포함)가 있으면 화면 설계의 핵심 근거로 삼는다:
- 유저스토리의 **액터·진입 경로**로 화면과 접근 권한을 결정한다.
- 각 스토리 문장("~할 수 있다", "~조회한다")에서 **화면 동작을 actions로, 조회 대상 데이터를 columns/fields로** 도출한다.
- "시스템 동작"(예: 권한 없음 시 403, 생성·수정 불가) 같은 제약은 해당 화면의 actions/note_items에 반영한다.
- 표가 다소 흐트러져 있어도 행 번호(1, 2, 3…)를 기준으로 개별 스토리를 구분해 해석한다.

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
- form screen → parent list screen after submit (trigger: "저장")
- detail screen → parent list screen (trigger: "목록으로")
- any screen → any screen explicitly linked in PRD (trigger: PRD's exact wording)

## flows population rules
- Include ALL navigations: PRD-explicit + Standard Navigation Flows derived above
- navigates_to/flows는 **실제 관계가 있는 화면만** 연결한다: 같은 도메인의 목록↔상세, 부모↔자식(parent_id), PRD에 명시된 링크. 관계가 불명확하면 연결하지 말 것(엉뚱한 화면 연결 방지).
- Every menu screen should appear in at least one flow (as from or to)
- trigger: 아래 표준 어휘만 사용 — 정방향은 "행 클릭" | "생성 버튼" | "저장", 뒤로가기는 "목록으로" | "취소"
  (뒤로가기 trigger는 다이어그램에서 역방향 엣지로 필터되므로 반드시 "목록으로"/"취소"로 표기)`

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
- Do NOT add elements not in the screen spec`

const HIFI_SYSTEM = `You generate high-fidelity Ant Design React component functions for interactive prototypes.

Output format (STRICT):
- Generate ONLY: function Screen_XXX({ navigate }) { ... }
- No imports. No export. No other functions or code outside the one function.

Code style (COMPACT — token budget is limited):
- No comments, no JSDoc, no blank lines between JSX elements
- Mock data arrays: maximum 3 items
- Do not repeat similar JSX blocks — use .map() instead
- Keep variable names short but readable (e.g. open not isModalVisible)

Pre-imported (DO NOT re-import):
- React, useState (from 'react')
- antd: Layout, Menu, Table, Form, Input, Button, Modal, Drawer, Select, DatePicker, Typography, Space, Tag, Descriptions, message, Empty, Alert, Card, Tabs, InputNumber, Radio, Checkbox, Switch, Badge, Divider, Tooltip, Popconfirm, Row, Col, Statistic, Upload, ConfigProvider
- @ant-design/icons: PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined, DownloadOutlined

Rules:
- All text Korean
- Realistic Korean placeholder data: brand/product names, dates "2026-04-15", amounts "₩2,400,000", mixed PRD-defined statuses
- List type: Table with 3 rows, ALL columns filled, no empty cells
- Full interactivity — NO dead ends:
  · Table rows: onClick → open Modal (≤5 detail fields) or Drawer (>5 detail fields) with Descriptions
  · "생성/추가/등록" actions: open Form Modal with PRD fields, submit → close + add to list + message.success
  · "수정/편집" actions: open same Form Modal pre-filled, submit → update list + message.success
  · "삭제" actions: Popconfirm or Modal.confirm → remove from list
  · Cross-screen navigation: call navigate('targetId') — 반드시 프롬프트의 NAVIGATION TARGETS에 나열된 정확한 id로만. 목록에 없으면 다른 화면으로 이동시키지 말 것(임의 id 생성 금지).
- Use useState for: list data, modal/drawer open state, selected item, form visibility
- Primary action button: type="primary", top-right of content area
- Exact PRD field/column names — do not rename
- Do NOT add columns/fields not in spec

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

function getScreenModel(): string {
  return process.env.ANTHROPIC_SCREEN_MODEL ?? getModel()
}

// 화면 수 상한(화면은 병렬 생성되므로 벽시계 시간은 화면 수에 크게 비례하지 않음).
// 실행시간·토큰·동시호출 한도 안전장치. env MOCKUP_MAX_SCREENS로 조정 가능.
const MAX_SCREENS = Number(process.env.MOCKUP_MAX_SCREENS) || 12

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
    max_tokens: 12000,
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
// STEP 2: SCREEN GENERATION (per-screen, runs in parallel)
// ----------------------------------------------------------------------------
// flow는 별도 LLM 호출 없이 spec.flows(추출 단계 산출) + 각 화면의 navigates_to +
// 생성된 코드의 navigate() 파싱(codeFlows)만으로 구성한다 → LLM 호출 1회 절약.
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
  // navigate()는 여기 나열된 id로만 허용한다. 목록에 없으면 화면 간 이동을 만들지 않는다(엉뚱한 연결 방지).
  lines.push(
    navTargets
      ? `NAVIGATION TARGETS (navigate() ONLY to these exact ids; never invent or guess another id): ${navTargets}`
      : `NAVIGATION TARGETS: (none — do NOT call navigate() to any other screen)`,
  )
  if (type === 'hifi') {
    lines.push(``, `Return ONLY: function Screen_${screen.id}({ navigate }) { ... }`)
  }
  return lines.join('\n')
}

// 화면 1개당 출력 상한. antd 화면은 코드가 길어 넉넉히 잡는다(8192 초과이므로 output-128k 베타 필요).
const SCREEN_MAX_TOKENS = 9000

async function generateScreen(
  anthropic: Anthropic,
  screen: ScreenSpec,
  allScreens: ScreenSpec[],
  type: 'lowfi' | 'hifi',
  systemPrompt: string,
): Promise<string | null> {
  const userPrompt = buildScreenUserPrompt(screen, allScreens, type)
  // Hi-Fi는 antd라 코드가 길어 넉넉히, Lo-Fi는 단순해 기존 상한 유지.
  const maxTokens = type === 'hifi' ? SCREEN_MAX_TOKENS : 4000
  const temperature = type === 'hifi' ? 0.3 : 0.15

  // 첫 시도가 실패(max_tokens 잘림·괄호 불완전·repair 실패)하면 1회 재시도해 화면 drop을 최소화한다.
  // 모든 화면이 같은 systemPrompt를 쓰므로 prompt-caching으로 반복 입력 토큰 절약.
  for (let attempt = 0; attempt < 2; attempt++) {
    const attemptPrompt =
      attempt === 0
        ? userPrompt
        : `${userPrompt}\n\n(RETRY: 직전 응답이 너무 길어 잘렸습니다. mock 데이터와 JSX를 더 압축해, 반드시 완결된 하나의 함수로 반환하세요.)`

    const result = (await anthropic.beta.messages.create({
      model: getScreenModel(),
      max_tokens: maxTokens,
      temperature,
      system: [
        { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
      ] as unknown as Anthropic.Messages.MessageCreateParams['system'],
      messages: [{ role: 'user', content: attemptPrompt }],
      stream: false,
      betas: ['output-128k-2025-02-19', 'prompt-caching-2024-07-31'],
    })) as unknown as Anthropic.Messages.Message

    if (result.stop_reason === 'max_tokens') {
      console.warn(`[mockup] Screen ${screen.id} hit max_tokens (attempt ${attempt + 1})`)
      continue
    }

    const output = extractText(result.content)
    const code = extractCode(output) ?? output.trim()

    if (!isCodeComplete(code)) {
      console.warn(`[mockup] Screen ${screen.id}: incomplete brackets (attempt ${attempt + 1})`)
      continue
    }

    // Validate syntax in isolation (wrap with minimal shell to check)
    const wrapped = `import React, { useState } from 'react'\n${code}\nexport default function _Test() { return null }`
    const err = validateJsx(wrapped)
    if (err) {
      console.warn(`[mockup] Screen ${screen.id} syntax error: ${err.message} (line ${err.line})`)
      const repaired = await repairScreen(anthropic, code, err.message, screen.id)
      if (repaired) return repaired
      continue
    }

    return code
  }

  console.warn(`[mockup] Screen ${screen.id}: 2회 시도 모두 실패 — drop`)
  return null
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

function generateFlowDiagramHifi(spec: MockupSpec, codeFlows: Array<{ from: string; to: string; trigger: string }> = [], codedIds: Set<string> = new Set()): string {
  const nodeW1 = 180, nodeH1 = 60
  const nodeW2 = 160, nodeH2 = 52

  // 노드: 1depth(menu) + 2depth(parent_id 있는 screens). 코드가 실제 생성된 화면만 노드로 노출(클릭 시 빈 화면 방지).
  type DiagramNode = { id: string; name: string; depth: number }
  const nodes: DiagramNode[] = [
    ...spec.screens.filter(s => codedIds.has(s.id) && spec.menu_screen_ids.includes(s.id)).map(s => ({ id: s.id, name: s.name, depth: 1 })),
    ...spec.screens.filter(s => codedIds.has(s.id) && !!s.parent_id && spec.menu_screen_ids.includes(s.parent_id!)).map(s => ({ id: s.id, name: s.name, depth: 2 })),
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

function generateFlowDiagramLofi(spec: MockupSpec, codedIds: Set<string> = new Set()): string {
  const menuScreens = spec.screens.filter(s => codedIds.has(s.id) && spec.menu_screen_ids.includes(s.id))
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

// 첫 화면을 "실제 코드가 생성된 화면 id"로 확정한다.
// critical_screen_ids는 analyze에서 온 "화면명"일 수 있으므로 name→id 매핑도 시도.
// 매칭되는 게 없으면 flow 다이어그램('flow')으로 폴백해 빈 화면을 방지한다.
function pickFirstScreen(spec: MockupSpec, codedIds: Set<string>): string {
  const nameToId = new Map(spec.screens.map(s => [s.name, s.id]))
  const resolve = (v: string): string | null => {
    if (codedIds.has(v)) return v
    const mapped = nameToId.get(v)
    return mapped && codedIds.has(mapped) ? mapped : null
  }

  // 1) user flow의 진입점 우선: 들어오는 엣지가 없는 화면(source). 목록 화면 등 흐름의 시작점이 첫 화면이 되도록.
  const incoming = new Set<string>()
  for (const f of spec.flows ?? []) incoming.add(f.to)
  for (const s of spec.screens) for (const t of s.navigates_to ?? []) incoming.add(t)
  const sources = spec.screens.filter(s => codedIds.has(s.id) && !incoming.has(s.id))
  if (sources.length > 0) {
    const menuSet = new Set(spec.menu_screen_ids ?? [])
    return (sources.find(s => menuSet.has(s.id)) ?? sources[0]).id
  }

  // 2) critical → menu → 아무 생성 화면 → flow 폴백
  for (const c of spec.critical_screen_ids ?? []) {
    const id = resolve(c)
    if (id) return id
  }
  for (const mid of spec.menu_screen_ids ?? []) {
    if (codedIds.has(mid)) return mid
  }
  return spec.screens.find(s => codedIds.has(s.id))?.id ?? 'flow'
}

function assembleLofiApp(screenCodes: Map<string, string>, spec: MockupSpec): string {
  const codedIds = new Set(screenCodes.keys())
  const has = (id: string) => screenCodes.has(id)
  const menuScreens = spec.screens.filter(s => spec.menu_screen_ids.includes(s.id))

  // 2-depth(parent_id 있는 화면: 상세/생성폼/수정폼 등)를 부모별로 그룹화 — Hi-Fi와 동일 규칙
  const subsByParent = new Map<string, ScreenSpec[]>()
  for (const s of spec.screens) {
    if (!s.parent_id) continue
    if (!subsByParent.has(s.parent_id)) subsByParent.set(s.parent_id, [])
    subsByParent.get(s.parent_id)!.push(s)
  }

  // LNB 항목: 1-depth 메뉴 바로 아래에 그 하위 2-depth를 들여쓰기(depth)로 배치.
  // 코드가 실제로 생성된 화면만 진입점으로 노출해 죽은 링크를 방지한다.
  type MenuEntry = { id: string; label: string; depth: 1 | 2 }
  const menuEntries: MenuEntry[] = []
  for (const s of menuScreens) {
    if (has(s.id)) menuEntries.push({ id: s.id, label: s.name, depth: 1 })
    for (const sub of subsByParent.get(s.id) ?? []) {
      if (has(sub.id)) menuEntries.push({ id: sub.id, label: sub.name, depth: 2 })
    }
  }
  // 어느 메뉴에도 걸리지 않은 화면(부모가 메뉴가 아니거나 고아)도 디자이너가 만들 대표 화면이므로 진입점 보장
  const covered = new Set(menuEntries.map(e => e.id))
  for (const s of spec.screens) {
    if (has(s.id) && !covered.has(s.id)) {
      menuEntries.push({ id: s.id, label: s.name, depth: s.parent_id ? 2 : 1 })
      covered.add(s.id)
    }
  }

  const firstScreen = pickFirstScreen(spec, codedIds)
  const renderedIds = spec.screens.filter(s => has(s.id)).map(s => s.id)

  const menuItems = menuEntries
    .map(e => `  { id: '${e.id}', label: '${e.label.replace(/'/g, "\\'")}', depth: ${e.depth} }`)
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

${generateFlowDiagramLofi(spec, codedIds)}

${screenFunctions}

${generateNotePanelLofi(spec)}

class ScreenErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidUpdate(prev) { if (prev.pageKey !== this.props.pageKey && this.state.err) this.setState({ err: null }) }
  render() {
    if (this.state.err) {
      const msg = this.state.err && this.state.err.message ? this.state.err.message : String(this.state.err)
      return (
        <div style={{ padding: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#c00', marginBottom: 8 }}>이 화면을 표시하는 중 오류가 발생했습니다</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12, whiteSpace: 'pre-wrap' }}>{msg}</div>
          <button onClick={this.props.onReset} style={{ padding: '6px 12px', border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer' }}>← 처음으로</button>
        </div>
      )
    }
    return this.props.children
  }
}

const MENU_ITEMS = [
  { id: 'flow', label: '🗺 화면 목록', depth: 1 },
${menuItems}
]
const RENDERED_IDS = ${JSON.stringify(renderedIds)}

export default function App() {
  const [page, setPage] = useState('${firstScreen}')
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5', fontFamily: '-apple-system, sans-serif', fontSize: 13 }}>
      <div style={{ width: 200, minWidth: 200, background: '#fff', borderRight: '1px solid #e0e0e0', padding: '16px 0', flexShrink: 0 }}>
        <div style={{ padding: '0 16px 10px', fontSize: 11, color: '#bdbdbd', fontWeight: 600, letterSpacing: 1 }}>메뉴</div>
        {MENU_ITEMS.map(item => (
          <div key={item.id} onClick={() => setPage(item.id)}
            style={{ padding: '9px 16px', paddingLeft: item.depth === 2 ? 32 : 16, cursor: 'pointer', background: page === item.id ? '#f0f0f0' : 'transparent', color: page === item.id ? '#212121' : '#757575', fontWeight: page === item.id ? 600 : (item.depth === 2 ? 400 : 500), fontSize: item.depth === 2 ? 12 : 13, borderLeft: page === item.id ? '3px solid #212121' : '3px solid transparent' }}>
            {item.depth === 2 ? '└ ' : ''}{item.label}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <ScreenErrorBoundary pageKey={page} onReset={() => setPage('flow')}>
        {page === 'flow' && <FlowDiagram navigate={setPage} />}
${screenRenders}
        {page !== 'flow' && !RENDERED_IDS.includes(page) && <FlowDiagram navigate={setPage} />}
        </ScreenErrorBoundary>
      </div>
      <NotePanel />
    </div>
  )
}`
}

function assembleHifiApp(screenCodes: Map<string, string>, spec: MockupSpec): string {
  const codedIds = new Set(screenCodes.keys())

  // Critical screens first in menu. 코드가 생성된 화면만 메뉴에 노출(죽은 링크 방지).
  const menuScreens = spec.screens
    .filter(s => codedIds.has(s.id) && spec.menu_screen_ids.includes(s.id))
    .sort((a, b) => {
      const ai = spec.critical_screen_ids.indexOf(a.id)
      const bi = spec.critical_screen_ids.indexOf(b.id)
      if (ai >= 0 && bi < 0) return -1
      if (bi >= 0 && ai < 0) return 1
      return 0
    })

  const firstScreen = pickFirstScreen(spec, codedIds)
  const renderedIds = spec.screens.filter(s => codedIds.has(s.id)).map(s => s.id)

  // 2depth: parent_id가 있고 코드가 생성된 screens를 부모별로 그룹화
  const subsByParent = new Map<string, ScreenSpec[]>()
  for (const screen of spec.screens) {
    if (!screen.parent_id || !codedIds.has(screen.id)) continue
    if (!subsByParent.has(screen.parent_id)) subsByParent.set(screen.parent_id, [])
    subsByParent.get(screen.parent_id)!.push(screen)
  }

  const menuItemArr = menuScreens.map(s => {
    const subs = subsByParent.get(s.id) ?? []
    const label = s.name.replace(/'/g, "\\'")
    if (subs.length === 0) {
      return `  { key: '${s.id}', label: '${label}' }`
    }
    const children = subs
      .map(sub => `    { key: '${sub.id}', label: '${sub.name.replace(/'/g, "\\'")}' }`)
      .join(',\n')
    return `  { key: '${s.id}', label: '${label}', children: [\n${children}\n  ] }`
  })

  // 메뉴(1-depth + 그 하위 2-depth)에 이미 포함된 화면 집합
  const coveredInMenu = new Set<string>()
  for (const s of menuScreens) {
    coveredInMenu.add(s.id)
    for (const sub of subsByParent.get(s.id) ?? []) coveredInMenu.add(sub.id)
  }
  // 코드가 생성됐지만 메뉴에 안 걸린 화면(고아)도 LNB 최상위 진입점으로 노출 (첫 화면 누락 방지)
  const orphanItemArr = spec.screens
    .filter(s => codedIds.has(s.id) && !coveredInMenu.has(s.id))
    .map(s => `  { key: '${s.id}', label: '${s.name.replace(/'/g, "\\'")}' }`)

  const menuItems = [...menuItemArr, ...orphanItemArr].join(',\n')

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

${generateFlowDiagramHifi(spec, codeFlows, codedIds)}

${screenFunctions}

${generateNotePanelHifi(spec)}

class ScreenErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidUpdate(prev) { if (prev.pageKey !== this.props.pageKey && this.state.err) this.setState({ err: null }) }
  render() {
    if (this.state.err) {
      const msg = this.state.err && this.state.err.message ? this.state.err.message : String(this.state.err)
      return (
        <div style={{ padding: 24 }}>
          <Alert type="error" showIcon message="이 화면을 표시하는 중 오류가 발생했습니다" description={msg} style={{ marginBottom: 12 }} />
          <Button onClick={this.props.onReset}>← 처음으로</Button>
        </div>
      )
    }
    return this.props.children
  }
}

const MENU_ITEMS = [
  { key: 'flow', label: '📊 사용자 flow 보기' },
${menuItems}
]
const RENDERED_IDS = ${JSON.stringify(renderedIds)}

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
            <ScreenErrorBoundary pageKey={page} onReset={() => setPage('flow')}>
            {page === 'flow' && <FlowDiagram navigate={setPage} />}
${screenRenders}
            {page !== 'flow' && !RENDERED_IDS.includes(page) && <FlowDiagram navigate={setPage} />}
            </ScreenErrorBoundary>
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

  const { prdText, analysisText, type = 'lowfi', existingSpec } = body as RequestBody

  // 앞선 생성에서 확정된 spec이 있으면 재사용한다(Lo-Fi/Hi-Fi가 동일 화면 집합 공유).
  // 화면 배열이 비어있지 않은 경우에만 유효한 spec으로 인정.
  const providedSpec =
    existingSpec && Array.isArray(existingSpec.screens) && existingSpec.screens.length > 0
      ? existingSpec
      : undefined

  // NDJSON 스트림으로 진행률을 실시간 전송한다.
  // 이벤트: {type:'progress', progress, message} / {type:'done', files} / {type:'error', error}
  // 진행률 배분: spec 추출 ~20% → 화면 생성 20~85%(화면당 균등) → 조립 90% → 완료 100%
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const emit = (obj: Record<string, unknown>) => {
        if (!closed) controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`))
      }
      const finish = () => {
        if (!closed) {
          closed = true
          controller.close()
        }
      }

      try {
        const anthropic = getAnthropicClient()
        emit({ type: 'progress', progress: 5, message: '요청을 준비하고 있습니다' })

        // Step 1: Spec 확보 — 재사용 가능한 spec이 있으면 추출을 건너뛴다(요건 ④)
        let spec: MockupSpec
        if (providedSpec) {
          spec = providedSpec
          console.log(`[mockup v3] Step 1: reusing provided spec (${spec.screens.length} screens)`)
          emit({ type: 'progress', progress: 20, message: `저장된 화면 구조 재사용 (${spec.screens.length}개 화면)` })
        } else {
          console.log('[mockup v3] Step 1: extracting spec')
          emit({ type: 'progress', progress: 10, message: 'PRD 화면 구조 분석 중' })
          try {
            spec = await extractSpec(anthropic, prdText, analysisText)
          } catch (err) {
            console.error('[mockup v3] Spec extraction failed:', err)
            emit({ type: 'error', error: 'PRD 구조 추출에 실패했습니다. 다시 시도해주세요.' })
            return finish()
          }
          // 화면 수 상한: 메뉴 화면 우선, 초과분은 잘라낸다. 단 조용히 버리지 않고
          // NotePanel '미구현' 항목으로 노출해 디자이너가 누락 화면을 인지하도록 한다.
          let droppedScreens: ScreenSpec[] = []
          if (spec.screens.length > MAX_SCREENS) {
            const menuIds = new Set(spec.menu_screen_ids)
            const ordered = [
              ...spec.screens.filter(s => menuIds.has(s.id)),
              ...spec.screens.filter(s => !menuIds.has(s.id)),
            ]
            droppedScreens = ordered.slice(MAX_SCREENS)
            spec.screens = ordered.slice(0, MAX_SCREENS)
            spec.note_items = [
              ...(spec.note_items ?? []),
              ...droppedScreens.map(s => ({
                category: 'omitted' as const,
                item: s.name,
                reason: `화면 수 상한(${MAX_SCREENS}개)으로 이번 목업에서 제외됨 — 디자이너 별도 구현 필요`,
              })),
            ]
            console.warn(
              `[mockup v3] Capped ${ordered.length} → ${MAX_SCREENS} screens. Dropped: ${droppedScreens.map(s => s.name).join(', ')}`,
            )
          }

          if (spec.screens.length === 0) {
            emit({ type: 'error', error: 'PRD에서 화면을 추출하지 못했습니다.' })
            return finish()
          }

          emit({
            type: 'progress',
            progress: 20,
            message:
              droppedScreens.length > 0
                ? `화면 구조 분석 완료 (${spec.screens.length}개 생성, ${droppedScreens.length}개 제외)`
                : `화면 구조 분석 완료 (${spec.screens.length}개 화면)`,
          })
        }

        console.log(`[mockup v3] Spec: ${spec.screens.length} screens, ${spec.menu_screen_ids.length} in menu`)

        // Step 2: 화면을 병렬 생성. 화면이 완료될 때마다 진행률 emit.
        // (flow는 별도 LLM 호출 없이 spec.flows + navigates_to + codeFlows로 조립 단계에서 구성)
        console.log(`[mockup v3] Step 2: generating ${spec.screens.length} screens in parallel`)
        const systemPrompt = type === 'hifi' ? HIFI_SYSTEM : LOFI_SYSTEM
        const total = spec.screens.length
        let completed = 0

        const results = await Promise.all(
          spec.screens.map(async screen => {
            try {
              return await generateScreen(anthropic, screen, spec.screens, type, systemPrompt)
            } catch (e) {
              console.warn(`[mockup v3] Screen "${screen.name}" threw:`, e)
              return null
            } finally {
              completed++
              const pct = 20 + Math.round((completed / total) * 65)
              emit({ type: 'progress', progress: pct, message: `화면 생성 중 (${completed}/${total})` })
            }
          }),
        )
        console.log(`[mockup v3] Flows: ${spec.flows.length} (from spec) + navigates_to + codeFlows`)

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
          emit({ type: 'error', error: '화면 생성에 모두 실패했습니다. 다시 시도해주세요.' })
          return finish()
        }

        // Step 3: Assemble
        emit({ type: 'progress', progress: 90, message: '화면 조립 중' })
        console.log(`[mockup v3] Step 3: assembling (${screenCodes.size}/${spec.screens.length} screens)`)
        const appCode = type === 'hifi'
          ? assembleHifiApp(screenCodes, spec)
          : assembleLofiApp(screenCodes, spec)

        // Final validation
        const finalError = validateJsx(appCode)
        if (finalError) {
          console.error('[mockup v3] Assembly validation error:', finalError.message, `line ${finalError.line}`)
          emit({
            type: 'error',
            error: '목업 조립 후 구문 오류가 발생했습니다. 다시 시도해주세요.',
            detail: finalError.message,
          })
          return finish()
        }

        console.log(`[mockup v3] Done ✓ screens=${screenCodes.size}/${spec.screens.length}`)
        emit({ type: 'progress', progress: 100, message: '완료' })
        // spec을 함께 반환 → 클라이언트가 보관했다가 재생성 시 재사용(동일 화면 집합 유지)
        emit({ type: 'done', files: { '/App.js': appCode }, spec })
        finish()
      } catch (error) {
        console.error('[mockup v3] 오류:', error)
        const msg =
          error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')
            ? 'API 키가 필요합니다.'
            : '목업 생성 중 오류가 발생했습니다'
        emit({ type: 'error', error: msg })
        finish()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  })
}
