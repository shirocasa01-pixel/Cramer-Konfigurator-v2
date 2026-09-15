import type { FrontColumn, FrontElement, FrontsData, SegmentEquipmentItem } from '../types'
import {
  EQUIPMENT_ELIGIBLE_FRONT_TYPES,
  equipmentChoiceDefaults,
  getEquipmentOption,
} from '../config/equipment'
import { LINE_AUFKANTUNG_GROUPS, getFrontType, type FrontField } from '../config/frontCatalog'
import { MATERIAL_CUSTOM_ID, getMaterialGroup } from '../config/materialMatrix'
import { FRONT_OFFSET_MM, frontRaster, hoeheFuerRaster } from './raster'

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
  const element: FrontElement = {
    id: makeId('el'),
    typeId,
    label: fronts ? naechsteKennzeichnung(fronts, typeId) : '',
    widthCm: breiteCm != null ? String(breiteCm) : undefined,
    fieldValues: {},
  }
  // Überarbeitung 3: Beim Griffprofil der zweiläufigen Schiebetür ist nur noch „Edge"
  // möglich — es wird deshalb direkt vorgewählt.
  if (getFrontType(typeId)?.griffProfil) element.griffProfil = 'edge'
  return element
}

// ---------------------------------------------------------------------------
// Überarbeitung 3 – Türhöhe der Drehtür (drei exklusive Optionen)
// ---------------------------------------------------------------------------

/** Zulässige Rasterspanne für die Eingabe „Höhe (Raster)" (Vorgabe: 3 bis 21 Raster). */
export const DREHTUER_RASTER_MIN = 3
export const DREHTUER_RASTER_MAX = 21

/**
 * Fronthöhe (cm) aus einer Rasterangabe — EINBAHNSTRASSE Raster → cm.
 *
 *     1 Raster  = 12,5 cm Fronthöhe, zwischen zwei Rasterfronten liegen 3 mm Fuge
 *     n Raster  = n × 12,5 + (n − 1) × 0,3   ⇔   (n × 128 − 3) mm
 *
 * Die zweite Schreibweise ist die, die `hoeheFuerRaster` bereits rechnet
 * (`RASTER_MM` = 128, `FRONT_OFFSET_MM` = −3); beide Formeln sind identisch:
 * 3 R ⇒ 38,1 cm · 14 R ⇒ 178,9 cm · 21 R ⇒ 268,5 cm — exakt die Höhenübersicht der Vorlage.
 * Es gibt bewusst KEINE Rückrechnung cm → Raster in der Eingabemaske.
 */
export function frontHoeheAusRaster(raster: number): number {
  return hoeheFuerRaster(raster, FRONT_OFFSET_MM)
}

