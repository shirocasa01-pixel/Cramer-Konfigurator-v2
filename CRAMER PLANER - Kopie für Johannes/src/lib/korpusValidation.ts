import type { Draft } from '../types'
import type { KorpusArea } from '../config/korpus'
import { isMaterialSelectionComplete } from './materialRules'

/** IDs der noch unvollständigen Pflicht-Bereiche (für Echtzeit-Validierung / Progression). */
export function getIncompleteKorpusAreas(
  korpus: Draft['korpus'],
  visibleAreas: KorpusArea[],
): string[] {
  return visibleAreas
    .filter((area) => area.required && !isMaterialSelectionComplete(korpus?.[area.id]))
    .map((area) => area.id)
}

export function isKorpusComplete(korpus: Draft['korpus'], visibleAreas: KorpusArea[]): boolean {
  return getIncompleteKorpusAreas(korpus, visibleAreas).length === 0
}
