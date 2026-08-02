import {
  AI_SCALE,
  BONUSES,
  DEFAULT_PROJECT_TYPE,
  DIMENSIONS,
  READY_MIN,
  bonusTotal,
  buildAdvisories,
  computeBase,
  isProjectType,
  weightsFor,
  type ProjectType,
} from './rubric'

// ─── 분석 결과의 공유 타입 ────────────────────────────────────────────────────
// 서버(route)와 화면(page·ResultScreen·MockupScreen)이 같은 타입을 쓴다.

export interface CriterionResult {
  score: number | null // null = 이 문서에 해당 없음
  notes?: string
  evidence?: string
  missing?: string[]
  applied_principle?: string
}

export interface MissingItem {
  screen: string
  owner?: string // 'PM' | '다음단계'
  issue: string
  suggestion: string
  principle?: string
  severity?: 1 | 2 | 3 | 4
  user_impact?: string
}

export interface DevItem {
  module: string
  area?: string // 'FE' | 'BE'
  owner?: string
  issue: string
  suggestion: string
  risk?: string
  severity?: 1 | 2 | 3 | 4
}

export interface CriticalQuestionV2 {
  tag: string
  question: string
  format?: 'binary' | 'multiple' | 'open'
  options?: string[]
  impact?: string
  blocks?: string[]
}

export interface UxRecommendationV2 {
  recommendation: string
  principle?: string
  perspective?: string
  effort?: string
  expected_impact?: string
}

export interface MockupDirectives {
  attention_areas?: Array<{ dimension: string; score: number; focus: string; render_hint?: string }>
  forced_states?: string[]
  critical_screens?: string[]
  note_panel_priority?: string[]
}

export interface SeveritySummary {
  catastrophic: number
  major: number
  minor: number
  cosmetic: number
}

export interface AnalysisResult {
  sufficiency_score: number // 표시 총점 = 기본 + 가점 (0~100)
  base_score: number // 기본 점수 (0~90) — 판정은 이 값으로만
  bonus_score: number // 가점 합 (0~10) — 표시용
  bonus_signals: Record<string, boolean>
  advisories: string[] // 점수에 영향 없는 안내
  is_sufficient: boolean
  project_type: ProjectType
  applied_weights: Record<string, number> // 서버가 유형에서 파생 (AI가 주지 않음)
  validated: string[]
  criteria: Record<string, CriterionResult>
  missing_for_designers: MissingItem[]
  missing_for_developers: DevItem[]
  critical_questions: Array<string | CriticalQuestionV2>
  ux_recommendations: Array<string | UxRecommendationV2>
  severity_summary?: SeveritySummary
  mockup_directives?: MockupDirectives
}

// 서버 → 클라이언트 응답 봉투.
// ok=true면 analysis는 서버 재계산이 끝난 완성본, ok=false면 raw로 원문 폴백 표시.
export interface AnalyzeEnvelope {
  ok: boolean
  analysis?: AnalysisResult
  raw: string | null
  warnings: string[]
  error?: string
}

// ─── 원문에서 JSON 추출 ───────────────────────────────────────────────────────

export function extractJson(raw: string): unknown | null {
  const cleaned = raw
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim()

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null

  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}

// ─── 타입가드 + 정규화 + 서버 재계산 ──────────────────────────────────────────
// 원칙:
// - criteria(채점의 핵심)가 깨졌으면 치명 실패 → 호출부가 재시도/폴백을 결정한다
// - 나머지 배열은 누락돼도 빈 목록으로 정규화하고 warnings에 남긴다
//   (2~5분짜리 분석을 통째로 버리지 않기 위해)
// - 총점·판정은 AI 자칭값을 버리고 rubric으로 재계산한다

