import type { ReactNode } from 'react'
import PageHeader from '@/components/PageHeader'
import SectionTabs from '@/components/SectionTabs'
import { useAuth } from '@/lib/auth'
import { settingsTabsFor } from './settingsTabDefs'

/**
 * Kepala empat halaman di bawah menu "Kurs & Biaya" (Kurs · Biaya · Batas Safe
 * Manager · Kontak Darurat). Sapu bersih 11 Okt 2026: dulu tab berdiri DI ATAS
 * judul halaman dan judulnya berganti per tab; sekarang judul = nama menu
 * (sama dengan sidebar + breadcrumb), keterangan = isi tab yang terbuka, lalu
 * tab di bawahnya — susunan yang sama dengan Transaksi.
 */
export default function SettingsTabs({ subtitle, actions }: { subtitle: ReactNode; actions?: ReactNode }) {
  const { user } = useAuth()
  return (
    <>
      <PageHeader title="Kurs & Biaya" subtitle={subtitle} actions={actions} />
      <SectionTabs tabs={settingsTabsFor(user)} ariaLabel="Halaman pengaturan" />
    </>
  )
}
