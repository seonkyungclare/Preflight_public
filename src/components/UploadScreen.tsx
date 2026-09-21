'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
// astryx 실제 디자인시스템 컴포넌트 (StyleX 런타임 + astryx.css)
import { Button as AstryxButton } from '@astryxdesign/core/Button'
import { Banner } from '@astryxdesign/core/Banner'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { releaseNotes } from '@/config/release-notes'
import { TEMPLATE_OPTIONS, isSelectableTemplate, type PrdTemplateId } from '@/config/prd-template'
import {
  listEntries,
  deleteEntry,
  clearAll,
  formatHistoryDate,
  type HistoryEntry,
} from '@/lib/analysis-history'

interface UploadScreenProps {
  onAnalyze: (text: string, fileName: string, template: PrdTemplateId) => void
  error: string | null
  onRestoreHistory?: (entry: HistoryEntry) => void
}

const MAX_FILES = 3
// 마지막으로 고른 팀 템플릿을 기억한다. 기본값은 두지 않는다 — 잘못된 기준으로 채점된 결과가
// 그대로 공유되는 사고를 막기 위해, 사용자가 매번 눈으로 확인하고 지나가게 한다.
const TEMPLATE_STORAGE_KEY = 'preflight_template'

export default function UploadScreen({ onAnalyze, error, onRestoreHistory }: UploadScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [parsing, setParsing] = useState(false)
  const [localError, setLocalError] = useState('')
  const [showBuildInfo, setShowBuildInfo] = useState(false)
  const [confluenceUrl, setConfluenceUrl] = useState('')
  const [atlassianConnected, setAtlassianConnected] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  // PRD 가져올 방법: 인풋 좌측 셀렉트로 택1
  const [mode, setMode] = useState<'url' | 'file'>('url')
  const [template, setTemplate] = useState<PrdTemplateId | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TEMPLATE_STORAGE_KEY)
      // 이후 비활성화된 옵션(commerce-core)이 저장돼 있으면 무시
      if (isSelectableTemplate(saved)) setTemplate(saved)
    } catch {
      // 프라이빗 모드 등 — 기억 기능만 비활성
    }
  }, [])

  function selectTemplate(id: PrdTemplateId) {
    setTemplate(id)
    setLocalError('')
    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, id)
    } catch {
      // 무시
    }
  }

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
      .then((d: { connected: boolean }) => {
        if (!cancelled) setAtlassianConnected(d.connected)
      })
      .catch(() => { if (!cancelled) setAtlassianConnected(false) })

    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { email?: string } | null) => { if (!cancelled && d?.email) setUserEmail(d.email) })
      .catch(() => {})

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

  // Atlassian 계정이 곧 Preflight 접근 인증 수단이므로 로그아웃하면 로그인 화면으로 돌아간다
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
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
    if (!template) {
      setLocalError('먼저 어떤 팀 템플릿으로 검증할지 선택해주세요')
      return
    }
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
      onAnalyze(combined, combinedName, template)
    } catch (e) {
      setLocalError((e as Error).message)
      setParsing(false)
    }
  }

  async function handleUrlSubmit() {
    if (!confluenceUrl.trim()) return
    if (!template) {
      setLocalError('먼저 어떤 팀 템플릿으로 검증할지 선택해주세요')
      return
    }
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

      onAnalyze(`=== ${title} ===\n${text}`, title, template)
    } catch (e) {
      setLocalError((e as Error).message)
      setParsing(false)
    }
  }

  const displayError = localError || error
  const canAddMore = files.length < MAX_FILES

  return (
    <div data-astryx-theme="neutral" className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative [&_button]:rounded-md">
      {/* 좌측 상단 — 로그인 계정 */}
      {userEmail && (
        <div className="absolute top-4 left-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate max-w-[220px]">{userEmail}</span>
          <button
            onClick={handleLogout}
            className="hover:text-foreground underline underline-offset-2"
          >
            로그아웃
          </button>
        </div>
      )}

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
        팀을 고르고 Confluence 페이지나 PDF·MD 파일을 올리면, <br/>
        AI가 PRD 템플릿 기준으로 빠진 항목을 찾고 Lo-Fi·Hi-Fi 목업까지 만들어줍니다.
      </p>

      <div className="w-full max-w-xl">
        {/* 팀 템플릿 선택 (필수). 채점 기준이 갈리므로 URL·파일 입력보다 먼저 고른다 */}
        <div role="radiogroup" aria-label="PRD 템플릿" className="grid grid-cols-3 gap-3 mb-5">
          {TEMPLATE_OPTIONS.map(opt => {
            const selected = template === opt.id
            const disabled = !!opt.disabled
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={disabled}
                disabled={disabled}
                onClick={() => !disabled && selectTemplate(opt.id)}
                className={[
                  'flex items-center justify-between gap-2 rounded-xl border px-4 py-3.5 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  disabled
                    ? 'border-border opacity-40 cursor-not-allowed'
                    : selected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-accent',
                ].join(' ')}
              >
                <span className="text-sm font-semibold truncate">{opt.label}</span>
                <span
                  className={[
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                    selected ? 'border-primary' : 'border-muted-foreground/40',
                  ].join(' ')}
                  aria-hidden
                >
                  {selected && <span className="w-2 h-2 rounded-full bg-primary" />}
                </span>
              </button>
            )
          })}
        </div>

        <div
          className={template ? '' : 'opacity-50 pointer-events-none select-none'}
          aria-disabled={!template}
        >
        {/* 가져올 방법: 좌측 셀렉트(URL / File) + 우측 입력 박스 한 줄 */}
        <div className="flex gap-2">
          <div className="relative shrink-0">
            <select
              value={mode}
              onChange={(e) => { setMode(e.target.value as 'url' | 'file'); setLocalError('') }}
              aria-label="PRD 가져올 방법"
              className="h-11 pl-3 pr-8 text-sm font-medium rounded-md border border-border bg-background appearance-none outline-none focus:border-primary cursor-pointer"
            >
              <option value="url">URL</option>
              <option value="file">File</option>
            </select>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>

          {mode === 'url' ? (
            <input
              type="url"
              value={confluenceUrl}
              onChange={(e) => { setConfluenceUrl(e.target.value); setLocalError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter' && atlassianConnected && confluenceUrl.trim() && !parsing) handleUrlSubmit() }}
              disabled={!atlassianConnected}
              placeholder={
                atlassianConnected
                  ? 'https://wiki.team.musinsa.com/wiki/spaces/.../pages/123456789/...'
                  : 'Atlassian 계정을 먼저 연결해주세요'
              }
              className="flex-1 min-w-0 h-11 px-3 text-sm bg-background border border-border rounded-md outline-none focus:border-primary placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed"
            />
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-label="파일 선택"
              onClick={() => canAddMore && inputRef.current?.click()}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && canAddMore) { e.preventDefault(); inputRef.current?.click() } }}
              onDragOver={(e) => { e.preventDefault(); if (canAddMore) setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { if (canAddMore) onDrop(e); else e.preventDefault() }}
              className={[
                'flex-1 min-w-0 h-11 flex items-center gap-2 px-3 text-sm rounded-md border border-dashed transition-colors outline-none focus-visible:border-primary',
                dragging ? 'border-primary bg-primary/5' : 'border-border bg-background',
                canAddMore ? 'cursor-pointer hover:border-primary/60' : 'cursor-not-allowed opacity-60',
              ].join(' ')}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.md,.txt"
                multiple
                className="hidden"
                onChange={(e) => { addFiles(e.target.files); if (inputRef.current) inputRef.current.value = '' }}
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0" aria-hidden>
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                <path d="M12 12v9" />
                <path d="m16 16-4-4-4 4" />
              </svg>
              <span className={`truncate ${files.length > 0 ? '' : 'text-muted-foreground'}`}>
                {files.length > 0
                  ? files.map(f => f.name).join(', ')
                  : canAddMore
                    ? `파일을 선택하거나 드래그 (PDF · MD · TXT, 최대 ${MAX_FILES}개)`
                    : `최대 ${MAX_FILES}개까지 업로드 가능`}
              </span>
            </div>
          )}
        </div>

        {/* URL 모드 — Atlassian 미연결 시 연결 버튼 */}
        {mode === 'url' && atlassianConnected === false && (
          <AstryxButton
            variant="secondary"
            size="lg"
            label="Atlassian 계정 연결"
            onClick={() => { window.location.href = '/api/auth/atlassian/login' }}
            style={{ width: '100%', marginTop: 12 }}
          />
        )}

        {/* File 모드 — 선택된 파일 목록 */}
        {mode === 'file' && files.length > 0 && (
          <ul className="mt-3 space-y-2">
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

        {/* 분석 시작 */}
        {mode === 'url' && atlassianConnected && confluenceUrl.trim() && (
          <AstryxButton
            variant="primary"
            size="lg"
            label={parsing ? '페이지 가져오는 중…' : 'PRD 분석 시작 →'}
            isLoading={parsing}
            onClick={handleUrlSubmit}
            style={{ width: '100%', marginTop: 12 }}
          />
        )}
        {mode === 'file' && files.length > 0 && (
          <AstryxButton
            variant="primary"
            size="lg"
            label={parsing ? '파일 파싱 중…' : `PRD 분석 시작 → (${files.length}개)`}
            isLoading={parsing}
            onClick={handleFileSubmit}
            style={{ width: '100%', marginTop: 12 }}
          />
        )}
        </div>

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
