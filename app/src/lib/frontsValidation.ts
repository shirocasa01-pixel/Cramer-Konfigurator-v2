import type { FrontColumn, FrontElement, FrontsData } from '../types'
import { getFrontType, getStyleLine } from '../config/frontCatalog'
import { MATERIAL_CUSTOM_ID } from '../config/materialMatrix'
import { isMaterialSelectionComplete } from './materialRules'
import { frontMaterialGroupId, hasZweilaeufigeSchiebetuer, isFrontFieldVisible } from './frontsHelpers'

/**
 * Element gültig, wenn:
 *  - Kennzeichnung gesetzt (Pflicht, Freitext beliebig), UND
 *  - bei Typen mit Stil-Linien: eine Stil-Linie gewählt, UND
 *  - jedes Material-Feld der Stil-Linie vollständig ist (Front-Material ist Pflicht).
 * „Offen (Regal)“ benötigt nur die Kennzeichnung.
 */
/** Harte Höhensperre (z. B. Schreibklappe max. 45 cm) verletzt? */
export function exceedsMaxHeight(element: FrontElement): boolean {
  const max = getFrontType(element.typeId)?.maxHeightCm
  if (max == null) return false
  const h = Number((element.heightCm ?? '').replace(',', '.'))
  return Number.isFinite(h) && h > max
}

/**
 * Überarbeitung 3: Der Türanschlag ist bei Drehtüren immer anzugeben („Unabhängig von der
 * Position der Drehtür im Schrank muss es immer eine Auswahl für den Türanschlag geben").
 */
export function fehlenderTuerAnschlag(element: FrontElement): boolean {
  return Boolean(getFrontType(element.typeId)?.tuerAnschlag) && !element.tuerAnschlag
}

/**
 * Überarbeitung 3 („Line"): Die Frage „(Glas der) Frontscheibe und der Aufkantung gleich?"
 * muss beantwortet sein, sobald eine echte Materialgruppe gewählt ist. Bei „anders"
 * beschreibt der Freitext die Ausführung – dann entfällt die Frage.
 */
export function offeneLineAbfrage(element: FrontElement): boolean {
  const styleLine = getStyleLine(element.typeId, element.styleLineId)
  if (!styleLine?.frontscheibeAufkantung) return false
  const gruppe = frontMaterialGroupId(element)
  if (gruppe == null || gruppe === MATERIAL_CUSTOM_ID) return false
  return element.lineAufkantungGleich == null
}

export function isFrontElementValid(element: FrontElement): boolean {
  if (!element.label.trim()) return false
  if (exceedsMaxHeight(element)) return false
  if (fehlenderTuerAnschlag(element)) return false
  const type = getFrontType(element.typeId)
  if (!type || type.styleLines.length === 0) return true
  if (!element.styleLineId) return false
  const styleLine = getStyleLine(element.typeId, element.styleLineId)
  if (!styleLine) return false
  if (offeneLineAbfrage(element)) return false
  // Nur SICHTBARE Material-Felder sind Pflicht – die Aufkantung z. B. nur bei „Nein".
  return styleLine.fields
    .filter((field) => field.kind === 'material' && isFrontFieldVisible(field, element))
    .every((field) => isMaterialSelectionComplete(element.fieldValues?.[field.id]?.material))
}

/** Spalte gültig: mindestens ein Element, alle Elemente gültig. */
export function isColumnValid(column: FrontColumn): boolean {
  return column.elements.length > 0 && column.elements.every(isFrontElementValid)
}

/** Menschlich lesbare Liste offener Punkte (für die Fortschritts-Anzeige). */
export function getFrontsIssues(fronts: FrontsData | undefined): string[] {
  if (!fronts || fronts.columns.length === 0) return ['Keine Front-Typ-Spalten initialisiert.']
  const issues: string[] = []
  // Schritt 7: Bei zweiläufiger Schiebetür (exklusiv) deckt EINE Front den ganzen Schrank
  // ab – leere Segmente sind dann zulässig und werden nicht als fehlend gemeldet.
  const zwei = hasZweilaeufigeSchiebetuer(fronts)
  fronts.columns.forEach((column, index) => {
    const pos = `Front-Typ ${index + 1}`
    if (column.elements.length === 0) {
      if (!zwei) issues.push(`${pos}: mindestens ein Element hinzufügen.`)
      return
    }
    column.elements.forEach((element) => {
      const name = element.label.trim() || '(ohne Kennzeichnung)'
      const type = getFrontType(element.typeId)
      if (!element.label.trim()) {
        issues.push(`${pos}: Kennzeichnung fehlt bei einem Element.`)
      } else if (type && type.styleLines.length > 0 && !element.styleLineId) {
        issues.push(`${pos} · ${name}: Stil-Linie wählen.`)
      } else if (exceedsMaxHeight(element)) {
        issues.push(`${pos} · ${name}: ${type?.label} max. ${type?.maxHeightCm} cm Höhe!`)
      } else if (fehlenderTuerAnschlag(element)) {
        issues.push(`${pos} · ${name}: Türanschlag rechts oder links wählen.`)
      } else if (offeneLineAbfrage(element)) {
        issues.push(`${pos} · ${name}: Frage „Frontscheibe und Aufkantung gleich?" beantworten.`)
      } else if (!isFrontElementValid(element)) {
        issues.push(`${pos} · ${name}: Material auswählen.`)
      }
    })
  })
  // Schritt 7: zweiläufige Schiebetür erfordert die Anzahl der Schiebetüren.
  if (zwei && !fronts.schiebetuerAnzahl) {
    issues.push('Anzahl der Schiebetüren für den Schrank wählen.')
  }
  return issues
}

export function isFrontsComplete(fronts: FrontsData | undefined): boolean {
  if (!fronts || fronts.columns.length === 0) return false
  // Schritt 7: zweiläufige Schiebetür ist exklusiv – die (einzige) Schiebetür-Spalte muss
  // gültig sein, leere Segmente sind zulässig; zusätzlich ist die Anzahl Pflicht.
  if (hasZweilaeufigeSchiebetuer(fronts)) {
    const nonEmpty = fronts.columns.filter((col) => col.elements.length > 0)
    return nonEmpty.every(isColumnValid) && Boolean(fronts.schiebetuerAnzahl)
  }
  return fronts.columns.every(isColumnValid)
}
