// ============================================================================
// Preflight v3.0 — Partner Growth 템플릿 프로토콜 (시스템 프롬프트 + tool 스키마)
// ----------------------------------------------------------------------------
// 분석을 두 호출로 나눈다. 서버(analyze route)가 둘을 병렬로 보내고 합친다.
//   A. structure  — 섹션 커버리지·Actor·시나리오·교차 검증·요약·목업 지시 (점수 재료). 기본 모델
//   B. checklist  — 디자이너·개발자 체크리스트·PO 질문·UX 제안.               빠른 모델
// 출력 토큰이 분석 시간을 지배하므로 두 프롬프트 모두 "출력 다이어트" 규칙을 강제한다.
// 프롬프트는 config/prd-template.ts 의 섹션 정의에서 생성한다.
// ============================================================================

import type Anthropic from '@anthropic-ai/sdk'
import { PGT_TEMPLATE, CONCERN_CHECKLIST, type TemplateSection } from '@/config/prd-template'

function renderSection(s: TemplateSection): string {
  const req = s.requirement === 'required' ? '필수' : `조건부 — ${s.applicability ?? ''}`
  const items = s.subItems.map(i => `  - [${i.id}] ${i.label} (감점 상한 ${i.max}): ${i.hint}`).join('\n')
  return `### §${s.id} ${s.title}  (${req}, 섹션 감점 상한 ${s.max})
탐지 단서: ${s.detection}
${items}`
}

/** B 호출용 — 섹션·하위 항목 이름만 (판정 힌트 없음). section_ref 를 달기 위한 목차 */
function renderSectionIndex(s: TemplateSection): string {
  const items = s.subItems.map(i => `${i.id} ${i.label}`).join(' · ')
  return `- §${s.id} ${s.title}: ${items}`
}

const CONCERNS = CONCERN_CHECKLIST.map(c => `- ${c.key}: ${c.question}`).join('\n')
const ACTOR_AXES = PGT_TEMPLATE.actorAxes.map(a => `- ${a}`).join('\n')

const WRITING_STYLE = `## Writing Style (all Korean text — the reader may be a first-time product maker)

Write every issue, question and recommendation so that someone who has never written a PRD understands it without help.

1. **Three sentences per item, in this order**: (a) what is missing, (b) what goes wrong for the user or the team because of it, (c) what to write instead. Put (a) in \`issue\`, (b) in \`user_impact\` / \`risk\`, (c) in \`suggestion\`. Do not merge them into one sentence, and do not add a fourth.
2. **Describe the user's situation, not the checklist label.** Write "심사자가 들어왔는데 배정된 건이 하나도 없을 때 무엇을 보여줄지 적혀 있지 않습니다", not "빈 상태 미정의".
3. **Spell out IDs and section names on first use**: "SC-12 신청 상세 화면", "시나리오 S-003(운영 심사자가 승인·반려하는 흐름)", "화면 요구사항(8번 섹션)". Never leave a bare "§8.3" or "SC-13" without its name.
4. **No jargon without a plain-Korean gloss.** Avoid English UX terms; if a principle name is needed (UX 제안 only), put the plain meaning first and the name in parentheses: "지금 무슨 일이 일어나는지 화면이 알려줘야 합니다 (NN#1 시스템 상태 가시성)".
5. **One idea per sentence, plain verbs.** Prefer "~적혀 있지 않습니다", "~를 적어주세요" over "~미정의", "~필요".
6. **Be short.** Each sentence ≤ 60 Korean characters. Output length directly slows the analysis; say each thing once.`

const OUTPUT_DIET_COMMON = `## Output Budget (hard limits — the response is slow when it is long)

- Every string ≤ 120 Korean characters unless a rule below says otherwise.
- Never repeat the same gap in two places. If it is in \`missing\`, do not restate it in a checklist item.
- All string values in Korean; schema keys stay English. Return only via the tool call.`

