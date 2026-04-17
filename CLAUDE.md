# Preflight PRD Verification Protocol (v1.2)

## 0. Core Philosophy
* [cite_start]**Ambiguity as Risk**: PRD 점수는 단순히 항목의 존재 여부가 아니라, 디자인 및 개발 착수 시 발생할 수 있는 모호성(Ambiguity)의 총량을 의미한다[cite: 7].
* [cite_start]**Ready to Build**: "이 PRD로 바로 디자인과 개발을 시작할 수 있는가?"라는 질문에 'Yes'라고 답할 수 있는 상태를 80점(Ready)으로 정의한다[cite: 6, 12].

---

## 1. Sufficiency Scoring (0-100)
[cite_start]모든 점수 산정은 **Nielsen Norman 10 Heuristics**, **Google HEART**, **IEEE 830 표준**을 근거로 가중치를 합산한다[cite: 9, 17].

| 평가 차원 | 배점 | 가중치 | 핵심 평가 요소 및 근거 |
| :--- | :--- | :--- | :--- |
| **① 화면 인벤토리 & 플로우** | 25점 | 25% | [cite_start]모든 화면(주요·전환·결과·빈 상태) 정의 여부[cite: 10]. |
| **② 데이터 & 시스템 상태** | 25점 | 25% | NN 원칙 #1. [cite_start]모든 화면의 빈 상태·로딩·에러 정의[cite: 10, 17]. |
| **③ 엣지 케이스 & 제약 조건** | 20점 | 20% | NN 원칙 #5. [cite_start]극단값, 프로세스 중단, 외부 API 실패 롤백 정책[cite: 10, 38]. |
| **④ 인터랙션 & 로직** | 20점 | 20% | [cite_start]버튼 목적지, 비즈니스 정책 일관성, Task Success 기반 로직[cite: 10, 17]. |
| **⑤ 정보 계층 & CTA 명확성** | 10점 | 10% | [cite_start]Primary CTA의 명확성 및 Fitts' Law 기반 시각적 계층[cite: 10, 56]. |

### [cite_start]🚩 Score Interpretation & Action [cite: 11]
* **80 – 100점 (Ready)**: 개발 준비 완료. [cite_start]즉시 킥오프 가능[cite: 61].
* **60 – 79점 (Refine)**: 보완 필요. [cite_start]데이터 상태나 엣지 케이스 보강 후 재업로드 권장[cite: 62].
* **0 – 59점 (Rewrite)**: 재작성 권장. [cite_start]로직 모순 및 화면 누락 리스크 높음[cite: 63].

---

## 2. Professional Checklists (Dual Track)
[cite_start]분석 결과는 디자이너와 개발자의 전문 영역을 명확히 분리하여 제공한다[cite: 19].

### 2-1. [cite_start]디자이너 체크리스트 (UX/UI Perspective) [cite: 18]
* [cite_start]**목적**: 시각적 레이아웃과 사용자 인터랙션의 완결성 확보[cite: 20].
* **사용 용어**: 피그마 컴포넌트 상태, 시각적 위계, 사용자 피드백 문구.
* [cite_start]**주요 항목**: 빈 화면(Empty), 로딩(Skeleton), 에러 UI 표현 방식, 확인 팝업 문구, 텍스트 제약(말줄임표 등)[cite: 24, 28, 32].

### 2-2. 개발자 체크리스트 (Tech/Dev Perspective)
* **목적**: 시스템 설계의 안정성 및 데이터 정합성 확보.
* **사용 용어**: API 파라미터, 호출 순서, 트랜잭션, 롤백, 유효성 검사 로직.
* [cite_start]**주요 항목**: API 호출 순서 및 종속성, 데이터 처리 시나리오, 서버 사이드 유효성 규칙, 예외 상황에 따른 데이터 상태 변경 정책[cite: 26, 38].

### 2-3. PO 체크리스트 (Requirements Completeness)
* **목적**: 디자인·개발 착수 전 요건의 완결성 확보.
* **주요 항목**:
  * **As-Is 변경 내역**: 기존 기능 중 유지/변경/제외 항목이 
    명시되어 있는가? "기존과 동일하게" 표현만 있고 
    기능 목록이 없으면 누락으로 판단.
  * **요건 확정 여부**: 각 기능 영역에서 "무엇을 구현할지"가 
    확정되어 있는가? UI 표현 방식은 디자인 단계에서 
    결정 가능하나, 기능 요건 자체가 미확정이면 착수 불가.
  * **PRD 업데이트 이력**: 이전 버전 대비 변경된 영역과 내용이 
    요약되어 있는가? 변경 표시만 있고 무엇이 왜 바뀌었는지 
    설명이 없으면 보완 필요.

---

## 3. Critical Questions with Context Tags
[cite_start]PO 확인 질문은 "모른다고 개발을 멈춰야 하는 수준의 모호성"을 대상으로 정중한 이진 선택지([A] vs [B]) 형식을 사용한다[cite: 35, 36].

* **태그 시스템**:
    * [cite_start]**[디자인]**: UI 요소, 시각적 피드백, 톤앤매너와 관련된 결정[cite: 21].
    * [cite_start]**[개발]**: 데이터 로직, API 연동, 성능, 외부 시스템 의존성 관련 결정[cite: 38].
    * [cite_start]**[비즈니스]**: 정책적 모순, 비즈니스 규칙 정의와 관련된 결정[cite: 38].
* [cite_start]**질문 규칙**: 최소 3개, 최대 7개를 유지하며 읽는 이가 불쾌하지 않은 협력적 어조를 사용한다[cite: 40, 42].

* **[비즈니스] 태그 질문 예시 추가**:
  * As-Is에서 유지되어야 하는 기능 중 PRD에 명시되지 않은 
    항목이 있습니다. [A] 의도적으로 제외한 것인가요? 
    [B] 추가 기술이 필요한가요?
  * 해당 기능 영역의 요건이 미확정 상태입니다. [A] 디자인 
    착수를 보류할까요? [B] 확정된 범위만 먼저 진행할까요?

---

## 4. Strategic UX Recommendations
[cite_start]"무엇을(What)"을 유지하며 "어떻게(How)" 더 잘할지에 대한 제안을 이론적 근거와 함께 제시한다[cite: 45, 46].

* **UX Frameworks**:
    * [cite_start]**Fogg Behavior Model**: 능력(Ability) 향상을 위한 마찰 감소 및 적절한 시점의 트리거(Trigger) 최적화[cite: 56].
    * [cite_start]**Fitts' / Hick's Law**: 클릭 타깃 최적화 및 단계별 정보 노출(Progressive Disclosure)[cite: 56].
    * [cite_start]**Jakob's Law**: 플랫폼 컨벤션 준수 (Google/Meta Ads 패턴 등)[cite: 54, 56].
    * [cite_start]**NN 10 Heuristics**: 시스템 상태 가시성(#1), 일관성(#4), 에러 방지(#5) 원칙 적극 적용[cite: 17, 56].

---

## 🛠️ Implementation Technical Rules (for Claude)
* **Response Format**: 반드시 유효한 단일 JSON 객체로 응답할 것 (No Markdown fences).
* **Language**: 모든 문자열 값은 반드시 **한국어**로 작성할 것.
* **Tone**: 전문가적이면서도 팀원을 존중하는 협력적인 톤을 유지할 것.
* [cite_start]**Strict Logic**: `sufficiency_score` 계산 시 명시된 가중치를 엄격히 준수할 것[cite: 10].