// ─── 채점 기준의 원본 (single source of truth) ─────────────────────────────────
// 차원·가중치·가점·판정 라벨·표시 파생값은 전부 이 파일에서 나온다.
// 채점 지시문은 src/lib/prompt.ts가 여기서 조립하고, 화면(ResultScreen)도 이 파일을
// 참조한다. 기준을 바꿀 때는 이 파일 하나만 고친다.
//
// ⚠️ 가중치를 AI에게 알려주지 않는다.
// AI는 문서 유형(project_type)만 판별하고, 유형별 가중치 표는 코드가 갖는다.
// 이렇게 나눠야 배점을 바꿔도 지시문이 안 바뀌고, 저장된 응답으로 새 배점을
// 재계산해 비교할 수 있다. (기존 구조는 AI가 applied_weights까지 출력했다)

export const AI_SCALE = 10

// ─── 문서 유형 ────────────────────────────────────────────────────────────────
// 같은 항목이라도 문서 성격에 따라 중요도가 다르다. 결제 흐름에서는 실패 처리가
// 결정적이고, 온보딩에서는 대상 사용자와 과업이 결정적이다.

export const PROJECT_TYPES = ['transaction', 'management', 'discovery', 'onboarding'] as const
export type ProjectType = (typeof PROJECT_TYPES)[number]
export const DEFAULT_PROJECT_TYPE: ProjectType = 'management'

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  transaction: '결제·주문형',
  management: '운영·어드민형',
  discovery: '탐색·조회형',
  onboarding: '온보딩·입점형',
}

export const PROJECT_TYPE_HINTS: Record<ProjectType, string> = {
  transaction: '결제, 주문, 체크아웃, 구독 등 금전 거래가 중심인 문서',
  management: '어드민, 운영 도구, 등록·수정·조회가 중심인 문서',
  discovery: '검색, 필터, 탐색, 추천이 중심인 문서',
  onboarding: '가입, 입점, 첫 사용 안내가 중심인 문서',
}

// ─── 기본 차원 (유형별 가중치 합 = 90) ────────────────────────────────────────
// 2026-08 개편: 화면 목록·화면별 상태·CTA 위계를 채점에서 뺐다.
// 셋 다 화면 단계의 산출물이라 PRD에 요구하면 템플릿("PM은 화면을 그리지 않는다")과
// 충돌한다. 기준선 측정에서 사내 최고 수준 PRD가 50점을 못 넘긴 원인이었다.
// 없애는 게 아니라 UX 스펙 단계로 옮긴 것이며, 화면 목록이 있으면 가점한다.

export interface RubricDimension {
  key: string // AI 응답 criteria 키
  label: string // 화면 표시명
  principle: string // 근거 UX 원칙 (표시·프롬프트 공용)
  focus: string // "무엇을 보는가"
  bands: string[] // 점수 구간별 판정 기준 (9~10 → 1~2 순)
  weights: Record<ProjectType, number>
}

