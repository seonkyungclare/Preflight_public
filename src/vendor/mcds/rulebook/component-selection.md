# Component Selection Rulebook

## 공통 규칙

- 같은 도메인 필드라도 `HO/PO` 문맥이 다르면 다른 control을 쓸 수 있다.
- `SearchModalField`는 실제 선택 오버레이 없이 단독으로 두지 않는다. 선택 본체는 `LookupPickerModal`이어야 한다.
- 후보 수와 메타 밀도, 계층 구조 유무, 사용자가 값을 알고 있는 정도를 먼저 보고 control을 고른다.
- 문맥 설명이나 구현 근거를 화면 안내 문구로 노출하지 않는다.
- 결과 피드백은 아래 기준으로 고른다.
  - 성공 완료 피드백: `Message` 또는 `MessageStack`
  - 정책 안내, 읽기 전용 설명, 지속 경고: `HelpAlertPanel` 또는 wrapper `notice`
  - 추가 확인, 실패/불가 상세 설명, 고위험 재확인: `ConfirmActionDialog` 또는 `Alert`
  - 성공 완료를 `notice panel`로 대체하지 않는다.

## Rule 1. 업체명은 HO에서 SearchModalField, PO에서 Select

- 상황: `supplierName`처럼 업체명만으로는 동명이인/메타 충돌이 생길 수 있는 필드
- 권장 컴포넌트:
  - HO: `SearchModalField` + `LookupPickerModal`
  - PO: `Select`
- 판단 기준:
  - 코드/명칭/상태를 함께 보고 골라야 하면 HO 규칙
  - 허용 거래처 풀이 좁으면 PO 규칙
- 쓰면 안 되는 경우:
  - HO 문맥에서 일반 `Select`로 축약
  - `SearchModalField`를 열기만 하고 실제 선택기 없이 두는 구조
- 실제 예시:
  - `ProductListAdmin`
  - `InspectionDetailAdmin`
  - `CrossPlatformProductAdmin`
- 검증 수준: `review-gate`

## Rule 2. 브랜드는 이름 탐색이 핵심이면 AutoComplete, 제한 목록이면 Select

- 상황: `brandName`처럼 사용자가 이름 일부를 알고 입력하는 필드
- 권장 컴포넌트:
  - HO: `AutoComplete`
  - PO: `Select`
- 판단 기준:
  - 사용자가 브랜드명을 타이핑해 빠르게 찾는 게 더 빠르면 `AutoComplete`
  - 허용 브랜드 목록이 고정돼 있으면 `Select`
- 쓰면 안 되는 경우:
  - 코드/메타 비교가 필요한 문맥을 `AutoComplete`만으로 닫기
  - 후보 풀이 작은데도 검색 입력을 강요하기
- 실제 예시:
  - `ProductListAdmin`
  - `CrossPlatformProductAdmin`
- 검증 수준: `review-gate`

## Rule 3. 카테고리는 계층이 의미면 HierarchySelectField, 아니면 Select

- 상황: `category`처럼 상위/하위 경로 자체가 판단 기준인 필드
- 권장 컴포넌트:
  - HO: `HierarchySelectField`
  - PO: `Select`
- 판단 기준:
  - 경로 탐색과 카테고리 타입 전환이 중요하면 `HierarchySelectField`
  - 제한된 노출 카테고리 중 하나를 고르면 되면 `Select`
- 쓰면 안 되는 경우:
  - 계층 경로가 중요한데 일반 `Select`로 납작하게 만드는 것
  - 반대로 PO 문맥에서 불필요한 트리 탐색을 강요하는 것
- 실제 예시:
  - `ProductListAdmin`
  - `CrossPlatformProductAdmin`
- 검증 수준: `review-gate`

## Rule 4. 출고지/배송비정책처럼 메타 확인이 필요한 필드는 SearchModalField를 쓴다

- 상황: 명칭만으로는 구분이 어렵고 추가 메타를 같이 봐야 하는 선택 필드
- 권장 컴포넌트:
  - HO: `SearchModalField` + `LookupPickerModal`
  - PO: `Select`
