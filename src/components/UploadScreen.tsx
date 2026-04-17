'use client'

import { useRef, useState, useCallback } from 'react'

interface UploadScreenProps {
  onAnalyze: (text: string, fileName: string) => void
  error: string | null
}

export default function UploadScreen({ onAnalyze, error }: UploadScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [localError, setLocalError] = useState('')

  // 파일 선택 처리
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    setFile(files[0])
    setLocalError('')
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  // 파일 파싱 후 분석 시작
  async function handleSubmit() {
    if (!file) return
    setParsing(true)
    setLocalError('')

    try {
      let text = ''

      if (
        file.name.endsWith('.md') ||
        file.type === 'text/plain' ||
        file.type === 'text/markdown'
      ) {
        text = await file.text()
      } else if (file.type === 'application/pdf') {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData })
        if (!res.ok) throw new Error('PDF 파싱 실패')
        const data = await res.json() as { text: string }
        text = data.text
      } else {
        throw new Error('PDF 또는 Markdown(.md) 파일만 지원합니다')
      }

      if (!text.trim()) throw new Error('파일에서 텍스트를 추출하지 못했습니다')
      onAnalyze(text, file.name)
    } catch (e) {
      setLocalError((e as Error).message)
      setParsing(false)
    }
  }

  const displayError = localError || error

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex flex-col items-center justify-center px-6">
      {/* 로고 */}
      <div className="mb-10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M9 12l2 2 4-4" />
            <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
          </svg>
        </div>
        <span className="text-2xl font-bold text-white tracking-tight">Preflight</span>
        <span className="text-xs text-slate-500 mt-1">by Musinsa</span>
      </div>

      <h1 className="text-3xl font-bold text-white text-center mb-4">
        디자인 진행 전, 먼저 확인해 보세요
      </h1>
      <p className="text-slate-400 text-center mb-10 text-sm">
        PDF나 MD 파일로 PRD를 올리면, AI가 UI를 구현하기에 내용이 충분한지 자동으로 확인해줍니다
      </p>

      {/* 드래그 앤 드롭 업로드 영역 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={[
          'w-full max-w-xl border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all',
          dragging
            ? 'border-violet-500 bg-violet-500/10'
            : 'border-slate-700 bg-slate-900/50 hover:border-violet-600 hover:bg-slate-900',
        ].join(' ')}
        onClick={() => !file && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.md,.txt"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {file ? (
          <>
            <div className="w-14 h-14 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold">{file.name}</p>
              <p className="text-slate-500 text-sm mt-1">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null) }}
              className="text-xs text-slate-500 hover:text-slate-300 underline mt-1"
            >
              다른 파일 선택
            </button>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-slate-300 font-medium">파일을 드래그하거나 클릭해서 업로드</p>
              <p className="text-slate-600 text-sm mt-1">PDF, MD, TXT 지원 · 최대 10MB</p>
            </div>
          </>
        )}
      </div>

      {displayError && (
        <p className="mt-3 text-sm text-red-400 text-center">{displayError}</p>
      )}

      {file && (
        <button
          onClick={handleSubmit}
          disabled={parsing}
          className="mt-6 w-full max-w-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold py-4 rounded-xl transition-all text-base shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2"
        >
          {parsing ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              파일 파싱 중…
            </>
          ) : (
            'PRD 분석 시작 →'
          )}
        </button>
      )}

      <div className="mt-8 flex gap-6 text-xs text-slate-400">
        <span>✓ 화면 인벤토리 검증</span>
        <span>✓ 엣지케이스 탐지</span>
        <span>✓ 목업 자동 생성</span>
      </div>

      <p className="mt-12 text-xs text-slate-500">
        문의: MSSnP Product Design/MSSnP Commerce Core Design{' '}
        <a href="https://musinsa.slack.com/team/U08KNDY6HJ5" target="_blank" rel="noreferrer" className="hover:text-slate-500 underline">
          김선경
        </a>
      </p>
    </div>
  )
}
