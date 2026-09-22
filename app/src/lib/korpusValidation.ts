import type { Draft, MaterialSelection } from '../types'
import type { KorpusArea } from '../config/korpus'
import { MATERIAL_CUSTOM_ID, MATERIAL_NONE_ID, aufloeseMaterialGroupIds } from '../config/materialMatrix'
import { isMaterialSelectionComplete } from './materialRules'

/**
 * Ist die gespeicherte Materialgruppe in diesem Bereich (noch) zulässig? Ein Altentwurf mit
 * Xtreme Plus innen (seit Überarbeitung 8 bei Refugium nicht mehr angeboten) muss neu
 * gewählt werden, statt unbemerkt weiter mit PG 4 zu rechnen.
 */
export function istGruppeZulaessig(area: KorpusArea, auswahl: MaterialSelection | undefined): boolean {
  const gruppe = auswahl?.materialGroupId
  if (!gruppe || gruppe === MATERIAL_CUSTOM_ID || gruppe === MATERIAL_NONE_ID) return true
  return aufloeseMaterialGroupIds(area.materialGroupIds).includes(gruppe)
}

/** IDs der noch unvollständigen Pflicht-Bereiche (für Echtzeit-Validierung / Progression). */
export function getIncompleteKorpusAreas(
  korpus: Draft['korpus'],
  visibleAreas: KorpusArea[],
): string[] {
  return visibleAreas
    .filter(
      (area) =>
        area.required &&
        (!isMaterialSelectionComplete(korpus?.[area.id]) || !istGruppeZulaessig(area, korpus?.[area.id])),
    )
    .map((area) => area.id)
}

export function isKorpusComplete(korpus: Draft['korpus'], visibleAreas: KorpusArea[]): boolean {
  return getIncompleteKorpusAreas(korpus, visibleAreas).length === 0
}
