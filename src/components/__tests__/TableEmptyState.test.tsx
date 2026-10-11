import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TableEmptyState from '@/components/TableEmptyState'

describe('TableEmptyState', () => {
  describe('positive', () => {
    test('should render default no-data copy', () => {
      render(<TableEmptyState mode="no-data" />)
      expect(screen.getByText('Belum ada data')).toBeInTheDocument()
    })

    test('should render default no-results copy', () => {
      render(<TableEmptyState mode="no-results" />)
      expect(screen.getByText('Tidak ada yang cocok dengan filter')).toBeInTheDocument()
    })

    test('should render custom title + description when provided', () => {
      render(
        <TableEmptyState
          mode="no-data"
          title="Belum ada nasabah"
          description="Tambahkan yang pertama untuk memulai."
        />
      )
      expect(screen.getByText('Belum ada nasabah')).toBeInTheDocument()
      expect(screen.getByText('Tambahkan yang pertama untuk memulai.')).toBeInTheDocument()
    })

    test('should render Hapus filter button in no-results mode with handler', () => {
      const onClear = vi.fn()
      render(<TableEmptyState mode="no-results" onClearFilters={onClear} />)
      fireEvent.click(screen.getByRole('button', { name: /hapus filter/i }))
      expect(onClear).toHaveBeenCalledTimes(1)
    })

    test('should render cta when provided', () => {
      render(
        <TableEmptyState
          mode="no-data"
          cta={<button type="button">Tambah Nasabah</button>}
        />
      )
      expect(screen.getByRole('button', { name: 'Tambah Nasabah' })).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('should not render Hapus filter button in no-results mode without handler', () => {
      render(<TableEmptyState mode="no-results" />)
      expect(screen.queryByRole('button', { name: /hapus filter/i })).not.toBeInTheDocument()
    })
  })
})
