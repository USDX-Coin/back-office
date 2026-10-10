import { toast } from 'sonner'
import { humanizeError } from './errorMessages'

/** Toast galat API: kalimat manusia + kode server sebagai keterangan kecil. */
export function toastError(err: unknown, fallback?: string, overrides?: Record<string, string>) {
  const { message, technical } = humanizeError(err, { fallback, overrides })
  toast.error(message, technical ? { description: `Detail teknis: ${technical}` } : undefined)
}

/** Toast dengan kalimat khusus layar; kode server tetap jadi keterangan kecil. */
export function toastErrorMessage(message: string, err: unknown) {
  const { technical } = humanizeError(err)
  toast.error(message, technical ? { description: `Detail teknis: ${technical}` } : undefined)
}
