#!/usr/bin/env node
/**
 * MCDS-CCD → Preflight_public 동기화 + 컨벤션 드리프트 검증
 *
 * 역할 1 (동기화): MCDS-CCD 의 rulebook / skill 문서를 vendor/mcds/ 에 복사한다.
 *   이 문서들과 vendor/mcds/conventions.md 를 src/lib/mcds-prompt.ts 가 읽어
 *   HIFI 화면 생성 시스템 프롬프트에 주입한다.
 *
 * 역할 2 (드리프트 검증): conventions.md 의 핵심 규칙이 MCDS-CCD 원본
 *   (캐노니컬 화면 src/*.tsx, AGENTS.md)과 tarball 타입 정의에서 여전히
 *   성립하는지 grep 수준으로 검증한다. 원본이 바뀌어 규칙이 어긋나면
 *   여기서 경고가 뜬다 — 프롬프트 규칙이 조용히 낡는 것을 막는 장치.
 *
 *   ※ conventions.md 에 규칙을 추가할 때의 계약:
 *     - 반드시 출처(캐노니컬 화면 file:line 2곳 이상 또는 문서 명문)를 명기
 *     - 가능하면 아래 ASSERTIONS 에 검증식을 함께 추가
 *     - 출처를 달 수 없는 규칙은 발명이다 — 추가 금지
 *
 * NOTE: @musinsa/mcds 컴포넌트 패키지는 public/mcds-sandpack-files.json 으로
 *   Sandpack 에 주입된다. 패키지 갱신은 handoff 산출물 재복사로 처리.
 *
 * 사용: `npm run sync:mcds`
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const MCDS_ROOT_CANDIDATES = [
  join(ROOT, '..', 'MCDS-CCD'),
]

function findMcdsRoot() {
  for (const p of MCDS_ROOT_CANDIDATES) {
    if (existsSync(p)) return p
  }
  return null
}

const MCDS_ROOT = findMcdsRoot()
if (!MCDS_ROOT) {
  console.error('[sync-mcds] MCDS-CCD 저장소를 찾을 수 없습니다. 다음 경로에 있어야 합니다:')
  for (const p of MCDS_ROOT_CANDIDATES) console.error('  - ' + p)
  process.exit(1)
}

const TARGET = join(ROOT, 'src', 'vendor', 'mcds')

// ============================================================================
// 1. 문서 동기화
// ============================================================================

const DOC_TARGETS = [
  {
    src: join(MCDS_ROOT, 'docs', 'rulebook'),
    dest: join(TARGET, 'rulebook'),
    files: ['README.md', 'component-selection.md', 'template-layout.md', 'mcds-migration.md'],
  },
  {
    src: join(MCDS_ROOT, 'skills', 'ocmp-admin-ui-generator'),
    dest: join(TARGET, 'skills'),
    files: ['SKILL.md'],
  },
]

let synced = 0
for (const { src, dest, files } of DOC_TARGETS) {
  if (!existsSync(src)) {
    console.warn(`[sync-mcds] 문서 디렉토리 누락(skip): ${src}`)
    continue
  }
  mkdirSync(dest, { recursive: true })
  for (const f of files) {
    const from = join(src, f)
    if (!existsSync(from)) {
      console.warn(`[sync-mcds] 문서 누락(skip): ${f}`)
      continue
    }
    const content = readFileSync(from, 'utf8')
    writeFileSync(join(dest, f), content)
    console.log(`[sync-mcds] copied doc ${f} (${content.length} bytes)`)
    synced++
  }
}
console.log(`[sync-mcds] ✓ ${synced} docs synced → ${TARGET}\n`)

// ============================================================================
// 2. 컨벤션 드리프트 검증
//    conventions.md 의 핵심 규칙 ↔ MCDS-CCD 원본 코드/타입 대조
// ============================================================================

const canonicalDir = join(MCDS_ROOT, 'src')
const canonicalFiles = existsSync(canonicalDir)
  ? readdirSync(canonicalDir).filter(f => f.endsWith('.tsx')).map(f => ({
      name: f,
      text: readFileSync(join(canonicalDir, f), 'utf8'),
    }))
  : []

const agentsMd = existsSync(join(MCDS_ROOT, 'AGENTS.md'))
  ? readFileSync(join(MCDS_ROOT, 'AGENTS.md'), 'utf8')
  : ''

const tarballPath = join(ROOT, 'public', 'mcds-sandpack-files.json')
const dts = existsSync(tarballPath)
  ? (JSON.parse(readFileSync(tarballPath, 'utf8'))['/node_modules/@musinsa/mcds/dist/index.d.ts'] ?? '')
  : ''

// 디자인시스템 컴포넌트 문서 (Alert vs Modal 사용 기준의 원천)
const designSystemSrc = existsSync(join(canonicalDir, 'DesignSystemAdmin.tsx'))
  ? readFileSync(join(canonicalDir, 'DesignSystemAdmin.tsx'), 'utf8')
  : ''

/** 캐노니컬 화면 중 pattern 이 매치되는 파일 수 */
function countScreens(pattern) {
  return canonicalFiles.filter(f => pattern.test(f.text)).length
}

