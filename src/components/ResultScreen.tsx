'use client'

import { useState, useEffect } from 'react'
import type { AnalysisResult, MissingItem, DevItem, MockupType } from '@/app/page'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatHistoryDate, formatAbsoluteDateTime } from '@/lib/analysis-history'
import { DEV_READINESS, DIMENSIONS, bonusBreakdown, dimensionLabel, signalOf, type SignalLevel } from '@/lib/rubric'

interface ResultScreenProps {
  fileName: string
  result: AnalysisResult
  hasMockupLowFi: boolean
  hasMockupHiFi: boolean
  mockupLowFiAt: number | null
  mockupHiFiAt: number | null
  onGenerateMockup: (type: MockupType, regenerate?: boolean) => void
  onCancelMockup: () => void
  mockupGenerating: MockupType | null
  onReupload: () => void
  requirementsUrl: string
  onRequirementsUrlChange: (url: string) => void
  // 내용이 같아 이전 분석을 그대로 보여주는 경우, 그 분석 시각
  reusedFrom?: number | null
  // 이 결과가 채점된 시각. 기록에서 다시 열어도 그때 시각이 그대로 나온다.
  analyzedAt?: number | null
}

// ============================================================================
// v1/v2 호환 헬퍼
// ----------------------------------------------------------------------------
// v1: critical_questions[i]는 문자열 — "[개발] ... [A] ... [B] ..."
// v2: critical_questions[i]는 객체 — {tag, question, format, options, impact, blocks}
// ============================================================================

// 확인 질문의 분류 태그 색 — 구버전 Preflight에서 그대로 가져왔다.
// shadcn Badge variant로 매핑했을 때는 비즈니스와 UX정책이 둘 다 outline이라
// 두 태그가 시각적으로 완전히 같았고, 나머지도 무채색이라 분류 구실을 못 했다.
// 이 앱은 다크 모드 강제(layout.tsx)라 500/20 배경 + 300 글자가 그대로 맞는다.
const TAG_COLORS: Record<string, string> = {
  '디자인': 'bg-violet-500/20 text-violet-300',
  '개발': 'bg-blue-500/20 text-blue-300',
  '비즈니스': 'bg-amber-500/20 text-amber-300',
  // 구버전에 없던 네 번째 — 위 셋과 겹치지 않는 색으로 새로 잡는다
  'UX정책': 'bg-emerald-500/20 text-emerald-300',
}

const TAG_FALLBACK = 'bg-slate-500/20 text-slate-300'

// 이 화면의 모든 태그가 쓰는 단 하나의 형태. 확인 필요 탭과 체크리스트 탭이
// 각자 다른 껍데기(shadcn Badge variant, 밝은 배경용 100/700 조합)를 쓰다 보니
// 같은 성격의 표시가 탭마다 달라 보였다. 색만 갈아 끼우고 형태는 여기서 고정한다.
const CHIP_BASE = 'text-xs font-semibold px-2 py-0.5 rounded-md w-fit shrink-0'

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className={`${CHIP_BASE} ${color}`}>{children}</span>
}

function ContextTag({ tag }: { tag: string }) {
  return <Chip color={TAG_COLORS[tag] ?? TAG_FALLBACK}>{tag}</Chip>
}

// 태그 문자열에서 대괄호 제거: "[개발]" -> "개발", "개발" -> "개발"
function stripBrackets(tag: string): string {
  const m = tag.match(/^\[([^\]]+)\]$/)
  return m ? m[1] : tag
}

// v1 문자열 파싱 (기존 로직 유지)
function parseTagFromString(q: string): { tag: string | null; rest: string } {
  const match = q.match(/^\[([^\]]+)\](.*)/)
  if (!match) return { tag: null, rest: q }
  return { tag: match[1], rest: match[2].trim() }
}

// v2 객체 대응 — 추후 렌더링에서 활용
interface QuestionV2 {
  tag: string
  question: string
  owner?: string
  dimension?: string
  format?: 'binary' | 'multiple' | 'open'
  options?: string[]
  impact?: string
  blocks?: string[]
}

// v1 문자열 / v2 객체 모두 받을 수 있게 판별
function isQuestionV2(q: unknown): q is QuestionV2 {
  return typeof q === 'object' && q !== null && 'question' in q
}

// ============================================================================
// CRITERIA_LABELS: v1·v2 키를 모두 지원
// ============================================================================
// 현재 항목 라벨은 rubric이 원본이라 여기 적지 않는다 — dimensionLabel()로 조회.
// 아래는 과거 분석 기록을 열었을 때를 위한 구 키 대응표다.
const LEGACY_CRITERIA_LABELS: Record<string, string> = {
  // v1
  화면_인벤토리: '화면 인벤토리',
  데이터_상태: '데이터 상태',
  엣지케이스: '엣지케이스',
  인터랙션_로직: '인터랙션 로직',
  CTA_계층: 'CTA 계층',
  // v2
  구조_플로우: '구조·플로우 완결성',
  상태_피드백: '상태·피드백',
  에러_예방_복구: '에러 예방·복구',
  인터랙션_관례: '인터랙션·관례 일관성',
  정보_위계: '정보 위계·의사결정 부하',
  행동_설계: '행동 설계 (Fogg)',
}

function criteriaLabel(key: string): string {
  return dimensionLabel(key) ?? LEGACY_CRITERIA_LABELS[key] ?? key
}

// owner 표기는 버전에 따라 'PM' / '다음단계' / '담당자결정'이 섞여 들어온다.
// 값이 없는 옛 결과는 PM 몫으로 본다 — 예전 화면이 전부 PM 몫으로 세던 것과 맞춘다.
// 'pm'      — PM이 답해야 하는 것
// 'maker'   — 만드는 사람(디자이너·개발자)이 정할 수 있는 것
// 'unknown' — owner가 없는 옛 결과. 원래 있던 탭(디자이너/개발자 목록)에 그대로 둔다.
//             전부 PM으로 몰면 기록에서 옛 결과를 열었을 때 직군 탭이 통째로 비어
//             "이 문서에는 디자인 확인 사항이 없다"는 거짓 신호가 된다.
type Owner = 'pm' | 'maker' | 'unknown'

function ownerOf(owner?: string): Owner {
  if (!owner || !owner.trim()) return 'unknown'
  // 모델이 'PM' 대신 'PM 결정', 'PM/디자이너'처럼 흘려 쓸 수 있다. 정확히 일치할
  // 때만 PM으로 보면 그런 값이 조용히 담당자 탭으로 새므로 포함 여부로 본다.
  return /\bPM\b/i.test(owner) ? 'pm' : 'maker'
}

function isPmOwned(owner?: string): boolean {
  return ownerOf(owner) !== 'maker'
}

// owner 배지는 없앴다. 예전에는 카드마다 "PM 결정 필요 / 담당자 결정 필요"를
// 붙였는데, 같은 공백이 확인 필요 탭과 체크리스트 탭에 동시에 나오면서 배지만
// 다르게 붙는 일이 잦았다(본문은 "PM이 먼저 정의 필요"인데 배지는 담당자 결정 등).
// 지금은 owner가 곧 탭이다 — PM 몫은 PM 탭, 담당자 몫은 디자인/개발 탭.
// 판정이 한 곳으로 모이므로 카드 안에서 같은 말을 반복할 필요가 없다.

