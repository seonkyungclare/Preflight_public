import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { classifyFailure } from './confluence-page.ts'

/**
 * 사내 위키는 커스텀 도메인을 쓰는 Atlassian Cloud라
 * accessible-resources가 *.atlassian.net 형태를 돌려준다.
 * 즉 정상적인 사내 URL도 호스트 비교에서는 **항상 불일치**다.
 */
const WIKI = 'wiki.team.musinsa.com'
const OURS = ['musinsa.atlassian.net']

const classify = (o: Partial<Parameters<typeof classifyFailure>[0]>) =>
  classifyFailure({
    probeStatuses: [404],
    hostMatched: false,
    inputHost: WIKI,
    connectedHosts: OURS,
    ...o,
  }).kind

describe('classifyFailure — 분기 순서', () => {
  test('커스텀 도메인에서 404만 왔으면 계정이 다르다고 단정하지 않는다', () => {
    // 회귀: 예전에는 "호스트 불일치 → site-mismatch"가 권한 판정보다 먼저라
    // 올바른 계정으로 접속한 사람이 권한 없는 페이지를 넣으면
    // "다시 연결하라"는 엉뚱한 안내를 받았다.
    assert.equal(classify({}), 'unresolved')
  })

  test('커스텀 도메인 환경에서도 권한 안내에 도달할 수 있다', () => {
    // 회귀: 예전에는 이 분기가 커스텀 도메인에서 영영 도달 불가였다.
    assert.equal(classify({ probeStatuses: [403] }), 'forbidden')
    assert.equal(classify({ probeStatuses: [404, 403] }), 'forbidden')
  })

  test('표기법이 같은데 목록에 없을 때만 사이트 불일치로 단정한다', () => {
    assert.equal(
      classify({ inputHost: 'personal.atlassian.net' }),
      'site-mismatch'
    )
  })

  test('호스트가 일치하면 사이트는 맞으므로 권한 문제로 본다', () => {
    assert.equal(
      classify({ hostMatched: true, inputHost: 'musinsa.atlassian.net' }),
      'forbidden'
    )
  })

  test('전부 401일 때만 만료로 판정한다', () => {
    assert.equal(classify({ probeStatuses: [401, 401] }), 'expired')
    // 일부만 401이면 그 사이트에 앱 권한이 없는 것일 뿐이다.
    assert.equal(classify({ probeStatuses: [401, 404] }), 'unresolved')
  })

  test('접근 계열이 아닌 응답은 권한 문제로 안내하지 않는다', () => {
    // 회귀: 500을 "권한이 있는지 확인하세요"로 안내하면 안 된다.
    assert.equal(classify({ probeStatuses: [500], hostMatched: true }), 'api-error')
    assert.equal(classify({ probeStatuses: [0] }), 'api-error')
  })

  test('연결된 사이트 정보가 없으면 사이트를 언급하지 않는다', () => {
    assert.equal(classify({ connectedHosts: [] }), 'forbidden')
  })

  test('가릴 수 없을 때는 두 호스트를 모두 담아 돌려준다', () => {
    const r = classifyFailure({
      probeStatuses: [404],
      hostMatched: false,
      inputHost: WIKI,
      connectedHosts: OURS,
    })
    assert.equal(r.kind, 'unresolved')
    assert.ok('inputHost' in r && r.inputHost === WIKI)
    assert.ok('connectedHosts' in r && r.connectedHosts.includes(OURS[0]))
  })
})
