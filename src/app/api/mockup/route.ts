import Anthropic from '@anthropic-ai/sdk'
import { parse as babelParse } from '@babel/parser'
import { buildHifiConventions } from '@/lib/mcds-prompt'

export const maxDuration = 300 // Vercel 최대 실행 시간 300초 (Pro plan)

// MCDS 캐노니컬 컨벤션 (src/vendor/mcds/conventions.md — 출처 명기 단일 원천).
// 배치·순서·컴포넌트 선택 규칙은 HIFI_SYSTEM이 아니라 이 블록이 권위 원천이다.
const MCDS_CONVENTIONS = buildHifiConventions()

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
      "parent_id": "parent_screen_id_or_omit_if_top_level"
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
If the input contains a section starting with "=== 사용자 요구사항:", treat it as ADDITIVE supplementary UX/UI requirements. The PRD is the source of truth.
- ADD any extra fields, columns, or actions mentioned in requirements to the relevant screens — but NEVER remove or replace PRD-defined fields, columns, or actions
- If a requirement contradicts or differs from the PRD, the PRD definition takes priority — the requirement is ignored
- If a screen is mentioned only in requirements (not in PRD), add it as a new screen entry with appropriate type and parent_id
- Reflect domain-specific terminology from the requirements into screen names and labels only when the PRD does not already define them
- Do NOT extract ux_hints — UX behaviors will be passed directly to screen generation`

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

## User Requirements (wireframe level)
If the prompt includes a USER REQUIREMENTS section, read it and apply relevant items to this screen using grayscale shapes:
- Bulk upload / drag-and-drop / file import → dashed rectangle labeled "📂 파일 드롭 영역"
- Time precision / HH:MM / scheduled time → input box labeled "날짜 / 시간 (HH:MM)"
- Timeline view / slot calendar / gantt grid → grid table skeleton (rows = 리소스, columns = 날짜)
- Audit log / change history → 3-column table at bottom: 수정자 | 수정일시 | 변경항목
- Status filter chips / tag filters → row of small outlined rectangle chips
- Preview / thumbnail / rendering → bordered rectangle labeled "미리보기"
- KPI / metrics / performance comparison → row of metric cards (label, value, comparison)
- Conditional fields / type-based field switch → field group with label "[조건에 따라 노출]"
- Real-time validation / inline error / URL check → input with red-dashed border + error text below
- Role-based access / permission gating → lighter-bordered rectangle with "🔒" prefix
- Confirmation popup / warning before action → button with "⚠" prefix + "확인 팝업 발생" note
- Clone / duplicate-then-edit flow → button labeled "복제 후 수정"
- Alert subscription / event notification → toggle row labeled "알림 구독"
Only apply items relevant to THIS screen. Skip backend-only or cross-system requirements.`

