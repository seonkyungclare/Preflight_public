'use client'

// ============================================================================
// Preflight v3.0 (Partner Growth) 요약 뷰
// ----------------------------------------------------------------------------
// 템플릿 목차 순서로 섹션 커버리지를 보여주고, 게이트·Actor·시나리오·교차 검증을
// 독립 카드로 드러낸다. 점수는 서버가 확정한 값이므로 여기서는 계산하지 않는다.
// ============================================================================

import { useState } from 'react'
import type { AnalysisResult } from '@/app/page'
import type { CoverageStatus, SectionCoverage } from '@/lib/scoring'
import { Badge as AstryxBadge, type BadgeVariant } from '@astryxdesign/core/Badge'
import { Banner } from '@astryxdesign/core/Banner'
import { Card as AstryxCard } from '@astryxdesign/core/Card'

const STATUS_META: Record<CoverageStatus, { label: string; variant: BadgeVariant; bar: string }> = {
  present: { label: '충족', variant: 'success', bar: '#22c55e' },
  partial: { label: '부분', variant: 'warning', bar: '#f59e0b' },
  missing: { label: '누락', variant: 'error', bar: '#ef4444' },
  not_applicable: { label: '해당 없음', variant: 'neutral', bar: '#94a3b8' },
}

const SEVERITY_META: Record<number, { label: string; variant: BadgeVariant }> = {
  1: { label: 'Cosmetic', variant: 'neutral' },
  2: { label: 'Minor', variant: 'info' },
  3: { label: 'Major', variant: 'warning' },
  4: { label: 'Catastrophic', variant: 'error' },
}

const CHECK_LABELS: Record<string, string> = {
  actor_without_scenario: 'Actor 시나리오 미보유',
  scenario_actor_undefined: '시나리오 Actor 미정의',
  scenario_screen_ref: '시나리오·화면 참조 불일치',
  screen_scenario_ref: '화면·시나리오 참조 불일치',
  ia_screen_missing: 'IA 신설 메뉴 화면 누락',
  workflow_scenario_ref: 'Workflow·시나리오 미연결',
  glossary_gap: '용어 정의 누락',
}