// 개발 항목이 화면 쪽인지 서버 쪽인지
function AreaBadge({ area }: { area?: string }) {
  if (!area) return null
  const isFe = area.toUpperCase() === 'FE'
  return (
    <Chip color={isFe ? 'bg-sky-500/20 text-sky-300' : 'bg-emerald-500/20 text-emerald-300'}>
      {isFe ? '화면' : '서버'}
    </Chip>
  )
}

function criterionColor(score: number) {
  if (score >= 8) return { text: 'text-green-600', hex: '#22c55e' }
  if (score >= 5) return { text: 'text-amber-500', hex: '#f59e0b' }
  return { text: 'text-red-500', hex: '#ef4444' }
}

// 신호등 3단계 색 — 점수 대신 1차 정보로 쓴다
const SIGNAL_STYLE: Record<SignalLevel, string> = {
  '착수 가능': 'bg-green-500',
  '보완': 'bg-amber-500',
  '누락': 'bg-red-500',
}

// 항목 칸의 강조 정도.
//
// 바탕은 페이지 배경(#0a0a0a)보다 한 단계 밝은 neutral-900(#171717)이다.
// 이 화면은 위아래로 층을 나눈다 — 상단(진단 결과)은 면으로 떠 있고,
// 탭 안 카드들은 배경과 같은 neutral-950으로 가라앉혀 테두리로만 구분한다.
// 손봐야 하는 항목만 색 테두리로 추가로 띄운다.
const SIGNAL_CELL: Record<SignalLevel, string> = {
  '착수 가능': 'bg-neutral-900 border-border/60',
  '보완': 'bg-neutral-900 border-amber-500/40',
  '누락': 'bg-neutral-900 border-red-500/40',
}

const SIGNAL_TEXT: Record<SignalLevel, string> = {
  '착수 가능': 'text-muted-foreground',
  '보완': 'text-amber-400',
  '누락': 'text-red-400',
}

// ── 1차 정보: 보완할 항목 수 + 항목별 신호등 ──────────────────────
// 원래는 AI가 뽑은 질문 수("남은 결정 N건")를 맨 앞에 뒀다(5번 결정).
// 그런데 AI가 뽑는 목록은 문서가 어떻든 개수가 비슷하고 0개는 절대 안 나와서,
// 네 번의 시도(25·26·28·29번) 끝에 항목 점수에서 세는 값으로 바꿨다.
// 이 값은 문서 품질 순서와 맞고 회차 간 ±1로 안정적이다. (변경 기록 29번)
// 라인탭 스타일. 공용 Tabs의 알약형 기본값(bg-muted 컨테이너, 활성 시 배경+그림자)을
// 걷어내고 밑줄만 남긴다. 진입 화면 탭은 기본값을 그대로 쓰므로 여기서만 덮는다.
const LINE_TABS_LIST =
  'mb-6 w-full h-auto rounded-none bg-transparent p-0 gap-6 ' +
  'justify-start border-b border-border flex-wrap'

// 루트의 [&_button]:rounded-md(:388)가 자손 선택자라 그냥 rounded-none으로는
// 못 이긴다. 밑줄이 둥근 잔상처럼 보이므로 !important로 덮는다.
const LINE_TAB =
  '!rounded-none bg-transparent shadow-none px-0 pb-2.5 pt-0 ' +
  'border-b-2 border-transparent -mb-px ' +
  'data-[active]:bg-transparent data-[active]:shadow-none ' +
  'data-[active]:border-foreground data-[active]:text-foreground'

// 칸에 기본으로 보여줄 빠진 내용 개수. 이 수를 넘으면 접어두고 펼치게 한다 —
// 항목마다 개수가 달라서 그대로 두면 칸 높이가 제각각이 되고 격자가 어긋난다.
const MISSING_VISIBLE = 1

function RemainingDecisions({ result }: { result: AnalysisResult }) {
  // 펼친 항목들. 여러 개를 동시에 열 수 있게 둔다 — 하나만 열리면
  // 다른 칸을 열 때 먼저 것이 접히면서 화면이 튄다.
  const [expanded, setExpanded] = useState<string[]>([])

  const scored = DIMENSIONS.map(d => ({
    label: d.label,
    score: result.criteria?.[d.key]?.score ?? null,
    missing: result.criteria?.[d.key]?.missing ?? [],
  })).filter(x => x.score !== null) as Array<{
    label: string
    score: number
    missing: string[]
  }>

  // 신호등과 같은 기준으로 센다. 예전에는 여기만 7점 미만이고 신호등은 8점
  // 경계여서, 7점짜리 항목이 "보완"으로 표시되면서 개수에는 안 잡혔다
  // ("보완할 항목 1개"인데 신호등에 보완이 2개). 화면 안에서 같은 말이
  // 서로 다른 숫자를 가리키면 어느 쪽도 못 믿게 된다.
  const weak = scored.filter(x => signalOf(x.score) !== '착수 가능')
  const done = weak.length === 0

  // 카드 껍데기(테두리·배경·패딩)를 벗겼다. 안쪽 칸들이 이미 각자 테두리와
  // 배경을 갖고 있어서 바깥 테두리는 상자 안의 상자로만 보였고, p-6 때문에
  // 아래 목업 카드들과 좌우 끝이 어긋났다.
  return (
    // 아래 "문서로 화면 만들어보기"와 32px 띄운다 — 진단 결과와 산출물 생성은
    // 성격이 다른 영역이라, 항목 칸 사이(8px)나 제목-본문 사이(12px)와
    // 확연히 다른 간격으로 무리를 가른다.
    <div className="mb-8">
        {/* 아래 "문서로 화면 만들어보기"와 같은 영역 제목이므로 크기·굵기·
            본문까지의 여백을 같게 둔다. 개수만 굵기가 아니라 밝기로 띄운다 —
            굵기를 쓰면 두 제목의 무게가 달라 보인다. */}
        <p className="text-sm text-muted-foreground mb-3">
          디자인 착수까지{' '}
          <span className={done ? 'text-green-500' : 'text-foreground'}>
            {done ? '보완할 항목 없음' : `보완할 항목 ${weak.length}개`}
          </span>
        </p>
        {done && (
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            여섯 항목 모두 이 문서만으로 시작할 수 있는 수준입니다. 아래 확인 항목은 참고용입니다.
          </p>
        )}

        {/* 항목 여섯 개를 3열로 놓고, 빠진 내용을 각 칸 안에 담는다.
            한 줄로 쭉 늘어놓으면 여섯 개가 서로 묻혀 어느 게 문제인지 안 보였고,
            빠진 내용을 위에 따로 쌓으면 항목이 늘수록 상단이 계속 길어졌다.
            3열이면 높이가 항목 수가 아니라 행 수(2행)로 묶인다. */}
        <div className="grid grid-cols-3 gap-2">
          {scored.map(({ label, score, missing }) => {
            const level = signalOf(score)
            const isOpen = expanded.includes(label)
            const shown = isOpen ? missing : missing.slice(0, MISSING_VISIBLE)
            const hidden = missing.length - shown.length
            return (
              <div
                key={label}
                /* 접힌 상태의 최대 높이(제목 + 빠진 내용 1줄 + 펼치기 버튼)를 기본
                   높이로 잡아 내용이 없는 칸까지 같은 크기로 맞춘다.
                   각 줄이 line-clamp-1로 한 줄 고정이라 이 값을 넘길 일이 없다.
                   ⚠️ 칸 안에 줄을 더하거나 뺄 때는 이 값도 같이 재야 한다 —
                   안 그러면 아래쪽이 그만큼 빈 채로 남는다(실측: 가장 꽉 찬 칸 102px). */
                className={`rounded-lg border p-4 min-h-[104px] flex flex-col ${SIGNAL_CELL[level]}`}
              >
                <div className="flex items-baseline gap-1.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 self-center ${SIGNAL_STYLE[level]}`} />
                  {/* 항목 설명은 따로 붙이지 않는다. 라벨 자체를 평이한 말로 다시 써서
                      (예: "엣지케이스·롤백" → "예외·실패 대응") 되묻지 않게 만든 게
                      먼저다. 상시 한 줄도 hover 아이콘도 결국 라벨이 못 한 몫을
                      대신 지는 장치라, 라벨이 읽히면 둘 다 필요 없다. */}
                  <span className="text-sm font-medium">{label}</span>
                  <span className={`text-xs ml-auto shrink-0 ${SIGNAL_TEXT[level]}`}>{level}</span>
                </div>
                {shown.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {shown.map((m, i) => (
                      <li
                        key={i}
                        /* 접힌 상태에서는 한 줄로 자른다. 문구 길이에 따라 칸 높이가
                           달라지면 격자가 어긋나기 때문이다. 잘린 전문은 펼치면 나온다. */
                        className={`text-[11px] text-muted-foreground leading-relaxed ${isOpen ? '' : 'line-clamp-1'}`}
                      >
                        · {m}
                      </li>
                    ))}
                  </ul>
                )}
                {(hidden > 0 || isOpen) && (
                  <button
                    onClick={() =>
                      setExpanded(prev =>
                        isOpen ? prev.filter(l => l !== label) : [...prev, label]
                      )
                    }
                    className="mt-auto pt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors text-left w-fit"
                  >
                    {isOpen ? '접기' : `+${hidden}개 더`}
                  </button>
                )}
              </div>
            )
          })}
        </div>
    </div>
  )
}

