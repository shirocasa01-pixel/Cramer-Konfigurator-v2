import type { Draft, FrontElement, FrontsData, KorpusGrunddaten } from '../types/index.ts'
import { ABSCHLUSSSET_SCHIEBETUER_MM } from './frontbreiten.ts'
import { RASTER_HEIGHT_CM, resolveHeightCm, resolveKorpusBreiteCm } from './korpusMass.ts'
import {
  SCHIEBETUER_MIN_CM,
  ZWEILAEUFIG_TYPE_ID,
  allElements,
  frontMaterialGroupId,
  hasZweilaeufigeSchiebetuer,
  schiebetuerMaxBreiteCm,
} from './frontsHelpers.ts'

/**
 * ZWEILÄUFIGE SCHIEBETÜR — Korpus-Aufteilung, Höhe und Abschlusssets (Überarbeitung 10).
 *
 * Cramer, „Überarbeitung 10 – Cramer Planer.pdf":
 *
 *   S. 1  „Mögliche Korpushöhen bei Schiebetüren (zweiläufig): 18 bis 21 Raster (Nicht höher
 *         nicht niedriger; Sonderhöhen zwischen 18 bis 21 Raster möglich)."
 *         „150er Schiebetüren (zweiläufig) nur in Decoboard oder Xtreme Plus."
 *         „Abschlußsets links und rechts bei Schiebetüren (zweiläufig) sind immer notwendig.
 *         Stärke 2 cm statt 1 cm wie bei den übrigen Kleiderschränken." Sie liegen hinter
 *         der Tür: „Schiebetür deckt Abschlussset + Innenkorpus von vorne ab."
 *   S. 2–4 „Die Schrankeinteilung muss symmetrisch sein … Ein Korpus ohne Mittelseite darf
 *         maximal 100 breit sein." Je Schiebetür ein TÜRFELD aus einem Korpus (Tür 80er–100er)
 *         oder aus zwei Korpi, die zusammen so breit sind wie die übrigen Felder (Tür
 *         80er–150er). „Sollen die Schiebetüren zwischen 100 und 150 sein, müssen immer 2
 *         Korpi geplant werden."
 *
 * Daraus folgt die Regel dieses Moduls: Die Korpi werden von links nach rechts in genau
 * `anzahl` Türfelder gleicher Breite zerlegt; jedes Feld hat einen oder zwei Korpi. Die
 * Breite eines Feldes ist die Summe seiner Korpus-NENNbreiten — derselbe Schlüssel, mit dem
 * die Preisliste die Schiebetür führt (80er / 100er / 120er / 150er). Ein Schrank mit
 * `anzahl` Schiebetüren bekommt `anzahl` Türen dieser Breite.
 */

/** Korpi je Türfeld: einer oder zwei (eine zusätzliche Mittelseite, PDF S. 2–4). */
export const MAX_KORPI_JE_TUERFELD = 2

/** „Ein Korpus ohne Mittelseite darf maximal 100 breit sein." */
export const MAX_TUERFELD_EIN_KORPUS_CM = 100

/** Stärke eines Abschlusssets bei zweiläufigen Schiebetüren (übrige Schränke: 10 mm). */
export { ABSCHLUSSSET_SCHIEBETUER_MM }

/** Mögliche Türanzahlen über den ganzen Schrank. */
export const SCHIEBETUER_ANZAHLEN = [2, 3, 4] as const
export type SchiebetuerAnzahl = (typeof SCHIEBETUER_ANZAHLEN)[number]

/** Toleranz beim Vergleich der Feldbreiten (Sondermaße mit einer Nachkommastelle). */
const TOLERANZ_CM = 0.05

export interface Tuerfeld {
  /** Indizes der Korpi (0-basiert, von links) in diesem Feld. */
  korpusIndizes: number[]
  /** Summe der Korpus-Nennbreiten (cm) = Breite der Schiebetür laut Preisliste. */
  breiteCm: number
}

export interface SchiebetuerAufteilung {
  anzahl: SchiebetuerAnzahl
  /** Leer, wenn sich die Korpi nicht in `anzahl` gleiche Felder zerlegen lassen. */
  felder: Tuerfeld[]
  /** Breite je Schiebetür (cm); 0, wenn keine Zerlegung existiert. */
  tuerbreiteCm: number
  /** Zerlegung vorhanden und Türbreite im zulässigen Bereich. */
  zulaessig: boolean
  /** Klartext, warum nicht — leer bei `zulaessig`. */
  gruende: string[]
}

function runde1(n: number): number {
  return Math.round(n * 10) / 10
}

function cmText(n: number): string {
  return String(runde1(n)).replace('.', ',')
}

/**
 * Zerlegt die Korpi in `anzahl` Türfelder gleicher Breite — oder `null`.
 *
 * Gierig von links: Ein Feld schließt, sobald seine Korpi die Zielbreite erreichen. Weil alle
 * Breiten positiv sind, ist diese Zerlegung die einzige mögliche.
 */
