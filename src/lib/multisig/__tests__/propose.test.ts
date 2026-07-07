import { describe, test, expect } from 'vitest'
import {
  GOVERNANCE_OPS,
  KNOWN_ROLES,
  ZERO_BYTES32,
  getOpMeta,
  isBytes32,
  isHexBytes,
  isNonNegativeInt,
  isRoleValid,
  validateProposeForm,
  buildProposeParams,
  buildProposeRequest,
} from '../propose'
import type { GovernanceOperation } from '@/lib/types'

// Checksummed addresses (viem getAddress accepts these as-is).
const ADDR = '0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97'
const ADDR_LOWER = '0x4838b106fce9647bdf1e7877bf73ce8b0bad5f97'

describe('GOVERNANCE_OPS / getOpMeta', () => {
  describe('positive', () => {
    test('covers exactly the 10 backend propose operations', () => {
      expect(GOVERNANCE_OPS.map((o) => o.value).sort()).toEqual(
        [
          'ADD_BLACKLIST',
          'DESTROY_FUNDS',
          'GRANT_ROLE',
          'PAUSE',
          'REMOVE_BLACKLIST',
          'REVOKE_ROLE',
          'SET_SUPPORTED_CHAIN',
          'TIMELOCK_EXECUTE',
          'TIMELOCK_SCHEDULE',
          'UNPAUSE',
        ].sort(),
      )
    })
    test('getOpMeta resolves paramKind', () => {
      expect(getOpMeta('ADD_BLACKLIST').paramKind).toBe('address')
      expect(getOpMeta('PAUSE').paramKind).toBe('none')
      expect(getOpMeta('SET_SUPPORTED_CHAIN').paramKind).toBe('chain')
      expect(getOpMeta('GRANT_ROLE').paramKind).toBe('role')
      expect(getOpMeta('TIMELOCK_SCHEDULE').paramKind).toBe('timelock')
    })
  })
  describe('negative', () => {
    test('throws on an unknown op', () => {
      expect(() => getOpMeta('MINT' as GovernanceOperation)).toThrow()
    })
  })
})

describe('primitive validators', () => {
  describe('positive', () => {
    test('bytes32 / hex / uint / role', () => {
      expect(isBytes32(ZERO_BYTES32)).toBe(true)
      expect(isHexBytes('0x')).toBe(true)
      expect(isHexBytes('0xabcd')).toBe(true)
      expect(isNonNegativeInt('0')).toBe(true)
      expect(isNonNegativeInt('137')).toBe(true)
      expect(isRoleValid('MINTER_ROLE')).toBe(true)
      expect(isRoleValid(ZERO_BYTES32)).toBe(true)
    })
  })
  describe('negative', () => {
    test('rejects malformed values', () => {
      expect(isBytes32('0x123')).toBe(false)
      expect(isHexBytes('0xabc')).toBe(false) // odd length
      expect(isNonNegativeInt('-1')).toBe(false)
      expect(isNonNegativeInt('1.5')).toBe(false)
      expect(isRoleValid('NOPE_ROLE')).toBe(false)
    })
  })
})

