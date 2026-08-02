'use client'

import { MAX_POINTS, verdictOf } from '@/lib/rubric'

interface ScoreGaugeProps {
  score: number // 표시 총점 (기본 + 가점)
  baseScore?: number // 기본 점수 — 판정은 이 값으로 한다. 구 기록에는 없어 선택값
}

export default function ScoreGauge({ score, baseScore }: ScoreGaugeProps) {
  // 판정 라벨·색은 rubric이 원본. 가점은 표시용이라 판정에 넣지 않는다.
  const { color, label } = verdictOf(baseScore ?? score)
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (Math.min(score, MAX_POINTS) / MAX_POINTS) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          {/* 배경 원 */}
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke="#1e293b"
            strokeWidth="6"
          />
          {/* 진행 원 */}
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        {/* 중앙 점수 텍스트 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white leading-none">{score}</span>
          <span className="text-[10px] text-slate-400 mt-0.5">/ {MAX_POINTS}</span>
        </div>
      </div>
      <span
        className="mt-2 text-xs font-semibold px-2.5 py-0.5 rounded-full text-center"
        style={{ backgroundColor: color + '22', color }}
      >
        {label}
      </span>
    </div>
  )
}
