/**
 * SYSTEM-SYNC — hält alle Admin- und Systemdaten auf dem Stand von Supabase.
 *
 * Wann geladen wird:
 *
 *   BEIM START        vor der ersten Anzeige (App zeigt so lange „Systemdaten werden
 *                     geladen …", höchstens einige Sekunden — dann mit dem Zwischenstand)
 *   REALTIME          sobald ein anderer Administrator speichert (Supabase Realtime auf
 *                     `stammdaten_overrides` und `system_daten`)
 *   FENSTERFOKUS      wenn jemand zur Anwendung zurückkehrt
 *   ALLE 60 SEKUNDEN  nur, solange Realtime nicht verbunden ist
 *   VOR DEM ABSCHLUSS eines Auftrags — der eingefrorene Preisstand soll der aktuellste sein
 *   PER KNOPF         „System aktualisieren 🔄" im Kopf
 *
 * Geladen wird alles auf einmal: Stammdaten-Overrides, Dokumente (Schema, Versionen,
 * Konten-Papierkorb, Einstellungen) und die Liste der eigenen Passwörter.
 */
import { supabase } from './supabaseClient.ts'
import {
  aendereDokument,
  getSyncStatus,
  istTabelleFehlt,
  ladeDokumente,
  setzeSyncStatus,
  type DokumentStand,
} from './supabaseSystem.ts'
import { ladeStammdatenVomServer } from './stammdatenStore.ts'
import { ladeZugaengeVomServer } from './zugangStore.ts'
import { PAPIERKORB_DOKUMENT, uebernehmePapierkorbVomServer } from './benutzerPapierkorb.ts'
import { VERSIONEN_DOKUMENT, uebernehmeVersionenVomServer } from './version.ts'
import {
  SCHEMA_ENTWURF_DOKUMENT,
  SCHEMA_VEROEFFENTLICHT_DOKUMENT,
  uebernehmeSchemaVomServer,
} from './schemaStore.ts'
import { EINSTELLUNGEN_DOKUMENT, uebernehmeEinstellungenVomServer } from './einstellungenStore.ts'

let laufend: Promise<void> | null = null
let letzteDokumente = new Map<string, DokumentStand>()

function fehlertext(error: unknown): string {
  return error instanceof Error ? error.message : (error as { message?: string })?.message ?? String(error)
}

/** Lädt den kompletten Systemstand aus Supabase. Parallele Aufrufe teilen sich einen Lauf. */
export function aktualisiereSystem(): Promise<void> {
  if (!supabase) {
    setzeSyncStatus({ ersterAbgleichFertig: true })
    return Promise.resolve()
  }
  if (laufend) return laufend
  laufend = (async () => {
    setzeSyncStatus({ laeuft: true })
    const [stammdaten, dokumente, zugaenge] = await Promise.allSettled([
      ladeStammdatenVomServer(),
      ladeDokumente(),
      ladeZugaengeVomServer(),
    ])

    if (dokumente.status === 'fulfilled') {
      letzteDokumente = dokumente.value
      const wert = (schluessel: string) => dokumente.value.get(schluessel)?.wert ?? null
      uebernehmePapierkorbVomServer(wert(PAPIERKORB_DOKUMENT))
      uebernehmeVersionenVomServer(wert(VERSIONEN_DOKUMENT))
      uebernehmeSchemaVomServer({
        veroeffentlicht: wert(SCHEMA_VEROEFFENTLICHT_DOKUMENT),
        entwurf: wert(SCHEMA_ENTWURF_DOKUMENT),
      })
      uebernehmeEinstellungenVomServer(wert(EINSTELLUNGEN_DOKUMENT))
    }

    const fehler = [stammdaten, dokumente, zugaenge]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason)
    const tabellenFehlen = fehler.some(istTabelleFehlt)
    setzeSyncStatus({
      laeuft: false,
      ersterAbgleichFertig: true,
      tabellenFehlen,
      letzterAbgleich: fehler.length === 0 ? new Date().toISOString() : getSyncStatus().letzterAbgleich,
      fehler:
        fehler.length === 0
          ? null
          : tabellenFehlen
            ? 'Die Supabase-Tabellen für Stammdaten und Konten fehlen noch — bitte supabase/system-sync.sql im SQL Editor ausführen. Bis dahin gilt der Stand aus der Excel-Mappe.'
            : `Abgleich mit Supabase fehlgeschlagen: ${fehlertext(fehler[0])}`,
    })
  })().finally(() => {
    laufend = null
  })
  return laufend
}

// ---------------------------------------------------------------------------
// Laufender Abgleich: Realtime, Fensterfokus, Rückfall-Intervall
// ---------------------------------------------------------------------------

let gestartet = false
let entprellt: ReturnType<typeof setTimeout> | null = null

