import type { FrontColumn, SegmentEquipmentItem } from '../types'
import {
  equipmentCategories,
  getEquipmentOption,
  type EquipmentDetailField,
  type EquipmentOption,
} from '../config/equipment'

/** Kurzlabel eines Detailfeldes (für generisches Rendering & Recap). */
export const EQUIPMENT_FIELD_LABEL: Record<EquipmentDetailField, string> = {
  qty: 'Anzahl',
  height: 'Höhe (ca.)',
  position: 'Position',
  format: 'Format',
  lfm: 'Laufmeter (lfm)',
  rauchglas: 'Deckplatte Rauchglas',
  note: 'Notiz',
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
export function describeEquipmentItem(item: SegmentEquipmentItem): string {
  const option = getEquipmentOption(item.optionId)
  const parts: string[] = [option?.label ?? item.optionId]
  const variant = equipmentVariantLabel(option, item.variant)
  if (variant) parts.push(variant)
  if (item.qty != null && item.qty > 1) parts.push(`${item.qty}×`)
  if (item.heightNote?.trim()) parts.push(`ca. ${item.heightNote.trim()}`)
  if (item.formatNote?.trim()) parts.push(item.formatNote.trim())
  if (item.positionNote?.trim()) parts.push(`Position: ${item.positionNote.trim()}`)
  if (item.lfm?.trim()) parts.push(`${item.lfm.trim()} lfm`)
  if (item.rauchglas) parts.push('Deckplatte Rauchglas')
  if (item.note?.trim()) parts.push(item.note.trim())
  return parts.join(' · ')
}

/** Alle in einem Segment konfigurierten Ausstattungs-Elemente als Klartext-Zeilen. */
export function describeColumnEquipment(column: FrontColumn): string[] {
  return (column.equipment ?? []).map(describeEquipmentItem)
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
