'use client'

import { useState, useRef } from 'react'
import UploadScreen from '@/components/UploadScreen'
import AnalyzingScreen from '@/components/AnalyzingScreen'
import ResultScreen from '@/components/ResultScreen'
import { saveEntry, generateId, type HistoryEntry } from '@/lib/analysis-history'

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
  mockupLowFiAt: number | null
  mockupHiFiAt: number | null
  error: string | null
  mockupGenerating: MockupType | null  // 생성 중인 타입, null이면 미생성 중
  mockupProgress: number | null  // 생성 진행률 0-100, null이면 아직 진행률 미수신
  mockupSpec: unknown  // 앞선 생성에서 확정된 화면 구조(spec). Lo-Fi/Hi-Fi가 공유해 동일 화면 집합 보장
  historyId: string | null  // 현재 분석 세션의 history 엔트리 ID
  historyCreatedAt: number | null
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
    mockupLowFiAt: null,
    mockupHiFiAt: null,
    error: null,
    mockupGenerating: null,
    mockupProgress: null,
    mockupSpec: null,
    analysis: null,
    historyId: null,
    historyCreatedAt: null,
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
      mockupLowFiAt: null,
      mockupHiFiAt: null,
      mockupSpec: null,
    }))

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prdText }),
      })

      if (!res.ok) {
        const serverMsg = await res.text().catch(() => '')
        throw new Error(serverMsg || '분석 요청 실패')
      }
      if (!res.body) throw new Error('분석 요청 실패')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let rawText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        rawText += decoder.decode(value, { stream: true })
      }

      const analysis = parseAnalysis(rawText)
      const historyId = generateId()
      const historyCreatedAt = Date.now()
      setState(prev => ({ ...prev, screen: 'result', analysis, historyId, historyCreatedAt }))

      saveEntry({
        id: historyId,
        createdAt: historyCreatedAt,
        fileName,
        prdText,
        analysis,
        mockupFilesLowFi: null,
        mockupFilesHiFi: null,
        mockupLowFiAt: null,
        mockupHiFiAt: null,
      }).catch(err => console.error('[history] 저장 실패:', err))
    } catch (e) {
      console.error('[분석 오류] 에러:', e)
      const errorMsg = (e as Error)?.message || '분석 중 오류가 발생했습니다'
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

    setState(prev => ({ ...prev, mockupGenerating: type, mockupProgress: 0 }))
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
          // 앞서 확정된 spec이 있으면 재사용 → Lo-Fi/Hi-Fi가 동일 화면 집합 공유(요건 ④)
          existingSpec: state.mockupSpec ?? undefined,
        }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) throw new Error('목업 생성 실패')

      // NDJSON 스트림 파싱: {type:'progress'|'done'|'error'} 이벤트를 줄 단위로 수신
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let files: Record<string, string> | null = null
      let receivedSpec: unknown = null
      let streamError: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? '' // 마지막 조각은 미완성일 수 있어 버퍼에 보관
        for (const line of lines) {
          if (!line.trim()) continue
          const evt = JSON.parse(line) as
            | { type: 'progress'; progress: number; message?: string }
            | { type: 'done'; files: Record<string, string>; spec?: unknown }
            | { type: 'error'; error: string }
          if (evt.type === 'progress') {
            setState(prev => ({ ...prev, mockupProgress: evt.progress }))
          } else if (evt.type === 'done') {
            files = evt.files
            receivedSpec = evt.spec ?? null
          } else if (evt.type === 'error') {
            streamError = evt.error
          }
        }
      }

      if (streamError) throw new Error(streamError)
      if (!files) throw new Error('목업 생성 실패')

      const data = { files }
      console.log('[mockup] 생성 완료, 새 탭 오픈 시도', { type, fileKeys: Object.keys(data.files) })
      const now = Date.now()
      const nextLowFi = type === 'lowfi' ? data.files : state.mockupFilesLowFi
      const nextHiFi = type === 'hifi' ? data.files : state.mockupFilesHiFi
      const nextLowFiAt = type === 'lowfi' ? now : state.mockupLowFiAt
      const nextHiFiAt = type === 'hifi' ? now : state.mockupHiFiAt
      setState(prev => ({
        ...prev,
        mockupGenerating: null,
        mockupProgress: null,
        // 확정된 spec 보관(없으면 기존 유지) → 다음 fidelity 생성 시 동일 화면 집합 재사용
        mockupSpec: receivedSpec ?? prev.mockupSpec,
        mockupFilesLowFi: nextLowFi,
        mockupFilesHiFi: nextHiFi,
        mockupLowFiAt: nextLowFiAt,
        mockupHiFiAt: nextHiFiAt,
      }))
      openMockupTab(data.files, state.analysis, type)

      if (state.historyId) {
        saveEntry({
          id: state.historyId,
          createdAt: state.historyCreatedAt ?? now,
          fileName: state.fileName,
          prdText: state.prdText,
          analysis: state.analysis,
          mockupFilesLowFi: nextLowFi,
          mockupFilesHiFi: nextHiFi,
          mockupLowFiAt: nextLowFiAt,
          mockupHiFiAt: nextHiFiAt,
        }).catch(err => console.error('[history] 목업 저장 실패:', err))
      }
    } catch (e) {
      // 취소한 경우 에러 표시 없이 조용히 종료
      if ((e as Error).name === 'AbortError') {
        setState(prev => ({ ...prev, mockupGenerating: null, mockupProgress: null }))
      } else {
        setState(prev => ({ ...prev, mockupGenerating: null, mockupProgress: null, error: (e as Error).message }))
      }
    } finally {
      abortRef.current = null
    }
  }

  // 목업 생성 취소
  function handleCancelMockup() {
    abortRef.current?.abort()
  }

  // history 엔트리로부터 결과 화면 복원
  function handleRestoreHistory(entry: HistoryEntry) {
    setState({
      screen: 'result',
      fileName: entry.fileName,
      prdText: entry.prdText,
      analysis: entry.analysis as AnalysisResult,
      mockupFilesLowFi: entry.mockupFilesLowFi,
      mockupFilesHiFi: entry.mockupFilesHiFi,
      mockupLowFiAt: entry.mockupLowFiAt,
      mockupHiFiAt: entry.mockupHiFiAt,
      error: null,
      mockupGenerating: null,
      mockupProgress: null,
      mockupSpec: null,
      historyId: entry.id,
      historyCreatedAt: entry.createdAt,
    })
  }

  // sessionStorage에 목업 데이터 저장 후 새 탭 오픈
  function openMockupTab(files: Record<string, string>, analysis: AnalysisResult, type: MockupType) {
    console.log('[openMockupTab] 호출됨', { type, hasFiles: !!files, hasAnalysis: !!analysis })
    sessionStorage.setItem('preflight_mockup', JSON.stringify({ files, analysis, type }))
    const newWindow = window.open('/mockup', '_blank')
    console.log('[openMockupTab] window.open 결과', { opened: !!newWindow })
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
        <UploadScreen
          onAnalyze={handleAnalyze}
          error={state.error}
          onRestoreHistory={handleRestoreHistory}
        />
      )}

      {state.screen === 'analyzing' && <AnalyzingScreen />}

      {state.screen === 'result' && state.analysis && (
        <ResultScreen
          fileName={state.fileName}
          result={state.analysis}
          hasMockupLowFi={!!state.mockupFilesLowFi}
          hasMockupHiFi={!!state.mockupFilesHiFi}
          mockupLowFiAt={state.mockupLowFiAt}
          mockupHiFiAt={state.mockupHiFiAt}
          onGenerateMockup={handleGenerateMockup}
          onCancelMockup={handleCancelMockup}
          mockupGenerating={state.mockupGenerating}
          mockupProgress={state.mockupProgress}
          onReupload={() => setState(prev => ({ ...prev, screen: 'upload', error: null, mockupSpec: null }))}
        />
      )}

    </>
  )
}

// ─── 스트리밍된 텍스트에서 JSON 파싱 ──────────────────────────────────────────

function parseAnalysis(raw: string): AnalysisResult {
  // /api/analyze는 tool use로 스키마 검증된 JSON을 그대로 내려주므로 파싱이 안전하다.
  // 혹시 코드펜스가 섞인 레거시/예외 응답이 오면 아래 fallback으로 복구한다.
  let parsed: AnalysisResult
  try {
    parsed = JSON.parse(raw) as AnalysisResult
  } catch {
    const cleaned = raw
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim()

    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1) {
      throw new Error('응답에서 JSON을 찾지 못했습니다')
    }
    parsed = JSON.parse(cleaned.slice(start, end + 1)) as AnalysisResult
  }

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
