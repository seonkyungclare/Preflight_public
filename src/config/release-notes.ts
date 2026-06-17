export interface ReleaseEntry {
  date: string
  changes: string[]
}

export const releaseNotes: ReleaseEntry[] = [
  {
    date: '2026-06-17',
    changes: [
      'Confluence 페이지 URL로 바로 분석 가능 — Atlassian 계정 연결 후 페이지 링크만 붙여넣으면 됩니다',
      '여러 파일 동시 업로드 지원 — PRD·디자인 스펙 등 최대 3개 문서를 한 번에 분석',
      '사용자 플로우 다이어그램 가독성 개선 — 노드/라벨 겹침 방지, 캔버스 자동 확장',
    ],
  },
  {
    date: '2026-05-12',
    changes: [
      '사용자 플로우 보기 — 목록 클릭 → 상세, 버튼 클릭 → 폼 등 화면 간 이동이 실제로 연결됩니다',
      'lowfi/hifi 생성 토큰 한도 확장 — 복잡한 PRD도 코드 잘림 없이 생성',
      'PRD에 없는 UI 요소 자동 감지 및 Note Panel 표시 고도화',
    ],
  },
  {
    date: '2026-05-09',
    changes: [
      'Hi-Fi 목업 추가 — Ant Design 기반 고해상도 인터랙티브 프로토타입 생성',
      '분석 결과 기반 목업 지시사항(mockup_directives) 반영 — 분석에서 감지된 누락 상태를 목업에 자동 표시',
      'PRD Fidelity 원칙 적용 — PRD에 없는 요소는 Note Panel에 명시, 임의 추가 차단',
    ],
  },
  {
    date: '2026-05-02',
    changes: [
      'Lo-Fi 와이어프레임 생성 — PRD 화면 구조를 그레이스케일 목업으로 즉시 확인',
      'PRD 분석 6개 차원 평가 도입 — 화면 인벤토리·데이터 상태·엣지케이스 등 항목별 점수 제공',
      'PDF / Markdown 파일 업로드 지원',
    ],
  },
]
