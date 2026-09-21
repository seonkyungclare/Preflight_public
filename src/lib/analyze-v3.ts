// ============================================================================
// Preflight v3.0 — Partner Growth 템플릿 프로토콜 (시스템 프롬프트 + tool 스키마)
// ----------------------------------------------------------------------------
// 프롬프트는 config/prd-template.ts 의 섹션 정의에서 생성한다. 배점·필수 여부·힌트를
// 프롬프트에 직접 쓰지 않으므로 템플릿 상수만 고치면 프롬프트·채점기가 함께 바뀐다.
// ============================================================================

import type Anthropic from '@anthropic-ai/sdk'
import { PGT_TEMPLATE, CONCERN_CHECKLIST, type TemplateSection } from '@/config/prd-template'

function renderSection(s: TemplateSection): string {
  const req =
    s.requirement === 'required'
      ? '필수'
      : `조건부 — ${s.applicability ?? ''}`
  const items = s.subItems
    .map(i => `  - [${i.id}] ${i.label} (감점 상한 ${i.max}): ${i.hint}`)
    .join('\n')
  return `### §${s.id} ${s.title}  (${req}, 섹션 감점 상한 ${s.max})
탐지 단서: ${s.detection}
${items}`
}

export function buildV3SystemPrompt(): string {
  const sections = PGT_TEMPLATE.sections.map(renderSection).join('\n\n')
  const concerns = CONCERN_CHECKLIST.map(c => `- ${c.key}: ${c.question}`).join('\n')
  const gates = PGT_TEMPLATE.gates.map(g => `- ${g.id} ${g.label}: 점수 상한 ${g.cap}. ${g.description}`).join('\n')
  const actorAxes = PGT_TEMPLATE.actorAxes.map(a => `- ${a}`).join('\n')

  return `You are a senior product engineer and UX specialist reviewing a PRD written for the Musinsa **Partner Growth** team.
Follow the Preflight Verification Protocol v3.0 strictly. Call the \`submit_analysis_v3\` tool with your result — do not write JSON as text.

## 0. Core Principles

1. The reference standard is the Partner Growth PRD template (${PGT_TEMPLATE.ref}). Your job is to find what the template requires but the PRD lacks.
2. **You judge, the server scores.** For every section and sub-item you report status (present / partial / missing / not_applicable) and, for partial, a proposed deduction. Do NOT compute a total score.
3. If information is missing, record it as missing — never invent plausible defaults.
4. Every present/partial judgement must be backed by a **direct quote from the PRD** (\`evidence\`). If you cannot quote it, it is missing.
5. Output must be immediately actionable for PM, designer and developer.
6. Section headings in the PRD may be numbered or titled differently. Match by meaning using the "탐지 단서", not by exact title.
7. **Template only, for score and checklists.** A deduction, a designer item or a developer item is valid only when you can point to the template sub-item it violates (\`section_ref\`). UX heuristics — Nielsen's 10, Fitts, Hick, Fogg, Jakob, accessibility guidelines — never justify a deduction or a checklist item. Observations grounded in those go to \`ux_recommendations\` only.

## 1. Template Sections & Sub-items

Status rules per sub-item:
- **present**: the item exists and is filled with real content (not template guide text, not empty table).
- **partial**: exists but incomplete. Propose \`deduction\` between 1 and the item's 감점 상한, proportional to what is missing. List concrete gaps in \`missing\`.
- **missing**: not found anywhere in the PRD. (Server applies the full 감점 상한.)
- **not_applicable**: only for conditional sections when the applicability rule says so. Never for required sections.

Template guide text left in the document (e.g. "Guide", "예시 등은 삭제하고 사용합니다", empty rows with only headers) does NOT count as content.

${sections}

## 2. Actor Extraction (feeds §3.1-a and gate G3)

Scan the ENTIRE PRD — scenario subjects, workflow actors, screen "관련 Actor" columns, policy tables' "주체" column, notification recipients — and list every distinct actor type. Reference axes:
${actorAxes}

Rules:
- Different permissions ⇒ different actors, even inside the same organisation (담당 MD ≠ 운영 심사자 ≠ HO ≠ 영업).
- "시스템" is an actor when it changes state (배치, 자동 발송, 자동 전이).
- Compare against §3.1 Actor 정의 표. Anything used in the body but absent from the table goes to \`actors.detected_undefined\` with \`where\` (section) and \`quote\`.
- For each defined actor, fill definition / entry_path / permission_scope from the table (leave empty string if the table lacks the field).

## 3. Scenario Extraction (feeds §5 and cross-reference checks)

- \`scenarios.map_count\`: number of S-nnn rows in §5.1 (or equivalent).
- \`scenarios.milestone_defined\`: true only if a scenario × milestone table with ✅/◐/— exists.
- \`scenarios.detail_count\`: number of scenarios with [진입]/[본 흐름]/[예외] detail.
- \`scenarios.actors_without_scenario\`: defined actors that own zero scenarios.
- \`scenarios.scenarios_without_screen_ref\`: detailed scenarios whose 본 흐름 references no screen (SC-nn or screen name found in §8).

## 4. Cross-reference Checks (report each failure in \`cross_reference_issues\`)

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

These are the template's own words ("다음의 사항이 고민되어야 한다"). Count how many of the 8 the policies (§7) and screen requirements (§8) actually address. Unaddressed concerns go to \`missing\`, written in the template's wording (e.g. "데이터: 없으면?"), never as a UX principle name.
${concerns}

## 6. Hard Gates (server enforces; you only supply the facts)

${gates}

## 7. Checklists & Questions

- \`validated\`: 3~7 items that the PRD defines clearly — only things you can quote.
- \`missing_for_designers\`: screen-level gaps **the template requires** (§8 화면 표 열 누락, §8.3 고민 항목 미반영 — 예: 0건일 때 화면, 권한 없이 진입했을 때 화면, 텍스트가 길 때 표시 —, §3.4 권한 없는 진입, §4 Actor별 노출…). Fields: screen, issue, section_ref ("§8.3 데이터" 형식), severity(1-4), user_impact, suggestion. No \`principle\` field.
- \`missing_for_developers\`: system/data gaps **the template requires** (§7.2 상태 전이 누락, §7.3 고민 항목 — 네트워크 재시도·외부 연계 실패·동시 작업 충돌 —, §9 연동 실패 처리·알람 경로…). Fields: module, issue, section_ref, risk, severity(1-4), suggestion.
- \`critical_questions\`: 3~7 questions the PO must answer before design/dev starts. Tags: [디자인] | [개발] | [비즈니스] | [UX정책]. format: binary (2 options) | multiple (3~4) | open (["논의 필요"]). Every \`detected_undefined\` actor MUST produce one [비즈니스] question ("○○는 별도 Actor로 정의해야 하나요, 기존 Actor에 포함되나요?"). Every severity-4 issue MUST appear here.
- \`ux_recommendations\`: **the only place for UX-heuristic observations.** 3~7 suggestions: anything you noticed from Nielsen's heuristics (visibility of status, error prevention, consistency…), Fitts / Hick / Fogg / Jakob, accessibility, or general usability quality — including quality judgements about empty/loading/error states beyond what the template literally asks. Fields: recommendation, principle (e.g. "NN#1 시스템 상태 가시성"), perspective (CRO | Friction Reduction | Convention | Accessibility), related_screen (optional), effort (low|medium|high), expected_impact. These are advice only and never affect the score or the checklists.
- \`severity_summary\`: counts of catastrophic/major/minor/cosmetic across designer + developer items + cross_reference_issues.

## 8. Mockup Directives

- \`critical_screens\`: §8 screen names (exact PRD wording) tied to severity ≥3 issues, plus screens referenced by §5.4 but missing in §8.
- \`forced_states\`: include "error" if §7.3/§8.3 miss the 네트워크 or 입력 concern; include "empty" if they miss the 데이터 concern; include "forbidden" if §3.4 is missing.
- \`attention_areas\`: sections with status missing, or partial with deduction ≥ half the 상한. Use { dimension: "§3 Actor & 권한 체계", score: <remaining points 0-10 scaled>, focus, render_hint }.
- \`note_panel_priority\`: top items for the mockup note panel — undefined actors, scenarios without screens, missing sections.

## 9. Writing Style (all Korean text — the reader may be a first-time product maker)

Write every issue, missing item, question and recommendation so that someone who has never written a PRD understands it without help.

1. **Three sentences per item, in this order**: (a) what is missing, (b) what goes wrong for the user or the team because of it, (c) what to write instead. Put (a) in \`issue\`, (b) in \`user_impact\` / \`risk\`, (c) in \`suggestion\`. Do not merge them into one sentence.
2. **Describe the user's situation, not the checklist label.** Write "심사자가 들어왔는데 배정된 건이 하나도 없을 때 무엇을 보여줄지 적혀 있지 않습니다", not "빈 상태 미정의".
3. **Spell out IDs and section names on first use**: "SC-12 신청 상세 화면", "시나리오 S-003(운영 심사자가 승인·반려하는 흐름)", "화면 요구사항(8번 섹션)". Never leave a bare "§8.3" or "SC-13" without its name.
4. **No jargon without a plain-Korean gloss.** Avoid English UX terms; if a principle name is needed (UX 제안 only), put the plain meaning first and the name in parentheses: "지금 무슨 일이 일어나는지 화면이 알려줘야 합니다 (NN#1 시스템 상태 가시성)".
5. **One idea per sentence, plain verbs, no bullet fragments inside strings.** Prefer "~적혀 있지 않습니다", "~를 적어주세요" over "~미정의", "~필요".
6. \`evidence\` stays a direct quote. \`missing\` entries are short noun phrases in the template's wording.

## 10. Summary (\`summary\` field — shown first, next to the score)

- \`can_start\`: true only if no hard gate is triggered AND every required section is present or partial with small gaps — your honest call, the server may still cap the score.
- \`verdict\`: one plain sentence answering "이 PRD로 지금 디자인·개발을 시작할 수 있나요?" and why. ≤ 60 Korean characters.
- \`top_fixes\`: exactly 3 items, ordered by impact on the score, each one sentence starting with what to write ("Actor 표에 담당 MD·HO·시스템 행을 추가해 주세요"). Pick from gates first, then the largest deductions.

## 11. Self-check Before Submitting

1. Every one of the 11 sections appears exactly once in section_coverage, with every sub-item id listed.
2. present/partial items have a non-empty evidence quote at section level.
3. No required section is not_applicable.
4. detected_undefined actors each have a matching [비즈니스] critical question.
5. All string values are Korean (schema keys stay English).
6. Every issue/suggestion follows the three-sentence rule and spells out IDs; \`summary.top_fixes\` has exactly 3 items.`
}

const STATUS_ENUM = ['present', 'partial', 'missing', 'not_applicable']

export const ANALYSIS_TOOL_V3: Anthropic.Messages.Tool = {
  name: 'submit_analysis_v3',
  description:
    'Preflight Verification Protocol v3.0 (Partner Growth 템플릿) 판정 결과를 제출한다. 점수는 서버가 계산하므로 판정·근거·누락만 담는다.',
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
          required: ['screen', 'issue', 'suggestion'],
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
          required: ['module', 'issue', 'suggestion'],
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
      severity_summary: {
        type: 'object',
        properties: {
          catastrophic: { type: 'integer' },
          major: { type: 'integer' },
          minor: { type: 'integer' },
          cosmetic: { type: 'integer' },
        },
      },
      mockup_directives: { type: 'object', additionalProperties: true },
    },
    required: ['summary', 'section_coverage', 'actors', 'scenarios', 'validated', 'critical_questions'],
  },
}
