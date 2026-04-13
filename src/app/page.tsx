'use client'

import { useState, useRef } from 'react'
import UploadScreen from '@/components/UploadScreen'
import AnalyzingScreen from '@/components/AnalyzingScreen'
import ResultScreen from '@/components/ResultScreen'

// ─── 공유 타입 정의 ───────────────────────────────────────────────────────────

export interface CriterionResult {
  score: number
  notes: string
}

export interface MissingItem {
  screen: string
  issue: string
  suggestion: string
}

export interface DevItem {
  module: string
  issue: string
  suggestion: string
}

export interface AnalysisResult {
  sufficiency_score: number
  is_sufficient: boolean
  validated: string[]
  criteria: {
    화면_인벤토리: CriterionResult
    데이터_상태: CriterionResult
    엣지케이스: CriterionResult
    인터랙션_로직: CriterionResult
    CTA_계층: CriterionResult
  }
  missing_for_designers: MissingItem[]
  missing_for_developers: DevItem[]
  critical_questions: string[]
  ux_recommendations: string[]
}

export type MockupType = 'lowfi' | 'hifi'

// ─── 앱 전역 상태 ──────────────────────────────────────────────────────────────

type AppScreen = 'upload' | 'analyzing' | 'result'

interface AppState {
  screen: AppScreen
  fileName: string
  prdText: string
  analysis: AnalysisResult | null
  mockupCodeLowFi: string | null
  mockupCodeHiFi: string | null
  error: string | null
  mockupGenerating: MockupType | null  // 생성 중인 타입, null이면 미생성 중
}

// ─── 메인 페이지 (스크린 상태 머신) ────────────────────────────────────────────

export default function Home() {
  const abortRef = useRef<AbortController | null>(null)

  const [state, setState] = useState<AppState>({
    screen: 'upload',
    fileName: '',
    prdText: '',
    analysis: null,
    mockupCodeLowFi: null,
    mockupCodeHiFi: null,
    error: null,
    mockupGenerating: null,
  })

  // PRD 파일 업로드 후 Claude 분석 스트리밍 시작
  async function handleAnalyze(prdText: string, fileName: string) {
    setState(prev => ({
      ...prev,
      screen: 'analyzing',
      fileName,
      prdText,
      error: null,
      mockupCodeLowFi: null,
      mockupCodeHiFi: null,
    }))

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prdText }),
      })

      if (!res.ok || !res.body) throw new Error('분석 요청 실패')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let rawText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        rawText += decoder.decode(value, { stream: true })
      }

      const analysis = parseAnalysis(rawText)
      setState(prev => ({ ...prev, screen: 'result', analysis }))
    } catch (e) {
      setState(prev => ({ ...prev, screen: 'upload', error: (e as Error).message }))
    }
  }

  // 타입별 목업 생성 또는 캐시 오픈 (regenerate=true면 캐시 무시)
  async function handleGenerateMockup(type: MockupType, regenerate = false) {
    if (!state.analysis) return

    const cached = type === 'lowfi' ? state.mockupCodeLowFi : state.mockupCodeHiFi
    if (cached && !regenerate) {
      openMockupTab(cached, state.analysis, type)
      return
    }

    setState(prev => ({ ...prev, mockupGenerating: type }))
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prdText: state.prdText,
          analysisText: JSON.stringify(state.analysis),
          type,
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error('목업 생성 실패')

      const data = await res.json() as { code: string }
      setState(prev => ({
        ...prev,
        mockupGenerating: null,
        mockupCodeLowFi: type === 'lowfi' ? data.code : prev.mockupCodeLowFi,
        mockupCodeHiFi: type === 'hifi' ? data.code : prev.mockupCodeHiFi,
      }))
      openMockupTab(data.code, state.analysis, type)
    } catch (e) {
      // 취소한 경우 에러 표시 없이 조용히 종료
      if ((e as Error).name === 'AbortError') {
        setState(prev => ({ ...prev, mockupGenerating: null }))
      } else {
        setState(prev => ({ ...prev, mockupGenerating: null, error: (e as Error).message }))
      }
    } finally {
      abortRef.current = null
    }
  }

  // 목업 생성 취소
  function handleCancelMockup() {
    abortRef.current?.abort()
  }

  // sessionStorage에 목업 데이터 저장 후 새 탭 오픈
  function openMockupTab(code: string, analysis: AnalysisResult, type: MockupType) {
    sessionStorage.setItem('preflight_mockup', JSON.stringify({ code, analysis, type }))
    window.open('/mockup', '_blank')
  }

  return (
    <>
      {state.screen === 'upload' && (
        <UploadScreen onAnalyze={handleAnalyze} error={state.error} />
      )}

      {state.screen === 'analyzing' && <AnalyzingScreen />}

      {state.screen === 'result' && state.analysis && (
        <ResultScreen
          fileName={state.fileName}
          result={state.analysis}
          mockupCodeLowFi={state.mockupCodeLowFi}
          mockupCodeHiFi={state.mockupCodeHiFi}
          onGenerateMockup={handleGenerateMockup}
          onCancelMockup={handleCancelMockup}
          mockupGenerating={state.mockupGenerating}
          onReupload={() => setState(prev => ({ ...prev, screen: 'upload', error: null }))}
        />
      )}
    </>
  )
}

// ─── 스트리밍된 텍스트에서 JSON 파싱 ──────────────────────────────────────────

function parseAnalysis(raw: string): AnalysisResult {
  const cleaned = raw
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim()

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error('응답에서 JSON을 찾지 못했습니다')
  }

  return JSON.parse(cleaned.slice(start, end + 1)) as AnalysisResult
}
