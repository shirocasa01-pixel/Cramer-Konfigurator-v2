/**
 * SCHEMA-STORE — Auslieferungsstand, Entwurf und veröffentlichter Stand.
 *
 * Aufbau wie beim Stammdaten-Store: Die Basis liegt im Repo
 * (`config/konfigurator-schema.json`), die Änderungen des Administrators liegen als
 * Overlay daneben. Zwei Stufen, damit ein halbfertiger Umbau niemandem die Maske zerlegt:
 *
 *   ENTWURF          was der Administrator gerade bearbeitet — nur er sieht es
 *   VERÖFFENTLICHT   was Berater, Zusammenfassung und PDF verwenden
 *
 * Prototyp-Grenze, dieselbe wie bei Zugängen und Stammdaten: Das Overlay liegt im
 * `localStorage` und damit im Browser des Administrators. Mit einem Backend zieht es an
 * den Server; die Schnittstelle unten bleibt dieselbe.
 */

import basisSchema from '../config/konfigurator-schema.json'
import type { KonfiguratorSchema, SchemaAbschnitt, SchemaFeld } from '../types/schema.ts'

const ENTWURF_KEY = 'cramer-planer.schema.entwurf.v1'
const VEROEFFENTLICHT_KEY = 'cramer-planer.schema.veroeffentlicht.v1'

/** Der Auslieferungsstand aus dem Repo — immer die Rückfallebene. */
export const AUSLIEFERUNG = basisSchema as KonfiguratorSchema

function klone(schema: KonfiguratorSchema): KonfiguratorSchema {
  return JSON.parse(JSON.stringify(schema)) as KonfiguratorSchema
}

function lade(schluessel: string): KonfiguratorSchema | null {
  try {
    const roh = localStorage.getItem(schluessel)
    if (!roh) return null
    const geparst = JSON.parse(roh) as KonfiguratorSchema
    return Array.isArray(geparst?.abschnitte) ? geparst : null
  } catch {
    return null
  }
}

function sichere(schluessel: string, schema: KonfiguratorSchema | null) {
  try {
    if (schema) localStorage.setItem(schluessel, JSON.stringify(schema))
    else localStorage.removeItem(schluessel)
  } catch {
    /* best-effort im Prototyp */
  }
}

let veroeffentlicht: KonfiguratorSchema = lade(VEROEFFENTLICHT_KEY) ?? klone(AUSLIEFERUNG)
let entwurf: KonfiguratorSchema | null = lade(ENTWURF_KEY)

const hoerer = new Set<() => void>()

function melde() {
  hoerer.forEach((h) => h())
}

export function subscribeSchema(h: () => void): () => void {
  hoerer.add(h)
  return () => hoerer.delete(h)
}

/** Der Stand, den Berater, Zusammenfassung und PDF verwenden. */
export function getSchema(): KonfiguratorSchema {
  return veroeffentlicht
}

/** Der Bearbeitungsstand des Administrators — oder der veröffentlichte, wenn keiner offen ist. */
export function getEntwurfSchema(): KonfiguratorSchema {
  return entwurf ?? veroeffentlicht
}

export function hatOffenenEntwurf(): boolean {
  return entwurf != null
}

/** Übernimmt eine Änderung in den Entwurf, ohne sie zu veröffentlichen. */
export function setzeEntwurf(naechster: KonfiguratorSchema): void {
  entwurf = klone(naechster)
  sichere(ENTWURF_KEY, entwurf)
  melde()
}

/** Verwirft den Entwurf und arbeitet wieder auf dem veröffentlichten Stand. */
export function verwerfeEntwurf(): void {
  entwurf = null
  sichere(ENTWURF_KEY, null)
  melde()
}

/** Macht den Entwurf für alle gültig. */
export function veroeffentliche(): void {
  if (!entwurf) return
  veroeffentlicht = { ...klone(entwurf), version: veroeffentlicht.version + 1 }
  entwurf = null
  sichere(VEROEFFENTLICHT_KEY, veroeffentlicht)
  sichere(ENTWURF_KEY, null)
  melde()
}