export function zerlegeInTuerfelder(breitenCm: readonly number[], anzahl: number): Tuerfeld[] | null {
  if (breitenCm.length === 0 || anzahl <= 0) return null
  const ziel = breitenCm.reduce((s, b) => s + b, 0) / anzahl
  const felder: Tuerfeld[] = []
  let aktuell: number[] = []
  let summe = 0
  for (const [i, b] of breitenCm.entries()) {
    aktuell.push(i)
    summe += b
    if (Math.abs(summe - ziel) <= TOLERANZ_CM) {
      felder.push({ korpusIndizes: aktuell, breiteCm: runde1(summe) })
      aktuell = []
      summe = 0
    } else if (summe > ziel + TOLERANZ_CM) {
      return null
    }
  }
  return aktuell.length === 0 && felder.length === anzahl ? felder : null
}

/** Korpus-Nennbreiten (cm); `null`, solange ein Korpus keine gültige Breite hat. */
export function korpusBreitenCm(g: KorpusGrunddaten | undefined): number[] | null {
  if (!g || g.korpusse.length === 0) return null
  const breiten = g.korpusse.map((k) => resolveKorpusBreiteCm(k))
  return breiten.every((b): b is number => b != null) ? breiten : null
}

/**
 * Alle Türanzahlen (2 / 3 / 4) mit ihrer Aufteilung und dem Urteil.
 *
 * @param materialGroupId Materialgruppe der Schiebetür — 150er nur in Decoboard / Xtreme Plus.
 */
export function schiebetuerAufteilungen(
  breitenCm: readonly number[] | null,
  materialGroupId?: string,
): SchiebetuerAufteilung[] {
  const max = schiebetuerMaxBreiteCm(materialGroupId)
  return SCHIEBETUER_ANZAHLEN.map((anzahl) => {
    if (!breitenCm || breitenCm.length === 0) {
      return { anzahl, felder: [], tuerbreiteCm: 0, zulaessig: false, gruende: ['Korpusbreiten fehlen.'] }
    }
    const felder = zerlegeInTuerfelder(breitenCm, anzahl)
    if (!felder) {
      return {
        anzahl,
        felder: [],
        tuerbreiteCm: 0,
        zulaessig: false,
        gruende: [
          `Die Korpi lassen sich nicht in ${anzahl} gleich breite Türfelder teilen (je Feld ein Korpus oder zwei Korpi mit derselben Gesamtbreite).`,
        ],
      }
    }
    const gruende: string[] = []
    const tuerbreiteCm = felder[0].breiteCm
    if (felder.some((f) => f.korpusIndizes.length > MAX_KORPI_JE_TUERFELD)) {
      gruende.push(`Je Schiebetür höchstens ${MAX_KORPI_JE_TUERFELD} Korpi.`)
    }
    if (tuerbreiteCm < SCHIEBETUER_MIN_CM) {
      gruende.push(`${anzahl} Türen wären je ${cmText(tuerbreiteCm)} cm breit — mindestens ${SCHIEBETUER_MIN_CM} cm.`)
    } else if (tuerbreiteCm > max) {
      gruende.push(
        max < 150 && tuerbreiteCm <= 150
          ? `${anzahl} Türen wären je ${cmText(tuerbreiteCm)} cm breit — über ${max} cm nur in Decoboard oder Xtreme Plus.`
          : `${anzahl} Türen wären je ${cmText(tuerbreiteCm)} cm breit — höchstens ${max} cm.`,
      )
    }
    if (felder.some((f) => f.korpusIndizes.length === 1 && f.breiteCm > MAX_TUERFELD_EIN_KORPUS_CM + TOLERANZ_CM)) {
      gruende.push(
        `Ein Korpus ohne Mittelseite darf höchstens ${MAX_TUERFELD_EIN_KORPUS_CM} cm breit sein — für breitere Türen je Tür zwei Korpi planen.`,
      )
    }
    return { anzahl, felder, tuerbreiteCm, zulaessig: gruende.length === 0, gruende }
  })
}

/** Die zweiläufige Schiebetür eines Entwurfs (sie ist exklusiv, es gibt höchstens eine). */
export function zweilaeufigeSchiebetuer(fronts: FrontsData | undefined): FrontElement | undefined {
  return allElements(fronts).find((el) => el.typeId === ZWEILAEUFIG_TYPE_ID)
}

/** Aufteilungen eines Entwurfs — mit der Materialgruppe seiner Schiebetür. */
export function aufteilungenFuerEntwurf(draft: Pick<Draft, 'korpusGrunddaten' | 'fronts'>): SchiebetuerAufteilung[] {
  const tuer = zweilaeufigeSchiebetuer(draft.fronts)
  return schiebetuerAufteilungen(korpusBreitenCm(draft.korpusGrunddaten), tuer ? frontMaterialGroupId(tuer) : undefined)
}

