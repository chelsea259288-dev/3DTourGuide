import { useCallback, useState } from 'react'

const KEY = '3dtourguide-recent-scenes'
const MAX = 6

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

export function useRecentScenes() {
  const [ids, setIds] = useState<string[]>(() =>
    typeof window === 'undefined' ? [] : readIds(),
  )

  const recordVisit = useCallback((sceneId: string) => {
    setIds((prev) => {
      const next = [
        sceneId,
        ...prev.filter((id) => id !== sceneId),
      ].slice(0, MAX)
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* ignore quota */
      }
      return next
    })
  }, [])

  return { recentIds: ids, recordVisit }
}
