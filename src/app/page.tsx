'use client'

import { useState, useRef } from 'react'
import UploadScreen from '@/components/UploadScreen'
import AnalyzingScreen from '@/components/AnalyzingScreen'
import ResultScreen from '@/components/ResultScreen'

// ─── 공유 타입 정의 (v1/v2 호환) ──────────────────────────────────────────────
//
// v1 (Preflight Protocol v1.2):
//   - criteria.X.notes: string
//   - critical_questions: string[]
//   - ux_recommendations: string[]
//   - missing_for_*.items: {screen, issue, suggestion} only
//
// v2 (Preflight Protocol v2.0):
//   - criteria.X.notes: object {evidence, missing, applied_principle}
//   - criteria에 추가 차원 (구조_플로우, 상태_피드백, 에러_예방_복구, 인터랙션_관례, 정보_위계, 행동_설계)
//   - critical_questions: object[] {tag, question, format, options, impact, blocks}
//   - ux_recommendations: object[] {recommendation, principle, perspective, effort, expected_impact}
//   - missing_for_designers: +principle, +severity, +user_impact
//   - missing_for_developers: +risk, +severity
//   - 신규 필드: project_type, applied_weights, severity_summary, mockup_directives
// ─────────────────────────────────────────────────────────────────────────────

// v1 notes: string / v2 notes: object — 유니언으로 양쪽 지원
export type CriterionNotes =
  | string
  | {
      evidence?: string
      missing?: string[]
      applied_principle?: string
    }

export interface CriterionResult {
  // v2에서 행동_설계가 조건부(Fogg 가중치=0이면 null)
  score: number | null
  notes?: CriterionNotes
  // v2 전용 필드를 top-level로 올린 경우도 허용 (LLM 응답 유연성 고려)
  evidence?: string
  missing?: string[]
  applied_principle?: string
}

// v1: {screen, issue, suggestion}
// v2: +principle, +severity, +user_impact
export interface MissingItem {
  screen: string
  issue: string
  suggestion: string
  principle?: string
  severity?: 1 | 2 | 3 | 4
  user_impact?: string
}

// v1: {module, issue, suggestion}
// v2: +risk, +severity
export interface DevItem {
  module: string
  issue: string
  suggestion: string
  risk?: string
  severity?: 1 | 2 | 3 | 4
}

// v2 critical_question 객체 타입
export interface CriticalQuestionV2 {
  tag: string
  question: string
  format?: 'binary' | 'multiple' | 'open'
  options?: string[]
  impact?: string
  blocks?: string[]
}

// v2 ux_recommendation 객체 타입
export interface UxRecommendationV2 {
  recommendation: string
  principle?: string
  perspective?: 'CRO' | 'Friction Reduction' | 'Convention' | 'Accessibility' | string
  effort?: 'low' | 'medium' | 'high' | string
  expected_impact?: string
}

// v2 전용 신규 필드들
export interface MockupDirectives {
  attention_areas?: Array<{
    dimension: string
    score: number
    focus: string
    render_hint?: string
  }>
  forced_states?: Array<'empty' | 'loading' | 'error' | 'success' | string>
  critical_screens?: string[]
  note_panel_priority?: string[]
}

export interface SeveritySummary {
  catastrophic: number
  major: number
  minor: number
  cosmetic: number
}

export interface AnalysisResult {
  sufficiency_score: number
  is_sufficient: boolean
  validated: string[]
  // criteria는 v1 5개 키 또는 v2 6개 키가 옴 — Record로 완화
  criteria: Record<string, CriterionResult>
  missing_for_designers: MissingItem[]
  missing_for_developers: DevItem[]
  // v1은 string[], v2는 객체[]
  critical_questions: Array<string | CriticalQuestionV2>
  // v1은 string[], v2는 객체[]
  ux_recommendations: Array<string | UxRecommendationV2>
  // v2 신규 필드 (optional)
  project_type?: 'transaction' | 'management' | 'discovery' | 'onboarding' | string
  applied_weights?: Record<string, number>
  severity_summary?: SeveritySummary
  mockup_directives?: MockupDirectives
}

export type MockupType = 'lowfi' | 'hifi'

// ─── 앱 전역 상태 ──────────────────────────────────────────────────────────────

type AppScreen = 'upload' | 'analyzing' | 'result'

interface AppState {
  screen: AppScreen
  fileName: string
  prdText: string
  analysis: AnalysisResult | null
  mockupFilesLowFi: Record<string, string> | null
  mockupFilesHiFi: Record<string, string> | null
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
    mockupFilesLowFi: null,
    mockupFilesHiFi: null,
    error: null,
    mockupGenerating: null,
    analysis: null,
  })

  // PRD 파일 업로드 후 Claude 분석 스트리밍 시작
  async function handleAnalyze(prdText: string, fileName: string) {
    setState(prev => ({
      ...prev,
      screen: 'analyzing',
      fileName,
      prdText,
      error: null,
      mockupFilesLowFi: null,
      mockupFilesHiFi: null,
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
      console.error('[분석 오류] 에러:', e)
      const errorMsg = '분석 중 오류가 발생했습니다'
      setState(prev => ({ ...prev, screen: 'upload', error: errorMsg }))
    }
  }

  // 타입별 목업 생성 또는 캐시 오픈 (regenerate=true면 캐시 무시)
  async function handleGenerateMockup(type: MockupType, regenerate = false) {
    if (!state.analysis) return

    const cached = type === 'lowfi' ? state.mockupFilesLowFi : state.mockupFilesHiFi
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
          // analysisText에 전체 analysis JSON을 전달 (mockup_directives 포함)
          analysisText: JSON.stringify(state.analysis),
          type,
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error('목업 생성 실패')

      const data = await res.json() as { files: Record<string, string> }
      setState(prev => ({
        ...prev,
        mockupGenerating: null,
        mockupFilesLowFi: type === 'lowfi' ? data.files : prev.mockupFilesLowFi,
        mockupFilesHiFi: type === 'hifi' ? data.files : prev.mockupFilesHiFi,
      }))
      openMockupTab(data.files, state.analysis, type)
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
  function openMockupTab(files: Record<string, string>, analysis: AnalysisResult, type: MockupType) {
    sessionStorage.setItem('preflight_mockup', JSON.stringify({ files, analysis, type }))
    const newWindow = window.open('/mockup', '_blank')
    if (!newWindow) {
      setState(prev => ({
        ...prev,
        error: '팝업이 차단되었습니다. 브라우저 팝업 차단을 해제해주세요.',
      }))
    }
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
          hasMockupLowFi={!!state.mockupFilesLowFi}
          hasMockupHiFi={!!state.mockupFilesHiFi}
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

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as AnalysisResult

  // v1/v2 호환을 위한 최소 방어 로직 — 필수 필드 누락 시 빈 기본값 주입
  // (렌더링 중 map/length 호출이 깨지지 않도록)
  return {
    ...parsed,
    validated: parsed.validated ?? [],
    criteria: parsed.criteria ?? {},
    missing_for_designers: parsed.missing_for_designers ?? [],
    missing_for_developers: parsed.missing_for_developers ?? [],
    critical_questions: parsed.critical_questions ?? [],
    ux_recommendations: parsed.ux_recommendations ?? [],
  }
}
