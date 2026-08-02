# MCDS 캐노니컬 컨벤션 (프롬프트 주입용)

> **운영 원칙**: 이 문서의 모든 규칙은 MCDS-CCD 원본(캐노니컬 화면 `src/*.tsx` 코드 다수결,
> `AGENTS.md`, `docs/rulebook/*`, tarball `index.d.ts`)에서 추출됐고 출처를 함께 남긴다.
> **출처 없는 규칙은 추가 금지** — 규칙을 추가하려면 반드시 캐노니컬 화면 2곳 이상 또는 문서 명문을 인용할 것.
> `npm run sync:mcds`가 핵심 규칙의 드리프트(원본 코드 변경으로 규칙이 어긋남)를 검증한다.
> 최종 전수 감사: 2026-07-08 (캐노니컬 9개 화면 + AGENTS.md + rulebook 4종 + d.ts 대조, 모순 10건 해소)

## 1. 검색 영역 (RecipeSearchArea)

- leftActions에 **[검색, 초기화] 순서로 함께** 배치. 검색 = 기본형(primary), 초기화 = type="secondary". 둘 다 텍스트 라벨만.
  `leftActions={<><Button onClick={search}>검색</Button><Button type="secondary" onClick={reset}>초기화</Button></>}`
  — 출처: ProductListAdmin.tsx:1684, InspectionManagementAdmin.tsx:528, ApiKeyManagementAdmin.tsx:920 외 (7:2 다수결), AGENTS.md:344
- rightActions는 선택 슬롯: 검색 항목 설정 같은 보조 기능 = TextButton type="secondary", 등록·내보내기 진입 = Button.
  — 출처: ProductListAdmin.tsx:1691(설정 TextButton), ApiKeyManagementAdmin.tsx:923(새 인증키 생성 Button)
- labelWidth는 기본 생략. 한글 라벨이 길어 잘리면 100~160 지정.
  — 출처: AccountApplicationItemAdmin.tsx:601(120), MarketingSlotManagementAdmin.tsx:1203(160)
- 필드 의미별 컨트롤 매핑 (HO 어드민 기준):
  - 키워드/명칭/ID → TextField, placeholder는 "항목명 또는 ID 입력" 형식
  - 단일 분류·상태 → Select. **placeholder prop 없음** — options 첫 항목에 '전체'를 넣고 기본 value로 지정
  - 독립 복수 enum(판매상태·플랫폼 등) → MultiSelect
  - 업체명·출고지·배송비정책 등 코드/메타 확인이 필요한 entity → SearchModalField + LookupPickerModal (Select 축약 금지)
  - 브랜드명·담당자(MD) → AutoComplete
  - 카테고리 등 계층 경로 → HierarchySelectField (자체 label prop 보유 — FormField로 감싸면 이중 라벨)
  - 기간 → DateRangePicker
  — 출처: component-selection.md Rule 1~8, InspectionManagementAdmin.tsx:431-501
- 검색 실행 시 페이지를 1로 리셋. — 출처: ProductListAdmin.tsx:1044-1048
- 검색 panel 내부에 제목/설명을 다시 넣지 않는다 — title은 레이아웃 title prop 소유. — 출처: template-layout.md Rule 5, AGENTS.md:256
- 화면 수가 1~2개인 단순 spec이라도 새로고침/내보내기/인쇄/전체선택 등 spec에 없는 유틸 버튼을 추가하지 않는다. — 출처: AGENTS.md:303

## 2. 결과 테이블 (RecipeResultsTable)

- title = 목록명 + **live 건수**: `` title={`상품 목록 (${rows.length}건)`} `` — 건수는 state에서 파생하므로 발명이 아님. 단위는 '건' 우세.
  — 출처: 8/8 화면 전수 (ReturnRequestManagementAdmin.tsx:221, ProductListAdmin.tsx:1848 등)
- actions 슬롯(테이블 헤더 우측): 다운로드·일괄 처리 = type="secondary" size={36}, 대상 없으면 disabled. 신규 등록 = 기본형(primary) 버튼을 맨 오른쪽에.
  — 출처: InspectionManagementAdmin.tsx:597-609, ProductListAdmin.tsx:1800-1832
