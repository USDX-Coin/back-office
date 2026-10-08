import { describe, test, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DetailPanel, { PanelFacts, PanelHistory, PanelTechnical } from '../DetailPanel'
import PanelActions from '../PanelActions'
import GroupedTable, { type RowGroup } from '../GroupedTable'

function renderPanel(overrides: Partial<React.ComponentProps<typeof DetailPanel>> = {}) {
  const onClose = vi.fn()
  render(
    <DetailPanel
      label="Detail permintaan OTC"
      kind="Mint OTC"
      status={{ label: '1 dari 2 tanda tangan', tone: 'act' }}
      title="PT Sinar Niaga"
      amount="50.000 USDX"
      amountSub="Rp 812.500.000"
      todo={{ text: 'Tanda tanganmu yang kedua — setelah itu USDX langsung dicetak.' }}
      onClose={onClose}
      {...overrides}
    >
      <PanelFacts facts={[['Wallet tujuan', '0x5aAe…BeAed'], ['Kurs', 'Rp 16.250 per USDX']]} />
      <PanelHistory events={[{ text: 'Sarah King membuat permintaan mint', time: '08 Okt · 14:31' }]} />
      <PanelTechnical facts={[['Status sistem', 'PENDING_APPROVAL']]} />
    </DetailPanel>
  )
  return { onClose }
}

describe('DetailPanel', () => {
  describe('positive', () => {
    test('should render kind, status, title, amount and the one-sentence todo', () => {
      renderPanel()
      const panel = screen.getByRole('region', { name: 'Detail permintaan OTC' })
      expect(within(panel).getByText('Mint OTC')).toBeInTheDocument()
      expect(within(panel).getByText('1 dari 2 tanda tangan')).toBeInTheDocument()
      expect(within(panel).getByRole('heading', { name: 'PT Sinar Niaga' })).toBeInTheDocument()
      expect(within(panel).getByText('50.000 USDX')).toBeInTheDocument()
      expect(within(panel).getByText('Yang perlu kamu lakukan')).toBeInTheDocument()
      expect(within(panel).getByText(/Tanda tanganmu yang kedua/)).toBeInTheDocument()
    })

    test('should render facts as label–value pairs and history as sentences', () => {
      renderPanel()
      expect(screen.getByText('Wallet tujuan')).toBeInTheDocument()
      expect(screen.getByText('Rp 16.250 per USDX')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Riwayat' })).toBeInTheDocument()
      expect(screen.getByText('Sarah King membuat permintaan mint')).toBeInTheDocument()
    })

    test('should fold raw codes under "Detail teknis", closed by default', () => {
      renderPanel()
      const toggle = screen.getByRole('button', { name: /detail teknis/i })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })

    test('should move focus to the heading so the new row is announced', () => {
      renderPanel()
      expect(screen.getByRole('heading', { name: 'PT Sinar Niaga' })).toHaveFocus()
    })
  })

  describe('negative', () => {
    test('should call onClose from both "Tutup" and "Kembali ke tabel"', async () => {
      const user = userEvent.setup()
      const { onClose } = renderPanel()
      await user.click(screen.getByRole('button', { name: /^tutup$/i }))
      await user.click(screen.getByRole('button', { name: /kembali ke tabel/i }))
      expect(onClose).toHaveBeenCalledTimes(2)
    })

    test('should close on Escape', async () => {
      const user = userEvent.setup()
      const { onClose } = renderPanel()
      await user.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('edge cases', () => {
    test('should omit the todo box, amount and empty sections when not given', () => {
      render(
        <DetailPanel label="Detail" kind="Perorangan" title="Andi" onClose={() => {}}>
          <PanelFacts facts={[]} />
          <PanelHistory events={[]} />
        </DetailPanel>
      )
      expect(screen.queryByTestId('panel-todo')).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Riwayat' })).not.toBeInTheDocument()
      expect(screen.queryByText('Data')).not.toBeInTheDocument()
    })
  })
})

describe('PanelActions', () => {
  describe('positive', () => {
    test('should ask "Sudah benar semua?" with the consequences before running the risky action', async () => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      render(
        <PanelActions
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
      render(<PanelActions primary={{ label: 'Periksa berkas', onClick }} />)
      await user.click(screen.getByRole('button', { name: 'Periksa berkas' }))
      expect(onClick).toHaveBeenCalledTimes(1)
    })

    test('should offer the other actions under "Lainnya"', async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      render(
        <PanelActions
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
        <PanelActions
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
        <PanelActions
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
      const { container } = render(<PanelActions />)
      expect(container).toBeEmptyDOMElement()
    })

    test('should render the override instead of the bar', () => {
      render(<PanelActions primary={{ label: 'X', onClick: () => {} }} override={<p>Isi alasan</p>} />)
      expect(screen.getByText('Isi alasan')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'X' })).not.toBeInTheDocument()
    })
  })
})

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
