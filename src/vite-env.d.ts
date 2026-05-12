/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  // Set to "true" by the Playwright webServer so main.tsx skips starting the MSW
  // browser worker — the E2E suite intercepts the API itself via page.route().
  readonly VITE_E2E?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
