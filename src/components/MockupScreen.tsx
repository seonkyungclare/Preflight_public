'use client'

import { useState } from 'react'
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
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
const SIDEBAR_W = 224

export default function MockupScreen({ code, analysis, type, onBack }: MockupScreenProps) {
  const [showCode, setShowCode] = useState(false)

  const missingScreens = analysis.missing_for_designers.map((item) => item.screen)

  function handleCopyCode() {
    navigator.clipboard.writeText(code).catch(() => {})
  }

  // Sandpack 높이: 뷰포트에서 헤더 + 토글바를 뺀 값
  const sandpackHeight = `calc(100vh - ${HEADER_H + TOGGLE_H}px)`

  return (
    <>
      {/* 전체 페이지를 뷰포트에 고정 */}
      <style>{`html, body { margin: 0; padding: 0; overflow: hidden; height: 100%; }`}</style>

      <div style={{ position: 'fixed', inset: 0, background: '#0a0e1a', color: '#ffffff', fontFamily: 'sans-serif' }}>

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

        {/* ── 사이드바 ── */}
        <div style={{
          position: 'absolute', top: HEADER_H, left: 0, bottom: 0, width: SIDEBAR_W,
          borderRight: '1px solid #1e293b', padding: 16, overflowY: 'auto',
        }}>
          <p style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, marginTop: 0 }}>
            화면 목록
          </p>
          <button style={{
            width: '100%', textAlign: 'left', fontSize: 14, padding: '10px 12px',
            borderRadius: 12, background: 'rgba(139,92,246,0.15)', color: '#c4b5fd',
            border: '1px solid rgba(109,40,217,0.4)', cursor: 'pointer',
          }}>
            생성된 핵심 화면
          </button>
          {missingScreens.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #1e293b' }}>
              <p style={{ fontSize: 11, color: '#475569', marginBottom: 8, marginTop: 0 }}>누락 화면 (미구현)</p>
              {missingScreens.map((screen, i) => (
                <div key={i} style={{ fontSize: 12, color: '#d97706', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>⚠</span><span>{screen}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 토글바 ── */}
        <div style={{
          position: 'absolute', top: HEADER_H, left: SIDEBAR_W, right: 0, height: TOGGLE_H,
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
          left: SIDEBAR_W,
          right: 0,
          bottom: 0,
          height: sandpackHeight,
        }}>
          <SandpackProvider
            template="react"
            files={{ '/App.js': code }}
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
            <SandpackLayout style={{ height: '1300px', borderRadius: 0, border: 'none', margin: 0 }}>
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
          </SandpackProvider>
        </div>

      </div>
    </>
  )
}
