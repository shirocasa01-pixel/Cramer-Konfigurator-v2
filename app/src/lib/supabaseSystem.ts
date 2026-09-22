/**
 * SUPABASE FÜR SYSTEMDATEN — die Schicht unter allen Admin-Stores.
 *
 * Drei Tabellen (Anlage: `supabase/system-sync.sql`):
 *
 *   stammdaten_overrides   eine Zeile je abweichendem Datensatz — `stammdatenStore.ts`
 *   system_daten           Dokumente — Schema, Versionen, Konten-Papierkorb, Einstellungen
 *   benutzer_zugaenge      eigene Passwörter, nur über Funktionen erreichbar — `zugangStore.ts`
 *
 * Dieses Modul kennt keinen Store, die Stores kennen dieses Modul. Wer wann lädt, steuert
 * `systemSync.ts`.
 *
 * GLEICHZEITIGES ARBEITEN: Jede Zeile trägt eine `version`. Geschrieben wird nur, wenn sie
 * noch die zuletzt gelesene ist. Hat ein anderer Administrator in der Zwischenzeit
 * gespeichert, wird bei Dokumenten auf dessen Stand neu aufgesetzt (die Änderung ist
 * eine Funktion, kein fertiger Wert) und bei Stammdaten-Datensätzen ein Konflikt
 * gemeldet — nie still überschrieben.
 */
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabaseClient.ts'

// ---------------------------------------------------------------------------
// Status — für die Anzeige im Kopf und den Ladebildschirm
// ---------------------------------------------------------------------------

export interface SyncStatus {
  /** Ist Supabase überhaupt konfiguriert (.env.local)? */
  konfiguriert: boolean
  /** Läuft gerade ein Abgleich? */
  laeuft: boolean
  /** Ist der erste Abgleich seit dem Start abgeschlossen (erfolgreich oder nicht)? */
  ersterAbgleichFertig: boolean
  /** ISO-Zeitpunkt des letzten erfolgreichen Abgleichs. */
  letzterAbgleich: string | null
  /** true ⇒ die Tabellen aus `supabase/system-sync.sql` fehlen noch. */
  tabellenFehlen: boolean
  /** Letzter Fehler im Klartext; null nach einem erfolgreichen Abgleich. */
  fehler: string | null
  /** Realtime-Kanal verbunden? */
  live: boolean
}

let status: SyncStatus = {
  konfiguriert: supabase != null,
  laeuft: false,
  ersterAbgleichFertig: supabase == null,
  letzterAbgleich: null,
  tabellenFehlen: false,
  fehler: null,
  live: false,
}
const statusHoerer = new Set<() => void>()

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeSyncStatus(h: () => void): () => void {
  statusHoerer.add(h)
  return () => statusHoerer.delete(h)
}

export function setzeSyncStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch }
  statusHoerer.forEach((h) => h())
}

/** Schreibfehler melden — der Kopf zeigt sie an, statt dass sie still verpuffen. */
export function meldeSchreibfehler(was: string, error: unknown): void {
  const text = error instanceof Error ? error.message : (error as PostgrestError)?.message ?? String(error)
  setzeSyncStatus({
    fehler: `${was} nicht gespeichert — Supabase meldet: ${text}`,
    tabellenFehlen: status.tabellenFehlen || istTabelleFehlt(error),
  })
}

/** Tabelle oder Funktion aus `system-sync.sql` fehlt (noch nicht ausgeführt). */
export function istTabelleFehlt(error: unknown): boolean {
  const e = error as Partial<PostgrestError> | null
  if (!e) return false
  if (e.code === 'PGRST205' || e.code === 'PGRST202' || e.code === '42P01' || e.code === '42883') return true
  return /could not find the (table|function)|does not exist/i.test(e.message ?? '')
}

// ---------------------------------------------------------------------------
// Wer schreibt? — für `updated_by`
// ---------------------------------------------------------------------------

let bearbeiter: string | null = null

/** Von AuthContext gesetzt, damit jede Zeile ihren Urheber trägt. */
export function setzeBearbeiter(name: string | null): void {
  bearbeiter = name
}

// ---------------------------------------------------------------------------
// system_daten — Dokumente
// ---------------------------------------------------------------------------

export interface DokumentStand<T = unknown> {
  wert: T | null
  version: number
}

