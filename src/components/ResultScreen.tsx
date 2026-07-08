'use client'

import { useState } from 'react'
import ScoreGauge from '@/components/ScoreGauge'
import type { AnalysisResult, MissingItem, DevItem, MockupType } from '@/app/page'
// astryx 실제 컴포넌트 (StyleX 런타임 + astryx.css)
import { Button as AstryxButton } from '@astryxdesign/core/Button'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Badge as AstryxBadge, type BadgeVariant } from '@astryxdesign/core/Badge'
import { Card as AstryxCard } from '@astryxdesign/core/Card'
import { TabList, Tab } from '@astryxdesign/core/TabList'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { formatHistoryDate } from '@/lib/analysis-history'

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
  mockupProgress: number | null
  onReupload: () => void
}

// ============================================================================
// v1/v2 호환 헬퍼
// ----------------------------------------------------------------------------
// v1: critical_questions[i]는 문자열 — "[개발] ... [A] ... [B] ..."
// v2: critical_questions[i]는 객체 — {tag, question, format, options, impact, blocks}
// ============================================================================

// astryx Badge 의 semantic/color variant 로 매핑
const TAG_VARIANTS: Record<string, BadgeVariant> = {
  '디자인': 'blue',
  '개발': 'purple',
  '비즈니스': 'orange',
  'UX정책': 'teal',
}

// 태그 문자열에서 대괄호 제거: "[개발]" -> "개발", "개발" -> "개발"
function stripBrackets(tag: string): string {
  const m = tag.match(/^\[([^\]]+)\]$/)
  return m ? m[1] : tag
}

// v1 문자열 파싱 (기존 로직 유지)
function parseTagFromString(q: string): { tag: string | null; variant: BadgeVariant; rest: string } {
  const match = q.match(/^\[([^\]]+)\](.*)/)
  if (!match) return { tag: null, variant: 'neutral', rest: q }
  const tag = match[1]
  return { tag, variant: TAG_VARIANTS[tag] ?? 'neutral', rest: match[2].trim() }
}

