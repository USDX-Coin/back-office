import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GroupedTable, { type RowGroup } from '../table/GroupedTable'

interface Row {
  id: string
  name: string
}

function groups(over: Partial<RowGroup<Row>>[] = []): RowGroup<Row>[] {
  return [
    { key: 'act', label: 'Perlu tindakan', emphasis: true, rows: [{ id: 'a', name: 'Alpha' }], ...over[0] },
    {
      key: 'rest',
      label: 'Lainnya',
      rows: [{ id: 'b', name: 'Beta' }],
      total: 25,
      emptyText: 'Belum ada.',
      ...over[1],
    },
  ]
}

describe('GroupedTable', () => {
  const columns = [{ id: 'name', header: 'Nama', cell: (r: Row) => r.name }]

  describe('positive', () => {
    test('should render each group with its count, action group first', () => {
      render(
        <GroupedTable columns={columns} groups={groups()} rowKey={(r) => r.id} rowLabel={(r) => `Buka ${r.name}`} onSelect={() => {}} />
      )
      const bodies = document.querySelectorAll('tbody[data-group]')
      expect([...bodies].map((b) => b.getAttribute('data-group'))).toEqual(['act', 'rest'])
      expect(screen.getByText('Perlu tindakan')).toBeInTheDocument()
      expect(screen.getByText('· 25')).toBeInTheDocument()
    })

    test('should select a row by click and by keyboard, and mark the selected row', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      const { rerender } = render(
        <GroupedTable columns={columns} groups={groups()} rowKey={(r) => r.id} rowLabel={(r) => `Buka ${r.name}`} onSelect={onSelect} />
      )
      await user.click(screen.getByRole('button', { name: 'Buka Alpha' }))
      screen.getByRole('button', { name: 'Buka Beta' }).focus()
      await user.keyboard('{Enter}')
      expect(onSelect.mock.calls.map((c) => c[0].id)).toEqual(['a', 'b'])
      rerender(
        <GroupedTable columns={columns} groups={groups()} rowKey={(r) => r.id} rowLabel={(r) => `Buka ${r.name}`} onSelect={onSelect} selectedKey="b" />
      )
      expect(screen.getByRole('button', { name: 'Buka Beta' })).toHaveAttribute('aria-current', 'true')
      expect(screen.getByRole('button', { name: 'Buka Alpha' })).not.toHaveAttribute('aria-current')
    })

    test('should page the lower group', async () => {
      const user = userEvent.setup()
      const onPage = vi.fn()
      render(
        <GroupedTable
          columns={columns}
          groups={groups([{}, { pagination: { page: 1, pageCount: 3, onPage } }])}
          rowKey={(r) => r.id}
          rowLabel={(r) => r.name}
          onSelect={() => {}}
        />
      )
      expect(screen.getByText('Halaman 1 dari 3')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Halaman sebelumnya' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Halaman berikutnya' }))
      expect(onPage).toHaveBeenCalledWith(2)
    })
  })

  describe('negative', () => {
    test('should show an error with retry inside the failing group only', async () => {
      const user = userEvent.setup()
      const onRetry = vi.fn()
      render(
        <GroupedTable
          columns={columns}
          groups={groups([{}, { isError: true, rows: [], onRetry }])}
          rowKey={(r) => r.id}
          rowLabel={(r) => r.name}
          onSelect={() => {}}
        />
      )
      expect(screen.getByText('Alpha')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Coba lagi' }))
      expect(onRetry).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    test('should drop an empty group without empty text, but say so when it has one', () => {
      render(
        <GroupedTable
          columns={columns}
          groups={groups([{ rows: [] }, { rows: [], total: 0 }])}
          rowKey={(r) => r.id}
          rowLabel={(r) => r.name}
          onSelect={() => {}}
        />
      )
      expect(screen.queryByText('Perlu tindakan')).not.toBeInTheDocument()
      expect(screen.getByText('Belum ada.')).toBeInTheDocument()
    })
  })
})
