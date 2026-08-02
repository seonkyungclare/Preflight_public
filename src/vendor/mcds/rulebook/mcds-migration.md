# MCDS Migration Rules

## 규칙 카드 1. 전면 적용 요청 시 bridge 완료 처리 금지

- 상황:
  - 사용자가 `MCDS 적용`, `디자인시스템 입히기`, `전면 치환`, `갈아엎기`처럼 디자인시스템 직접 적용을 명시한 작업
- 권장 컴포넌트:
  - `@musinsa/mcds`의 canonical component와 template
  - page-level search/result/section shell은 local div 조합이 아니라 canonical builder/recipe
- 쓰면 안 되는 경우:
  - theme/token만 덮고 기존 shadcn/radix/local primitive를 유지한 상태
  - `MCDS처럼 보이게 하는` bridge wrapper만 남긴 상태
  - native `<select>`, raw `<button>`, raw `<input>`를 로컬 style로 보정한 상태
- 판단 기준:
  1. 이 작업의 결과가 `컴포넌트 교체`인가, 아니면 `시각 흉내`인가
  2. page shell이 MCDS 소유인가, page가 직접 조립한 div/class 조합인가
  3. control 하나만 MCDS여도 shell이 로컬이면 전면 적용으로 보지 않는다
  4. bridge가 남아 있다면 `임시 경유층`인지 `최종 구현`인지 구분하고, 후자면 미완료다
- 실제 예시:
  - 백오피스 이관에서 `Select/Input/Button`만 MCDS처럼 덮고 검색 영역 shell이 로컬 조합으로 남으면 사용자는 여전히 `MCDS로 안 보인다`고 느낀다
  - `native <select>` 3개를 그대로 두면 field 높이와 menu shape가 달라져 토큰만 맞춰도 이질감이 남는다
- 검증 수준:
  - `review-gate`

## 규칙 카드 2. 완료 선언 전 남은 비-MCDS 영역 명시

- 상황:
  - 전면 적용 요청인데 외부 라이브러리 계약, 시간, 구조 제약 때문에 일부 bridge가 불가피하게 남는 경우
- 권장 컴포넌트:
  - 우선순위가 높은 shell/control부터 canonical MCDS로 치환하고, 남는 영역은 파일/구간/영향을 명시한다
- 쓰면 안 되는 경우:
  - bridge 상태를 숨기고 `MCDS 적용 완료`라고 말하는 것
  - 남은 비-MCDS 영역을 `사소한 보정`처럼 축소 설명하는 것
- 판단 기준:
  1. 남은 bridge가 사용자 눈에 보이는가
  2. 남은 bridge가 search area, form control, CTA처럼 화면 리듬을 결정하는가
  3. 그렇다면 완료가 아니라 `남은 이슈`다
- 실제 예시:
  - 검색 영역 shell이 local div 조합으로 남아 있으면 field가 36px이어도 MCDS 전면 적용으로 보지 않는다
- 검증 수준:
  - `review-gate`

## 규칙 카드 3. primitive Table 하단 seam은 outer frame 1겹만 유지

- 상황:
  - 운영 화면에서 primitive `Table`을 단독으로 쓰거나, 같은 view 안에 table을 연속으로 쌓는 경우
- 권장 컴포넌트:
  - `@musinsa/mcds` primitive `Table`
- 쓰면 안 되는 경우:
  - 마지막 body row가 bottom border를 다시 그려 outer frame bottom border와 겹치는 상태
  - table 바깥 wrapper가 perimeter를 소유하는데 table 내부 row도 마지막 하단선을 따로 닫는 상태
- 판단 기준:
  1. table 하단 선이 1px 한 겹으로 보이는가
  2. 화면/브라우저 확대율에 따라 하단 seam이 그림자처럼 두껍게 보이지 않는가
  3. 두 개의 table을 세로로 붙였을 때 각 table의 하단선이 시각적으로 한 겹씩만 닫히는가
- 실제 예시:
  - 회원정보 상단 2개 표에서 간헐적으로 하단선이 이중으로 보이면 page 보정이 아니라 primitive `Table`의 border ownership부터 수정해야 재발이 안 난다
