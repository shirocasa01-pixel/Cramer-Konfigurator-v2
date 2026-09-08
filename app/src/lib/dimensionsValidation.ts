import type { Draft } from '../types'

export interface DimensionsErrors {
  heightCm?: string
  widthCm?: string
  depthCm?: string
  segments?: string
}

/** Positive Zahl (akzeptiert Komma oder Punkt als Dezimaltrennzeichen). */
function isPositiveNumber(value: string | undefined): boolean {
  if (!value || !value.trim()) return false
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) && n > 0
}

/** Maximal zulässige Anzahl Korpus-Segmente (UI-Grenze, hier zentral). */
export const MAX_SEGMENTS = 12

export function validateDimensions(dimensions: Draft['dimensions']): DimensionsErrors {
  const errors: DimensionsErrors = {}
  if (!isPositiveNumber(dimensions?.heightCm)) errors.heightCm = 'Bitte gültige Höhe (cm) angeben.'
  if (!isPositiveNumber(dimensions?.widthCm)) errors.widthCm = 'Bitte gültige Breite (cm) angeben.'
  if (!isPositiveNumber(dimensions?.depthCm)) errors.depthCm = 'Bitte gültige Tiefe (cm) angeben.'
  const segments = dimensions?.segments
  if (!segments || !Number.isInteger(segments) || segments < 1 || segments > MAX_SEGMENTS) {
    errors.segments = `Anzahl Segmente muss zwischen 1 und ${MAX_SEGMENTS} liegen.`
  }
  return errors
}

export function isDimensionsValid(dimensions: Draft['dimensions']): boolean {
  return Object.keys(validateDimensions(dimensions)).length === 0
}

// ---------------------------------------------------------------------------
// Maßgrenzen (Punkte 4.1 / 4.2 / 4.4)
// ---------------------------------------------------------------------------

/**
 * Grenzwerte der Korpus-Grunddaten.
 *
 * Dietmar zu 4.2: „Eine Warnung ist ausreichend. Sonderformate sind immer möglich.
 * Bei Schrankbreite und Schranktiefe sind Ausnahmen relativ einfach für die
 * Produktion. Bei der Höhe ist es schwerer, aber auch möglich."
 *
 * Deshalb blockiert nichts davon den Berater — jede Überschreitung erzeugt einen
 * Hinweis, der auch im AV-PDF landet. Ein hartes Verbot hätte im Kundengespräch
 * eine Sonderanfertigung verhindert, die die Produktion problemlos bauen kann.
 */
export const MASS_GRENZEN = {
  hoeheCm: { min: 50, max: 274 },
  tiefeCm: { min: 31, max: 60 },
  korpusbreiteCm: { min: 15, max: 100 },
  /** Plattenlänge laut Dietmar — darüber wird ein zweiter Korpus aufgesetzt. */
  plattenlaengeCm: 276,
} as const

/** Warnung zur Gesamthöhe, oder `undefined`, wenn sie im Standardbereich liegt. */
export function hoehenWarnung(hoeheCm: number | undefined): string | undefined {
  if (hoeheCm == null) return undefined
  const { min, max } = MASS_GRENZEN.hoeheCm
  if (hoeheCm < min) return `${hoeheCm} cm liegt unter der Standardhöhe von ${min} cm – bitte mit der AV abstimmen.`
  if (hoeheCm > max) {
    return `${hoeheCm} cm liegt über der Standardhöhe von ${max} cm. Die Platten sind ${MASS_GRENZEN.plattenlaengeCm} cm lang – ab ${max} cm Korpushöhe wird ein zweiter Korpus aufgesetzt. Bitte mit der AV abstimmen.`
  }
  return undefined
}

/** Warnung zur Korpustiefe. */
export function tiefenWarnung(tiefeCm: number | undefined): string | undefined {
  if (tiefeCm == null) return undefined
  const { min, max } = MASS_GRENZEN.tiefeCm
  if (tiefeCm < min || tiefeCm > max) {
    return `${tiefeCm} cm liegt außerhalb der Standardtiefen (${min}–${max} cm) – bitte mit der AV abstimmen.`
  }
  return undefined
}

/** Warnung zu einer Korpusbreite. */
export function breitenWarnung(breiteCm: number | undefined): string | undefined {
  if (breiteCm == null) return undefined
  const { min, max } = MASS_GRENZEN.korpusbreiteCm
  if (breiteCm < min || breiteCm > max) {
    return `${breiteCm} cm liegt außerhalb der Standardbreiten (${min}–${max} cm) – bitte mit der AV abstimmen.`
  }
  return undefined
}
