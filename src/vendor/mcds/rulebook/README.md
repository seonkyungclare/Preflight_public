# Rulebook

## 목적

- 이 문서는 공개 디자인시스템 화면이 아니라 내부 구현 규칙을 다룬다.
- 목표는 "이럴 땐 어떤 컴포넌트를 쓰는가"를 반복 설명 없이 고정하는 것이다.
- 규칙은 아이디어 메모가 아니라 화면 설계, 구현, 리뷰, 체크 스크립트에 바로 연결돼야 한다.

## 운영 루프

1. 반복되는 선택/조합 판단을 찾는다.
2. 규칙 카드로 정리한다.
3. `doc-only`, `review-gate`, `check-script` 중 하나로 검증 수준을 정한다.
4. 재발 위험이 큰 규칙만 `AGENTS.md`에 승격한다.
5. 정적 검증이 가능한 규칙만 체크 스크립트에 추가한다.

## Rule Card 형식

각 규칙 카드는 아래 항목을 반드시 가진다.

- 상황: 어떤 문맥에서 이 규칙이 발동하는가
- 권장 컴포넌트: 기본 선택지 하나
- 쓰면 안 되는 경우: 반례 또는 예외
- 판단 기준: 무엇이 다르면 다른 컴포넌트로 가야 하는가
- 실제 예시: 현재 저장소 안의 화면 근거
- 검증 수준: `doc-only` / `review-gate` / `check-script`

## Subagent 역할

- Explorer A: 실제 화면 코드에서 반복 패턴과 예외를 수집한다.
- Explorer B: catalog, Figma registry, review loop에서 공용 계약과 불일치를 찾는다.
- Worker: 승인된 규칙만 문서와 체크 스크립트에 반영한다.

## 기본 운영 원칙

- subagent는 `요청형 + 승인형`으로만 쓴다.
- 내부 Rulebook 문구를 런타임 화면이나 공개 디자인시스템 UI에 노출하지 않는다.
- 문맥 판단이 필요한 규칙은 처음부터 스크립트로 강제하지 않는다.
- 컴포넌트 선택 규칙은 실제 화면 근거 없이 추가하지 않는다.

## 현재 1차 범위

- `component-selection.md`
- `mcds-migration.md`
- `template-layout.md`
- 검색/선택 계열 기준:
  - `SearchModalField`
  - `LookupPickerModal`
  - `Select`
  - `AutoComplete`
  - `HierarchySelectField`
  - `MultiSelect`
- 템플릿/레이아웃 기준:
  - `한 view = 한 template`
  - `local recipe wrapper 진입`
  - `canonical builder 사용`
  - `preview fixture 재사용`
