'use client'

import { useState } from 'react'
import ResultScreen from '@/components/ResultScreen'
import type { AnalysisResult } from '@/app/page'
import { finalizeV3Analysis, type RawV3Analysis } from '@/lib/scoring'

// ─── v2 (Commerce Core) 목 데이터 ─────────────────────────────────────────────
const MOCK_V2: AnalysisResult = {
  template: 'other',
  protocol_version: '2.0',
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

// ─── v3 (Partner Growth) 목 데이터 — 모델 원본을 서버 채점기에 통과시켜 실제 경로와 동일하게 만든다 ──
const RAW_V3: RawV3Analysis = {
  section_coverage: [
    { section_id: '0', status: 'present', evidence: 'PM 김경애 · PD 김선경 · BE 홍길동, 2-Pager/Figma 링크', sub_items: [
      { id: '0.1', status: 'present' }, { id: '0.2', status: 'present' }, { id: '0.3', status: 'present' } ] },
    { section_id: '1', status: 'partial', evidence: 'In Scope: 신청 제출·검토·승인 / Out of Scope: 대행사 대리 제출', sub_items: [
      { id: '1.1', status: 'present' }, { id: '1.2', status: 'present' }, { id: '1.3', status: 'partial', deduction: 2, missing: ['대행사 대리 제출 제외 이유'] } ] },
    { section_id: '2', status: 'partial', evidence: '용어: 신청, 심사, Bypass', sub_items: [
      { id: '2.1', status: 'present' }, { id: '2.2', status: 'partial', deduction: 2, missing: ['SOR', 'CPID', 'HOLD'] } ] },
    { section_id: '3', status: 'partial', evidence: 'Actor: 파트너 PO, 운영 심사자 / 권한: C·R·U·승인', sub_items: [
      { id: '3.1-a', status: 'partial', deduction: 6, missing: ['담당 MD', '시스템'] },
      { id: '3.1-b', status: 'partial', deduction: 2, missing: ['운영 심사자 진입 경로', '운영 심사자 권한 범위'] },
      { id: '3.2', status: 'present' }, { id: '3.3', status: 'missing' }, { id: '3.4', status: 'present' } ] },
    { section_id: '4', status: 'partial', evidence: '파트너센터 > 입점 > 신청 관리 (신설)', sub_items: [
      { id: '4.1', status: 'partial', deduction: 2, missing: ['Depth 1 전체 트리'] }, { id: '4.2', status: 'present' }, { id: '4.3', status: 'missing' } ] },
    { section_id: '5', status: 'partial', evidence: 'S-001 파트너는 신청서를 작성하고 제출할 수 있다 … S-004', sub_items: [
      { id: '5.1', status: 'present' }, { id: '5.2', status: 'present' },
      { id: '5.3', status: 'partial', deduction: 2, missing: ['미지원 항목 표'] },
      { id: '5.4', status: 'partial', deduction: 3, missing: ['S-002, S-004 상세'] } ] },
    { section_id: '6', status: 'partial', evidence: '[다이어그램] 심사 Workflow', sub_items: [
      { id: '6.1', status: 'present' }, { id: '6.2', status: 'partial', deduction: 2, missing: ['텍스트 단계 설명'] }, { id: '6.3', status: 'missing' } ] },
    { section_id: '7', status: 'partial', evidence: '상태: SUBMISSION → EVALUATION → CONTRACT …', sub_items: [
      { id: '7.1', status: 'present' }, { id: '7.2', status: 'present' },
      { id: '7.3', status: 'partial', deduction: 4, missing: ['네트워크', '외부 연계', '동시 작업 충돌', '시간(기한 만료)'] } ] },
    { section_id: '8', status: 'partial', evidence: 'SC-11 검토 대기 목록 · SC-12 신청 상세', sub_items: [
      { id: '8.1', status: 'partial', deduction: 1, missing: ['관련 Actor 열'] },
      { id: '8.2', status: 'partial', deduction: 2, missing: ['S-003 본 흐름의 SC-13 미정의'] },
      { id: '8.3', status: 'partial', deduction: 4, missing: ['데이터 0건', '표시(말줄임)', '권한 없음', '입력 극단값'] } ] },
    { section_id: '9', status: 'partial', evidence: '승인 건은 다음 날 배치로 외부 시스템에 반영', sub_items: [
      { id: '9.1', status: 'present' }, { id: '9.2', status: 'missing' }, { id: '9.3', status: 'present' }, { id: '9.4', status: 'present' } ] },
    { section_id: '10', status: 'not_applicable', sub_items: [] },
  ],
  actors: {
    defined: [
      { name: '파트너 PO', definition: '입점 신청을 작성·제출하는 브랜드 담당자', entry_path: '파트너센터 > 입점', permission_scope: '본인 신청 C/R/U' },
      { name: '운영 심사자', definition: '배정된 신청을 검토·승인·반려', entry_path: '', permission_scope: '' },
    ],
    detected_undefined: [
      { name: '담당 MD', where: '§7 상태 전이표 "주체" 열', quote: '심사 (적합성 선행 → 표준) … 담당 MD · 운영 심사자' },
      { name: '시스템', where: '§7 REJECT 행', quote: '시스템 (Bypass 대조)' },
    ],
  },
  scenarios: {
    map_count: 4,
    milestone_defined: true,
    detail_count: 2,
    actors_without_scenario: [],
    scenarios_without_screen_ref: ['S-002'],
  },
  cross_reference_issues: [
    { check: 'scenario_actor_undefined', detail: 'S-003 의 주체 "담당 MD" 가 §3.1 에 없습니다', severity: 3 },
    { check: 'scenario_screen_ref', detail: 'S-003 본 흐름 3단계가 참조하는 SC-13 이 §8 에 없습니다', severity: 3 },
    { check: 'workflow_scenario_ref', detail: '§6 Workflow 가 어떤 S-nnn 에 해당하는지 표기가 없습니다', severity: 2 },
  ],
  validated: [
    '신청 상태 전이(SUBMISSION → EVALUATION → CONTRACT → REGISTRATION → COMPLETION)가 표로 정의됨',
    '반려 시 사유 입력이 필수이며 미입력 시 처리 차단',
    '보류 14일 · 계약 동의 30일 무응답 시 EXPIRED',
  ],
  missing_for_designers: [
    { screen: '검토 대기 목록', issue: '0건 빈 상태 화면 미정의', principle: 'NN#1 Visibility of System Status', severity: 2, user_impact: '배정 건이 없을 때 오류로 오해', suggestion: '빈 상태 문구와 새로고침 안내 추가' },
    { screen: '신청 상세', issue: '권한 없는 건 직접 URL 접근 시 화면 미정의', principle: 'NN#5 Error Prevention', severity: 3, user_impact: '빈 화면 또는 시스템 오류 노출', suggestion: '접근 차단 화면 + 목록으로 돌아가기 CTA' },
  ],
  missing_for_developers: [
    { module: '외부 반영 배치', issue: '배치 실패 시 재시도·알람 경로 미정의', risk: '승인 건이 외부 시스템에 반영되지 않아도 아무도 모름', severity: 4, suggestion: '재시도 N회·소진 시 운영 알림 채널 명시' },
    { module: '심사 처리', issue: '두 심사자가 동시에 같은 건을 처리할 때의 충돌 정책 없음', risk: '중복 승인/반려', severity: 3, suggestion: '낙관적 잠금 또는 처리 시작 시 배정 고정' },
  ],
  critical_questions: [
    { tag: '비즈니스', question: '"담당 MD"는 운영 심사자와 별도 Actor로 정의해야 하나요, 아니면 운영 심사자에 포함되나요?', format: 'binary', options: ['별도 Actor (권한 분리)', '운영 심사자에 포함'], impact: '권한 매트릭스·LNB 구성', blocks: ['§3.2 권한 매트릭스', 'SC-11 목록 필터'] },
    { tag: '비즈니스', question: '"시스템"이 수행하는 Bypass 대조·자동 전이를 Actor 표에 명시할까요?', format: 'binary', options: ['시스템을 Actor로 명시', '정책 섹션에만 기술'], impact: '상태 전이 주체 명확화' },
    { tag: '개발', question: '외부 반영 배치가 실패하면 누가 어떻게 인지하나요?', format: 'multiple', options: ['운영 Slack 알림', '어드민 실패 목록', '메일 알림', '논의 필요'], impact: '§9.2 실패 처리 정책' },
    { tag: '디자인', question: 'S-002 상태 확인 시나리오는 어느 화면에서 제공되나요?', format: 'open', options: ['논의 필요'], impact: '§8 화면 목록' },
  ],
  ux_recommendations: [
    { recommendation: '반려 사유 입력을 미리 정의된 사유 선택 + 자유 입력으로 구성', principle: "Hick's Law", perspective: 'Friction Reduction', effort: 'low', expected_impact: '심사 처리 시간 단축, 사유 일관성 향상' },
    { recommendation: '검토 대기 목록에 "내 배정 건" 기본 필터 적용', principle: 'Fogg B=MAT (Ability)', perspective: 'CRO', effort: 'low', expected_impact: '첫 화면에서 바로 처리 시작' },
  ],
  severity_summary: { catastrophic: 1, major: 4, minor: 2, cosmetic: 0 },
  mockup_directives: {
    critical_screens: ['검토 대기 목록', '신청 상세'],
    forced_states: ['empty', 'error', 'forbidden'],
    attention_areas: [{ dimension: '§3 Actor & 권한 체계', score: 5, focus: '담당 MD·시스템 미정의', render_hint: 'LNB 에 Actor 전환 토글 표시' }],
    note_panel_priority: ['미정의 Actor: 담당 MD, 시스템', 'SC-13 미정의', 'S-002 화면 없음'],
  },
}

const MOCK_V3 = finalizeV3Analysis(RAW_V3) as unknown as AnalysisResult

export default function DevPage() {
  const [v, setV] = useState<'v2' | 'v3'>('v3')
  const result = v === 'v3' ? MOCK_V3 : MOCK_V2
  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 flex gap-1 rounded-md border border-border bg-background p-1 text-xs shadow">
        <button className={`px-2 py-1 rounded ${v === 'v3' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setV('v3')}>v3 PG</button>
        <button className={`px-2 py-1 rounded ${v === 'v2' ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setV('v2')}>v2 기본</button>
      </div>
      <ResultScreen
        key={v}
        fileName={v === 'v3' ? 'dev-mock-pgt-prd.md' : 'dev-mock-prd.md'}
        template={v === 'v3' ? 'partner-growth' : 'other'}
        result={result}
        hasMockupLowFi={false}
        hasMockupHiFi={false}
        mockupLowFiAt={null}
        mockupHiFiAt={null}
        onGenerateMockup={(type, regenerate) => alert(`목업 생성: ${type}, regenerate=${regenerate}`)}
        onCancelMockup={() => alert('취소')}
        mockupGenerating={null}
        mockupProgress={null}
        onReupload={() => alert('재업로드')}
      />
    </>
  )
}