- **상세 진입**: 식별자 컬럼(품번·명칭)을 TextButton으로. spec에 상세 화면(navigates_to)이 있으면 `navigate('상세id')`, 없을 때만 Modal 대체. 캐노니컬에 Modal 상세 진입은 0건.
  — 출처: InspectionManagementAdmin.tsx:569, AccountApplicationItemAdmin.tsx:353
- 행 끝 관리 컬럼 버튼 = Button type="secondary" size={32}. — 출처: ReturnRequestManagementAdmin.tsx:185-187
- 일괄 처리가 있는 목록은 첫 컬럼을 checkbox 선택 컬럼으로: columns에 `{ key: 'selected', headerControlType: 'checkbox', headerControlChecked, headerControlIndeterminate }` + 행 셀 `<Checkbox showLabel={false} checked onChange />`. 일괄 버튼은 선택 0건이면 disabled.
  — 출처: ProductListAdmin.tsx:1266-1274, InspectionManagementAdmin.tsx:544-563
- emptyState 문구: `{ title: '조회 결과가 없습니다.', description: '검색 조건을 확인해 주세요.' }` 형식.
  — 출처: ReturnRequestManagementAdmin.tsx:190-192

## 3. 등록/수정/상세

- AdminRegistrationRecipeLayout **variant는 "basic" | "stepped" | "conditional" | "repeatable"만 존재** (기본 "basic"). "register"/"edit"는 타입에 없음 — 등록/수정 구분은 title과 버튼 라벨로 표현.
  — 출처: index.d.ts RegistrationVariant, ApiKeyManagementAdmin.tsx:1283
- read-only 3분류: 시스템 결정 값 = ReadOnlyField / 참조용 원본 데이터 = TextField readOnly / 상태에 따른 잠금 = disabled. **disabled로 읽기전용을 흉내 내지 않는다.**
  — 출처: AGENTS.md:327, InspectionDetailAdmin.tsx:651-655
- FooterActionBar 계약: leading = 이탈 액션('목록으로' TextButton — iconLeft={<IconArrowLeft />} 허용), trailing = [취소(secondary) → 주 액션(primary)] 순. **destructive(삭제 등)는 좌측 slot 단독, type="warning" size={36}** — trailing 말미 배치 금지.
  — 출처: InspectionDetailAdmin.tsx:597-619, AGENTS.md:323
- content rhythm: 섹션 gap 12 / 항목 gap 12 / 행 gap 8 — 템플릿·토큰이 소유하므로 커스텀 wrapper로 다른 gap을 재정의하지 않는다.
  — 출처: template-layout.md 공통규칙, AGENTS.md:338

## 4. 확인/모달 — 무엇을 언제 쓰는가 (MCDS가 컴포넌트를 나눈 기준)

MCDS는 팝업을 용도로 3분한다. 판단 기준은 "본문에 사용자 상호작용이 있는가"다.
— 출처: DesignSystemAdmin.tsx:5560-5617(Alert), 5772-5787(Alert 예시), 10578-10594(Alert/Modal 정의)

### (a) Alert = ConfirmActionDialog (420px) — 단일 메시지 전달
- **언제**: 경고·중요 안내·확인 요청처럼 **하나의 메시지를 전달하고 예/아니오만 받는** 경우.
  입력 필드·여러 버튼 등 복잡한 상호작용이 없으면 항상 이것. **삭제 확인이 대표 사례.**
- **메시지는 title에 문장형으로** 쓴다(행동 유도, 최대 2줄 권장). description은 **부가 설명이 꼭 필요할 때만**.
  삭제의 캐노니컬 형태는 **title-only**: `title="선택한 1개의 상품을 삭제하시겠습니까? 삭제된 상품은 복구할 수 없습니다."` (description 없음)
  — 출처: DesignSystemAdmin.tsx:5779-5786 (label "Title only", title="삭제 후에는 되돌릴 수 없습니다.", confirmLabel="삭제")
- **버튼**: `cancelAction={<Button type="secondary">취소</Button>}` + `confirmAction={<Button>삭제</Button>}`.
  confirm은 **기본형(primary/파랑)** — 파괴 액션이라도 warning(빨강)을 쓰지 않는다. 파괴 신호는 title 문구 + "삭제" 라벨이 전달.
  — 출처: DesignSystemAdmin.tsx:5611-5613 (`<Button type="secondary">취소</Button><Button>{confirmLabel}</Button>`), 캐노니컬 ConfirmActionDialog warning 사례 0건
