const DB_NAME = 'preflight'
const DB_VERSION = 1
const STORE = 'analyses'
const MAX_ENTRIES = 10

export interface HistoryEntry {
  id: string
  createdAt: number
  fileName: string
  prdText: string
  analysis: unknown
  mockupFilesLowFi: Record<string, string> | null
  mockupFilesHiFi: Record<string, string> | null
  mockupLowFiAt: number | null
  mockupHiFiAt: number | null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('이 브라우저는 IndexedDB를 지원하지 않습니다'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveEntry(entry: HistoryEntry): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  // 최신 MAX_ENTRIES개만 유지
  const all = await listEntries()
  if (all.length > MAX_ENTRIES) {
    const toRemove = all.slice(MAX_ENTRIES)
    for (const e of toRemove) {
      await deleteEntry(e.id)
    }
  }
}

export async function listEntries(): Promise<HistoryEntry[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => {
      const entries = req.result as HistoryEntry[]
      entries.sort((a, b) => b.createdAt - a.createdAt)
      resolve(entries)
    }
    req.onerror = () => reject(req.error)
  })
}

// 저장된 기록 중 내용이 완전히 같은 것을 찾는다.
//
// ⚠️ 왜 필요한가: AI는 같은 글을 넣어도 매번 똑같이 답하지 않는다. 실측에서
// 같은 문서를 9번 넣었더니 기본 점수가 56~58로, 화면 총점은 56~61로 나왔다.
// "한 글자도 안 고쳤는데 점수가 다르다"는 이 도구의 신뢰를 가장 크게 깎는
// 상황이라, 내용이 같으면 새로 채점하지 않고 저장된 결과를 그대로 쓴다.
// (변경 기록 24번)
//
// 비교 전에 다듬는 것 두 가지. 그 외에는 한 글자만 달라도 다른 문서로 본다 —
// 정책 한 줄을 고쳤으면 다시 채점되는 것이 맞다.
//
// ① 앞뒤 공백 — 파일을 다시 내보내면 흔히 생긴다
// ② 파일명 머리글(`=== 파일이름.md ===`) — 업로드 화면이 본문 앞에 붙인다.
//    이걸 안 걷어내면 "Wave4_v2.md"를 "Wave4_최종.md"로 이름만 바꿔 올렸을 때
//    내용이 같은데도 새로 채점돼 점수가 달라진다. 채점 대상은 내용이지 파일명이 아니다.
function normalizeForCompare(text: string): string {
  return text
    .split('\n')
    .filter(line => !/^===\s.*\s===$/.test(line.trim()))
    .join('\n')
    .trim()
}

export async function findSameContent(prdText: string): Promise<HistoryEntry | null> {
  const target = normalizeForCompare(prdText)
  if (!target) return null
  try {
    const entries = await listEntries()
    return entries.find(e => normalizeForCompare(e.prdText ?? '') === target) ?? null
  } catch {
    // 기록 조회가 실패해도 분석 자체는 막지 않는다
    return null
  }
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearAll(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function formatHistoryDate(timestamp: number): string {
  const d = new Date(timestamp)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (isToday) return `오늘 ${hh}:${mm}`
  if (isYesterday) return `어제 ${hh}:${mm}`
  const yyyy = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mo}-${dd} ${hh}:${mm}`
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
