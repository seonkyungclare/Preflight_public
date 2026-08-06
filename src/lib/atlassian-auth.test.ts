// 암호화 키는 테스트 전용 임의값 — 실제 시크릿과 무관하다.
process.env.ATLASSIAN_SESSION_SECRET ??= 'test-only-session-secret'

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
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

/**
 * 실제 access token(JWT)에 가까운 문자열을 만든다.
 *
 * ⚠️ `'e'.repeat(n)` 같은 반복 문자열을 쓰면 안 된다. JWT는 base64url
 * 고엔트로피 문자열이라 gzip으로 20~25%밖에 안 줄지만, 반복 문자열은
 * 98% 넘게 줄어든다. 압축이 끼어 있는 인코딩에서 반복 문자열을 쓰면
 * 쿠키가 항상 작게 나와 크기 관련 테스트가 통째로 무의미해진다.
 *
 * 시드 고정 LCG라 실행할 때마다 같은 값이 나온다. 단, **상위 비트를 쓴다** —
 * LCG의 하위 비트는 주기가 매우 짧아서 `seed % 64`로 뽑으면 "-AAAAAA…" 같은
 * 사실상 반복 문자열이 나온다(실제로 그렇게 짰다가 압축률 92%가 나왔다).
 */
function accessTokenLike(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let seed = 12345
  let out = ''
  for (let i = 0; i < length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    out += alphabet[(seed >>> 15) % 64]
  }
  return out
}

describe('세션 쿠키', () => {
  test('테스트 픽스처가 실제 토큰만큼 압축이 안 되는지 먼저 확인한다', () => {
    // 이 검사가 없으면, 픽스처가 잘 압축되는 문자열로 퇴화했을 때
    // 아래 크기 테스트가 "통과하지만 아무것도 검증하지 않는" 상태가 된다.
    // 실제 JWT는 gzip으로 20~25%만 줄어든다.
    const token = accessTokenLike(2000)
    const ratio = gzipSync(Buffer.from(token), { level: 9 }).length / token.length
    assert.ok(
      ratio > 0.7,
      `픽스처가 너무 잘 압축된다 (원본의 ${(ratio * 100).toFixed(1)}%). 실제 토큰과 다르게 동작한다`
    )
  })

  test('사이트 목록이 왕복해도 손실되지 않는다', () => {
    const sites = [site(0), site(1), site(2)]
    const back = decodeSession(
      encodeSessionCore({
        accessToken: accessTokenLike(1200),
        cloudId: sites[0].id,
        cloudUrl: sites[0].url,
        sites,
        expiresAt: Date.now() + 3_600_000,
      }),
      undefined
    )
    assert.deepEqual(back?.sites, sites)
  })

  test('쿠키가 한계를 넘게 되면 사이트를 덜어내서라도 지킨다', () => {
    // 넘치면 브라우저가 쿠키를 통째로 버려 로그인 자체가 깨진다.
    //
    // 토큰 길이를 하나로 못 박지 않고 **트리밍이 실제로 일어나는 지점을 찾아서**
    // 검증한다. 인코딩 방식이 바뀌면(예: 암호화 전 압축 도입) 임계값이 크게
    // 움직이는데, 고정값으로 두면 트리밍이 한 번도 안 돌면서 통과하는
    // 무의미한 테스트가 되기 때문이다.
    const sites = Array.from({ length: 10 }, (_, i) => site(i))
    let trimmed: { len: number; cookie: string; kept: number } | null = null

    for (let len = 500; len <= 16_000 && !trimmed; len += 100) {
      const cookie = encodeSessionCore({
        accessToken: accessTokenLike(len),
        cloudId: sites[0].id,
        cloudUrl: sites[0].url,
        sites,
        expiresAt: Date.now() + 3_600_000,
      })
      const back = decodeSession(cookie, undefined)
      assert.ok(back, `토큰 ${len}자에서 복호화 실패`)
      const kept = back.sites?.length ?? 0
      if (kept < sites.length) trimmed = { len, cookie, kept }
    }

    assert.ok(trimmed, '토큰을 16,000자까지 늘려도 트리밍이 일어나지 않았다')
    assert.ok(
      trimmed.cookie.length < 4096,
      `트리밍 후에도 쿠키가 ${trimmed.cookie.length}바이트다 (토큰 ${trimmed.len}자)`
    )
  })

  test('sites가 없는 옛 쿠키도 그대로 동작한다', () => {
    const back = decodeSession(
      encodeSessionCore({
        accessToken: accessTokenLike(1200),
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
