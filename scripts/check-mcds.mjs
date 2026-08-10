#!/usr/bin/env node
// 드리프트 가드 — Preflight 임베드본이 원본 mcds.css와 일치하는지 검사.
// 불일치 시 exit 1 (npm run sync:mcds 안내). 원본이 없으면(예: Vercel 빌드) 조용히 통과.
// build 전에 자동 실행(package.json prebuild)되며, 수동으로도 실행 가능: npm run check:mcds
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const DEFAULT_SRC = resolve(here, '../../mcds-campaign-dashboard/pages/mcds.css')
const SRC = process.env.MCDS_CSS_PATH ? resolve(process.env.MCDS_CSS_PATH) : DEFAULT_SRC
const EMB = resolve(here, '../src/lib/mcds-css.ts')

let src
try {
  src = readFileSync(SRC, 'utf8')
} catch {
  console.log(`[check:mcds] ⓘ 원본 mcds.css 없음 (${SRC}) — 검사 건너뜀 (배포 환경 정상).`)
  process.exit(0)
}

const emb = readFileSync(EMB, 'utf8')
const m = emb.match(/String\.raw`\n([\s\S]*)`\n?$/)
if (!m) {
  console.error('[check:mcds] ✗ 임베드본 형식을 해석할 수 없습니다 → npm run sync:mcds')
  process.exit(1)
}

if (m[1] === src) {
  console.log('[check:mcds] ✓ 임베드본이 mcds.css와 일치합니다.')
  process.exit(0)
}

console.error('[check:mcds] ✗ 임베드본이 mcds.css와 드리프트했습니다.')
console.error('  → mcds.css 변경이 반영되지 않았습니다. npm run sync:mcds 를 실행하세요.')
process.exit(1)
