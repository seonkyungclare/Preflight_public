'use client'

import { useState, useRef } from 'react'
import UploadScreen from '@/components/UploadScreen'
import AnalyzingScreen from '@/components/AnalyzingScreen'
import ResultScreen from '@/components/ResultScreen'
import { saveEntry, generateId, type HistoryEntry } from '@/lib/analysis-history'
import type { PrdTemplateId } from '@/config/prd-template'
import type {
  AnalysisSummary,
  SectionCoverage,
  HardGateResult,
  ActorsSummary,
  ScenariosSummary,
  CrossReferenceIssue,
} from '@/lib/scoring'

export type { PrdTemplateId }

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
  // v3: 어느 템플릿 항목 때문에 올라온 누락인지 ("§8.3 데이터")
  section_ref?: string
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
  section_ref?: string
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
  related_screen?: string
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
  // ── 템플릿 식별 (2026-09 이후 결과에만 존재) ──
  template?: PrdTemplateId
  protocol_version?: '2.0' | '3.0' | string
  // ── v3 (Partner Growth) 전용 — 서버(lib/scoring.ts)가 확정해서 내려준다 ──
  template_ref?: string
  raw_score?: number
  summary?: AnalysisSummary
  hard_gates?: HardGateResult[]
  section_coverage?: SectionCoverage[]
  actors?: ActorsSummary
  scenarios?: ScenariosSummary
  cross_reference_issues?: CrossReferenceIssue[]
}
// v2/v3 판별은 lib/scoring.ts 의 isV3Result 를 쓴다 (App Router 페이지 파일은 임의 export 불가)

export type MockupType = 'lowfi' | 'hifi'

// ─── 앱 전역 상태 ──────────────────────────────────────────────────────────────

type AppScreen = 'upload' | 'analyzing' | 'result'

