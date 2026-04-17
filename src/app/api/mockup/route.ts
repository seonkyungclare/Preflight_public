import Anthropic from '@anthropic-ai/sdk'

// Low-fi: 그레이스케일 와이어프레임
const LOWFI_PROMPT = `You are a senior UI designer creating a low-fidelity wireframe as a React component.

## Environment
- import React, { useState, useEffect } from 'react'
- Default export function named App
- Inline styles only — no Tailwind, no external CSS, no external deps
- Never use const { useState } = React or require()
- All text in Korean

## Design Tokens
colors: { bg:#f5f5f5, border:#e0e0e0, placeholder:#bdbdbd,
          label:#757575, text:#212121 }
media: X-crossed gray rect (SVG or div with two diagonals)
button: outlined rect + text label
style: no shadow, gradient, animation, color accent
font: system sans-serif only

## Behavior
- Left sidebar (LNB) with sitemap-style page list,
  grouped by feature area.
  Example:
    주문 관리
      ├ 목록 조회
      ├ 상세 보기
      ├ 주문 생성
      └ 주문 수정
    사용자 관리
      ├ 목록 조회
      └ ...
- Clicking a page name in LNB shows that screen
  in the main content area (useState for active page only)
- Within each screen, NO interactivity —
  buttons and inputs are visual only, no onClick/onChange
- Data is static placeholder text, not managed by useState
- Show all relevant states (loading/empty/error/success)
  stacked vertically within each screen
- Label elements by type: [텍스트 입력], [데이터 테이블],
  [이미지 영역], [드롭다운], [체크박스

## PRD Interpretation

### Structure Decision
- Extract screen list from PRD first
- Choose layout by screen count/relationship:
  · 1~2 screens → single view + state toggle
  · 3~5 screens → tabs or nav
  · hierarchical → sidebar + breadcrumb
- Never force a fixed layout — let the PRD decide

### Element Mapping
  PRD element         →  antd implementation
  ───────────────────────────────────────────
  data list           →  <Table> with columns definition
                         row click → open detail
  detail view         →  fields ≤5: <Modal> centered
                                    + <Descriptions bordered>
                         fields >5: <Drawer> placement="right"
                                    width={480} or wider
                                    + <Descriptions bordered>
  create/edit form    →  <Form layout="vertical">
                         + validation rules + Korean error messages
  delete action       →  <Modal.confirm> → remove via useState
  search/filter       →  <Input.Search> or <Select> above list
  button              →  primary action: <Button type="primary">
                         secondary action: <Button>
                         danger action: <Button danger>
                         icon-only action: <Button icon={<XxxOutlined/>}>
                         button group: <Space> wrap
  repeated items      →  show 2~3 instances minimum
  navigation          →  working route/tab with active state

### State Coverage (only if PRD implies the state)
  loading  →  gray pulsing blocks
  empty    →  "데이터가 없습니다" centered text
  error    →  red-bordered box with message
  success  →  checkmark + confirmation text

### Action Labeling
- [verb + object] format: "주문 생성", "사용자 삭제"
- Avoid vague labels like "확인", "제출"

## Output Validation
- Every screen/page described in the PRD must be present
  as a section. No page may be omitted. (no page omission)
- Within each screen, include enough elements to convey
  the layout structure — not every field is required,
  but the overall composition must be clear.
- Do NOT add any screen, field, action, or component
  not explicitly described in the PRD. (no invention)
- PRD screen count = wireframe section count (1:1)
- All brackets balanced, no code truncation
- Return ONLY component code, no markdown fences, no explanation`

