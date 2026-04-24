'use client'

import { useState, useEffect } from 'react'
import ScoreGauge from '@/components/ScoreGauge'
import type { AnalysisResult, MissingItem, DevItem, MockupType } from '@/app/page'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

interface ResultScreenProps {
  fileName: string
  result: AnalysisResult
  hasMockupLowFi: boolean
  hasMockupHiFi: boolean
  onGenerateMockup: (type: MockupType, regenerate?: boolean) => void
  onCancelMockup: () => void
  mockupGenerating: MockupType | null
  onReupload: () => void
}

// ============================================================================
// v1/v2 호환 헬퍼
// ----------------------------------------------------------------------------
// v1: critical_questions[i]는 문자열 — "[개발] ... [A] ... [B] ..."
// v2: critical_questions[i]는 객체 — {tag, question, format, options, impact, blocks}
// ============================================================================

type TagVariant = 'default' | 'secondary' | 'outline'

const TAG_VARIANTS: Record<string, TagVariant> = {
  '디자인': 'default',
  '개발': 'secondary',
  '비즈니스': 'outline',
  'UX정책': 'outline',
}

// 태그 문자열에서 대괄호 제거: "[개발]" -> "개발", "개발" -> "개발"
function stripBrackets(tag: string): string {
  const m = tag.match(/^\[([^\]]+)\]$/)
  return m ? m[1] : tag
}

