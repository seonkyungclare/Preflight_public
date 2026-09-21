// ============================================================================
// Preflight v3.0 서버 채점기
// ----------------------------------------------------------------------------
// 모델은 섹션·하위 항목의 present/partial/missing 판정과 감점 제안만 낸다.
// 최종 점수·게이트·is_sufficient는 여기서 결정적으로 계산해 재현성을 확보한다.
// 클라이언트(ResultScreen)와 서버(analyze route)가 타입을 공유한다.
// ============================================================================

import { PGT_TEMPLATE, PGT_REQUIRED_BUDGET, type HardGateDef } from '@/config/prd-template'

export type CoverageStatus = 'present' | 'partial' | 'missing' | 'not_applicable'

export interface SubItemCoverage {
  id: string
  label: string
  status: CoverageStatus
  max: number
  deduction: number
  missing: string[]
}

export interface SectionCoverage {
  section_id: string
  title: string
  requirement: 'required' | 'conditional' | 'not_applicable'
  status: CoverageStatus
  max_deduction: number
  deduction: number
  evidence: string
  sub_items: SubItemCoverage[]
}

export interface HardGateResult extends HardGateDef {
  triggered: boolean
  reason: string
}

export interface DefinedActor {
  name: string
  definition?: string
  entry_path?: string
  permission_scope?: string
  /** 정의·진입 경로·권한 범위 중 채워진 필드 수 (0~3) */
  completeness: number
}

export interface UndefinedActor {
  name: string
  where: string
  quote: string
}

export interface ActorsSummary {
  defined: DefinedActor[]
  detected_undefined: UndefinedActor[]
}

export interface ScenariosSummary {
  map_count: number
  milestone_defined: boolean
  detail_count: number
  actors_without_scenario: string[]
  scenarios_without_screen_ref: string[]
}

export interface AnalysisSummary {
  /** 서버가 확정: 게이트 미발동 && 점수 ≥ 80 */
  can_start: boolean
  verdict: string
  top_fixes: string[]
}

export interface CrossReferenceIssue {
  check: string
  detail: string
  severity: 1 | 2 | 3 | 4
}

/** 모델이 tool 로 제출하는 v3 원본 (점수 미포함) */
export interface RawV3Analysis {
  summary?: Partial<AnalysisSummary>
  section_coverage: Array<{
    section_id: string
    status: CoverageStatus
    evidence?: string
    sub_items?: Array<{ id: string; status: CoverageStatus; deduction?: number; missing?: string[] }>
  }>
  actors?: {
    defined?: Array<Omit<DefinedActor, 'completeness'> & { completeness?: number }>
    detected_undefined?: Array<Partial<UndefinedActor> & { name: string }>
  }
  scenarios?: Partial<ScenariosSummary>
  cross_reference_issues?: CrossReferenceIssue[]
  validated?: string[]
  missing_for_designers?: unknown[]
  missing_for_developers?: unknown[]
  critical_questions?: unknown[]
  ux_recommendations?: unknown[]
  severity_summary?: unknown
  mockup_directives?: unknown
}

export interface ScoredV3Analysis {
  template: 'partner-growth'
  protocol_version: '3.0'
  template_ref: string
  sufficiency_score: number
  is_sufficient: boolean
  raw_score: number
  summary: AnalysisSummary
  hard_gates: HardGateResult[]
  section_coverage: SectionCoverage[]
  actors: ActorsSummary
  scenarios: ScenariosSummary
  cross_reference_issues: CrossReferenceIssue[]
  validated: string[]
  missing_for_designers: unknown[]
  missing_for_developers: unknown[]
  critical_questions: unknown[]
  ux_recommendations: unknown[]
  severity_summary: unknown
  mockup_directives: unknown
}

/** 결과 객체가 v3(Partner Growth) 프로토콜인지. 히스토리의 v1/v2 결과와 구분할 때 쓴다. */
export function isV3Result(r: { protocol_version?: string; section_coverage?: unknown } | null | undefined): boolean {
  return !!r && (r.protocol_version === '3.0' || Array.isArray(r.section_coverage))
}

/**
 * 모델이 배열 대신 객체({ "§3": {...} } 또는 { "3.1-a": "partial" })로 보내는 경우가 있다.
 * 키를 id 로 승격해 배열로 맞춘다. 배열이면 그대로, 그 외는 빈 배열.
 */
export function asList<T extends object>(v: unknown, idKey: string): T[] {
  if (Array.isArray(v)) return v.filter(x => x && typeof x === 'object') as T[]
  if (v && typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>).map(([k, val]) =>
      val && typeof val === 'object'
        ? ({ [idKey]: k, ...(val as object) } as T)
        : ({ [idKey]: k, status: val } as unknown as T),
    )
  }
  return []
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const toInt = (n: unknown, fallback = 0) => {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : fallback
  return v
}

