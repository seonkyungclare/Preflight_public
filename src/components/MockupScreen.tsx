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

interface MockupScreenProps {
  code: string
  analysis: AnalysisResult
  type: MockupType
  onBack: () => void
}

const HEADER_H = 57
const TOGGLE_H = 41

// Sandpack 로딩 중 스켈레톤 오버레이 — useSandpack은 SandpackProvider 내부에서만 사용 가능
function SandpackContent({ showCode, height }: { showCode: boolean; height: string }) {
  const { sandpack } = useSandpack()
  const [ready, setReady] = useState(false)

  // 'initial' → 'running' 전환 시 짧은 딜레이 후 스켈레톤 제거
  // React 앱은 status가 'running'에서 변하지 않으므로 running 진입 시점을 트리거로 사용
  useEffect(() => {
    if (sandpack.status === 'running' || sandpack.status === 'idle') {
      const t = setTimeout(() => setReady(true), 800)
      return () => clearTimeout(t)
    }
  }, [sandpack.status])

  // 최대 20초 후 강제 제거 (상태 전환이 없는 경우 대비)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 20000)
    return () => clearTimeout(t)
  }, [])

  const isLoading = !ready

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

      {/* 로딩 중 스켈레톤 오버레이 */}
      {isLoading && !showCode && (
        <div style={{
          position: 'absolute', inset: 0,
          background: '#f8fafc',
          padding: '24px 20px',
          display: 'flex', flexDirection: 'column', gap: 12,
          zIndex: 10, pointerEvents: 'none',
        }}>
          {[
            { w: '55%', h: 28 },
            { w: '90%', h: 14 },
            { w: '70%', h: 14 },
            { w: '100%', h: 72 },
            { w: '40%', h: 20 },
            { w: '85%', h: 14 },
            { w: '100%', h: 72 },
            { w: '60%', h: 14 },
            { w: '100%', h: 72 },
          ].map((s, i) => (
            <div key={i} style={{
              width: s.w, height: s.h,
              background: '#e2e8f0',
              borderRadius: 6,
              animation: `skeleton-pulse 1.5s ease-in-out ${i * 0.08}s infinite`,
            }} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function MockupScreen({ code, type, onBack }: MockupScreenProps) {
  const [showCode, setShowCode] = useState(false)

  function handleCopyCode() {
    navigator.clipboard.writeText(code).catch(() => {})
  }

  // Sandpack 높이: 뷰포트에서 헤더 + 토글바를 뺀 값
  const sandpackHeight = `calc(100vh - ${HEADER_H + TOGGLE_H}px)`

  return (
    <>
      {/* 전체 페이지를 뷰포트에 고정 */}
      <style>{`html, body { margin: 0; padding: 0; overflow: hidden; height: 100%; } @keyframes skeleton-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      <div style={{ position: 'fixed', inset: 0, background: '#0a0e1a', color: 'white', fontFamily: 'sans-serif' }}>

        {/* ── 헤더 ── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: HEADER_H,
          borderBottom: '1px solid #1e293b',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M9 12l2 2 4-4" />
                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 18 }}>Preflight</span>
            <span style={{ color: '#475569' }}>·</span>
            <span style={{ fontSize: 14, color: '#94a3b8' }}>목업 미리보기</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCopyCode} style={{
              fontSize: 14, color: '#94a3b8', border: '1px solid #334155',
              background: 'transparent', padding: '8px 16px', borderRadius: 8,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              코드 복사
            </button>
            <button onClick={onBack} style={{
              fontSize: 14, color: '#a78bfa', border: '1px solid #4c1d95',
              background: 'transparent', padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            }}>
              ✕ 닫기
            </button>
          </div>
        </div>

        {/* ── 토글바 ── */}
        <div style={{
          position: 'absolute', top: HEADER_H, left: 0, right: 0, height: TOGGLE_H,
          borderBottom: '1px solid #1e293b',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 16px',
        }}>
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #334155' }}>
            {[{ id: false, label: '미리보기' }, { id: true, label: '코드' }].map(({ id, label }) => (
              <button key={String(id)} onClick={() => setShowCode(id)} style={{
                padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                background: showCode === id ? '#334155' : '#0f172a',
                color: showCode === id ? 'white' : '#64748b',
                border: 'none',
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Sandpack ── */}
        <div style={{
          position: 'absolute',
          top: HEADER_H + TOGGLE_H,
          left: 0,
          right: 0,
          bottom: 0,
          height: sandpackHeight,
        }}>
          <SandpackProvider
            template="react"
            files={{
              '/App.js': code,
            }}
            theme="dark"
            customSetup={{
              dependencies: {
                react: '^18',
                'react-dom': '^18',
                // hi-fi는 antd 의존성 추가
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