// v2 객체 대응 — 추후 렌더링에서 활용
interface QuestionV2 {
  tag: string
  question: string
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
const CRITERIA_LABELS: Record<string, string> = {
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

function criterionColor(score: number) {
  if (score >= 8) return { text: 'text-green-600', hex: '#22c55e' }
  if (score >= 5) return { text: 'text-amber-500', hex: '#f59e0b' }
  return { text: 'text-red-500', hex: '#ef4444' }
}

// ============================================================================
// criteria notes 정규화: v1 문자열 / v2 객체 모두 요약 텍스트로 변환
// ============================================================================
function extractNotesText(notes: unknown): string {
  if (typeof notes === 'string') return notes
  if (typeof notes === 'object' && notes !== null) {
    const n = notes as {
      evidence?: string
      missing?: string[]
      applied_principle?: string
    }
    const parts: string[] = []
    if (n.evidence) parts.push(n.evidence)
    if (n.missing && n.missing.length > 0) {
      parts.push(`누락: ${n.missing.join(', ')}`)
    }
    if (n.applied_principle) parts.push(`적용 원칙: ${n.applied_principle}`)
    return parts.join(' · ')
  }
  return ''
}

// v2 severity 뱃지 스타일
function severityBadge(severity?: number): { variant: BadgeVariant; label: string } | null {
  if (severity === undefined || severity === null) return null
  const map: Record<number, { variant: BadgeVariant; label: string }> = {
    1: { variant: 'neutral', label: 'Cosmetic' },
    2: { variant: 'info', label: 'Minor' },
    3: { variant: 'warning', label: 'Major' },
    4: { variant: 'error', label: 'Catastrophic' },
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
  mockupProgress,
  onReupload,
}: ResultScreenProps) {
  // 진행률이 있으면 "생성 중 45%", 없으면 "생성 중"
  const generatingLabel =
    mockupProgress != null ? `생성 중 ${mockupProgress}%` : '생성 중'
  const [showMockupModal, setShowMockupModal] = useState(false)
  const [isRegenerate, setIsRegenerate] = useState(false)
  // astryx TabList 는 탭 스트립만 담당(controlled) — 활성 패널은 직접 상태로 관리
  const [tab, setTab] = useState('recommendations')

  const devItems: DevItem[] = result.missing_for_developers ?? []

  // v2의 notes는 객체일 수 있음 — unknown으로 받고 렌더링 시 분기
  const criteriaEntries = Object.entries(result.criteria) as Array<
    [string, { score: number | null; notes?: unknown; evidence?: string; missing?: string[]; applied_principle?: string }]
  >

  return (
    <div data-astryx-theme="neutral" className="min-h-screen [&_button]:rounded-md">
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
      </div>

      <div className="overflow-x-auto">
        <div className="max-w-[900px] mx-auto px-6 py-8 min-w-[500px]">
          {/* 파일 정보 */}
          <div className="flex items-center gap-2 mb-6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            <span className="text-sm text-muted-foreground">{fileName}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">방금 분석됨</span>
          </div>

        {/* 점수 + 목업 카드 */}
        <div className="grid grid-cols-3 gap-2 mb-8">
          {/* Score - 2행 span */}
          <AstryxCard padding={0} className="flex flex-col items-center justify-center row-span-2 max-h-[200px]">
            <div className="flex items-center justify-center p-4">
              <ScoreGauge score={result.sufficiency_score} />
            </div>
          </AstryxCard>

          {/* Lo-Fi 카드 */}
          <AstryxCard padding={0} className={`col-span-2 max-h-[100px] overflow-hidden !py-0 ${hasMockupLowFi ? '' : 'bg-muted/30'}`}>
            <div className="p-3 h-full flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold">Lo-Fi</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-muted text-muted-foreground">
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
                    <AstryxButton
                      variant="primary"
                      size="sm"
                      isDisabled
                      icon={<Spinner size="sm" shade="inherit" />}
                      label={generatingLabel}
                    />
                    <AstryxButton variant="secondary" size="sm" label="취소" onClick={onCancelMockup} />
                  </>
                ) : hasMockupLowFi ? (
                  <>
                    <AstryxButton variant="primary" size="sm" label="보기" onClick={() => onGenerateMockup('lowfi', false)} isDisabled={mockupGenerating !== null} />
                    <AstryxButton variant="secondary" size="sm" label="재생성" onClick={() => onGenerateMockup('lowfi', true)} isDisabled={mockupGenerating !== null} />
                  </>
                ) : (
                  <AstryxButton variant="primary" size="sm" label="생성하기" onClick={() => onGenerateMockup('lowfi', false)} isDisabled={mockupGenerating !== null} />
                )}
              </div>
            </div>
          </AstryxCard>

          {/* Hi-Fi 카드 */}
          <AstryxCard padding={0} className={`col-span-2 max-h-[100px] overflow-hidden !py-0 ${hasMockupHiFi ? '' : 'bg-muted/30'}`}>
            <div className="p-3 h-full flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold">Hi-Fi</span>
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border border-primary/30 bg-primary/10 text-primary">
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
                    <AstryxButton
                      variant="primary"
                      size="sm"
                      isDisabled
                      icon={<Spinner size="sm" shade="inherit" />}
                      label={generatingLabel}
                    />
                    <AstryxButton variant="secondary" size="sm" label="취소" onClick={onCancelMockup} />
                  </>
                ) : hasMockupHiFi ? (
                  <>
                    <AstryxButton variant="primary" size="sm" label="보기" onClick={() => onGenerateMockup('hifi', false)} isDisabled={mockupGenerating !== null} />
                    <AstryxButton variant="secondary" size="sm" label="재생성" onClick={() => onGenerateMockup('hifi', true)} isDisabled={mockupGenerating !== null} />
                  </>
                ) : (
                  <AstryxButton variant="primary" size="sm" label="생성하기" onClick={() => onGenerateMockup('hifi', false)} isDisabled={mockupGenerating !== null} />
                )}
              </div>
            </div>
          </AstryxCard>
        </div>

        {/* 탭 */}
        <TabList value={tab} onChange={setTab} layout="fill" className="mb-6">
          <Tab value="recommendations" label="UX 제안" />
          <Tab value="summary" label="요약" />
          <Tab value="missing" label={`디자이너 체크리스트 (${result.missing_for_designers.length})`} />
          <Tab value="dev" label={`개발자 체크리스트 (${devItems.length})`} />
          <Tab value="questions" label={`PO 확인 필요 (${result.critical_questions.length})`} />
        </TabList>

          {/* 요약 탭 */}
          {tab === 'summary' && (
          <div className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-4">PRD에서 명확하게 정의된 항목들</p>
              <div className="space-y-3">
                {result.validated.map((item, i) => (
                  <AstryxCard padding={0} key={i}>
                    <div className="flex items-start gap-3 py-3 px-4">
                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm">{item}</span>
                    </div>
                  </AstryxCard>
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
                  const notesText = extractNotesText(val.notes ?? val)
                  // v2 전용 필드 직접 활용 (있을 때만)
                  const v2Notes = typeof val.notes === 'object' && val.notes !== null ? val.notes as {
                    evidence?: string
                    missing?: string[]
                    applied_principle?: string
                  } : null

                  return (
                    <AstryxCard padding={0} key={key}>
                      <div className="py-4 px-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{CRITERIA_LABELS[key] ?? key}</span>
                          <span className={`font-bold ${text}`}>{val.score}/10</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${val.score * 10}%`, backgroundColor: hex }} />
                        </div>
                        {/* v2: evidence/missing/applied_principle을 구조화해서 표시. v1: 기존 notes 문자열 */}
                        {v2Notes ? (
                          <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                            {v2Notes.evidence && <p><span className="font-medium">근거:</span> {v2Notes.evidence}</p>}
                            {v2Notes.missing && v2Notes.missing.length > 0 && (
                              <p><span className="font-medium">누락:</span> {v2Notes.missing.join(', ')}</p>
                            )}
                            {v2Notes.applied_principle && <p className="text-[10px] opacity-70">원칙: {v2Notes.applied_principle}</p>}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground leading-relaxed">{notesText}</p>
                        )}
                      </div>
                    </AstryxCard>
                  )
                })}
              </div>
            </div>
          </div>
          )}

          {/* 디자이너 체크리스트 탭 */}
          {tab === 'missing' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              디자이너가 작업을 시작하기 전에 확인이 필요한 항목들
            </p>
            {result.missing_for_designers.map((item: MissingItem, i: number) => {
              // v2 optional fields
              const v2Item = item as MissingItem & {
                principle?: string
                severity?: number
                user_impact?: string
              }
              const sev = severityBadge(v2Item.severity)
              return (
                <AstryxCard padding={0} key={i}>
                  <div className="pt-5 px-5 pb-5">
                    <div className="mb-3 flex items-center gap-2 flex-wrap">
                      <AstryxBadge variant="orange" label={item.screen} />
                      {sev && <AstryxBadge variant={sev.variant} label={sev.label} />}
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
                    <div className="flex items-start gap-2 bg-muted rounded-xl p-3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                        <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zM12 8v4M12 16h.01" />
                      </svg>
                      <p className="text-xs text-muted-foreground">{item.suggestion}</p>
                    </div>
                  </div>
                </AstryxCard>
              )
            })}
          </div>
          )}

          {/* 개발자 체크리스트 탭 */}
          {tab === 'dev' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              개발 착수 전 시스템·데이터 로직 관점에서 확인이 필요한 항목들
            </p>
            {devItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">항목이 없습니다.</p>
            ) : devItems.map((item: DevItem, i: number) => {
              const v2Item = item as DevItem & {
                risk?: string
                severity?: number
              }
              const sev = severityBadge(v2Item.severity)
              return (
                <AstryxCard padding={0} key={i}>
                  <div className="pt-5 px-5 pb-5">
                    <div className="mb-3 flex items-center gap-2 flex-wrap">
                      <AstryxBadge variant="blue" label={item.module} />
                      {sev && <AstryxBadge variant={sev.variant} label={sev.label} />}
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
                    <div className="flex items-start gap-2 bg-muted rounded-xl p-3">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                        <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zM12 8v4M12 16h.01" />
                      </svg>
                      <p className="text-xs text-muted-foreground">{item.suggestion}</p>
                    </div>
                  </div>
                </AstryxCard>
              )
            })}
          </div>
          )}

          {/* PO 확인 필요 탭 */}
          {tab === 'questions' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              개발 착수 전 PO가 답변해야 할 핵심 질문들
            </p>
            {result.critical_questions.map((q, i) => {
              // v1: string, v2: object
              if (isQuestionV2(q)) {
                const tagText = stripBrackets(q.tag)
                const variant = TAG_VARIANTS[tagText] ?? 'neutral'
                return (
                  <AstryxCard padding={0} key={i}>
                    <div className="flex items-start gap-4 py-4 px-5">
                      <span className="text-sm font-bold text-destructive flex-shrink-0 mt-0.5">Q{i + 1}</span>
                      <div className="flex flex-col gap-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <AstryxBadge variant={variant} label={tagText} />
                          {q.format && (
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              {q.format}
                            </span>
                          )}
                        </div>
                        <span className="text-sm">{q.question}</span>
                        {q.options && q.options.length > 0 && (
                          <div className="flex flex-col gap-1 mt-1">
                            {q.options.map((opt, idx) => (
                              <div key={idx} className="text-xs bg-muted rounded-md px-3 py-1.5 border border-border">
                                <span className="font-mono text-muted-foreground mr-2">
                                  {String.fromCharCode(65 + idx)}.
                                </span>
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                        {q.impact && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">영향: </span>{q.impact}
                          </p>
                        )}
                        {q.blocks && q.blocks.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">차단 중: </span>{q.blocks.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </AstryxCard>
                )
              }
              // v1 fallback — 문자열 기반
              const { tag, variant, rest } = parseTagFromString(q as string)
              return (
                <AstryxCard padding={0} key={i}>
                  <div className="flex items-start gap-4 py-4 px-5">
                    <span className="text-sm font-bold text-destructive flex-shrink-0 mt-0.5">Q{i + 1}</span>
                    <div className="flex flex-col gap-1.5">
                      {tag && <AstryxBadge variant={variant} label={tag} />}
                      <span className="text-sm">{rest}</span>
                    </div>
                  </div>
                </AstryxCard>
              )
            })}
          </div>
          )}

          {/* UX 제안 탭 */}
          {tab === 'recommendations' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              사용성 및 비즈니스 성과를 높이기 위한 UX 제안
            </p>
            {result.ux_recommendations.map((rec, i) => {
              const n = normalizeRec(rec)
              const hasV2Meta = n.principle || n.perspective || n.effort || n.expected_impact
              return (
                <AstryxCard padding={0} key={i}>
                  <div className="flex items-start gap-4 py-4 px-5">
                    <span className="flex-shrink-0 mt-0.5">💡</span>
                    <div className="flex flex-col gap-2 flex-1">
                      <span className="text-sm">{n.text}</span>
                      {hasV2Meta && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {n.principle && <AstryxBadge variant="neutral" label={n.principle} />}
                          {n.perspective && <AstryxBadge variant="purple" label={n.perspective} />}
                          {n.effort && <span className="text-[10px] text-muted-foreground">효과 난이도: {n.effort}</span>}
                        </div>
                      )}
                      {n.expected_impact && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">기대효과: </span>{n.expected_impact}
                        </p>
                      )}
                    </div>
                  </div>
                </AstryxCard>
              )
            })}
          </div>
          )}
        </div>
      </div>

      {/* 목업 타입 선택 모달 */}
      <Dialog data-astryx-theme="neutral" isOpen={showMockupModal} onOpenChange={(open) => { setShowMockupModal(open); if (!open) setIsRegenerate(false) }}>
        <DialogHeader
          title={isRegenerate ? '목업 재생성' : '목업 스타일 선택'}
          subtitle={isRegenerate ? '재생성할 스타일을 선택하세요' : '원하는 목업 스타일을 선택하세요'}
          onOpenChange={(open) => { setShowMockupModal(open); if (!open) setIsRegenerate(false) }}
          hasDivider
        />

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
      </Dialog>
    </div>
  )
}
