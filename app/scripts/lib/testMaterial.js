/**
 * Eine echte, aktive Oberfläche je Preisgruppe — für Prüfskripte, die Schränke bauen.
 *
 * Seit Überarbeitung 9 schlägt die Kalkulation die Preisgruppe einer Materialauswahl im
 * aktuellen Oberflächen-Stamm nach, statt der beim Auswählen gespeicherten Zahl zu trauen.
 * Ein Testschrank muss deshalb wie ein Berater eine FARBE der gewünschten Preisgruppe wählen
 * (Mattlack für PG 2 usw.), nicht nur „priceGroup: PG2" eintragen.
 */

import { getMaterialGroups } from '../../src/config/materialMatrix.ts'
import { resolvePriceGroup } from '../../src/lib/materialRules.ts'

export function materialFuer(pg) {
  for (const gruppe of getMaterialGroups()) {
    for (const option of gruppe.options) {
      if (option.requiresFreeText) continue
      if (resolvePriceGroup(gruppe.id, option.id) === pg) {
        return { materialGroupId: gruppe.id, optionId: option.id, priceGroup: pg }
      }
    }
  }
  throw new Error(`Keine aktive Oberfläche in ${pg} gefunden.`)
}