/** Rastereingabe parsen (Komma erlaubt); ungültig/leer ⇒ `undefined`. */
export function parseRasterEingabe(text: string | undefined): number | undefined {
  if (!text || !text.trim()) return undefined
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function hoeheCmVonElement(element: FrontElement): number | undefined {
  const n = Number((element.heightCm ?? '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * Resthöhe für „Höhe bis Korpusoberkante": das Korpusraster minus die Rasterstufen der
 * übrigen Fronten derselben Spalte.
 *
 * Vorlage: „wenn darunter z. B. 2 Schubladen à 2 Raster sind und der Schrank eine Höhe
 * von 18 Rastern hat, würde sich daraus automatisch die Türhöhe von 14 Rastern ergeben".
 *
 * `undefined`, wenn das Korpusraster unbekannt ist, eine andere Front der Spalte keine
 * verwertbare Höhe hat oder rechnerisch nichts übrig bleibt — dann bleibt die Höhe offen
 * und wird in der AV geklärt, statt einen falschen Wert zu erfinden.
 */
export function restRasterBisKorpusoberkante(
  column: FrontColumn,
  elementId: string,
  korpusRaster: number | undefined,
): number | undefined {
  if (korpusRaster == null || korpusRaster <= 0) return undefined
  let summe = 0
  for (const el of column.elements) {
    if (el.id === elementId) continue
    // Eine zweite „bis Oberkante"-Front macht die Rechnung mehrdeutig.
    if (el.hoeheModus === 'korpusoberkante') return undefined
    const cm = hoeheCmVonElement(el)
    if (cm == null) return undefined
    summe += frontRaster(cm)
  }
  const rest = korpusRaster - summe
  return rest >= 1 ? rest : undefined
}

// ---------------------------------------------------------------------------
// Überarbeitung 3 – „Line": Frontscheibe / Aufkantung
// ---------------------------------------------------------------------------

/** Materialgruppe des Frontscheiben-Feldes eines Line-Elements. */
export function frontMaterialGroupId(element: FrontElement): string | undefined {
  return element.fieldValues?.material?.material?.materialGroupId
}

/**
 * Ist ein Stil-Linien-Feld für dieses Element sichtbar? Eine Quelle für UI, Validierung,
 * Zusammenfassung und AV-PDF — sonst verlangt die Validierung Felder, die niemand sieht.
 */
export function isFrontFieldVisible(field: FrontField, element: FrontElement): boolean {
  if (!field.visibleWhen) return true
  const gruppe = frontMaterialGroupId(element)
  const getrennt = element.lineAufkantungGleich === false
  switch (field.visibleWhen) {
    case 'nichtBeiAnders':
      return gruppe != null && gruppe !== MATERIAL_CUSTOM_ID
    case 'lineGetrennt':
      return getrennt && gruppe != null && gruppe !== MATERIAL_CUSTOM_ID
    case 'lineGetrenntFurnierMattlack':
      return getrennt && (gruppe === 'furnier' || gruppe === 'mattlack')
  }
}

/**
 * Wählbare Materialgruppen für die Aufkantung.
 *
 * Vorlage: „Wenn bei Furnier ‚Nein‘ gewählt wird, muss das Dropdown für die Aufkantung
 * nicht nur Furniere, sondern alle Furniere, Gläser und Mattlacke auflisten." Bei Glas
 * und Mattlack bleibt es bei derselben Gruppe.
 */
export function aufkantungGroupIds(element: FrontElement): string[] {
  const gruppe = frontMaterialGroupId(element)
  if (gruppe === 'furnier') return LINE_AUFKANTUNG_GROUPS
  return gruppe ? [gruppe] : LINE_AUFKANTUNG_GROUPS
}

/** Trennzeichen im Optionswert des Aufkantungs-Dropdowns (`gruppe::option`). */
const AUFKANTUNG_SEP = '::'

export function encodeAufkantungValue(groupId: string, optionId: string): string {
  return `${groupId}${AUFKANTUNG_SEP}${optionId}`
}

export function decodeAufkantungValue(value: string): { groupId: string; optionId: string } | undefined {
  const [groupId, optionId] = value.split(AUFKANTUNG_SEP)
  return groupId && optionId ? { groupId, optionId } : undefined
}

/**
 * Optionen des Aufkantungs-Dropdowns. Bei mehreren Gruppen wird die Gruppe dem Label
 * vorangestellt, damit „Eiche geölt" (Furnier) und „Stone" (Glas) unterscheidbar bleiben.
 */
export function aufkantungOptions(groupIds: string[]): Array<{ value: string; label: string }> {
  const mehrere = groupIds.length > 1
  return groupIds.flatMap((groupId) => {
    const group = getMaterialGroup(groupId)
    if (!group) return []
    return group.options.map((option) => ({
      value: encodeAufkantungValue(group.id, option.id),
      label: mehrere ? `${group.label} – ${option.label}` : option.label,
    }))
  })
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

/**
 * Neues Ausstattungs-Element (Schritt 8) mit den Vorgaben aus dem Katalog:
 * Standard-Auswahlen (z. B. Kleiderstange „Chrom") und – wo eine Höhe erfasst wird –
 * eine erste Zeile im Raster-Modus. Beides kommt aus `config/equipment.ts`, damit hier
 * keine zweite Stelle entsteht, an der Vorgaben gepflegt werden müssten.
 */
export function makeEquipmentItem(optionId: string): SegmentEquipmentItem {
  const option = getEquipmentOption(optionId)
  const item: SegmentEquipmentItem = { id: makeId('eq'), optionId, qty: 1 }
  const choices = equipmentChoiceDefaults(option)
  if (Object.keys(choices).length > 0) item.choices = choices
  if (option?.heightMode && option.heightMode !== 'keine') item.hoehen = [{ modus: 'raster' }]
  // Überarbeitung 6, S. 5: Das Standardformat steht von Anfang an im Feld und bleibt
  // überschreibbar. Leert der Berater es wieder, greift derselbe Standard beim Lesen
  // (`formatFuerAnzeige`) — er muss ihn also nicht von Hand wiederherstellen.
  if (option?.formatStandard) item.formatNote = option.formatStandard
  return item
}

/**
 * ENTFERNT ABGEWÄHLTE AUSSTATTUNG AUS ALLEN SEGMENTEN.
 *
 * Überarbeitung 6, S. 1: Wird eine Option in der Vorauswahl (Schritt 6) abgewählt,
 * verschwand sie bisher nur aus der Oberfläche von Schritt 8 — das bereits erfasste
 * Teil blieb im Entwurf und damit in Kalkulation, Zusammenfassung und AV-PDF stehen.
 * Der Entwurf wird deshalb an derselben Stelle mitgeführt, an der die Vorauswahl fällt.
 *
 * Ein entferntes Teil darf auch kein Bezugsziel mehr sein, sonst zeigt die
 * Schubladenunterteilung auf eine Schublade, die es nicht mehr gibt.
 *
 * Gibt `fronts` UNVERÄNDERT zurück, wenn nichts zu entfernen ist. Die Identität ist hier
 * kein Detail: Aufrufer in `useEffect` erkennen daran, dass kein Schreibvorgang nötig ist.
 */
export function entferneAbgewaehlteAusstattung(
  fronts: FrontsData | undefined,
  erlaubteOptionIds: readonly string[],
): FrontsData | undefined {
  if (!fronts?.columns?.length) return fronts
  const erlaubt = new Set(erlaubteOptionIds)
  let geaendert = false

  const columns = fronts.columns.map((spalte) => {
    const items = spalte.equipment
    if (!items?.length) return spalte
    const bleibt = items.filter((i) => erlaubt.has(i.optionId))
    if (bleibt.length === items.length) return spalte
    geaendert = true
    const vorhandeneIds = new Set(bleibt.map((i) => i.id))
    return {
      ...spalte,
      equipment: bleibt.map((i) =>
        i.bezugId && !vorhandeneIds.has(i.bezugId) ? { ...i, bezugId: undefined } : i,
      ),
    }
  })

  return geaendert ? { ...fronts, columns } : fronts
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
    hoeheModus: src.hoeheModus,
    hoeheRaster: src.hoeheRaster,
    // Der Türanschlag wird BEWUSST nicht übernommen: bei zwei Türen nebeneinander ist
    // einer rechts und einer links angeschlagen – ein kopierter Wert wäre halb falsch.
    lineAufkantungGleich: src.lineAufkantungGleich,
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