export async function ladeDokumente(): Promise<Map<string, DokumentStand>> {
  if (!supabase) return new Map()
  const { data, error } = await supabase.from('system_daten').select('schluessel, wert, version')
  if (error) throw error
  return new Map((data ?? []).map((z) => [z.schluessel as string, { wert: z.wert, version: z.version as number }]))
}

/**
 * Ändert ein Dokument auf dem AKTUELLEN Serverstand.
 *
 * `aendere` bekommt den Wert, der gerade in Supabase steht, und liefert den neuen.
 * Hat zwischen Lesen und Schreiben jemand anderes gespeichert, schlägt das bedingte
 * Update fehl (Versionsnummer passt nicht mehr) — dann wird neu gelesen und `aendere`
 * erneut angewandt. Zwei Administratoren, die gleichzeitig je einen Berater in den
 * Papierkorb legen, verlieren so keinen der beiden Einträge.
 */
export async function aendereDokument<T>(
  schluessel: string,
  aendere: (aktuell: T | null) => T | null,
): Promise<T | null> {
  if (!supabase) return aendere(null)
  for (let versuch = 0; versuch < 6; versuch++) {
    const { data: zeile, error: leseFehler } = await supabase
      .from('system_daten')
      .select('wert, version')
      .eq('schluessel', schluessel)
      .maybeSingle()
    if (leseFehler) throw leseFehler

    const neu = aendere((zeile?.wert as T | null) ?? null)
    const jetzt = new Date().toISOString()

    if (!zeile) {
      const { error } = await supabase
        .from('system_daten')
        .insert({ schluessel, wert: neu, version: 1, updated_at: jetzt, updated_by: bearbeiter })
      if (!error) return neu
      if (error.code === '23505') continue // gleichzeitig angelegt — neu lesen
      throw error
    }

    const { data: getroffen, error } = await supabase
      .from('system_daten')
      .update({ wert: neu, version: (zeile.version as number) + 1, updated_at: jetzt, updated_by: bearbeiter })
      .eq('schluessel', schluessel)
      .eq('version', zeile.version)
      .select('schluessel')
    if (error) throw error
    if (getroffen && getroffen.length > 0) return neu
    // Version hat sich bewegt: ein anderer Administrator war schneller — neu aufsetzen.
  }
  throw new Error(`„${schluessel}" wird gerade von mehreren Stellen gleichzeitig geändert — bitte erneut versuchen.`)
}

// ---------------------------------------------------------------------------
// stammdaten_overrides — ein Datensatz je Zeile
// ---------------------------------------------------------------------------

export type OverrideAktion = 'geaendert' | 'neu' | 'geloescht' | 'wert'

export interface OverrideZeile {
  bereich: string
  schluessel: string
  aktion: OverrideAktion
  daten: unknown
  version: number
  updated_at?: string
  updated_by?: string | null
}

export async function ladeOverrides(): Promise<OverrideZeile[]> {
  if (!supabase) return []
  const alle: OverrideZeile[] = []
  // PostgREST liefert höchstens 1000 Zeilen je Abfrage — ein kompletter Excel-Import
  // erzeugt mehr (1.500 Preiszeilen). Deshalb seitenweise.
  const SEITE = 1000
  for (let von = 0; ; von += SEITE) {
    const { data, error } = await supabase
      .from('stammdaten_overrides')
      .select('bereich, schluessel, aktion, daten, version, updated_at, updated_by')
      .order('updated_at', { ascending: true })
      .order('bereich', { ascending: true })
      .order('schluessel', { ascending: true })
      .range(von, von + SEITE - 1)
    if (error) throw error
    alle.push(...((data ?? []) as OverrideZeile[]))
    if (!data || data.length < SEITE) break
  }
  return alle
}

/** Eine zu schreibende Änderung: neuer Inhalt oder `null` (= zurück auf den Grundstand). */
export interface OverrideAenderung {
  bereich: string
  schluessel: string
  neu: { aktion: OverrideAktion; daten: unknown } | null
  /** Version, die beim letzten Laden in Supabase stand; `undefined` = gab es nicht. */
  basisVersion: number | undefined
}

export interface OverrideErgebnis {
  geschrieben: number
  /** Datensätze, die inzwischen jemand anderes geändert hat — nicht überschrieben. */
  konflikte: Array<{ bereich: string; schluessel: string; von: string | null }>
}