const HIFI_SYSTEM = `You generate high-fidelity React screen functions using @musinsa/mcds — Musinsa's internal admin design system (built on antd v6). Implement the screen spec precisely — do not invent elements the spec does not list.

Output format (STRICT):
- Generate ONLY: function Screen_XXX({ navigate }) { ... }
- No imports. No export. No other functions or code outside the one function.

Code style (COMPACT — token budget is limited):
- No comments, no JSDoc, no blank lines between JSX elements
- Mock data arrays: maximum 3 items
- Do not repeat similar JSX blocks — use .map() instead
- Keep variable names short but readable (e.g. open not isModalVisible)

Pre-imported identifiers (DO NOT re-import; use ONLY these):
- React, useState (from 'react')
- MCDS templates: AdminListRecipeLayout, AdminStatusRecipeLayout, AdminRegistrationRecipeLayout, AdminDetailReadRecipeLayout, AdminDetailEditableRecipeLayout, AdminTreeWorkspaceRecipeLayout
- MCDS modules: RecipeSearchArea, RecipeResultsTable, RecipeAccordionSections, RecipeNotice, FormField, ReadOnlyField, SearchModalField, LookupPickerModal, HierarchySelectField, Modal, ConfirmActionDialog, HelpAlertPanel, FooterActionBar, SectionBlock, UploadPanel
- MCDS elements: Button, TextButton, Tag, Chips, Tabs, Select, AutoComplete, TextField, TextArea, NumberInput, DatePicker, DateRangePicker, Checkbox, Switch, Radio, MultiSelect, Message, Empty, Stack, Inline, Grid, Divider, Tooltip
- MCDS icons: IconSearch, IconReset, IconPlus, IconClose, IconCalendar, IconUpload, IconDownload, IconInfoCircle, IconExclamation, IconArrowLeft
- antd toast: message (message.success('...') after actions)

NOT AVAILABLE — referencing these CRASHES the app. Use the MCDS replacement:
- Table/Descriptions → RecipeResultsTable / Stack of ReadOnlyField
- Popconfirm / Modal.confirm() → <ConfirmActionDialog open title description confirmAction cancelAction onClose />
- Drawer → Modal
- Form/Form.Item/Input/InputNumber → FormField + TextField/NumberInput
- Row/Col/Space/Card/Statistic/Badge/Alert/Spin/Skeleton → Grid/Inline/Stack/SectionBlock + design tokens
- Any @ant-design/icons (PlusOutlined etc.) → MCDS Icon* only
- Raw HTML <button>/<table>/<input>/<h1>-<h6> → MCDS components

## Screen layout by TYPE (pick ONE template per screen)
- list      → <AdminListRecipeLayout title search={<RecipeSearchArea/>} results={<RecipeResultsTable/>} />
- form      → <AdminRegistrationRecipeLayout title variant="basic" sections={<RecipeAccordionSections/>} stickyActions={<FooterActionBar/>} />
  (variant allowed values: "basic"|"stepped"|"conditional"|"repeatable" ONLY — "register"/"edit" do NOT exist; 등록/수정 구분은 title·버튼 라벨로)
- detail    → <AdminDetailReadRecipeLayout title sections={<RecipeAccordionSections/>} stickyActions={<FooterActionBar/>} />
- dashboard/other → compose with SectionBlock/Grid/Stack + design tokens
All layouts also accept: description, notice, noticeTone ('info'|'warning'|'neutral'), guide — use notice for policy/result banners.
Fill layout slots via NAMED PROPS, never via children (children are silently dropped).

## Page Wrapper (padding rules — follow exactly)
- AdminListRecipeLayout / AdminStatusRecipeLayout / AdminTreeWorkspaceRecipeLayout / custom(dashboard) have NO built-in padding.
  The screen function's ROOT element MUST be:
  <div style={{ padding: 'var(--mcds-registration-shell-padding-top) var(--mcds-registration-shell-padding-right) var(--mcds-registration-shell-padding-bottom) var(--mcds-registration-shell-padding-left)' }}>...</div>
- AdminRegistrationRecipeLayout / AdminDetailReadRecipeLayout / AdminDetailEditableRecipeLayout self-apply that padding — return them DIRECTLY with NO wrapper (padding would double).

## MCDS API facts (real API — antd habits WILL break)
- RecipeSearchArea: { fields: [{ key, label, control }], leftActions, rightActions, labelWidth? }
  · BOTH default actions go TOGETHER in leftActions, 검색 first (canonical MCDS-CCD convention):
    leftActions={<><Button onClick={search}>검색</Button><Button type="secondary" onClick={reset}>초기화</Button></>}
    (검색 = default type i.e. primary, 초기화 = type="secondary". Do NOT put 검색 in rightActions.)
  · rightActions = optional slot: 보조 설정 = TextButton type="secondary"; 등록/내보내기 진입 Button도 가능.
- RecipeResultsTable: { title, actions?, columns: [{ key, headerName }], rows: ReactNode[][], emptyState: { title, description? }, pagination: { current, total, onChange } }
  · rows = ARRAY of cell-arrays in column order (NOT objects). columns use headerName (NOT label/title/dataIndex).
  · pagination.total = number of PAGES (not items). Sample data → total: 5. ALWAYS include pagination on list screens.
  · actions = table-header-level buttons: 다운로드/일괄 처리 = type="secondary" size={36} (disabled when nothing selected), 신규 등록 = default(primary) rightmost.
  · title = 목록명 + live count from state: title={\`상품 목록 (\${rows.length}건)\`} — derived count, canonical 8/8 screens.
  · 상세 진입: 식별자 컬럼(품번/명칭)을 <TextButton onClick={...}>{r.name}</TextButton>으로. NAVIGATION TARGETS에 상세 화면이 있으면 navigate('그 id'), 없을 때만 Modal 대체. 행 끝 관리 버튼은 <Button type="secondary" size={32}>.
- RecipeAccordionSections: { sections: [{ id, title, open, onToggle, body }] } — needs useState per section open
- FormField: <FormField label="이메일" required><TextField value={v} onChange={setV} /></FormField>
  · FormField body = ONE input control only. Do NOT put buttons next to the control inside FormField.
- ReadOnlyField: <ReadOnlyField label="주문번호" value="ORD-001" /> — read-only values use this, NEVER a disabled TextField/Select.
- Button: type="primary"|"secondary"|"tertiary"|"warning" (NO variant prop; default = primary). Destructive → type="warning". primary = 화면의 주 액션(검색, 등록, 저장). 보조 액션(초기화, 취소) = secondary.
  · children = plain text label ONLY (e.g. <Button type="secondary">검색</Button>). NEVER place Icon components inside Button children — no <Button><IconSearch />검색</Button>. Decorative icons next to labels are FORBIDDEN; the label alone is the MCDS convention.
- Tag: <Tag labelText="승인" color="green|red|blue|yellow|gray|purple" /> — children IGNORED, labelText required
  green=승인/활성/완료, red=반려/오류, blue=진행중/신규, yellow=대기/검토중, gray=중립/보류
- Tabs: { items: [{ label, value }], value, onChange } — value NOT key/activeKey; renders bar only, caller renders content conditionally
- TextField/TextArea: onChange receives STRING (not event). errorMessage/helpText exist on TextField ONLY — TextArea has NO errorMessage/helpText (검증 문구는 아래 별도 텍스트로).
- Select: { options: [{ label, value }], value, onChange } — NO placeholder prop. '전체' 같은 기본 선택지는 options 첫 항목으로 넣고 초기 value로 지정.
- DatePicker: { value: string, onChange: (s) => void }
- DateRangePicker: { from, to, onChangeFrom, onChangeTo } — NOT value/onChange
- Modal: <Modal open title actions={[<Button/>...]} onClose>...</Modal>
  · actions order: cancel first (type="secondary"), confirm last (type="primary") — [취소, 확인]
- 확인 다이얼로그 — 본문에 입력/표 없이 단일 메시지 확인(삭제·이탈·실행)이면 ConfirmActionDialog(=Alert, 420px):
  전체 확인 문구를 title에 문장형으로 넣고 description은 생략(부가 설명이 꼭 필요할 때만).
  <ConfirmActionDialog open title="선택한 1개의 상품을 삭제하시겠습니까? 삭제된 상품은 복구할 수 없습니다." confirmAction={<Button onClick={del}>삭제</Button>} cancelAction={<Button type="secondary" onClick={close}>취소</Button>} onClose={close} />
  · confirm 버튼은 기본형(primary/파랑) — 삭제여도 type="warning" 금지. 파괴 신호는 title 문구 + "삭제" 라벨이 전달.
  · 확인 문구를 description에 넣고 title을 비우지 말 것 (title이 메시지다).
- Modal은 본문에서 입력·선택·표 조작 등 실제 Task를 할 때만 (폼/picker/워크스페이스). 단순 확인에 Modal 쓰지 말 것.
- SearchModalField (entity picker trigger — MUST pair with LookupPickerModal):
  <SearchModalField selectedItems={sel ? [{ value: sel, label: sel }] : []} placeholder="업체를 선택하세요" onClick={() => setOpen(true)} />
  <LookupPickerModal open={open} title="업체 선택" selectionMode="single" options={[{ label: '업체A', value: 'a' }]} selectedValues={vals} onSelectedValuesChange={setVals} onConfirm={(v) => { setSel(v[0] ?? null); setOpen(false) }} onClose={() => setOpen(false)} />
  (selectedItems item = { value, label } — NOT {id, primary}. onConfirm은 필수 — 누락 시 확인 클릭에서 크래시.)
- AutoComplete: { options: [{ label, value }], value, onChange, onSearch?, placeholder?, allowClear? }
- HierarchySelectField: has its OWN label prop — use standalone, do NOT wrap in FormField (double label).
- Checkbox/Switch/Radio: { checked, onChange, labelText } (Checkbox in table cells: showLabel={false})
- Grid: columns is a CSS STRING (default '1fr') — 3열은 columns="repeat(3, 1fr)". columns={3} 같은 숫자는 무효.
- HelpAlertPanel: tone은 'info'|'warning'|'neutral'만 ('error'/'success' 없음).
- Chips (적용된 필터 표시용 제거형 칩): { labelText, border?, remove?, onRemove? } — 클릭 토글 아님.
- UploadPanel: { label(필수), description?, files?, accept?, multiple?, onSelect: (files) => void, onRemove? }

(배치·순서·컴포넌트 선택 컨벤션은 시스템 프롬프트 뒤에 붙는 "MCDS CANONICAL CONVENTIONS" 절이 권위 원천이다 — 충돌 시 그 절을 따른다.)

## Design tokens (custom inline styles — NEVER hardcode raw hex/px)
- spacing: var(--mcds-spacing-4|8|12|16|20|24|32)
- font: fontSize var(--mcds-font-size-12|14|16|20|24), fontWeight var(--mcds-font-weight-400|500|600|700)
- text colors: var(--mcds-color-gray-10) primary, var(--mcds-color-gray-50) secondary, var(--mcds-text-error-subtle) error
- status colors: var(--mcds-color-green-40) success, var(--mcds-color-red-40) error, var(--mcds-color-yellow-30) warning, var(--mcds-color-blue-40) brand
- surface: var(--mcds-panel-bg), var(--mcds-color-gray-95) skeleton/placeholder, var(--mcds-color-gray-98) subtle row
- border: var(--mcds-panel-border), var(--mcds-color-gray-90) divider; radius var(--mcds-radius-4|8|99)
FORBIDDEN in custom styles: raw hex (#fff, #1677ff...), raw px numbers for gap/padding/fontSize/borderRadius. Use tokens.

Rules:
- All text Korean
- Realistic Korean placeholder data: brand/product names, dates "2026-04-15", amounts "₩2,400,000", PRD-defined statuses
- List type: RecipeResultsTable with 3 rows, ALL columns filled via rows cell-arrays
- Full interactivity — NO dead ends:
  · 상세 진입: 식별자 컬럼 셀을 <TextButton onClick={...}>{r.name}</TextButton>으로.
    NAVIGATION TARGETS에 상세 화면이 있으면 navigate('그 id') 우선, 없을 때만 Modal(<Stack>의 ReadOnlyField) 대체.
  · "생성/추가/등록" actions: NAVIGATION TARGETS에 등록 화면이 있으면 navigate, 없으면 Modal with FormField+controls, submit → close + prepend list + message.success
  · "수정/편집" actions: same Modal pre-filled, submit → update list + message.success
  · "삭제" actions: ConfirmActionDialog(Alert) — 확인 문구를 title에, 버튼 [취소 secondary → 삭제 primary] → remove from list + message.success. Modal 쓰지 말 것.
  · Cross-screen navigation: call navigate('targetId')
- Use useState for: list data, modal open state, selected item, accordion open state
- Exact PRD field/column names — do not rename
- Do NOT add columns/fields not in spec

## User Requirements (hi-fi level)
If the prompt includes a USER REQUIREMENTS section, implement relevant items for THIS screen using MCDS:
- Bulk upload / drag-and-drop / file import → <UploadPanel label="파일 업로드" description="드래그하거나 클릭해서 업로드" files={files} onSelect={...} onRemove={...} />
- Time precision / HH:MM → <Inline gap={8}><DatePicker value={d} onChange={setD} /><TextField value={t} onChange={setT} placeholder="HH:MM" /></Inline>
- Timeline / slot calendar / gantt → <Grid columns="repeat(7, 1fr)"> resource × date cells with <Tag> bars
- Audit log / change history → RecipeResultsTable columns [수정자, 수정일시, 변경항목] at bottom
- Status multi-filter → 필터 컨트롤 자체는 <MultiSelect> (검색영역), 적용된 필터 값 나열은 <Inline gap={4}>의 <Chips labelText border remove onRemove /> — Tag 클릭 토글 금지
- Preview / thumbnail → <Grid columns="repeat(4, 1fr)"> of token-styled placeholder boxes with labels
- KPI / metrics → <Grid columns="repeat(3, 1fr)"> of <SectionBlock> each with big number (fontSize var(--mcds-font-size-24)) + comparison text
- Conditional fields → <Radio> group with useState; {val === 'A' && <FormField>...</FormField>}
- Real-time validation / inline error → <TextField errorMessage={invalid ? '올바른 형식이 아닙니다' : undefined} /> (TextField만 — TextArea엔 errorMessage 없음)
- Role-based access → <Button disabled> + <Tooltip content="권한이 없습니다">
- Confirmation before action → ConfirmActionDialog
- Clone / duplicate-then-edit → "복제 후 수정" Button → pre-filled edit Modal
- Alert subscription → <Stack> rows each <Inline> label + <Switch checked onChange labelText="" />
Only apply items relevant to THIS screen. Skip backend-only or cross-system requirements.
- Do NOT add utility buttons not in spec (새로고침, 내보내기, 인쇄 etc.)
- Normal flow only — no empty/loading/error state screens`

