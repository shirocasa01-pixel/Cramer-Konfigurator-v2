import {
  getMaterialGroup,
  getMaterialOption,
  MATERIAL_CUSTOM_ID,
  MATERIAL_NONE_ID,
} from '../config/materialMatrix'
import type { MaterialSelection, PriceGroup } from '../types'

/** Kurzlabels der Preisgruppen (für dezente Hintergrund-Anzeige). */
export const PRICE_GROUP_LABEL: Record<PriceGroup, string> = {
  PG1: 'PG 1',
  PG2: 'PG 2',
  PG3: 'PG 3',
  PG4: 'PG 4',
}

/**
 * Menschlich lesbare Beschreibung einer Material-Auswahl (für Zusammenfassungen/PDF).
 * `noneLabel` bestimmt die Anzeige des „Keine …“-Sentinels (z. B. „Keine Abdeckplatte“).
 */
export function describeMaterialSelection(
  selection: MaterialSelection | undefined,
  noneLabel = 'Keine Auswahl',
): string {
  if (!selection || !selection.materialGroupId) return '—'
  if (selection.materialGroupId === MATERIAL_NONE_ID) return noneLabel
  if (selection.materialGroupId === MATERIAL_CUSTOM_ID) {
    return `anders: ${selection.customText?.trim() ?? ''}`.trim()
  }
  const group = getMaterialGroup(selection.materialGroupId)
  const option = getMaterialOption(selection.materialGroupId, selection.optionId)
  const base = [group?.label, option?.label].filter(Boolean).join(' – ') || '—'
  return selection.note?.trim() ? `${base} · ${selection.note.trim()}` : base
}
