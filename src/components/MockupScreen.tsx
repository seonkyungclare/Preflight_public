'use client'

import { useState, useEffect, useRef } from 'react'
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

  function handleCopyCode() {
    navigator.clipboard.writeText(files['/App.js'] ?? '').catch(() => {})
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
          <SandpackProvider
            template="react"
            files={files}
            theme="dark"
            customSetup={{
              dependencies: {
                react: '^18',
                'react-dom': '^18',
                ...(type === 'hifi' && { antd: '^5', '@ant-design/icons': '^5' }),
              },
            }}
          >
            <SandpackContent showCode={showCode} height={sandpackHeight} />
          </SandpackProvider>
        </div>

      </div>
    </>
  )
}