- 검증 수준:
  - `review-gate`

## 규칙 카드 4. 데이터형 modal은 width를 먼저 올리고 table은 body 안에서만 스크롤

- 상황:
  - 포인트/머니/쿠폰/주소록/이력 조회처럼 table 중심의 데이터 modal을 구성할 때
- 권장 컴포넌트:
  - `Modal` 또는 `ModalWorkspace`
  - primitive `Table`
- 쓰면 안 되는 경우:
  - modal width가 좁아서 table이 잘리는데 table column만 억지로 줄이는 것
  - table이 modal body padding 바깥으로 밀려나거나, modal 전체가 가로로 깨지는 것
  - data modal title 왼쪽에 장식용 아이콘을 붙이는 것
- 판단 기준:
  1. modal width를 공용 size 기준에서 먼저 올렸는가
  2. table wrapper가 `width: 100%`, `min-width: 0`, `overflow-x: auto`를 가져 modal body inset 안에서만 가로 스크롤되는가
  3. title row는 텍스트만 유지하고, 보조 의미는 body 안의 summary/section으로 풀었는가
- 실제 예시:
  - 적립금/무신사머니/쿠폰 modal은 840px에서 잘리면 1040px 수준으로 올리고, table은 modal body 안에서만 가로 스크롤되게 둔다
  - modal title 왼쪽 아이콘은 정보량을 늘리지 않고 header 높이와 정렬만 흔들기 때문에 기본 금지한다
- 검증 수준:
  - `review-gate`

## 규칙 카드 5. 상태 pill은 Badge bridge가 아니라 direct Tag를 사용

- 상황:
  - 운영 화면에서 주문 상태, 문의 상태, 채널, 카테고리, 액션 항목 같은 짧은 상태 pill을 표시할 때
- 권장 컴포넌트:
  - 읽기 전용 상태: `Tag`
  - 선택/필터 pill: `Chips`
  - 클릭해서 상세/모달/토글을 여는 액션: `TextButton` 또는 `Button`, 필요하면 그 안에 `Tag`
- 쓰면 안 되는 경우:
  - local `Badge` wrapper가 legacy `className`, `variant`, `bg-*`, `text-*`를 해석해 MCDS처럼 보이게 만드는 방식
  - `variant="outline"`나 utility class 조합으로 상태 색을 우회하는 방식
  - 클릭 액션까지 `Tag` 자체 props로 억지로 처리하는 방식
- 판단 기준:
  1. 이 pill이 읽기 전용 상태인가, 선택형 chip인가, 링크/상호작용 액션인가
  2. business status가 MCDS token color(`gray|blue|green|red|yellow|purple`)에 명시적으로 매핑되어 있는가
  3. 같은 상태명이 화면마다 다른 class 조합으로 그려지지 않는가
- 실제 예시:
  - `답변완료`, `사용가능`, `배송 완료`는 `Tag color="green"`으로 직접 매핑한다
  - 회수 상태처럼 눌러서 상세를 여는 셀은 `TextButton` 안에 `Tag`를 넣거나 링크형 액션으로 분리한다
  - `Badge className="bg-green-100 text-green-700"`처럼 legacy 색 해석을 남기면 화면마다 태그 밀도와 톤이 달라진다
- 검증 수준:
  - `review-gate`

## 규칙 카드 6. 정보 중복과 box-in-box 레이아웃은 기본 금지

- 상황:
  - 회원 정보, 주문 정보, 요약 패널처럼 이미 정보 table이나 정보 블록이 있는 화면에서 액션/보조 영역을 추가할 때
- 권장 컴포넌트:
  - outer panel 하나 + `SectionStack` + `Table`/정보 블록 + section header action
- 쓰면 안 되는 경우:
  - 같은 값을 table과 별도 액션 카드에서 다시 보여주는 것
  - outer panel 안에 의미 없이 inner panel/card를 여러 겹 중첩하는 것
  - `기본 정보` 관련 액션을 별도 `회원 액션` 박스로 분리하는 것
