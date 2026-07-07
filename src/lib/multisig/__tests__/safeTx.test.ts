import { describe, test, expect } from 'vitest'
import { decodeFunctionData, toFunctionSelector } from 'viem'
import {
  buildSafeTxTypedData,
  computeSafeTxHash,
  safeTxHashMatches,
  safeTxParamsFromDetail,
  encodeExecTransaction,
  buildExecTransactionCall,
  SAFE_EXEC_ABI,
  ZERO_ADDRESS,
  POLYGON_CHAIN_ID,
} from '../safeTx'
import type { SafeExecPayload, SafeTxDetail } from '@/lib/types'

const SAFE = '0x1111111111111111111111111111111111111111'
const USDX = '0x2222222222222222222222222222222222222222'

function makeDetail(over: Partial<SafeTxDetail> = {}): SafeTxDetail {
  return {
    id: 'tx-1',
    chain: 'polygon',
    safeType: 'MANAGER',
    safeAddress: SAFE,
    nonce: 7,
    activity: 'MINT',
    activityLabel: 'Mint 100 USDX',
    signatureProgress: { collected: 1, threshold: 2 },
    proposerType: 'BACKEND',
    proposerAddress: '0x9999999999999999999999999999999999999999',
    status: 'PENDING_SIGN',
    safeTxHash: '0x' + 'ab'.repeat(32),
    execTxHash: null,
    createdAt: '2026-06-30T00:00:00.000Z',
    to: USDX,
    value: '0',
    data: '0xdeadbeef',
    operation: 0,
    decodedArgs: { to: '0xUser', amount: '100' },
    linkedRequestId: 'req-1',
    linkedOrderId: null,
    signers: [],
    execPayload: null,
    lastExecError: null,
    executedByStaffName: null,
    executedAt: null,
    ...over,
  }
}

describe('safeTxParamsFromDetail', () => {
  describe('positive', () => {
    test('uses SoT gas defaults (0 / zero address) when no execPayload', () => {
      const p = safeTxParamsFromDetail(makeDetail())
      expect(p.to).toBe(USDX)
      expect(p.value).toBe(0n)
      expect(p.operation).toBe(0)
      expect(p.safeTxGas).toBe(0n)
      expect(p.baseGas).toBe(0n)
      expect(p.gasPrice).toBe(0n)
      expect(p.gasToken).toBe(ZERO_ADDRESS)
      expect(p.refundReceiver).toBe(ZERO_ADDRESS)
      expect(p.nonce).toBe(7n)
    })
    test('prefers execPayload gas fields when present', () => {
      const execPayload: SafeExecPayload = {
        to: USDX,
        value: '0',
        data: '0xdeadbeef',
        operation: 0,
        safeTxGas: '21000',
        baseGas: '5000',
        gasPrice: '1',
        gasToken: ZERO_ADDRESS,
        refundReceiver: ZERO_ADDRESS,
        signatures: '0x',
      }
      const p = safeTxParamsFromDetail(makeDetail({ execPayload }))
      expect(p.safeTxGas).toBe(21000n)
      expect(p.baseGas).toBe(5000n)
      expect(p.gasPrice).toBe(1n)
    })
  })
})

describe('buildSafeTxTypedData', () => {
  describe('positive', () => {
    test('domain is { chainId, verifyingContract: safe } and primaryType SafeTx', () => {
      const td = buildSafeTxTypedData(makeDetail())
      expect(td.primaryType).toBe('SafeTx')
      expect(td.domain.chainId).toBe(POLYGON_CHAIN_ID)
      expect(td.domain.verifyingContract).toBe(SAFE)
      // No name/version in the Safe >= 1.3.0 domain.
      expect(td.domain).not.toHaveProperty('name')
      expect(td.domain).not.toHaveProperty('version')
    })
  })
})

describe('computeSafeTxHash', () => {
  describe('positive', () => {
    test('returns a deterministic 32-byte hash', () => {
      const detail = makeDetail()
      const h1 = computeSafeTxHash(detail)
      const h2 = computeSafeTxHash(detail)
      expect(h1).toBe(h2)
      expect(h1).toMatch(/^0x[0-9a-f]{64}$/)
    })
  })

  describe('edge cases', () => {
    test('changing any signed field changes the hash', () => {
      const base = computeSafeTxHash(makeDetail())
      expect(computeSafeTxHash(makeDetail({ nonce: 8 }))).not.toBe(base)
      expect(computeSafeTxHash(makeDetail({ to: SAFE }))).not.toBe(base)
      expect(computeSafeTxHash(makeDetail({ data: '0xbeef' }))).not.toBe(base)
    })
  })
})

describe('safeTxHashMatches', () => {
  describe('positive', () => {
    test('true when backend safeTxHash equals the locally-computed hash (case-insensitive)', () => {
      const detail = makeDetail()
      const computed = computeSafeTxHash(detail)
      expect(safeTxHashMatches({ ...detail, safeTxHash: computed })).toBe(true)
      expect(safeTxHashMatches({ ...detail, safeTxHash: computed.toUpperCase().replace('0X', '0x') })).toBe(true)
    })
  })

  describe('negative', () => {
    test('false when the displayed fields were tampered vs the backend hash', () => {
      const detail = makeDetail()
      const computed = computeSafeTxHash(detail)
      // Backend hash bound to the original `to`; we display a different `to`.
      const tampered = { ...detail, safeTxHash: computed, to: SAFE }
      expect(safeTxHashMatches(tampered)).toBe(false)
    })
    test('false when safeTxHash is missing', () => {
      expect(safeTxHashMatches(makeDetail({ safeTxHash: '' }))).toBe(false)
    })
  })
})

describe('encodeExecTransaction / buildExecTransactionCall', () => {
  const payload: SafeExecPayload = {
    to: USDX,
    value: '0',
    data: '0xabcdef',
    operation: 0,
    safeTxGas: '0',
    baseGas: '0',
    gasPrice: '0',
    gasToken: ZERO_ADDRESS,
    refundReceiver: ZERO_ADDRESS,
    signatures: '0x' + '11'.repeat(65),
  }

  describe('positive', () => {
    test('encodes the canonical execTransaction selector + round-trips', () => {
      const data = encodeExecTransaction(payload)
      const selector = toFunctionSelector(
        'execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)',
      )
      expect(selector).toBe('0x6a761202')
      expect(data.startsWith('0x6a761202')).toBe(true)

      const decoded = decodeFunctionData({ abi: SAFE_EXEC_ABI, data })
      expect(decoded.functionName).toBe('execTransaction')
      expect(decoded.args[0]).toBe(USDX)
      expect(decoded.args[9]).toBe(payload.signatures)
    })
    test('buildExecTransactionCall targets the Safe with value 0', () => {
      const call = buildExecTransactionCall(SAFE, payload)
      expect(call.to).toBe(SAFE)
      expect(call.value).toBe(0n)
      expect(call.data.startsWith('0x6a761202')).toBe(true)
    })
  })
})
