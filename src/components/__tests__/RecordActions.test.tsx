import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecordActions from '../record-modal/RecordActions'

describe('RecordActions', () => {
  describe('positive', () => {
    test('should ask "Sudah benar semua?" with the consequences before running the risky action', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      render(
        <RecordActions
          primary={{
            label: 'Tanda tangani di wallet',
            confirm: {
              items: ['Cetak 50.000 USDX ke 0x5aAe…BeAed', 'Nominal Rp 812.500.000'],
              confirmLabel: 'Ya, tanda tangani',
              onConfirm,
            },
          }}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Tanda tangani di wallet' }))
      expect(onConfirm).not.toHaveBeenCalled()
      expect(screen.getByText('Sudah benar semua?')).toBeInTheDocument()
      expect(screen.getByText('Nominal Rp 812.500.000')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Ya, tanda tangani' }))
      expect(onConfirm).toHaveBeenCalledTimes(1)
      // Back to the plain bar once done.
      expect(screen.getByRole('button', { name: 'Tanda tangani di wallet' })).toBeInTheDocument()
    })

    test('should run a non-risky primary action directly', async () => {
      const user = userEvent.setup()
      const onClick = vi.fn()
      render(<RecordActions primary={{ label: 'Periksa berkas', onClick }} />)
      await user.click(screen.getByRole('button', { name: 'Periksa berkas' }))
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    test('should offer the other actions under "Lainnya"', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      render(
        <RecordActions
          primary={{ label: 'Lihat transaksinya', onClick: () => {} }}
          more={[{ label: 'Hapus nasabah', onSelect, danger: true }]}
        />
      )
      await user.click(screen.getByRole('button', { name: /lainnya/i }))
      await user.click(await screen.findByRole('menuitem', { name: 'Hapus nasabah' }))
      expect(onSelect).toHaveBeenCalledTimes(1)
    })
  })

  describe('negative', () => {
    test('should go back without running anything when "Batal" is pressed', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      render(
        <RecordActions
          primary={{
            label: 'Eksekusi',
            confirm: { items: ['x'], confirmLabel: 'Ya, eksekusi', onConfirm },
          }}
        />
      )
      await user.click(screen.getByRole('button', { name: 'Eksekusi' }))
      await user.click(screen.getByRole('button', { name: 'Batal' }))
      expect(onConfirm).not.toHaveBeenCalled()
      expect(screen.queryByText('Sudah benar semua?')).not.toBeInTheDocument()
    })

    test('should state why the primary button is disabled', () => {
      render(
        <RecordActions
          primary={{
            label: 'Tanda tangani di wallet',
            disabled: true,
            disabledReason: 'Wallet yang terhubung bukan pemilik Safe ini',
          }}
        />
      )
      const btn = screen.getByRole('button', { name: 'Tanda tangani di wallet' })
      expect(btn).toBeDisabled()
      expect(btn).toHaveAccessibleDescription('Wallet yang terhubung bukan pemilik Safe ini')
    })
  })

  describe('edge cases', () => {
    test('should render nothing when there is no action at all', () => {
      const { container } = render(<RecordActions />)
      expect(container).toBeEmptyDOMElement()
    })

    test('should render the override instead of the bar', () => {
      render(<RecordActions primary={{ label: 'X', onClick: () => {} }} override={<p>Isi alasan</p>} />)
      expect(screen.getByText('Isi alasan')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'X' })).not.toBeInTheDocument()
    })
  })
})