// ─────────────────────────────────────────────────────────────────────────────
// A. Structure prompt — 점수 재료
// ─────────────────────────────────────────────────────────────────────────────

export function buildStructurePrompt(): string {
  const sections = PGT_TEMPLATE.sections.map(renderSection).join('\n\n')
  const gates = PGT_TEMPLATE.gates.map(g => `- ${g.id} ${g.label}: 점수 상한 ${g.cap}. ${g.description}`).join('\n')

  return `You are a senior product engineer reviewing a PRD written for the Musinsa **Partner Growth** team.
Follow the Preflight Verification Protocol v3.0 strictly. Call the \`submit_structure\` tool with your result — do not write JSON as text.

## 0. Core Principles

1. The reference standard is the Partner Growth PRD template (${PGT_TEMPLATE.ref}). Your job is to find what the template requires but the PRD lacks.
2. **You judge, the server scores.** For every section and sub-item you report status (present / partial / missing / not_applicable) and, for partial, a proposed deduction. Do NOT compute a total score.
3. If information is missing, record it as missing — never invent plausible defaults.
4. Every present/partial judgement must be backed by a **direct quote from the PRD** (\`evidence\`, ≤ 80 characters — cut with "…"). If you cannot quote it, it is missing.
5. Section headings in the PRD may be numbered or titled differently. Match by meaning using the "탐지 단서", not by exact title.
6. **Template only.** A deduction is valid only when it maps to a template sub-item. UX heuristics (Nielsen, Fitts, Hick, Fogg, Jakob, accessibility) never justify a deduction. Do not mention them anywhere in this output.

## 1. Template Sections & Sub-items

Status rules per sub-item:
- **present**: exists and is filled with real content (not template guide text, not an empty table). Omit \`missing\` for present items.
- **partial**: exists but incomplete. Propose \`deduction\` between 1 and the item's 감점 상한, proportional to what is missing. List the concrete gaps in \`missing\` — at most 5 short noun phrases (≤ 30 characters each) in the template's wording.
- **missing**: not found anywhere in the PRD. (Server applies the full 감점 상한.)
- **not_applicable**: only for conditional sections when the applicability rule says so. Never for required sections.

Template guide text left in the document (e.g. "Guide", "예시 등은 삭제하고 사용합니다", empty rows with only headers) does NOT count as content.

${sections}

## 2. Actor Extraction (feeds §3.1-a and gate G3)

Scan the ENTIRE PRD — scenario subjects, workflow actors, screen "관련 Actor" columns, policy tables' "주체" column, notification recipients — and list every distinct actor type. Reference axes:
${ACTOR_AXES}

Rules:
- Different permissions ⇒ different actors, even inside the same organisation (담당 MD ≠ 운영 심사자 ≠ HO ≠ 영업).
- "시스템" is an actor when it changes state (배치, 자동 발송, 자동 전이).
- Compare against §3.1 Actor 정의 표. Anything used in the body but absent from the table goes to \`actors.detected_undefined\` with \`where\` (section, ≤ 30 chars) and \`quote\` (≤ 60 chars).
- For each defined actor, fill definition / entry_path / permission_scope from the table, each ≤ 60 characters (empty string if the table lacks the field).

## 3. Scenario Extraction

- \`scenarios.map_count\`: number of S-nnn rows in §5.1 (or equivalent).
- \`scenarios.milestone_defined\`: true only if a scenario × milestone table with ✅/◐/— exists.
- \`scenarios.detail_count\`: number of scenarios with [진입]/[본 흐름]/[예외] detail.
- \`scenarios.actors_without_scenario\`: defined actors that own zero scenarios.
- \`scenarios.scenarios_without_screen_ref\`: detailed scenarios whose 본 흐름 references no screen (SC-nn or a screen name found in §8).

## 4. Cross-reference Checks (report each failure in \`cross_reference_issues\`, at most 8, one sentence each ≤ 100 chars)

| check id | rule |
|---|---|
| actor_without_scenario | §3.1 actor has no S-nnn in §5.1 |
| scenario_actor_undefined | §5.1 scenario subject not in §3.1 |
| scenario_screen_ref | §5.4 본 흐름 references SC-nn / screen that §8 does not define |
| screen_scenario_ref | §8 screen row's 유저 시나리오 column is empty or points to non-existent S-nnn |
| ia_screen_missing | §4 menu marked 신설/이동/명칭변경 has no §8 screen |
| workflow_scenario_ref | §6 workflow does not map to any §5 scenario |
| glossary_gap | domain term used ≥3 times in body but absent from §2 |

Severity: 1 cosmetic · 2 minor · 3 major (fix before build) · 4 catastrophic (cannot start).
These failures also lower the related sub-items (§5.1, §8.2, §6.3, §2.2).

## 5. 8대 고민 항목 (for §7.3 and §8.3)

These are the template's own words ("다음의 사항이 고민되어야 한다"). Count how many of the 8 the policies (§7) and screen requirements (§8) actually address. Unaddressed concerns go to \`missing\` in the template's wording (e.g. "데이터: 없으면?"), never as a UX principle name.
${CONCERNS}

## 6. Hard Gates (server enforces; you only supply the facts)

${gates}

## 7. Summary, Validated, Mockup Directives

- \`summary.can_start\`: true only if no gate is triggered AND every required section is present or partial with small gaps. The server may still cap it.
- \`summary.verdict\`: one plain sentence answering "이 PRD로 지금 디자인·개발을 시작할 수 있나요?" and why. ≤ 60 characters.
- \`summary.top_fixes\`: exactly 3 items, ordered by impact on the score, each one sentence (≤ 80 chars) starting with what to write ("Actor 표(3번 섹션)에 담당 MD·HO·시스템 행을 추가해 주세요"). Gates first, then the largest deductions. Spell out section numbers and IDs.
- \`validated\`: 3~5 things the PRD defines clearly, one short sentence each (≤ 60 chars) — only things you can quote.
- \`mockup_directives\`: \`critical_screens\` (≤ 5, exact §8 screen names tied to severity ≥3 issues or referenced by §5.4 but missing in §8) · \`forced_states\` (subset of "empty","error","forbidden": "error" if 네트워크/입력 concern missing, "empty" if 데이터 concern missing, "forbidden" if §3.4 missing) · \`attention_areas\` (≤ 3: { dimension: "§3 Actor & 권한 체계", score: remaining points scaled 0-10, focus ≤ 40 chars, render_hint ≤ 60 chars }) · \`note_panel_priority\` (≤ 5 short items).

${OUTPUT_DIET_COMMON}
- \`sub_items\`: list every sub-item id, but only partial/missing items carry \`missing\`; present items are just { id, status }.

## 8. Self-check Before Submitting

1. \`section_coverage\` is a JSON **array** of exactly 11 objects (one per section, in order §0…§10), each with \`section_id\` ("0"…"10"), \`status\`, \`evidence\`, and a \`sub_items\` **array** of objects with \`id\`. Never an object keyed by section id.
2. present/partial sections have a non-empty evidence quote.
3. No required section is not_applicable.
4. \`summary.top_fixes\` has exactly 3 items.
5. No UX principle names anywhere.`
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Checklist prompt — 디자이너·개발자·PO 질문·UX 제안
// ─────────────────────────────────────────────────────────────────────────────

export function buildChecklistPrompt(): string {
  const index = PGT_TEMPLATE.sections.map(renderSectionIndex).join('\n')

  return `You are a senior product designer and engineer reviewing a PRD written for the Musinsa **Partner Growth** team.
Your job in this call is ONLY the actionable lists: designer checklist, developer checklist, PO questions, UX suggestions. Another call scores the document — do not score, do not rate sections.
Call the \`submit_checklist\` tool with your result — do not write JSON as text.

## 0. Core Principles

1. The reference standard is the Partner Growth PRD template (${PGT_TEMPLATE.ref}). Its sections and sub-items:
${index}
2. If information is missing, say it is missing — never invent plausible defaults. Quote or point to the PRD when you can.
3. **Template only, for the two checklists.** A designer item or a developer item is valid only when you can name the template sub-item it violates (\`section_ref\`, e.g. "§8.3 데이터", "§3.4 권한 없는 진입", "§9.2 연동 실패 처리"). UX heuristics — Nielsen's 10, Fitts, Hick, Fogg, Jakob, accessibility — never justify a checklist item. Observations grounded in those go to \`ux_recommendations\` only.
4. The template's "다음의 사항이 고민되어야 한다" list for §7 and §8 — use its wording when writing section_ref gaps:
${CONCERNS}

## 1. Actors (for PO questions)

Scan the PRD for every distinct actor type (scenario subjects, workflow actors, screen "관련 Actor", policy "주체", notification recipients). Different permissions ⇒ different actors (담당 MD ≠ 운영 심사자 ≠ HO). "시스템" is an actor when it changes state. Reference axes:
${ACTOR_AXES}
Any actor used in the body but absent from the §3.1 Actor 정의 표 MUST produce one [비즈니스] question: "○○는 별도 Actor로 정의해야 하나요, 기존 Actor에 포함되나요?".

## 2. Lists

- \`missing_for_designers\` (**3~5 items, most severe first**): screen-level gaps the template requires — §8 화면 표 열 누락, §8.3 고민 항목 미반영 (0건일 때 화면, 권한 없이 진입했을 때 화면, 텍스트가 길 때 표시…), §3.4 권한 없는 진입, §4 Actor별 노출. Fields: screen (exact PRD wording, or "미정의: <what it should be>"), issue, section_ref, severity(1-4), user_impact, suggestion.
- \`missing_for_developers\` (**3~5 items, most severe first**): system/data gaps the template requires — §7.2 상태 전이 누락, §7.3 고민 항목 (네트워크 재시도·외부 연계 실패·동시 작업 충돌·기한 만료), §9 연동 실패 처리·알람 경로, §3.2 권한 매트릭스 빈칸. Fields: module, issue, section_ref, risk, severity(1-4), suggestion.
- \`critical_questions\` (**3~5 questions**): what the PO must answer before design/dev starts. Tags: [디자인] | [개발] | [비즈니스] | [UX정책]. format: binary (2 options) | multiple (3~4) | open (["논의 필요"]). Fields: tag, question (≤ 100 chars), format, options (each ≤ 40 chars), impact (≤ 60 chars), blocks (≤ 3 short items). Undefined-actor questions come first. Every severity-4 checklist item must be reflected here.
- \`ux_recommendations\` (**3~5 items**): the only place for UX-heuristic observations — visibility of status, error prevention, consistency, Fitts / Hick / Fogg / Jakob, accessibility, and quality judgements about empty/loading/error states beyond what the template literally asks. Fields: recommendation (≤ 120 chars, plain meaning first, principle name in parentheses at the end), principle (e.g. "NN#1 시스템 상태 가시성"), perspective (CRO | Friction Reduction | Convention | Accessibility), related_screen (optional), effort (low|medium|high), expected_impact (≤ 60 chars). Advice only — never affects the score.

Severity: 1 cosmetic · 2 minor · 3 major (fix before build) · 4 catastrophic (cannot start).

${WRITING_STYLE}

${OUTPUT_DIET_COMMON}
- Total across the four lists ≤ 20 items. Prefer fewer, sharper items.

## 3. Self-check Before Submitting

1. Every checklist item has a \`section_ref\` naming a real template sub-item; none cites a UX principle.
2. Every undefined actor has a [비즈니스] question.
3. issue / user_impact(risk) / suggestion are each one sentence, and no sentence exceeds 60 Korean characters.
4. List sizes are within the limits.`
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool schemas
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_ENUM = ['present', 'partial', 'missing', 'not_applicable']

export const STRUCTURE_TOOL_V3: Anthropic.Messages.Tool = {
  name: 'submit_structure',
  description:
    'Preflight v3.0 (Partner Growth) 구조 판정 — 섹션 커버리지·Actor·시나리오·교차 검증·요약·목업 지시. 점수는 서버가 계산한다.',
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'object',
        properties: {
          can_start: { type: 'boolean' },
          verdict: { type: 'string' },
          top_fixes: { type: 'array', items: { type: 'string' } },
        },
        required: ['can_start', 'verdict', 'top_fixes'],
      },
      section_coverage: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            section_id: { type: 'string' },
            status: { type: 'string', enum: STATUS_ENUM },
            evidence: { type: 'string' },
            sub_items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string', enum: STATUS_ENUM },
                  deduction: { type: 'integer' },
                  missing: { type: 'array', items: { type: 'string' } },
                },
                required: ['id', 'status'],
              },
            },
          },
          required: ['section_id', 'status', 'sub_items'],
        },
      },
      actors: {
        type: 'object',
        properties: {
          defined: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                definition: { type: 'string' },
                entry_path: { type: 'string' },
                permission_scope: { type: 'string' },
              },
              required: ['name'],
            },
          },
          detected_undefined: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                where: { type: 'string' },
                quote: { type: 'string' },
              },
              required: ['name'],
            },
          },
        },
        required: ['defined', 'detected_undefined'],
      },
      scenarios: {
        type: 'object',
        properties: {
          map_count: { type: 'integer' },
          milestone_defined: { type: 'boolean' },
          detail_count: { type: 'integer' },
          actors_without_scenario: { type: 'array', items: { type: 'string' } },
          scenarios_without_screen_ref: { type: 'array', items: { type: 'string' } },
        },
      },
      cross_reference_issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            check: { type: 'string' },
            detail: { type: 'string' },
            severity: { type: 'integer' },
          },
          required: ['check', 'detail', 'severity'],
        },
      },
      validated: { type: 'array', items: { type: 'string' } },
      mockup_directives: { type: 'object', additionalProperties: true },
    },
    required: ['summary', 'section_coverage', 'actors', 'scenarios', 'validated'],
  },
}