- **금지**: description에 확인 문구를 넣고 title을 비우거나 형식적으로 채우는 것 / 본문에 입력 필드·표를 넣는 것(그건 Modal).

### (b) Modal (540px+) — 작은 Task 수행 / 즉각적 상호작용
- **언제**: 본문에서 사용자가 **입력·선택·표 조작 등 실제 작업**을 하는 경우(폼, entity picker, 일괄 편집 워크스페이스).
  title = 화면명, 본문 = 인터랙션 컨텐츠, actions = [취소(secondary) → 주 액션(primary)] size 36.
  — 출처: DesignSystemAdmin.tsx:10590-10593, ApiKeyManagementAdmin.tsx:1885-1906, ProductListAdmin.tsx:1945-1952
- 검색·선택·표 작업 등 큰 본문은 `layout="workspace"`. 좌측 보조 정보(선택 해제 등)는 footerMeta 슬롯.
- Modal title에 장식 아이콘 금지. — 출처: AGENTS.md:326
- **LookupPickerModal은 onConfirm 필수** (누락 시 확인 클릭에서 크래시). SearchModalField selectedItems는 `[{ value, label }]` ({id, primary} 아님).
  — 출처: index.d.ts LookupPickerModalProps·SearchModalFieldItem, ProductListAdmin.tsx:1954-1958

### 판단 순서
1. 본문에 입력/선택/표 조작이 있는가? → **있으면 Modal**, 없으면 2로.
2. 단일 메시지 확인(삭제·이탈·실행 등)인가? → **Alert(ConfirmActionDialog)**, 메시지는 title, 버튼은 취소(secondary)/실행(primary).

## 5. 피드백

- 성공 완료: 캐노니컬은 MessageStack(AGENTS.md:352-355). **이 목업 환경에서는 message.success('...')로 대체**(단일 파일 하네스 제약, 의도된 편차). notice·HelpAlertPanel로 성공 피드백을 대체하지 않는다.
- 정책 안내·지속 경고·처리 결과 안내: 레이아웃의 notice / noticeTone prop 또는 HelpAlertPanel. **tone은 'info' | 'warning' | 'neutral'만** ('error'/'success' 없음).
  — 출처: InspectionManagementAdmin.tsx:650-652, index.d.ts:319
- 고위험 재확인·실패 상세 설명: ConfirmActionDialog. — 출처: component-selection.md 공통규칙

## 6. 칩/태그/버튼

- **Tag = 읽기 전용 상태 표시 전용** (labelText + color). 선택/필터형 pill은 Chips — Tag를 클릭 토글로 쓰지 않는다.
  Chips는 제거형: `<Chips labelText="판매중" border remove onRemove={...} />` — 적용된 필터 값 나열에 사용. 토글형 다중 선택 자체는 MultiSelect가 정공법.
  — 출처: AGENTS.md:329, index.d.ts ChipsProps
- Tag 색 의미: green=승인/활성/완료, red=반려/오류, yellow=대기/검토중, blue=진행중/신규, gray=중립/미사용.
  — 출처: InspectionManagementAdmin.tsx:86-93
- Button/TextButton 라벨은 텍스트만 — children에 아이콘 금지. 유일 예외: '목록으로' TextButton의 iconLeft 화살표.
  — 출처: AGENTS.md:344, InspectionDetailAdmin.tsx:600
- 액션 버튼 size 36 (기본값), 행 안 버튼만 32. — 출처: AGENTS.md:322-323

## 7. 타이포/스타일

- 본문 14px, 보조·캡션·메타만 12px. 제목은 템플릿 title scale 유지(임의 축소 금지).
  — 출처: AGENTS.md:345, mcds-migration.md 규칙 카드 16
- 화면에 구현 근거·검토 메모성 문구 노출 금지. 사용자향 목적 설명(레이아웃 description prop)은 허용.
  — 출처: component-selection.md 공통규칙, ReturnRequestManagementAdmin.tsx:203
- 커스텀 인라인 스타일은 --mcds-* 토큰만 (raw hex/px 금지). — 출처: AGENTS.md:356
- 파일 업로드는 커스텀 드롭존 div 대신 **UploadPanel**: `<UploadPanel label="파일 업로드" description="..." files={files} onSelect={...} onRemove={...} />`.
  — 출처: index.d.ts UploadPanelProps