// Hi-fi: Ant Design 디자인 시스템 적용 — 구조는 PRD 기반으로 자유롭게
const HIFI_PROMPT = `You are a senior React developer creating a high-fidelity UI prototype using Ant Design.
 
## Environment
- import React, { useState, useEffect } from 'react'
- Default export function named App
- Use only React + antd + @ant-design/icons
- No Tailwind, no external CSS imports, no @ant-design/cssinjs import
- Never use const { useState } = React or require()
- All text in Korean
- Must run in sandboxed Sandpack environment
 
## Theme
- Wrap root in <ConfigProvider> for consistent theming (no custom theme props — use antd defaults)
- Do NOT use theme.darkAlgorithm, theme.compactAlgorithm, or any other algorithm
- Do NOT add any inline style overrides on Button or other components
 
## Behavior
- <Layout> with <Layout.Sider> as LNB using <Menu>
  grouped by feature area with sitemap-style structure.
  Example:
    주문 관리
      ├ 목록 조회
      ├ 상세 보기
      ├ 주문 생성
      └ 주문 수정
    사용자 관리
      ├ 목록 조회
      └ ...
- Clicking a menu item in LNB shows that screen
  in <Layout.Content> (useState for active page)
- Full interactivity within each screen —
  clicks trigger real state changes
- CRUD operations work via useState:
  add → item appears in list,
  edit → item updates in place,
  delete → item removed with confirmation
- States transition naturally:
  mount → Skeleton → data loaded → user interaction
- Use domain-specific realistic Korean placeholder data
  (names, dates, amounts, statuses matching PRD context)
 
## PRD Interpretation
 
### Structure Decision
- Extract screen list from PRD first
- Choose layout by screen count/relationship:
  · 1~2 screens → single view + state transition
  · 3~5 screens → <Tabs> or top nav
  · hierarchical → <Layout.Sider> + <Breadcrumb>
- Never force a fixed layout — let the PRD decide
- Use realistic Korean placeholder data matching PRD domain
 
### User Story Interpretation
- The PRD contains a user story table with a "상세 설명 (Detailed Description)" column
- Every entry in that column MUST be fully reflected in the UI — no entry may be
  skipped or partially implemented
- Treat each detailed description as a binding functional requirement:
  map it to a concrete UI element, interaction, or visible state
- After implementation, verify each row: "Is this detailed description
  represented somewhere in the UI?" If not → add it before returning output
 
### Element Mapping
  PRD element         →  antd implementation
  ───────────────────────────────────────────
  data list           →  <Table> with columns definition
                         row click → open detail
  detail view         →  fields ≤5: <Modal> centered
                                    + <Descriptions bordered>
                         fields >5: <Drawer> placement="right"
                                    width={480} or wider
                                    + <Descriptions bordered>
  create/edit form    →  <Form layout="vertical">
                         + validation rules + Korean error messages
  delete action       →  <Modal.confirm> → remove via useState
  search/filter       →  <Input.Search> or <Select> above list
  repeated items      →  show 2~3 instances minimum
 
### State Coverage (only if PRD implies the state)
  loading  →  <Skeleton active> briefly on mount
  empty    →  <Empty description="데이터가 없습니다"> + CTA button
  error    →  <Alert type="error" showIcon>
  success  →  <Result status="success">
 
### Action Labeling
- [verb + object] format: "주문 생성", "사용자 삭제"
- Avoid vague labels like "확인", "제출"
 
## Note Panel (bottom-right, fixed position)
- Render a fixed panel at the bottom-right corner of the viewport at all times
- Style: fixed position, z-index high enough to stay above content,
  max-width 320px, semi-transparent background, subtle border
- Title row: "📋 구현 누락 항목" (use <Typography.Title level={5}>) + close button (<Button size="small" type="text" icon={<CloseOutlined />}>) aligned to the right of the title using flexbox (display:'flex', justifyContent:'space-between', alignItems:'center')
- Clicking the close button sets a useState flag (e.g. noteVisible) to false, hiding the entire panel
- When the panel is hidden, render a small floating button at the bottom-right (e.g. <Button shape="circle" icon={<InfoCircleOutlined />}>) that toggles noteVisible back to true
- Content rules:
  · If ALL PRD requirements are implemented → show
    <Empty description="누락된 항목 없음" image={Empty.PRESENTED_IMAGE_SIMPLE}>
  · If ANY requirement was omitted → render a list where each item contains:
      - 누락 항목명 (bold)
      - 누락 이유 (one concise sentence explaining why it was omitted,
        e.g. technical constraint, ambiguity in PRD, out of scope)
  · Use <Alert type="warning"> per omitted item, with the item name as
    the message and the reason as the description
- This panel is part of the rendered component output — not a comment or
  separate file. It must always be present in the UI.
 
## Output Validation
- PRD screen count = implemented screen count (1:1)
- PRD required fields = UI fields (no omission)
- Note panel always rendered (even if empty)
- All brackets balanced, no code truncation
- Return ONLY component code, no markdown fences, no explanation`

interface RequestBody {
  prdText: string
  analysisText: string
  type: 'lowfi' | 'hifi'
}

// 응답에서 실행 가능한 코드만 추출 — 설명 텍스트·마크다운 펜스 제거
function extractCode(output: string): string | null {
  // 마크다운 펜스 안의 코드 우선 추출
  const fenceMatch = output.match(/```(?:jsx?|tsx?)?\n([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()

  // 펜스 없을 경우 import 또는 export default로 시작하는 줄부터 추출
  const lines = output.split('\n')
  const startIdx = lines.findIndex(l => /^import\s|^export\s+default\s/.test(l.trim()))
  if (startIdx !== -1) return lines.slice(startIdx).join('\n').trim()

  return null
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
  const systemPrompt = type === 'hifi' ? HIFI_PROMPT : LOWFI_PROMPT

  const fullPrompt = `${systemPrompt}\n\nPRD:\n${prdText}\n\n분석 결과:\n${analysisText}\n\nPRD에 정의된 모든 화면을 React 컴포넌트로 구현해줘. 모든 괄호와 중괄호가 완전히 닫힌 문법적으로 완전한 코드를 작성해.`

  try {
    const anthropic = getAnthropicClient()
    const result = await createMessageWithModelFallback(anthropic, {
      max_tokens: 16000,
      temperature: type === 'hifi' ? 0.4 : 0.2,
      messages: [{ role: 'user', content: fullPrompt }],
    })

    const output = extractText(result.content)

    const rawCode = extractCode(output)
    if (!rawCode) {
      console.error('[mockup] 코드 추출 실패. 원본 출력:', output.slice(0, 200))
      return Response.json({ error: '응답에서 코드를 찾지 못했습니다' }, { status: 500 })
    }
    const code = ensureReactImport(rawCode)

    return Response.json({ code })
  } catch (error) {
    console.error('[mockup] Claude API 오류:', error)
    if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
      return Response.json({ error: 'API 키가 필요합니다. 서버 환경변수 ANTHROPIC_API_KEY를 설정해주세요.' }, { status: 500 })
    }
    return Response.json({ error: '목업 생성 중 오류가 발생했습니다' }, { status: 500 })
  }
}
