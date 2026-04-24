'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'

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

  useEffect(() => {
    const interval = setInterval(() => {
      setCompletedCount(prev => (prev < STEPS.length - 1 ? prev + 1 : prev))
    }, 4000)
    return () => clearInterval(interval)
  }, [])

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

  useEffect(() => {
    if (completedCount < STEPS.length - 1) return
    const creep = setInterval(() => {
      setProgress(prev => (prev < 89 ? prev + 0.2 : prev))
    }, 500)
    return () => clearInterval(creep)
  }, [completedCount])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <h2 className="text-xl font-bold mb-2">PRD 분석 중...</h2>
      <p className="text-muted-foreground text-sm mb-6">잠시만 기다려주세요. 보통 1분~3분가량 소요됩니다.</p>

      <div className="w-full max-w-sm mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-muted-foreground">진행률</span>
          <span className="text-sm font-semibold">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="w-full max-w-sm space-y-4">
        {STEPS.map((step, i) => {
          const isDone = i < completedCount
          const isActive = i === completedCount

          return (
            <div key={i} className="flex items-center gap-3">
              <div
                className={[
                  'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-primary-foreground',
                  isDone ? 'bg-primary' : isActive ? 'border-2 border-primary' : 'border-2 border-border',
                ].join(' ')}
              >
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div className={['w-2 h-2 rounded-full', isActive ? 'bg-primary animate-pulse' : 'bg-muted-foreground/40'].join(' ')} />
                )}
              </div>
              <span className={`text-sm ${isDone || isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
