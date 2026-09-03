import { useQuery } from '@tanstack/react-query'
import { apiFetchRaw } from '@/lib/apiFetch'
import { isOrderTerminal } from '@/lib/status'
import { POLL_ACTIVE_MS, POLL_LIST_MS } from '@/lib/queryConfig'
import type {
  OrderDetail,
  OrderListItem,
  OrderStatus,
  PhaseOnePaginatedResponse,
  PhaseOneSuccessResponse,
} from '@/lib/types'

// USDX-206 — backoffice "User Transaction" (consumer mint orders). Read-only.
// sot/api/orders.yaml: GET /api/v1/orders (list) + GET /api/v1/orders/{id}.

export interface OrderListFilters {
  page?: number
  /** sot/api/orders.yaml uses `take` (default 10, max 100). */
  take?: number
  type?: string
  /** Mint overall status (orders.yaml `status` = MintOrderStatus). MINT only. */
  status?: string
  /**
   * Redeem overall status (RedeemStatus). Sent only for type=REDEEM via a
   * distinct `redeemStatus` param so a RedeemStatus value never travels through
   * the mint `status` param (USDX-254; param lands in orders.yaml via USDX-253).
   */
  redeemStatus?: string
  paymentStatus?: string
  safeStatus?: string
  userId?: string
  /**
   * USDX-547 — `PARTNER` = only orders with a `partner_id`, `RETAIL` = only
   * orders without one. Omitted = both.
   *
   * FE-ahead drift: `sot/api/orders.yaml` does not list this param yet, and the
   * backend side is part of USDX-547. Filtering client-side instead was
   * rejected — the list is server-paginated, so a client filter would silently
   * hide rows on other pages and report the wrong total.
   */
  ownerType?: string
}

function buildQuery(filters: OrderListFilters): string {
  const sp = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v))
  })
  return sp.toString()
}

function fetchOrderList(
  filters: OrderListFilters,
): Promise<PhaseOnePaginatedResponse<OrderListItem>> {
  return apiFetchRaw<PhaseOnePaginatedResponse<OrderListItem>>(
    `/api/v1/orders?${buildQuery(filters)}`,
  )
}

/**
 * Poll only while a row is still moving through the payment/Safe lifecycle,
 * then stop (mirrors the mint/burn list polling, USDX-27). Exported so the
 * "settled data stops polling" rule can be asserted without a timer.
 */
export function orderListPollInterval(
  rows: Pick<OrderListItem, 'status'>[] | undefined,
): number | false {
  return (rows ?? []).some((r) => !isOrderTerminal(r.status)) ? POLL_LIST_MS : false
}

export function useOrderList(filters: OrderListFilters) {
  return useQuery({
    queryKey: ['orders', 'list', filters],
    queryFn: () => fetchOrderList(filters),
    refetchInterval: (query) => orderListPollInterval(query.state.data?.data),
    refetchOnWindowFocus: true,
  })
}

function fetchOrderDetail(id: string): Promise<PhaseOneSuccessResponse<OrderDetail>> {
  return apiFetchRaw<PhaseOneSuccessResponse<OrderDetail>>(`/api/v1/orders/${id}`)
}

/** The open detail modal is what the operator is watching → active cadence. */
export function orderDetailPollInterval(status: OrderStatus | undefined): number | false {
  return status && !isOrderTerminal(status) ? POLL_ACTIVE_MS : false
}

export function useOrderDetail(id: string | null) {
  return useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: () => fetchOrderDetail(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) => orderDetailPollInterval(query.state.data?.data?.status),
    refetchOnWindowFocus: true,
  })
}
