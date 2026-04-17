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

function parseTag(q: string): { tag: string | null; variant: 'default' | 'secondary' | 'outline'; rest: string } {
  const match = q.match(/^\[([^\]]+)\](.*)/)
  if (!match) return { tag: null, variant: 'default', rest: q }
  const tag = match[1]
  const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
    '디자인': 'default',
    '개발': 'secondary',
    '비즈니스': 'outline',
  }
  return { tag, variant: variants[tag] ?? 'secondary', rest: match[2].trim() }
}

const CRITERIA_LABELS: Record<string, string> = {
  화면_인벤토리: '화면 인벤토리',
  데이터_상태: '데이터 상태',
  엣지케이스: '엣지케이스',
  인터랙션_로직: '인터랙션 로직',
  CTA_계층: 'CTA 계층',
}

function criterionColor(score: number) {
  if (score >= 8) return { text: 'text-green-600', hex: '#22c55e' }
  if (score >= 5) return { text: 'text-amber-500', hex: '#f59e0b' }
  return { text: 'text-red-500', hex: '#ef4444' }
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

  const criteriaEntries = Object.entries(result.criteria) as Array<
    [string, { score: number; notes: string }]
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
              <p className="text-sm text-muted-foreground mb-4">5가지 검증 기준별 상세</p>
              <div className="space-y-3">
                {criteriaEntries.map(([key, val]) => {
                  const { text, hex } = criterionColor(val.score)
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
                        <p className="text-xs text-muted-foreground leading-relaxed">{val.notes}</p>
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
            {result.missing_for_designers.map((item: MissingItem, i: number) => (
              <Card key={i} className="border-amber-800/40">
                <CardContent className="pt-5 px-5 pb-5">
                  <div className="mb-3">
                    <Badge variant="outline" className="text-amber-400 border-amber-400/30">{item.screen}</Badge>
                  </div>
                  <p className="text-sm mb-3">
                    <span className="text-amber-400 font-medium">문제: </span>
                    {item.issue}
                  </p>
                  <div className="flex items-start gap-2 bg-muted rounded-xl p-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                      <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zM12 8v4M12 16h.01" />
                    </svg>
                    <p className="text-xs text-muted-foreground">{item.suggestion}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* 개발자 체크리스트 탭 */}
          <TabsContent value="dev" className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              개발 착수 전 시스템·데이터 로직 관점에서 확인이 필요한 항목들
            </p>
            {devItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">항목이 없습니다.</p>
            ) : devItems.map((item: DevItem, i: number) => (
              <Card key={i} className="border-blue-800/40">
                <CardContent className="pt-5 px-5 pb-5">
                  <div className="mb-3">
                    <Badge variant="secondary" className="text-blue-400">{item.module}</Badge>
                  </div>
                  <p className="text-sm mb-3">
                    <span className="text-blue-400 font-medium">문제: </span>
                    {item.issue}
                  </p>
                  <div className="flex items-start gap-2 bg-muted rounded-xl p-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                      <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zM12 8v4M12 16h.01" />
                    </svg>
                    <p className="text-xs text-muted-foreground">{item.suggestion}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* PO 확인 필요 탭 */}
          <TabsContent value="questions" className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              개발 착수 전 PO가 답변해야 할 핵심 질문들
            </p>
            {result.critical_questions.map((q, i) => {
              const { tag, variant, rest } = parseTag(q)
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
            {result.ux_recommendations.map((rec, i) => (
              <Card key={i}>
                <CardContent className="flex items-start gap-4 py-4 px-5">
                  <span className="flex-shrink-0 mt-0.5">💡</span>
                  <span className="text-sm">{rec}</span>
                </CardContent>
              </Card>
            ))}
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