export const DIMENSIONS: RubricDimension[] = [
  {
    key: '기능_정책_해상도',
    label: '기능·정책 해상도',
    principle: '구현 가능성 — 규칙이 해석 없이 읽히는가',
    focus:
      '무엇을 만드는지와 어떤 규칙으로 동작하는지가 구현 가능한 수준으로 적혔는가. ' +
      '정책·분기·계산 규칙·제약의 해상도를 본다. 화면 생김새는 보지 않는다.',
    bands: [
      '9~10: 정책·규칙이 예외 상황까지 서술 + 계산·판정 기준이 수치나 조건으로 특정 + 규칙 간 충돌 해소 방식 명시',
      '7~8: 주요 정책이 서술되나 일부 예외나 경계값이 미정의',
      '5~6: 무엇을 하는지는 분명하나 어떤 규칙으로 동작하는지가 부분적',
      '3~4: 기능 이름과 목적만 있고 규칙 서술이 거의 없음',
      '1~2: "무엇을 만든다" 수준의 서술만 존재',
    ],
    weights: { transaction: 25, management: 30, discovery: 20, onboarding: 20 },
  },
  {
    key: '상태_분기_조건',
    label: '상태 분기 조건',
    principle: 'NN#1 시스템 상태 가시성 — 단, PRD 단계에서는 조건 자체를 본다',
    focus:
      '"언제 무엇이 달라지는가"가 정의되었는가. 조건별 동작 차이, 권한·상태별 차이, ' +
      '값이 있고 없을 때의 차이 같은 논리적 분기를 본다. ' +
      '⚠️ 화면의 빈 상태·로딩 표현을 요구하지 마라. 그건 다음 단계의 몫이다.',
    bands: [
      '9~10: 조건별 동작 차이가 표나 목록으로 정리 + 권한·상태별 차이 + 값 유무에 따른 분기까지 명시',
      '7~8: 주요 분기가 정의되나 일부 조건 조합이 누락',
      '5~6: 분기의 존재는 언급되나 조건이 모호함("경우에 따라", "상황에 맞게")',
      '3~4: 정상 흐름만 서술되고 조건 분기가 거의 없음',
      '1~2: 조건에 따른 차이가 언급되지 않음',
    ],
    weights: { transaction: 15, management: 20, discovery: 15, onboarding: 10 },
  },
  {
    key: '엣지케이스_롤백',
    label: '엣지케이스·롤백',
    principle: 'NN#5 오류 예방, NN#9 오류 복구',
    focus:
      '극단값과 실패 상황, 되돌리기 정책이 다뤄졌는가. ' +
      '실패했을 때 데이터가 어떤 상태로 남는지, 부분 성공을 허용하는지를 본다.',
    bands: [
      '9~10: 0건·최대치·권한 없음·중단 등 극단 상황 + 실패 시 데이터 상태 정책 + 되돌리기 방식까지 정의',
      '7~8: 극단 상황 일부 + 실패 처리 방향이 제시됨',
      '5~6: 실패를 언급하나 그때 데이터가 어떻게 남는지는 미정의',
      '3~4: 정상 경로만 서술하고 예외는 "추후 정의"로 미룸',
      '1~2: 예외 상황 언급이 없음',
    ],
    weights: { transaction: 25, management: 15, discovery: 10, onboarding: 10 },
  },
  {
    key: '범위_대상_사용자',
    label: '범위·대상 사용자',
    principle: '기대치 정렬 — 무엇을 안 하는지가 무엇을 하는지만큼 중요하다',
    focus:
      '이번에 하는 것과 하지 않는 것의 경계가 그어졌는가. 누가 쓰는 기능인지, ' +
      '그 사용자가 어떤 맥락과 숙련도를 가졌는지가 적혔는가.',
    bands: [
      '9~10: 포함/미포함이 항목 단위로 구분 + 제외 사유 명시 + 대상 사용자의 맥락·사용 빈도·숙련도 서술',
      '7~8: 범위 경계는 있으나 제외 사유가 없거나, 대상 서술이 역할명 수준에 그침',
      '5~6: 하는 것만 있고 안 하는 것이 불명확',
      '3~4: 범위가 본문 문장 속에 섞여 있어 경계를 잡기 어려움',
      '1~2: 범위와 대상 사용자 서술이 없음',
    ],
    weights: { transaction: 10, management: 10, discovery: 20, onboarding: 20 },
  },
  {
    key: '미결정_명시성',
    label: '미결정 명시성',
    principle: '정직성 — 모르는 것을 지어내지 않았는가',
    focus:
      '아직 정하지 못한 것을 "정하지 못했다"고 밝혔는가. 결정 주체나 기한까지 적혔으면 더 높다.\n' +
      '⚠️ 이 차원은 방향이 반대다. 미결정이 적다고 높게 주지 마라. ' +
      '명시된 미결정이 많을수록 높고, 침묵(공백인데 언급조차 없음)이 가장 낮다. ' +
      '없는 정책을 지어 쓴 문서가 이 항목에서 이득을 보면 안 된다.',
    bands: [
      '9~10: 미결정이 목록으로 분리 + 각각 결정 주체와 기한 + 본문 안에서도 [미정] 표기가 일관됨',
      '7~8: 미결정이 명시되나 결정 주체나 기한이 일부 누락',
      '5~6: 오픈 이슈 항목은 있으나 내용이 비었거나 1~2건에 그침',
      '3~4: 미결정 언급이 산발적이라 어디까지 정해졌는지 판단하기 어려움',
      '1~2: 미결정 표기가 없어 전부 확정된 것처럼 읽히나 실제로는 공백이 존재함',
    ],
    weights: { transaction: 10, management: 10, discovery: 10, onboarding: 10 },
  },
  {
    key: '핵심_과업_명확성',
    label: '핵심 과업 명확성',
    principle: 'Fogg 행동 모델 — 무엇을 완수하게 할 것인가',
    focus:
      '사용자가 이 기능으로 무엇을 완수하는지, 그게 왜 필요한지가 분명한가. ' +
      '해결하려는 문제와 성공 판단 기준을 본다.',
    bands: [
      '9~10: 사용자가 완수할 과업이 문장으로 정의 + 해결하려는 문제 + 성공 판단 기준(지표)까지 제시',
      '7~8: 과업과 문제는 분명하나 성공 기준이 정성적 서술에 그침',
      '5~6: 목적은 있으나 사용자 관점의 과업으로 환원되지 않음',
      '3~4: "~를 개선한다" 수준의 추상적 목표만 존재',
      '1~2: 왜 만드는지가 불명확',
    ],
    weights: { transaction: 5, management: 5, discovery: 15, onboarding: 20 },
  },
]

