import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Modal detail satu baris tabel — pola Transaksi & OTC (keputusan PM 10 Okt
 * 2026, menggantikan panel samping yang membuat tabel "kegencet").
 *
 * Bentuknya sama dengan modal detail Log DurianPay: judul + subjudul di atas,
 * isi label–nilai per seksi (`DataSection`/`DataField`) yang menggulir sendiri,
 * dan footer aksi yang SELALU terlihat (`DialogFooter` tidak ikut menggulir).
 *
 * Navigasi ↑/↓ berpindah ke baris sebelum/sesudahnya dalam daftar yang sedang
 * tersaring tanpa menutup modal — lewat tombol di footer atau tombol panah
 * papan ketik (juga `k`/`j`). Panah diabaikan saat fokus di isian, dan saat
 * dialog lain bertumpuk di atas modal ini (mis. dialog Tolak pencairan): event
 * dari portal dialog itu tetap menggelembung lewat pohon React, jadi asalnya
 * dicek terhadap DOM konten modal ini.
 */
export interface RecordModalNav {
  /** Posisi baris ini (0-based) di daftar yang sedang tampil; null = tidak ada di daftar. */
  index: number | null
  total: number
  onPrev?: () => void
  onNext?: () => void
}

interface RecordModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  /** Tombol aksi di kanan footer (aksi utama paling kanan). */
  actions?: ReactNode
  nav?: RecordModalNav | null
  /** Tutup lewat Esc/klik luar dimatikan (mis. saat transaksi Safe berjalan). */
  locked?: boolean
  className?: string
  testId?: string
  /**
   * Modal yang membuka jendela wallet (RainbowKit, portal `[data-rk]`). Dialog
   * Radix MODAL mengunci `pointer-events` body dan menjebak fokus, sehingga
   * jendela wallet tidak bisa diklik maupun diketik (terbukti di e2e). Mode ini
   * memakai dialog NON-modal + tirai sendiri, dan tidak menutup modal saat
   * pengguna berinteraksi dengan jendela wallet atau menekan Esc di dalamnya.
   */
  walletSafe?: boolean
}

/** Event berasal dari jendela wallet RainbowKit (portal bertanda `data-rk`). */
function fromWalletModal(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('[data-rk]'))
}

function walletModalOpen(): boolean {
  return Boolean(document.querySelector('[data-rk] [role="dialog"]'))
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  const role = el.getAttribute('role')
  return role === 'combobox' || role === 'listbox' || role === 'menu' || role === 'menuitem' || role === 'option'
}

export default function RecordModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  actions,
  nav,
  locked = false,
  className,
  testId,
  walletSafe = false,
}: RecordModalProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  // Saat `locked` (tanda tangan/eksekusi Safe berjalan) pindah baris dimatikan:
  // hasil wallet dikirim ke id yang sedang tampil, jadi pindah baris di tengah
  // proses bisa mencatat hash eksekusi ke transaksi yang salah.
  const activeNav = locked ? null : nav
  const navRef = useRef(activeNav)
  useEffect(() => {
    navRef.current = activeNav
  })

  // Didengar di `window`, bukan di konten: setelah "Berikutnya" di baris
  // terakhir jadi mati, fokus jatuh ke <body> dan panah harus tetap jalan.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      const n = navRef.current
      const content = contentRef.current
      if (!n || !content || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      const target = e.target as Node | null
      if (target && target !== document.body && !content.contains(target)) return
      if (isEditable(e.target)) return
      // Dialog lain bertumpuk di atas modal ini → panah milik dialog itu.
      const dialogs = document.querySelectorAll('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')
      if (dialogs.length > 0 && dialogs[dialogs.length - 1] !== content) return
      const prev = e.key === 'ArrowUp' || e.key === 'k'
      const next = e.key === 'ArrowDown' || e.key === 'j'
      if (prev && n.onPrev) {
        e.preventDefault()
        n.onPrev()
      } else if (next && n.onNext) {
        e.preventDefault()
        n.onNext()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
    {/* Mode non-modal tidak dirender tirainya oleh Radix → pasang sendiri,
        di bawah panel (z-50) dan jauh di bawah jendela wallet. */}
    {walletSafe &&
      open &&
      createPortal(
        <div
          className="fixed inset-0 z-50 bg-[rgb(17_24_39/0.45)] animate-tirai-masuk"
          aria-hidden
          data-testid="record-modal-backdrop"
        />,
        document.body,
      )}
    <Dialog
      open={open}
      modal={!walletSafe}
      onOpenChange={(o) => {
        if (!o && !locked) onClose()
      }}
    >
      <DialogContent
        ref={contentRef}
        className={cn('max-w-3xl bg-card', className)}
        data-testid={testId}
        {...(subtitle ? {} : { 'aria-describedby': undefined })}
        onEscapeKeyDown={(e) => {
          if (locked || (walletSafe && (fromWalletModal(e.target) || walletModalOpen()))) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (locked || (walletSafe && fromWalletModal(e.detail.originalEvent.target))) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>
        <DialogBody className="space-y-6">{children}</DialogBody>
        <DialogFooter className="gap-3 sm:justify-between">
          {nav ? (
            <div className="flex items-center gap-1.5" role="group" aria-label="Pindah transaksi">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={!activeNav?.onPrev}
                onClick={activeNav?.onPrev}
                aria-label="Sebelumnya"
                title="Sebelumnya (↑)"
              >
                <ChevronUp />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={!activeNav?.onNext}
                onClick={activeNav?.onNext}
                aria-label="Berikutnya"
                title="Berikutnya (↓)"
              >
                <ChevronDown />
              </Button>
              {nav.index !== null && nav.total > 0 && (
                <span className="ml-1.5 text-xs tabular-nums text-muted-foreground" data-testid="record-modal-position">
                  {nav.index + 1} dari {nav.total}
                </span>
              )}
            </div>
          ) : (
            <span />
          )}
          {actions && <div className="flex min-w-0 flex-col-reverse gap-2 sm:flex-1 sm:flex-row sm:flex-wrap sm:justify-end">{actions}</div>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}

/** Kotak status di bagian atas isi modal: chip + kalimat "yang perlu dilakukan". */
export function RecordStatus({
  chip,
  label,
  children,
  testId = 'record-todo',
}: {
  chip?: ReactNode
  label: ReactNode
  children: ReactNode
  testId?: string
}) {
  return (
    <section className="space-y-2 rounded-md border border-border bg-muted/40 px-4 py-3" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        {chip}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-base text-foreground">{children}</div>
    </section>
  )
}
