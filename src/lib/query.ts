export function buildQueryString(params: URLSearchParams, pageSize: number): string {
  const page = params.get('page') || '1'
  const search = params.get('search') || ''
  const status = params.get('status') || ''
  const sortBy = params.get('sortBy') || ''
  const sortOrder = params.get('sortOrder') || 'desc'
  const startDate = params.get('startDate') || ''
  const endDate = params.get('endDate') || ''

  const qs = new URLSearchParams()
  qs.set('page', page)
  qs.set('pageSize', String(pageSize))
  if (search) qs.set('search', search)
  if (status) qs.set('status', status)
  if (sortBy) qs.set('sortBy', sortBy)
  if (sortOrder) qs.set('sortOrder', sortOrder)
  if (startDate) qs.set('startDate', startDate)
  if (endDate) qs.set('endDate', endDate)
  return qs.toString()
}
