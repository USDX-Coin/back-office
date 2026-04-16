import { useSearchParams } from 'react-router'

/**
 * URL-state hook for tables that compose their own filter toolbar.
 * Reads page/sortBy/sortOrder/search; provides a helper to update params atomically.
 */
export function useDataTableParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page') || '1')
  const search = searchParams.get('search') || ''
  const sortBy = searchParams.get('sortBy') || ''
  const sortOrder = searchParams.get('sortOrder') || 'desc'

  function updateParams(updates: Record<string, string | null>) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(updates).forEach(([key, value]) => {
        if (value) next.set(key, value)
        else next.delete(key)
      })
      return next
    })
  }

  function clearAll() {
    setSearchParams(new URLSearchParams())
  }

  return { searchParams, page, search, sortBy, sortOrder, updateParams, clearAll }
}
