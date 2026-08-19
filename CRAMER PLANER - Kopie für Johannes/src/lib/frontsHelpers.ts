import type { FrontColumn, FrontElement, FrontsData, SegmentEquipmentItem } from '../types'
import { EQUIPMENT_ELIGIBLE_FRONT_TYPES } from '../config/equipment'

/** Front-Typ der zweiläufigen Schiebetür (exklusiv – Schritt 7). */
export const ZWEILAEUFIG_TYPE_ID = 'schiebetuer-zwei'

/** Erzeugt eine eindeutige ID (crypto-basiert) für Spalten/Elemente. */
export function makeId(prefix: string): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}-${hex}`
}

/** Leerer Fronten-Datensatz. */
export function emptyFronts(): FrontsData {
  return { columns: [] }
}

/**
 * Synchronisiert die Anzahl der Spalten mit den Segmenten aus Phase 4.5.
 * Vorhandene Spalten (inkl. Inhalt) bleiben erhalten; fehlende werden ergänzt,
 * überzählige (rechts) werden entfernt.
 */
export function syncColumns(fronts: FrontsData | undefined, segments: number): FrontsData {
  const base = fronts ?? emptyFronts()
  const columns = [...base.columns]
  while (columns.length < segments) columns.push({ id: makeId('col'), elements: [] })
  if (columns.length > segments) columns.length = segments
  return { ...base, columns }
}

/**
 * Kürzel je Front-Typ für die automatische Kennzeichnung (Punkt 7.4).
 * Dietmar nennt „Schubladen S1, S2, S3 …, Drehtüren D1, D2".
 */
export const KENNZEICHEN_PRAEFIX: Record<string, string> = {
  drehtuer: 'D',
  schuebe: 'S',
  schiebetuer: 'ST',
  'schiebetuer-zwei': 'ST',
  stauraumklappe: 'K',
  hochstellklappe: 'K',
  schreibklappe: 'K',
  offen: 'O',
}

/**
 * Nächste freie Kennzeichnung für einen Front-Typ.
 *
 * Punkt 7.4 — Dietmar: „Ich würde sie für das ganze Möbel durchnummerieren. Dann
 * kann man in der Skizze jede Front eindeutig zuordnen." Gezählt wird deshalb über
 * ALLE Spalten hinweg, nicht je Korpus: Korpus 2 beginnt nicht wieder bei D1.
 *
 * Vergeben wird die jeweils kleinste freie Nummer — löscht der Berater D2, wird sie
 * beim nächsten Anlegen wieder vergeben, statt auf D4 zu springen.
 */
export function naechsteKennzeichnung(fronts: FrontsData | undefined, typeId: string): string {
  const praefix = KENNZEICHEN_PRAEFIX[typeId] ?? 'F'
  // Bewusst kein Template-Literal: dort verschluckt `\d` den Backslash und das
  // Muster suchte nach dem Buchstaben „d" statt nach einer Ziffer.
  const muster = new RegExp('^' + praefix + '(\\d+)$', 'i')
  const vergeben = new Set(
    allElements(fronts)
      .map((el) => muster.exec(el.label.trim())?.[1])
      .filter((n): n is string => n != null)
      .map(Number),
  )
  let n = 1
  while (vergeben.has(n)) n++
  return `${praefix}${n}`
}

/**
 * Neues Front-Element eines bestimmten Typs.
 *
 * `fronts` und `breiteCm` sind optional, damit bestehende Aufrufer weiterlaufen:
 * mit ihnen kommt das Element bereits mit Kennzeichnung (7.4) und der aus der
 * Korpusbreite abgeleiteten Frontbreite (7.5) auf den Bildschirm.
 */
export function makeElement(typeId: string, fronts?: FrontsData, breiteCm?: number): FrontElement {
  return {
    id: makeId('el'),
    typeId,
    label: fronts ? naechsteKennzeichnung(fronts, typeId) : '',
    widthCm: breiteCm != null ? String(breiteCm) : undefined,
    fieldValues: {},
  }
}

// ---------------------------------------------------------------------------
// Schritt 7 – Regeln: zweiläufige Schiebetür (exklusiv) & Schiebetür-Anzahl
// ---------------------------------------------------------------------------

/** Alle Front-Elemente über alle Spalten (flach). */
export function allElements(fronts: FrontsData | undefined): FrontElement[] {
  return fronts?.columns.flatMap((col) => col.elements) ?? []
}

/** Ist irgendwo eine zweiläufige Schiebetür geplant? (Dann exklusiv – keine weiteren Fronten.) */
export function hasZweilaeufigeSchiebetuer(fronts: FrontsData | undefined): boolean {
  return allElements(fronts).some((el) => el.typeId === ZWEILAEUFIG_TYPE_ID)
}

/** Gibt es Front-Elemente, die KEINE zweiläufige Schiebetür sind? */
export function hasOtherFronts(fronts: FrontsData | undefined): boolean {
  return allElements(fronts).some((el) => el.typeId !== ZWEILAEUFIG_TYPE_ID)
}

/**
 * Darf der Front-Typ `typeId` aktuell hinzugefügt werden? (Exklusivitäts-Regel S. 14/17)
 * - Existiert eine zweiläufige Schiebetür ⇒ gar nichts mehr hinzufügbar.
 * - Sonst: eine zweiläufige Schiebetür nur, wenn noch keine andere Front existiert.
 */
export function canAddFrontType(fronts: FrontsData | undefined, typeId: string): boolean {
  if (hasZweilaeufigeSchiebetuer(fronts)) return false
  if (typeId === ZWEILAEUFIG_TYPE_ID) return !hasOtherFronts(fronts)
  return true
}

/**
 * Zulässige Anzahl Schiebetür-Elemente in Abhängigkeit der Korpus-Anzahl (S. 17):
 * 2 Korpi → 2, 3 Korpi → 3, 4 Korpi → 2 oder 4. Andere Anzahlen: 2/3/4 als Fallback.
 */
export function schiebetuerAnzahlOptions(segmentCount: number): Array<2 | 3 | 4> {
  if (segmentCount === 2) return [2]
  if (segmentCount === 3) return [3]
  if (segmentCount === 4) return [2, 4]
  return [2, 3, 4]
}

// ---------------------------------------------------------------------------
// Punkt 7.7 — Türbreite bestimmt die Türanzahl
// ---------------------------------------------------------------------------

/**
 * Dietmar: „Schiebetüren müssen immer eine Länge zwischen 80 und 120 cm haben.
 * Daraus ergibt sich die Anzahl der notwendigen Türen. Nur bei Decoboard und XP
 * ist eine Schiebetürlänge bis 150 cm möglich."
 */
export const SCHIEBETUER_MIN_CM = 80
export const SCHIEBETUER_MAX_CM = 120
export const SCHIEBETUER_MAX_DECOBOARD_XP_CM = 150

/** Materialgruppen mit dem erweiterten Maximum. */
const BREITE_BIS_150 = new Set(['decoboard', 'xtreme-plus'])

export function schiebetuerMaxBreiteCm(materialGroupId: string | undefined): number {
  return materialGroupId && BREITE_BIS_150.has(materialGroupId)
    ? SCHIEBETUER_MAX_DECOBOARD_XP_CM
    : SCHIEBETUER_MAX_CM
}

export interface SchiebetuerAnzahlPruefung {
  anzahl: number
  /** Rechnerische Türbreite bei dieser Anzahl (cm, eine Nachkommastelle). */
  tuerbreiteCm: number
  /** Liegt die Türbreite im zulässigen Bereich? */
  zulaessig: boolean
}

/**
 * Prüft die möglichen Türanzahlen gegen die Breitenregel.
 *
 * Gerechnet wird mit dem NENNANTEIL (Außenbreite ÷ Anzahl). Die tatsächliche
 * Türbreite liegt wegen der Überlappung der beiden Laufebenen darüber; um wie viel,
 * ist nicht dokumentiert — deshalb wird hier bewusst nichts hinzugerechnet, sondern
 * nur der Anteil ausgewiesen. Der Wert ist eine Orientierung, keine Fertigungsangabe.
 */
export function pruefeSchiebetuerAnzahl(
  aussenbreiteCm: number | undefined,
  kandidaten: readonly number[],
  materialGroupId?: string,
): SchiebetuerAnzahlPruefung[] {
  if (aussenbreiteCm == null || aussenbreiteCm <= 0) {
    return kandidaten.map((anzahl) => ({ anzahl, tuerbreiteCm: 0, zulaessig: true }))
  }
  const max = schiebetuerMaxBreiteCm(materialGroupId)
  return kandidaten.map((anzahl) => {
    const tuerbreiteCm = Math.round((aussenbreiteCm / anzahl) * 10) / 10
    return {
      anzahl,
      tuerbreiteCm,
      zulaessig: tuerbreiteCm >= SCHIEBETUER_MIN_CM && tuerbreiteCm <= max,
    }
  })
}

// ---------------------------------------------------------------------------
// Schritt 8 – Ausstattung hinter Fronten (Eligibilität je Segment)
// ---------------------------------------------------------------------------

/** Front-Typen eines Segments, hinter denen Ausstattung möglich ist (Drehtür/2läufig/Offen). */
export function eligibleEquipmentFrontTypes(column: FrontColumn): string[] {
  const present = new Set(column.elements.map((el) => el.typeId))
  return EQUIPMENT_ELIGIBLE_FRONT_TYPES.filter((t) => present.has(t))
}

/** Hat das Segment mindestens einen Front-Typ, hinter dem Ausstattung möglich ist? */
export function isColumnEquipmentEligible(column: FrontColumn): boolean {
  return eligibleEquipmentFrontTypes(column).length > 0
}

/** Neues, leeres Ausstattungs-Element (Schritt 8). */
export function makeEquipmentItem(optionId: string): SegmentEquipmentItem {
  return { id: makeId('eq'), optionId, qty: 1 }
}

/**
 * Kopierbare Konfigurationswerte eines Front-Elements (ohne id/label/typeId) für die
 * „Werte übernehmen"-Funktion (Phase A). `fieldValues` wird tief kopiert, damit Quelle
 * und Ziel danach unabhängig bearbeitet werden können.
 */
export function copyableFrontValues(src: FrontElement): Partial<FrontElement> {
  return {
    widthCm: src.widthCm,
    heightCm: src.heightCm,
    styleLineId: src.styleLineId,
    fieldValues: src.fieldValues
      ? (JSON.parse(JSON.stringify(src.fieldValues)) as FrontElement['fieldValues'])
      : {},
    pto: src.pto,
    griff: src.griff,
    griffId: src.griffId,
    griffFarbe: src.griffFarbe,
    laufschienenfarbe: src.laufschienenfarbe,
    griffProfil: src.griffProfil,
    griffProfilFarbe: src.griffProfilFarbe,
  }
}
