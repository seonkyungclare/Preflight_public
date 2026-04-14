'use client'

interface ScoreGaugeProps {
  score: number // 0-100
}

// 점수에 따른 색상 및 라벨 반환
function getScoreMeta(score: number): { color: string; label: string } {
  if (score >= 80) return { color: '#22c55e', label: '준비 완료!' }
  if (score >= 60) return { color: '#f59e0b', label: '조금 더 보완해 주세요' }
  return { color: '#ef4444', label: '많이 보완해주세요' }
}

export default function ScoreGauge({ score }: ScoreGaugeProps) {
  const { color, label } = getScoreMeta(score)
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          {/* 배경 원 */}
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke="#1e293b"
            strokeWidth="10"
          />
          {/* 진행 원 */}
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        {/* 중앙 점수 텍스트 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-ink-primary">{score}</span>
          <span className="text-xs text-ink-secondary">/ 100</span>
        </div>
      </div>
      <span
        className="mt-3 text-sm font-semibold px-3 py-1 rounded-full"
        style={{ backgroundColor: color + '22', color }}
      >
        {label}
      </span>
    </div>
  )
}
