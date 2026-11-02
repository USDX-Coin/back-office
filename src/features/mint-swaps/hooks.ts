import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchRaw } from '@/lib/apiFetch'
import { buildMintSwapResolveBody, isMintSwapStaleError, type MintSwapResolveInput } from '@/lib/mintSwaps'
import { useApprovals } from '@/features/approvals/hooks'
import type {
  MintSwapDetail,
  MintSwapListItem,
  MintSwapStatus,
  PhaseOnePaginatedResponse,
  ResolveMintSwapResult,
} from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// D29 — Swap IDR→USD (`sot/api/mint-swaps.yaml`, `bni-integration.md § 21.6, § 21.9`).
//
//   GET list + detail   STAFF / MANAGER / ADMIN / DEVELOPER
//   POST resolve        MANAGER / ADMIN  (SETTLED_MANUAL → 202, usulan maker-checker)
//
// Backend sudah di `dev` (backend#380, USDX-790) — di browser `pnpm dev` rutenya
// ke server asli (`INTEGRATION_PATHS`); handler MSW tetap untuk Vitest.
// ─────────────────────────────────────────────────────────────────────────────

const PATH = '/api/v1/mint-swaps'

export interface MintSwapFilters {
  page?: number
  take?: number
  status?: MintSwapStatus
  /** Tanggal WIB `YYYY-MM-DD`, inklusif (`queuedAt`). */
  from?: string
  to?: string
}

export function buildMintSwapQuery(filters: MintSwapFilters): string {
  const sp = new URLSearchParams()
  if (filters.page !== undefined) sp.set('page', String(filters.page))
  if (filters.take !== undefined) sp.set('take', String(filters.take))
  if (filters.status) sp.set('status', filters.status)
  if (filters.from) sp.set('from', filters.from)
  if (filters.to) sp.set('to', filters.to)
  return sp.toString()
}

export function useMintSwaps(filters: MintSwapFilters) {
  return useQuery({
    queryKey: ['mint-swaps', 'list', filters],
    queryFn: () => apiFetchRaw<PhaseOnePaginatedResponse<MintSwapListItem>>(`${PATH}?${buildMintSwapQuery(filters)}`),
    refetchOnWindowFocus: false,
  })
}

export function useMintSwapDetail(id: string | null) {
  return useQuery({
    queryKey: ['mint-swaps', 'detail', id],
    queryFn: () => apiFetch<MintSwapDetail>(`${PATH}/${id}`),
    enabled: Boolean(id),
    refetchOnWindowFocus: false,
    retry: false,
  })
}

/**
 * Usulan `SETTLED_MANUAL` yang masih menunggu orang kedua, per id swap.
 *
 * Detail swap tidak membawa tanda "usulan menunggu" (kontrak diam), jadi dibaca
 * dari antrean Persetujuan Orang Kedua (`GET /api/v1/approvals`, semua peran):
 * `actionType = MINT_SWAP_SETTLED_MANUAL`, `status = PENDING`, `payload.mintSwapId`.
 *
 * `known = false` selama antrean itu belum terbaca (memuat, gagal, ATAU sedang ditarik ulang):
 * `bySwap` kosong atau basi di situ BUKAN berarti "tidak ada usulan", jadi pemanggil tidak boleh
 * menawarkan aksi.
 */
export function usePendingSettledManual() {
  const q = useApprovals({ status: 'PENDING', actionType: 'MINT_SWAP_SETTLED_MANUAL', take: 100, page: 1 })
  const bySwap = new Map<string, string>()
  for (const a of q.data?.data ?? []) {
    const swapId = (a.payload as { mintSwapId?: unknown }).mintSwapId
    if (typeof swapId === 'string') bySwap.set(swapId, a.id)
  }
  return { bySwap, known: q.isSuccess && !q.isFetching, isError: q.isError, refetch: q.refetch }
}

function invalidateAfterResolve(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['mint-swaps'] })
  qc.invalidateQueries({ queryKey: ['queue-counts'] })
  qc.invalidateQueries({ queryKey: ['approvals', 'list'] })
}

/**
 * `POST /api/v1/mint-swaps/:id/resolve`. Isian divalidasi DI SINI juga — gerbang
 * yang hanya hidup di dialog dilewati pemanggil lain. 409 yang berarti keadaan
 * berubah (`ALREADY_RESOLVED`, `ACTION_NOT_ALLOWED`, `APPROVAL_ALREADY_PENDING`)
 * menarik ulang detail + antrean + badge.
 */
export function useResolveMintSwap() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MintSwapResolveInput }) => {
      const result = buildMintSwapResolveBody(input)
      if (!result.valid) {
        const e = result.errors
        return Promise.reject(new Error(e.reason ?? e.externalRef ?? e.creditedUsd ?? 'Isian tidak valid'))
      }
      return apiFetch<ResolveMintSwapResult>(`${PATH}/${id}/resolve`, { method: 'POST', body: result.body })
    },
    onSuccess: () => invalidateAfterResolve(qc),
    onError: (err) => {
      if (isMintSwapStaleError(err)) invalidateAfterResolve(qc)
    },
  })
}
