'use client'

import { useEffect, useState } from 'react'
import MockupScreen from '@/components/MockupScreen'
import type { AnalysisResult, MockupType } from '@/app/page'

interface MockupData {
  files: Record<string, string>
  analysis: AnalysisResult
  type: MockupType
}

export default function MockupPage() {
  const [data, setData] = useState<MockupData | null>(null)
  const [error, setError] = useState(false)

  // sessionStorage에서 목업 데이터 로드
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('preflight_mockup')
      if (!raw) { setError(true); return }
      setData(JSON.parse(raw) as MockupData)
    } catch {
      setError(true)
    }
  }, [])

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center text-slate-400 text-sm">
        목업 데이터를 불러올 수 없습니다. 결과 화면에서 다시 시도해주세요.
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center text-slate-400 text-sm">
        불러오는 중…
      </div>
    )
  }

  return (
    <MockupScreen
      files={data.files}
      analysis={data.analysis}
      type={data.type ?? 'lowfi'}
      onBack={() => window.close()}
    />
  )
}
