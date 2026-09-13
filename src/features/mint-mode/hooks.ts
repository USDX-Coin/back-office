import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/apiFetch'
import type { MintModeConfig, SetMintModeBody } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// USDX-639 — mode mint PROD/UJI (kontrak di USDX-636 / sot/api/mint-mode.yaml).
//
//   GET  /api/v1/mint-mode  → { mode, reason, expiresAt, updatedBy, updatedAt }
//   POST /api/v1/mint-mode  ← { mode, reason, durationHours }
//
// Endpoint-nya belum hidup di backend (USDX-636 jalan paralel), jadi handler
// MSW-nya ada di src/mocks/handlers.ts dan path-nya TIDAK didaftarkan di
// `INTEGRATION_PATHS` — persis pola /api/v1/fee-config.
// ─────────────────────────────────────────────────────────────────────────────

export const MINT_MODE_QUERY_KEY = ['mint-mode'] as const

/**
 * Jendela mode uji berakhir dengan sendirinya di server (`expiresAt`), dan
 * yang membaca layar ini tidak akan me-refresh halaman untuk mengetahuinya.
 * Tanpa polling, banner merah bisa tertinggal menyala setelah jendelanya lewat
 * — atau lebih buruk, sebuah tab yang dibuka sebelum mode uji dinyalakan tidak
 * pernah menampilkan banner sama sekali. Satu menit cukup rapat untuk keduanya
 * dan cukup jarang untuk endpoint sekecil ini.
 */
const MINT_MODE_REFETCH_MS = 60_000

export function useMintMode() {
  return useQuery({
    queryKey: MINT_MODE_QUERY_KEY,
    queryFn: () => apiFetch<MintModeConfig>('/api/v1/mint-mode'),
    refetchInterval: MINT_MODE_REFETCH_MS,
    // Sebuah jendela bisa dinyalakan orang lain sementara tab ini menganggur.
    refetchOnWindowFocus: true,
  })
}

export function useSetMintMode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetMintModeBody) =>
      apiFetch<MintModeConfig>('/api/v1/mint-mode', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MINT_MODE_QUERY_KEY })
    },
  })
}
