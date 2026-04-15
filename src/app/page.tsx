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
    fileName: 'test-prd.pdf',
    prdText: '테스트 PRD',
    mockupCodeLowFi: null,
    mockupCodeHiFi: null,
    error: null,
    mockupGenerating: null,
    analysis: {
      sufficiency_score: 72,
      is_sufficient: false,
      validated: [
        '주요 화면(업로드, 분석, 결과) 플로우 정의됨',
        '핵심 CTA 버튼 명시됨',
        '사용자 피드백 문구 일부 포함',
      ],
      criteria: {
        화면_인벤토리: { score: 18, notes: '주요 화면은 정의되어 있으나 빈 상태·에러 화면 누락' },
        데이터_상태: { score: 16, notes: '로딩 상태 정의 미흡, 스켈레톤 UI 기준 없음' },
        엣지케이스: { score: 14, notes: '파일 업로드 실패·네트워크 오류 롤백 정책 미정의' },
        인터랙션_로직: { score: 16, notes: '버튼 목적지 대부분 명시, 일부 분기 로직 누락' },
        CTA_계층: { score: 8, notes: 'Primary CTA는 명확하나 Secondary 계층 정의 필요' },
      },
      missing_for_designers: [
        { screen: '빈 상태 화면', issue: '결과가 없을 때 표시할 Empty State UI 미정의', suggestion: '일러스트 + 안내 문구 컴포넌트 추가' },
        { screen: '에러 화면', issue: '분석 실패 시 UI 처리 방식 미명시', suggestion: '에러 메시지 + 재시도 버튼 패턴 정의' },
        { screen: '로딩 스켈레톤', issue: '결과 카드 로딩 중 Skeleton UI 부재', suggestion: '카드 형태의 Skeleton 컴포넌트 설계' },
      ],
      missing_for_developers: [
        { module: '파일 업로드 API', issue: '최대 파일 크기 및 허용 확장자 서버 측 유효성 규칙 미정의', suggestion: '10MB / PDF·DOCX 제한 명시 후 413 에러 처리 추가' },
        { module: '분석 스트리밍', issue: '스트림 중단 시 부분 데이터 처리 정책 없음', suggestion: '중단 지점 저장 후 재개 또는 전체 재요청 정책 결정 필요' },
      ],
      critical_questions: [
        '[비즈니스] 분석 결과를 저장·히스토리로 관리할 계획이 있나요? [A] 세션 내 임시 저장만 [B] DB 저장 후 히스토리 기능 제공',
        '[개발] 파일 업로드 방식을 어떻게 처리할까요? [A] 클라이언트에서 텍스트 추출 후 전송 [B] 파일 원본을 서버로 전송 후 서버에서 추출',
        '[디자인] 점수 게이지 애니메이션 진입 방식을 결정해주세요. [A] 페이지 진입 시 0에서 점수까지 자동 증가 [B] 정적으로 즉시 표시',
      ],
      ux_recommendations: [
        'Fogg Behavior Model 기반으로 분석 완료 직후 "목업 생성" CTA를 강조하여 다음 행동의 마찰을 줄이세요.',
        'Progressive Disclosure 원칙에 따라 디자이너/개발자 체크리스트를 탭으로 분리해 인지 부하를 낮추세요.',
        'Jakob\'s Law: 유사 서비스(Notion AI, Linear)의 결과 레이아웃 패턴을 따라 학습 비용을 줄이세요.',
      ],
    },
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
      let rawText = ''
      console.error('[분석 오류] 에러:', e)
      const errorMsg = '분석 중 오류가 발생했습니다'
      setState(prev => ({ ...prev, screen: 'upload', error: errorMsg }))
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
    const newWindow = window.open('/mockup', '_blank')
    if (!newWindow) {
      // 팝업이 차단된 경우
      setState(prev => ({ 
        ...prev, 
        error: '팝업이 차단되었습니다. 브라우저 팝업 차단을 해제해주세요.' 
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