// 개발 착수 전 확인 블록을 화면에 띄울지. 지금은 이 화면을 디자이너 관점으로만
// 보기로 해서 꺼 둔다. 판정 로직과 데이터는 그대로 살아 있으므로 여기만 켜면 된다.
const SHOW_DEV_READINESS = false

// 사용자 요구사항 URL 입력(Beta)을 띄울지.
// 이 기능은 2026-06-23에 main에 들어갔지만 프로덕션은 그 뒤로 배포된 적이 없어
// (7/10에 rollback/v0.7.0으로 배포된 상태) 팀은 한 번도 본 적이 없다.
// 쓰이지 않는 입력칸이 화면만 차지하므로 꺼 둔다. 배포 경로가 정리되면 켠다.
const SHOW_REQUIREMENTS_INPUT = false

// ── 개발 착수 전 확인 (점수 무관) ────────────────────────────────────────────
// 판정을 "디자인 착수 가능"으로 줄인 것의 짝. 줄인 만큼 눈에 보이게 한다.
const DEV_STATUS_STYLE: Record<string, { dot: string; text: string; label: string }> = {
  '있음': { dot: 'bg-green-500', text: 'text-green-600', label: '문서에 있음' },
  '부분': { dot: 'bg-amber-500', text: 'text-amber-500', label: '일부만 있음' },
  '없음': { dot: 'bg-red-500', text: 'text-red-500', label: '확인 필요' },
}

