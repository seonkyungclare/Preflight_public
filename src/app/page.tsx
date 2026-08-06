'use client'

import { useState, useRef } from 'react'
import UploadScreen from '@/components/UploadScreen'
import AnalyzingScreen from '@/components/AnalyzingScreen'
import ResultScreen from '@/components/ResultScreen'
import { saveEntry, generateId, findSameContent, type HistoryEntry } from '@/lib/analysis-history'
import type { AnalyzeEnvelope } from '@/lib/analysis'

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
  // v3: 이 항목을 누가 채워야 하는가 — 'PM' | '담당자결정'
  owner?: string
}

// v1: {module, issue, suggestion}
// v2: +risk, +severity
export interface DevItem {
  module: string
  issue: string
  suggestion: string
  risk?: string
  severity?: 1 | 2 | 3 | 4
  // v3: 화면 쪽(FE) / 서버 쪽(BE) 구분, 그리고 누가 채울 것인가
  area?: string
  owner?: string
}

// v2 critical_question 객체 타입
export interface CriticalQuestionV2 {
  tag: string
  question: string
  // v4: 누가 답해야 하는가 — 'PM' | '담당자결정'. 화면의 "남은 결정 N건"은 PM 몫만 센다
  owner?: string
  // v4: 이 결정이 걸린 채점 항목 이름
  dimension?: string
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
  // 실제로 채점한 모델(요청값이 아니라 API 응답값)과 채점 시각.
  // 모델이 바뀌면 점수도 바뀌므로 결과에 붙여둔다 — 없으면 나중에
  // "이 숫자를 무엇으로 쟀는지" 확인할 방법이 사라진다. (변경 기록 21번)
  model?: string | null
  analyzed_at?: string
  sufficiency_score: number
  is_sufficient: boolean
  // v3: 서버가 계산한다. 판정은 base_score(0~90)로만 하고 가점은 표시용.
  base_score?: number
  bonus_score?: number
  bonus_signals?: Record<string, boolean>
  // 개발 착수 전 확인 — 점수에 반영하지 않고 표시만 한다
  dev_readiness?: Record<string, { status: '있음' | '부분' | '없음'; note?: string }>
  advisories?: string[]
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
  historyId: string | null  // 현재 분석 세션의 history 엔트리 ID
  historyCreatedAt: number | null
  requirementsUrl: string  // 사용자 요구사항 Confluence URL (선택)
  warnings: string[]  // 서버가 응답을 보정한 내역 (결과 화면에 표시)
  // 내용이 같아 이전 분석 결과를 그대로 쓴 경우, 그 분석 시각.
  // 사용자가 "왜 다시 안 돌았지"를 알 수 있어야 한다.
  reusedFrom: number | null
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
    analysis: null,
    historyId: null,
    historyCreatedAt: null,
    requirementsUrl: '',
    warnings: [],
    reusedFrom: null,
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
    }))

    // 내용이 완전히 같은 기록이 있으면 새로 채점하지 않는다.
    // AI는 같은 글에도 매번 조금씩 다른 점수를 내므로, 안 고치고 다시 올렸는데
    // 점수가 달라지는 상황을 원천적으로 막는다. (변경 기록 24번)
    const same = await findSameContent(prdText)
    if (same) {
      setState(prev => ({
        ...prev,
        screen: 'result',
        analysis: same.analysis as AnalysisResult,
        historyId: same.id,
        historyCreatedAt: same.createdAt,
        mockupFilesLowFi: same.mockupFilesLowFi,
        mockupFilesHiFi: same.mockupFilesHiFi,
        mockupLowFiAt: same.mockupLowFiAt,
        mockupHiFiAt: same.mockupHiFiAt,
        warnings: [],
        reusedFrom: same.createdAt,
      }))
      return
    }

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prdText }),
      })

      // 서버가 봉투로 응답한다: { ok, analysis, raw, warnings }
      // 검증·총점 재계산이 서버에서 끝나므로 클라이언트는 분기만 한다.
      const envelope = await res.json() as AnalyzeEnvelope

      if (!envelope.ok || !envelope.analysis) {
        // 분석을 통째로 버리지 않는다 — 원문이라도 보여준다
        setState(prev => ({
          ...prev,
          screen: 'upload',
          error: envelope.error ?? '분석 결과를 읽지 못했습니다',
        }))
        return
      }

      const analysis = envelope.analysis as unknown as AnalysisResult
      if (envelope.warnings.length > 0) {
        console.warn('[analyze] 응답 보정:', envelope.warnings)
      }
      const historyId = generateId()
      const historyCreatedAt = Date.now()
      setState(prev => ({
        ...prev, screen: 'result', analysis, historyId, historyCreatedAt,
        warnings: envelope.warnings,
        reusedFrom: null,
      }))

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
      // 사용자 요구사항 URL이 있으면 Confluence에서 가져와서 prdText에 합치기
      let combinedPrdText = state.prdText
      if (state.requirementsUrl.trim()) {
        try {
          const reqRes = await fetch('/api/fetch-confluence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: state.requirementsUrl.trim() }),
          })
          if (reqRes.ok) {
            const reqData = await reqRes.json() as { title?: string; text?: string }
            if (reqData.text) {
              combinedPrdText = `${state.prdText}\n\n=== 사용자 요구사항: ${reqData.title ?? ''} ===\n${reqData.text}`
            }
          }
        } catch {
          // 요구사항 fetch 실패해도 PRD만으로 목업 생성 계속
        }
      }

      const res = await fetch('/api/mockup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prdText: combinedPrdText,
          // analysisText에 전체 analysis JSON을 전달 (mockup_directives 포함)
          analysisText: JSON.stringify(state.analysis),
          type,
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error('목업 생성 실패')

      const data = await res.json() as { files: Record<string, string> }
      console.log('[mockup] 생성 완료, 새 탭 오픈 시도', { type, fileKeys: Object.keys(data.files) })
      const now = Date.now()
      const nextLowFi = type === 'lowfi' ? data.files : state.mockupFilesLowFi
      const nextHiFi = type === 'hifi' ? data.files : state.mockupFilesHiFi
      const nextLowFiAt = type === 'lowfi' ? now : state.mockupLowFiAt
      const nextHiFiAt = type === 'hifi' ? now : state.mockupHiFiAt
      setState(prev => ({
        ...prev,
        mockupGenerating: null,
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
      historyId: entry.id,
      historyCreatedAt: entry.createdAt,
      requirementsUrl: '',
      warnings: [],  // 저장된 분석에는 보정 내역을 남기지 않는다
      // 이전 분석 목록에서 직접 연 것이라 "내용이 같아 재사용" 안내는 띄우지 않는다
      reusedFrom: null,
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
          onReupload={() => setState(prev => ({ ...prev, screen: 'upload', error: null }))}
          requirementsUrl={state.requirementsUrl}
          onRequirementsUrlChange={url => setState(prev => ({ ...prev, requirementsUrl: url }))}
          reusedFrom={state.reusedFrom}
          analyzedAt={state.historyCreatedAt}
        />
      )}

    </>
  )
}
