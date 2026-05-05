const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? ''

if (!apiUrl && import.meta.env.PROD) {
  // Surface misconfigured deploys early instead of letting fetch() hit a relative path.
  console.warn('[env] VITE_API_URL is empty in a production build')
}

export const env = {
  apiUrl,
} as const