/** Die Aufteilung zur gewählten Türanzahl — `undefined` ohne Wahl. */
export function gewaehlteAufteilung(draft: Pick<Draft, 'korpusGrunddaten' | 'fronts'>): SchiebetuerAufteilung | undefined {
  const anzahl = draft.fronts?.schiebetuerAnzahl
  return anzahl ? aufteilungenFuerEntwurf(draft).find((a) => a.anzahl === anzahl) : undefined
}

/** Vorbelegung der Türanzahl: die erste zulässige, sonst die erste zerlegbare, sonst 2. */
export function vorgeschlageneAnzahl(aufteilungen: readonly SchiebetuerAufteilung[]): SchiebetuerAnzahl {
  return (
    aufteilungen.find((a) => a.zulaessig)?.anzahl ??
    aufteilungen.find((a) => a.felder.length > 0)?.anzahl ??
    2
  )
}

// ---------------------------------------------------------------------------
// Korpushöhe
// ---------------------------------------------------------------------------

/** Kleinste und größte Korpushöhe (cm) für zweiläufige Schiebetüren: 18 R bis 21 R. */
export const SCHIEBETUER_HOEHE_MIN_CM = RASTER_HEIGHT_CM['18R']
export const SCHIEBETUER_HOEHE_MAX_CM = RASTER_HEIGHT_CM['21R']

/**
 * Passt die Korpushöhe zur zweiläufigen Schiebetür? 18 R und 21 R immer, Sonderhöhen nur
 * dazwischen. `undefined` ⇒ Höhe noch nicht erfasst (dann wird nicht gesperrt).
 */
export function schiebetuerHoeheProblem(g: KorpusGrunddaten | undefined): string | undefined {
  if (!g || g.heightMode === '18R' || g.heightMode === '21R') return undefined
  const hoehe = resolveHeightCm(g)
  if (hoehe == null) return undefined
  if (hoehe >= SCHIEBETUER_HOEHE_MIN_CM && hoehe <= SCHIEBETUER_HOEHE_MAX_CM) return undefined
  return `Zweiläufige Schiebetüren nur bei Korpushöhen von 18 bis 21 Raster (ca. ${SCHIEBETUER_HOEHE_MIN_CM}–${SCHIEBETUER_HOEHE_MAX_CM} cm) — geplant sind ${cmText(hoehe)} cm.`
}

// ---------------------------------------------------------------------------
// Prüfung für Fronten-Schritt, Zusammenfassung und Kalkulation
// ---------------------------------------------------------------------------

/**
 * Offene Punkte einer geplanten zweiläufigen Schiebetür. Leer, wenn keine geplant ist oder
 * alles passt. Ein Befund macht den Fronten-Schritt unvollständig und die Kalkulation
 * unverbindlich — dieselbe Liste an beiden Stellen.
 */
export function schiebetuerBefunde(draft: Pick<Draft, 'korpusGrunddaten' | 'fronts'>): string[] {
  if (!hasZweilaeufigeSchiebetuer(draft.fronts)) return []
  const g = draft.korpusGrunddaten
  const befunde: string[] = []
  const hoehe = schiebetuerHoeheProblem(g)
  if (hoehe) befunde.push(`${hoehe} Bitte im Schritt „Maße" anpassen.`)
  if (g && g.abschlussSet?.position !== 'beide') {
    befunde.push(
      'Bei zweiläufigen Schiebetüren sind Abschlusssets links und rechts immer notwendig — im Schritt „Maße" „links & rechts" wählen.',
    )
  }
  const anzahl = draft.fronts?.schiebetuerAnzahl
  if (anzahl && g) {
    const aufteilung = gewaehlteAufteilung(draft)
    if (aufteilung && !aufteilung.zulaessig) befunde.push(...aufteilung.gruende)
  }
  return befunde
}

/**
 * Zeile „Anzahl Schiebetüren" für Zusammenfassung und AV-PDF (identisch):
 * „2 Stück à 100er (ganzer Schrank) · Tür 1: Korpus 1 · Tür 2: Korpus 2".
 */
export function schiebetuerAnzahlText(draft: Pick<Draft, 'korpusGrunddaten' | 'fronts'>): string | undefined {
  const anzahl = draft.fronts?.schiebetuerAnzahl
  if (!anzahl) return undefined
  const aufteilung = gewaehlteAufteilung(draft)
  if (!aufteilung || aufteilung.felder.length === 0) return `${anzahl} Stück (ganzer Schrank)`
  return `${anzahl} Stück à ${cmText(aufteilung.tuerbreiteCm)}er (ganzer Schrank) · ${tuerfelderText(aufteilung.felder)}`
}

/** Kurzbeschreibung der Türfelder („Tür 1: Korpus 1 · Tür 2: Korpus 2 + 3"). */
export function tuerfelderText(felder: readonly Tuerfeld[]): string {
  return felder
    .map((f, i) => `Tür ${i + 1}: Korpus ${f.korpusIndizes.map((k) => k + 1).join(' + ')}`)
    .join(' · ')
}
