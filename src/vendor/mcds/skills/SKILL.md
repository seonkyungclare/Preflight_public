---
name: ocmp-admin-ui-generator
description: Generate or update MUSINSA OCMP Admin React UI from PRD, Figma, or Confluence requirements using canonical `@musinsa/mcds` templates, screen contracts, locked specs, and validation rules.
---

# OCMP Admin UI Generator

이 skill은 `AGENTS.md`의 저장소 규칙을 대체하지 않는다. 충돌 시 `AGENTS.md`를 우선 기준으로 본다.

## Use This Skill When
- PRD, Figma, Confluence 요구사항을 OCMP 운영 화면으로 바꿔야 할 때
- 조회/목록/상세/등록/처리형 admin 화면을 `@musinsa/mcds` canonical 구조로 구현하거나 치환할 때
- 필드 조건부 노출, 검증, 상태, table flow를 포함한 운영 UI를 구현할 때
- `MCDS 적용`, `디자인시스템 입히기`, `전면 치환`, `갈아엎기` 성격의 요청이 들어왔을 때

## Do Not Use This Skill As
- 단순 마케팅 페이지나 자유 레이아웃 제안용 skill
- raw JSX로 page shell/search shell/section shell을 새로 조립하는 지시문
- `AGENTS.md`의 검증 절차를 생략하는 빠른 스캐폴딩 지름길

## First Response Contract
작업을 시작할 때 먼저 아래 3가지를 정리한다.

1. 이 요구로부터 어떤 화면이나 기능을 만들어야 하는가
2. 화면 간 이동 흐름과 상태 변화는 무엇인가
3. 작업을 시작하기에 정보가 충분한가, 부족하다면 무엇이 비어 있는가

그 다음에만 화면안, 컴포넌트안, 구현안을 제시한다.

## Canonical Sources
- 운영 규칙의 기준은 `AGENTS.md`다.
- 템플릿 선택 기준은 `packages/mcds/src/catalog.ts`
- 화면 계약 기준은 `src/screens/templateContracts.json`
- recipe wrapper / builder adapter 기준은 `src/components/pageRecipes.tsx`, `src/components/pageRecipeBuilders.tsx`
- locked spec 기준은 `src/screens/lockedSpecs/*.json`
- Product 계열 필드 정책 기준은 `src/productFieldControlPolicies.ts`
- Figma naming / Code Connect 기준은 `packages/mcds/figma/*`

## Build Workflow
1. 요청을 `화면 목적`, `주 사용자`, `완료 액션`, `실패 조건`으로 분해한다.
2. 한 화면에 `조회+처리`, `목록+상세`처럼 목적이 섞이면 먼저 `view` 단위로 분리한다.
3. 각 view마다 `packages/mcds/src/catalog.ts`에서 가장 가까운 템플릿 1개를 고른다.
4. PRD/Figma/문서를 `section -> field schema`로 재구성한다.
5. 각 필드를 `label`, `controlType`, `required`, `options`, `visibleWhen`, `enabledWhen`, `validate`, `helpText`, `errorText` 수준까지 명시한다.
6. 정책화된 Product 계열 필드는 raw control 대신 `ProductFieldControl` 우선 사용 여부를 먼저 판단한다.
7. `enforced` view면 raw shell을 조립하지 말고 recipe wrapper와 canonical builder 경로로만 구현한다.
8. Figma나 Confluence 링크가 있으면 가능하면 MCP 기준으로 상태, copy, node 매핑을 확인한다.
9. 구현 후 `수정 -> check/build 실행 -> 실패 수정 -> 재검증` 루프를 완료한다.

## Mapping Rules
- `Text` -> `TextInput`
- `Number` -> `NumberInput`
- `Select` -> `Select`
- `Multi` -> `MultiSelect` 또는 `MultiList`
- `Boolean` -> `Checkbox` 또는 `Switch` 또는 의미가 명확한 선택 control
- `Long text` -> `TextArea`
- 반복 행, SKU, 옵션 매트릭스 -> `Table` 기반 패턴
- read-only 기본 상태 -> plain text 또는 `ReadOnlyField` 패턴

## Non-Negotiable Rules
- `@musinsa/mcds` 외의 raw HTML form control을 직접 스타일링하지 않는다.
- 사용자가 `MCDS 적용`을 명시하면 bridge 재스킨이나 로컬 wrapper 흉내내기로 끝내지 않는다.
- `enforced` view에서 raw `AdminSearchArea`, raw `Table`, raw `AccordionSection`, raw `FormBlock/AdminFormSection/FormSection` 조립을 하지 않는다.
- 등록형 화면은 기본적으로 `좌측 레이블 + 입력영역 1단` 구조를 유지한다.
- read-only 값을 disabled `TextInput`, disabled `TextArea`, disabled `Select`로 흉내 내지 않는다.
- `FormField` 내부에 입력 control과 버튼을 ad-hoc으로 같이 넣지 않는다.
- Figma에 없는 상태, variant, copy를 코드에 임의 추가하지 않는다.

## Output Contract
- Default output:
  1. `화면/기능 정의`
  2. `플로우와 상태`
  3. `정보 충분성 판단`
  4. `정책/예외 규칙`
  5. `MCDS 템플릿 및 컴포넌트 매핑`
  6. `구현 범위와 수정 파일`
  7. `검증 체크리스트`
- If user asks "코드만", output code only.
- 사용자 요청이 "코드만"이어도 내부적으로는 구조/상태/정책 판단을 먼저 마친 뒤 코드만 출력한다.
- 항상 실제 `@musinsa/mcds` import와 프로젝트 토큰 규칙을 사용한다.

## Validation
- 기본 검증 순서는 `npm run build` -> 실패 원인 수정 -> 재실행이다.
- 필요 시 아래 단독 검증도 함께 사용한다.
  - `npm run check:ds`
  - `npm run check:figma`
  - `npm run check:template-contracts`
  - `npm run check:locked-specs`
  - `npm run check:preview-contracts`
