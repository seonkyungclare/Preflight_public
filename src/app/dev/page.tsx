'use client'

import ResultScreen from '@/components/ResultScreen'
import type { AnalysisResult } from '@/app/page'
import { useState } from 'react'

const MOCK_RESULT: AnalysisResult = {
  sufficiency_score: 72,
  is_sufficient: false,
  validated: ['화면 인벤토리 정의', '주요 플로우 기술', 'CTA 명확성'],
  criteria: {
    '화면 인벤토리 & 플로우': { score: 18, notes: '주요 화면은 정의되어 있으나 빈 상태 누락' },
    '데이터 & 시스템 상태': { score: 14, notes: '로딩/에러 상태 정의 부족' },
    '엣지 케이스 & 제약 조건': { score: 12, notes: '극단값 처리 미정의' },
    '인터랙션 & 로직': { score: 18, notes: '버튼 목적지 대부분 정의됨' },
    '정보 계층 & CTA 명확성': { score: 10, notes: 'Primary CTA 명확' },
  },
  missing_for_designers: [
    { screen: '캠페인 목록', issue: '빈 상태 UI 미정의', suggestion: '빈 상태 일러스트 및 CTA 추가 필요', severity: 2 },
    { screen: '광고 생성 폼', issue: '유효성 오류 피드백 누락', suggestion: '인라인 에러 메시지 스펙 추가', severity: 3 },
  ],
  missing_for_developers: [
    { module: '캠페인 API', issue: '페이지네이션 파라미터 미정의', suggestion: 'page, size, sort 파라미터 스펙 확정 필요', severity: 2 },
  ],
  critical_questions: [
    { tag: '비즈니스', question: '캠페인 삭제 시 연결된 광고 소재는 어떻게 처리되나요?', format: 'binary', options: ['[A] 함께 삭제', '[B] 소재는 유지'] },
    { tag: '개발', question: '목록 정렬 기본값은 무엇인가요?', format: 'binary', options: ['[A] 최신순', '[B] 이름순'] },
  ],
  ux_recommendations: [
    { recommendation: '캠페인 생성 버튼을 상단 고정 영역에 배치하세요', principle: 'Fitts\'s Law', effort: 'low', expected_impact: '생성 전환율 향상' },
    { recommendation: '목록 필터 상태를 URL 파라미터로 유지하세요', principle: 'Jakob\'s Law', effort: 'medium', expected_impact: '공유 및 복귀 편의성 향상' },
  ],
}

export default function DevPage() {
  const [requirementsUrl, setRequirementsUrl] = useState('')

  return (
    <ResultScreen
      fileName="dev-mock-prd.md"
      result={MOCK_RESULT}
      hasMockupLowFi={false}
      hasMockupHiFi={false}
      mockupLowFiAt={null}
      mockupHiFiAt={null}
      onGenerateMockup={(type, regenerate) => alert(`목업 생성: ${type}, regenerate=${regenerate}`)}
      onCancelMockup={() => alert('취소')}
      mockupGenerating={null}
      onReupload={() => alert('재업로드')}
      requirementsUrl={requirementsUrl}
      onRequirementsUrlChange={setRequirementsUrl}
    />
  )
}
