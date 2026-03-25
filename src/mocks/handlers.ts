import { http, HttpResponse } from 'msw'
import type { MintingRequest, RedeemRequest } from '@/lib/types'
import { createMockMintingList, createMockRedeemList, createMockDashboardStats } from './data'

let mintingData = createMockMintingList()
let redeemData = createMockRedeemList()

export function resetMockData() {
  mintingData = createMockMintingList()
  redeemData = createMockRedeemList()
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize
  const data = items.slice(start, start + pageSize)
  return {
    data,
    meta: {
      page,
      pageSize,
      total: items.length,
      totalPages: Math.ceil(items.length / pageSize),
    },
  }
}

function filterItems<T extends MintingRequest | RedeemRequest>(
  items: T[],
  params: URLSearchParams
): T[] {
  let result = [...items]
  const search = params.get('search')
  const status = params.get('status')
  const startDate = params.get('startDate')
  const endDate = params.get('endDate')
  const sortBy = params.get('sortBy')
  const sortOrder = params.get('sortOrder') || 'desc'

  if (search) {
    const q = search.toLowerCase()
    result = result.filter(
      (item) =>
        item.requester.toLowerCase().includes(q) ||
        ('email' in item && (item as MintingRequest).email.toLowerCase().includes(q))
    )
  }

  if (status) {
    result = result.filter((item) => item.status === status)
  }

  if (startDate) {
    result = result.filter((item) => item.createdAt >= startDate)
  }
  if (endDate) {
    result = result.filter((item) => item.createdAt <= endDate)
  }

  if (sortBy) {
    result.sort((a, b) => {
      const aVal = a[sortBy as keyof T]
      const bVal = b[sortBy as keyof T]
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }

  return result
}

export const handlers = [
  // Dashboard
  http.get('/api/dashboard', () => {
    return HttpResponse.json(createMockDashboardStats())
  }),

  // Minting - List
  http.get('/api/minting', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || '1')
    const pageSize = Number(url.searchParams.get('pageSize') || '10')
    const filtered = filterItems(mintingData, url.searchParams)
    return HttpResponse.json(paginate(filtered, page, pageSize))
  }),

  // Minting - Detail
  http.get('/api/minting/:id', ({ params }) => {
    const item = mintingData.find((m) => m.id === params.id)
    if (!item) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(item)
  }),

  // Minting - Approve
  http.post('/api/minting/:id/approve', async ({ params, request }) => {
    const item = mintingData.find((m) => m.id === params.id)
    if (!item) return new HttpResponse(null, { status: 404 })
    if (item.status !== 'pending' && item.status !== 'under_review') {
      return HttpResponse.json(
        { error: { code: 'INVALID_STATUS', message: 'Cannot approve in current status' } },
        { status: 400 }
      )
    }
    const body = await request.json() as { notes?: string }
    item.status = 'approved'
    item.notes = body?.notes || item.notes
    item.updatedAt = new Date().toISOString()
    return HttpResponse.json(item)
  }),

  // Minting - Reject
  http.post('/api/minting/:id/reject', async ({ params, request }) => {
    const item = mintingData.find((m) => m.id === params.id)
    if (!item) return new HttpResponse(null, { status: 404 })
    if (item.status !== 'pending' && item.status !== 'under_review') {
      return HttpResponse.json(
        { error: { code: 'INVALID_STATUS', message: 'Cannot reject in current status' } },
        { status: 400 }
      )
    }
    const body = await request.json() as { notes?: string }
    if (!body?.notes) {
      return HttpResponse.json(
        { error: { code: 'NOTES_REQUIRED', message: 'Notes are required when rejecting' } },
        { status: 400 }
      )
    }
    item.status = 'rejected'
    item.notes = body.notes
    item.updatedAt = new Date().toISOString()
    return HttpResponse.json(item)
  }),

  // Minting - Start Review
  http.post('/api/minting/:id/review', ({ params }) => {
    const item = mintingData.find((m) => m.id === params.id)
    if (!item) return new HttpResponse(null, { status: 404 })
    if (item.status !== 'pending') {
      return HttpResponse.json(
        { error: { code: 'INVALID_STATUS', message: 'Can only start review from pending' } },
        { status: 400 }
      )
    }
    item.status = 'under_review'
    item.updatedAt = new Date().toISOString()
    return HttpResponse.json(item)
  }),

  // Redeem - List
  http.get('/api/redeem', ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') || '1')
    const pageSize = Number(url.searchParams.get('pageSize') || '10')
    const filtered = filterItems(redeemData, url.searchParams)
    return HttpResponse.json(paginate(filtered, page, pageSize))
  }),

  // Redeem - Detail
  http.get('/api/redeem/:id', ({ params }) => {
    const item = redeemData.find((r) => r.id === params.id)
    if (!item) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(item)
  }),

  // CSV Export endpoints
  http.get('/api/minting/export', ({ request }) => {
    const url = new URL(request.url)
    const filtered = filterItems(mintingData, url.searchParams)
    return HttpResponse.json({ data: filtered })
  }),

  http.get('/api/redeem/export', ({ request }) => {
    const url = new URL(request.url)
    const filtered = filterItems(redeemData, url.searchParams)
    return HttpResponse.json({ data: filtered })
  }),
]