/**
 * 모델 판정을 템플릿 상수에 맞춰 정규화한다.
 * - 모델이 빠뜨린 섹션/하위 항목은 missing 으로 채운다 (누락 = 감점).
 * - 감점은 하위 항목 max 를 넘지 못한다. status 와 모순되면 status 를 우선한다.
 */
/** "§3", "3. Actor & 권한 체계", 3 → "3" */
function sectionKey(id: unknown): string {
  const m = String(id ?? '').match(/\d+/)
  return m ? m[0] : String(id ?? '')
}

/** "3.1-a", "3.1a", "§3.1 (a)" → "3.1a" — 숫자·점·영문만 남긴다 */
function subItemKey(id: unknown): string {
  return String(id ?? '')
    .toLowerCase()
    .replace(/[^0-9a-z.]/g, '')
}

type RawSection = RawV3Analysis['section_coverage'][number]
type RawSubItem = NonNullable<RawSection['sub_items']>[number]

function normalizeSections(rawInput: unknown): SectionCoverage[] {
  const raw = asList<RawSection>(rawInput, 'section_id')
  const byId = new Map(raw.map(s => [sectionKey(s.section_id), s]))

  return PGT_TEMPLATE.sections.map(def => {
    const r = byId.get(def.id)
    const subById = new Map(asList<RawSubItem>(r?.sub_items, 'id').map(s => [subItemKey(s.id), s]))

    // 섹션 상태
    let status: CoverageStatus = r?.status ?? 'missing'
    if (def.requirement === 'required' && status === 'not_applicable') status = 'missing'
    // §1 은 KTLO 명시 시에만 not_applicable 허용 — 모델 판단을 존중

    const sub_items: SubItemCoverage[] = def.subItems.map(sd => {
      const rs = subById.get(subItemKey(sd.id))
      let sStatus: CoverageStatus = rs?.status ?? (status === 'not_applicable' ? 'not_applicable' : 'missing')
      let deduction: number

      if (status === 'not_applicable') {
        sStatus = 'not_applicable'
        deduction = 0
      } else if (status === 'missing') {
        sStatus = 'missing'
        deduction = sd.max
      } else {
        switch (sStatus) {
          case 'present':
            deduction = 0
            break
          case 'missing':
            deduction = sd.max
            break
          case 'not_applicable':
            deduction = 0
            break
          case 'partial':
          default: {
            const proposed = toInt(rs?.deduction, Math.ceil(sd.max / 2))
            // partial 인데 0 이면 최소 1점은 깎는다 (partial 의 의미 유지).
            // 상한에 닿아도 status 는 partial 로 둔다 — "있는데 부족"과 "없음"은 게이트 판정에서 다르다.
            deduction = clamp(proposed, sd.max > 0 ? 1 : 0, sd.max)
          }
        }
      }

      return {
        id: sd.id,
        label: sd.label,
        status: sStatus,
        max: sd.max,
        deduction,
        missing: Array.isArray(rs?.missing) ? rs!.missing.filter(m => typeof m === 'string') : [],
      }
    })

    const deduction = clamp(sub_items.reduce((s, i) => s + i.deduction, 0), 0, def.max)

    // 섹션 상태를 하위 항목 결과와 일치시킨다.
    // missing 은 모델이 "섹션 자체가 없다"고 한 경우만 유지한다 (감점 합이 상한에 닿았다고 missing 으로 바꾸지 않는다).
    if (status !== 'not_applicable' && status !== 'missing') {
      status = deduction === 0 ? 'present' : 'partial'
    }

    return {
      section_id: def.id,
      title: def.title,
      requirement: status === 'not_applicable' ? 'not_applicable' : def.requirement,
      status,
      max_deduction: def.max,
      deduction,
      evidence: typeof r?.evidence === 'string' ? r.evidence : '',
      sub_items,
    }
  })
}

function normalizeActors(raw?: RawV3Analysis['actors']): ActorsSummary {
  const defined = Array.isArray(raw?.defined)
    ? raw!.defined
        .filter(a => a && typeof a.name === 'string')
        .map(a => {
          const fields = [a.definition, a.entry_path, a.permission_scope]
          const completeness = fields.filter(f => typeof f === 'string' && f.trim().length > 0).length
          return { ...a, completeness }
        })
    : []
  const detected_undefined = Array.isArray(raw?.detected_undefined)
    ? raw!.detected_undefined.filter(a => a && typeof a.name === 'string').map(a => ({
        name: a.name,
        where: a.where ?? '',
        quote: a.quote ?? '',
      }))
    : []
  return { defined, detected_undefined }
}

