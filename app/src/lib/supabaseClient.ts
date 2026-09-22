/**
 * DER EINE SUPABASE-CLIENT der Anwendung.
 *
 * Eigenes Modul ohne weitere Abhängigkeiten, damit sowohl die Entwürfe
 * (`supabaseProjects.ts`) als auch die Stores der Systemdaten (Stammdaten, Zugänge,
 * Einstellungen) ihn benutzen können, ohne sich gegenseitig zu importieren.
 *
 * Die Zugangsdaten kommen aus `.env.local` (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
 * und landen über Vite im Browser-Bundle — hier darf deshalb nur der ANON-Key stehen.
 *
 * `import.meta.env` gibt es nur unter Vite. Die Prüfskripte (`npm run kalk:test` u. a.)
 * laden die Stores unter Node; dort bleibt der Client schlicht `null`, und alles läuft
 * gegen den Grundstand aus der Excel-Mappe.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {}
const supabaseUrl = env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY?.trim()

/** true ⇒ beide Umgebungsvariablen sind gesetzt. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null
