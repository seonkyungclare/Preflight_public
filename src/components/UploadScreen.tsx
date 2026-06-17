'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { releaseNotes } from '@/config/release-notes'

interface UploadScreenProps {
  onAnalyze: (text: string, fileName: string) => void
  error: string | null
}

const MAX_FILES = 3

export default function UploadScreen({ onAnalyze, error }: UploadScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [parsing, setParsing] = useState(false)
  const [localError, setLocalError] = useState('')
  const [showBuildInfo, setShowBuildInfo] = useState(false)
  const [confluenceUrl, setConfluenceUrl] = useState('')
  const [atlassianConnected, setAtlassianConnected] = useState<boolean | null>(null)
  const [atlassianCloudUrl, setAtlassianCloudUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/atlassian/status')
      .then(r => r.json())
      .then((d: { connected: boolean; cloudUrl?: string }) => {
        if (!cancelled) {
          setAtlassianConnected(d.connected)
          setAtlassianCloudUrl(d.cloudUrl)
        }
      })
      .catch(() => { if (!cancelled) setAtlassianConnected(false) })

    const url = new URL(window.location.href)
    const err = url.searchParams.get('atlassian_error')
    if (err) {
      setLocalError(`Atlassian 연결 실패: ${err}`)
      url.searchParams.delete('atlassian_error')
      window.history.replaceState(null, '', url.toString())
    } else if (url.searchParams.get('atlassian_connected')) {
      url.searchParams.delete('atlassian_connected')
      window.history.replaceState(null, '', url.toString())
    }
    return () => { cancelled = true }
  }, [])

  async function handleAtlassianLogout() {
    await fetch('/api/auth/atlassian/logout', { method: 'POST' })
    setAtlassianConnected(false)
    setAtlassianCloudUrl(undefined)
  }

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return
    setLocalError('')
    setFiles(prev => {
      const next = [...prev]
      for (let i = 0; i < incoming.length; i++) {
        const f = incoming[i]
        if (next.length >= MAX_FILES) {
          setLocalError(`최대 ${MAX_FILES}개까지 업로드할 수 있습니다`)
          break
        }
        if (next.some(p => p.name === f.name && p.size === f.size)) continue
        next.push(f)
      }
      return next
    })
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      addFiles(e.dataTransfer.files)
    },
    [addFiles]
  )

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setLocalError('')
  }

  async function parseFile(file: File): Promise<string> {
    if (file.name.endsWith('.md') || file.type === 'text/plain' || file.type === 'text/markdown') {
      return file.text()
    }
    if (file.type === 'application/pdf') {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/parse-pdf', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`PDF 파싱 실패: ${file.name}`)
      const data = await res.json() as { text: string }
      return data.text
    }
    throw new Error(`지원하지 않는 형식: ${file.name}`)
  }

  async function handleFileSubmit() {
    if (files.length === 0) return
    setParsing(true)
    setLocalError('')

    try {
      const parsed = await Promise.all(
        files.map(async f => ({ name: f.name, text: await parseFile(f) }))
      )

      const combined = parsed
        .map(p => `=== ${p.name} ===\n${p.text.trim()}`)
        .join('\n\n')

      if (!combined.trim()) throw new Error('파일에서 텍스트를 추출하지 못했습니다')

      const combinedName = files.length === 1 ? files[0].name : `${files.length}개 파일`
      onAnalyze(combined, combinedName)
    } catch (e) {
      setLocalError((e as Error).message)
      setParsing(false)
    }
  }

  async function handleUrlSubmit() {
    if (!confluenceUrl.trim()) return
    setParsing(true)
    setLocalError('')

    try {
      const res = await fetch('/api/fetch-confluence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: confluenceUrl.trim() }),
      })
      const data = await res.json() as { title?: string; text?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Confluence 페이지를 가져오지 못했습니다')

      const title = data.title ?? 'Confluence 페이지'
      const text = data.text ?? ''
      if (!text.trim()) throw new Error('페이지에서 텍스트를 추출하지 못했습니다')

      onAnalyze(`=== ${title} ===\n${text}`, title)
    } catch (e) {
      setLocalError((e as Error).message)
      setParsing(false)
    }
  }

  const displayError = localError || error
  const canAddMore = files.length < MAX_FILES

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* 로고 */}
      <div className="mb-10 flex items-center gap-2">
        <span className="text-2xl font-bold tracking-tight">Preflight</span>
        <span className="text-xs text-muted-foreground mt-1">by Musinsa</span>
      </div>

      <h1 className="text-3xl font-bold text-center mb-4">
        디자인 전, 목업으로 먼저 확인해 보세요
      </h1>
      <p className="text-muted-foreground text-center mb-10 text-sm">
        PDF나 MD 파일로 PRD를 올리면, AI가 UI를 구현하기에 내용이 충분한지 확인해줍니다. <br/>
        low-fi, high-fi 목업으로 확인할수 있어요.
      </p>

      <div className="w-full max-w-xl">
        <Tabs defaultValue="file">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="file" className="flex-1">파일 업로드</TabsTrigger>
            <TabsTrigger value="confluence" className="flex-1">Confluence URL</TabsTrigger>
          </TabsList>

          {/* 파일 업로드 탭 */}
          <TabsContent value="file" className="space-y-4">
            <Card
              className={[
                'w-full border-2 border-dashed outline-none transition-all',
                canAddMore ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
                dragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50',
              ].join(' ')}
              onDragOver={(e) => { e.preventDefault(); if (canAddMore) setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { if (canAddMore) onDrop(e); else e.preventDefault() }}
              onClick={() => canAddMore && inputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center gap-4 py-12">
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.md,.txt"
                  multiple
                  className="hidden"
                  onChange={(e) => { addFiles(e.target.files); if (inputRef.current) inputRef.current.value = '' }}
                />

                <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-primary">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                    <path d="M12 12v9" />
                    <path d="m16 16-4-4-4 4" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-medium">
                    {canAddMore ? '파일을 드래그하거나 클릭해서 업로드' : `최대 ${MAX_FILES}개까지 업로드 가능`}
                  </p>
                  <p className="text-muted-foreground text-sm mt-1">
                    PDF, MD, TXT 지원 · 최대 {MAX_FILES}개 파일 · 각 파일 10MB 이하
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 선택된 파일 목록 */}
            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-3 px-4 py-2.5 border border-border rounded-lg bg-card"
                  >
                    <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-primary shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <path d="M14 2v6h6" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-muted-foreground hover:text-foreground text-sm shrink-0 px-2"
                      aria-label="파일 제거"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {files.length > 0 && (
              <Button
                onClick={handleFileSubmit}
                disabled={parsing}
                className="w-full py-6 text-base font-semibold"
                size="lg"
              >
                {parsing ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    파일 파싱 중…
                  </span>
                ) : (
                  `PRD 분석 시작 → (${files.length}개)`
                )}
              </Button>
            )}
          </TabsContent>

          {/* Confluence URL 탭 */}
          <TabsContent value="confluence" className="space-y-4">
            <Card>
              <CardContent className="flex flex-col gap-4 py-8 px-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-primary shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Confluence 페이지 URL</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {atlassianConnected
                        ? (atlassianCloudUrl ?? 'Atlassian 연결됨')
                        : '먼저 Atlassian 계정 연결이 필요합니다'}
                    </p>
                  </div>
                  {atlassianConnected && (
                    <button
                      onClick={handleAtlassianLogout}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      연결 해제
                    </button>
                  )}
                </div>

                {atlassianConnected === false && (
                  <Button
                    onClick={() => { window.location.href = '/api/auth/atlassian/login' }}
                    variant="outline"
                    className="w-full"
                  >
                    Atlassian 계정 연결
                  </Button>
                )}

                {atlassianConnected && (
                  <input
                    type="url"
                    value={confluenceUrl}
                    onChange={(e) => { setConfluenceUrl(e.target.value); setLocalError('') }}
                    placeholder="https://wiki.team.musinsa.com/wiki/spaces/.../pages/123456789/..."
                    className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-md outline-none focus:border-primary placeholder:text-muted-foreground"
                  />
                )}
              </CardContent>
            </Card>

            {atlassianConnected && confluenceUrl.trim() && (
              <Button
                onClick={handleUrlSubmit}
                disabled={parsing}
                className="w-full py-6 text-base font-semibold"
                size="lg"
              >
                {parsing ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    페이지 가져오는 중…
                  </span>
                ) : (
                  'PRD 분석 시작 →'
                )}
              </Button>
            )}
          </TabsContent>
        </Tabs>

        {displayError && (
          <Alert variant="destructive" className="mt-3">
            <AlertDescription>{displayError}</AlertDescription>
          </Alert>
        )}
      </div>

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
        <div className="mt-2 flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            배포일: {new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <button
            onClick={() => setShowBuildInfo(true)}
            className="text-xs text-primary hover:underline underline-offset-2 transition-colors"
          >
            업데이트 되었어요
          </button>
        </div>
      )}

      <Dialog open={showBuildInfo} onOpenChange={setShowBuildInfo}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">업데이트 내역</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1 max-h-80 overflow-y-auto">
            {releaseNotes.map((entry, i) => (
              <div key={i}>
                <p className="text-xs text-muted-foreground mb-1.5">{entry.date}</p>
                <ul className="space-y-1">
                  {entry.changes.map((change, j) => (
                    <li key={j} className="text-sm text-foreground/80 flex gap-2">
                      <span className="text-primary shrink-0">·</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