export const CHECKLIST_TOOL_V3: Anthropic.Messages.Tool = {
  name: 'submit_checklist',
  description:
    'Preflight v3.0 (Partner Growth) 실행 목록 — 디자이너·개발자 체크리스트, PO 질문, UX 제안. 점수와 무관.',
  input_schema: {
    type: 'object',
    properties: {
      missing_for_designers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            screen: { type: 'string' },
            issue: { type: 'string' },
            section_ref: { type: 'string' },
            severity: { type: 'integer' },
            user_impact: { type: 'string' },
            suggestion: { type: 'string' },
          },
          required: ['screen', 'issue', 'section_ref', 'suggestion'],
          additionalProperties: true,
        },
      },
      missing_for_developers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            module: { type: 'string' },
            issue: { type: 'string' },
            section_ref: { type: 'string' },
            risk: { type: 'string' },
            severity: { type: 'integer' },
            suggestion: { type: 'string' },
          },
          required: ['module', 'issue', 'section_ref', 'suggestion'],
          additionalProperties: true,
        },
      },
      critical_questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tag: { type: 'string' },
            question: { type: 'string' },
            format: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            impact: { type: 'string' },
            blocks: { type: 'array', items: { type: 'string' } },
          },
          required: ['tag', 'question'],
          additionalProperties: true,
        },
      },
      ux_recommendations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            recommendation: { type: 'string' },
            principle: { type: 'string' },
            perspective: { type: 'string' },
            related_screen: { type: 'string' },
            effort: { type: 'string' },
            expected_impact: { type: 'string' },
          },
          required: ['recommendation'],
          additionalProperties: true,
        },
      },
    },
    required: ['missing_for_designers', 'missing_for_developers', 'critical_questions', 'ux_recommendations'],
  },
}