/** Setzt alles auf den Auslieferungsstand aus dem Repo zurück. */
export function setzeAufAuslieferungZurueck(): void {
  veroeffentlicht = klone(AUSLIEFERUNG)
  entwurf = null
  sichere(VEROEFFENTLICHT_KEY, null)
  sichere(ENTWURF_KEY, null)
  melde()
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

/** Ein Abschnitt aus dem angegebenen Stand; ohne Angabe aus dem veröffentlichten. */
export function getAbschnitt(id: string, schema: KonfiguratorSchema = veroeffentlicht): SchemaAbschnitt | undefined {
  return schema.abschnitte.find((a) => a.id === id)
}

/**
 * Die Felder eines Abschnitts für eine Oberfläche, sortiert und gefiltert.
 *
 * Gefiltert wird nach drei Dingen: Feld aktiv, für diese Oberfläche freigegeben und —
 * falls eine Serienregel hinterlegt ist — für die laufende Serie zugelassen.
 */
export function felderFuer(
  abschnittId: string,
  flaeche: 'maske' | 'zusammenfassung' | 'pdf',
  optionen: { schema?: KonfiguratorSchema; serieId?: string } = {},
): SchemaFeld[] {
  const schema = optionen.schema ?? veroeffentlicht
  const abschnitt = getAbschnitt(abschnittId, schema)
  if (!abschnitt || !abschnitt.aktiv) return []
  return abschnitt.felder
    .filter((f) => f.aktiv && f.zeigeIn[flaeche])
    .filter((f) => serieErlaubt(f, optionen.serieId))
    .sort((a, b) => a.sortierung - b.sortierung)
}

/**
 * Überschrift und Einleitung eines Schritts — mit Rückfallebene.
 *
 * Fehlt der Abschnitt im gespeicherten Stand (älteres Overlay, neuer Schritt im Code),
 * gilt der übergebene Standard. Eine Seite verliert dadurch nie ihre Überschrift.
 */
export function abschnittTexte(
  id: string,
  standard: { titel: string; beschreibung?: string },
  schema: KonfiguratorSchema = veroeffentlicht,
): { titel: string; beschreibung?: string } {
  const abschnitt = getAbschnitt(id, schema)
  if (!abschnitt || !abschnitt.aktiv) return standard
  return {
    titel: abschnitt.titel.trim() || standard.titel,
    beschreibung: abschnitt.beschreibung?.trim() ? abschnitt.beschreibung : standard.beschreibung,
  }
}

/** Prüft die Sichtbarkeitsregeln eines Feldes gegen die laufende Serie. */
export function serieErlaubt(feld: SchemaFeld, serieId: string | undefined): boolean {
  const regel = feld.regeln?.find((r) => r.art === 'nurSerien')
  if (!regel || regel.serien.length === 0) return true
  return serieId != null && regel.serien.includes(serieId)
}

// ---------------------------------------------------------------------------
// Schreiben (Editor)
// ---------------------------------------------------------------------------

/** Ändert Überschrift und Einleitung eines Abschnitts im Entwurf. */
export function aktualisiereAbschnitt(
  abschnittId: string,
  patch: { titel?: string; beschreibung?: string; aktiv?: boolean },
): void {
  const naechster = klone(getEntwurfSchema())
  const abschnitt = naechster.abschnitte.find((a) => a.id === abschnittId)
  if (!abschnitt) return
  Object.assign(abschnitt, patch)
  setzeEntwurf(naechster)
}

/**
 * Ersetzt ein Feld im Entwurf, an seiner bisherigen Stelle.
 *
 * `alteId` erlaubt, die Kennung mitzuändern — gebraucht wird das direkt nach dem Anlegen,
 * wenn aus „Mehrzeiliges Textfeld" die „Lieferadresse" wird und die Kennung mitwandern
 * soll. Danach bleibt sie stehen: An ihr hängen die bereits erfassten Werte.
 */
export function aktualisiereFeld(abschnittId: string, feld: SchemaFeld, alteId = feld.id): void {
  const naechster = klone(getEntwurfSchema())
  const abschnitt = naechster.abschnitte.find((a) => a.id === abschnittId)
  if (!abschnitt) return
  const index = abschnitt.felder.findIndex((f) => f.id === alteId)
  if (index < 0) return
  const kollision = feld.id !== alteId && abschnitt.felder.some((f) => f.id === feld.id)
  abschnitt.felder[index] = kollision ? { ...feld, id: alteId } : feld
  setzeEntwurf(naechster)
}

/**
 * Hängt ein neues Feld ans Ende eines Abschnitts und liefert es mit der vergebenen
 * Sortierung zurück — der Aufrufer öffnet damit die Einstellungsmaske. Ohne den
 * Rückgabewert arbeitete er auf seiner eigenen Fassung weiter und würde die Sortierung
 * beim Speichern wieder überschreiben.
 */
export function ergaenzeFeld(abschnittId: string, feld: Omit<SchemaFeld, 'sortierung'>): SchemaFeld | undefined {
  const naechster = klone(getEntwurfSchema())
  const abschnitt = naechster.abschnitte.find((a) => a.id === abschnittId)
  if (!abschnitt) return undefined
  const hoechste = abschnitt.felder.reduce((max, f) => Math.max(max, f.sortierung), 0)
  const neu: SchemaFeld = { ...feld, sortierung: hoechste + 10 }
  abschnitt.felder.push(neu)
  setzeEntwurf(naechster)
  return neu
}

/**
 * Entfernt ein Feld. Systemfelder werden nur deaktiviert — an ihnen hängt typisierter
 * Code (Kalkulation, Dashboard-Suche, Supabase-Spalten), der sie weiterhin liest.
 */
export function entferneFeld(abschnittId: string, feldId: string): void {
  const naechster = klone(getEntwurfSchema())
  const abschnitt = naechster.abschnitte.find((a) => a.id === abschnittId)
  if (!abschnitt) return
  const feld = abschnitt.felder.find((f) => f.id === feldId)
  if (!feld) return
  if (feld.systemfeld) feld.aktiv = false
  else abschnitt.felder = abschnitt.felder.filter((f) => f.id !== feldId)
  setzeEntwurf(naechster)
}

/** Verschiebt ein Feld um eine Position nach oben oder unten. */
export function verschiebeFeld(abschnittId: string, feldId: string, richtung: -1 | 1): void {
  const naechster = klone(getEntwurfSchema())
  const abschnitt = naechster.abschnitte.find((a) => a.id === abschnittId)
  if (!abschnitt) return
  const sortiert = [...abschnitt.felder].sort((a, b) => a.sortierung - b.sortierung)
  const index = sortiert.findIndex((f) => f.id === feldId)
  const ziel = index + richtung
  if (index < 0 || ziel < 0 || ziel >= sortiert.length) return
  const [feld] = sortiert.splice(index, 1)
  sortiert.splice(ziel, 0, feld)
  sortiert.forEach((f, i) => {
    f.sortierung = (i + 1) * 10
  })
  abschnitt.felder = sortiert
  setzeEntwurf(naechster)
}
