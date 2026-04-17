'use client'

import { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

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

  async function handleSubmit() {
    if (!file) return
    setParsing(true)
    setLocalError('')

    try {
      let text = ''

      if (file.name.endsWith('.md') || file.type === 'text/plain' || file.type === 'text/markdown') {
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
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      {/* 로고 */}
      <div className="mb-10 flex items-center gap-2">
        <span className="text-2xl font-bold tracking-tight">Preflight</span>
        <span className="text-xs text-muted-foreground mt-1">by Musinsa</span>
      </div>

      <h1 className="text-3xl font-bold text-center mb-4">
        디자인 전, 목업으로 먼저 확인해 보세요
      </h1>
      <p className="text-muted-foreground text-center mb-10 text-sm">
        PDF나 MD 파일로 PRD를 올리면, AI가 UI를 구현하기에 내용이 충분한지 자동으로 확인해줍니다
      </p>

      {/* 드래그 앤 드롭 업로드 영역 */}
      <Card
        className={[
          'w-full max-w-xl border-2 border-dashed cursor-pointer transition-all outline-none',
          dragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50',
        ].join(' ')}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !file && inputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.md,.txt"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {file ? (
            <>
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-primary">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold">{file.name}</p>
                <p className="text-muted-foreground text-sm mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setFile(null) }}
                className="text-muted-foreground text-xs"
              >
                다른 파일 선택
              </Button>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-primary">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                  <path d="M12 12v9" />
                  <path d="m16 16-4-4-4 4" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-medium">파일을 드래그하거나 클릭해서 업로드</p>
                <p className="text-muted-foreground text-sm mt-1">PDF, MD, TXT 지원 · 최대 10MB</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {displayError && (
        <Alert variant="destructive" className="mt-3 w-full max-w-xl">
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      {file && (
        <Button
          onClick={handleSubmit}
          disabled={parsing}
          className="mt-6 w-full max-w-xl py-6 text-base font-semibold"
          size="lg"
        >
          {parsing ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              파일 파싱 중…
            </span>
          ) : (
            'PRD 분석 시작 →'
          )}
        </Button>
      )}

      <div className="mt-8 flex gap-6 text-xs text-muted-foreground">
        <span>✓ 화면 인벤토리 검증</span>
        <span>✓ 엣지케이스 탐지</span>
        <span>✓ 목업 자동 생성</span>
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        문의: MSSnP Product Design/MSSnP Commerce Core Design{' '}
        <a href="https://musinsa.slack.com/team/U08KNDY6HJ5" target="_blank" rel="noreferrer" className="text-foreground/70 hover:text-foreground underline">
          김선경
        </a>
      </p>

      {process.env.NEXT_PUBLIC_BUILD_TIME && (
        <p className="mt-2 text-xs text-muted-foreground">
          배포일: {new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      )}
    </div>
  )
}
