# Preflight PRD Verification Protocol

Preflight는 분석 전에 사용자가 고른 **팀 템플릿**에 따라 두 프로토콜 중 하나를 적용한다.

| 템플릿 선택 | 프로토콜 | 코드 | 기준 |
| :--- | :--- | :--- | :--- |
| **Partner Growth** | **v3.0** (아래 §A) | `src/config/prd-template.ts` · `src/lib/analyze-v3.ts` · `src/lib/scoring.ts` | [PGT PRD 템플릿](https://wiki.team.musinsa.com/wiki/spaces/PGT/pages/652153933) |
| **Commerce Core** | (선택 불가, 전용 템플릿 준비 중) | — | — |
| **그 외** | v2.0 (아래 §B, v1.2 계승) | `src/app/api/analyze/route.ts` 의 `SYSTEM_PROMPT` | UX 휴리스틱 6차원 |

계획·결정 이력: [docs/preflight-v3-plan.md](docs/preflight-v3-plan.md)

---

# §A. Partner Growth 프로토콜 (v3.0, 2026-09-21)

## A-0. 원칙
* **템플릿이 기준**: PGT PRD 템플릿 11개 섹션 중 있어야 할 것이 없으면 깎는다. 있으면 그 품질을 본다.
* **모델은 판정, 서버는 계산**: 모델은 섹션·하위 항목의 present / partial / missing / not_applicable 판정과 PRD 원문 인용만 낸다. 점수·게이트·is_sufficient 는 `lib/scoring.ts` 가 결정적으로 계산한다.
* **채우지 않는다**: 없는 정보는 없다고 기록한다. 그럴듯한 기본값을 지어내지 않는다.

## A-1. 감점 예산 (필수 섹션 합 100)

| # | 섹션 | 상한 | 핵심 하위 항목 |
| :-- | :--- | :--: | :--- |
| 0 | Intro | 3 | 담당자 R&R · 링크 · 마일스톤 |
| 1 | Business Impact & Scope | 7 | In Scope · **Out of Scope + 제외 이유**. KTLO 명시 시에만 해당 없음 |
| 2 | 용어 정의 | 5 | 표 존재 · 본문 용어 커버리지 |
| 3 | **Actor & 권한 체계** | **20** | 목록 완전성(미정의 Actor당 −3) · 정의 깊이(필드당 −1) · 권한 매트릭스 · 데이터 접근 범위 · 권한 없는 진입 |
| 4 | IA (As-Is / To-Be) | 8 | 전체 트리 · 변경 유형 · Actor별 노출 |
| 5 | **유저 시나리오** | **20** | 시나리오 맵 · Milestone · 도달선+미지원 표 · 시나리오 상세([진입]/[본 흐름]/[예외], SC 참조) |
| 6 | Workflow | 7 | As-Is · To-Be · 시나리오 참조 |
| 7 | 시스템 요구사항 | 15 | 넘버링 정책 · 상태 전이표 · **8대 고민 항목** |
| 8 | 화면 요구사항 | 15 | 화면 표(ID·Actor·진입·시나리오·상세) · 시나리오/IA 교차 일치 · 8대 고민 항목 |
| 9 | 데이터·연동·마이그레이션 | 조건부 −5 | 연동 언급이 있는데 섹션이 없을 때. 예산 밖 추가 감점 |
| 10 | 오픈 이슈 | 조건부 −2 | 미결 표현이 있는데 섹션이 없을 때. 예산 밖 추가 감점 |

## A-2. 하드 게이트 (점수 상한)
* **G1** 유저 시나리오 부재 → 59 · **G2** Actor 정의 표 부재 → 59 · **G3** 미정의 Actor 존재 → 79 · **G4** 화면 요구사항 부재 → 69
* 상한은 원점수와 비교해 낮은 쪽을 택한다. 결과 화면 최상단에 배너로 사유를 표시한다.

## A-3. Actor 규칙 (매우 상세해야 한다)
* 권한이 다르면 다른 Actor다. 담당 MD ≠ 운영 심사자 ≠ HO ≠ 영업. 파트너 PO ≠ 대행사.
* 상태를 바꾸는 "시스템"(배치·자동 전이·자동 발송)은 Actor다.
* 본문 어디에 등장하든(시나리오 주어·Workflow 주체·화면 관련 Actor·정책표 주체·알림 수신자) §3.1 표에 없으면 `actors.detected_undefined` 로 올리고, **[비즈니스] PO 질문을 반드시 생성**한다.

## A-4. 교차 검증 (섹션 간 연결)
Actor↔시나리오 · 시나리오↔화면(SC-nn) · 화면↔시나리오(S-nnn) · IA 신설 메뉴↔화면 · Workflow↔시나리오 · 본문 용어↔용어 표. 실패는 `cross_reference_issues[]` 로 출력하고 관련 하위 항목(5.1, 8.2, 6.3, 2.2)을 함께 깎는다.

## A-5. UX 휴리스틱의 위치 (2026-09-21 확정)
* **점수·체크리스트는 템플릿만.** 감점, 디자이너 항목, 개발자 항목은 반드시 템플릿 하위 항목(`section_ref`, 예 "§8.3 데이터")을 근거로 한다. §7.3·§8.3 의 "8대 고민 항목"은 템플릿 원문 그대로 쓰고 NN 원칙 이름을 붙이지 않는다.
* **휴리스틱은 UX 제안에만.** Nielsen 10 · Fitts · Hick · Fogg · Jakob · 접근성에 근거한 관찰은 전부 `ux_recommendations` 로 보낸다. 원칙 태그는 거기서만 쓴다. 점수·체크리스트에 영향을 주지 않는다.
* 빈 상태·로딩·에러처럼 템플릿 고민 항목과 휴리스틱이 겹치는 주제는 "템플릿 문구로 표현되는 누락"만 점수·체크리스트에 올리고, 품질 판단은 제안으로 보낸다.

## A-6. 호출 구조 (2026-09-21, 분석 시간 단축)
* **두 호출 병렬**: A 구조(섹션 커버리지·Actor·시나리오·교차 검증·요약·목업 지시, 기본 모델) + B 체크리스트(디자이너·개발자·PO 질문·UX 제안, 빠른 모델 `ANTHROPIC_FAST_MODEL` → Haiku 4.5 → 기본 모델). 서버가 합쳐 채점한다. B 가 실패해도 A 로 점수는 낸다.
* **출력 다이어트**: 인용 80자, 목록당 3~5개, 문장 60자, 충족 항목은 `missing` 생략. 심각도 집계·미정의 Actor 질문 보강은 서버가 한다.
* **프롬프트 캐싱**: 시스템 프롬프트를 cache_control 블록으로 보낸다.

## A-7. 출력
`section_coverage[]` · `hard_gates[]` · `actors{defined, detected_undefined}` · `scenarios{}` · `cross_reference_issues[]` 를 추가로 담는다. `validated` · `missing_for_designers` · `missing_for_developers` · `critical_questions` · `ux_recommendations` · `mockup_directives` 는 v2 와 형식이 같다. `criteria` · `project_type` · `applied_weights` 는 출력하지 않는다.

---

# §B. 기본 프로토콜 — "그 외" 선택 시 (v2.0 — v1.2 계승)

> 아래 v1.2 문서는 팀 템플릿이 없는 문서(그 외)를 분석하는 원칙이다. 실제 v2.0 프롬프트(6차원·프로젝트 타입 가중치)는 `src/app/api/analyze/route.ts` 를 따른다. Commerce Core 전용 템플릿이 준비되면 §A 와 같은 방식으로 상수를 추가한다.

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