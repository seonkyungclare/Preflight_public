# Template Layout Rulebook

## 공통 규칙

- 운영 화면은 먼저 `view`로 쪼갠 뒤 template를 고른다.
- `enforced` view는 page가 내부 shell을 다시 조립하지 않는다.
- page-level wrapper는 `src/components/pageRecipes.tsx` adapter를 유일한 진입점으로 쓴다.
- 문서/preview도 실제 화면과 같은 builder 규칙을 따라야 한다.
- page, side sheet, modal은 각자 inset만 소유하고, 내부 content rhythm은 공용 token/helper가 소유한다.
- 기본 content rhythm은 `section gap 12`, `section body item gap 12`, `row gap 8`이다.

## Rule 1. 한 view에는 한 template만 둔다

- 상황: 목록/상세/처리/로그가 한 화면에 같이 섞이려는 경우
- 권장 구조:
  - `한 view = 한 recipe/template`
- 판단 기준:
  - 목적이 다르면 view를 쪼갠다.
  - 조회와 처리, 목록과 상세, 탐색과 편집은 같은 view에 섞지 않는다.
- 쓰면 안 되는 경우:
  - 한 컴포넌트 안에서 `list + detail + log`를 동시에 직접 조립하는 구조
- 실제 예시:
  - `templateContracts.json`
  - `return-request-admin`
  - `inspection-management-admin`
- 검증 수준: `check-script`

## Rule 2. page는 local recipe wrapper로만 들어간다

- 상황: 운영 화면이 template contract 대상일 때
- 권장 구조:
  - `src/components/pageRecipes.tsx` adapter 경유
- 판단 기준:
  - `@musinsa/mcds` page-level wrapper를 page 코드에서 직접 import하지 않는다.
  - 화면 계약 검증은 local wrapper 진입점만 본다.
- 쓰면 안 되는 경우:
  - page가 `@musinsa/mcds`의 page wrapper를 직접 import하는 것
- 실제 예시:
  - `pageRecipes.tsx`
  - `templateContracts.json`
- 검증 수준: `check-script`

## Rule 3. 조회형 view는 RecipeSearchArea와 Table로 닫는다

- 상황: `admin-list`, `admin-status` 계열 조회 화면
- 권장 구조:
  - 검색: `RecipeSearchArea`
  - 결과: `Table`
- 판단 기준:
  - 검색 shell과 결과 shell은 page가 다시 조립하지 않는다.
  - page는 필드, 액션, 결과 데이터와 pagination 정책만 주입한다.
- 쓰면 안 되는 경우:
  - enforced list/status view 내부에서 raw `AdminSearchArea`, raw `SearchArea`, primitive `Table`을 직접 조립하는 것
- 실제 예시:
  - `check-screen-template-contracts.mjs`
  - `marketing-slot-management-admin`
- 검증 수준: `check-script`

## Rule 4. 등록/상세 롱폼은 RecipeAccordionSections를 쓴다

- 상황: `admin-detail-editable`, `admin-registration-*` 계열 롱폼 화면
- 권장 구조:
  - section shell: `RecipeAccordionSections`
  - 실제 section: `AccordionSection`
- 판단 기준:
  - 접기/펼치기 UX가 필요하면 실제 accordion shell을 쓴다.
- 쓰면 안 되는 경우:
  - `FormBlock`, `AdminFormSection`, `FormSection`에 `collapsible/collapsed/onToggle`를 붙여 아코디언을 흉내 내는 것
- 실제 예시:
  - `inspection-detail-admin`
  - `check-screen-template-contracts.mjs`
- 검증 수준: `check-script`

## Rule 5. SearchArea 제목/설명은 panel 안에서 다시 열지 않는다

- 상황: 조회형 화면의 검색 영역 설명이 필요한 경우
- 권장 구조:
  - 제목/설명은 `AdminPageHeader` 또는 wrapper supplement에서만 관리
- 판단 기준:
  - `AdminSearchArea` panel 내부에는 title/description header를 다시 넣지 않는다.
- 쓰면 안 되는 경우:
  - 검색 panel 안에서 제목과 설명을 한 번 더 반복하는 것
- 실제 예시:
  - `AGENTS.md`
  - `check-screen-template-contracts.mjs`