function normalizeScenarios(raw?: Partial<ScenariosSummary>): ScenariosSummary {
  return {
    map_count: toInt(raw?.map_count, 0),
    milestone_defined: raw?.milestone_defined === true,
    detail_count: toInt(raw?.detail_count, 0),
    actors_without_scenario: Array.isArray(raw?.actors_without_scenario) ? raw!.actors_without_scenario : [],
    scenarios_without_screen_ref: Array.isArray(raw?.scenarios_without_screen_ref)
      ? raw!.scenarios_without_screen_ref
      : [],
  }
}

function evaluateGates(sections: SectionCoverage[], actors: ActorsSummary): HardGateResult[] {
  const sec = (id: string) => sections.find(s => s.section_id === id)
  const sub = (sectionId: string, subId: string) => sec(sectionId)?.sub_items.find(i => i.id === subId)

  return PGT_TEMPLATE.gates.map(g => {
    let triggered = false
    let reason = ''
    switch (g.id) {
      case 'G1':
        triggered = sec('5')?.status === 'missing'
        reason = triggered ? '§5 유저 시나리오 섹션을 찾지 못했습니다' : ''
        break
      case 'G2':
        // "표가 없다" = 섹션 자체가 없거나, 정의된 Actor 가 하나도 없다.
        // 미정의 Actor 가 많아 3.1-a 감점이 상한에 닿은 경우는 G3 의 영역이지 G2 가 아니다.
        triggered =
          sec('3')?.status === 'missing' ||
          (actors.defined.length === 0 && sub('3', '3.1-a')?.status === 'missing')
        reason = triggered ? '§3.1 Actor 정의 표를 찾지 못했습니다' : ''
        break
      case 'G3':
        triggered = actors.detected_undefined.length > 0
        reason = triggered
          ? `정의되지 않은 Actor: ${actors.detected_undefined.map(a => a.name).join(', ')}`
          : ''
        break
      case 'G4':
        triggered = sec('8')?.status === 'missing'
        reason = triggered ? '§8 화면 요구사항 섹션을 찾지 못했습니다' : ''
        break
    }
    return { ...g, triggered, reason }
  })
}

/**
 * 번역투 안전장치. 모델이 굳어진 UI 용어를 새로 번역해 내면 출력 직전에 되돌린다.
 * 원본 규칙: docs/analysis-writing-rules.md §6-0. 새 번역투가 보이면 여기와 문서에 함께 추가.
 */
export const TERM_FIXES: Array<[RegExp, string]> = [
  [/날짜\s?선택기|날짜\s?피커/g, 'Date Picker'],
  [/펼침\s?목록|드롭다운\s?(목록|메뉴)|드롭 ?다운/g, 'Dropdown'],
  [/말풍선\s?도움말|도움말\s?풍선|풍선\s?도움말/g, 'Tooltip'],
  [/알림\s?띠|알림\s?바|스낵바/g, 'Snackbar'],
  [/확인\s?대화\s?상자|대화\s?상자|확인\s?팝업|모달\s?창|모달/g, 'Dialog'],
  [/표\s?머리글/g, 'Table 헤더'],
  [/체크\s?상자|확인란/g, 'Checkbox'],
  [/라디오\s?단추|라디오\s?버튼/g, 'Radio'],
  [/토글\s?스위치|전환\s?스위치/g, 'Switch'],
  [/페이지\s?매김|페이지\s?네이션/g, 'Pagination'],
  [/불러오는\s?중/g, '로딩 중'],
  [/탭\s?메뉴/g, 'Tab'],
]

/** 결과 객체의 모든 문자열에 TERM_FIXES 를 적용한다 (키는 건드리지 않음) */
export function applyTermFixes(value: unknown): unknown {
  if (typeof value === 'string') {
    let out = value
    for (const [re, to] of TERM_FIXES) out = out.replace(re, to)
    return out
  }
  if (Array.isArray(value)) return value.map(v => applyTermFixes(v))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = applyTermFixes(v)
    return out
  }
  return value
}

function countSeverity(items: unknown[]): { catastrophic: number; major: number; minor: number; cosmetic: number } {
  const c = { catastrophic: 0, major: 0, minor: 0, cosmetic: 0 }
  for (const it of items) {
    const sev = (it as { severity?: unknown })?.severity
    if (sev === 4) c.catastrophic++
    else if (sev === 3) c.major++
    else if (sev === 2) c.minor++
    else if (sev === 1) c.cosmetic++
  }
  return c
}

/**
 * 모델 원본 → 점수가 확정된 v3 결과.
 *
 *   raw   = 100 − Σ(필수 섹션 감점) − Σ(조건부 섹션 감점, 해당 시)
 *   score = max(0, min(raw, 발동한 게이트 상한들의 최솟값))
 */
