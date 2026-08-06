'use client'

import ResultScreen from '@/components/ResultScreen'
import type { AnalysisResult } from '@/app/page'
import { useState } from 'react'

// 화면 확인용 목 데이터. 실제 응답에서 나오는 경우를 되도록 다 태운다 —
// 7점(보완인데 예전엔 개수에 안 잡히던 값), missing이 빈 항목, 선택지가 하나뿐인
// 질문, 담당자 몫 질문, 태그 4종.
const MOCK_RESULT: AnalysisResult = {
  sufficiency_score: 66,
  base_score: 66,
  bonus_score: 8,
  is_sufficient: false,
  validated: ['역할×행위 권한 매트릭스가 표로 제시됨', '주요 플로우 기술', 'Primary CTA 명확'],
  criteria: {
    // 7점 = 신호등 "보완". 예전 기준(7점 미만)으로는 개수에 안 잡히던 경계값
    기능_정책_해상도: { score: 7, missing: ['CPID 병합 규칙(멀티 병합계정 생성)이 미정', '계약서 저장 형식 미정'] },
    상태_분기_조건: { score: 9, missing: [] },
    엣지케이스_롤백: { score: 6, missing: ['외부 API 실패 시 롤백 정책 없음', '극단값 처리 기준 미정', '프로세스 중단 시 데이터 상태 미정의'] },
    범위_대상_사용자: { score: 9, missing: [] },
    // missing이 비어 있는 보완 항목 — 제목만 나와야 한다
    미결정_명시성: { score: 7, missing: [] },
    핵심_과업_명확성: { score: 8, missing: [] },
  },
  bonus_signals: { 화면_목록: true, 참고_화면: true, 상태_초안: false },
  missing_for_designers: [
    { screen: '캠페인 목록', issue: '빈 상태 UI 미정의', suggestion: '빈 상태 일러스트 및 CTA 추가 필요', severity: 2 },
    { screen: '광고 생성 폼', issue: '유효성 오류 피드백 누락', suggestion: '인라인 에러 메시지 스펙 추가', severity: 3 },
  ],
  missing_for_developers: [
    { module: '캠페인 API', issue: '페이지네이션 파라미터 미정의', suggestion: 'page, size, sort 파라미터 스펙 확정 필요', severity: 2 },
  ],
  critical_questions: [
    { tag: '비즈니스', owner: 'PM', dimension: '기능_정책_해상도', question: '캠페인 삭제 시 연결된 광고 소재는 어떻게 처리되나요?', format: 'binary', options: ['함께 삭제', '소재는 유지'] },
    { tag: '개발', owner: '담당자결정', dimension: '상태_분기_조건', question: '목록 정렬 기본값은 무엇인가요?', format: 'binary', options: ['최신순', '이름순'] },
    { tag: '디자인', owner: 'PM', question: '부분 승인 상태를 목록에서 어떻게 구분해 보여줄까요?', format: 'multiple', options: ['배지로 표시', '행 색상으로 구분', '별도 탭 분리', '논의 필요'] },
    // 선택지가 하나뿐 — "A." 접두가 붙으면 안 된다
    { tag: 'UX정책', owner: 'PM', question: '글로벌 신청 의사와 실제 입점 상태가 다를 때의 표기 원칙이 필요합니다.', format: 'open', options: ['논의 필요'] },
  ],
  ux_recommendations: [
    { recommendation: '캠페인 생성 버튼을 상단 고정 영역에 배치하세요', principle: 'Fitts\'s Law', effort: 'low', expected_impact: '생성 전환율 향상' },
    { recommendation: '목록 필터 상태를 URL 파라미터로 유지하세요', principle: 'Jakob\'s Law', effort: 'medium', expected_impact: '공유 및 복귀 편의성 향상' },
  ],
}

export default function DevPage() {
  const [requirementsUrl, setRequirementsUrl] = useState('')
  // 마운트 시 한 번만 계산 — 렌더마다 바뀌면 표기가 흔들린다
  const [analyzedAt] = useState(() => Date.now() - 26 * 60 * 60 * 1000)

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
      // 어제 채점한 결과를 오늘 다시 연 상황 — 날짜 표기를 확인하려고 고정값을 쓴다
      analyzedAt={analyzedAt}
    />
  )
}
