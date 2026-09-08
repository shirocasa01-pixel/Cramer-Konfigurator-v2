import type { EquipmentHoehe, FrontColumn, SegmentEquipmentItem } from '../types'
import {
  equipmentCategories,
  getEquipmentOption,
  type EquipmentDetailField,
  type EquipmentOption,
} from '../config/equipment'

/** Kurzlabel eines Detailfeldes (für generisches Rendering & Recap). */
export const EQUIPMENT_FIELD_LABEL: Record<EquipmentDetailField, string> = {
  qty: 'Anzahl',
  position: 'Position',
  format: 'Format',
  lfm: 'Laufmeter (lfm)',
  rauchglas: 'Deckplatte Rauchglas',
  note: 'Notiz',
}

/** Eine Einbauhöhe als Klartext — „7 Raster", „ca. 118 cm" oder „am Korpusboden". */
export function beschreibeHoehe(hoehe: EquipmentHoehe): string {
  if (hoehe.modus === 'boden') return 'am Korpusboden'
  if (hoehe.modus === 'cm') return hoehe.cm?.trim() ? `ca. ${hoehe.cm.trim()} cm` : 'Sonderhöhe offen'
  return hoehe.raster != null ? `${hoehe.raster} Raster` : 'Rasterhöhe offen'
}

/** Alle Einbauhöhen eines Teils — bei Böden je Stück eine, sonst genau eine. */
function beschreibeHoehen(item: SegmentEquipmentItem): string | undefined {
  const liste = (item.hoehen ?? []).filter(Boolean)
  if (liste.length === 0) return undefined
  if (liste.length === 1) return beschreibeHoehe(liste[0])
  return liste.map((h, i) => `${i + 1}. ${beschreibeHoehe(h)}`).join(', ')
}

/** Position aus den Kästchen („links & rechts" / „links" / „rechts"). */
function beschreibeSeiten(item: SegmentEquipmentItem): string | undefined {
  const { links, rechts } = item.seiten ?? {}
  if (links && rechts) return 'links & rechts'
  if (links) return 'links'
  if (rechts) return 'rechts'
  return undefined
}

/** Anzeige-Text der Variante (Katalog-Label, sonst Rohwert). */
export function equipmentVariantLabel(option: EquipmentOption | undefined, value: string | undefined): string | undefined {
  if (!value) return undefined
  return option?.variants?.find((v) => v.value === value)?.label ?? value
}

/**
 * Menschlich lesbare Beschreibung eines konfigurierten Ausstattungs-Elements
 * (Zusammenfassung & AV-PDF). Beispiel:
 *   „Container · 6 Raster · 2× · ca. auf 120 cm · Deckplatte Rauchglas".
 */
export function describeEquipmentItem(item: SegmentEquipmentItem, alle: SegmentEquipmentItem[] = []): string {
  const option = getEquipmentOption(item.optionId)
  const parts: string[] = [option?.label ?? item.optionId]
  const variant = equipmentVariantLabel(option, item.variant)
  if (variant) parts.push(variant)
  if (item.qty != null && item.qty > 1) parts.push(`${item.qty}×`)

  const hoehen = beschreibeHoehen(item)
  if (hoehen) parts.push(hoehen)
  // Altbestand: Freitext-Höhe aus der Zeit vor der Raster-Umstellung.
  else if (item.heightNote?.trim()) parts.push(`ca. ${item.heightNote.trim()}`)

  // Zusatz-Auswahlen in Katalog-Reihenfolge, mit ihrem Klartext-Label.
  for (const choice of option?.choices ?? []) {
    const wert = item.choices?.[choice.id] ?? choice.standard
    if (!wert) continue
    const label = choice.options.find((o) => o.value === wert)?.label ?? wert
    const text = item.choiceTexte?.[choice.id]?.trim()
    parts.push(`${choice.label}: ${label}${text ? ` (${text})` : ''}`)
  }

  if (item.bezugId) {
    const ziel = alle.find((x) => x.id === item.bezugId)
    const zielLabel = ziel ? (getEquipmentOption(ziel.optionId)?.label ?? ziel.optionId) : undefined
    if (zielLabel) parts.push(`${option?.bezug?.label ?? 'Bezug'} ${zielLabel}`)
  }

  if (item.formatNote?.trim()) parts.push(item.formatNote.trim())
  const seiten = beschreibeSeiten(item)
  if (seiten) parts.push(`Position: ${seiten}`)
  if (item.positionNote?.trim()) parts.push(`Position: ${item.positionNote.trim()}`)
  if (item.lfm?.trim()) parts.push(`${item.lfm.trim()} lfm`)
  if (item.rauchglas) parts.push('Deckplatte Rauchglas')
  if (item.note?.trim()) parts.push(item.note.trim())
  return parts.join(' · ')
}

/** Alle in einem Segment konfigurierten Ausstattungs-Elemente als Klartext-Zeilen. */
export function describeColumnEquipment(column: FrontColumn): string[] {
  const alle = column.equipment ?? []
  return alle.map((item) => describeEquipmentItem(item, alle))
}

/** Eine Kategorie der Ausstattungs-Vorauswahl (Schritt 6) mit ihren gewählten Labels. */
export interface AusstattungRecapGroup {
  category: string
  labels: string[]
}

/**
 * Ausstattungs-Vorauswahl (Schritt 6) als kategorisierte Klartext-Gruppen
 * (Zusammenfassung & AV-PDF); leere Kategorien werden weggelassen.
 */
export function describeAusstattungAuswahl(selected: string[] | undefined): AusstattungRecapGroup[] {
  if (!selected || selected.length === 0) return []
  const set = new Set(selected)
  return equipmentCategories
    .map((cat) => ({
      category: cat.label,
      labels: cat.options.filter((o) => set.has(o.id)).map((o) => o.label),
    }))
    .filter((g) => g.labels.length > 0)
}