const ASSERTIONS = [
  {
    rule: '검색영역: [검색 → 초기화] 버튼 순서 다수결 (conventions.md §1)',
    // 버튼 쌍은 별도 const로 정의되는 경우가 많아 leftActions 근접 매치 대신 쌍 순서로 검증
    check: () => {
      const fwd = countScreens(/>\s*검색\s*<\/Button>[\s\S]{0,300}?>\s*초기화\s*<\/Button>/)
      const rev = countScreens(/>\s*초기화\s*<\/Button>[\s\S]{0,300}?>\s*검색\s*<\/Button>/)
      return fwd >= 4 && fwd > rev
    },
    detail: () => {
      const fwd = countScreens(/>\s*검색\s*<\/Button>[\s\S]{0,300}?>\s*초기화\s*<\/Button>/)
      const rev = countScreens(/>\s*초기화\s*<\/Button>[\s\S]{0,300}?>\s*검색\s*<\/Button>/)
      return `검색 선행 ${fwd}곳 vs 초기화 선행 ${rev}곳 (기준: 검색 선행 ≥4 & 다수)`
    },
  },
  {
    rule: '결과 테이블: title에 live 건수 포함 (conventions.md §2)',
    check: () => countScreens(/title=\{[^}]{0,120}\([$$]?\{[^}]+\}\s*(건|개)\)/) >= 4,
    detail: () => `live count title 화면 ${countScreens(/title=\{[^}]{0,120}\([$$]?\{[^}]+\}\s*(건|개)\)/)}곳 (기준 ≥4)`,
  },
  {
    rule: 'Registration variant는 basic 계열만 사용 (conventions.md §3)',
    check: () => countScreens(/variant="basic"/) >= 2 && countScreens(/variant="(register|edit)"/) === 0,
    detail: () => `basic ${countScreens(/variant="basic"/)}곳, register/edit ${countScreens(/variant="(register|edit)"/)}곳`,
  },
  {
    rule: 'd.ts: RegistrationVariant 타입 = basic|stepped|conditional|repeatable (conventions.md §3)',
    check: () => /"basic"\s*\|\s*"stepped"\s*\|\s*"conditional"\s*\|\s*"repeatable"/.test(dts),
    detail: () => 'index.d.ts RegistrationVariant 선언 확인',
  },
  {
    rule: 'd.ts: LookupPickerModal에 onConfirm 존재 (conventions.md §4)',
    check: () => /LookupPickerModalProps[\s\S]{0,800}?onConfirm/.test(dts),
    detail: () => 'index.d.ts LookupPickerModalProps.onConfirm 확인',
  },
  {
    rule: 'd.ts: SearchModalFieldItem = { value, label } (conventions.md §4)',
    check: () => /SearchModalFieldItem\s*=\s*\{[\s\S]{0,120}?value[\s\S]{0,120}?label/.test(dts),
    detail: () => 'index.d.ts SearchModalFieldItem 형태 확인',
  },
  {
    rule: 'd.ts: Select에 placeholder prop 없음 (conventions.md §1)',
    check: () => {
      const m = dts.match(/type SelectProps[\s\S]{0,600}?\n\}/)
      return m ? !/placeholder/.test(m[0]) : false
    },
    detail: () => 'index.d.ts SelectProps 블록에 placeholder 부재 확인',
  },
  {
    rule: 'AGENTS.md: Tag=상태 / Chips=필터 역할 분리 명문 (conventions.md §6)',
    check: () => /Chips/.test(agentsMd),
    detail: () => 'AGENTS.md Chips 언급 확인',
  },
  {
    rule: 'AGENTS.md: 성공 피드백 Message/MessageStack 명문 (conventions.md §5)',
    check: () => /MessageStack/.test(agentsMd),
    detail: () => 'AGENTS.md MessageStack 언급 확인',
  },
  {
    rule: '캐노니컬: 검색/초기화 버튼에 아이콘 없음 (conventions.md §6)',
    check: () => countScreens(/<Button[^>]*>\s*<Icon\w+[^>]*\/>\s*(검색|초기화)/) === 0,
    detail: () => `아이콘 포함 검색/초기화 버튼 ${countScreens(/<Button[^>]*>\s*<Icon\w+[^>]*\/>\s*(검색|초기화)/)}곳 (기준 0)`,
  },
  {
    rule: 'ConfirmActionDialog confirm은 warning이 아닌 기본 primary (conventions.md §4)',
    check: () => countScreens(/<ConfirmActionDialog[\s\S]{0,800}?type="warning"/) === 0
      && countScreens(/<ConfirmActionDialog/) >= 1,
    detail: () => `warning confirm 사용 ${countScreens(/<ConfirmActionDialog[\s\S]{0,800}?type="warning"/)}곳 (기준 0), ConfirmActionDialog 사용 화면 ${countScreens(/<ConfirmActionDialog/)}곳`,
  },
  {
    rule: 'DesignSystem: Alert=단일 메시지 확인 컴포넌트로 문서화 (conventions.md §4)',
    check: () => /단일 메시지/.test(designSystemSrc) && /renderPreviewAlert/.test(designSystemSrc),
    detail: () => 'DesignSystemAdmin.tsx의 Alert 정의("단일 메시지")·renderPreviewAlert 존재 확인',
  },
  {
    rule: 'DesignSystem: Alert 삭제 캐노니컬 = title-only + primary confirm (conventions.md §4)',
    // renderPreviewAlert의 confirm 버튼이 warning이 아닌 기본 Button (<Button>{confirmLabel}</Button>)인지
    check: () => /confirmLabel = "확인"/.test(designSystemSrc)
      && /<Button>\{confirmLabel\}<\/Button>/.test(designSystemSrc),
    detail: () => 'renderPreviewAlert가 confirm을 기본 primary Button으로 렌더(삭제여도 warning 아님)하는지 확인',
  },
]

console.log(`[sync-mcds] 컨벤션 드리프트 검증 (캐노니컬 화면 ${canonicalFiles.length}개 대상)`)
let failures = 0
for (const a of ASSERTIONS) {
  let ok = false
  try { ok = a.check() } catch { ok = false }
  const mark = ok ? '  ✓' : '  ✗ 드리프트!'
  console.log(`${mark} ${a.rule}`)
  if (!ok) {
    failures++
    console.log(`      → ${a.detail()}`)
    console.log('      → MCDS-CCD 원본이 바뀌었거나 규칙이 애초에 잘못됐을 수 있음.')
    console.log('        vendor/mcds/conventions.md 해당 규칙을 원본 코드와 대조해 갱신할 것.')
  }
}

if (failures > 0) {
  console.error(`\n[sync-mcds] ✗ 드리프트 ${failures}건 — conventions.md 재검토 필요`)
  process.exit(1)
}
console.log(`\n[sync-mcds] ✓ 드리프트 검증 ${ASSERTIONS.length}/${ASSERTIONS.length} 통과`)
console.log('[sync-mcds] @musinsa/mcds 패키지 갱신: cp <new-sandpack-files.json> public/mcds-sandpack-files.json')