export const DIMENSION_KEYS = DIMENSIONS.map(d => d.key)

// 유형별 가중치 합 (전부 90이어야 한다 — 나머지 10은 가점)
export function weightsFor(type: ProjectType): Record<string, number> {
  return Object.fromEntries(DIMENSIONS.map(d => [d.key, d.weights[type]]))
}

export const BASE_POINTS = 90

export function dimensionLabel(key: string): string | undefined {
  return DIMENSIONS.find(d => d.key === key)?.label
}

export function isProjectType(v: unknown): v is ProjectType {
  return typeof v === 'string' && (PROJECT_TYPES as readonly string[]).includes(v)
}

// ─── 가점 (합 10) ─────────────────────────────────────────────────────────────
// 화면 목록은 PRD의 의무가 아니지만, 있으면 다음 단계가 확실히 빨라진다.
// 없다고 벌주지 않되 있으면 보상한다 — 감점과 가점은 유인이 정반대다.
//
// ⚠️ 조건 없음. 처음에는 "확정 아님" 표시가 있을 때만 가점하려 했으나 뺐다.
// 규칙이 PM에게 안 보이고, 판정이 애매해 흔들리며, 상태 초안 가점과 기준이
// 어긋났기 때문. 대신 확정 표시가 없으면 advisories로 안내만 한다(점수 영향 없음).

export interface RubricBonus {
  key: string
  label: string
  points: number
  focus: string
}

export const BONUSES: RubricBonus[] = [
  {
    key: '화면_목록',
    label: '화면 목록',
    points: 5,
    focus: '이 기능에 어떤 화면이 필요한지 목록이나 구성이 제시되어 있는가',
  },
  {
    key: '참고_화면',
    label: '참고 화면',
    points: 3,
    focus: '참고할 기존 화면·유사 사례·경쟁사 레퍼런스가 제시되어 있는가',
  },
  {
    key: '상태_초안',
    label: '화면 상태 초안',
    points: 2,
    focus: '화면의 상태(비어 있을 때·불러오는 중·오류 등) 초안이 있는가. 문구가 미정이어도 무방',
  },
]

export const BONUS_POINTS = BONUSES.reduce((s, b) => s + b.points, 0)
export const MAX_POINTS = BASE_POINTS + BONUS_POINTS

export function bonusTotal(signals: Record<string, boolean> | undefined): number {
  if (!signals) return 0
  return BONUSES.reduce((s, b) => s + (signals[b.key] ? b.points : 0), 0)
}

export function bonusBreakdown(
  signals: Record<string, boolean> | undefined
): Array<{ label: string; points: number; earned: boolean }> {
  return BONUSES.map(b => ({
    label: b.label,
    points: b.points,
    earned: Boolean(signals?.[b.key]),
  }))
}

