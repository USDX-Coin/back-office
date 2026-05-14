import { useEffect, useMemo, useState } from 'react'
import type { VisibilityState } from '@tanstack/react-table'
import type { ColumnConfig } from './types'

const STORAGE_PREFIX = 'usdx:cols:'

// USDX-27: per-table column-visibility state with localStorage persistence
// (per browser/device — not BE-stored, scope deferred). The initial value is
// derived from the columns' `hiddenByDefault` flag; user toggles overlay.
export function useColumnVisibility(
  tableKey: string,
  columns: ColumnConfig[],
): [VisibilityState, (next: VisibilityState) => void] {
  const defaults = useMemo<VisibilityState>(() => {
    const map: VisibilityState = {}
    for (const c of columns) map[c.key] = !c.hiddenByDefault
    return map
  }, [columns])

  const [visibility, setVisibility] = useState<VisibilityState>(() => {
    if (typeof window === 'undefined') return defaults
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + tableKey)
      if (!raw) return defaults
      const parsed = JSON.parse(raw) as VisibilityState
      // Re-merge with defaults so newly-introduced columns start visible.
      return { ...defaults, ...parsed }
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_PREFIX + tableKey, JSON.stringify(visibility))
    } catch {
      // localStorage unavailable (private mode, quota) — degrade silently;
      // the in-memory state still works for the session.
    }
  }, [tableKey, visibility])

  return [visibility, setVisibility]
}
