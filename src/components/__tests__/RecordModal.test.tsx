import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecordModal from '../record-modal/RecordModal'

function renderModal(locked: boolean) {
  const onPrev = vi.fn()
  const onNext = vi.fn()
  render(
    <RecordModal
      open
      onClose={() => {}}
      title="Transaksi A"
      locked={locked}
      nav={{ index: 1, total: 3, onPrev, onNext }}
    >
      <p>isi</p>
    </RecordModal>,
  )
  return { onPrev, onNext }
}

describe('RecordModal navigasi baris', () => {
  describe('positive', () => {
    test('should move to the previous/next row with the buttons and ↑/↓ when not locked', async () => {
      const user = userEvent.setup()
      const { onPrev, onNext } = renderModal(false)
      await user.click(screen.getByRole('button', { name: 'Berikutnya' }))
      await user.click(screen.getByRole('button', { name: 'Sebelumnya' }))
      await user.keyboard('{ArrowDown}{ArrowUp}')
      expect(onNext).toHaveBeenCalledTimes(2)
      expect(onPrev).toHaveBeenCalledTimes(2)
    })
  })

  describe('negative', () => {
    // Hasil wallet dikirim ke id yang sedang tampil; pindah baris di tengah
    // eksekusi Safe bisa mencatat hash ke transaksi yang salah.
    test('should block row navigation (buttons and keyboard) while locked', async () => {
      const user = userEvent.setup()
      const { onPrev, onNext } = renderModal(true)
      expect(screen.getByRole('button', { name: 'Berikutnya' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Sebelumnya' })).toBeDisabled()
      await user.keyboard('{ArrowDown}{ArrowUp}jk')
      expect(onNext).not.toHaveBeenCalled()
      expect(onPrev).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    test('should keep showing the row position while locked', () => {
      renderModal(true)
      expect(screen.getByTestId('record-modal-position')).toHaveTextContent('2 dari 3')
    })
  })
})
