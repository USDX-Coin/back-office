import { describe, test, expect } from 'vitest'
import { screen } from '@testing-library/react'
import MobileBackLink from '@/components/layout/MobileBackLink'
import { renderWithProviders } from '@/test/test-utils'

function render(path: string, staffId?: string) {
  renderWithProviders(<MobileBackLink />, { initialEntries: [path], authenticated: true, staffId })
}

describe('MobileBackLink', () => {
  describe('positive', () => {
    test('should link a customer profile back to Daftar Nasabah', () => {
      render('/users/00000000-0000-0000-0000-000000000001')
      const link = screen.getByRole('link', { name: 'Daftar Nasabah' })
      expect(link).toHaveAttribute('href', '/users')
    })

    test('should link the KYB entry form back to Verifikasi', () => {
      render('/kyb/new')
      expect(screen.getByRole('link', { name: 'Verifikasi' })).toHaveAttribute('href', '/verifikasi')
    })

    test('should link the sanction-list versions back to Daftar Sanksi', () => {
      render('/screening/lists')
      expect(screen.getByRole('link', { name: 'Daftar Sanksi' })).toHaveAttribute('href', '/screening')
    })

    test('should link a legacy queue back to Transaksi', () => {
      render('/redeem-approvals')
      expect(screen.getByRole('link', { name: 'Transaksi' })).toHaveAttribute('href', '/transactions')
    })

    test('should be hidden on desktop, where the breadcrumb already shows the way back', () => {
      render('/users/abc')
      expect(screen.getByRole('navigation', { name: 'Kembali ke halaman induk' })).toHaveClass('lg:hidden')
    })
  })

  describe('negative', () => {
    test('should render nothing on a top-level menu page', () => {
      render('/transactions')
      expect(screen.queryByRole('navigation', { name: 'Kembali ke halaman induk' })).not.toBeInTheDocument()
    })

    // stf_4 = STAFF: daftar OTC 403 untuknya, jadi "‹ Mint" tidak boleh muncul.
    test.each(['/mint/new', '/burn/new'])('should not link STAFF on %s back to an OTC list it cannot open', (path) => {
      render(path, 'stf_4')
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    test('should render nothing when the parent segment is only a group name', () => {
      render('/settings/fee')
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('should not link the list to itself while a row modal is open', () => {
      render('/users')
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })

    test('should still link the mint form back to the OTC list for roles that can open it', () => {
      render('/mint/new')
      expect(screen.getByRole('link', { name: 'Mint' })).toHaveAttribute('href', '/otc/mint')
    })

    test('should render nothing for an unknown route', () => {
      render('/tidak-ada')
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
    })
  })
})
