import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// P1-5 audit alur — panel ini dulu mencetak nama method smart contract
// (`burnWithIdempotency`) ke layar operator. Nama itu tidak membantu siapa pun
// mengisi form di sebelahnya: yang perlu diketahui operator adalah urutan
// kejadiannya dan bagian mana yang jadi tanggung jawabnya.
export default function BurnRequestInfoPanel() {
  return (
    <Card className="rounded-md shadow-none dark:border-0">
      <CardHeader>
        <CardTitle className="text-base font-semibold tracking-tight">
          Bagaimana redeem OTC diselesaikan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
        <ol className="ml-4 list-decimal space-y-1.5">
          <li>Nasabah sudah mengirim USDX ke dompet Safe di luar aplikasi.</li>
          <li>
            Operator mengisi form ini dengan bukti transaksi setorannya dan
            rekening bank nasabah untuk transfer rupiahnya.
          </li>
          <li>
            Sistem memeriksa setorannya di blockchain, menghitung rupiahnya,
            memilih dompet Safe (Staf atau Manager, mengikuti nominalnya), lalu
            memasukkan transaksinya ke antrean tanda tangan.
          </li>
          <li>
            Manager menandatangani dan menjalankan transaksinya; setelah itu
            operator mentransfer rupiahnya ke rekening nasabah.
          </li>
        </ol>
        <p className="border-t border-border/40 pt-3 text-2xs">
          Perjalanannya bisa dipantau di halaman
          <span className="mx-1 font-medium text-foreground">OTC</span>.
          Permintaan baru muncul di kelompok <em>Perlu tindakan</em>.
        </p>
      </CardContent>
    </Card>
  )
}
