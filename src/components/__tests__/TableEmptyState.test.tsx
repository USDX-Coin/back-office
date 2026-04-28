import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TableEmptyState from '@/components/TableEmptyState'

describe('TableEmptyState', () => {
  describe('positive', () => {
    test('should render default no-data copy', () => {
      render(<TableEmptyState mode="no-data" />)
      expect(screen.getByText('No data yet')).toBeInTheDocument()
    })

    test('should render default no-results copy', () => {
      render(<TableEmptyState mode="no-results" />)
      expect(screen.getByText('No results match your filters')).toBeInTheDocument()
    })

    test('should render custom title + description when provided', () => {
      render(
        <TableEmptyState
          mode="no-data"
          title="No users yet"
          description="Add your first one to get started."
        />
      )
      expect(screen.getByText('No users yet')).toBeInTheDocument()
      expect(screen.getByText('Add your first one to get started.')).toBeInTheDocument()
    })

    test('should render Clear filters button in no-results mode with handler', () => {
      const onClear = vi.fn()
      render(<TableEmptyState mode="no-results" onClearFilters={onClear} />)
      fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))
      expect(onClear).toHaveBeenCalledTimes(1)
    })

    test('should render cta when provided', () => {
      render(
        <TableEmptyState
          mode="no-data"
          cta={<button type="button">Add User</button>}
        />
      )
      expect(screen.getByRole('button', { name: 'Add User' })).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    test('should not render Clear filters button in no-results mode without handler', () => {
      render(<TableEmptyState mode="no-results" />)
      expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument()
    })
  })
})