- 판단 기준:
  1. 이미 같은 정보가 위/옆 section에 있는가
  2. inner box가 상태/경계/스크롤/편집 ownership을 실제로 가지는가
  3. 아니라면 inner box를 없애고 section divider와 header action으로 풀 수 있는가
- 실제 예시:
  - 회원 등급, 문의 건수가 이미 회원 정보 table에 있으면 우측 액션 카드에서 다시 보여주지 않는다
  - 개인정보 조회, 주소록, 회원정보 변경은 `기본 정보` 헤더 액션에 붙이고, 별도 `회원 액션` 박스를 만들지 않는다
  - 회원 정보 outer panel이 이미 있다면 내부는 `기본 정보 / 혜택 및 정책 / 환불 계좌 정보` section으로만 나누고 box를 한 겹 더 만들지 않는다
- 검증 수준:
  - `review-gate`

## 규칙 카드 7. list/detail workspace는 outer surface 1겹만 유지하고 wide table은 local scroll로 가둔다

- 상황:
  - 좌측 목록 + 우측 상세처럼 split workspace 안에서 결과 목록과 상세 정보를 동시에 보여주는 운영 화면을 이관할 때
- 권장 컴포넌트:
  - outer panel 1개 + row list 또는 section stack
  - primitive `Table` + local viewport wrapper
- 쓰면 안 되는 경우:
  - 목록 패널이 이미 surface를 가지는데, 내부 각 row를 다시 동일한 card surface로 반복하는 것
  - 상세 패널이 이미 surface를 가지는데, 내부 각 섹션을 다시 `border + rounded` 박스로 둘러싸는 것
  - wide table 때문에 패널 전체가 화면 밖으로 밀리거나, table이 panel inset을 무시하고 넘치는 것
- 판단 기준:
  1. 목록 패널/상세 패널이 outer surface를 각 1겹만 소유하는가
  2. 내부 row/section 구분이 선택 상태, 타이틀, gap, divider 수준으로 해결되는가
  3. table은 `width: 100%`, `min-width: 0`, `overflow-x: auto` viewport 안에서만 가로 스크롤되는가
- 실제 예시:
  - 주문 목록 패널은 outer panel 1개만 두고, 내부 주문 row는 selected background와 row divider로만 구분한다
  - 주문 상세 패널은 outer panel 1개만 두고, `주문정보 / 주문상품 / 취소·반품 / 교환`은 section title과 spacing으로만 나눈다
  - 주문상품 table이 넓어도 상세 패널 전체가 밀리지 않고, 해당 table 영역 안에서만 가로 스크롤된다
- 검증 수준:
  - `review-gate`

## 규칙 카드 8. local dialog는 floating layer component와 충돌하지 않게 구성한다

- 상황:
  - consumer 화면에서 local dialog wrapper 안에 `Select`, `DatePicker`, lookup picker처럼 body portal에 option/menu/calendar를 띄우는 컴포넌트를 넣을 때
- 권장 컴포넌트:
  - floating layer와 공존 가능한 dialog shell
  - body portal 기반 `Select`/`DatePicker`
- 쓰면 안 되는 경우:
  - dialog focus trap이나 outside interaction 제어가 option layer를 modal 바깥 클릭으로 오판해서 선택을 막는 것
  - 1차 선택은 되는데 2차/3차 활성화처럼 후속 상태 전파가 끊기는 것
- 판단 기준:
  1. modal 안에서 floating option layer가 정상 클릭되는가
  2. option 선택 후 dependent field의 disabled 상태가 즉시 갱신되는가
  3. 문제를 page-level workaround가 아니라 dialog wrapper 수준에서 해결했는가
- 실제 예시:
  - 서브 케이스 생성 modal에서 `1차 문의유형`을 선택하면 `2차 문의유형`이 바로 활성화되어야 한다
  - select option menu가 body portal로 뜨더라도 local dialog가 outside interaction으로 막지 않아야 한다
- 검증 수준:
  - `review-gate`

## 규칙 카드 9. 조회형 workspace는 32 inset 기준선과 sticky query section을 공유한다

