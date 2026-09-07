import type { FrontField } from '../config/frontCatalog'
import { getHandle } from '../config/handles'
import type { AbschlussOben, FrontElement, FrontFieldValue } from '../types'
import { PRICE_GROUP_LABEL, describeMaterialSelection } from './materialFormat'

/** Anzeige-Labels für „Abschluss unten“ (Sockel-Typen). */
export const ABSCHLUSS_UNTEN_LABEL: Record<string, string> = {
  SO: 'SO – Sockel',
  SSP: 'SSP – Schwebende Sockelplatte',
  KS: 'KS – Kommodensockel',
  UK: 'UK – Umlaufkorpus',
  KG: 'KG / UK mit Fuß',
}

/** Menschlich lesbare Beschreibung des „Abschluss oben“. */
export function describeOben(oben: AbschlussOben | undefined): string {
  if (!oben) return '—'
  if (oben.mode === 'wieKorpus') return 'wie Korpus'
  if (oben.variant === 'DP') return `anders · DP ${oben.dpStaerke ?? '(Stärke offen)'}`
  if (oben.variant === 'Glas') return 'anders · Glas (fix 4 mm)'
  if (oben.variant === 'UK') return 'anders · UK (fix 2 cm)'
  return 'anders'
}

/** Beschreibt den Wert eines Stil-Linien-Feldes (Material + PG + Notiz oder Freitext). */
export function describeFrontField(field: FrontField, value: FrontFieldValue | undefined): string {
  if (!value) return ''
  if (field.kind === 'freetext') return value.text?.trim() ? `${field.label}: ${value.text.trim()}` : ''
  const parts: string[] = []
  if (value.material) {
    const material = describeMaterialSelection(value.material)
    if (material && material !== '—') {
      const pg = value.material.priceGroup ? ` [${PRICE_GROUP_LABEL[value.material.priceGroup]}]` : ''
      parts.push(material + pg)
    }
  }
  if (value.note?.trim()) parts.push(value.note.trim())
  return parts.length ? `${field.label}: ${parts.join(' · ')}` : ''
}

/**
 * Griff-/PTO-/Laufschienen-/Profil-Konfiguration eines Front-Elements als Klartext
 * (Zusammenfassung & AV-PDF). Leerer String, wenn nichts konfiguriert ist. (Phase A.)
 */
export function describeHandleConfig(element: FrontElement): string {
  const parts: string[] = []
  if (element.pto) parts.push('PTO (Push-to-Open)')
  if (element.griff) {
    const handle = getHandle(element.griffId)
    const details = element.griffFarbe?.trim()
    parts.push(`Griff${handle ? ` ${handle.label}` : ''}${details ? ` · Griffdetails: ${details}` : ''}`)
  }
  if (element.laufschienenfarbe?.trim()) parts.push(`Laufschiene: ${element.laufschienenfarbe.trim()}`)
  if (element.griffProfil) parts.push(`Griffprofil: ${element.griffProfil === 'edge' ? 'Edge' : 'Curve'}`)
  return parts.join(' · ')
}

/** Anzeigetext der drei Türhöhen-Optionen (Überarbeitung 3). */
const HOEHE_MODUS_LABEL: Record<NonNullable<FrontElement['hoeheModus']>, string> = {
  korpusoberkante: 'Höhe bis Korpusoberkante',
  raster: 'Höhe in Rastern',
  cm: 'Höhe in cm',
}

/**
 * Türanschlag und Art der Höhenangabe als Klartext (Überarbeitung 3). Beides sind
 * Fertigungsangaben, die im AV-PDF und in der Zusammenfassung stehen müssen — der
 * blanke Zentimeterwert verrät nicht, ob die Tür bis zur Korpusoberkante läuft.
 */
export function describeFrontExtras(element: FrontElement): string {
  const parts: string[] = []
  if (element.tuerAnschlag) parts.push(`Türanschlag: ${element.tuerAnschlag}`)
  if (element.hoeheModus) {
    const raster = element.hoeheModus === 'raster' && element.hoeheRaster?.trim()
    parts.push(HOEHE_MODUS_LABEL[element.hoeheModus] + (raster ? ` (${element.hoeheRaster} Raster)` : ''))
  }
  if (element.lineAufkantungGleich === false) parts.push('Frontscheibe und Aufkantung unterschiedlich')
  else if (element.lineAufkantungGleich === true) parts.push('Frontscheibe und Aufkantung gleich')
  return parts.join(' · ')
}