export type ValidationOutcome =
  | { ok: true; analysis: AnalysisResult; warnings: string[] }
  | { ok: false; reason: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function normalizeStringArray(value: unknown, name: string, warnings: string[]): string[] {
  if (!Array.isArray(value)) {
    warnings.push(`${name} 누락 — 빈 목록으로 처리했습니다`)
    return []
  }
  const strings = value.filter((v): v is string => typeof v === 'string')
  if (strings.length !== value.length) {
    warnings.push(`${name}에 문자열이 아닌 항목 ${value.length - strings.length}건 제외`)
  }
  return strings
}

// 객체 배열 — 필수 필드는 문자열로 강제, 선택 필드는 있으면 그대로 옮긴다
function normalizeItemArray<T>(
  value: unknown,
  name: string,
  required: string[],
  optional: string[],
  warnings: string[]
): T[] {
  if (!Array.isArray(value)) {
    warnings.push(`${name} 누락 — 빈 목록으로 처리했습니다`)
    return []
  }
  const items = value.filter(isRecord)
  if (items.length !== value.length) {
    warnings.push(`${name}에 형식이 다른 항목 ${value.length - items.length}건 제외`)
  }
  return items.map(item => {
    const out: Record<string, unknown> = {}
    for (const f of required) out[f] = typeof item[f] === 'string' ? item[f] : ''
    for (const f of optional) if (item[f] !== undefined) out[f] = item[f]
    return out as T
  })
}

// v1(문자열) / v2(객체) 혼재를 그대로 통과시킨다 — 화면이 둘 다 렌더한다
function normalizeMixedArray(value: unknown, name: string, warnings: string[]): unknown[] {
  if (!Array.isArray(value)) {
    warnings.push(`${name} 누락 — 빈 목록으로 처리했습니다`)
    return []
  }
  return value.filter(v => typeof v === 'string' || isRecord(v))
}

export function validateAndNormalize(candidate: unknown): ValidationOutcome {
  if (!isRecord(candidate)) {
    return { ok: false, reason: '응답이 JSON 객체가 아닙니다' }
  }

  const warnings: string[] = []

  // 1) 문서 유형 — 가중치의 근거라 중요하지만, 없으면 기본값으로 이어간다
  let projectType: ProjectType = DEFAULT_PROJECT_TYPE
  if (isProjectType(candidate.project_type)) {
    projectType = candidate.project_type
  } else {
    warnings.push(`문서 유형을 판별하지 못해 기본값(${DEFAULT_PROJECT_TYPE})으로 계산했습니다`)
  }

  // 2) criteria — 치명 영역
  const rawCriteria = candidate.criteria
  if (!isRecord(rawCriteria)) {
    return { ok: false, reason: 'criteria가 없거나 객체가 아닙니다' }
  }

  const criteria: Record<string, CriterionResult> = {}
  let scoredCount = 0
  for (const d of DIMENSIONS) {
    const entry = rawCriteria[d.key]
    if (!isRecord(entry)) {
      return { ok: false, reason: `criteria.${d.key}가 없습니다` }
    }
    const rawScore = entry.score
    let score: number | null
    if (rawScore === null) {
      score = null // 해당 없음 — 가중치 환산에서 제외된다
    } else if (typeof rawScore === 'number' && !Number.isNaN(rawScore)) {
      score = Math.min(Math.max(rawScore, 0), AI_SCALE)
      if (rawScore !== score) {
        warnings.push(`criteria.${d.key} 점수 ${rawScore}가 범위(0~${AI_SCALE}) 밖 — 잘라서 사용`)
      }
      scoredCount++
    } else {
      return { ok: false, reason: `criteria.${d.key}의 score가 숫자도 null도 아닙니다` }
    }
    criteria[d.key] = {
      score,
      evidence: typeof entry.evidence === 'string' ? entry.evidence : undefined,
      missing: Array.isArray(entry.missing)
        ? entry.missing.filter((m): m is string => typeof m === 'string')
        : undefined,
      applied_principle:
        typeof entry.applied_principle === 'string' ? entry.applied_principle : d.principle,
      notes: typeof entry.notes === 'string' ? entry.notes : undefined,
    }
  }
  if (scoredCount === 0) {
    return { ok: false, reason: '점수가 매겨진 항목이 하나도 없습니다' }
  }
  // 기준에 없는 잉여 차원은 표시용으로만 유지 (총점 계산 미반영)
  for (const key of Object.keys(rawCriteria)) {
    if (criteria[key]) continue
    const entry = rawCriteria[key]
    if (isRecord(entry) && typeof entry.score === 'number') {
      criteria[key] = { score: Math.min(Math.max(entry.score, 0), AI_SCALE) }
      warnings.push(`기준에 없는 항목 ${key} — 표시만 하고 총점에는 반영하지 않음`)
    }
  }

  // 3) 가점 신호 — 없으면 전부 false (구 응답 호환)
  const rawSignals = candidate.bonus_signals
  const signals: Record<string, boolean> = {}
  if (isRecord(rawSignals)) {
    for (const b of BONUSES) signals[b.key] = rawSignals[b.key] === true
    signals['화면_목록_확정표시'] = rawSignals['화면_목록_확정표시'] === true
  } else {
    for (const b of BONUSES) signals[b.key] = false
    signals['화면_목록_확정표시'] = false
    warnings.push('bonus_signals 누락 — 가점 없음으로 처리했습니다')
  }

  // 4) 목록들
  const validated = normalizeStringArray(candidate.validated, 'validated', warnings)
  const criticalQuestions = normalizeMixedArray(candidate.critical_questions, 'critical_questions', warnings)
  const uxRecommendations = normalizeMixedArray(candidate.ux_recommendations, 'ux_recommendations', warnings)
  const missingForDesigners = normalizeItemArray<MissingItem>(
    candidate.missing_for_designers,
    'missing_for_designers',
    ['screen', 'issue', 'suggestion'],
    ['owner', 'principle', 'severity', 'user_impact'],
    warnings
  )
  const missingForDevelopers = normalizeItemArray<DevItem>(
    candidate.missing_for_developers,
    'missing_for_developers',
    ['module', 'issue', 'suggestion'],
    ['area', 'owner', 'risk', 'severity'],
    warnings
  )

  // 5) 점수·판정 재계산 — AI 자칭값은 쓰지 않는다
  // 판정은 기본 점수(0~90)로만 한다. 가점을 판정에 넣으면 정책이 부실한 문서가
  // 화면 목록을 붙였다는 이유로 통과하는 통로가 열린다(rubric.ts VERDICTS 주석 참조).
  const baseScore = computeBase(criteria, projectType)
  const bonusScore = bonusTotal(signals)
  const totalScore = baseScore + bonusScore

  const aiScore = candidate.sufficiency_score
  if (typeof aiScore === 'number' && aiScore !== totalScore) {
    warnings.push(`AI가 계산한 총점(${aiScore})과 서버 재계산(${totalScore})이 다릅니다 — 재계산 값을 사용`)
  }
  const isSufficient = baseScore >= READY_MIN
  if (typeof candidate.is_sufficient === 'boolean' && candidate.is_sufficient !== isSufficient) {
    warnings.push(`AI의 통과 판정(${candidate.is_sufficient})과 서버 판정(${isSufficient})이 다릅니다 — 서버 판정을 사용`)
  }

  return {
    ok: true,
    analysis: {
      sufficiency_score: totalScore,
      base_score: baseScore,
      bonus_score: bonusScore,
      bonus_signals: signals,
      advisories: buildAdvisories(signals),
      is_sufficient: isSufficient,
      project_type: projectType,
      applied_weights: weightsFor(projectType),
      validated,
      criteria,
      missing_for_designers: missingForDesigners,
      missing_for_developers: missingForDevelopers,
      critical_questions: criticalQuestions as Array<string | CriticalQuestionV2>,
      ux_recommendations: uxRecommendations as Array<string | UxRecommendationV2>,
      severity_summary: isRecord(candidate.severity_summary)
        ? (candidate.severity_summary as unknown as SeveritySummary)
        : undefined,
      mockup_directives: isRecord(candidate.mockup_directives)
        ? (candidate.mockup_directives as unknown as MockupDirectives)
        : undefined,
    },
    warnings,
  }
}
