'use client'

import { useEffect, useState } from 'react'

// 분석 단계 목록 (Claude 처리 흐름 반영)
const STEPS = [
  '파일 텍스트 추출 중',
  '화면 인벤토리 분석 중',
  '엣지케이스 탐지 중',
  '비즈니스 로직 검증 중',
  '결과 정리 중',
]

export default function AnalyzingScreen() {
  const [completedCount, setCompletedCount] = useState(0)
  const [progress, setProgress] = useState(0)

  // 분석 진행 상황을 시각적으로 표현 — 실제 스트리밍과 무관하게 타이머로 단계 진행
  useEffect(() => {
    const interval = setInterval(() => {
      setCompletedCount(prev => (prev < STEPS.length - 1 ? prev + 1 : prev))
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  // completedCount 기반 목표 퍼센트로 progress를 부드럽게 증가
  useEffect(() => {
    const targetProgress = Math.round((completedCount / STEPS.length) * 90)
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= targetProgress) return prev
        return Math.min(prev + 1, targetProgress)
      })
    }, 30)
    return () => clearInterval(timer)
  }, [completedCount])

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-6">
      {/* 로고 */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-light to-accent flex items-center justify-center mb-8">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          <path d="M9 12l2 2 4-4" />
          <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
        </svg>
      </div>

      <h2 className="text-xl font-bold text-ink-primary mb-2">PRD 분석 중...</h2>
      <p className="text-ink-muted text-sm mb-6">잠시만 기다려주세요. 보통 15~30초 소요됩니다.</p>

      {/* 진행률 바 */}
      <div className="w-full max-w-sm mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-ink-muted">진행률</span>
          <span className="text-sm font-semibold text-brand-light">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-surface-raised rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand to-accent-light rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 단계별 진행 상태 */}
      <div className="w-full max-w-sm space-y-4">
        {STEPS.map((step, i) => {
          const isDone = i < completedCount
          const isActive = i === completedCount

          return (
            <div key={i} className="flex items-center gap-3">
              <div
                className={[
                  'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
                  isDone ? 'bg-brand' : 'border-2 border-surface-overlay',
                ].join(' ')}
              >
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div
                    className={[
                      'w-2 h-2 rounded-full bg-ink-faint',
                      isActive ? 'animate-pulse' : '',
                    ].join(' ')}
                  />
                )}
              </div>
              <span
                className={`text-sm ${isDone || isActive ? 'text-ink-subtle' : 'text-ink-faint'}`}
              >
                {step}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
