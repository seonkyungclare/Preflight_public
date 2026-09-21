// ============================================================================
// PRD 템플릿 정의 (Preflight v3.0)
// ----------------------------------------------------------------------------
// 분석 전 사용자가 선택하는 "팀 템플릿"과, Partner Growth 템플릿의 섹션·하위 항목·
// 감점 예산·하드 게이트를 한곳에 둔다. 시스템 프롬프트(analyze route)와 서버 채점기
// (lib/scoring.ts)는 이 파일만 참조한다. Confluence 템플릿이 바뀌면 여기만 고친다.
//
// 기준 문서: [Template] [Partner Growth] PRD
//   https://wiki.team.musinsa.com/wiki/spaces/PGT/pages/652153933
// ============================================================================

// - partner-growth : PGT 템플릿 기준 v3.0 감점제
// - commerce-core  : 전용 템플릿 준비 전까지 선택 불가 (disabled)
// - other          : 팀 템플릿이 없는 문서. 기존 v2.0 규칙(UX 6차원)으로 분석
export type PrdTemplateId = 'partner-growth' | 'commerce-core' | 'other'

export interface TemplateOption {
  id: PrdTemplateId
  label: string
  protocol: '2.0' | '3.0'
  /** 선택 불가. UI 에서 비활성으로 표시하고 저장된 선택도 무시한다 */
  disabled?: boolean
  referenceUrl?: string
}

export const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    id: 'partner-growth',
    label: 'Partner Growth',
    protocol: '3.0',
    referenceUrl: 'https://wiki.team.musinsa.com/wiki/spaces/PGT/pages/652153933',
  },
  {
    id: 'commerce-core',
    label: 'Commerce Core',
    protocol: '2.0',
    disabled: true,
  },
  {
    id: 'other',
    label: '그 외',
    protocol: '2.0',
  },
]

export function isTemplateId(v: unknown): v is PrdTemplateId {
  return v === 'partner-growth' || v === 'commerce-core' || v === 'other'
}

/** 사용자가 고를 수 있는 템플릿인지 (존재하고 disabled 가 아님) */
export function isSelectableTemplate(v: unknown): v is PrdTemplateId {
  return isTemplateId(v) && !TEMPLATE_OPTIONS.find(o => o.id === v)?.disabled
}

// ─── Partner Growth 템플릿 구조 ───────────────────────────────────────────────

export type SectionRequirement = 'required' | 'conditional'

export interface TemplateSubItem {
  id: string
  label: string
  /** 이 하위 항목이 완전히 없을 때의 감점 상한 */
  max: number
  /** 모델에게 주는 판정 힌트 */
  hint: string
}

export interface TemplateSection {
  id: string
  title: string
  requirement: SectionRequirement
  /** 섹션 전체가 없을 때의 감점 상한 (= 하위 항목 max 합) */
  max: number
  /** 이 섹션을 PRD에서 찾는 단서 (제목 변형·표 헤더 등) */
  detection: string
  /** conditional 섹션: 어떤 경우 "해당 있음"으로 보는가 */
  applicability?: string
  subItems: TemplateSubItem[]
}

export interface HardGateDef {
  id: string
  label: string
  cap: number
  description: string
}

/**
 * 템플릿 §7·§8이 공통으로 요구하는 "고민되어야 하는 사항" 8가지.
 * 템플릿 원문 그대로 쓴다. UX 휴리스틱(NN 등) 이름은 붙이지 않는다 — 점수 근거는 템플릿 문구뿐이다.
 */
export const CONCERN_CHECKLIST: Array<{ key: string; question: string }> = [
  { key: '데이터', question: '없으면? 대량이면? 중복이면?' },
  { key: '표시', question: '텍스트가 길면? 숫자 표기는? 0과 미입력 구분은?' },
  { key: '네트워크', question: '실패·지연되면? 재시도는?' },
  { key: '외부 연계', question: '송신·배치가 실패하면? 절반만 처리된 상태는? 실패를 누가 인지하나?' },
  { key: '권한', question: '권한 없이 진입하면? 세션 만료되면?' },
  { key: '입력', question: '필수값 누락? 형식 오류? 극단값?' },
  { key: '상태', question: '이미 처리된 건을 또 처리하면? 동시 작업 충돌은? 작성 중 이탈하면?' },
  { key: '시간', question: '기한 만료되면? 마감 전후가 다른가? 처리 중 원본이 바뀌면?' },
]

