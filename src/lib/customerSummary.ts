import type { Tone } from '@/lib/tone'
import { deriveActivationStatus } from '@/lib/status'
import type { PhaseOneUser } from '@/lib/types'

/**
 * Ringkasan satu nasabah untuk panel Daftar Nasabah (redesain fase 1):
 * SATU status yang paling perlu dilihat + SATU kalimat tindakan + tombol utama.
 *
 * Urutan prioritasnya disengaja: akun dibekukan menutup semua hal lain (nasabah
 * tidak bisa apa-apa), lalu email aktivasi yang gagal (nasabah tidak bisa masuk
 * sama sekali), lalu berkas verifikasi yang menunggu (pekerjaan kita), lalu
 * keadaan yang hanya menunggu nasabah.
 */
export interface CustomerSummary {
  status: { label: string; tone: Tone }
  todo: { text: string; tone: Tone; needsAction: boolean }
  primary: 'verification' | 'profile' | 'transactions'
}

export function customerSummary(u: PhaseOneUser): CustomerSummary {
  if (u.suspended) {
    return {
      status: { label: 'Dibekukan', tone: 'bad' },
      todo: {
        text: 'Akun ini dibekukan. Nasabah tidak bisa mint atau redeem sampai dibuka lagi.',
        tone: 'bad',
        needsAction: false,
      },
      primary: 'profile',
    }
  }
  if (deriveActivationStatus(u) === 'FAILED') {
    return {
      status: { label: 'Email aktivasi gagal', tone: 'bad' },
      todo: {
        text: 'Email aktivasi gagal terkirim, jadi nasabah belum bisa masuk. Kirim ulang dari profil lengkap.',
        tone: 'bad',
        needsAction: true,
      },
      primary: 'profile',
    }
  }
  switch (u.kycStatus) {
    case 'PENDING':
      return {
        status: { label: 'Menunggu verifikasi', tone: 'act' },
        todo: {
          text: 'Berkas verifikasinya menunggu diperiksa di Nasabah › Verifikasi.',
          tone: 'act',
          needsAction: true,
        },
        primary: 'verification',
      }
    case 'REJECTED':
      return {
        status: { label: 'Verifikasi ditolak', tone: 'bad' },
        todo: {
          text: 'Verifikasi terakhirnya ditolak. Nasabah perlu mengajukan ulang.',
          tone: 'wait',
          needsAction: false,
        },
        primary: 'transactions',
      }
    case 'UNVERIFIED':
      return {
        status: { label: 'Belum diverifikasi', tone: 'wait' },
        todo: {
          text: !u.emailVerifiedAt
            ? 'Nasabah belum mengaktifkan akun lewat email, dan belum mengirim berkas verifikasi.'
            : 'Nasabah belum mengirim berkas verifikasi. Belum ada yang perlu dilakukan.',
          tone: 'wait',
          needsAction: false,
        },
        primary: 'transactions',
      }
    case 'VERIFIED':
      return {
        status: { label: 'Terverifikasi', tone: 'ok' },
        todo: { text: 'Tidak perlu tindakan.', tone: 'ok', needsAction: false },
        primary: 'transactions',
      }
    default:
      return {
        status: { label: 'Status belum dikenali', tone: 'wait' },
        todo: {
          text: 'Status verifikasi ini belum dikenali layar. Lihat kode statusnya di Detail teknis.',
          tone: 'wait',
          needsAction: false,
        },
        primary: 'profile',
      }
  }
}
