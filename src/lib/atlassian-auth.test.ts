// 암호화 키는 테스트 전용 임의값 — 실제 시크릿과 무관하다.
process.env.ATLASSIAN_SESSION_SECRET ??= 'test-only-session-secret'

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  decodeSession,
  encodeSessionCore,
  hostOf,
  matchesSite,
  sessionSites,
  type AtlassianSite,
} from './atlassian-auth.ts'

const site = (i: number): AtlassianSite => ({
  id: `1324a887-45db-1bf4-1e99-ef0ff456d4${String(i).padStart(2, '0')}`,
  url: `https://some-fairly-long-site-name-${i}.atlassian.net`,
})

describe('matchesSite — 참일 때만 믿을 수 있다', () => {
  const ours: AtlassianSite = { id: 'A', url: 'https://musinsa.atlassian.net' }

  test('같은 호스트면 참, 대소문자는 무시한다', () => {
    assert.equal(matchesSite('https://musinsa.atlassian.net/wiki/spaces/X/pages/1/T', ours), true)
    assert.equal(matchesSite('https://MUSINSA.Atlassian.NET/wiki', ours), true)
  })

  test('커스텀 도메인은 거짓이다 — 프로브가 필요한 이유', () => {
    // 이 계약이 깨지면 "거짓 = 남의 사이트"라는 잘못된 추론이 되살아난다.
    assert.equal(matchesSite('https://wiki.team.musinsa.com/wiki/spaces/X/pages/1/T', ours), false)
  })

  test('잘못된 입력에도 터지지 않는다', () => {
    assert.equal(matchesSite('그냥 문자열', ours), false)
    assert.equal(matchesSite('https://x.atlassian.net/w', { id: 'C', url: '' }), false)
  })
})

describe('hostOf', () => {
  test('호스트만 소문자로 뽑고, 실패하면 null', () => {
    assert.equal(hostOf('https://FOO.Atlassian.NET/wiki'), 'foo.atlassian.net')
    assert.equal(hostOf('그냥 문자열'), null)
    assert.equal(hostOf(''), null)
  })
})

describe('세션 쿠키', () => {
  // Atlassian access token은 계정마다 길이가 다르다. 넉넉히 잡는다.
  const jwt = (len: number) => 'e'.repeat(len)

  test('사이트 목록이 왕복해도 손실되지 않는다', () => {
    const sites = [site(0), site(1), site(2)]
    const back = decodeSession(
      encodeSessionCore({
        accessToken: jwt(1200),
        cloudId: sites[0].id,
        cloudUrl: sites[0].url,
        sites,
        expiresAt: Date.now() + 3_600_000,
      }),
      undefined
    )
    assert.deepEqual(back?.sites, sites)
  })

  test('쿠키가 4096바이트를 넘지 않도록 사이트를 덜어낸다', () => {
    // 넘치면 브라우저가 쿠키를 통째로 버려 로그인 자체가 깨진다.
    const sites = Array.from({ length: 10 }, (_, i) => site(i))
    const cookie = encodeSessionCore({
      accessToken: jwt(2000),
      cloudId: sites[0].id,
      cloudUrl: sites[0].url,
      sites,
      expiresAt: Date.now() + 3_600_000,
    })
    assert.ok(cookie.length < 4096, `쿠키가 ${cookie.length}바이트로 한계를 넘었다`)
    const back = decodeSession(cookie, undefined)
    assert.ok(back, '축소된 쿠키도 복호화되어야 한다')
    assert.ok((back.sites?.length ?? 0) < sites.length, '사이트가 실제로 줄어야 한다')
  })

  test('sites가 없는 옛 쿠키도 그대로 동작한다', () => {
    const back = decodeSession(
      encodeSessionCore({
        accessToken: jwt(1200),
        cloudId: 'OLD',
        cloudUrl: 'https://old.atlassian.net',
        expiresAt: Date.now() + 3_600_000,
      }),
      undefined
    )
    assert.equal(back?.sites, undefined)
    assert.deepEqual(sessionSites(back!), [{ id: 'OLD', url: 'https://old.atlassian.net' }])
  })
})