- 검증 수준: `review-gate`

## Rule 6. preview는 shared fixture를 통해 실제 규칙을 재사용한다

- 상황: 디자인 시스템 preview, template preview, PRD preview
- 권장 구조:
  - 조회형 SearchArea preview는 shared fixture helper 경유
- 판단 기준:
  - preview라고 raw `AdminSearchArea`를 직접 조립하지 않는다.
  - 실제 화면과 다른 preview-only 구조를 만들지 않는다.
- 쓰면 안 되는 경우:
  - `DesignSystemAdmin`, `RecipePreviewRenderer`에서 raw `SearchArea`를 직접 렌더링하는 것
- 실제 예시:
  - `check-preview-contracts.mjs`
- 검증 수준: `check-script`

## Rule 7. self-surfaced 모듈 preview에 box를 한 겹 더 씌우지 않는다

- 상황: `SearchArea`, `Table`처럼 자체 surface를 가진 모듈의 preview
- 권장 구조:
  - transparent preview frame만 유지
- 판단 기준:
  - border/background/borderRadius를 preview wrapper에 다시 주지 않는다.
- 쓰면 안 되는 경우:
  - 카드 안에 카드처럼 box를 중첩하는 것
- 실제 예시:
  - `DesignSystemAdmin`
  - `check-preview-contracts.mjs`
- 검증 수준: `check-script`

## Rule 8. exemption은 숨김이 아니라 이관 대기 상태다

- 상황: 아직 template contract를 만족하지 못한 화면
- 권장 구조:
  - `exempt`와 `exemptionReason`을 명시
- 판단 기준:
  - contract 대상에서 빠지는 이유가 구조적으로 설명돼야 한다.
  - module 단위 예외보다 view 전체 예외를 우선한다.
- 쓰면 안 되는 경우:
  - 이관되지 않은 화면을 contract 목록에서 빼버리는 것
- 실제 예시:
  - `product-list-admin`
  - `product-registration-admin`
  - `api-key-management-admin`
- 검증 수준: `check-script`

## Rule 9. content rhythm은 surface와 분리한다

- 상황: 같은 section body가 page, side sheet, modal 어디에 놓여도 spacing이 같아야 하는 경우
- 권장 구조:
  - 여러 섹션 블록: `SectionStack`
  - section 내부 의미 단위 항목 묶음: `SectionBodyStack`
- 판단 기준:
  - surface는 inset만 소유한다.
  - content rhythm은 token/helper만 소유한다.
  - section gap은 `12`, item gap은 `12`, row gap은 `8`로 유지한다.
- 쓰면 안 되는 경우:
  - surface마다 raw `gap: 16`, `gap: 14` 등 다른 spacing literal을 다시 박는 것
  - modal/side sheet/page에서 같은 content를 서로 다른 gap wrapper로 다시 조립하는 것
- 실제 예시:
  - `TestPrdV2DetailAdmin`
  - `DesignSystemAdmin`
- 검증 수준: `review-gate`

## Rule 10. PRD candidate는 confidence와 split reason을 같이 남긴다

- 상황: PRD 워크벤치에서 candidate view를 생성할 때
- 권장 구조:
  - `document intent -> view intent -> section schema -> recipe decision -> candidate`
- 판단 기준:
  - candidate에는 최소 `confidence`, `splitReasons`, `requiredModules`, `riskFlags`, `viewIntent`, `sectionSchemas`가 함께 있어야 한다.
  - `status/approval/rejection` 신호가 있으면 list 단일 view로 닫지 않는다.
  - `permission/policy` 신호가 있으면 settings view 분리를 먼저 본다.
- 쓰면 안 되는 경우:
  - recipe 이름과 한 줄 reason만 남기고, 왜 분해됐는지/무엇이 부족한지 보이지 않는 candidate
- 실제 예시:
  - `PrdWorkbenchScreen`
  - `src/prd/engine.ts`
- 검증 수준: `review-gate`

## 1차 리뷰 체크

- view 목적이 둘 이상 섞였으면 분리 또는 exemptionReason이 남아 있는가
- wrapper 안쪽을 page가 다시 조립하지 않는가
- preview가 실제 화면 규칙을 우회하지 않는가
