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
    // evidence는 실제 응답에 늘 들어오는데 이 목에는 없었다. 그래서 "검증 기준별 상세"의
    // 인용 표시를 화면에서 확인할 수 없었다 — 길게 이어지는 문장을 한 건 넣어 둔다.
    // 7점 = 신호등 "보완". 예전 기준(7점 미만)으로는 개수에 안 잡히던 경계값
    기능_정책_해상도: {
      score: 7,
      evidence:
        '캠페인 종료일은 시작일 이후여야 하며, 시작일이 오늘 이전이면 즉시 집행으로 처리한다. 예산이 소진되면 상태가 자동으로 종료로 바뀐다',
      missing: ['CPID 병합 규칙(멀티 병합계정 생성)이 미정', '계약서 저장 형식 미정'],
    },
    // 근거만 있고 빠진 것이 없는 경우
    상태_분기_조건: { score: 9, evidence: '승인 대기 상태에서는 소재 교체만 가능하고 예산 수정은 막는다', missing: [] },
    엣지케이스_롤백: {
      score: 6,
      evidence: '한 건의 저장 실패가 나머지 저장을 막지 않는다. 실패한 건은 결과 리포트에 사유와 함께 표기한다',
      missing: ['외부 API 실패 시 롤백 정책 없음', '극단값 처리 기준 미정', '프로세스 중단 시 데이터 상태 미정의'],
    },
    범위_대상_사용자: { score: 9, missing: [] },
    // missing도 evidence도 비어 있는 경우 — 제목과 막대만 나와야 한다
    미결정_명시성: { score: 7, missing: [] },
    핵심_과업_명확성: { score: 8, missing: [] },
  },
  bonus_signals: { 화면_목록: true, 참고_화면: true, 상태_초안: false },
  // owner가 곧 탭이다 — PM 몫과 담당자 몫을 둘 다 태워 세 탭이 모두 차게 둔다
  missing_for_designers: [
    { screen: '캠페인 목록', owner: '담당자결정', issue: '빈 상태 UI 미정의', suggestion: '빈 상태 일러스트 및 CTA를 UX 스펙에서 정의', severity: 2 },
    { screen: '광고 생성 폼', owner: 'PM', issue: '유효성 오류 피드백 누락', suggestion: '어떤 입력을 막을지 검증 규칙을 PM이 확정해야 함', severity: 3 },
  ],
  missing_for_developers: [
    { module: '캠페인 API', owner: '담당자결정', area: 'BE', issue: '페이지네이션 파라미터 미정의', suggestion: 'page, size, sort 파라미터를 API 설계서에서 확정', severity: 2 },
    { module: '정산 배치', owner: 'PM', area: 'BE', issue: '실패 건 재처리 정책 미정', suggestion: '재처리 횟수와 최종 실패 시 처리 방침을 PM이 결정', risk: '실패가 누적되면 정산 마감이 밀릴 수 있음', severity: 3 },
  ],
  critical_questions: [
    { tag: '비즈니스', owner: 'PM', dimension: '기능_정책_해상도', question: '캠페인 삭제 시 연결된 광고 소재는 어떻게 처리되나요?', format: 'binary', options: ['함께 삭제', '소재는 유지'], impact: '삭제 정책이 정해져야 확인 팝업 문구와 복구 동선이 결정됩니다', blocks: ['삭제 확인 팝업 설계', '소재 목록 화면의 빈 상태 정의'] },
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
