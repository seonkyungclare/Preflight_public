'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  useSandpack,
} from '@codesandbox/sandpack-react'
import type { AnalysisResult, MockupType } from '@/app/page'
import { Button } from '@/components/ui/button'

interface MockupScreenProps {
  files: Record<string, string>
  analysis: AnalysisResult
  type: MockupType
  onBack: () => void
}

const HEADER_H = 57
const TOGGLE_H = 41

/**
 * hifi Sandpack 진입점.
 * McdsAntProvider 가 MCDS 토큰을 antd ConfigProvider 로 주입한다.
 * theme.css 는 /styles.css 로도 주입되어 CSS 변수가 전역 적용된다.
 */
const SANDPACK_ENTRY = `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { McdsAntProvider } from '@musinsa/mcds';
import './styles.css';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <McdsAntProvider>
      <App />
    </McdsAntProvider>
  </StrictMode>
);
`

/**
 * @rc-component/picker virtual stub.
 *
 * antd@6.3.3 의 DatePicker 가 @rc-component/picker 의 exports map을
 * eager 하게 import 하는데, Sandpack CDN bundler 가 해석을 못해 실패한다.
 * MCDS 자체 DatePicker 를 쓰더라도 antd re-export chain 으로 끌려 들어오므로
 * 전 경로를 가짜 모듈로 주입해 graceful fallback 처리한다.
 */
/**
 * ConfirmActionDialog(=Alert) 단일 박스 보정.
 *
 * MCDS Alert는 `.ant-modal-container`(외곽)를 투명하게 두고 `.ant-modal-body`만
 * 흰 배경·border·shadow를 가진 단일 420 박스로 렌더한다(실제 MCDS 앱 확인). Sandpack에서는
 * McdsAntProvider의 테마 토큰이 antd CSS-in-JS보다 늦게 적용되는 타이밍 때문에
 * container에 antd 기본 크롬(배경·그림자·패딩)이 남아 "박스 안의 박스"가 된다.
 * Modal/ModalWorkspace/LookupPickerModal 은 rootClassName="mcds-modal-root" 를 쓰므로
 * :not(.mcds-modal-root) 로 Alert 계열만 정확히 보정한다(그 외엔 커스텀 div 오버레이).
 */
const ALERT_SINGLE_BOX_FIX = `
.ant-modal-root:not(.mcds-modal-root) .ant-modal-container,
.ant-modal-root:not(.mcds-modal-root) .ant-modal-content {
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  border: none !important;
}
.ant-modal-root:not(.mcds-modal-root) .ant-modal-body {
  background: var(--mcds-color-white);
  box-shadow: var(--mcds-component-modal-shadow);
}
`

const PICKER_LOCALE_STUB = 'const locale = { locale: "en_US" };\nexport default locale;\n'

const PICKER_STUB_INDEX = `import React from 'react'

function toIsoDate(v) {
  if (v == null || v === '') return ''
  if (typeof v === 'string') return v.slice(0, 10)
  if (typeof v === 'object') {
    if (typeof v.format === 'function') {
      try { return v.format('YYYY-MM-DD') } catch (e) { return '' }
    }
    if (typeof v.toDate === 'function') {
      try { return v.toDate().toISOString().slice(0, 10) } catch (e) { return '' }
    }
    if (v instanceof Date) return v.toISOString().slice(0, 10)
  }
  return ''
}

var inputStyle = {
  padding: '4px 11px', border: '1px solid #d9d9d9', borderRadius: 4,
  fontSize: 14, height: 32, boxSizing: 'border-box', outline: 'none',
  background: '#fff', color: '#000',
}

export const Picker = React.forwardRef(function Picker(props, ref) {
  var value = props.value, onChange = props.onChange, placeholder = props.placeholder, disabled = props.disabled
  return React.createElement('input', {
    ref: ref, type: 'date', disabled: disabled,
    value: toIsoDate(value), placeholder: placeholder || 'YYYY-MM-DD',
    style: Object.assign({ width: '100%' }, inputStyle),
    onChange: function (e) { if (typeof onChange === 'function') onChange(e.target.value, e.target.value) },
  })
})

export const RangePicker = React.forwardRef(function RangePicker(props, ref) {
  var value = props.value, onChange = props.onChange, placeholder = props.placeholder, disabled = props.disabled
  var arr = Array.isArray(value) ? value : [null, null]
  var ph = Array.isArray(placeholder) ? placeholder : ['시작일', '종료일']
  function emit(idx, next) {
    var nextArr = idx === 0 ? [next, arr[1]] : [arr[0], next]
    if (typeof onChange === 'function') onChange(nextArr, nextArr.map(function(v){ return v || '' }))
  }
  return React.createElement('div', {
    ref: ref,
    style: { display: 'inline-flex', alignItems: 'center', gap: 6 },
  },
    React.createElement('input', {
      type: 'date', disabled: disabled, value: toIsoDate(arr[0]),
      placeholder: ph[0], style: inputStyle,
      onChange: function (e) { emit(0, e.target.value) },
    }),
    React.createElement('span', { style: { color: '#999' } }, '~'),
    React.createElement('input', {
      type: 'date', disabled: disabled, value: toIsoDate(arr[1]),
      placeholder: ph[1], style: inputStyle,
      onChange: function (e) { emit(1, e.target.value) },
    }),
  )
})

export const PickerPanel = function PickerPanel() { return null }

export default Picker
`

