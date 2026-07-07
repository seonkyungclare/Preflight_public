'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
// astryx 실제 디자인시스템 컴포넌트 (StyleX 런타임 + astryx.css)
import { Button as AstryxButton } from '@astryxdesign/core/Button'
import { Card as AstryxCard } from '@astryxdesign/core/Card'
import { TabList, Tab } from '@astryxdesign/core/TabList'
import { Banner } from '@astryxdesign/core/Banner'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { releaseNotes } from '@/config/release-notes'
import {
  listEntries,
  deleteEntry,
  clearAll,
  formatHistoryDate,
  type HistoryEntry,
} from '@/lib/analysis-history'

interface UploadScreenProps {
  onAnalyze: (text: string, fileName: string) => void
  error: string | null
  onRestoreHistory?: (entry: HistoryEntry) => void
}

const MAX_FILES = 3

export default function UploadScreen({ onAnalyze, error, onRestoreHistory }: UploadScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [parsing, setParsing] = useState(false)
  const [localError, setLocalError] = useState('')
  const [showBuildInfo, setShowBuildInfo] = useState(false)
  const [confluenceUrl, setConfluenceUrl] = useState('')
  const [atlassianConnected, setAtlassianConnected] = useState<boolean | null>(null)
  const [atlassianCloudUrl, setAtlassianCloudUrl] = useState<string | undefined>(undefined)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  // astryx TabList 는 탭 스트립만 담당(controlled) — 활성 패널은 직접 상태로 관리
  const [tab, setTab] = useState<'confluence' | 'file'>('confluence')

  async function refreshHistory() {
    try {
      const entries = await listEntries()
      setHistory(entries)
    } catch (e) {
      console.error('[history] 조회 실패:', e)
    }
  }

  useEffect(() => {
    refreshHistory()
  }, [])

  async function handleDeleteEntry(id: string) {
    await deleteEntry(id)
    refreshHistory()
  }

  async function handleClearAll() {
    if (!confirm('저장된 모든 분석 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return
    await clearAll()
    refreshHistory()
  }

  function handleRestore(entry: HistoryEntry) {
    setShowHistory(false)
    onRestoreHistory?.(entry)
  }

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
    <div data-astryx-theme="neutral" className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative [&_button]:rounded-md">
      {/* 우측 상단 — 이전 분석 */}
      <button
        onClick={() => { refreshHistory(); setShowHistory(true) }}
        className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-accent transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.74 9.74 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l4 2" />
        </svg>
        이전 분석{history.length > 0 ? ` (${history.length})` : ''}
      </button>

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
        <TabList value={tab} onChange={(v) => setTab(v as 'confluence' | 'file')} layout="fill" className="mb-4">
          <Tab value="confluence" label="Confluence URL" />
          <Tab value="file" label="파일 업로드" />
        </TabList>

        {/* 파일 업로드 탭 */}
        {tab === 'file' && (
          <div className="space-y-4">
            <AstryxCard
              variant={dragging ? 'blue' : 'default'}
              padding={0}
              // 드롭존 시인성: astryx 기본 보더가 옅어 inline 점선 보더로 대체(inline 이 레이어보다 우선)
              style={{ borderStyle: 'dashed', borderWidth: 2, borderColor: 'var(--color-border-emphasized)' }}
              className={[
                'w-full outline-none transition-all',
                canAddMore ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
              ].join(' ')}
              onDragOver={(e) => { e.preventDefault(); if (canAddMore) setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { if (canAddMore) onDrop(e); else e.preventDefault() }}
              onClick={() => canAddMore && inputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-4 py-12">
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
              </div>
            </AstryxCard>

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
              <AstryxButton
                variant="primary"
                size="lg"
                label={parsing ? '파일 파싱 중…' : `PRD 분석 시작 → (${files.length}개)`}
                isLoading={parsing}
                onClick={handleFileSubmit}
                style={{ width: '100%' }}
              />
            )}
          </div>
        )}

        {/* Confluence URL 탭 */}
        {tab === 'confluence' && (
          <div className="space-y-4">
            <AstryxCard padding={0}>
              <div className="flex flex-col gap-4 py-8 px-6">
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
                  <AstryxButton
                    variant="secondary"
                    size="lg"
                    label="Atlassian 계정 연결"
                    onClick={() => { window.location.href = '/api/auth/atlassian/login' }}
                    style={{ width: '100%' }}
                  />
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
              </div>
            </AstryxCard>

            {atlassianConnected && confluenceUrl.trim() && (
              <AstryxButton
                variant="primary"
                size="lg"
                label={parsing ? '페이지 가져오는 중…' : 'PRD 분석 시작 →'}
                isLoading={parsing}
                onClick={handleUrlSubmit}
                style={{ width: '100%' }}
              />
            )}
          </div>
        )}

        {displayError && (
          <Banner status="error" title={displayError} className="mt-3" />
        )}
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
            배포일: {new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })}
          </p>
          <button
            onClick={() => setShowBuildInfo(true)}
            className="text-xs text-primary hover:underline underline-offset-2 transition-colors"
          >
            업데이트 되었어요
          </button>
        </div>
      )}

      <Dialog data-astryx-theme="neutral" isOpen={showBuildInfo} onOpenChange={setShowBuildInfo}>
        <DialogHeader title="업데이트 내역" onOpenChange={setShowBuildInfo} hasDivider />
        <div className="space-y-4 pt-1 max-h-80 overflow-y-auto scrollbar-hide">
            {releaseNotes.map((entry, i) => (
              <div key={i}>
                <p className="text-xs text-muted-foreground mb-1.5">{entry.date.replace(/^(\d{4})-(\d{1,2})-(\d{1,2})(.*)$/, (_, y, m, d, rest) => `${y}.${m}.${d}${rest}`)}</p>
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
      </Dialog>

      {/* 이전 분석 다이얼로그 */}
      <Dialog data-astryx-theme="neutral" isOpen={showHistory} onOpenChange={setShowHistory}>
        <DialogHeader title={`이전 분석 (${history.length})`} onOpenChange={setShowHistory} hasDivider />
        <div className="pt-1">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                저장된 분석이 없습니다
              </p>
            ) : (
              <>
                <ul className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-start gap-2 px-3 py-2.5 border border-border rounded-lg hover:bg-accent transition-colors group"
                    >
                      <button
                        onClick={() => handleRestore(entry)}
                        className="flex-1 text-left min-w-0 block"
                      >
                        <p className="text-sm font-medium break-words">{entry.fileName || '제목 없음'}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {entry.mockupFilesLowFi && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-muted text-muted-foreground shrink-0">
                              Lo-Fi
                            </span>
                          )}
                          {entry.mockupFilesHiFi && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border border-primary/30 bg-primary/10 text-primary shrink-0">
                              Hi-Fi
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatHistoryDate(entry.createdAt)}
                          </span>
                        </div>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry.id) }}
                        className="text-muted-foreground hover:text-destructive text-sm shrink-0 px-2 opacity-60 group-hover:opacity-100"
                        aria-label="삭제"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 pt-3 border-t border-border flex justify-end">
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    전체 삭제
                  </button>
                </div>
              </>
            )}
          </div>
      </Dialog>
    </div>
  )
}
