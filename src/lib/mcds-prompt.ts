import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * MCDS 컨벤션을 화면 생성 시스템 프롬프트에 주입하는 단일 진입점.
 *
 * 구조 (드리프트 방지 3계층):
 *   1. 소스: src/vendor/mcds/conventions.md — 캐노니컬 화면 코드·AGENTS.md·rulebook에서
 *      추출한 규칙. 모든 규칙에 출처(file:line) 명기. 출처 없는 규칙 추가 금지.
 *      `npm run sync:mcds`가 MCDS-CCD 원본과의 드리프트를 grep 검증한다.
 *   2. 주입: 이 모듈이 conventions.md를 읽어 HIFI 화면 생성 시스템 프롬프트에 결합.
 *      route.ts의 HIFI_SYSTEM에는 d.ts로 검증된 API 명세만 남긴다 —
 *      배치·순서·용법 컨벤션은 전부 conventions.md가 원천.
 *   3. 검증: route.ts의 HIFI_UNAVAILABLE 린터가 생성 코드의 컨벤션 위반을
 *      감지해 자동 수리로 보낸다.
 *
 * 이 분리가 지키는 것: "문서에 없고 캐노니컬 코드에만 있는 컨벤션"이 프롬프트에서
 * 임의로 발명되거나(2026-07 검색버튼 사고) 조용히 낡는 것을 방지.
 */

const VENDOR = join(process.cwd(), 'src', 'vendor', 'mcds')

function readDoc(rel: string): string {
  const path = join(VENDOR, rel)
  return existsSync(path) ? readFileSync(path, 'utf8').trim() : ''
}

/**
 * HIFI 화면 생성용 컨벤션 블록.
 * 모듈 로드 시 1회 읽어 상수로 사용 (Next.js 서버 런타임).
 */
export function buildHifiConventions(): string {
  const conventions = readDoc('conventions.md')
  if (!conventions) {
    console.warn('[mcds-prompt] conventions.md 누락 — `npm run sync:mcds` 실행 필요. 컨벤션 없이 생성됩니다.')
    return ''
  }
  return [
    '## MCDS CANONICAL CONVENTIONS (authoritative — MCDS-CCD 실화면 코드·AGENTS.md에서 추출, 출처 명기)',
    'These override any conflicting guidance above. Every rule below cites its canonical source.',
    '',
    conventions,
  ].join('\n')
}

/**
 * 스펙 추출 단계용 요약 (화면 분해·컨트롤 선택에 영향 주는 규칙만).
 * component-selection.md 원문은 필드→컨트롤 매핑의 원천이므로 그대로 제공.
 */
export function buildComponentSelectionReference(): string {
  const doc = readDoc('rulebook/component-selection.md')
  return doc ? `## MCDS 컴포넌트 선택 규칙 (rulebook 원문)\n\n${doc}` : ''
}