- 판단 기준:
  - 번호/코드/센터 메타를 같이 확인해야 하면 `SearchModalField`
  - 선택 풀이 작은 계약형 목록이면 `Select`
- 쓰면 안 되는 경우:
  - 정책 번호나 센터 메타가 중요한데 단순 `AutoComplete`로 축약하는 것
- 실제 예시:
  - `ProductListAdmin`
- 검증 수준: `review-gate`

## Rule 5. 담당자처럼 이름 검색이 자연스러운 필드는 AutoComplete를 우선한다

- 상황: `md`처럼 후보가 많지만 사용자가 이름 일부를 알고 있는 필드
- 권장 컴포넌트:
  - HO: `AutoComplete`
  - PO: `Select`
- 판단 기준:
  - 이름 일부 입력이 가장 빠른 탐색 수단이면 `AutoComplete`
  - 배정 가능한 담당자 풀이 작고 고정돼 있으면 `Select`
- 쓰면 안 되는 경우:
  - 역할/조직 메타 비교가 필요한데 `AutoComplete`만 강제하는 것
- 실제 예시:
  - `ProductListAdmin`
  - `CrossPlatformProductAdmin`
- 검증 수준: `review-gate`

## Rule 6. Product 계열 검색/선택 필드는 ProductFieldControl을 우선 진입점으로 쓴다

- 상황: `supplierName`, `brandName`, `category`, `md`, `dispatchPlace`, `shippingPolicy`처럼 정책화된 필드
- 권장 컴포넌트:
  - page에서 직접 `Select`, `AutoComplete`, `HierarchySelectField`, `SearchModalField`를 조립하지 말고 `ProductFieldControl`을 우선 사용
- 판단 기준:
  - 같은 필드를 여러 화면에서 반복 사용하거나 HO/PO 문맥이 갈리면 공용 어댑터를 써야 한다.
- 쓰면 안 되는 경우:
  - 각 화면이 같은 필드를 다른 prop 이름과 다른 설명으로 제각각 조립하는 것
- 실제 예시:
  - `ProductListAdmin`
  - `CrossPlatformProductAdmin`
- 검증 수준: `check-script`

## Rule 7. SearchModalField를 쓸 때는 선택 요약과 적용 경로를 같이 닫는다

- 상황: 모달로 값을 고른 뒤 검색 조건이나 폼 값에 반영해야 하는 필드
- 권장 컴포넌트:
  - trigger: `SearchModalField`
  - picker: `LookupPickerModal`
  - state adapter: 화면 로컬 상태 또는 공용 policy resolver
- 판단 기준:
  - 선택 결과가 단일 값이면 단건 적용, 다건 필터면 selectedValues 배열로 닫는다.
- 쓰면 안 되는 경우:
  - trigger는 있는데 선택 결과를 다시 input/text로 수동 동기화하는 임시 구조
- 실제 예시:
  - `ProductListAdmin`
  - `InspectionManagementAdmin`
  - `InspectionDetailAdmin`
- 검증 수준: `doc-only`

## Rule 8. MultiSelect는 독립적인 복수 enum 필터에만 쓴다

- 상황: 여러 값을 동시에 켜도 의미 충돌이 없는 검색 조건
- 권장 컴포넌트:
  - `MultiSelect`
- 판단 기준:
  - 각 선택값이 독립적이고 동시에 활성화돼도 의미가 유지되면 `MultiSelect`
  - entity lookup이나 계층 선택이면 다른 control을 쓴다.
- 쓰면 안 되는 경우:
  - 업체/브랜드 같은 entity 선택
  - 카테고리처럼 계층 경로가 의미인 값
  - 사실상 단건 선택인 필드
- 실제 예시:
  - `InspectionManagementAdmin`의 검수 상태
  - `ProductListAdmin`의 플랫폼, 판매상태, 연동상태, 판매국가
- 검증 수준: `review-gate`

## 1차 리뷰 체크

- 같은 도메인 필드를 화면마다 다른 control로 쓰면 문맥 차이가 문서에 남아 있는가
- 예외가 생기면 `왜 예외인지`가 Rulebook에 추가됐는가
- 화면에는 구현 근거나 정책 문구가 노출되지 않는가
