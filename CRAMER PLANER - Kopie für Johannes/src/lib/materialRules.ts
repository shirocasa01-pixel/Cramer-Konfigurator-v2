import {
  getMaterialGroup,
  getMaterialOption,
  MATERIAL_CUSTOM_ID,
  MATERIAL_NONE_ID,
} from '../config/materialMatrix'
import type { MaterialSelection, PriceGroup } from '../types'

/**
 * Automatische Preisgruppen-Zuweisung für eine Standard-Materialauswahl
 * (Farbmatrix, Regel 1). Die Option-PG hat Vorrang vor der Gruppen-PG
 * (z. B. Wengé => PG4 innerhalb der PG3-Gruppe Furnier).
 */
export function resolvePriceGroup(
  groupId: string | undefined,
  optionId: string | undefined,
): PriceGroup | undefined {
  const option = getMaterialOption(groupId, optionId)
  if (option?.priceGroup) return option.priceGroup
  return getMaterialGroup(groupId)?.priceGroup
}

/**
 * Fallback-PG für kundenspezifische „anders“-Eingaben (Farbmatrix, Regel 2).
 * Laut Doku ausdrücklich lack-spezifisch:
 *   - Sikkens / NCS / RAL Design    -> PG4
 *   - andere (Standard-)RAL-Lacke   -> PG3
 * Für Nicht-Lack-Sonderwünsche bleibt die Preisgruppe bewusst offen (AV-Prüfung).
 */
export function resolveCustomPriceGroup(text: string | undefined): PriceGroup | undefined {
  const value = (text ?? '').trim()
  if (!value) return undefined
  if (/sikkens|ncs|ral\s*design/i.test(value)) return 'PG4'
  if (/\bral\b/i.test(value)) return 'PG3'
  return undefined
}

/**
 * Eine Material-Auswahl gilt als vollständig, wenn:
 *  - „Keine …“ (Sentinel) gewählt ist, ODER
 *  - „anders“ mit Freitext befüllt ist, ODER
 *  - eine echte Materialgruppe + Option gewählt ist.
 */
export function isMaterialSelectionComplete(selection: MaterialSelection | undefined): boolean {
  if (!selection || !selection.materialGroupId) return false
  if (selection.materialGroupId === MATERIAL_NONE_ID) return true
  if (selection.materialGroupId === MATERIAL_CUSTOM_ID) return Boolean(selection.customText?.trim())
  return Boolean(selection.optionId)
}
