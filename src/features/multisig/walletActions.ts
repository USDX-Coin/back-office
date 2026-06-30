// wagmi-bound on-chain actions for the Multisig page (USDX-275): connect +
// network guard, sign SafeTx (EIP-712, gasless), send execTransaction, and the
// pre-execute simulate gate. Kept apart from the pure lib (src/lib/multisig/*)
// so the encoding/decoding stays unit-testable without a wallet.

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSendTransaction,
  useSignTypedData,
  useSwitchChain,
} from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { getAddress, type Address } from 'viem'
import {
  POLYGON_CHAIN_ID,
  buildExecTransactionCall,
  buildSafeTxTypedData,
  safeTxHashMatches,
} from '@/lib/multisig/safeTx'
import { summarizeSimulationError } from '@/lib/multisig/errors'
import type { SafeTxDetail } from '@/lib/types'

// Case-insensitive owner membership (addresses may differ in checksum casing).
export function isOwnerAddress(
  address: string | undefined,
  owners: string[] | undefined,
): boolean {
  if (!address || !owners?.length) return false
  const a = address.toLowerCase()
  return owners.some((o) => o.toLowerCase() === a)
}

export interface MultisigWallet {
  isConnected: boolean
  address: Address | undefined
  chainId: number
  chainOk: boolean
  connect: () => void
  switchToPolygon: () => void
  isSwitching: boolean
}

// Connection + Polygon-137 network guard.
export function useMultisigWallet(): MultisigWallet {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { openConnectModal } = useConnectModal()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const connect = useCallback(() => openConnectModal?.(), [openConnectModal])
  const switchToPolygon = useCallback(
    () => switchChain?.({ chainId: POLYGON_CHAIN_ID }),
    [switchChain],
  )

  return {
    isConnected,
    address,
    chainId,
    chainOk: isConnected && chainId === POLYGON_CHAIN_ID,
    connect,
    switchToPolygon,
    isSwitching,
  }
}

// Sign the SafeTx EIP-712. Cross-checks the locally-computed hash against the
// backend `safeTxHash` first (blind-sign / tamper guard) and refuses on
// mismatch. Returns the 65-byte signature hex.
export function useSignSafeTx() {
  const { signTypedDataAsync, isPending } = useSignTypedData()

  const signAsync = useCallback(
    async (detail: SafeTxDetail, signerAddress: Address): Promise<`0x${string}`> => {
      if (!safeTxHashMatches(detail)) {
        throw new Error(
          'SafeTx hash mismatch — the displayed transaction does not match the backend safeTxHash. Refusing to sign.',
        )
      }
      const td = buildSafeTxTypedData(detail)
      return signTypedDataAsync({
        account: signerAddress,
        domain: td.domain,
        types: td.types,
        primaryType: 'SafeTx',
        message: td.message,
      })
    },
    [signTypedDataAsync],
  )

  return { signAsync, isSigning: isPending }
}

// Broadcast execTransaction from the connected (executor) wallet. Returns the tx
// hash; the backend stays the source of truth for the final status (reconciler).
export function useExecuteTransaction() {
  const { sendTransactionAsync, isPending } = useSendTransaction()

  const executeAsync = useCallback(
    async (detail: SafeTxDetail): Promise<`0x${string}`> => {
      if (!detail.execPayload) {
        throw new Error('No exec payload — the transaction is not ready to execute yet.')
      }
      const call = buildExecTransactionCall(detail.safeAddress, detail.execPayload)
      return sendTransactionAsync({
        to: call.to,
        data: call.data,
        value: call.value,
        chainId: POLYGON_CHAIN_ID,
      })
    },
    [sendTransactionAsync],
  )

  return { executeAsync, isExecuting: isPending }
}

export type SimulateState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok' }
  | { status: 'revert'; reason: string }
  | { status: 'error'; reason: string }

// Pre-execute simulate gate (week4.md guard). Simulates the INNER call
// (from = Safe, to = target, data = calldata) so a USDX custom error surfaces
// with its real reason instead of being masked by the Safe (GS013). With gas=0,
// execTransaction succeeds iff this inner call succeeds — so this both gates
// Execute and explains why it would revert.
export function useSimulateExec(detail: SafeTxDetail | undefined, enabled: boolean) {
  const publicClient = usePublicClient({ chainId: POLYGON_CHAIN_ID })

  const query = useQuery({
    queryKey: ['multisig', 'simulate', detail?.id, detail?.safeTxHash, detail?.status],
    enabled: enabled && Boolean(detail) && Boolean(publicClient),
    // Re-check periodically: a blacklist/pause condition can change on-chain.
    refetchInterval: 30_000,
    retry: false,
    queryFn: async (): Promise<SimulateState> => {
      if (!detail || !publicClient) return { status: 'idle' }
      try {
        await publicClient.call({
          account: getAddress(detail.safeAddress),
          to: getAddress(detail.to),
          data: (detail.data || '0x') as `0x${string}`,
          value: BigInt(detail.value || '0'),
        })
        return { status: 'ok' }
      } catch (err) {
        return { status: 'revert', reason: summarizeSimulationError(err) }
      }
    },
  })

  if (query.isLoading || query.isFetching) {
    if (!query.data) return { status: 'loading' } as SimulateState
  }
  return query.data ?? ({ status: 'idle' } as SimulateState)
}
