'use client'

import { useState, useEffect } from 'react'
import ScoreGauge from '@/components/ScoreGauge'
import type { AnalysisResult, MissingItem, DevItem, MockupType } from '@/app/page'

interface ResultScreenProps {
  fileName: string
  result: AnalysisResult
  mockupCodeLowFi: string | null
  mockupCodeHiFi: string | null
  onGenerateMockup: (type: MockupType, regenerate?: boolean) => void
  onCancelMockup: () => void
  mockupGenerating: MockupType | null
  onReupload: () => void
}

type Tab = 'summary' | 'missing' | 'dev' | 'questions' | 'recommendations'

// PO 질문에서 [태그] 추출 및 컬러 매핑
function parseTag(q: string): { tag: string | null; color: string; rest: string } {
  const match = q.match(/^\[([^\]]+)\](.*)/)
  if (!match) return { tag: null, color: '', rest: q }
  const tag = match[1]
  const colors: Record<string, string> = {
    '디자인': 'bg-violet-500/20 text-violet-300',
    '개발': 'bg-blue-500/20 text-blue-300',
    '비즈니스': 'bg-amber-500/20 text-amber-300',
  }
  return { tag, color: colors[tag] ?? 'bg-slate-500/20 text-slate-300', rest: match[2].trim() }
}

// 기준 키 → 한국어 라벨 매핑
const CRITERIA_LABELS: Record<string, string> = {
  화면_인벤토리: '화면 인벤토리',
  데이터_상태: '데이터 상태',
  엣지케이스: '엣지케이스',
  인터랙션_로직: '인터랙션 로직',
  CTA_계층: 'CTA 계층',
}

// 점수에 따른 색상 반환
function criterionColor(score: number) {
  if (score >= 8) return { text: '#22c55e', bar: 'bg-green-500' }
  if (score >= 5) return { text: '#f59e0b', bar: 'bg-amber-500' }
  return { text: '#ef4444', bar: 'bg-red-500' }
}

