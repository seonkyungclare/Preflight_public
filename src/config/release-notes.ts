export interface ReleaseEntry {
  date: string
  changes: string[]
}

export const releaseNotes: ReleaseEntry[] = [
  {
    date: '2026-05-12',
    changes: [
      '사용자 플로우 보기 — 목록 클릭 → 상세, 버튼 클릭 → 폼 등 화면 간 이동이 실제로 연결됩니다',
      'lowfi/hifi 생성 토큰 한도 확장 — 복잡한 PRD도 코드 잘림 없이 생성',
      'PRD에 없는 UI 요소 자동 감지 및 Note Panel 표시 고도화',
    ],
  },
]