function SectionRow({ section }: { section: SectionCoverage }) {
  const [open, setOpen] = useState(section.status === 'partial' || section.status === 'missing')
  const meta = STATUS_META[section.status]
  const remaining = section.max_deduction - section.deduction
  const ratio = section.max_deduction > 0 ? remaining / section.max_deduction : 1
  const gaps = section.sub_items.filter(i => i.status !== 'present' && i.status !== 'not_applicable')

  return (
    <AstryxCard padding={0}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left py-3.5 px-4 space-y-2"
        aria-expanded={open}
      >
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs text-muted-foreground shrink-0">§{section.section_id}</span>
            <span className="font-medium truncate">{section.title}</span>
            <AstryxBadge variant={meta.variant} label={meta.label} />
            {section.requirement === 'conditional' && (
              <span className="text-[10px] text-muted-foreground">조건부</span>
            )}
          </div>
          <span className={`font-bold shrink-0 ${section.deduction > 0 ? 'text-red-500' : 'text-green-600'}`}>
            {section.status === 'not_applicable'
              ? '-'
              : section.deduction > 0
                ? `−${section.deduction} / ${section.max_deduction}`
                : `0 / ${section.max_deduction}`}
          </span>
        </div>
        {section.status !== 'not_applicable' && (
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: meta.bar }} />
          </div>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 -mt-1 text-xs text-muted-foreground leading-relaxed space-y-2">
          {section.evidence && (
            <p>
              <span className="font-medium text-foreground/80">근거:</span> {section.evidence}
            </p>
          )}
          {gaps.length > 0 ? (
            <ul className="space-y-1.5">
              {gaps.map(item => (
                <li key={item.id} className="flex items-start gap-2">
                  <span className="font-mono shrink-0 mt-px">{item.id}</span>
                  <div className="min-w-0">
                    <span className="text-foreground/80">{item.label}</span>
                    <span className="ml-1.5 text-red-500">−{item.deduction}</span>
                    {item.missing.length > 0 && (
                      <p className="mt-0.5">누락: {item.missing.join(', ')}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : section.status === 'not_applicable' ? (
            <p>해당 사항 없음(감점 없음)</p>
          ) : (
            <p>하위 항목 전부 충족</p>
          )}
        </div>
      )}
    </AstryxCard>
  )
}

export default function ResultV3Summary({ result }: { result: AnalysisResult }) {
  const gates = (result.hard_gates ?? []).filter(g => g.triggered)
  const sections = result.section_coverage ?? []
  const actors = result.actors ?? { defined: [], detected_undefined: [] }
  const scenarios = result.scenarios
  const xrefs = result.cross_reference_issues ?? []
  const totalDeduction = sections.reduce((s, x) => s + x.deduction, 0)
  const capped = typeof result.raw_score === 'number' && result.raw_score !== result.sufficiency_score

  return (
    <div className="space-y-6">
      {/* 하드 게이트 */}
      {gates.length > 0 && (
        <div className="space-y-2">
          {gates.map(g => (
            <Banner
              key={g.id}
              status={g.cap <= 59 ? 'error' : 'warning'}
              title={`${g.label}: 점수 상한 ${g.cap}점`}
              description={g.reason || g.description}
            />
          ))}
        </div>
      )}

      {/* 점수 구성 */}
      <p className="text-xs text-muted-foreground">
        감점 합계 <span className="font-medium text-foreground/80">−{totalDeduction}</span>
        {capped && (
          <>
            {' · '}원점수 <span className="font-medium text-foreground/80">{result.raw_score}</span>
            {' → '}게이트 적용 <span className="font-medium text-foreground/80">{result.sufficiency_score}</span>
          </>
        )}
        {result.template_ref && <> · 기준 {result.template_ref}</>}
      </p>

      {/* 섹션 커버리지 */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">템플릿 섹션 커버리지(목차 순)</p>
        <div className="space-y-2.5">
          {sections.map(s => (
            <SectionRow key={s.section_id} section={s} />
          ))}
        </div>
      </div>

      {/* Actor */}
      <div>
        <p className="text-sm text-muted-foreground mb-3">Actor 정의 현황</p>
        <AstryxCard padding={0}>
          <div className="py-4 px-4 space-y-3 text-sm">
            {actors.defined.length === 0 ? (
              <p className="text-muted-foreground text-xs">Actor 정의 표(3.1) 없음</p>
            ) : (
              <ul className="space-y-2">
                {actors.defined.map((a, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className={`mt-1 w-2 h-2 rounded-full shrink-0 ${a.completeness >= 3 ? 'bg-green-500' : a.completeness >= 1 ? 'bg-amber-500' : 'bg-red-500'}`}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <span className="font-medium">{a.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">정의 {a.completeness}/3</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[
                          a.definition && `정의: ${a.definition}`,
                          a.entry_path && `진입: ${a.entry_path}`,
                          a.permission_scope && `권한: ${a.permission_scope}`,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '정의·진입 경로·권한 범위 미기재'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {actors.detected_undefined.length > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                <p className="text-xs font-medium text-red-600 mb-1.5">
                  미정의 Actor({actors.detected_undefined.length}): 본문에만 등장
                </p>
                <ul className="space-y-1">
                  {actors.detected_undefined.map((a, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">{a.name}</span>
                      {a.where && <> · {a.where}</>}
                      {a.quote && <> · “{a.quote}”</>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </AstryxCard>
      </div>

      {/* 시나리오 */}
      {scenarios && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">유저 시나리오 현황</p>
          <AstryxCard padding={0}>
            <div className="py-4 px-4 text-sm space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold">{scenarios.map_count}</p>
                  <p className="text-[11px] text-muted-foreground">시나리오 맵</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{scenarios.milestone_defined ? '✓' : '-'}</p>
                  <p className="text-[11px] text-muted-foreground">Milestone 표</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{scenarios.detail_count}</p>
                  <p className="text-[11px] text-muted-foreground">상세 작성</p>
                </div>
              </div>
              {(scenarios.actors_without_scenario.length > 0 || scenarios.scenarios_without_screen_ref.length > 0) && (
                <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
                  {scenarios.actors_without_scenario.length > 0 && (
                    <p>
                      <span className="font-medium text-foreground/80">시나리오 미보유 Actor:</span>{' '}
                      {scenarios.actors_without_scenario.join(', ')}
                    </p>
                  )}
                  {scenarios.scenarios_without_screen_ref.length > 0 && (
                    <p>
                      <span className="font-medium text-foreground/80">화면 참조 누락 시나리오:</span>{' '}
                      {scenarios.scenarios_without_screen_ref.join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </AstryxCard>
        </div>
      )}

      {/* 교차 검증 */}
      {xrefs.length > 0 && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">교차 검증({xrefs.length})</p>
          <div className="space-y-2">
            {xrefs.map((x, i) => {
              const sev = SEVERITY_META[x.severity] ?? SEVERITY_META[2]
              return (
                <AstryxCard padding={0} key={i}>
                  <div className="py-3 px-4 flex items-start gap-3">
                    <AstryxBadge variant={sev.variant} label={sev.label} />
                    <div className="min-w-0 text-sm">
                      <p className="text-xs text-muted-foreground mb-0.5">{CHECK_LABELS[x.check] ?? x.check}</p>
                      <p>{x.detail}</p>
                    </div>
                  </div>
                </AstryxCard>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