const zeilenSchluessel = (bereich: string, schluessel: string) => `${bereich}\u0000${schluessel}`

/**
 * Schreibt Stammdaten-Änderungen mit Konfliktprüfung.
 *
 * Unmittelbar vor dem Schreiben wird der Serverstand der betroffenen Datensätze
 * gelesen. Weicht dessen Version von der ab, die dieser Browser zuletzt gesehen hat,
 * hat ein anderer Administrator denselben Datensatz gespeichert — der wird dann NICHT
 * überschrieben, sondern als Konflikt zurückgemeldet. Nach dem nächsten Abgleich sieht
 * der Bearbeiter den fremden Stand und kann seine Änderung bewusst erneut speichern.
 */
export async function schreibeOverrides(aenderungen: OverrideAenderung[]): Promise<OverrideErgebnis> {
  const ergebnis: OverrideErgebnis = { geschrieben: 0, konflikte: [] }
  if (!supabase || aenderungen.length === 0) return ergebnis

  const server = new Map(
    (await ladeOverrides()).map((z) => [zeilenSchluessel(z.bereich, z.schluessel), z]),
  )
  const jetzt = new Date().toISOString()
  const upserts: Record<string, unknown>[] = []
  const loeschungen: OverrideAenderung[] = []

  for (const a of aenderungen) {
    const aktuell = server.get(zeilenSchluessel(a.bereich, a.schluessel))
    if (aktuell?.version !== a.basisVersion) {
      ergebnis.konflikte.push({ bereich: a.bereich, schluessel: a.schluessel, von: aktuell?.updated_by ?? null })
      continue
    }
    if (a.neu) {
      upserts.push({
        bereich: a.bereich,
        schluessel: a.schluessel,
        aktion: a.neu.aktion,
        daten: a.neu.daten ?? null,
        version: (aktuell?.version ?? 0) + 1,
        updated_at: jetzt,
        updated_by: bearbeiter,
      })
    } else if (aktuell) {
      loeschungen.push(a)
    }
  }

  // In Paketen, damit ein großer Excel-Import nicht an der Anfragegröße scheitert.
  for (let i = 0; i < upserts.length; i += 500) {
    const paket = upserts.slice(i, i + 500)
    const { error } = await supabase.from('stammdaten_overrides').upsert(paket, { onConflict: 'bereich,schluessel' })
    if (error) throw error
    ergebnis.geschrieben += paket.length
  }
  for (const a of loeschungen) {
    const { error } = await supabase
      .from('stammdaten_overrides')
      .delete()
      .eq('bereich', a.bereich)
      .eq('schluessel', a.schluessel)
    if (error) throw error
    ergebnis.geschrieben++
  }
  return ergebnis
}

// ---------------------------------------------------------------------------
// benutzer_zugaenge — nur über Funktionen
// ---------------------------------------------------------------------------

export async function ladeZugangsListe(): Promise<Array<{ personalnr: string; gesetzt_am: string }>> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('zugang_liste')
  if (error) throw error
  return (data ?? []) as Array<{ personalnr: string; gesetzt_am: string }>
}

/** 'kein' ⇒ kein eigenes Passwort hinterlegt (dann gilt das Standard-Passwort). */
export async function pruefeZugangAufServer(personalnr: string, hash: string): Promise<'kein' | 'ok' | 'falsch'> {
  if (!supabase) return 'kein'
  const { data, error } = await supabase.rpc('zugang_pruefen', { p_personalnr: personalnr, p_hash: hash })
  if (error) throw error
  return data === 'ok' || data === 'falsch' ? data : 'kein'
}

export async function setzeZugangAufServer(personalnr: string, hash: string): Promise<void> {
  if (!supabase) throw new Error('Supabase ist nicht konfiguriert.')
  const { error } = await supabase.rpc('zugang_setzen', { p_personalnr: personalnr, p_hash: hash })
  if (error) throw error
}

export async function entferneZugangAufServer(personalnr: string): Promise<void> {
  if (!supabase) throw new Error('Supabase ist nicht konfiguriert.')
  const { error } = await supabase.rpc('zugang_entfernen', { p_personalnr: personalnr })
  if (error) throw error
}