export function finalizeV3Analysis(raw: RawV3Analysis): ScoredV3Analysis {
  const section_coverage = normalizeSections(raw.section_coverage)
  const actors = normalizeActors(raw.actors)
  const scenarios = normalizeScenarios(raw.scenarios)
  const hard_gates = evaluateGates(section_coverage, actors)

  const totalDeduction = section_coverage.reduce((sum, s) => sum + s.deduction, 0)
  const raw_score = clamp(100 - totalDeduction, 0, 100)
  const caps = hard_gates.filter(g => g.triggered).map(g => g.cap)
  const capped = caps.length > 0 ? Math.min(raw_score, ...caps) : raw_score
  const sufficiency_score = clamp(Math.round(capped), 0, 100)

  const designers = Array.isArray(raw.missing_for_designers) ? raw.missing_for_designers : []
  const developers = Array.isArray(raw.missing_for_developers) ? raw.missing_for_developers : []
  const questions = Array.isArray(raw.critical_questions) ? [...raw.critical_questions] : []

  // 미정의 Actor 는 반드시 [비즈니스] 질문이 있어야 한다 — B 호출이 놓쳤으면 서버가 보강
  for (const a of actors.detected_undefined) {
    const covered = questions.some(q => {
      const text = typeof q === 'string' ? q : JSON.stringify(q)
      return text.includes(a.name)
    })
    if (!covered) {
      questions.unshift({
        tag: '[비즈니스]',
        question: `"${a.name}"은(는) 별도 Actor로 정의해야 하나요, 아니면 기존 Actor에 포함되나요?`,
        format: 'binary',
        options: ['별도 Actor로 정의 (권한 분리)', '기존 Actor에 포함'],
        impact: 'Actor 표(3번 섹션)·권한 매트릭스·화면별 노출 범위',
        blocks: ['§3.1 Actor 정의', '§3.2 권한 매트릭스'],
      })
    }
  }

  const cross_reference_issues = Array.isArray(raw.cross_reference_issues)
    ? raw.cross_reference_issues
        .filter(i => i && typeof i.detail === 'string')
        .map(i => ({ check: i.check ?? '', detail: i.detail, severity: (clamp(toInt(i.severity, 2), 1, 4) as 1 | 2 | 3 | 4) }))
    : []

  const is_sufficient = sufficiency_score >= 80
  const topFixes = Array.isArray(raw.summary?.top_fixes)
    ? raw.summary!.top_fixes.filter(t => typeof t === 'string' && t.trim()).slice(0, 3)
    : []
  const summary: AnalysisSummary = {
    // 모델의 판단보다 서버 점수·게이트가 우선한다
    can_start: is_sufficient,
    verdict:
      typeof raw.summary?.verdict === 'string' && raw.summary.verdict.trim()
        ? raw.summary.verdict.trim()
        : is_sufficient
          ? '지금 디자인·개발을 시작해도 됩니다.'
          : '아직 시작하기 어렵습니다. 아래 항목부터 채워주세요.',
    top_fixes: topFixes,
  }

  return applyTermFixes({
    template: 'partner-growth',
    protocol_version: '3.0',
    template_ref: PGT_TEMPLATE.ref,
    sufficiency_score,
    is_sufficient,
    raw_score,
    summary,
    hard_gates,
    section_coverage,
    actors,
    scenarios,
    cross_reference_issues,
    validated: Array.isArray(raw.validated) ? raw.validated : [],
    missing_for_designers: designers,
    missing_for_developers: developers,
    critical_questions: questions,
    ux_recommendations: Array.isArray(raw.ux_recommendations) ? raw.ux_recommendations : [],
    // 심각도 집계는 서버가 한다 (모델 출력 절약 + 일관성)
    severity_summary: countSeverity([...designers, ...developers, ...cross_reference_issues]),
    mockup_directives: raw.mockup_directives ?? {},
  } satisfies ScoredV3Analysis) as ScoredV3Analysis
}

// 템플릿 상수 무결성 — 필수 예산 합이 100 이 아니면 개발 중 바로 드러나게 한다
if (process.env.NODE_ENV !== 'production') {
  if (PGT_REQUIRED_BUDGET !== 100) {
    console.warn(`[scoring] PGT 필수 섹션 감점 예산 합계가 ${PGT_REQUIRED_BUDGET} 입니다 (기대값 100). prd-template.ts 를 확인하세요.`)
  }
  for (const s of PGT_TEMPLATE.sections) {
    const subSum = s.subItems.reduce((a, i) => a + i.max, 0)
    if (subSum !== s.max) {
      console.warn(`[scoring] §${s.id} ${s.title}: 하위 항목 합 ${subSum} ≠ 섹션 max ${s.max}`)
    }
  }
}
