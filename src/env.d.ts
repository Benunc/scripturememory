/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_SHEET_ID: string
  readonly VITE_GOOGLE_CLIENT_EMAIL: string
  readonly VITE_GOOGLE_PRIVATE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 