describe('validateProposeForm', () => {
  describe('positive', () => {
    test('address op accepts a valid address', () => {
      expect(validateProposeForm('ADD_BLACKLIST', { address: ADDR }).valid).toBe(true)
    })
    test('pause op needs no params', () => {
      expect(validateProposeForm('PAUSE', {}).valid).toBe(true)
    })
    test('chain op accepts integer chainId', () => {
      expect(validateProposeForm('SET_SUPPORTED_CHAIN', { chainId: '137', supported: true }).valid).toBe(true)
    })
    test('role op accepts role name + account', () => {
      expect(validateProposeForm('GRANT_ROLE', { role: 'BLACKLIST_ROLE', account: ADDR }).valid).toBe(true)
    })
    test('timelock op accepts a full valid form', () => {
      const r = validateProposeForm('TIMELOCK_SCHEDULE', {
        target: ADDR,
        value: '0',
        payload: '0xabcd',
        predecessor: ZERO_BYTES32,
        salt: ZERO_BYTES32,
        delay: '86400',
      })
      expect(r.valid).toBe(true)
    })
  })

  describe('negative', () => {
    test('address op rejects missing / invalid address', () => {
      expect(validateProposeForm('ADD_BLACKLIST', {}).errors.address).toBeDefined()
      expect(validateProposeForm('ADD_BLACKLIST', { address: '0xzz' }).errors.address).toBeDefined()
    })
    test('chain op rejects non-integer chainId', () => {
      expect(validateProposeForm('SET_SUPPORTED_CHAIN', { chainId: 'abc' }).errors.chainId).toBeDefined()
    })
    test('role op rejects unknown role + bad account', () => {
      const r = validateProposeForm('REVOKE_ROLE', { role: 'NOPE', account: 'x' })
      expect(r.errors.role).toBeDefined()
      expect(r.errors.account).toBeDefined()
    })
    test('timelock op rejects empty params + odd-length payload', () => {
      const r = validateProposeForm('TIMELOCK_SCHEDULE', { payload: '0xabc' })
      expect(r.valid).toBe(false)
      expect(r.errors.target).toBeDefined()
      expect(r.errors.payload).toBeDefined()
      expect(r.errors.salt).toBeDefined()
      expect(r.errors.delay).toBeDefined()
    })
  })

  describe('edge cases', () => {
    test('timelock value/predecessor are optional (default later)', () => {
      const r = validateProposeForm('TIMELOCK_EXECUTE', {
        target: ADDR,
        payload: '0x',
        salt: ZERO_BYTES32,
        delay: '0',
      })
      expect(r.valid).toBe(true)
    })
  })
})

describe('buildProposeParams', () => {
  describe('positive', () => {
    test('checksum-normalises a lowercase address', () => {
      expect(buildProposeParams('ADD_BLACKLIST', { address: ADDR_LOWER })).toEqual({ address: ADDR })
    })
    test('pause → empty params', () => {
      expect(buildProposeParams('PAUSE', {})).toEqual({})
    })
    test('chain → numeric chainId + boolean supported', () => {
      expect(buildProposeParams('SET_SUPPORTED_CHAIN', { chainId: '137', supported: true })).toEqual({
        chainId: 137,
        supported: true,
      })
      // supported defaults to false when unset
      expect(buildProposeParams('SET_SUPPORTED_CHAIN', { chainId: '80002' })).toEqual({
        chainId: 80002,
        supported: false,
      })
    })
    test('role → role passthrough + normalised account', () => {
      expect(buildProposeParams('GRANT_ROLE', { role: 'MINTER_ROLE', account: ADDR_LOWER })).toEqual({
        role: 'MINTER_ROLE',
        account: ADDR,
      })
    })
    test('timelock → defaults applied (value 0, predecessor zero), delay numeric', () => {
      expect(
        buildProposeParams('TIMELOCK_SCHEDULE', {
          target: ADDR_LOWER,
          payload: '0xabcd',
          salt: ZERO_BYTES32,
          delay: '86400',
        }),
      ).toEqual({
        target: ADDR,
        value: '0',
        payload: '0xabcd',
        predecessor: ZERO_BYTES32,
        salt: ZERO_BYTES32,
        delay: 86400,
      })
    })
  })
})

describe('buildProposeRequest', () => {
  describe('positive', () => {
    test('assembles the full POST body', () => {
      expect(
        buildProposeRequest({
          safeType: 'MANAGER',
          operation: 'ADD_BLACKLIST',
          values: { address: ADDR },
        }),
      ).toEqual({
        safeType: 'MANAGER',
        operation: 'ADD_BLACKLIST',
        params: { address: ADDR },
      })
    })
  })
})

describe('KNOWN_ROLES', () => {
  test('lists the six AccessControl roles', () => {
    expect(KNOWN_ROLES).toEqual([
      'DEFAULT_ADMIN_ROLE',
      'MINTER_ROLE',
      'BURNER_ROLE',
      'PAUSER_ROLE',
      'BLACKLIST_ROLE',
      'UPGRADER_ROLE',
    ])
  })
})
