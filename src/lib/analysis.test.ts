import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { validateAndNormalize } from './analysis.ts'
import { DIMENSIONS } from './rubric.ts'

/**
 * 채점 지시문은 모든 점수에 PRD 인용(evidence)을 요구하지만, 안 붙여서 오는 경우가 있다.
 * 그때 ① 채점을 버리지 않고 ② 점수는 그대로 쓰되 ③ 몇 건이나 그랬는지는 남겨야 한다.
 * 화면에는 "분석 결과에서 근거 문장을 불러오는 데 실패했습니다"로 뜨는 그 경우다.
 */

// 6개 항목을 전부 채운 최소 응답. 나머지 필드가 없으면 경고만 남고 통과한다.
function candidate(patch: Record<string, unknown> = {}) {
  const criteria: Record<string, unknown> = {}
  for (const d of DIMENSIONS) {
    criteria[d.key] = { score: 8, evidence: 'PRD 본문에서 따온 문장', missing: [] }
  }
  Object.assign(criteria, patch)
  return { project_type: 'management', criteria }
}

function evidenceWarnings(warnings: string[]): string[] {
  return warnings.filter(w => w.includes('근거(evidence)'))
}

describe('validateAndNormalize — 근거(evidence) 누락', () => {
  test('근거가 다 있으면 근거 경고가 없다', () => {
    const out = validateAndNormalize(candidate())
    assert.equal(out.ok, true)
    assert.deepEqual(evidenceWarnings(out.ok ? out.warnings : []), [])
  })

  test('근거가 빠진 항목만 경고하고, 그 항목의 점수는 그대로 쓴다', () => {
    const key = DIMENSIONS[0].key
    const out = validateAndNormalize(candidate({ [key]: { score: 8, missing: [] } }))
    assert.equal(out.ok, true)
    if (!out.ok) return

    const warned = evidenceWarnings(out.warnings)
    assert.equal(warned.length, 1)
    assert.match(warned[0], new RegExp(key))
    // 점수를 버리거나 깎지 않는다 — 문서가 아니라 응답의 흠이기 때문이다
    assert.equal(out.analysis.criteria[key].score, 8)
    assert.equal(out.analysis.criteria[key].evidence, undefined)
  })

  test('빈 문자열과 공백도 없는 것으로 본다 (화면과 같은 기준)', () => {
    const [a, b] = DIMENSIONS
    const out = validateAndNormalize(
      candidate({
        [a.key]: { score: 7, evidence: '', missing: [] },
        [b.key]: { score: 7, evidence: '   ', missing: [] },
      })
    )
    assert.equal(out.ok, true)
    assert.equal(evidenceWarnings(out.ok ? out.warnings : []).length, 2)
  })

  test('점수가 null(해당 없음)인 항목은 근거를 요구하지 않는다', () => {
    const key = DIMENSIONS[0].key
    const out = validateAndNormalize(candidate({ [key]: { score: null, missing: [] } }))
    assert.equal(out.ok, true)
    assert.deepEqual(evidenceWarnings(out.ok ? out.warnings : []), [])
  })
})