// 점수와 무관한 안내 — 조건이 맞으면 결과 화면에 뜬다.
export function buildAdvisories(signals: Record<string, boolean> | undefined): string[] {
  const out: string[] = []
  if (signals?.['화면_목록'] && !signals?.['화면_목록_확정표시']) {
    out.push(
      '화면 목록이 있습니다. 이게 확정안이 아니라 참고안이라면 문서에 그렇게 밝혀두세요. ' +
        '나중에 기획이 바뀌어도 이 목록이 확정안처럼 읽히는 걸 막을 수 있습니다.'
    )
  }
  return out
}

// ─── 판정 ─────────────────────────────────────────────────────────────────────
// 라벨은 측정 범위만 말한다. 이 도구가 보는 것은 "디자인 착수 가능" 여부까지다.
// 데이터 규칙·연동·권한·성능은 보지 않으므로 "개발 준비 완료"라고 말할 수 없다.
//
// ⚠️ 판정은 기본 점수(0~90)로만 한다. 가점은 표시용이다.
// 총점으로 판정하면 기본 75 + 가점 10 = 85가 되어, 정책이 부실한 문서가
// 화면 목록을 붙였다는 이유로 통과하는 통로가 열린다.
//
// ⚠️ 임계값은 잠정값이다. 구 기준 80/100(80%)을 90점 만점에 비례 적용했다.
// "이 PRD로 실제 디자인을 시작할 수 있었나"를 사람이 답해야 확정할 수 있다.

export interface RubricVerdict {
  min: number
  key: 'ready' | 'refine' | 'rewrite'
  label: string
  color: string
  badgeClass: string
}

export const VERDICTS: RubricVerdict[] = [
  { min: 72, key: 'ready', label: '디자인 착수 가능', color: '#22c55e', badgeClass: 'bg-green-500/10 border-green-500/30' },
  { min: 54, key: 'refine', label: '보완 필요', color: '#f59e0b', badgeClass: 'bg-amber-500/10 border-amber-500/30' },
  { min: 0, key: 'rewrite', label: '재작성 권장', color: '#ef4444', badgeClass: 'bg-red-500/10 border-red-500/30' },
]

export const READY_MIN = VERDICTS.find(v => v.key === 'ready')!.min

export function verdictOf(baseScore: number): RubricVerdict {
  return VERDICTS.find(v => baseScore >= v.min) ?? VERDICTS[VERDICTS.length - 1]
}

// ─── 점수 계산 ────────────────────────────────────────────────────────────────
// 서버가 이 함수로 재계산한다. AI가 자칭한 총점은 쓰지 않는다.

// 기본 점수 0~90. 차원 점수가 null(해당 없음)이면 그 차원은 빼고 남은 가중치로 환산한다.
export function computeBase(
  criteria: Record<string, { score: number | null }>,
  type: ProjectType
): number {
  const w = weightsFor(type)
  let earned = 0
  let applicable = 0
  for (const d of DIMENSIONS) {
    const s = criteria[d.key]?.score
    if (s === null || s === undefined) continue
    applicable += w[d.key]
    earned += s * (w[d.key] / AI_SCALE)
  }
  if (applicable === 0) return 0
  // 해당 없는 차원이 있으면 남은 가중치를 90점 기준으로 환산
  return Math.round((earned * BASE_POINTS) / applicable)
}

export function computeTotal(
  criteria: Record<string, { score: number | null }>,
  type: ProjectType,
  signals?: Record<string, boolean>
): number {
  return computeBase(criteria, type) + bonusTotal(signals)
}

// ─── 화면 표시 파생값 ─────────────────────────────────────────────────────────

export function criterionColor(score: number): { text: string; bar: string } {
  const ratio = score / AI_SCALE
  if (ratio >= 0.8) return { text: '#22c55e', bar: 'bg-green-500' }
  if (ratio >= 0.5) return { text: '#f59e0b', bar: 'bg-amber-500' }
  return { text: '#ef4444', bar: 'bg-red-500' }
}

// 표시 전환용 — 점수 대신 신호등을 1차 정보로 올릴 때 쓴다.
export type SignalLevel = '충분' | '보완' | '누락'

export function signalOf(score: number): SignalLevel {
  const ratio = score / AI_SCALE
  if (ratio >= 0.8) return '충분'
  if (ratio >= 0.5) return '보완'
  return '누락'
}
