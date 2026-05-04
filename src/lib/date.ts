import { formatInTimeZone } from 'date-fns-tz'
import { id } from 'date-fns/locale'

const TZ = 'Asia/Jakarta'

export function formatDate(iso: string | Date): string {
  return formatInTimeZone(iso, TZ, 'd MMMM yyyy', { locale: id })
}

export function formatDateTime(iso: string | Date): string {
  return formatInTimeZone(iso, TZ, "d MMMM yyyy, HH:mm 'WIB'", { locale: id })
}