- 상황:
  - 회원 검색, 회원 정보, 주문 조회, 목록, 상세가 한 화면에 이어지는 조회형 workspace를 설계하거나 MCDS로 이관할 때
- 권장 컴포넌트:
  - `RecipeSearchArea`
  - `Tabs`
  - `Table`
  - outer panel 1겹 + split workspace section
- 쓰면 안 되는 경우:
  - 검색 영역은 32 inset인데 회원 정보만 16, 주문 조회만 20처럼 sibling section마다 좌우 여백이 따로 노는 것
  - 조회 조건 탭보다 `주문 조회` 타이틀이 아래에 있어서 hierarchy가 뒤집히는 것
  - 조회 조건 섹션과 결과 섹션이 시각적으로 같은 덩어리처럼 붙어 있는데 sticky도 아니고 구분선도 약해서 경계가 흐려지는 것
- 판단 기준:
  1. 검색 영역, 정보 영역, query 영역, 목록/상세 영역의 좌우 기준선이 동일한가
  2. 조회 조건 섹션 순서가 `타이틀 -> 탭 -> 검색`으로 읽히는가
  3. `RecipeSearchArea` 바로 아래의 결과/목록/정보 콘텐츠까지 하단 간격이 기본 `32`로 유지되는가
  4. section 사이 구분선이 페이지 끝까지 가는 neutral divider인가, 아니면 의미 없는 colored line/card 배경에 기대고 있는가
  5. query section이 바로 아래 결과를 제어하면 sticky로 고정했을 때 흐름이 더 안정적인가
- 실제 예시:
  - 고객센터 백오피스에서는 `회원 검색 영역`, `회원 정보 영역`, `주문 조회 영역`, `주문 목록/상세 영역`을 모두 `32` inset으로 맞추고, `주문 조회`는 sticky section으로 고정한다
  - 플랫폼 탭은 `주문 조회` 타이틀 아래에 두고, 날짜 검색영역은 그 아래에 둔다
  - `고객 문의 내역`, `메시지 발송 내역`처럼 검색영역이 있는 탭은 `검색영역 -> 테이블 제목/결과` 간격도 기본 `32`를 따른다
  - 회원 정보와 주문 조회를 나눌 때는 끝까지 가는 gray divider를 쓰고, blue line 같은 강조색을 separator에 쓰지 않는다
- 검증 수준:
  - `review-gate`

## 규칙 카드 10. read-only 상태는 disabled control이 아니라 plain text 또는 ReadOnlyField로 보여준다

- 상황:
  - 운영 화면에서 수정 가능한 정보를 기본적으로는 읽기 전용으로 보여주고, 특정 액션에서만 편집 모드로 전환할 때
- 권장 컴포넌트:
  - plain text
  - `ReadOnlyField`
  - 편집 진입 후 `Select`, `TextInput`, `TextArea`
- 쓰면 안 되는 경우:
  - 기본 read-only 상태를 disabled `Select`, disabled `TextInput`으로 흉내 내는 것
  - disabled 회색 처리 때문에 실제 값 가독성이 떨어지는 상태
- 판단 기준:
  1. 사용자가 기본 상태에서 값을 읽어야 하는가, 아니면 바로 수정해야 하는가
  2. 읽기가 우선이면 form control이 아니라 읽기용 표현을 써도 충분한가
  3. 편집은 별도 버튼/모드 전환 뒤에만 열면 되는가
- 실제 예시:
  - 환불 계좌 정보는 기본 상태에서 `은행명 + 계좌번호`를 plain text로 보이고, `수정` 클릭 시에만 `Select + TextInput`으로 바꾼다
- 검증 수준:
  - `review-gate`

## 규칙 카드 11. 정보 통합은 행을 붙이기보다 컬럼을 확장한 단일 table을 우선 검토한다

- 상황:
  - 같은 밀도와 읽기 흐름을 가진 요약 정보가 여러 개의 table로 나뉘어 있고, 한 영역 안에서 통합이 필요할 때
