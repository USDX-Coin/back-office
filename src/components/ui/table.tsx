import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /**
   * Lebar minimum tabel dalam piksel. Di bawah angka ini pembungkusnya
   * menggulir ke samping alih-alih memeras kolom.
   *
   * Tanpa ini `<table className="w-full">` akan MENYUSUT sampai muat, dan
   * kolom yang isinya bisa dipecah (alamat surel di `/transactions` memakai
   * `break-all`) menyusut sampai selebar SATU HURUF. Hasilnya di layar 900px:
   * satu baris setinggi ±350px, dan hanya dua transaksi yang terlihat. Lebar
   * minimum memindahkan keputusannya dari "peras apa pun yang bisa diperas"
   * ke "gulir kalau memang tidak muat".
   */
  minWidth?: number
  /**
   * Pasang `table-layout: fixed`. Dipakai bersama `<colgroup>`: lebar kolom
   * jadi mengikat, bukan saran, jadi satu sel panjang tidak bisa lagi menarik
   * lebar kolom lain.
   */
  fixedLayout?: boolean
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, minWidth, fixedLayout, style, children, ...props }, ref) => (
    // `data-usdx-scroll` memasang bayangan gulir CSS murni (index.css): tepi
    // menggelap HANYA selama masih ada isi di arah itu, dan hilang sendiri di
    // ujungnya. Yang lama sebuah gradien `md:hidden` — jadi di layar desktop,
    // tempat tabel 12 kolom justru paling sering meluap, tidak ada tanda sama
    // sekali bahwa ada kolom lain di sebelah kanan.
    <div data-usdx-scroll="" className="relative w-full overflow-auto">
      <table
        ref={ref}
        // `data-usdx-table` adalah kait untuk aturan tabel bersama di
        // `src/index.css`: baris dipisah oleh isian (belang + sorotan) alih-alih
        // garis, dan sel memotong teks panjang dengan elipsis. Dipasang di sini
        // supaya SEMUA halaman tabel ikut sekaligus, bukan per halaman.
        data-usdx-table=""
        className={cn(
          "w-full caption-bottom text-sm",
          fixedLayout && "table-fixed",
          className
        )}
        style={minWidth ? { minWidth, ...style } : style}
        {...props}
      >
        {children}
      </table>
    </div>
  )
)
Table.displayName = "Table"

/**
 * `<colgroup>` dari lebar kolom TanStack.
 *
 * `DataTable` sebelumnya tidak pernah meneruskan lebar kolom ke DOM sama
 * sekali — nol `getSize()`, nol `<colgroup>` — jadi definisi `size` di
 * `ColumnDef` tidak berpengaruh apa pun dan peramban membagi lebar hanya dari
 * isi sel. Ini yang menutupnya.
 */
const TableColgroup = ({ widths }: { widths: number[] }) => (
  <colgroup>
    {widths.map((w, i) => (
      <col key={i} style={{ width: `${w}px` }} />
    ))}
  </colgroup>
)
TableColgroup.displayName = "TableColgroup"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors duration-[120ms] data-[state=selected]:bg-accent",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-9 px-3 text-left align-middle text-2xs font-medium tracking-[0.01em] text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("px-3 py-2 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-xs text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

/**
 * Teks sel satu baris yang dipotong elipsis, dengan nilai UTUH di tooltip.
 *
 * Memotong tanpa menyediakan nilai utuhnya hanya menukar satu kerusakan dengan
 * kerusakan lain: operator yang mencari "surel siapa ini" tetap tidak bisa
 * menjawabnya. `title` dipasang juga supaya nilainya tetap terbaca oleh
 * perangkat yang tidak punya hover.
 */
function TableCellText({
  value,
  className,
  children,
}: {
  value: string
  className?: string
  children?: React.ReactNode
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            title={value}
            className={cn("block min-w-0 truncate text-left", className)}
          >
            {children ?? value}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-[24rem] break-all">
          {value}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Satu baris di dalam `TableCellStack`. */
export interface TableCellLine {
  /**
   * Nilai UTUH. Ini yang masuk ke `title` dan ke tooltip — bukan yang dirender.
   * Untuk nilai yang sengaja dipendekkan (hash, uuid) isi `children` dengan
   * bentuk pendeknya dan `value` dengan nilai penuhnya.
   */
  value: string
  /** Bentuk yang dirender, kalau berbeda dari `value`. */
  children?: React.ReactNode
  className?: string
  /** Baris yang boleh hilang (mis. penanda opsional) — `false`/`null` dilewati. */
  key?: string
}

/**
 * Sel BERTINGKAT — dua atau tiga baris teks dalam satu sel, masing-masing
 * memotong dengan elipsis dan masing-masing membawa nilai utuhnya.
 *
 * KENAPA ADA: pola `<div className="flex flex-col"><span>…</span></div>` yang
 * ditulis tangan adalah jebakan. `text-overflow` di `td` tidak berlaku untuk
 * anak blok, jadi sel seperti itu dipotong TANPA TANDA — "Rp 4.012.350,00"
 * terbaca "Rp 4.012.350,0" dan tidak ada apa pun yang mengatakan ada digit yang
 * hilang. `src/index.css` sekarang memasang jaring pengaman supaya tandanya
 * selalu muncul; komponen ini adalah sisi keduanya: nilai utuhnya tetap ada di
 * `title` dan tooltip, jadi angka yang terpotong masih bisa dibaca.
 *
 * Kolom uang, nomor rekening, dan stempel waktu WAJIB lewat sini (atau lewat
 * `TableCellText` untuk sel satu baris).
 */
function TableCellStack({
  lines,
  className,
}: {
  lines: (TableCellLine | false | null | undefined)[]
  className?: string
}) {
  const visible = lines.filter((l): l is TableCellLine => Boolean(l))
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      {visible.map((line, i) => (
        <TableCellText key={line.key ?? i} value={line.value} className={line.className}>
          {line.children}
        </TableCellText>
      ))}
    </div>
  )
}
TableCellStack.displayName = "TableCellStack"

export {
  Table,
  TableColgroup,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCellText,
  TableCellStack,
  TableCaption,
}