function buildPickerStubFiles(): Record<string, string> {
  return {
    '/node_modules/@rc-component/picker/package.json': JSON.stringify(
      { name: '@rc-component/picker', version: '1.9.1-stub', main: 'index.js', module: 'index.js' },
      null,
      2,
    ),
    '/node_modules/@rc-component/picker/index.js': PICKER_STUB_INDEX,
    '/node_modules/@rc-component/picker/interface.js': 'export {};\n',
    '/node_modules/@rc-component/picker/locale/en_US.js': PICKER_LOCALE_STUB,
    '/node_modules/@rc-component/picker/locale/zh_CN.js': PICKER_LOCALE_STUB,
    '/node_modules/@rc-component/picker/locale/ko_KR.js': PICKER_LOCALE_STUB,
    '/node_modules/@rc-component/picker/generate/dayjs.js': 'export default {};\n',
    '/node_modules/@rc-component/picker/generate/moment.js': 'export default {};\n',
    '/node_modules/@rc-component/picker/generate/luxon.js': 'export default {};\n',
    '/node_modules/@rc-component/picker/generate/index.js': 'export default {};\n',
  }
}

function SandpackContent({ showCode, height }: { showCode: boolean; height: string }) {
  const { listen } = useSandpack()
  const [ready, setReady] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsubscribe = listen((msg) => {
      if (msg.type === 'done') {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setReady(true), 1000)
      }
    })
    return () => {
      unsubscribe()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [listen])

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 25000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ position: 'relative', height }}>
      <SandpackLayout style={{ height, borderRadius: 0, border: 'none', margin: 0 }}>
        <SandpackCodeEditor
          showLineNumbers
          showInlineErrors
          style={{ height: '100%', display: showCode ? 'flex' : 'none' }}
        />
        <SandpackPreview
          style={{ height: '100%', display: showCode ? 'none' : 'flex' }}
          showNavigator={false}
          showOpenInCodeSandbox={false}
        />
      </SandpackLayout>

      {!ready && !showCode && (
        <div style={{
          position: 'absolute', inset: 0,
          background: '#f8fafc',
          padding: '24px 20px',
          display: 'flex', flexDirection: 'column', gap: 12,
          zIndex: 10, pointerEvents: 'none',
        }}>
          {[
            { w: '55%', h: 28 }, { w: '90%', h: 14 }, { w: '70%', h: 14 },
            { w: '100%', h: 72 }, { w: '40%', h: 20 }, { w: '85%', h: 14 },
            { w: '100%', h: 72 }, { w: '60%', h: 14 }, { w: '100%', h: 72 },
          ].map((s, i) => (
            <div key={i} style={{
              width: s.w, height: s.h, background: '#e2e8f0', borderRadius: 6,
              animation: `skeleton-pulse 1.5s ease-in-out ${i * 0.08}s infinite`,
            }} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function MockupScreen({ files, type, onBack }: MockupScreenProps) {
  const [showCode, setShowCode] = useState(false)
  // 빌드된 @musinsa/mcds 패키지 파일들 (public/mcds-sandpack-files.json)
  const [mcdsFiles, setMcdsFiles] = useState<Record<string, string> | null>(null)
  const [mcdsError, setMcdsError] = useState<string | null>(null)

  useEffect(() => {
    if (type !== 'hifi') return
    fetch('/mcds-sandpack-files.json')
      .then(async r => {
        if (!r.ok) throw new Error(`mcds-sandpack-files.json 로드 실패 (HTTP ${r.status})`)
        return r.json() as Promise<Record<string, string>>
      })
      .then(setMcdsFiles)
      .catch((e: Error) => setMcdsError(e.message))
  }, [type])

  const sandpackFiles = useMemo((): Record<string, string> => {
    if (type !== 'hifi' || !mcdsFiles) return files

    // sandpack-files.json 은 /node_modules/@musinsa/mcds/* 경로의 가상 파일 맵.
    // 그대로 spread 하면 Sandpack 이 @musinsa/mcds 를 resolve 한다.
    // theme.css 는 /styles.css 로도 주입해 CSS 변수를 전역 적용한다.
    const themeCss = mcdsFiles['/node_modules/@musinsa/mcds/dist/theme.css'] ?? ''
    const appCode = files['/App.tsx'] ?? files['/App.js'] ?? ''

    return {
      '/App.tsx': appCode,
      ...mcdsFiles,
      ...buildPickerStubFiles(),
      '/styles.css': `${themeCss}\n${ALERT_SINGLE_BOX_FIX}`,
      '/index.tsx': SANDPACK_ENTRY,
    }
  }, [files, type, mcdsFiles])

  const hifiReady = type !== 'hifi' || mcdsFiles !== null

  function handleCopyCode() {
    const src = files['/App.tsx'] ?? files['/App.js'] ?? ''
    navigator.clipboard.writeText(src).catch(() => {})
  }

  const sandpackHeight = `calc(100vh - ${HEADER_H + TOGGLE_H}px)`

  return (
    <>
      <style>{`html, body { margin: 0; padding: 0; overflow: hidden; height: 100%; } @keyframes skeleton-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      <div className="fixed inset-0 bg-background text-foreground font-sans">

        {/* 헤더 */}
        <div
          className="absolute left-0 right-0 top-0 border-b flex items-center justify-between px-6"
          style={{ height: HEADER_H }}
        >
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg">Preflight</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">목업 미리보기</span>
            {type === 'hifi' && (
              <span style={{ fontSize: 11, color: '#6366f1', background: 'rgba(99,102,241,0.12)', padding: '2px 7px', borderRadius: 4, border: '1px solid rgba(99,102,241,0.3)', fontWeight: 600 }}>
                MCDS
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyCode}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
                <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              코드 복사
            </Button>
            <Button variant="outline" size="sm" onClick={onBack}>
              ✕ 닫기
            </Button>
          </div>
        </div>

        {/* 토글바 */}
        <div
          className="absolute left-0 right-0 border-b flex items-center justify-end px-4"
          style={{ top: HEADER_H, height: TOGGLE_H }}
        >
          <div className="flex rounded-md overflow-hidden border">
            {[{ id: false, label: '미리보기' }, { id: true, label: '코드' }].map(({ id, label }) => (
              <button
                key={String(id)}
                onClick={() => setShowCode(id)}
                className={[
                  'px-3 py-1.5 text-xs cursor-pointer transition-colors',
                  showCode === id
                    ? 'bg-secondary text-foreground'
                    : 'bg-background text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sandpack */}
        <div
          className="absolute left-0 right-0 bottom-0"
          style={{ top: HEADER_H + TOGGLE_H, height: sandpackHeight }}
        >
          {mcdsError ? (
            <div style={{ padding: 24, color: 'crimson', fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: 13 }}>
              MCDS 파일을 불러오지 못했습니다.{'\n\n'}{mcdsError}
            </div>
          ) : !hifiReady ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: 14 }}>
              MCDS 에셋 로딩 중…
            </div>
          ) : (
            <SandpackProvider
              template={type === 'hifi' ? 'react-ts' : 'react'}
              files={sandpackFiles}
              theme="dark"
              customSetup={{
                dependencies: {
                  react: '^18',
                  'react-dom': '^18',
                  ...(type === 'hifi' && { antd: '6.3.3', reactflow: '^11', dagre: '^0.8.5' }),
                },
              }}
              options={{
                bundlerTimeOut: 120000,
                experimental_enableServiceWorker: true,
              }}
            >
              <SandpackContent showCode={showCode} height={sandpackHeight} />
            </SandpackProvider>
          )}
        </div>

      </div>
    </>
  )
}