function DevReadiness({ result }: { result: AnalysisResult }) {
  const dr = result.dev_readiness
  if (!dr) return null
  const clear = DEV_READINESS.filter(d => dr[d.key]?.status === '있음').length

  return (
    <Card className="mb-8 !py-0">
      <CardContent className="p-6 space-y-3">
        <div>
          <p className="text-sm font-medium">개발 착수 전 확인</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            이 점수는 <strong>디자인 착수</strong> 기준입니다. 아래는 개발이 시작하려면 필요한 것들로,
            <strong> 점수에는 반영하지 않습니다.</strong> 별도 문서(API 설계서 등)에 이미 있다면 넘어가셔도 됩니다.
          </p>
        </div>
        <div className="space-y-2">
          {DEV_READINESS.map(d => {
            const item = dr[d.key]
            const st = DEV_STATUS_STYLE[item?.status ?? '없음'] ?? DEV_STATUS_STYLE['없음']
            return (
              <div key={d.key} className="flex items-start gap-2.5">
                <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm">{d.label}</span>
                    <span className={`text-[10px] ${st.text}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {item?.note || (item?.status === '있음' ? '' : d.why)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
        {clear === DEV_READINESS.length && (
          <p className="text-xs text-green-600">네 가지 모두 문서에서 확인됐습니다.</p>
        )}
      </CardContent>
    </Card>
  )
}

// v2 severity — 다른 태그와 같은 Chip 형태를 쓰고 심각도만 색으로 구분한다.
// 예전에는 shadcn Badge variant(outline/secondary/default)를 써서 확인 필요 탭의
// 태그들과 모양이 아예 달랐다.
function severityBadge(severity?: number): { color: string; label: string } | null {
  if (severity === undefined || severity === null) return null
  const map: Record<number, { color: string; label: string }> = {
    1: { color: 'bg-slate-500/20 text-slate-300', label: 'Cosmetic' },
    2: { color: 'bg-slate-500/20 text-slate-300', label: 'Minor' },
    3: { color: 'bg-amber-500/20 text-amber-300', label: 'Major' },
    4: { color: 'bg-red-500/20 text-red-300', label: 'Catastrophic' },
  }
  return map[severity] ?? null
}

// ============================================================================
// ux_recommendations 정규화: v1 문자열 / v2 객체 모두 렌더링 가능한 형태로 변환
// ============================================================================
interface NormalizedRec {
  text: string
  principle?: string
  perspective?: string
  effort?: string
  expected_impact?: string
}

function normalizeRec(rec: unknown): NormalizedRec {
  if (typeof rec === 'string') return { text: rec }
  if (typeof rec === 'object' && rec !== null) {
    const r = rec as {
      recommendation?: string
      principle?: string
      perspective?: string
      effort?: string
      expected_impact?: string
    }
    return {
      text: r.recommendation ?? '',
      principle: r.principle,
      perspective: r.perspective,
      effort: r.effort,
      expected_impact: r.expected_impact,
    }
  }
  return { text: String(rec) }
}

// ============================================================================
// 확인 항목 카드 — PM 탭과 디자인/개발 탭이 같은 카드를 나눠 쓴다
// ----------------------------------------------------------------------------
// 항목이 어느 탭에 놓이는지는 owner가 정하고, 어떤 모양으로 보이는지는 출처
// (디자이너 항목 / 개발 항목 / 확인 질문)가 정한다. 두 축을 분리해 두어야
// "PM 탭에 개발 항목이 있다"가 자연스럽게 표현된다.
// ============================================================================

function DesignerCard({ item }: { item: MissingItem }) {
  const v2Item = item as MissingItem & {
    principle?: string
    severity?: number
    user_impact?: string
  }
  const sev = severityBadge(v2Item.severity)
  return (
    <Card className="border-amber-800/40 !py-0 bg-neutral-950">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <Chip color="bg-amber-500/20 text-amber-300">{item.screen}</Chip>
          {sev && <Chip color={sev.color}>{sev.label}</Chip>}
          {v2Item.principle && (
            <span className="text-[10px] text-muted-foreground">{v2Item.principle}</span>
          )}
        </div>
        <p className="text-sm mb-3">
          <span className="text-amber-400 font-medium">문제: </span>
          {item.issue}
        </p>
        {v2Item.user_impact && (
          <p className="text-xs text-muted-foreground mb-3">
            <span className="font-medium">영향: </span>{v2Item.user_impact}
          </p>
        )}
        <SuggestionBox text={item.suggestion} />
      </CardContent>
    </Card>
  )
}

function DevCard({ item }: { item: DevItem }) {
  const v2Item = item as DevItem & { risk?: string; severity?: number }
  const sev = severityBadge(v2Item.severity)
  return (
    <Card className="border-blue-800/40 !py-0 bg-neutral-950">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <Chip color="bg-blue-500/20 text-blue-300">{item.module}</Chip>
          <AreaBadge area={item.area} />
          {sev && <Chip color={sev.color}>{sev.label}</Chip>}
        </div>
        <p className="text-sm mb-3">
          <span className="text-blue-400 font-medium">문제: </span>
          {item.issue}
        </p>
        {v2Item.risk && (
          <p className="text-xs text-muted-foreground mb-3">
            <span className="font-medium">리스크: </span>{v2Item.risk}
          </p>
        )}
        <SuggestionBox text={item.suggestion} />
      </CardContent>
    </Card>
  )
}

function SuggestionBox({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 bg-muted rounded-xl p-3">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" className="mt-0.5 flex-shrink-0">
        <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zM12 8v4M12 16h.01" />
      </svg>
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  )
}

// marker: 왼쪽에 붙는 번호. PM 탭에서만 "Q1, Q2…"를 쓴다 — PM에게 그대로 전달하는
// 목록이라 번호가 곧 참조 번호가 된다. 직군 탭에서도 번호를 매기면 "Q1"이 탭마다
// 다른 질문을 가리키게 되므로 그쪽은 번호 없이 둔다.
function QuestionCard({ q, index, accent, marker }: { q: unknown; index: number; accent: boolean; marker?: string }) {
  // v1: string, v2: object
  if (!isQuestionV2(q)) {
    const { tag, rest } = parseTagFromString(q as string)
    return (
      <Card className="border-destructive/20 !py-0 bg-neutral-950">
        <CardContent className="flex items-start gap-4 p-4">
          <span className="text-sm font-bold text-destructive flex-shrink-0 mt-0.5">Q{index + 1}</span>
          <div className="flex flex-col gap-1.5">
            {tag && <ContextTag tag={tag} />}
            <span className="text-sm">{rest}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const tagText = stripBrackets(q.tag)
  return (
    <Card className={`!py-0 bg-neutral-950 ${accent ? 'border-destructive/20' : 'border-border'}`}>
      <CardContent className="flex items-start gap-4 p-4">
        {marker && (
          <span className={`text-sm font-bold flex-shrink-0 mt-0.5 ${accent ? 'text-destructive' : 'text-muted-foreground'}`}>
            {marker}
          </span>
        )}
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <ContextTag tag={tagText} />
            {q.dimension && (
              <span className="text-[10px] text-muted-foreground">{criteriaLabel(q.dimension)}</span>
            )}
            {q.format && (
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{q.format}</span>
            )}
          </div>
          <span className="text-sm">{q.question}</span>
          {q.options && q.options.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              {q.options.map((opt, idx) => {
                // 선택지가 하나뿐이면(format: open → ["논의 필요"])
                // "A."를 붙일 이유가 없다. 고를 게 없는데 고르라는 표시가 된다.
                // multiple의 마지막에 오는 "논의 필요"는 접두를 유지해야 하므로
                // 문자열이 아니라 개수·format으로 판단한다.
                const single = q.options!.length === 1 || q.format === 'open'
                return (
                  <div key={idx} className="text-xs bg-muted rounded-md px-3 py-1.5 border border-border">
                    {!single && (
                      <span className="font-mono text-muted-foreground mr-2">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                    )}
                    {opt}
                  </div>
                )
              })}
            </div>
          )}
          {q.impact && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-medium">영향: </span>{q.impact}
            </p>
          )}
          {q.blocks && q.blocks.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {/* prompt.ts의 정의가 "이 답이 없으면 막히는 작업"이다.
                  "차단 중"은 상태로 읽혀 방향이 반대로 전달됐다 —
                  조건과 결과를 둘 다 적어야 뜻이 통한다. */}
              <span className="font-medium">이 답이 없으면 막히는 작업: </span>{q.blocks.join(', ')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// 탭 안에서 출처가 다른 카드 묶음을 구분하는 소제목
function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground pt-2">{children}</p>
}

// 직군 탭의 두 구역("지금 정할 수 있는 것" / "PM 답변을 기다리는 것") 머리말.
// 개수를 함께 적는다 — 아래 카드가 몇 장인지 보이지 않으면 두 구역의 경계가
// 스크롤 중에 사라진다. count가 0이면 카드 대신 emptyText를 그 자리에 놓는다.
function SectionHeading({
  title,
  note,
  count,
  emptyText,
}: {
  title: string
  note: string
  count: number
  emptyText?: string
}) {
  return (
    <div className="pt-2 first:pt-0">
      <p className="text-sm font-medium">
        {title} <span className="text-muted-foreground font-normal">{count}건</span>
      </p>
      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{note}</p>
      {count === 0 && emptyText && (
        <p className="text-xs text-muted-foreground/70 mt-3 leading-relaxed">{emptyText}</p>
      )}
    </div>
  )
}

function EmptyTab({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}

export default function ResultScreen({
  fileName,
  result,
  hasMockupLowFi,
  hasMockupHiFi,
  mockupLowFiAt,
  mockupHiFiAt,
  onGenerateMockup,
  onCancelMockup,
  mockupGenerating,
  onReupload,
  requirementsUrl,
  onRequirementsUrlChange,
  reusedFrom,
  analyzedAt,
}: ResultScreenProps) {
  const [showMockupModal, setShowMockupModal] = useState(false)
  const [isRegenerate, setIsRegenerate] = useState(false)
  const [mockupProgress, setMockupProgress] = useState(0)

  useEffect(() => {
    if (mockupGenerating === null) {
      setMockupProgress(0)
      return
    }
    setMockupProgress(0)
    const interval = setInterval(() => {
      setMockupProgress(prev => {
        if (prev >= 98) return prev
        const increment = prev < 60 ? 2 : prev < 82 ? 0.4 : prev < 92 ? 0.15 : 0.03
        return Math.min(prev + increment, 98)
      })
    }, 300)
    return () => clearInterval(interval)
  }, [mockupGenerating])

  const devItems: DevItem[] = result.missing_for_developers ?? []
  const designItems: MissingItem[] = result.missing_for_designers ?? []

  // ── 탭 구성 ───────────────────────────────────────────────────────────────
  // 두 축을 쓴다. 헷갈리기 쉬우니 무엇이 무엇인지 적어 둔다.
  //
  //   owner  = 누가 답해야 하는가 (PM / 담당자)
  //   직군   = 누구의 작업에 걸리는가 (디자인 / 개발)
  //
  //   · PM 확인 필요   — owner가 PM인 것 전부. **PM에게 그대로 보내는 목록**이다.
  //   · 디자인/개발 확인 필요 — 그 직군 작업에 걸린 것 전부. 위쪽은 지금 정할 수
  //     있는 것, 아래쪽은 PM 답을 기다리는 것으로 나눈다. **직군의 작업 전체 뷰**다.
  //
  // PM 몫 항목은 PM 탭과 직군 탭에 함께 나온다. 이건 중복이 아니라 쓰임이 다른
  // 두 뷰다 — 예전 구조는 "질문이냐 체크리스트냐"라는 출처로 갈라서 같은 공백이
  // 아무 의미 없이 두 번 나왔지만, 여기서는 PM 탭은 보낼 목록, 직군 탭은
  // "내 화면(모듈)에 걸린 게 전부 뭔가"를 보는 곳이다.
  //
  // 실측(사내 PRD 3건 × 2회)에서 항목의 89%가 PM 몫으로 나왔다. 담당자 몫만
  // 직군 탭에 두면 그 탭이 늘 0~1건이라 볼 이유가 없어진다.
  const isPmQuestion = (q: unknown) => (isQuestionV2(q) ? isPmOwned(q.owner) : true)
  const tagOf = (q: unknown) => (isQuestionV2(q) ? stripBrackets(q.tag) : '')

  const pmQuestions = result.critical_questions.filter(isPmQuestion)
  const ownerQuestions = result.critical_questions.filter(q => !isPmQuestion(q))

  // 질문을 직군으로 가르는 기준은 태그다. [개발]은 개발 쪽, [디자인]·[UX정책]은
  // 디자인 쪽. [비즈니스]는 특정 직군의 작업이라 볼 수 없어 직군 탭에 넣지 않는다
  // (담당자 몫으로 판정된 [비즈니스] 질문은 화면에서 풀리는 경우라 디자인 쪽에 둔다).
  const isDevTag = (q: unknown) => tagOf(q) === '개발'
  const isDesignTag = (q: unknown) => tagOf(q) === '디자인' || tagOf(q) === 'UX정책'

  const ownerDevQuestions = ownerQuestions.filter(isDevTag)
  const ownerDesignQuestions = ownerQuestions.filter(q => !isDevTag(q))

  // 항목은 owner가 'pm'일 때만 PM 몫으로 본다 — 'unknown'(옛 결과)은 담당자 쪽에.
  const pmDesignItems = designItems.filter(i => ownerOf(i.owner) === 'pm')
  const ownerDesignItems = designItems.filter(i => ownerOf(i.owner) !== 'pm')
  const pmDevItems = devItems.filter(i => ownerOf(i.owner) === 'pm')
  const ownerDevItems = devItems.filter(i => ownerOf(i.owner) !== 'pm')

  // 직군 탭 아래쪽 "PM 답변 대기" 구역 — 그 직군 작업을 막고 있는 PM 몫들
  const designWaiting = pmQuestions.filter(isDesignTag)
  const devWaiting = pmQuestions.filter(isDevTag)

  // 심각도가 높은 것이 위로. 예전에는 질문이 먼저 오고 그 아래 항목이 붙어서,
  // Catastrophic 항목이 Minor 질문 세 개 아래에 묻히는 일이 생겼다.
  const bySeverity = <T extends { severity?: number }>(a: T, b: T) =>
    (b.severity ?? 0) - (a.severity ?? 0)

  const pmCount = pmQuestions.length + pmDesignItems.length + pmDevItems.length
  // 직군 탭 개수는 대기 중인 것까지 센다 — 탭 이름이 "이 직군에 걸린 것"이므로
  const designActionable = ownerDesignItems.length + ownerDesignQuestions.length
  const devActionable = ownerDevItems.length + ownerDevQuestions.length
  const designCount = designActionable + designWaiting.length + pmDesignItems.length
  const devCount = devActionable + devWaiting.length + pmDevItems.length

  // 문서에 이미 있어 디자인에 바로 쓸 수 있는 재료 (예전의 "가점 항목")
  const earnedMaterials = result.bonus_signals
    ? bonusBreakdown(result.bonus_signals).filter(b => b.earned)
    : []

  // v2의 notes는 객체일 수 있음 — unknown으로 받고 렌더링 시 분기
  const criteriaEntries = Object.entries(result.criteria) as Array<
    [string, { score: number | null; notes?: unknown; evidence?: string; missing?: string[]; applied_principle?: string }]
  >

  return (
    <div className="min-h-screen [&_button]:rounded-md">
      {/* 헤더 */}
      <div className="border-b px-6 py-4 flex items-center gap-3">
        <button
          onClick={onReupload}
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          aria-label="뒤로가기"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-bold text-lg">Preflight</span>
        {/* 어떤 문서를 언제 채점한 결과인지는 본문 정보가 아니라 이 화면 전체의
            식별자다. 본문 맨 위에 두면 첫 카드와 붙어 어디에 속한 줄인지
            애매해지므로 GNB로 올린다. */}
        <span className="ml-auto flex items-center gap-2 min-w-0">
          <span className="text-sm text-muted-foreground truncate">{fileName}</span>
          {(analyzedAt ?? reusedFrom) && (
            <>
              <span className="text-muted-foreground shrink-0">·</span>
              <span className="text-sm text-muted-foreground shrink-0">
                분석: {formatAbsoluteDateTime((analyzedAt ?? reusedFrom) as number)}
              </span>
            </>
          )}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="max-w-[900px] mx-auto px-6 py-8 min-w-[500px]">
          {/* 내용이 같아 다시 채점하지 않은 경우 — 왜 기다리지 않았는지 알려준다 */}
          {reusedFrom && (
            <div className="mb-6 rounded-lg border border-border bg-card p-4">
              <p className="text-sm">
                <strong>이전에 분석한 문서와 내용이 같아 그때 결과를 그대로 보여드립니다.</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                같은 문서를 다시 채점하면 점수가 몇 점 달라질 수 있어, 내용이 바뀌지 않았으면
                다시 채점하지 않습니다. 문서를 고치신 뒤 올리면 새로 채점합니다.
              </p>
            </div>
          )}

        {/* ── 1차 정보: 남은 결정 + 항목별 신호등 ──
            점수를 앞에 두면 "점수를 올린다"가 목표가 되어 문구만 다듬게 된다.
            "질문을 없앤다"가 목표가 되면 그게 곧 문서 개선이다. (변경 기록 5번) */}
        <RemainingDecisions result={result} />

        {/* 목업 영역
            점수 카드는 없앴다. 펼치기/접기가 정보를 하나도 더 주지 않았고,
            "무엇이 부족한가"는 위 헤드라인 카드가 항목별로 답한다. (변경 기록 33번)

            위 6칸과 여기 2칸이 같은 간격·같은 배경이라 한 덩어리로 읽혔다.
            성격이 다른 영역이므로(위=문서 진단, 여기=산출물 생성) 제목을 붙이고
            칸 사이를 위아래 여백(16px)만큼 벌려 무리를 나눈다. */}
        <p className="text-sm text-muted-foreground mb-3">문서로 화면 만들어보기</p>
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* 사용자 요구사항 - 2열 span */}
          {SHOW_REQUIREMENTS_INPUT && (
          <Card className="col-span-2 !py-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-medium">사용자 요구사항 추가</span>
                <span className="text-[10px] text-blue-500">Beta</span>
                <span className="text-[10px] text-muted-foreground">선택</span>
                <a
                  href="https://wiki.team.musinsa.com/wiki/spaces/~712020ee34afa80ab546f4bc1737fa25a14aa1/pages/498877379/UX+UI"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-[10px] text-muted-foreground underline hover:text-foreground"
                >예시</a>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                목업 생성 시 PRD와 함께 반영됩니다. Confluence 페이지의 브라우저 주소창 URL을 붙여넣으세요.
              </p>
              <input
                type="url"
                value={requirementsUrl}
                onChange={e => onRequirementsUrlChange(e.target.value)}
                placeholder="https://wiki.team.musinsa.com/wiki/spaces/.../pages/..."
                disabled={mockupGenerating !== null}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md outline-none focus:border-primary placeholder:text-muted-foreground disabled:opacity-50"
              />
            </CardContent>
          </Card>
          )}

          {/* Lo-Fi 카드 */}
          <Card className="max-h-[100px] overflow-hidden !py-0 bg-neutral-900">
            <CardContent className="p-4 h-full flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold">Lo-Fi</span>
                  <span className="text-[10px] text-muted-foreground">
                    와이어프레임
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {hasMockupLowFi && mockupLowFiAt
                    ? `${formatHistoryDate(mockupLowFiAt)} 생성`
                    : '아직 생성되지 않았습니다'}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {mockupGenerating === 'lowfi' ? (
                  <>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" disabled>
                      <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                      {mockupProgress >= 92 ? `마무리 중... ${Math.round(mockupProgress)}%` : `${Math.round(mockupProgress)}%`}
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={onCancelMockup}>
                      취소
                    </Button>
                  </>
                ) : hasMockupLowFi ? (
                  <>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onGenerateMockup('lowfi', false)} disabled={mockupGenerating !== null}>
                      보기
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onGenerateMockup('lowfi', true)} disabled={mockupGenerating !== null}>
                      재생성
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onGenerateMockup('lowfi', false)} disabled={mockupGenerating !== null}>
                    생성하기
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Hi-Fi 카드 */}
          <Card className="max-h-[100px] overflow-hidden !py-0 bg-neutral-900">
            <CardContent className="p-4 h-full flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold">Hi-Fi</span>
                  <span className="text-[10px] text-primary">
                    인터랙티브
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {hasMockupHiFi && mockupHiFiAt
                    ? `${formatHistoryDate(mockupHiFiAt)} 생성`
                    : '아직 생성되지 않았습니다'}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {mockupGenerating === 'hifi' ? (
                  <>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" disabled>
                      <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                      {mockupProgress >= 92 ? `마무리 중... ${Math.round(mockupProgress)}%` : `${Math.round(mockupProgress)}%`}
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={onCancelMockup}>
                      취소
                    </Button>
                  </>
                ) : hasMockupHiFi ? (
                  <>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onGenerateMockup('hifi', false)} disabled={mockupGenerating !== null}>
                      보기
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onGenerateMockup('hifi', true)} disabled={mockupGenerating !== null}>
                      재생성
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => onGenerateMockup('hifi', false)} disabled={mockupGenerating !== null}>
                    생성하기
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 개발 착수 전 확인 — 지금은 디자이너 관점으로만 보기 위해 감춰둔다.
            로직과 데이터(DEV_READINESS)는 그대로 두므로 이 값만 켜면 돌아온다. */}
        {SHOW_DEV_READINESS && <DevReadiness result={result} />}

        {/* 탭 — 요약 다음은 "누가 답해야 하는가" 순서다.
            PM 확인 필요 → 디자인 확인 필요 → 개발 확인 필요 → UX 제안.
            탭 이름이 곧 담당이라 카드 안에 담당 배지를 따로 붙이지 않는다. */}
        {/* 라인탭 — 공용 Tabs는 알약형(bg-muted 컨테이너 + 활성 배경)이라
            진입 화면과 공유한다. 여기서만 배경을 걷고 밑줄로 바꾼다. */}
        <Tabs defaultValue="summary">
          <TabsList className={LINE_TABS_LIST}>
            <TabsTrigger value="summary" className={LINE_TAB}>요약</TabsTrigger>
            <TabsTrigger value="questions" className={LINE_TAB}>PM 확인 필요 ({pmCount})</TabsTrigger>
            <TabsTrigger value="missing" className={LINE_TAB}>디자인 확인 필요 ({designCount})</TabsTrigger>
            <TabsTrigger value="dev" className={LINE_TAB}>개발 확인 필요 ({devCount})</TabsTrigger>
            <TabsTrigger value="recommendations" className={LINE_TAB}>UX 제안</TabsTrigger>
          </TabsList>

          {/* 요약 탭 */}
          <TabsContent value="summary" className="space-y-6">
            {/* 점수에 영향 없는 안내 */}
            {(result.advisories ?? []).length > 0 && (
              <Card className="!py-0 bg-neutral-950">
                <CardContent className="p-4 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">참고 — 점수에는 반영되지 않습니다</p>
                  {(result.advisories ?? []).map((a, i) => (
                    <p key={i} className="text-xs text-muted-foreground leading-relaxed">· {a}</p>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 예전에는 "가점 +5" 형태였다. 점수를 화면에서 뺀 지금은 그 숫자가
                가리킬 곳이 없어서, 원래 의미인 "디자인에 바로 쓸 수 있는 재료가
                문서에 있다"로 바꿔 적는다. 못 받은 항목은 아예 그리지 않는다 —
                없는 것을 나열하면 "이게 감점인가"를 다시 설명해야 한다. */}
            {earnedMaterials.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  문서에 이미 있어 바로 쓸 수 있는 것
                </p>
                <div className="flex flex-wrap gap-2">
                  {earnedMaterials.map(b => (
                    <span
                      key={b.label}
                      className="text-xs px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300"
                    >
                      ✓ {b.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground mb-4">PRD에서 명확하게 정의된 항목들</p>
              <div className="space-y-3">
                {result.validated.map((item, i) => (
                  <Card key={i} className="!py-0 bg-neutral-950">
                    <CardContent className="flex items-start gap-3 p-4">
                      {/* 아이콘(20px)과 text-sm의 줄높이(20px)가 같으므로
                          mt-0.5를 주면 오히려 2px 내려가 어긋난다 */}
                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm">{item}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-4">검증 기준별 상세</p>
              <div className="space-y-3">
                {criteriaEntries.map(([key, val]) => {
                  // v2에서 Fogg 차원은 조건부로 score가 null일 수 있음
                  if (val.score === null || val.score === undefined) return null

                  const { text, hex } = criterionColor(val.score)

                  // ⚠️ 근거·누락은 criteria 항목에 바로 들어 있다(analysis.ts가 그렇게
                  // 정규화한다). 예전에는 val.notes 안을 봤는데 그런 응답이 온 적이
                  // 없어서, 구조화해 보여주는 분기가 통째로 죽어 있었고 전부 한 문단에
                  // ·로 이어 붙은 채 나왔다. notes는 옛 기록에만 있는 모양이라 뒤로 뺀다.
                  const legacy =
                    typeof val.notes === 'object' && val.notes !== null
                      ? (val.notes as { evidence?: string; missing?: string[] })
                      : null
                  const evidence = val.evidence ?? legacy?.evidence
                  const missing = val.missing ?? legacy?.missing ?? []
                  const legacyText = typeof val.notes === 'string' ? val.notes : ''

                  return (
                    <Card key={key} className="!py-0 bg-neutral-950">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{criteriaLabel(key)}</span>
                          <span className={`font-bold ${text}`}>{val.score}/10</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${val.score * 10}%`, backgroundColor: hex }} />
                        </div>
                        {/* PRD에서 따온 문장과 이 도구의 지적은 성격이 다르다. 한 문단에
                            이어 붙이면 어디까지가 인용인지 안 보여서 둘 다 안 읽힌다.
                            인용은 세로선으로 묶고, 누락은 항목마다 줄을 나눈다 —
                            쉼표로 이으면 세 건짜리 목록이 한 문장으로 읽힌다.
                            적용 원칙은 뺐다. 채점 기준(rubric의 principle)을 그대로
                            되돌려받는 값이라 항목마다 늘 같은 문구이고, 줄에서 가장
                            긴 자리를 차지하면서 정보는 없었다. */}
                        {!evidence && missing.length === 0 && legacyText ? (
                          <p className="text-xs text-muted-foreground leading-relaxed">{legacyText}</p>
                        ) : (
                          <div className="space-y-2.5 pt-1">
                            <div>
                              <p className="text-[10px] text-muted-foreground/50 mb-1">PRD에서</p>
                              {evidence ? (
                                <p className="border-l-2 border-border pl-2.5 text-xs text-muted-foreground leading-relaxed">
                                  {evidence}
                                </p>
                              ) : (
                                /* ⚠️ 이건 문서가 아니라 채점의 흠이다. 지시문은 모든 점수에
                                   PRD 인용을 붙이라고 요구하는데(prompt.ts:63) 안 붙여서 온
                                   경우다. "문서에 그 내용이 없다"는 뜻으로 읽히면 안 된다 —
                                   문서에 없다는 것은 아래 "빠진 것"과 점수가 말한다.
                                   ⚠️ 문구는 "불러오는 데 실패"로 쓴다. 세 번 고쳐 여기까지
                                   왔다 — ①"…뜻은 아닙니다"는 부정문이 겹쳐 더 헷갈렸고,
                                   ②"채점이 안 남겼습니다"는 '채점'이 누구인지 안 보여 와닿지
                                   않았으며, ③"빠졌습니다"는 그래서 뭘 하라는 건지가 없었다.
                                   "실패"는 읽는 사람이 아는 말이고 다시 시도하면 된다는 행동까지
                                   같이 전달한다. 문서 탓으로 읽힐 여지도 없다.
                                   "분석 결과에서"인 이유: 분석은 끝났고(점수는 나왔다) 그
                                   결과물 안에 문장이 없는 것이다. "분석에서"라고 하면 분석하다
                                   중간에 실패한 것처럼 읽힌다.
                                   (엄밀히는 불러오다 실패한 게 아니라 응답에 처음부터 값이 없는
                                   것이지만, 사용자가 할 일은 어느 쪽이든 다시 분석이라 이 표현이
                                   맞다. 정확한 기술 표현을 화면에 쓰려 들지 말 것.)
                                   색은 주황을 쓰지 않는다 — 이 화면에서 주황은 "보완 필요"라
                                   9/10짜리 항목에 붙으면 거짓 경고가 된다. 점선으로 빈 자리만
                                   표시한다. */
                                <p className="border-l-2 border-dashed border-border pl-2.5 text-xs text-muted-foreground/50 leading-relaxed">
                                  분석 결과에서 근거 문장을 불러오는 데 실패했습니다
                                </p>
                              )}
                            </div>
                            {missing.length > 0 && (
                              <div>
                                <p className="text-[10px] text-muted-foreground/50 mb-1">빠진 것</p>
                                <ul className="space-y-0.5">
                                  {missing.map((m, i) => (
                                    <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                                      · {m}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* 채점에 실제로 쓴 모델 — 요청값이 아니라 응답이 돌려준 값.
                  모델이 바뀌면 점수도 바뀌므로, 나중에 결과를 비교할 때
                  "무엇으로 잰 숫자인지"를 알 수 있어야 한다. (변경 기록 21번) */}
              <p className="mt-4 text-[10px] text-muted-foreground">
                채점 모델: {result.model ?? '확인되지 않음'}
                {result.analyzed_at && ` · ${formatHistoryDate(new Date(result.analyzed_at).getTime())}`}
              </p>
            </div>
          </TabsContent>

          {/* PM 확인 필요 탭 — owner가 PM인 것 전부.
              질문·디자인 항목·개발 항목이 함께 오므로 출처별로 묶어 보여준다.
              (사내 표현은 PO가 아니라 PM) */}
          <TabsContent value="questions" className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              PM이 정해주지 않으면 디자이너·개발자가 결정할 수 없는 항목들 —
              이 탭을 그대로 PM에게 전달하면 됩니다
            </p>
            {pmCount === 0 ? (
              <EmptyTab>PM이 답해야 할 항목이 없습니다. 담당자가 설계하면서 정할 수 있는 것만 남았습니다.</EmptyTab>
            ) : (
              <>
                {pmQuestions.map((q, i) => (
                  <QuestionCard key={`q${i}`} q={q} index={i} accent marker={`Q${i + 1}`} />
                ))}
                {pmDesignItems.length > 0 && (
                  <>
                    <GroupLabel>디자인 착수를 막는 것</GroupLabel>
                    {[...pmDesignItems].sort(bySeverity).map((item, i) => (
                      <DesignerCard key={`pd${i}`} item={item} />
                    ))}
                  </>
                )}
                {pmDevItems.length > 0 && (
                  <>
                    <GroupLabel>개발 착수를 막는 것</GroupLabel>
                    {[...pmDevItems].sort(bySeverity).map((item, i) => (
                      <DevCard key={`pv${i}`} item={item} />
                    ))}
                  </>
                )}
              </>
            )}
          </TabsContent>

          {/* 디자인 확인 필요 탭 — 디자인 작업에 걸린 것 전부.
              위: 지금 정할 수 있는 것 / 아래: PM 답을 기다리는 것 */}
          <TabsContent value="missing" className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              화면 설계에 걸려 있는 항목들
            </p>
            {designCount === 0 ? (
              <EmptyTab>화면 설계에 걸린 항목이 없습니다.</EmptyTab>
            ) : (
              <>
                <SectionHeading
                  title="지금 정할 수 있는 것"
                  note="PM 답변을 기다리지 않고 UX 스펙 단계에서 결정하면 됩니다"
                  count={designActionable}
                  emptyText="지금 바로 정할 수 있는 항목은 없습니다 — 아래 항목의 답이 와야 화면 설계를 시작할 수 있습니다"
                />
                {[...ownerDesignItems].sort(bySeverity).map((item, i) => (
                  <DesignerCard key={`d${i}`} item={item} />
                ))}
                {ownerDesignQuestions.map((q, i) => (
                  <QuestionCard key={`dq${i}`} q={q} index={i} accent={false} />
                ))}

                {designWaiting.length + pmDesignItems.length > 0 && (
                  <>
                    <SectionHeading
                      title="PM 답변을 기다리는 것"
                      note="PM 확인 필요 탭에도 있는 항목입니다 — 답이 와야 이 화면 작업이 풀립니다"
                      count={designWaiting.length + pmDesignItems.length}
                    />
                    {[...pmDesignItems].sort(bySeverity).map((item, i) => (
                      <DesignerCard key={`dw${i}`} item={item} />
                    ))}
                    {designWaiting.map((q, i) => (
                      <QuestionCard key={`dwq${i}`} q={q} index={i} accent={false} />
                    ))}
                  </>
                )}
              </>
            )}
          </TabsContent>

          {/* 개발 확인 필요 탭 — 구현에 걸린 것 전부 (같은 두 구역 구조) */}
          <TabsContent value="dev" className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              구현에 걸려 있는 항목들
            </p>
            {devCount === 0 ? (
              <EmptyTab>구현에 걸린 항목이 없습니다.</EmptyTab>
            ) : (
              <>
                <SectionHeading
                  title="지금 정할 수 있는 것"
                  note="API 설계서 등 다음 산출물에서 결정하면 됩니다"
                  count={devActionable}
                  emptyText="지금 바로 정할 수 있는 항목은 없습니다 — 아래 항목의 답이 와야 구현을 시작할 수 있습니다"
                />
                {[...ownerDevItems].sort(bySeverity).map((item, i) => (
                  <DevCard key={`v${i}`} item={item} />
                ))}
                {ownerDevQuestions.map((q, i) => (
                  <QuestionCard key={`vq${i}`} q={q} index={i} accent={false} />
                ))}

                {devWaiting.length + pmDevItems.length > 0 && (
                  <>
                    <SectionHeading
                      title="PM 답변을 기다리는 것"
                      note="PM 확인 필요 탭에도 있는 항목입니다 — 답이 와야 이 구현이 풀립니다"
                      count={devWaiting.length + pmDevItems.length}
                    />
                    {[...pmDevItems].sort(bySeverity).map((item, i) => (
                      <DevCard key={`vw${i}`} item={item} />
                    ))}
                    {devWaiting.map((q, i) => (
                      <QuestionCard key={`vwq${i}`} q={q} index={i} accent={false} />
                    ))}
                  </>
                )}
              </>
            )}
          </TabsContent>

          {/* UX 제안 탭 */}
          <TabsContent value="recommendations" className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              사용성 및 비즈니스 성과를 높이기 위한 UX 제안
            </p>
            {result.ux_recommendations.map((rec, i) => {
              const n = normalizeRec(rec)
              const hasV2Meta = n.principle || n.perspective || n.effort || n.expected_impact
              return (
                <Card key={i} className="!py-0 bg-neutral-950">
                  <CardContent className="flex items-start gap-4 p-4">
                    <span className="flex-shrink-0 mt-0.5">💡</span>
                    <div className="flex flex-col gap-2 flex-1">
                      <span className="text-sm">{n.text}</span>
                      {hasV2Meta && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {n.principle && <Chip color="bg-slate-500/20 text-slate-300">{n.principle}</Chip>}
                          {n.perspective && <Chip color="bg-violet-500/20 text-violet-300">{n.perspective}</Chip>}
                          {n.effort && <span className="text-[10px] text-muted-foreground">효과 난이도: {n.effort}</span>}
                        </div>
                      )}
                      {n.expected_impact && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">기대효과: </span>{n.expected_impact}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>
        </Tabs>
        </div>
      </div>

      {/* 목업 타입 선택 모달 */}
      <Dialog open={showMockupModal} onOpenChange={(open) => { setShowMockupModal(open); if (!open) setIsRegenerate(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isRegenerate ? '목업 재생성' : '목업 스타일 선택'}</DialogTitle>
            <DialogDescription>
              {isRegenerate ? '재생성할 스타일을 선택하세요' : '원하는 목업 스타일을 선택하세요'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <button
              onClick={() => { setShowMockupModal(false); onGenerateMockup('lowfi', isRegenerate); setIsRegenerate(false) }}
              className="flex flex-col items-start gap-3 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
            >
              <div className="w-full h-20 rounded-lg bg-muted flex items-center justify-center">
                <div className="space-y-1.5 w-3/4">
                  <div className="h-2 bg-muted-foreground/40 rounded w-full" />
                  <div className="h-2 bg-muted-foreground/40 rounded w-2/3" />
                  <div className="h-5 bg-muted-foreground/20 border border-border rounded w-full mt-2" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Low-fi</p>
                <p className="text-xs text-muted-foreground mt-0.5">그레이스케일 와이어프레임</p>
              </div>
              {hasMockupLowFi && (
                <span className="text-xs text-primary font-medium">
                  {isRegenerate ? '다시 만들기 →' : '이미 생성됨 — 바로 열기 →'}
                </span>
              )}
            </button>

            <button
              onClick={() => { setShowMockupModal(false); onGenerateMockup('hifi', isRegenerate); setIsRegenerate(false) }}
              className="flex flex-col items-start gap-3 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
            >
              <div className="w-full h-20 rounded-lg bg-muted flex items-center justify-center">
                <div className="space-y-1.5 w-3/4">
                  <div className="h-2 bg-primary/60 rounded w-full" />
                  <div className="h-2 bg-primary/40 rounded w-2/3" />
                  <div className="h-5 bg-primary rounded w-full mt-2" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Hi-fi</p>
                <p className="text-xs text-muted-foreground mt-0.5">Ant Design 디자인 시스템</p>
              </div>
              {hasMockupHiFi && (
                <span className="text-xs text-primary font-medium">
                  {isRegenerate ? '다시 만들기 →' : '이미 생성됨 — 바로 열기 →'}
                </span>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