// ============================================================================
// CODE UTILITIES
// ============================================================================

function extractCode(output: string): string | null {
  // 언어 태그는 무엇이든 허용 (typescript, javascript, react 등)
  const fenceMatches = Array.from(output.matchAll(/```[\w-]*\n([\s\S]*?)```/g))
  if (fenceMatches.length > 0) {
    const longest = fenceMatches.reduce((a, b) => (a[1].length >= b[1].length ? a : b))
    return longest[1].trim()
  }
  const lines = output.split('\n')
  const startIdx = lines.findIndex(l => /^function\s+Screen_/.test(l.trim()))
  if (startIdx !== -1) {
    // 닫는 펜스가 남아있으면 제거 (여는 펜스를 못 찾은 경우 대비)
    const body = lines.slice(startIdx)
    while (body.length > 0 && /^`{3,}\s*$/.test(body[body.length - 1].trim())) body.pop()
    return body.join('\n').trim()
  }
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

// hifi 화면 코드에서 조립 시 import되지 않는 식별자 사용 검출 (런타임 ReferenceError 예방)
// LLM이 antd 습관대로 쓰기 쉬운 것들만 블랙리스트로 잡는다.
const HIFI_UNAVAILABLE = [
  { re: /<Descriptions[\s>]/, name: 'Descriptions', fix: 'use <Stack> of <ReadOnlyField label value />' },
  { re: /<Popconfirm[\s>]/, name: 'Popconfirm', fix: 'use <ConfirmActionDialog open title confirmAction cancelAction onClose />' },
  { re: /Modal\.confirm\(/, name: 'Modal.confirm', fix: 'use <ConfirmActionDialog />' },
  { re: /<Drawer[\s>]/, name: 'Drawer', fix: 'use <Modal open title actions onClose>' },
  { re: /<Form[\s>.]/, name: 'Form', fix: 'use <FormField label required> wrapping a control' },
  { re: /<Input[\s>.]/, name: 'Input', fix: 'use <TextField value onChange(string) />' },
  { re: /<InputNumber[\s>]/, name: 'InputNumber', fix: 'use <NumberInput />' },
  { re: /<(Row|Col)[\s>]/, name: 'Row/Col', fix: 'use <Grid columns gap> or <Inline gap>' },
  { re: /<Space[\s>.]/, name: 'Space', fix: 'use <Inline gap> or <Stack gap>' },
  { re: /<Card[\s>.]/, name: 'Card', fix: 'use <SectionBlock title> or token-styled div' },
  { re: /<Statistic[\s>]/, name: 'Statistic', fix: 'use token-styled number text inside SectionBlock' },
  { re: /<Badge[\s>.]/, name: 'Badge', fix: 'use <Tag labelText color />' },
  { re: /<Alert[\s>]/, name: 'Alert', fix: 'use <HelpAlertPanel tone title> or <RecipeNotice tone>' },
  { re: /<(Spin|Skeleton)[\s>]/, name: 'Spin/Skeleton', fix: 'use gray div with var(--mcds-color-gray-95) background' },
  { re: /<Table[\s>]/, name: 'Table', fix: 'use <RecipeResultsTable columns rows emptyState pagination />' },
  { re: /\b\w+Outlined\b/, name: '@ant-design/icons', fix: 'use MCDS Icon* (IconSearch, IconPlus, ...)' },
  { re: /<Upload[\s>.]/, name: 'Upload', fix: 'use <UploadPanel label="파일 업로드" files onSelect onRemove />' },
  { re: /<Tag\s[^>]*[^/]>/, name: 'Tag with children', fix: 'use <Tag labelText="..." color="..." /> (children ignored)' },
  { re: /<Button[^>]*>\s*<Icon/, name: 'Icon inside Button children', fix: 'Button children must be plain text label only — remove the Icon component (decorative icons are forbidden by MCDS convention)' },
  { re: /variant="(register|edit)"/, name: 'invalid registration variant', fix: 'RegistrationVariant is "basic"|"stepped"|"conditional"|"repeatable" only — use variant="basic"' },
  { re: /selectedItems=\{[\s\S]{0,100}?\b(id|primary):/, name: 'SearchModalField selectedItems shape', fix: 'items are { value, label } — NOT { id, primary }' },
  { re: /<ConfirmActionDialog[\s\S]{0,600}?type="warning"/, name: 'warning Button inside ConfirmActionDialog', fix: 'ConfirmActionDialog(Alert) confirm 버튼은 기본형(primary) — 삭제여도 type="warning" 금지. 파괴 신호는 title 문구와 "삭제" 라벨로 전달' },
]

function findUnavailableUsage(code: string): string | null {
  const msgs = HIFI_UNAVAILABLE.filter(u => u.re.test(code)).map(u => `${u.name} is NOT available/valid — ${u.fix}`)
  // 다중 속성에 걸친 규칙은 정규식 대신 코드 레벨로 검사
  if (/<LookupPickerModal/.test(code) && !/onConfirm/.test(code)) {
    msgs.push('LookupPickerModal REQUIRES onConfirm={(values) => { ...apply; close }} — without it the confirm button throws at runtime')
  }
  return msgs.length > 0 ? msgs.join('; ') : null
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

function buildScreenUserPrompt(screen: ScreenSpec, allScreens: ScreenSpec[], type: 'lowfi' | 'hifi', requirementsText?: string): string {
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
    const layoutByType: Record<string, string> = {
      list: 'AdminListRecipeLayout — root MUST be the shell-padding wrapper div',
      form: 'AdminRegistrationRecipeLayout variant="basic" — return directly, NO wrapper (self-pads)',
      detail: 'AdminDetailReadRecipeLayout — return directly, NO wrapper (self-pads)',
      dashboard: 'custom composition (SectionBlock/Grid) — root MUST be the shell-padding wrapper div',
      other: 'custom composition — root MUST be the shell-padding wrapper div',
    }
    lines.push(`LAYOUT: ${layoutByType[screen.type] ?? layoutByType.other}`)
  }
  if (requirementsText) {
    lines.push(``, `USER REQUIREMENTS (apply relevant items to this screen):`, requirementsText)
  }
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
  requirementsText?: string,
): Promise<string | null> {
  const userPrompt = buildScreenUserPrompt(screen, allScreens, type, requirementsText)

  const result = await anthropic.messages.create({
    model: getScreenModel(),
    max_tokens: type === 'hifi' ? 6000 : 4000,
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

  // hifi: 조립 시 import되지 않는 컴포넌트 사용 감지 → 수리 (런타임 크래시 예방)
  if (type === 'hifi') {
    const bad = findUnavailableUsage(code)
    if (bad) {
      console.warn(`[mockup] Screen ${screen.id} unavailable identifiers — repairing: ${bad}`)
      const repaired = await repairScreen(
        anthropic,
        code,
        `The code references components that do NOT exist in this environment (runtime ReferenceError). ${bad}. Rewrite the affected parts using only pre-imported MCDS components. Keep everything else identical.`,
        screen.id,
      )
      // 수리 실패 시 원본 유지 — 해당 화면 렌더 시에만 국소적으로 실패하고 나머지는 동작
      return repaired ?? code
    }
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
        <AntButton size="small" onClick={() => setFlowKey(k => k + 1)}>↺ 새로고침</AntButton>
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
      extra={<AntButton type="text" size="small" onClick={() => setOpen(v => !v)}>{open ? '닫기' : '열기'}</AntButton>}
    >
      {open && (
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          {attention.length > 0 && (
            <AntAlert type="warning" showIcon banner
              message={<><b>⚠️ 주의 영역 (분석 결과)</b>{attention.map((n, i) => <div key={i} style={{ marginTop: 4 }}>{n.item} — {n.reason}</div>)}</>}
            />
          )}
          {missing.length > 0 && (<>
            <Typography.Text type="warning" strong style={{ fontSize: 12 }}>누락 가능 항목</Typography.Text>
            {missing.map((n, i) => <AntAlert key={i} type="warning" showIcon message={n.item} description={n.reason} style={{ marginBottom: 4 }} />)}
          </>)}
          {ambiguous.length > 0 && (<>
            <Typography.Text type="secondary" strong style={{ fontSize: 12 }}>모호한 항목</Typography.Text>
            {ambiguous.map((n, i) => <AntAlert key={i} type="info" showIcon message={n.item} description={n.reason} style={{ marginBottom: 4 }} />)}
          </>)}
          {omitted.length > 0 && (<>
            <Typography.Text type="danger" strong style={{ fontSize: 12 }}>미구현 항목</Typography.Text>
            {omitted.map((n, i) => <AntAlert key={i} type="error" showIcon message={n.item} description={n.reason} style={{ marginBottom: 4 }} />)}
          </>)}
          {!hasAny && <AntEmpty description="PRD 검토 결과 보완 사항 없음" image={AntEmpty.PRESENTED_IMAGE_SIMPLE} />}
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

  // MCDS AdminLnbSidebar 용 네비게이션 데이터 (1depth + 2depth)
  const navData = menuScreens.map(s => ({
    id: s.id,
    name: s.name,
    children: (subsByParent.get(s.id) ?? []).map(c => ({ id: c.id, name: c.name })),
  }))

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
import { Typography, Card, Space, message, Button as AntButton, Alert as AntAlert, Empty as AntEmpty } from 'antd'
import {
  AdminShell, AdminLnbSidebar,
  AdminListRecipeLayout, AdminStatusRecipeLayout, AdminRegistrationRecipeLayout,
  AdminDetailReadRecipeLayout, AdminDetailEditableRecipeLayout, AdminTreeWorkspaceRecipeLayout,
  RecipeSearchArea, RecipeResultsTable, RecipeAccordionSections, RecipeNotice,
  FormField, ReadOnlyField, SearchModalField, LookupPickerModal, HierarchySelectField,
  Modal, ConfirmActionDialog, HelpAlertPanel, FooterActionBar, SectionBlock,
  Button, TextButton, Tag, Tabs, Select, AutoComplete, TextField, TextArea, NumberInput,
  DatePicker, DateRangePicker, Checkbox, Switch, Radio, MultiSelect, Message, Empty,
  Stack, Inline, Grid, Divider, Tooltip,
  IconSearch, IconReset, IconPlus, IconClose, IconCalendar, IconUpload, IconDownload, IconInfoCircle, IconExclamation,
} from '@musinsa/mcds'

${generateFlowDiagramHifi(spec, codeFlows)}

${screenFunctions}

${generateNotePanelHifi(spec)}

const NAV = ${JSON.stringify(navData)}

export default function App() {
  const [page, setPage] = useState('${firstScreen}')
  const menus = [{
    key: 'nav', label: '메뉴', expanded: true, onToggle: () => {},
    sections: [
      { items: [{ label: '📊 사용자 flow 보기', state: page === 'flow' ? 'active' : 'default', onClick: () => setPage('flow') }] },
      ...NAV.map(m => ({
        title: m.children.length > 0 ? m.name : undefined,
        items: [
          { label: m.name, state: page === m.id ? 'active' : 'default', onClick: () => setPage(m.id) },
          ...m.children.map(c => ({ label: c.name, state: page === c.id ? 'active' : 'default', onClick: () => setPage(c.id) })),
        ],
      })),
    ],
  }]
  return (
    <div style={{ fontFamily: 'var(--mcds-font-family)' }}>
      <AdminShell
        hideGnb
        contentPaddingBottom={0}
        sidebar={<AdminLnbSidebar brandName="Preflight" brandSubLabel="PRD Mockup" platformLabel="MUSINSA" useUtilityMenu menus={menus} />}
      >
        {page === 'flow' && <FlowDiagram navigate={setPage} />}
${screenRenders}
      </AdminShell>
      <NotePanel />
    </div>
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

    // 사용자 요구사항 섹션 원문 추출 (있을 경우 화면 생성에 직접 전달)
    const reqMatch = prdText.match(/=== 사용자 요구사항[^=]*===([\s\S]*)$/)
    const requirementsText = reqMatch ? reqMatch[1].trim() : undefined

    // Step 2: 화면 생성 + flows 추출 병렬 실행
    console.log(`[mockup v3] Step 2: generating ${spec.screens.length} screens + flows in parallel`)
    const systemPrompt = type === 'hifi' ? `${HIFI_SYSTEM}\n\n${MCDS_CONVENTIONS}` : LOFI_SYSTEM

    const [results, extractedFlows] = await Promise.all([
      Promise.all(
        spec.screens.map(async screen => {
          try {
            return await generateScreen(anthropic, screen, spec.screens, type, systemPrompt, requirementsText)
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
    // hifi는 react-ts 템플릿(/App.tsx + MCDS 주입), lofi는 react 템플릿(/App.js)
    return Response.json({ files: { [type === 'hifi' ? '/App.tsx' : '/App.js']: appCode } })

  } catch (error) {
    console.error('[mockup v3] 오류:', error)
    if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
      return Response.json({ error: 'API 키가 필요합니다.' }, { status: 500 })
    }
    return Response.json({ error: '목업 생성 중 오류가 발생했습니다' }, { status: 500 })
  }
}