export const PGT_TEMPLATE = {
  id: 'partner-growth' as const,
  /** 수동 관리. Confluence 템플릿 갱신 시 날짜를 올린다. */
  ref: 'PGT-PRD/652153933@2026-09-20',
  url: 'https://wiki.team.musinsa.com/wiki/spaces/PGT/pages/652153933',
  actorAxes: [
    '파트너 (브랜드·입점사 담당자, 파트너 PO 등)',
    '대행사 (파트너를 대리하는 외부 주체)',
    '내부 운영 (운영 심사자·HO·CS 등)',
    '내부 사업 (담당 MD·영업 등)',
    '내부 개발 (시스템 관리자·개발자)',
    '외부 매체 (광고 매체·외부 시스템 담당)',
    '시스템 (배치·자동 상태 전이 등 사람이 아닌 처리 주체)',
  ],
  sections: [
    {
      id: '0',
      title: 'Intro',
      requirement: 'required',
      max: 3,
      detection: '"Intro", "개요", 담당자 표(Role/Name/담당 영역), 주요 링크(2-Pager/ADR/HLD/Figma)',
      subItems: [
        { id: '0.1', label: '담당자 R&R 표', max: 1, hint: 'PM·PD·FE·BE 등 Role별 이름과 담당 영역' },
        { id: '0.2', label: '주요 링크', max: 1, hint: '2-Pager·Initiative·ADR/HLD·Launch Gate·정책서·Figma 중 2개 이상' },
        { id: '0.3', label: '마일스톤·일정', max: 1, hint: '목표 시점 또는 마일스톤 언급' },
      ],
    },
    {
      id: '1',
      title: 'Business Impact & Scope',
      requirement: 'conditional',
      max: 7,
      detection: '"Business Impact", "Scope", In/Out of Scope 표',
      applicability: 'KTLO(운영 유지) 과제라고 명시된 경우에만 not_applicable. 그 외는 모두 필수로 본다.',
      subItems: [
        { id: '1.1', label: '2-Pager 링크·상위 문서 참조', max: 1, hint: 'Business Impact를 상위 문서로 위임하는 링크' },
        { id: '1.2', label: 'In Scope 정의', max: 2, hint: '항목·담당 시스템/팀' },
        { id: '1.3', label: 'Out of Scope + 제외 이유', max: 4, hint: '제외 항목마다 "제외 이유"가 반드시 있어야 present' },
      ],
    },
    {
      id: '2',
      title: '용어 정의',
      requirement: 'required',
      max: 5,
      detection: '"용어 정의", "Glossary", 용어/정의/범위 표',
      subItems: [
        { id: '2.1', label: '용어 표 존재', max: 2, hint: '용어·정의·이 과제에서의 범위' },
        { id: '2.2', label: '본문 도메인 용어 커버리지', max: 3, hint: '본문에 반복 등장하는 도메인 용어(상태명·시스템명·약어)가 표에 있는가. 빠진 용어를 missing에 나열' },
      ],
    },
    {
      id: '3',
      title: 'Actor & 권한 체계',
      requirement: 'required',
      max: 20,
      detection: '"Actor", "액터", "사용자 유형", "권한", "Role", 권한 매트릭스(C/R/U/D/승인) 표',
      subItems: [
        {
          id: '3.1-a',
          label: 'Actor 목록 완전성',
          max: 8,
          hint: 'PRD 전체(시나리오 주어·Workflow 주체·화면 관련 Actor·정책표 "주체" 열)에서 Actor를 추출해 §3.1 표와 대조. 미정의 Actor 1개당 3점 감점(상한 8). 권한이 다르면 다른 Actor다(예: 담당 MD ≠ 운영 심사자 ≠ HO). "시스템"이 상태를 바꾸면 Actor다.',
        },
        {
          id: '3.1-b',
          label: 'Actor별 정의 깊이',
          max: 4,
          hint: 'Actor마다 정의·진입 경로·권한 범위 3필드. 필드 1개 누락당 1점 감점(상한 4)',
        },
        { id: '3.2', label: '권한 매트릭스', max: 4, hint: '기능 × Actor 표에 C/R/U/D/승인 표기. 표 없음 4점, 기능 일부 누락 2점' },
        { id: '3.3', label: '데이터 접근 범위', max: 2, hint: 'Actor(또는 Actor 상태)별 조회 가능/수정 가능 범위' },
        { id: '3.4', label: '권한 없는 사용자 진입 처리', max: 2, hint: '권한 없이 진입·직접 URL 접근 시 동작(차단 화면·리다이렉트·메시지)' },
      ],
    },
    {
      id: '4',
      title: 'IA (As-Is / To-Be)',
      requirement: 'required',
      max: 8,
      detection: '"IA", "메뉴 구조", "Information Architecture", Depth 1/2/3 표, 변경 유형(신설/이동/명칭변경/삭제/변경없음)',
      subItems: [
        { id: '4.1', label: '전체 메뉴 트리', max: 3, hint: '변경 대상만이 아니라 관련 메뉴 트리 전체(Depth 1~3)가 보이는가' },
        { id: '4.2', label: '변경 유형 표기', max: 3, hint: '메뉴마다 신설/이동/명칭변경/삭제/변경없음 중 하나' },
        { id: '4.3', label: 'Actor별 노출', max: 2, hint: '메뉴가 어떤 Actor에게 노출되는지' },
      ],
    },
    {
      id: '5',
      title: '유저 시나리오',
      requirement: 'required',
      max: 20,
      detection: '"유저 시나리오", "User Scenario", "시나리오 맵", S-001 형식 ID, Milestone 표(✅/◐/—), "도달선"',
      subItems: [
        {
          id: '5.1',
          label: '전체 시나리오 맵',
          max: 6,
          hint: 'S-nnn ID · Actor · 한 줄 시나리오("누가 무엇을 할 수 있다" 형식) · 관련 Feature · 우선순위. 기능 나열이면 partial. §3의 모든 Actor가 시나리오 1개 이상을 가져야 하며, 없는 Actor당 1점 감점',
        },
        { id: '5.2', label: 'Milestone 정의', max: 4, hint: '시나리오 × 마일스톤 표에 ✅ 전체 / ◐ 부분 / — 미포함. 마일스톤 열에 시점. ◐는 "어디까지" 문장' },
        { id: '5.3', label: '이번 Milestone 도달선', max: 4, hint: '종료 시점 상태 3~5문장 + 미지원 항목 표(안 하는 이유·대체 수단·안내 주체·해소 시점)' },
        {
          id: '5.4',
          label: '시나리오 상세',
          max: 6,
          hint: '✅·◐ 시나리오마다 [진입] [본 흐름] [예외]. 본 흐름 단계가 SC-nn 화면을 참조. 예외 1개 이상. 상세가 전혀 없으면 6점, 일부 시나리오만 있으면 비율 감점',
        },
      ],
    },
    {
      id: '6',
      title: 'Workflow',
      requirement: 'required',
      max: 7,
      detection: '"Workflow", "업무 흐름", "운영 흐름", 시나리오별 Workflow 표, 다이어그램 마커([다이어그램]/[이미지])',
      subItems: [
        { id: '6.1', label: 'As-Is Workflow', max: 2, hint: '현재 운영 흐름. 신규 기능이라 As-Is가 없다고 명시하면 present' },
        { id: '6.2', label: 'To-Be Workflow', max: 3, hint: '변경 후 흐름. 단계·분기·주체가 드러나는가. 이미지만 있고 텍스트가 없으면 partial' },
        { id: '6.3', label: '시나리오 참조', max: 2, hint: 'Workflow가 §5의 시나리오(S-nnn)와 연결되는가' },
      ],
    },
    {
      id: '7',
      title: '시스템 요구사항 (정책)',
      requirement: 'required',
      max: 15,
      detection: '"시스템 요구사항", "Product Requirement", "정책", 넘버링된 정책 표(축/항목/정책/비고), 상태 전이표(상태/의미/진입/다음 상태/주체)',
      subItems: [
        { id: '7.1', label: '넘버링된 정책 정리', max: 4, hint: '화면과 무관한 정책이 번호(또는 ID)로 정리되어 있는가. 정의 + 정책표 구조' },
        { id: '7.2', label: '상태 전이표', max: 4, hint: '상태가 있는 도메인이면 상태·의미·진입 트리거·다음 상태·주체 표. 상태 개념이 없는 과제면 present로 두고 evidence에 사유' },
        { id: '7.3', label: '8대 고민 항목 반영', max: 7, hint: '데이터/표시/네트워크/외부 연계/권한/입력/상태/시간 8개 중 정책이 다루는 개수. 미반영 항목당 약 0.9점, 정수로 반올림. 미반영 항목명을 missing에 나열' },
      ],
    },
    {
      id: '8',
      title: '화면 요구사항',
      requirement: 'required',
      max: 15,
      detection: '"화면 요구사항", "UI 기준 Requirement", "화면 ID", SC-nn, 화면/구분/유저 시나리오/상세 요구사항 표',
      subItems: [
        { id: '8.1', label: '화면 단위 요구사항 표', max: 5, hint: '화면 ID · 관련 Actor · 진입 경로 · 유저 시나리오 · 상세 요구사항. 열 누락당 1점' },
        { id: '8.2', label: '시나리오·IA와의 교차 일치', max: 3, hint: '§5.4의 SC 참조가 §8에 실재하는가, §8 화면의 유저 시나리오 열이 §5.1 ID를 가리키는가, §4 신설 메뉴가 화면으로 있는가' },
        { id: '8.3', label: '8대 고민 항목 반영', max: 7, hint: '화면별 상세 요구사항이 8개 고민 항목 중 몇 개를 다루는가. §7.3과 같은 방식' },
      ],
    },
    {
      id: '9',
      title: '데이터 · 연동 · 마이그레이션',
      requirement: 'conditional',
      max: 5,
      detection: '"데이터", "연동", "마이그레이션", "배치", "이관", 연동 규격 표',
      applicability: '본문에 외부 시스템 연동·배치·이벤트/로그 규격·마이그레이션·데이터 이관 언급이 하나라도 있으면 해당 있음. 전혀 없으면 not_applicable.',
      subItems: [
        { id: '9.1', label: '외부 연동 규격', max: 1, hint: '대상 매체·프로토콜·필드·갱신 주기·상한' },
        { id: '9.2', label: '연동 실패 처리 + 알람 경로', max: 2, hint: '재시도 정책·부분 실패 롤백 여부·실패를 누가 어떻게 인지하나' },
        { id: '9.3', label: '이벤트·로그 규격', max: 1, hint: '이벤트명·파라미터·발화 시점' },
        { id: '9.4', label: '마이그레이션 절차', max: 1, hint: '원천→대상→규칙→검증, 실행 시점·Dry-run·롤백. 마이그레이션이 없는 과제면 이 항목만 present' },
      ],
    },
    {
      id: '10',
      title: '오픈 이슈',
      requirement: 'conditional',
      max: 2,
      detection: '"오픈 이슈", "Open Issue", "미결", Agenda/논의 사항 표',
      applicability: '본문에 "미정", "협의 필요", "TBD", "검토 중", "확정 필요" 등 미결 표현이 있으면 해당 있음.',
      subItems: [
        { id: '10.1', label: '미결 사항 표', max: 2, hint: 'Agenda · 논의 사항 · 미결 사유 · 결정 DFD/ETA' },
      ],
    },
  ] satisfies TemplateSection[],
  gates: [
    { id: 'G1', label: '유저 시나리오 부재', cap: 59, description: '§5 유저 시나리오 섹션이 없으면 Ready가 될 수 없습니다' },
    { id: 'G2', label: 'Actor 정의 부재', cap: 59, description: '§3.1 Actor 정의 표가 없으면 Ready가 될 수 없습니다' },
    { id: 'G3', label: '미정의 Actor 존재', cap: 79, description: '본문에 등장하지만 §3.1에 정의되지 않은 Actor가 있으면 Refine 이상으로 올라갈 수 없습니다' },
    { id: 'G4', label: '화면 요구사항 부재', cap: 69, description: '§8 화면 요구사항 섹션이 없으면 점수 상한이 69점입니다' },
  ] satisfies HardGateDef[],
}

export type PgtSectionId = (typeof PGT_TEMPLATE.sections)[number]['id']

export function getSection(id: string): TemplateSection | undefined {
  return PGT_TEMPLATE.sections.find(s => s.id === id)
}

/** 필수 섹션 감점 예산 합계. 항상 100이어야 한다. */
export const PGT_REQUIRED_BUDGET = PGT_TEMPLATE.sections
  .filter(s => s.requirement === 'required' || s.id === '1')
  .reduce((sum, s) => sum + s.max, 0)
