import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TxHashLink } from '@/components/OnChainLinks'

const ON_CHAIN = '0x' + 'a'.repeat(64)

describe('TxHashLink', () => {
  describe('positive', () => {
    test('renders a clickable truncated hash with target/rel when href is set', () => {
      render(
        <TxHashLink hash={ON_CHAIN} href={`https://polygonscan.com/tx/${ON_CHAIN}`} label="View tx" />
      )
      const link = screen.getByRole('link', { name: /view tx/i })
      expect(link.getAttribute('href')).toBe(`https://polygonscan.com/tx/${ON_CHAIN}`)
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
      expect(link.textContent).toContain('0xaaaaaaaa') // truncated, not the full hash
      expect(link.textContent).not.toContain(ON_CHAIN)
    })
  })

  describe('edge cases', () => {
    test('renders an em dash when hash is null', () => {
      render(<TxHashLink hash={null} href={null} label="View tx" />)
      expect(screen.getByText('—')).toBeInTheDocument()
      expect(screen.queryByRole('link')).toBeNull()
    })

    test('renders plain truncated text (no link) when hash is set but href is null', () => {
      render(<TxHashLink hash={ON_CHAIN} href={null} label="View tx" />)
      expect(screen.queryByRole('link')).toBeNull()
      expect(screen.getByText(/^0xaaaaaaaa…/)).toBeInTheDocument()
    })
  })
})