- 권장 컴포넌트:
  - primitive `Table`
  - 필요 시 `TableCell`의 복합 kind
- 쓰면 안 되는 경우:
  - `기본 정보`, `혜택 및 정책`, `환불 계좌 정보`처럼 한 덩어리로 읽히는 정보를 2행짜리 분리 표나 다중 표 나열로 그대로 유지하는 것
  - 통합이 필요하다고 해서 별도 inner box를 추가하는 것
- 판단 기준:
  1. 정보의 읽기 순서가 한 줄 요약으로 닫히는가
  2. 각 그룹의 cell 밀도와 height가 비슷한가
  3. 별도 section으로 둘 명확한 편집 ownership 차이가 있는가
- 실제 예시:
  - 회원 정보는 `회원명 ~ 동의 내역`에 `환불 계좌 정보`까지 같은 통합 table 컬럼으로 묶고, 편집은 마지막 셀의 inline edit로 해결한다
- 검증 수준:
  - `review-gate`

## 규칙 카드 12. 초기 진입에는 의미 없는 목록/상세 패널을 미리 렌더하지 않는다

- 상황:
  - 검색/선택 전에는 실제 데이터 대상이 없는 조회형 workspace
- 권장 컴포넌트:
  - 필요한 최소 search shell
  - plain empty state
- 쓰면 안 되는 경우:
  - 아직 고객/주문이 선택되지 않았는데 목록 패널, 상세 패널, 보조 패널을 empty box 형태로 먼저 배치하는 것
  - empty state를 장식용 border/radius card로 또 감싸는 것
- 판단 기준:
  1. 사용자가 지금 당장 상호작용할 수 있는 대상이 있는가
  2. 없다면 패널을 숨기고 search/selection에 집중시키는 편이 더 명확한가
  3. empty state가 안내 역할만 하면 충분한가
- 실제 예시:
  - 고객센터 백오피스 첫 진입에서는 `주문 목록`, `주문 상세`를 아예 렌더하지 않고, 회원 검색 이후에만 노출한다
- 검증 수준:
  - `review-gate`

## 규칙 카드 13. tab strip은 divider ownership을 한 곳만 가진다

- 상황:
  - 케이스 탭, 하단 고객 탭, 플랫폼 탭처럼 strip 아래에 결과 영역이나 section divider가 바로 이어지는 구조
- 권장 컴포넌트:
  - `Tabs`
  - strip baseline 1겹 + active underline
  - neutral icon-only close affordance
- 쓰면 안 되는 경우:
  - strip 하단 border, active underline, section 상단 border가 동시에 살아 있어 두 줄로 보이는 상태
  - 탭 간 gap과 border 때문에 strip이 card 여러 개처럼 분리되는 상태
  - close affordance가 작은 icon이 아니라 button box처럼 보이는 상태
- 판단 기준:
  1. 하단선이 1겹으로만 읽히는가
  2. 탭 간 연결감이 유지되는가
  3. close affordance가 content보다 과하게 강조되지 않는가
- 실제 예시:
  - `새 케이스` strip은 탭 간 gap 없이 붙고, close는 gray-50 톤 icon-only로 처리한다
  - 하단 고객 탭은 루트 border를 제거하고 header row 하단 divider만 남긴다
- 검증 수준:
  - `review-gate`

## 규칙 카드 14. searchable Select는 open 상태와 focus-visible 상태를 분리한다

- 상황:
  - trigger를 누르면 dropdown menu와 내부 검색 input이 열리는 `Select`, `MultiSelect`
- 권장 컴포넌트:
  - `Select`
  - `MultiSelect`
  - keyboard focus에만 적용되는 focus ring
- 쓰면 안 되는 경우:
  - open 상태에서 trigger 바깥으로 퍼지는 outer focus ring을 같이 보여서 menu 좌우에 색 띠가 남는 것
  - open과 focus-visible을 같은 visual state로 처리하는 것
- 판단 기준:
  1. menu가 열렸을 때 trigger 바깥 box-shadow가 주변 레이아웃과 충돌하는가
  2. keyboard focus indication이 꼭 필요한 순간과 menu open 순간이 같은가
  3. open state는 border 강조만으로 충분한가
