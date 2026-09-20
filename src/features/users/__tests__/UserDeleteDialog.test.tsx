import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import { server } from '@/mocks/server'
import { resetMockData } from '@/mocks/handlers'
import UserDeleteDialog from '@/features/users/UserDeleteDialog'
import { labelNasabah } from '@/features/users/labelNasabah'
import { renderWithProviders } from '@/test/test-utils'
import type { PhaseOneUser } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// `users.name` BOLEH null (sot/api/users.yaml § User): nasabah yang mendaftar
// sendiri belum punya nama sampai KYC pertamanya masuk. Dialog ini dulu
// mencetak `user.name` mentah, jadi untuk nasabah itu operator membaca
// "Akun null dihapus dari back-office" — pada satu-satunya layar yang tugasnya
// memastikan ia menghapus orang yang benar.
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(() => server.listen())
afterEach(() => {
  server.resetHandlers()
  resetMockData()
})
afterAll(() => server.close())

function buatNasabah(over: Partial<PhaseOneUser> = {}): PhaseOneUser {
  return {
    id: '019e1aa8-9c7c-7fcd-6abc-deadbeef0001',
    name: 'Robert Deon',
    email: 'robert.deon@example.com',
    phone: null,
    entityType: 'INDIVIDUAL',
    kycStatus: 'VERIFIED',
    suspended: false,
    emailVerifiedAt: null,
    activationEmailFailedAt: null,
    notes: null,
    wallets: [],
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...over,
  }
}

function render(user: PhaseOneUser) {
  return renderWithProviders(
    <UserDeleteDialog open onOpenChange={() => {}} user={user} />,
    { authenticated: true }
  )
}

describe('UserDeleteDialog', () => {
  describe('positive', () => {
    test('menyebut nama nasabah saat namanya ada', async () => {
      render(buatNasabah())
      expect(
        await screen.findByText(/Akun Robert Deon dihapus dari back-office/)
      ).toBeInTheDocument()
    })
  })

  describe('negative', () => {
    test('nama null jatuh ke email, BUKAN kata "null"', async () => {
      render(buatNasabah({ name: null }))
      const teks = await screen.findByText(/dihapus dari back-office/)
      expect(teks).toHaveTextContent('robert.deon@example.com')
      expect(teks).not.toHaveTextContent(/\bnull\b/)
      expect(teks).not.toHaveTextContent(/\bundefined\b/)
    })

    test('nama berisi spasi saja juga jatuh ke email', async () => {
      render(buatNasabah({ name: '   ' }))
      const teks = await screen.findByText(/dihapus dari back-office/)
      expect(teks).toHaveTextContent('robert.deon@example.com')
    })
  })

  describe('edge cases', () => {
    test('nama DAN email kosong jatuh ke potongan id, bukan string kosong', () => {
      // `email` bertipe non-null di kontraknya, tapi `string` tidak melarang
      // string kosong — dan kalimat "Akun  dihapus" tidak menyebut siapa pun.
      expect(labelNasabah(buatNasabah({ name: null, email: '' }))).toBe(
        'nasabah 019e1aa8…0001'
      )
    })

    test('nama dipangkas spasi di ujungnya', () => {
      expect(labelNasabah(buatNasabah({ name: '  Robert Deon  ' }))).toBe('Robert Deon')
    })
  })
})
