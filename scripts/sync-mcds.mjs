#!/usr/bin/env node
// MCDS 스타일시트 동기화 — mcds-campaign-dashboard/pages/mcds.css → src/lib/mcds-css.ts
// mcds.css를 수정한 뒤 이 스크립트를 실행해 Preflight 임베드본을 재생성한다.
//   npm run sync:mcds
// 소스 경로: env MCDS_CSS_PATH 우선, 없으면 형제 레포 기본 경로.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const DEFAULT_SRC = resolve(here, '../../mcds-campaign-dashboard/pages/mcds.css')
const SRC = process.env.MCDS_CSS_PATH ? resolve(process.env.MCDS_CSS_PATH) : DEFAULT_SRC
const OUT = resolve(here, '../src/lib/mcds-css.ts')

let css
try {
  css = readFileSync(SRC, 'utf8')
} catch {
  console.error(`[sync:mcds] ✗ mcds.css를 찾을 수 없습니다: ${SRC}`)
  console.error('  MCDS_CSS_PATH 환경변수로 원본 경로를 지정하세요.')
  process.exit(1)
}

// String.raw 템플릿 안전성: 백틱과 ${ 는 리터럴을 깨뜨린다.
if (css.includes('`') || css.includes('${')) {
  console.error('[sync:mcds] ✗ mcds.css에 백틱(`) 또는 ${ 가 있어 String.raw 임베드가 불가합니다.')
  console.error('  해당 문자를 제거하거나 임베드 방식을 바꿔야 합니다.')
  process.exit(1)
}

const header = `// AUTO-GENERATED — MCDS 공용 스타일 임베드본. 직접 수정하지 말 것.
// 원본: mcds-campaign-dashboard/pages/mcds.css
// 재생성: npm run sync:mcds  (원본 mcds.css 수정 후 반드시 실행)
// Hi-Fi 목업 Sandpack에 정적 파일(/mcds.css)로 주입된다.
/* eslint-disable */
`
writeFileSync(OUT, `${header}export const MCDS_CSS = String.raw\`\n${css}\`\n`)
console.log(`[sync:mcds] ✓ 임베드 재생성 완료 (${css.length.toLocaleString()} bytes)`)
console.log(`  source: ${SRC}`)
console.log(`  output: ${OUT}`)