- 실제 예시:
  - 검색 기준 `Select`를 열었을 때 좌우에 파란 영역이 남는 것은 open-state outer ring과 menu width가 충돌한 결과다. 이 경우 focus ring은 keyboard focus에만 두고, open state는 border 강조로 분리한다
- 검증 수준:
  - `review-gate`

## 규칙 카드 15. 조회형 SearchArea는 내부 title 없이 `초기화 + 검색`을 기본 action으로 둔다

- 상황:
  - 회원 검색, 주문 조회처럼 page header 아래에 조회 조건만 노출하는 운영 화면
- 권장 컴포넌트:
  - `RecipeSearchArea`
  - `Button`
- 쓰면 안 되는 경우:
  - search panel 내부에 title을 다시 넣는 것
  - 화면마다 `초기화`가 빠지거나, 검색 버튼에 의미 없는 아이콘을 붙이는 것
- 판단 기준:
  1. title ownership이 page header/section header에 있는가
  2. 사용자 입장에서 `초기화 + 검색`이 기본 회수 동작인가
  3. panel 내부 action이 예외 규칙 없이 공통으로 읽히는가
- 실제 예시:
  - 고객센터 백오피스의 회원 검색과 주문 조회는 panel 내부 title 없이 쓰고, action은 항상 `초기화`, `검색` 텍스트 버튼으로 통일한다
- 검증 수준:
  - `review-gate`

## 규칙 카드 16. 본문 14px, 보조문구 12px, title은 템플릿 scale을 유지한다

- 상황:
  - 운영 화면 typography hierarchy를 잡을 때
- 권장 컴포넌트:
  - 템플릿 title scale
  - 본문 `14px`
  - help/caption/meta `12px`
- 쓰면 안 되는 경우:
  - 본문을 `12px`로 낮추는 것
  - 페이지 title, section title을 본문과 같은 크기로 쓰는 것
  - divider만으로 hierarchy를 해결하고 title scale을 죽이는 것
- 판단 기준:
  1. 사용자가 먼저 읽어야 하는 title과 body가 분명히 분리되는가
  2. 보조문구만 더 작고, 본문은 기본 읽기 크기를 유지하는가
  3. 구분은 divider보다 title scale과 spacing으로 먼저 해결하는가
- 실제 예시:
  - `고객 정보 검색`, `회원 정보`, `주문 조회` 같은 section title은 템플릿 title scale을 따르고, help text만 12px로 낮춘다
- 검증 수준:
  - `review-gate`

## 규칙 카드 17. input family의 hover/focus 상태는 core component가 직접 소유한다

- 상황:
  - `TextInput`, `TextArea`, `Select`, `DatePicker`처럼 같은 입력 계열 컴포넌트를 한 화면 안에서 함께 사용할 때
- 권장 컴포넌트:
  - `TextInput`
  - `TextArea`
  - `Select`
  - `DatePicker`
- 쓰면 안 되는 경우:
  - 특정 화면 CSS가 hover/focus border 색을 덮어쓰는 것
  - DesignSystem preview에서는 `focused`, `hovered`를 style override로 흉내 내는데 runtime component는 실제 상태 구현이 없는 것
  - 같은 입력 계열인데 컴포넌트마다 hover/focus 규칙이 달라 한 화면 안에서 서로 다른 제품처럼 보이는 것
- 판단 기준:
  1. hover/focus 상태가 공용 component 내부 state로 구현되어 있는가
  2. preview와 runtime의 상태 색이 같은가
  3. 소비 앱 CSS를 제거해도 input family의 상태가 일관되게 보이는가
- 실제 예시:
  - `TextInput`은 `hovered=blue-50`, `focused/typing=blue-40`를 component 내부에서 직접 적용해야 한다
  - `Select`는 outer ring 없이 border만으로 open/focus를 표현하고, `TextInput/TextArea`도 같은 family로 읽히는 상태 체계를 가져야 한다
- 검증 수준:
  - `review-gate`
