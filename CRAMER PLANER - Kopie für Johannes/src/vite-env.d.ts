/// <reference types="vite/client" />

/**
 * Supabase-Zugangsdaten. Liegen in `.env.local` (nicht im Repo, siehe .gitignore).
 * Beide Werte sind zur Laufzeit im Browser-Bundle sichtbar — deshalb ausschliesslich
 * der ANON-Key mit aktiver Row-Level-Security, niemals der Service-Role-Key.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
