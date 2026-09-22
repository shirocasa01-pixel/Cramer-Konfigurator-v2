/**
 * SYSTEM-EINSTELLUNGEN — Wartungsmodus und E-Mail-Regel, für alle Geräte gleich.
 *
 * Früher lagen beide Schalter im localStorage des Administrators: Ein auf dem Laptop
 * eingeschalteter Wartungsmodus erreichte das iPad in der Filiale nie. Jetzt liegen sie
 * als Dokument `einstellungen` in `system_daten`; der localStorage hält nur einen
 * Zwischenspeicher für einen schnellen Start.
 *
 * Kein React: Modul-State mit `subscribe()`, gebunden über `useSyncExternalStore` im
 * AuthContext.
 */
import { aendereDokument, meldeSchreibfehler } from './supabaseSystem.ts'
import type { UserSettings } from '../types/index.ts'

export const EINSTELLUNGEN_DOKUMENT = 'einstellungen'
const CACHE_KEY = 'cramer-planer.einstellungen.cache.v1'

const STANDARD: UserSettings = { enforceCramerEmail: false, maintenanceMode: false }

function normalisiere(wert: unknown): UserSettings {
  const w = (wert ?? {}) as Partial<UserSettings>
  return { enforceCramerEmail: Boolean(w.enforceCramerEmail), maintenanceMode: Boolean(w.maintenanceMode) }
}

function ladeCache(): UserSettings {
  try {
    const roh = localStorage.getItem(CACHE_KEY)
    return roh ? normalisiere(JSON.parse(roh)) : STANDARD
  } catch {
    return STANDARD
  }
}

let einstellungen: UserSettings = ladeCache()
const hoerer = new Set<() => void>()

function melde() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(einstellungen))
  } catch {
    /* best-effort */
  }
  hoerer.forEach((h) => h())
}

export function getEinstellungen(): UserSettings {
  return einstellungen
}

export function subscribeEinstellungen(h: () => void): () => void {
  hoerer.add(h)
  return () => hoerer.delete(h)
}

/** Übernimmt den Serverstand — von `systemSync.ts` aufgerufen. */
export function uebernehmeEinstellungenVomServer(wert: unknown): void {
  const neu = normalisiere(wert)
  if (neu.enforceCramerEmail === einstellungen.enforceCramerEmail && neu.maintenanceMode === einstellungen.maintenanceMode) {
    return
  }
  einstellungen = neu
  melde()
}

/** Ändert einen Schalter — sofort lokal, auf dem aktuellen Serverstand in Supabase. */
export function setzeEinstellung(patch: Partial<UserSettings>): void {
  einstellungen = { ...einstellungen, ...patch }
  melde()
  aendereDokument<UserSettings>(EINSTELLUNGEN_DOKUMENT, (server) => ({ ...normalisiere(server), ...patch })).then(
    (serverStand) => uebernehmeEinstellungenVomServer(serverStand),
    (error) => meldeSchreibfehler('Einstellung', error),
  )
}