export default function ResultScreen({
  fileName,
  result,
  mockupCodeLowFi,
  mockupCodeHiFi,
  onGenerateMockup,
  onCancelMockup,
  mockupGenerating,
  onReupload,
}: ResultScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>('summary')
  const [showMockupModal, setShowMockupModal] = useState(false)
  const [isRegenerate, setIsRegenerate] = useState(false)
  const [mockupProgress, setMockupProgress] = useState(0)

  // 목업 생성 중 진행률 시뮬레이션 — 실제 완료까지 95%까지만 증가
  useEffect(() => {
    if (mockupGenerating === null) {
      setMockupProgress(0)
      return
    }
    setMockupProgress(0)
    const interval = setInterval(() => {
      setMockupProgress(prev => {
        if (prev >= 94) return prev
        // 초반 빠르게 → 중반 보통 → 후반 매우 느리게 (API 대기 시간 커버)
        const increment = prev < 60 ? 2 : prev < 82 ? 0.4 : 0.08
        return Math.min(prev + increment, 94)
      })
    }, 300)
    return () => clearInterval(interval)
  }, [mockupGenerating])

  const devItems: DevItem[] = result.missing_for_developers ?? []

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'summary', label: '요약' },
    { id: 'missing', label: `디자이너 체크리스트 (${result.missing_for_designers.length})` },
    { id: 'dev', label: `개발자 체크리스트 (${devItems.length})` },
    { id: 'questions', label: `PO 확인 필요 (${result.critical_questions.length})` },
    { id: 'recommendations', label: 'UX 제안' },
  ]

  const criteriaEntries = Object.entries(result.criteria) as Array<
    [string, { score: number; notes: string }]
  >

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      {/* ── 헤더 ── */}
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M9 12l2 2 4-4" />
              <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
            </svg>
          </div>
          <span className="font-bold text-lg">Preflight</span>
        </div>
        <button
          onClick={onReupload}
          className="text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-4 py-2 rounded-lg transition-all"
        >
          ↩ 새 PRD 업로드
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* ── 파일 정보 ── */}
        <div className="flex items-center gap-2 mb-6">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
          <span className="text-sm text-slate-400">{fileName}</span>
          <span className="text-slate-700">·</span>
          <span className="text-sm text-slate-500">방금 분석됨</span>
        </div>

        {/* ── 점수 + 통계 카드 ── */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {/* 점수 게이지 */}
          <div className="col-span-1 bg-slate-900 rounded-2xl p-6 flex flex-col items-center justify-center border border-slate-800">
            <ScoreGauge score={result.sufficiency_score} />
            <p className="text-xs text-slate-500 mt-3 text-center">UI 구현 충분성 점수</p>
          </div>

          {/* 통계 카드 + CTA */}
          <div className="col-span-3 grid grid-cols-3 gap-4">
            {[
              { label: '검증 완료 항목', value: result.validated.length, color: '#22c55e', icon: '✓' },
              { label: '디자이너 확인 필요', value: result.missing_for_designers.length, color: '#f59e0b', icon: '⚠' },
              { label: 'PO 확인 필요', value: result.critical_questions.length, color: '#ef4444', icon: '?' },
            ].map((stat, i) => (
              <div key={i} className="bg-slate-900 rounded-2xl p-5 border border-slate-800 flex flex-col gap-2">
                <span className="text-2xl" style={{ color: stat.color }}>{stat.icon}</span>
                <span className="text-3xl font-bold text-white">{stat.value}</span>
                <span className="text-xs text-slate-500">{stat.label}</span>
              </div>
            ))}

            {/* 목업 생성 CTA 배너 */}
            <div className="col-span-3 bg-gradient-to-r from-violet-950 to-indigo-950 rounded-2xl p-5 border border-violet-800/50 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">이 기준 목업 미리보기 자동 생성</p>
                <p className="text-xs text-slate-400 mt-1">
                  분석된 화면 목록으로 React 컴포넌트를 자동 생성합니다
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {mockupGenerating !== null && (
                  <button
                    onClick={onCancelMockup}
                    className="text-sm text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 px-4 py-2.5 rounded-xl transition-all"
                  >
                    취소
                  </button>
                )}
                {/* 이미 생성된 목업이 있을 때 재생성 버튼 표시 */}
                {(mockupCodeLowFi || mockupCodeHiFi) && mockupGenerating === null && (
                  <button
                    onClick={() => {
                      setIsRegenerate(true)
                      setShowMockupModal(true)
                    }}
                    className="text-sm text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M1 4v6h6" />
                      <path d="M3.51 15a9 9 0 1 0 .49-3.8" />
                    </svg>
                    재생성
                  </button>
                )}
                <button
                  onClick={() => setShowMockupModal(true)}
                  disabled={mockupGenerating !== null}
                  className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-violet-500/30 flex items-center gap-2"
                >
                  {mockupGenerating !== null ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {Math.round(mockupProgress)}%
                    </>
                  ) : (
                    <>
                      목업 생성
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 목업 타입 선택 모달 */}
            {showMockupModal && (
              <div
                className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
                onClick={() => setShowMockupModal(false)}
              >
                <div
                  className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4"
                  onClick={e => e.stopPropagation()}
                >
                  <h3 className="text-base font-bold text-white mb-1">{isRegenerate ? '목업 재생성' : '목업 스타일 선택'}</h3>
                  <p className="text-xs text-slate-500 mb-6">{isRegenerate ? '재생성할 스타일을 선택하세요' : '원하는 목업 스타일을 선택하세요'}</p>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Low-fi */}
                    <button
                      onClick={() => { setShowMockupModal(false); onGenerateMockup('lowfi', isRegenerate); setIsRegenerate(false) }}
                      className="flex flex-col items-start gap-3 p-4 rounded-xl border border-slate-700 hover:border-violet-600 hover:bg-violet-600/10 transition-all text-left"
                    >
                      <div className="w-full h-20 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                        <div className="space-y-1.5 w-3/4">
                          <div className="h-2 bg-slate-600 rounded w-full" />
                          <div className="h-2 bg-slate-600 rounded w-2/3" />
                          <div className="h-5 bg-slate-700 border border-slate-600 rounded w-full mt-2" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Low-fi</p>
                        <p className="text-xs text-slate-400 mt-0.5">그레이스케일 와이어프레임</p>
                      </div>
                      {mockupCodeLowFi && (
                        <span className="text-xs text-violet-400 font-medium">이미 생성됨 — 바로 열기 →</span>
                      )}
                    </button>

                    {/* Hi-fi */}
                    <button
                      onClick={() => { setShowMockupModal(false); onGenerateMockup('hifi', isRegenerate); setIsRegenerate(false) }}
                      className="flex flex-col items-start gap-3 p-4 rounded-xl border border-slate-700 hover:border-violet-600 hover:bg-violet-600/10 transition-all text-left"
                    >
                      <div className="w-full h-20 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                        <div className="space-y-1.5 w-3/4">
                          <div className="h-2 bg-blue-500/60 rounded w-full" />
                          <div className="h-2 bg-blue-500/40 rounded w-2/3" />
                          <div className="h-5 bg-blue-500 rounded w-full mt-2" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Hi-fi</p>
                        <p className="text-xs text-slate-400 mt-0.5">Ant Design 디자인 시스템</p>
                      </div>
                      {mockupCodeHiFi && (
                        <span className="text-xs text-violet-400 font-medium">이미 생성됨 — 바로 열기 →</span>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => setShowMockupModal(false)}
                    className="mt-4 w-full text-sm text-slate-500 hover:text-slate-300 py-2 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 탭 네비게이션 ── */}
        <div className="flex gap-1 mb-6 bg-slate-900 p-1 rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'text-sm px-4 py-2 rounded-lg transition-all font-medium',
                activeTab === tab.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-500 hover:text-slate-300',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── 요약 탭 ── */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* 검증된 항목 */}
            <div>
              <p className="text-sm text-slate-400 mb-4">PRD에서 명확하게 정의된 항목들</p>
              <div className="space-y-3">
                {result.validated.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
                  >
                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 5가지 기준별 점수 */}
            <div>
              <p className="text-sm text-slate-400 mb-4">5가지 검증 기준별 상세</p>
              <div className="space-y-3">
                {criteriaEntries.map(([key, val]) => {
                  const { text, bar } = criterionColor(val.score)
                  return (
                    <div
                      key={key}
                      className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-4 space-y-2"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-200 font-medium">
                          {CRITERIA_LABELS[key] ?? key}
                        </span>
                        <span className="font-bold" style={{ color: text }}>
                          {val.score}/10
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${bar}`} style={{ width: `${val.score * 10}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{val.notes}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 디자이너 체크리스트 탭 ── */}
        {activeTab === 'missing' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400 mb-4">
              디자이너가 작업을 시작하기 전에 확인이 필요한 항목들
            </p>
            {result.missing_for_designers.map((item: MissingItem, i: number) => (
              <div key={i} className="bg-slate-900 border border-amber-800/40 rounded-2xl p-5">
                <div className="mb-3">
                  <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md">
                    {item.screen}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mb-3">
                  <span className="text-amber-400 font-medium">문제: </span>
                  {item.issue}
                </p>
                <div className="flex items-start gap-2 bg-slate-800/60 rounded-xl p-3">
                  <svg
                    width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="#8b5cf6" strokeWidth="2"
                    className="mt-0.5 flex-shrink-0"
                  >
                    <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zM12 8v4M12 16h.01" />
                  </svg>
                  <p className="text-xs text-slate-400">{item.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 개발자 체크리스트 탭 ── */}
        {activeTab === 'dev' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400 mb-4">
              개발 착수 전 시스템·데이터 로직 관점에서 확인이 필요한 항목들
            </p>
            {devItems.length === 0 ? (
              <p className="text-sm text-slate-600">항목이 없습니다.</p>
            ) : devItems.map((item: DevItem, i: number) => (
              <div key={i} className="bg-slate-900 border border-blue-800/40 rounded-2xl p-5">
                <div className="mb-3">
                  <span className="text-xs font-semibold text-blue-400 bg-blue-400/10 px-2 py-1 rounded-md">
                    {item.module}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mb-3">
                  <span className="text-blue-400 font-medium">문제: </span>
                  {item.issue}
                </p>
                <div className="flex items-start gap-2 bg-slate-800/60 rounded-xl p-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                    <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zM12 8v4M12 16h.01" />
                  </svg>
                  <p className="text-xs text-slate-400">{item.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── PO 확인 필요 탭 ── */}
        {activeTab === 'questions' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400 mb-4">
              개발 착수 전 PO가 답변해야 할 핵심 질문들
            </p>
            {result.critical_questions.map((q, i) => {
              const { tag, color, rest } = parseTag(q)
              return (
                <div
                  key={i}
                  className="flex items-start gap-4 bg-slate-900 border border-red-900/40 rounded-xl px-5 py-4"
                >
                  <span className="text-sm font-bold text-red-400 flex-shrink-0 mt-0.5">Q{i + 1}</span>
                  <div className="flex flex-col gap-1.5">
                    {tag && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md w-fit ${color}`}>
                        {tag}
                      </span>
                    )}
                    <span className="text-sm text-slate-300">{rest}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── UX 제안 탭 ── */}
        {activeTab === 'recommendations' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400 mb-4">
              사용성 및 비즈니스 성과를 높이기 위한 UX 제안
            </p>
            {result.ux_recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-4 bg-indigo-950/50 border border-indigo-800/40 rounded-xl px-5 py-4"
              >
                <span className="text-indigo-400 flex-shrink-0 mt-0.5">💡</span>
                <span className="text-sm text-slate-300">{rec}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
