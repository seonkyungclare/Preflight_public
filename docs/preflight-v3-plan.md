# Preflight v3.0 계획서 — Partner Growth PRD 템플릿 기준 검증

> 작성일: 2026-09-21
> 기준 문서: [\[Template\] \[Partner Growth\] PRD](https://wiki.team.musinsa.com/wiki/spaces/PGT/pages/652153933) (PGT 스페이스, 2026-09-20 최종 수정)
> 현재 상태: v2.0 (6개 UX 차원 × 프로젝트 타입별 가중치, `src/app/api/analyze/route.ts`)

---

## 1. 왜 바꾸는가

| 항목 | v2.0 (현재) | v3.0 (목표) |
| :--- | :--- | :--- |
| 채점 기준 | UX 휴리스틱 6차원 (구조·상태·에러·인터랙션·위계·Fogg) | **PGT PRD 템플릿 11개 섹션의 존재·완결성** |
| 점수 방식 | 차원별 1~10점 × 프로젝트 타입 가중치 → 가산 | **100점에서 누락 항목마다 감점** |
| 분기 기준 | 모델이 PRD를 읽고 프로젝트 타입(transaction/management/discovery/onboarding) 자동 판별 | **사용자가 분석 전에 팀 템플릿을 선택**: Partner Growth / Commerce Core |
| Commerce Core 처리 | (구분 없음) | 기존 v2 프로토콜을 그대로 사용. 아래 §1-1 |
| Actor | 명시적 평가 없음 | **독립 섹션. 유형별 정의 필수** (MD / 파트너 / 대행사 / 운영자 …) |
| 유저 시나리오 | 구조_플로우 차원 안에서 간접 평가 | **하드 게이트.** 없으면 Ready 불가 |
| 점수 계산 주체 | 모델이 직접 합산 | **모델은 판정만, 서버 코드가 계산** (재현성) |
| UX 휴리스틱 | 점수의 본체 | §7·§8 안의 **품질 검사 + UX 제안의 근거**로 역할 이동 |

핵심 원칙 하나로 요약하면: **"템플릿에 있어야 할 것이 없으면 깎는다. 있으면 그 품질을 본다."**

### 1-1. 팀 템플릿 분기

업로드 화면에서 **Confluence URL을 넣기 전에** 어느 팀 템플릿으로 검증할지 고른다. 선택지는 둘이다.

| 선택지 | 적용 프로토콜 | 기준 문서 | 결과 화면 |
| :--- | :--- | :--- | :--- |
| **Partner Growth** | v3.0 (이 계획서) | PGT PRD 템플릿 (652153933) | 섹션 커버리지 · Actor · 시나리오 · 교차 검증 |
| **Commerce Core** | v2.0 (현행 유지) | Commerce Core PRD 템플릿 (7. 유저 스토리 / 8-2. Functional Spec 구조) | 현행 6차원 뷰 그대로 |

동작 규칙
- 선택은 **필수**다. 미선택 상태에서는 URL 입력·파일 업로드 영역을 비활성화한다. 기본값을 두지 않는 이유는 잘못된 템플릿으로 채점된 결과가 그대로 공유되는 사고를 막기 위해서다.
- 선택은 파일 업로드 탭에도 동일하게 적용된다. 분석 API는 입력 경로와 무관하게 템플릿을 알아야 하기 때문이다.
- 마지막 선택은 브라우저(localStorage)에 기억해 다음 방문 때 미리 선택해 둔다. 그래도 사용자가 눈으로 확인하고 지나가도록 선택 UI는 항상 노출한다.
- `/api/analyze` 요청 본문에 `template: "partner-growth" | "commerce-core"`를 추가한다. 값이 없거나 모르는 값이면 400.
- 결과 JSON에는 `template`과 `protocol_version`이 함께 실린다. 결과 화면과 히스토리는 이 두 값으로 렌더러를 고른다.
- 히스토리 항목에도 `template`을 저장한다. 값이 없는 과거 항목은 Commerce Core(v2)로 간주한다.
- 결과 화면 상단 파일명 옆에 선택한 템플릿 배지를 표시해, 무엇을 기준으로 채점됐는지 항상 보이게 한다.

Commerce Core 쪽은 이번 범위에서 **코드 변경 없음**이다. 추후 Commerce Core 템플릿도 섹션 기반 감점제로 바꾸고 싶다면, P0에서 만드는 템플릿 상수 구조에 두 번째 항목을 추가하는 방식으로 확장한다.

---

## 2. 섹션 커버리지 모델 (감점 예산)

템플릿 목차 그대로 11개 섹션을 두고, 필수 섹션에만 감점 예산을 배분한다. 합계 100.

| # | 섹션 | 템플릿 필수 여부 | 감점 상한 | 판정 단위 (하위 항목) |
| :-- | :--- | :--- | :--: | :--- |
| 0 | Intro | 필수 | **3** | 담당자 R&R 표 · 주요 링크(2-Pager/Figma 등) · 마일스톤 |
| 1 | Business Impact & Scope | KTLO 아닌 이상 필수 | **7** | 2-Pager 링크 · In Scope · **Out of Scope + 제외 이유** |
| 2 | 용어 정의 | 필수 | **5** | 용어 표 존재 · 본문 도메인 용어가 표에 있는가 |
| 3 | **Actor & 권한 체계** | 필수 | **20** | 아래 §3 상세 |
| 4 | IA (As-Is / To-Be) | 필수 | **8** | 전체 메뉴 트리 · 변경 유형(신설/이동/명칭변경/삭제/변경없음) · **Actor별 노출** |
| 5 | **유저 시나리오** | **필수 (굵게)** | **20** | 아래 §4 상세 |
| 6 | Workflow | **필수 (굵게)** | **7** | 변경되는 Workflow의 As-Is · To-Be · 시나리오 참조 |
| 7 | 시스템 요구사항 | **필수 (굵게, 가장 중요)** | **15** | 넘버링된 정책 · 상태 전이표 · **8대 고민 항목** 반영 |
| 8 | 화면 요구사항 | 필수 | **15** | 화면 ID · 관련 Actor · 진입 경로 · 유저 시나리오 · 상세 요구사항 · 8대 고민 항목 |
| 9 | 데이터·연동·마이그레이션 | 해당 시 | 조건부 −5 | 연동 규격 · 실패 처리(재시도/롤백/**알람 경로**) · 이벤트 규격 · 마이그레이션 절차 |
| 10 | 오픈 이슈 | 해당 시 | 조건부 −2 | 미결 사유 · 결정 DFD/ETA |

**판정 3단계**: `present`(감점 0) / `partial`(하위 항목 비율로 감점) / `missing`(상한 전액 감점).
`present`·`partial`은 PRD 원문 인용(`evidence`)이 반드시 붙는다.

**조건부 섹션 규칙**
- §1: PRD가 KTLO를 명시하면 `not_applicable`, 감점 없음.
- §9: 본문에 연동·배치·외부 시스템·마이그레이션·이관 언급이 있는데 §9가 없으면 −5. 언급 자체가 없으면 `not_applicable`.
- §10: 본문에 "미정", "협의 필요", "TBD", "검토 중"이 있는데 §10이 없으면 −2.
- 조건부 감점은 100점 예산 밖에서 추가로 깎되, 최종 점수는 0 미만으로 내려가지 않는다.

**하드 게이트 (점수 상한)**

| 게이트 | 조건 | 상한 |
| :--- | :--- | :--: |
| G1 유저 시나리오 부재 | §5 `missing` | **59** (Rewrite) |
| G2 Actor 부재 | §3.1 Actor 정의 표 없음 | **59** (Rewrite) |
| G3 Actor 미정의 | 본문에 등장하는 Actor 중 §3.1에 없는 유형이 1개 이상 | **79** (Refine) |
| G4 화면 요구사항 부재 | §8 `missing` | **69** |

게이트가 걸리면 결과 화면 최상단에 "왜 이 점수 위로 못 올라가는가"를 한 줄로 표시한다.

**점수 해석 구간은 유지**: 80~100 Ready / 60~79 Refine / 0~59 Rewrite.

---

## 3. §3 Actor & 권한 체계 — 20점 상세

사용자 요구: *"MD, 파트너처럼 다른 유형의 Actor가 있으면 각각 정의되어야 한다."*

| 하위 항목 | 배점 | 판정 방법 |
| :--- | :--: | :--- |
| 3.1-a **Actor 목록 완전성** | 8 | 모델이 PRD 전체(시나리오·Workflow·화면·정책표의 "주체" 열)에서 Actor를 추출 → §3.1 표와 대조. 미정의 Actor 1개당 −3 (상한 8) |
| 3.1-b **Actor별 정의 깊이** | 4 | Actor마다 `정의` · `진입 경로` · `권한 범위` 3필드. 필드 1개 누락당 −1 (상한 4) |
| 3.2 **권한 매트릭스** | 4 | 기능 × Actor 표에 C/R/U/D/승인 표기. 표 없음 −4, 기능 일부 누락 −2 |
| 3.3 **데이터 접근 범위** | 2 | Actor 상태별 조회 가능/수정 가능 표 |
| 3.4 **권한 없는 사용자 진입 처리** | 2 | "권한 없이 진입하면 어떻게 되는가" 명시 |

**Actor 추출 힌트 (프롬프트에 포함)**
템플릿 기준 Actor 축: 파트너 / 대행사 / 내부 운영 · 사업 · 개발 / 외부 매체 / 시스템(자동 처리 주체).
같은 "내부"라도 MD · 운영 심사자 · HO처럼 권한이 다르면 별도 Actor로 본다.
"시스템"이 상태를 바꾸는 주체로 등장하면 Actor 표에 있어야 한다.

결과 JSON에는 `actors.defined[]`와 `actors.detected_undefined[]`를 분리해 담고, 후자는 그대로 PO 질문(`[비즈니스]` 태그)으로 승격한다.

---

## 4. §5 유저 시나리오 — 20점 상세

사용자 요구: *"유저 시나리오는 반드시 있어야 한다."*

| 하위 항목 | 배점 | 판정 방법 |
| :--- | :--: | :--- |
| 5.1 **전체 시나리오 맵** | 6 | `S-nnn` ID · Actor · 한 줄 시나리오 · 관련 Feature · 우선순위. "누가 무엇을 할 수 있다" 형식(기능 나열이면 partial). **§3의 모든 Actor가 시나리오 1개 이상 보유** (없는 Actor당 −1) |
| 5.2 **Milestone 정의** | 4 | ✅/◐/— 표 · 마일스톤 열에 시점 · ◐는 "어디까지" 문장 |
| 5.3 **이번 도달선** | 4 | 종료 시점 상태 3~5문장 · 미지원 항목 표(안 하는 이유·대체 수단·안내 주체·해소 시점) |
| 5.4 **시나리오 상세** | 6 | ✅·◐ 시나리오마다 `[진입]` `[본 흐름]` `[예외]` · 본 흐름이 `SC-nn` 화면 참조 · 예외 1개 이상 |

**교차 검증 (여기서 Preflight가 체크리스트 이상의 가치를 낸다)**

| 검사 | 근거 섹션 | 실패 시 |
| :--- | :--- | :--- |
| 정의된 Actor ↔ 시나리오 보유 | §3.1 ↔ §5.1 | 5.1 감점 + PO 질문 |
| 시나리오의 Actor ↔ 정의 여부 | §5.1 ↔ §3.1 | 3.1-a 감점 + 게이트 G3 |
| 시나리오 상세 `SC-nn` ↔ 화면 ID 존재 | §5.4 ↔ §8 | 8 partial + 개발자 체크리스트 |
| 화면의 `유저 시나리오` 열 ↔ `S-nnn` 존재 | §8 ↔ §5.1 | 8 partial |
| IA 신설 메뉴 ↔ 화면 존재 | §4 ↔ §8 | 8 partial + 디자이너 체크리스트 |
| Workflow ↔ 시나리오 참조 | §6 ↔ §5 | 6 partial |
| 본문 도메인 용어 ↔ 용어 표 | 본문 ↔ §2 | 2 partial |

교차 검증 결과는 `cross_reference_issues[]`로 별도 출력하고, 결과 화면에서 독립 카드로 보여준다.

---

## 5. UX 휴리스틱의 새 위치

v2의 6차원은 사라지지 않고 두 곳으로 이동한다.

1. **§7·§8 품질 검사**: 템플릿의 "8대 고민 항목"을 NN 휴리스틱과 1:1로 대응시켜 `partial` 판정의 근거로 쓴다.

| 템플릿 고민 항목 | 대응 원칙 |
| :--- | :--- |
| 데이터: 없으면? 대량이면? 중복이면? | 빈 상태 · 페이징 (NN#1) |
| 표시: 텍스트 길면? 숫자 표기? 0과 미입력 구분? | 정보 위계 · 말줄임 |
| 네트워크: 실패·지연? 재시도? | 로딩 · 에러 복구 (NN#1, #9) |
| 외부 연계: 실패? 절반 처리? 누가 인지? | 롤백 · 알람 경로 |
| 권한: 권한 없이 진입? 세션 만료? | 접근 차단 화면 (§3.4 연동) |
| 입력: 필수값 누락? 형식 오류? 극단값? | 에러 예방 (NN#5) |
| 상태: 중복 처리? 동시 작업 충돌? 작성 중 이탈? | 확인 다이얼로그 · 낙관적 잠금 |
| 시간: 기한 만료? 마감 전후? 처리 중 원본 변경? | 상태 전이표 완결성 |

§7·§8 각각 15점 중 **8점은 항목 존재, 7점은 8대 고민 항목 반영도**로 나눈다.

2. **UX 제안(`ux_recommendations`)의 이론 근거**: Fogg · Fitts · Hick · Jakob은 점수와 무관한 제안 영역에서만 쓴다.

---

## 6. 출력 스키마 v3 (변경점만)

```jsonc
{
  "protocol_version": "3.0",
  "template_ref": "PGT-PRD/652153933@2026-09-20",
  "sufficiency_score": 0,            // 서버 계산값 (모델 값은 무시)
  "is_sufficient": false,
  "hard_gates": [{ "id": "G1", "triggered": true, "cap": 59, "reason": "..." }],
  "section_coverage": [
    {
      "section_id": "3", "title": "Actor & 권한 체계",
      "required": "required" | "conditional" | "not_applicable",
      "status": "present" | "partial" | "missing" | "not_applicable",
      "max_deduction": 20, "deduction": 11,
      "evidence": "PRD 원문 인용",
      "sub_items": [{ "id": "3.1-a", "label": "...", "status": "...", "deduction": 6, "missing": ["대행사", "시스템"] }]
    }
  ],
  "actors": {
    "defined": [{ "name": "파트너 PO", "definition": "...", "entry_path": "...", "permission_scope": "...", "completeness": 3 }],
    "detected_undefined": [{ "name": "담당 MD", "where": "§7 상태표 '주체' 열", "quote": "..." }]
  },
  "scenarios": {
    "map_count": 6, "milestone_defined": true, "detail_count": 1,
    "actors_without_scenario": ["대행사"],
    "scenarios_without_screen_ref": ["S-002"]
  },
  "cross_reference_issues": [{ "check": "scenario_screen_ref", "detail": "S-003 본 흐름의 SC-12가 §8에 없음", "severity": 3 }],

  // 유지 (형식 동일)
  "validated": [], "missing_for_designers": [], "missing_for_developers": [],
  "critical_questions": [], "ux_recommendations": [], "severity_summary": {},
  "mockup_directives": { /* critical_screens는 §8 화면 ID + §5.4 SC 참조에서 도출 */ }
}
```

- `template: "partner-growth"`가 함께 실린다. Commerce Core 결과는 `template: "commerce-core"`, `protocol_version: "2.0"`으로 현행 v2 스키마 그대로 나간다.
- `criteria`, `project_type`, `applied_weights`는 Partner Growth(v3)에서 출력하지 않는다.
- 히스토리(IndexedDB)에 남아 있는 v1/v2 결과는 `template` 부재로 Commerce Core로 간주하고 기존 렌더러로 표시한다.

**점수 계산은 서버가 한다** (`src/lib/scoring.ts` 신설)
```
raw = 100 − Σ section.deduction(필수 섹션) − Σ conditional_penalty
capped = min(raw, min(triggered gate caps))
score = max(0, capped)
```
모델이 낸 `deduction`이 `max_deduction`을 넘으면 서버가 상한으로 자른다. 모델의 `sufficiency_score`는 로그로만 남긴다.

---

## 7. 구현 단계

| 단계 | 산출물 | 대상 파일 | 비고 |
| :-- | :--- | :--- | :--- |
| **P0 템플릿 스냅샷** | 섹션·하위 항목·배점·필수 여부·감지 힌트를 코드 상수로 | `src/config/prd-template.ts` (신설) | 프롬프트와 채점기가 이 하나를 참조. 템플릿이 바뀌면 여기만 수정 |
| **P0.5 팀 선택 UI** | 업로드 화면 최상단에 Partner Growth / Commerce Core 선택. 미선택 시 입력 비활성화, 마지막 선택 기억 | `src/components/UploadScreen.tsx`, `src/app/page.tsx` (`template` 상태·요청 본문), `src/lib/analysis-history.ts` (`template` 필드) | Commerce Core 선택 시 현행 흐름과 완전히 동일 |
| **P1 분석 API v3** | `template`으로 분기. Partner Growth는 템플릿 상수에서 시스템 프롬프트 생성 + tool 스키마 v3 + 서버 채점. Commerce Core는 기존 v2 프롬프트·스키마 유지 | `src/app/api/analyze/route.ts`, `src/lib/scoring.ts` (신설) | v2 프롬프트는 `commerce-core` 경로로 남는다. 모델 fallback 로직은 공용 |
| **P2 결과 화면 v3** | `template`으로 렌더러 분기. Partner Growth 요약 탭은 "섹션 커버리지 표(목차 순) + 게이트 배너 + Actor 카드 + 시나리오 카드 + 교차 검증 카드". 파일명 옆 템플릿 배지 | `src/components/ResultScreen.tsx`, `src/app/page.tsx` 타입 | 디자이너/개발자/PO 질문/UX 제안 탭은 두 템플릿 공용. `ScoreGauge` 유지 |
| **P3 목업 연동** | `critical_screens`를 §8 화면 ID 기준으로, Actor별 LNB 노출을 §4 IA 기준으로 | `src/app/api/mockup/route.ts` (spec 추출 프롬프트 일부) | v3 필드가 없으면 기존 동작 |
| **P4 문서** | 프로토콜 v3 반영, Partner Growth 시나리오 작성 가이드 신설, 릴리스 노트 | `CLAUDE.md`(v2·v3 두 프로토콜 병기), `docs/pg-scenario-writing-guide.md` (신설, §5 형식), `src/config/release-notes.ts`, `README.md` | 기존 `docs/user-story-writing-guide.md`는 Commerce Core용으로 그대로 둔다 |
| **P5 검증** | dev 페이지 목 데이터 v3, 실제 PGT PRD 2~3건으로 점수 분포 확인. Commerce Core 경로는 기존 PRD 1건으로 회귀 확인 | `src/app/dev/page.tsx` | 빈 템플릿(가이드만) → 0~20점대, 예시 채운 템플릿 → 50~70점대가 나오는지로 캘리브레이션 |

P0 → P0.5 → P1 → P2는 순차. P3·P4는 P1 이후 병렬 가능.

---

## 8. 결정 사항 (2026-09-21 확정)

PO 위임("모두 최적을 알아서 선택")에 따라 아래로 확정하고 구현했다.

| # | 항목 | 결정 | 근거 |
| :-- | :--- | :--- | :--- |
| 1 | 배점표 | §2 원안 그대로 (Actor 20 / 시나리오 20 / 시스템 15 / 화면 15 / IA 8 / Scope 7 / Workflow 7 / 용어 5 / Intro 3) | 이번 요구가 Actor·시나리오 강조. §7은 15점이지만 하위 8대 고민 항목이 §8에도 반복되어 실질 비중은 크다 |
| 2 | 하드 게이트 | G1·G2 = 59, G3 = 79, G4 = 69 유지 | "없으면 Ready 불가"를 점수로 강제하는 가장 단순한 장치. 상한은 `prd-template.ts` 상수로 조정 가능 |
| 3 | 조건부 §9·§10 | 예산 밖 추가 감점 (−5 / −2). 해당 없으면 0 | 필수 예산 100을 유지해 점수 해석이 흔들리지 않게 함 |
| 4 | v1/v2 히스토리 | 읽기 전용 호환 유지. `template` 없는 항목은 Commerce Core로 간주 | IndexedDB 마이그레이션 비용 없이 과거 결과 열람 가능 |
| 5 | 템플릿 추적 | `PGT_TEMPLATE.ref = "PGT-PRD/652153933@2026-09-20"` 수동 관리 | 템플릿이 아직 변동 중. 자동 diff는 안정화 후 |
| 6 | PGT 외 팀 PRD | 분석 전 팀 템플릿 선택으로 분기. Partner Growth = v3, Commerce Core = v2 | §1-1 |
| 7 | 선택 UI 문구 | ~~라벨 + 설명 + 버전 배지 + 링크~~ → **PO 지시(09-21)로 라벨만.** 선택지는 Partner Growth / Commerce Core(비활성) / 그 외 3개. "그 외"가 기존 v2 규칙 | 화면을 단순하게. Commerce Core 는 전용 템플릿이 준비될 때까지 선택 불가 |

**구현 위치 요약**

| 대상 | 파일 |
| :--- | :--- |
| 템플릿 상수·배점·게이트 | `src/config/prd-template.ts` |
| v3 시스템 프롬프트·tool 스키마 | `src/lib/analyze-v3.ts` |
| 서버 채점·타입 | `src/lib/scoring.ts` |
| 분기 API | `src/app/api/analyze/route.ts` (`template` 필수, 400) |
| 팀 선택 UI | `src/components/UploadScreen.tsx` (localStorage `preflight_template`) |
| v3 결과 뷰 | `src/components/ResultV3Summary.tsx`, `src/components/ResultScreen.tsx` (템플릿 배지) |
| 히스토리 | `src/lib/analysis-history.ts` (`template?`) |
| 목업 연동 | `src/app/api/mockup/route.ts` (v3 Actor·시나리오 힌트) |
| 문서 | `CLAUDE.md` §A, `docs/pg-scenario-writing-guide.md`, `src/config/release-notes.ts` |
| dev 미리보기 | `/dev` (v3 PG / v2 CC 토글) |

**검증 기록 (2026-09-21)**
- 템플릿 예시(S-001~S-005, 상태 전이표, SC-11/12/01)로 만든 샘플 PRD(Actor 표에 파트너 PO·운영 심사자 2종만 정의) 실제 분석 → **42점**, G3 발동(담당 MD·HO·시스템 미정의), 교차 검증 10건, PO 질문 7건. 미정의 Actor 3종 모두 [비즈니스] 질문으로 승격됨.
- 모델은 섹션 ID를 `§0` 형태로 보낸다 → 채점기가 숫자만 추출해 매칭하도록 보정.
- 미정의 Actor 감점이 상한(8)에 닿아도 "표 없음"(G2)으로 보지 않도록 G2 조건을 `정의된 Actor 0명`으로 변경.
- 회귀: Actor 표 부재 → G2, 시나리오 부재 → G1(상한 59), 전 항목 충족 → 100점 확인.

**추가 결정 (2026-09-21 오후)**
- UX 휴리스틱(NN·Fitts·Hick·Fogg·Jakob·접근성)은 점수·체크리스트에서 완전히 분리해 UX 제안 탭으로만 보낸다. 디자이너·개발자 항목은 `section_ref` 로 템플릿 근거를 명시한다. §5 "UX 휴리스틱의 새 위치" 중 "§7.3·§8.3 판정 근거로 쓴다" 부분은 폐기 — 8대 고민 항목은 템플릿 원문으로만 판정한다.

**남은 후속 (이번 범위 밖)**
- 실제 PGT PRD 2~3건으로 점수 분포 캘리브레이션 (P5). 빈 템플릿 0~20점대, 예시 채운 템플릿 50~70점대가 목표.
- 분석 소요 시간이 약 200초로 길다. `max_tokens`·프롬프트 길이 조정 또는 프롬프트 캐싱 적용 검토.
- Commerce Core 템플릿 링크 확보 시 `TEMPLATE_OPTIONS` 에 `referenceUrl` 추가.
- Hi-Fi 목업에서 Actor별 LNB 노출 분기 (현재는 프롬프트 힌트만 전달).

---

## 9. 범위 밖 (이번에 하지 않음)

- 성과 목표 · Success Criteria 평가 (템플릿이 2-Pager로 분리)
- Sanity Test · Launch Plan 평가 (TC · Launch Gate WBS에서 관리)
- Confluence 템플릿 페이지 자체를 자동 파싱해 배점표를 생성하는 것 (P0는 수동 스냅샷)