interface AppState {
  screen: AppScreen
  fileName: string
  prdText: string
  template: PrdTemplateId | null  // 분석 전 사용자가 고른 팀 템플릿
  analysis: AnalysisResult | null
  mockupFilesLowFi: Record<string, string> | null
  mockupFilesHiFi: Record<string, string> | null
  mockupLowFiAt: number | null
  mockupHiFiAt: number | null
  error: string | null
  mockupGenerating: MockupType | null  // 생성 중인 타입, null이면 미생성 중
  mockupProgress: number | null  // 생성 진행률 0-100, null이면 아직 진행률 미수신
  mockupMessage: string | null   // 진행 메시지("화면 생성 중 (2/5) · 46초 경과")
  mockupDetail: boolean          // Hi-Fi 상세 모드(실제 데이터 느낌·풍부한 인터랙션). 기본은 구조 모드
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
    template: null,
    mockupFilesLowFi: null,
    mockupFilesHiFi: null,
    mockupLowFiAt: null,
    mockupHiFiAt: null,
    error: null,
    mockupGenerating: null,
    mockupProgress: null,
    mockupMessage: null,
    mockupDetail: false,
    mockupSpec: null,
    analysis: null,
    historyId: null,
    historyCreatedAt: null,
  })

  // PRD 파일 업로드 후 Claude 분석 스트리밍 시작
  async function handleAnalyze(prdText: string, fileName: string, template: PrdTemplateId) {
    setState(prev => ({
      ...prev,
      screen: 'analyzing',
      fileName,
      prdText,
      template,
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
        body: JSON.stringify({ prdText, template }),
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
        template,
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
  // 브라우저가 3단계를 지휘한다: spec(함수 1개) → 화면별 screen(화면마다 함수 1개, 동시) → assemble.
  // 한 함수에 몰면 Vercel 300초를 넘겨 결과를 통째로 잃으므로 화면 단위로 나눈다.
  async function handleGenerateMockup(type: MockupType, regenerate = false) {
    if (!state.analysis) return

    const cached = type === 'lowfi' ? state.mockupFilesLowFi : state.mockupFilesHiFi
    if (cached && !regenerate) {
      openMockupTab(cached, state.analysis, type)
      return
    }

    setState(prev => ({ ...prev, mockupGenerating: type, mockupProgress: 0, mockupMessage: '요청 준비 중' }))
    const controller = new AbortController()
    abortRef.current = controller
    const setProgress = (progress: number, message: string) =>
      setState(prev => ({ ...prev, mockupProgress: progress, mockupMessage: message }))

    const post = async <T,>(url: string, body: unknown): Promise<T> => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      const text = await res.text()
      let parsed: unknown = null
      try { parsed = text ? JSON.parse(text) : null } catch { /* 비 JSON 응답 */ }
      if (!res.ok) {
        const msg = (parsed as { error?: string } | null)?.error ?? text ?? '요청 실패'
        throw new Error(msg || '요청 실패')
      }
      return parsed as T
    }

    let heartbeat: ReturnType<typeof setInterval> | null = null
    try {
      // 1) 화면 구조: 앞서 확정된 spec 이 있으면 재사용(Lo-Fi/Hi-Fi 동일 화면 집합)
      let spec = state.mockupSpec as { screens: Array<{ id: string; name: string }> } | null
      if (!spec || !Array.isArray(spec.screens) || spec.screens.length === 0) {
        // 구조 추출은 30~70초 걸리고 중간 이벤트가 없다. 경과 시간을 흘려 멈춘 것처럼 보이지 않게 한다.
        const s0 = Date.now()
        const specTick = () => setProgress(10, `PRD 화면 구조 분석 중 · ${Math.round((Date.now() - s0) / 1000)}초 경과`)
        specTick()
        heartbeat = setInterval(specTick, 5000)
        try {
          const r = await post<{ spec: { screens: Array<{ id: string; name: string }> } }>('/api/mockup/spec', {
            prdText: state.prdText,
            analysisText: JSON.stringify(state.analysis),
          })
          spec = r.spec
        } finally {
          clearInterval(heartbeat)
          heartbeat = null
        }
      }
      const screens = spec.screens
      const total = screens.length
      setProgress(20, `화면 구조 분석 완료 (${total}개 화면)`)

      // 2) 화면별 생성: 동시에 요청. 각 요청은 자기 몫의 함수(300초)를 쓴다
      const t0 = Date.now()
      let completed = 0
      const codes: Record<string, string> = {}
      const dropped: Array<{ id: string; name: string; reason: string }> = []
      const elapsed = () => Math.round((Date.now() - t0) / 1000)
      const tick = () => setProgress(20 + Math.round((completed / total) * 65), `화면 생성 중 (${completed}/${total}) · ${elapsed()}초 경과`)
      heartbeat = setInterval(tick, 5000)
      tick()

      await Promise.all(
        screens.map(async screen => {
          try {
            const r = await post<{ id: string; code: string | null; reason: string | null }>('/api/mockup/screen', {
              screen,
              allScreens: screens,
              type,
              mode: type === 'hifi' && state.mockupDetail ? 'detail' : 'structure',
            })
            if (r.code) codes[screen.id] = r.code
            else dropped.push({ id: screen.id, name: screen.name, reason: r.reason ?? 'failed' })
          } catch (e) {
            if (controller.signal.aborted) throw e
            dropped.push({ id: screen.id, name: screen.name, reason: 'failed' })
          } finally {
            completed++
            tick()
          }
        }),
      )
      clearInterval(heartbeat)
      heartbeat = null

      if (Object.keys(codes).length === 0) {
        throw new Error('화면 생성에 모두 실패했습니다. 다시 시도해주세요.')
      }

      // 3) 조립
      setProgress(90, dropped.length > 0 ? `화면 조립 중 (${dropped.length}개 제외)` : '화면 조립 중')
      const assembled = await post<{ files: Record<string, string>; spec: unknown }>('/api/mockup/assemble', {
        spec,
        codes,
        type,
        dropped,
      })
      setProgress(100, '완료')

      const files = assembled.files
      const receivedSpec = assembled.spec ?? spec
      const now = Date.now()
      const nextLowFi = type === 'lowfi' ? files : state.mockupFilesLowFi
      const nextHiFi = type === 'hifi' ? files : state.mockupFilesHiFi
      const nextLowFiAt = type === 'lowfi' ? now : state.mockupLowFiAt
      const nextHiFiAt = type === 'hifi' ? now : state.mockupHiFiAt
      setState(prev => ({
        ...prev,
        mockupGenerating: null,
        mockupProgress: null,
        mockupMessage: null,
        mockupSpec: receivedSpec ?? prev.mockupSpec,
        mockupFilesLowFi: nextLowFi,
        mockupFilesHiFi: nextHiFi,
        mockupLowFiAt: nextLowFiAt,
        mockupHiFiAt: nextHiFiAt,
      }))
      openMockupTab(files, state.analysis, type)

      if (state.historyId) {
        saveEntry({
          id: state.historyId,
          createdAt: state.historyCreatedAt ?? now,
          fileName: state.fileName,
          prdText: state.prdText,
          template: state.template ?? undefined,
          analysis: state.analysis,
          mockupFilesLowFi: nextLowFi,
          mockupFilesHiFi: nextHiFi,
          mockupLowFiAt: nextLowFiAt,
          mockupHiFiAt: nextHiFiAt,
        }).catch(err => console.error('[history] 목업 저장 실패:', err))
      }
    } catch (e) {
      if (heartbeat) clearInterval(heartbeat)
      // 취소한 경우 에러 표시 없이 조용히 종료
      if ((e as Error).name === 'AbortError') {
        setState(prev => ({ ...prev, mockupGenerating: null, mockupProgress: null, mockupMessage: null }))
      } else {
        setState(prev => ({ ...prev, mockupGenerating: null, mockupProgress: null, mockupMessage: null, error: (e as Error).message }))
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
    const restored = entry.analysis as AnalysisResult
    setState({
      screen: 'result',
      fileName: entry.fileName,
      prdText: entry.prdText,
      // v3 도입 전 항목은 template 이 없다 → 결과 안의 값, 없으면 other(기존 v2 규칙)
      template: entry.template ?? restored.template ?? 'other',
      analysis: restored,
      mockupFilesLowFi: entry.mockupFilesLowFi,
      mockupFilesHiFi: entry.mockupFilesHiFi,
      mockupLowFiAt: entry.mockupLowFiAt,
      mockupHiFiAt: entry.mockupHiFiAt,
      error: null,
      mockupGenerating: null,
      mockupProgress: null,
      mockupMessage: null,
      mockupDetail: false,
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
          template={state.template ?? state.analysis.template ?? 'other'}
          result={state.analysis}
          hasMockupLowFi={!!state.mockupFilesLowFi}
          hasMockupHiFi={!!state.mockupFilesHiFi}
          mockupLowFiAt={state.mockupLowFiAt}
          mockupHiFiAt={state.mockupHiFiAt}
          onGenerateMockup={handleGenerateMockup}
          onCancelMockup={handleCancelMockup}
          mockupGenerating={state.mockupGenerating}
          mockupProgress={state.mockupProgress}
          mockupMessage={state.mockupMessage}
          mockupDetail={state.mockupDetail}
          onToggleMockupDetail={(v) => setState(prev => ({ ...prev, mockupDetail: v }))}
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
