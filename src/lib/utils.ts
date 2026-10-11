import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Token huruf per peran (`src/index.css`) harus dikenal tailwind-merge sebagai
// UKURAN huruf. Tanpa ini `text-label` dianggap WARNA teks, dan
// `cn('text-label', 'text-muted-foreground')` diam-diam membuang ukurannya.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['label', 'section', 'money', 'money-lg', 'dialog-title', 'page-title'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