function baldAktualisieren() {
  if (entprellt) clearTimeout(entprellt)
  entprellt = setTimeout(() => {
    entprellt = null
    void aktualisiereSystem()
  }, 400)
}

/** Startet den Abgleich einmalig für die ganze Anwendung. */
export function starteSystemSync(): void {
  if (gestartet || typeof window === 'undefined') return
  gestartet = true
  void aktualisiereSystem()
  if (!supabase) return

  supabase
    .channel('cramer-system-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stammdaten_overrides' }, baldAktualisieren)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'system_daten' }, baldAktualisieren)
    .subscribe((zustand) => setzeSyncStatus({ live: zustand === 'SUBSCRIBED' }))

  const beiRueckkehr = () => {
    if (document.visibilityState !== 'visible') return
    const zuletzt = getSyncStatus().letzterAbgleich
    if (zuletzt && Date.now() - new Date(zuletzt).getTime() < 10_000) return
    void aktualisiereSystem()
  }
  window.addEventListener('focus', beiRueckkehr)
  document.addEventListener('visibilitychange', beiRueckkehr)

  window.setInterval(() => {
    if (!getSyncStatus().live && document.visibilityState === 'visible') void aktualisiereSystem()
  }, 60_000)
}

// ---------------------------------------------------------------------------
// Einmalige Übernahme der früher rein lokalen Stände
// ---------------------------------------------------------------------------

/**
 * Bringt Stände, die vor der Umstellung nur im Browser eines Administrators lagen, nach
 * Supabase — aber NUR, wenn dort noch nichts steht. Ein veröffentlichter Konfigurator oder
 * eine Versionshistorie, die schon zentral liegt, wird nie von einem alten Gerätestand
 * überschrieben. Aufgerufen nach dem Anmelden eines Administrators; ein Berater-Gerät
 * lädt nie etwas hoch.
 *
 * Die Stammdaten brauchen das nicht: Ihr altes lokales Overlay erscheint automatisch als
 * „x Änderungen ausstehend" und wird mit „Speichern" übernommen (siehe stammdatenStore).
 */
export async function uebernehmeAlteLokaleStaende(): Promise<string[]> {
  if (!supabase || getSyncStatus().tabellenFehlen) return []
  await aktualisiereSystem()
  if (getSyncStatus().tabellenFehlen) return []

  const lies = (schluessel: string): unknown => {
    try {
      const roh = localStorage.getItem(schluessel)
      return roh ? JSON.parse(roh) : null
    } catch {
      return null
    }
  }
  const alteEinstellungen = (lies('cramer-planer.users.v1') as { settings?: unknown } | null)?.settings ?? null

  const kandidaten: Array<{ dokument: string; lokal: string; wert: unknown; titel: string }> = [
    { dokument: SCHEMA_VEROEFFENTLICHT_DOKUMENT, lokal: 'cramer-planer.schema.veroeffentlicht.v1', wert: lies('cramer-planer.schema.veroeffentlicht.v1'), titel: 'veröffentlichter Konfigurator' },
    { dokument: SCHEMA_ENTWURF_DOKUMENT, lokal: 'cramer-planer.schema.entwurf.v1', wert: lies('cramer-planer.schema.entwurf.v1'), titel: 'Konfigurator-Entwurf' },
    { dokument: VERSIONEN_DOKUMENT, lokal: 'cramer-planer.versionen.v1', wert: lies('cramer-planer.versionen.v1'), titel: 'Versionshistorie' },
    { dokument: PAPIERKORB_DOKUMENT, lokal: 'cramer-planer.benutzer.papierkorb.v1', wert: lies('cramer-planer.benutzer.papierkorb.v1'), titel: 'Konten-Papierkorb' },
    { dokument: EINSTELLUNGEN_DOKUMENT, lokal: 'cramer-planer.users.v1', wert: alteEinstellungen, titel: 'Einstellungen' },
  ]

  const uebernommen: string[] = []
  for (const k of kandidaten) {
    const leer = k.wert == null || (Array.isArray(k.wert) && k.wert.length === 0) ||
      (typeof k.wert === 'object' && !Array.isArray(k.wert) && Object.keys(k.wert as object).length === 0)
    if (!leer && !letzteDokumente.has(k.dokument)) {
      try {
        // Bedingt: steht inzwischen doch etwas da, bleibt es stehen.
        await aendereDokument(k.dokument, (server) => server ?? k.wert)
        uebernommen.push(k.titel)
      } catch {
        continue // beim nächsten Anmelden erneut versuchen
      }
    }
    try {
      localStorage.removeItem(k.lokal)
    } catch {
      /* best-effort */
    }
  }
  if (uebernommen.length > 0) await aktualisiereSystem()
  return uebernommen
}
