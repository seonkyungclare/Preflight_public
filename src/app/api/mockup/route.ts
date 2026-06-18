import Anthropic from '@anthropic-ai/sdk'
import { parse as babelParse } from '@babel/parser'

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
      "navigates_to": ["target_screen_id"]
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
- menu_screen_ids: only TOP-LEVEL navigation destinations (not modals, not sub-actions like "업로드/수정/삭제")
- columns: ALL PRD-defined table columns (list type) — do not omit any
- fields: ALL PRD-defined form/detail fields — do not omit any
- actions: ALL PRD-defined buttons/actions for this screen
- navigates_to: screen ids reachable from this screen via PRD flows or Standard Navigation
- Sub-actions (업로드, 수정, 삭제 etc.) → parent screen's actions list, NOT separate screens
- Modals/drawers → parent screen's actions list, NOT separate screens
- forced_states, critical_screen_ids, attention_areas: derive from analysis.mockup_directives
- note_items: PRD gaps, ambiguities, missing specs, and attention areas from analysis`

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
    max_tokens: 16000,
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

  const result = await callClaudeCached(anthropic, {
    max_tokens: type === 'hifi' ? 8000 : 5000,
    temperature: type === 'hifi' ? 0.3 : 0.15,
    system: [
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
    ] as unknown as Anthropic.Messages.MessageCreateParams['system'],
    messages: [{ role: 'user', content: userPrompt }],
  })

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

function generateFlowDiagramHifi(spec: MockupSpec): string {
  const menuScreens = spec.screens.filter(s => spec.menu_screen_ids.includes(s.id))
  const cols = 3
  const nodeW = 160, nodeH = 54, gapX = 60, gapY = 80, startX = 60, startY = 60
  const nodes = menuScreens.map((s, i) => ({
    id: s.id,
    name: s.name,
    x: startX + (i % cols) * (nodeW + gapX),
    y: startY + Math.floor(i / cols) * (nodeH + gapY),
  }))
  const edges = spec.flows.filter(
    f => spec.menu_screen_ids.includes(f.from) && spec.menu_screen_ids.includes(f.to),
  )
  const svgW = nodes.length > 0 ? Math.max(...nodes.map(n => n.x + nodeW + 60)) : 600
  const svgH = nodes.length > 0 ? Math.max(...nodes.map(n => n.y + nodeH + 60)) : 400

  return `function FlowDiagram({ navigate }) {
  const nodes = ${JSON.stringify(nodes)}
  const edges = ${JSON.stringify(edges)}
  const W = ${nodeW}, H = ${nodeH}
  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={4}>사용자 Flow 다이어그램</Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>노드를 클릭하면 해당 화면으로 이동합니다.</Typography.Text>
      <div style={{ overflow: 'auto' }}>
        <svg width={${svgW}} height={${svgH}} style={{ background: '#fafafa', border: '1px solid #e0e0e0', borderRadius: 8 }}>
          <defs>
            <marker id="arr" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#1677ff" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const from = nodes.find(n => n.id === e.from)
            const to = nodes.find(n => n.id === e.to)
            if (!from || !to) return null
            const x1 = from.x + W / 2, y1 = from.y + H
            const x2 = to.x + W / 2, y2 = to.y
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1677ff" strokeWidth={1.5} markerEnd="url(#arr)" />
                <text x={(x1 + x2) / 2 + 6} y={(y1 + y2) / 2} fontSize={11} fill="#666">{e.trigger}</text>
              </g>
            )
          })}
          {nodes.map(n => (
            <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => navigate(n.id)}>
              <rect x={n.x} y={n.y} width={W} height={H} rx={6} fill="#fff" stroke="#1677ff" strokeWidth={2} />
              <text x={n.x + W / 2} y={n.y + H / 2 + 5} textAnchor="middle" fontSize={13} fill="#1677ff" fontWeight={500}>{n.name}</text>
            </g>
          ))}
        </svg>
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

  const menuItems = menuScreens
    .map(s => `  { key: '${s.id}', label: '${s.name.replace(/'/g, "\\'")}' }`)
    .join(',\n')

  const screenFunctions = spec.screens
    .filter(s => screenCodes.has(s.id))
    .map(s => screenCodes.get(s.id)!)
    .join('\n\n')

  const screenRenders = spec.screens
    .filter(s => screenCodes.has(s.id))
    .map(s => `            {page === '${s.id}' && <Screen_${s.id} navigate={setPage} />}`)
    .join('\n')

  return `import React, { useState, useEffect } from 'react'
import { Layout, Menu, Table, Form, Input, Button, Modal, Drawer, Select, DatePicker, Typography, Space, Tag, Descriptions, message, Empty, Alert, Card, Tabs, InputNumber, Radio, Checkbox, Switch, Badge, Divider, Tooltip, Popconfirm, Row, Col, Statistic, Upload, ConfigProvider } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons'

${generateFlowDiagramHifi(spec)}

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
    console.log(`[mockup v3] Spec: ${spec.screens.length} screens, ${spec.menu_screen_ids.length} in menu`)

    if (spec.screens.length === 0) {
      return Response.json({ error: 'PRD에서 화면을 추출하지 못했습니다.' }, { status: 500 })
    }

    // Step 2: Generate all screens in parallel
    console.log(`[mockup v3] Step 2: generating ${spec.screens.length} screens in parallel`)
    const systemPrompt = type === 'hifi' ? HIFI_SYSTEM : LOFI_SYSTEM

    const results = await Promise.all(
      spec.screens.map(async screen => {
        try {
          return await generateScreen(anthropic, screen, spec.screens, type, systemPrompt)
        } catch (e) {
          console.warn(`[mockup v3] Screen "${screen.name}" threw:`, e)
          return null
        }
      })
    )

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