// v1 문자열 파싱 (기존 로직 유지)
function parseTagFromString(q: string): { tag: string | null; variant: TagVariant; rest: string } {
  const match = q.match(/^\[([^\]]+)\](.*)/)
  if (!match) return { tag: null, variant: 'secondary', rest: q }
  const tag = match[1]
  return { tag, variant: TAG_VARIANTS[tag] ?? 'secondary', rest: match[2].trim() }
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
function severityBadge(severity?: number): { variant: TagVariant; label: string } | null {
  if (severity === undefined || severity === null) return null
  const map: Record<number, { variant: TagVariant; label: string }> = {
    1: { variant: 'outline', label: 'Cosmetic' },
    2: { variant: 'outline', label: 'Minor' },
    3: { variant: 'secondary', label: 'Major' },
    4: { variant: 'default', label: 'Catastrophic' },
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
  onGenerateMockup,
  onCancelMockup,
  mockupGenerating,
  onReupload,
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
        if (prev >= 94) return prev
        const increment = prev < 60 ? 2 : prev < 82 ? 0.4 : 0.08
        return Math.min(prev + increment, 94)
      })
    }, 300)
    return () => clearInterval(interval)
  }, [mockupGenerating])

  const devItems: DevItem[] = result.missing_for_developers ?? []

  // v2의 notes는 객체일 수 있음 — unknown으로 받고 렌더링 시 분기
  const criteriaEntries = Object.entries(result.criteria) as Array<
    [string, { score: number | null; notes?: unknown; evidence?: string; missing?: string[]; applied_principle?: string }]
  >

  return (
    <div className="min-h-screen">
      {/* 헤더 */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">Preflight</span>
        </div>
        <Button variant="outline" size="sm" onClick={onReupload}>
          ↩ 새 PRD 업로드
        </Button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* 파일 정보 */}
        <div className="flex items-center gap-2 mb-6">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
          <span className="text-sm text-muted-foreground">{fileName}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">방금 분석됨</span>
        </div>

        {/* 점수 + 통계 카드 */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="col-span-1 flex flex-col items-center justify-center">
            <CardContent className="flex flex-col items-center pt-6">
              <ScoreGauge score={result.sufficiency_score} />
              <p className="text-xs text-muted-foreground mt-3 text-center">UI 구현 충분성 점수</p>
            </CardContent>
          </Card>

          <div className="col-span-3 grid grid-cols-3 gap-4">
            {[
              { label: '검증 완료 항목', value: result.validated.length, icon: '✓' },
              { label: '디자이너 확인 필요', value: result.missing_for_designers.length, icon: '⚠' },
              { label: 'PO 확인 필요', value: result.critical_questions.length, icon: '?' },
            ].map((stat, i) => (
              <Card key={i}>
                <CardContent className="pt-5 flex flex-col gap-2">
                  <span className="text-2xl">{stat.icon}</span>
                  <span className="text-3xl font-bold">{stat.value}</span>
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </CardContent>
              </Card>
            ))}

            {/* 목업 생성 CTA */}
            <Card className="col-span-3 border-primary/20">
              <CardContent className="pt-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">이 기준 목업 미리보기 자동 생성</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    분석된 화면 목록으로 React 컴포넌트를 자동 생성합니다
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {mockupGenerating !== null && (
                    <Button variant="outline" size="sm" onClick={onCancelMockup}>
                      취소
                    </Button>
                  )}
                  {(hasMockupLowFi || hasMockupHiFi) && mockupGenerating === null && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setIsRegenerate(true); setShowMockupModal(true) }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mr-1">
                        <path d="M1 4v6h6" />
                        <path d="M3.51 15a9 9 0 1 0 .49-3.8" />
                      </svg>
                      재생성
                    </Button>
                  )}
                  <Button
                    onClick={() => { setShowMockupModal(true); setIsRegenerate(false) }}
                    disabled={mockupGenerating !== null}
                  >
                    {mockupGenerating !== null ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {Math.round(mockupProgress)}%
                      </span>
                    ) : (hasMockupLowFi || hasMockupHiFi) ? '생성된 목업 보기 →' : '목업 생성 →'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 탭 */}
        <Tabs defaultValue="summary">
          <TabsList className="mb-6 w-full h-auto flex-wrap gap-1">
            <TabsTrigger value="summary" className="flex-1 min-w-fit">요약</TabsTrigger>
            <TabsTrigger value="missing" className="flex-1 min-w-fit">디자이너 체크리스트 ({result.missing_for_designers.length})</TabsTrigger>
            <TabsTrigger value="dev" className="flex-1 min-w-fit">개발자 체크리스트 ({devItems.length})</TabsTrigger>
            <TabsTrigger value="questions" className="flex-1 min-w-fit">PO 확인 필요 ({result.critical_questions.length})</TabsTrigger>
            <TabsTrigger value="recommendations" className="flex-1 min-w-fit">UX 제안</TabsTrigger>
          </TabsList>

          {/* 요약 탭 */}
          <TabsContent value="summary" className="space-y-6">
            <div>
              <p className="text-sm text-muted-foreground mb-4">PRD에서 명확하게 정의된 항목들</p>
              <div className="space-y-3">
                {result.validated.map((item, i) => (
                  <Card key={i}>
                    <CardContent className="flex items-start gap-3 py-3 px-4">
                      <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
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
                  const notesText = extractNotesText(val.notes ?? val)
                  // v2 전용 필드 직접 활용 (있을 때만)
                  const v2Notes = typeof val.notes === 'object' && val.notes !== null ? val.notes as {
                    evidence?: string
                    missing?: string[]
                    applied_principle?: string
                  } : null

                  return (
                    <Card key={key}>
                      <CardContent className="py-4 px-4 space-y-2">
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
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          {/* 디자이너 체크리스트 탭 */}
          <TabsContent value="missing" className="space-y-4">
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
                <Card key={i} className="border-amber-800/40">
                  <CardContent className="pt-5 px-5 pb-5">
                    <div className="mb-3 flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-amber-400 border-amber-400/30">{item.screen}</Badge>
                      {sev && <Badge variant={sev.variant}>{sev.label}</Badge>}
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                        <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zM12 8v4M12 16h.01" />
                      </svg>
                      <p className="text-xs text-muted-foreground">{item.suggestion}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>

          {/* 개발자 체크리스트 탭 */}
          <TabsContent value="dev" className="space-y-4">
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
                <Card key={i} className="border-blue-800/40">
                  <CardContent className="pt-5 px-5 pb-5">
                    <div className="mb-3 flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-blue-400">{item.module}</Badge>
                      {sev && <Badge variant={sev.variant}>{sev.label}</Badge>}
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                        <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zM12 8v4M12 16h.01" />
                      </svg>
                      <p className="text-xs text-muted-foreground">{item.suggestion}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>

          {/* PO 확인 필요 탭 */}
          <TabsContent value="questions" className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              개발 착수 전 PO가 답변해야 할 핵심 질문들
            </p>
            {result.critical_questions.map((q, i) => {
              // v1: string, v2: object
              if (isQuestionV2(q)) {
                const tagText = stripBrackets(q.tag)
                const variant = TAG_VARIANTS[tagText] ?? 'secondary'
                return (
                  <Card key={i} className="border-destructive/20">
                    <CardContent className="flex items-start gap-4 py-4 px-5">
                      <span className="text-sm font-bold text-destructive flex-shrink-0 mt-0.5">Q{i + 1}</span>
                      <div className="flex flex-col gap-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={variant} className="w-fit">{tagText}</Badge>
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
                    </CardContent>
                  </Card>
                )
              }
              // v1 fallback — 문자열 기반
              const { tag, variant, rest } = parseTagFromString(q as string)
              return (
                <Card key={i} className="border-destructive/20">
                  <CardContent className="flex items-start gap-4 py-4 px-5">
                    <span className="text-sm font-bold text-destructive flex-shrink-0 mt-0.5">Q{i + 1}</span>
                    <div className="flex flex-col gap-1.5">
                      {tag && <Badge variant={variant} className="w-fit">{tag}</Badge>}
                      <span className="text-sm">{rest}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
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
                <Card key={i}>
                  <CardContent className="flex items-start gap-4 py-4 px-5">
                    <span className="flex-shrink-0 mt-0.5">💡</span>
                    <div className="flex flex-col gap-2 flex-1">
                      <span className="text-sm">{n.text}</span>
                      {hasV2Meta && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {n.principle && <Badge variant="outline" className="text-[10px]">{n.principle}</Badge>}
                          {n.perspective && <Badge variant="secondary" className="text-[10px]">{n.perspective}</Badge>}
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
