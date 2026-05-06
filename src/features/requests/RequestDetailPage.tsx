import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useRequestDetail } from './hooks'
import type { BurnRequest, MintRequest, RequestDetail } from '@/lib/types'

function isBurn(detail: RequestDetail): detail is RequestDetail & { type: 'burn' } & BurnRequest {
  return detail.type === 'burn'
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
      <p className="text-[13px] text-foreground break-all">{value}</p>
    </div>
  )
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, isError, error } = useRequestDetail(id)

  return (
    <div className="space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/requests">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Back to requests
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="p-6 text-destructive">
            {error instanceof Error ? error.message : 'Failed to load request'}
          </CardContent>
        </Card>
      ) : data ? (
        <DetailBody detail={data} />
      ) : null}
    </div>
  )
}

function DetailBody({ detail }: { detail: RequestDetail }) {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
          {detail.type} request
        </p>
        <h1 className="text-[18px] font-semibold tracking-tight">{detail.id}</h1>
      </header>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <Field label="Type" value={detail.type} />
          <Field label="Status" value={detail.status} />
          <Field label="User ID" value={detail.userId} />
          <Field label="User address" value={detail.userAddress} />
          <Field label="Amount (USDX)" value={(detail as MintRequest).amount} />
          <Field label="Amount (Wei)" value={(detail as MintRequest).amountWei} />
          <Field label="Amount (IDR)" value={(detail as MintRequest).amountIdr} />
          <Field label="Rate used" value={(detail as MintRequest).rateUsed} />
          <Field label="Chain" value={detail.chain} />
          <Field label="Safe type" value={detail.safeType} />
          <Field label="Idempotency key" value={detail.idempotencyKey} />
          <Field label="Safe TX hash" value={detail.safeTxHash ?? '—'} />
          <Field label="On-chain TX hash" value={detail.onChainTxHash ?? '—'} />
          <Field label="Notes" value={detail.notes ?? '—'} />
          <Field label="Created by" value={detail.createdBy} />
          <Field label="Created at" value={detail.createdAt} />
          <Field label="Updated at" value={detail.updatedAt} />
          {isBurn(detail) && (
            <>
              <Field label="Deposit TX hash" value={detail.depositTxHash} />
              <Field label="Bank name" value={detail.bankName} />
              <Field label="Bank account" value={detail.bankAccount} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
