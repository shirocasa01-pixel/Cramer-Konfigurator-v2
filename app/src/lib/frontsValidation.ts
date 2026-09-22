import type { Draft, FrontColumn, FrontElement, FrontsData } from '../types/index.ts'
import { ausgeschlosseneOptionIds, getFrontType, getStyleLine } from '../config/frontCatalog.ts'
import { MATERIAL_CUSTOM_ID } from '../config/materialMatrix.ts'
import { fehlenderFarbcode, isMaterialSelectionComplete } from './materialRules.ts'
import { frontMaterialGroupId, hasZweilaeufigeSchiebetuer, isFrontFieldVisible } from './frontsHelpers.ts'
import {
  entwurfsGeometrie,
  pruefeSpalte,
  vorgegebenerTuerAnschlag,
  type SegmentGeometrie,
} from './frontGeometrie.ts'
import { rasterKollisionen } from './rasterBelegung.ts'

/**
 * Element gültig, wenn:
 *  - Kennzeichnung gesetzt (Pflicht, Freitext beliebig), UND
 *  - bei Typen mit Stil-Linien: eine Stil-Linie gewählt, UND
 *  - jedes Material-Feld der Stil-Linie vollständig ist (Front-Material ist Pflicht).
 * „Offen (Regal)“ benötigt nur die Kennzeichnung.
 *
 * Überarbeitung 9: Wo die Fronten eines Segments zusammenhängen (Breite, Höhe, Anschlag),
 * entscheidet `lib/frontGeometrie.ts`. Die Prüfungen hier bekommen deren Ergebnis über die
 * Segment-Geometrie; ohne sie (Serien ohne Korpus-Grunddaten) gelten die alten Regeln.
 */
/** Harte Höhensperre (z. B. Schreibklappe max. 45 cm) verletzt? */
export function exceedsMaxHeight(element: FrontElement): boolean {
  const max = getFrontType(element.typeId)?.maxHeightCm
  if (max == null) return false
  const h = Number((element.heightCm ?? '').replace(',', '.'))
  return Number.isFinite(h) && h > max
}

/**
 * Türanschlag fehlt? Überarbeitung 9, S. 2: „Die Position des Türanschlag soll nur bei
 * Einzeltüren abgefragt werden." Ist er durch ein Türpaar vorgegeben (`vorgabe`), fehlt er
 * nie — er wird dann automatisch eingetragen.
 */
export function fehlenderTuerAnschlag(element: FrontElement, vorgabe?: 'links' | 'rechts'): boolean {
  if (vorgabe) return false
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

/**
 * Überarbeitung 9, S. 8: Ist eine Oberfläche gewählt, die die Stil-Linie ausschließt
 * (Line: Wave hinterlackiert, Rauchglas grau / dark grey)? Betrifft Altentwürfe — die
 * Oberfläche selbst bietet sie nicht mehr an.
 */
export function unzulaessigeOberflaeche(element: FrontElement): string | null {
  const styleLine = getStyleLine(element.typeId, element.styleLineId)
  if (!styleLine?.ausgeschlosseneOptionen) return null
  for (const field of styleLine.fields) {
    if (field.kind !== 'material' || !isFrontFieldVisible(field, element)) continue
    const material = element.fieldValues?.[field.id]?.material
    if (material?.optionId && ausgeschlosseneOptionIds(styleLine, material.materialGroupId).includes(material.optionId)) {
      return `${field.label}: diese Ausführung ist bei ${styleLine.label} nicht möglich.`
    }
  }
  return null
}

export function isFrontElementValid(element: FrontElement, vorgabeAnschlag?: 'links' | 'rechts'): boolean {
  if (!element.label.trim()) return false
  if (exceedsMaxHeight(element)) return false
  if (fehlenderTuerAnschlag(element, vorgabeAnschlag)) return false
  const type = getFrontType(element.typeId)
  if (!type || type.styleLines.length === 0) return true
  if (!element.styleLineId) return false
  const styleLine = getStyleLine(element.typeId, element.styleLineId)
  if (!styleLine) return false
  if (offeneLineAbfrage(element)) return false
  if (unzulaessigeOberflaeche(element)) return false
  // Nur SICHTBARE Material-Felder sind Pflicht – die Aufkantung z. B. nur bei „Nein".
  return styleLine.fields
    .filter((field) => field.kind === 'material' && isFrontFieldVisible(field, element))
    .every((field) => isMaterialSelectionComplete(element.fieldValues?.[field.id]?.material))
}

/** Befunde eines Segments, die nicht an einem einzelnen Element hängen. */
function segmentBefunde(column: FrontColumn, geo: SegmentGeometrie | undefined): string[] {
  return [...pruefeSpalte(column, geo), ...rasterKollisionen(column.equipment ?? [], geo?.korpusRaster).map((k) => k.text)]
}

/** Spalte gültig: mindestens ein Element, alle Elemente gültig, keine Geometrie-Befunde. */
export function isColumnValid(column: FrontColumn, geo?: SegmentGeometrie): boolean {
  return (
    column.elements.length > 0 &&
    column.elements.every((el) => isFrontElementValid(el, vorgegebenerTuerAnschlag(column, el.id, geo))) &&
    segmentBefunde(column, geo).length === 0
  )
}

/**
 * Menschlich lesbare Liste offener Punkte (für die Fortschritts-Anzeige).
 *
 * `geometrie` je Spalte aus `entwurfsGeometrie()`; ohne sie entfallen die Prüfungen, die
 * den Korpus kennen müssen. Wer einen Entwurf hat, nimmt `getFrontsIssuesFuerEntwurf`.
 */
export function getFrontsIssues(
  fronts: FrontsData | undefined,
  geometrie: Array<SegmentGeometrie | undefined> = [],
): string[] {
  if (!fronts || fronts.columns.length === 0) return ['Keine Front-Typ-Spalten initialisiert.']
  const issues: string[] = []
  // Schritt 7: Bei zweiläufiger Schiebetür (exklusiv) deckt EINE Front den ganzen Schrank
  // ab – leere Segmente sind dann zulässig und werden nicht als fehlend gemeldet.
  const zwei = hasZweilaeufigeSchiebetuer(fronts)
  fronts.columns.forEach((column, index) => {
    const pos = `Front-Typ ${index + 1}`
    const geo = geometrie[index]
    if (column.elements.length === 0) {
      if (!zwei) issues.push(`${pos}: mindestens ein Element hinzufügen.`)
      return
    }
    column.elements.forEach((element) => {
      const name = element.label.trim() || '(ohne Kennzeichnung)'
      const type = getFrontType(element.typeId)
      const vorgabe = vorgegebenerTuerAnschlag(column, element.id, geo)
      const oberflaeche = unzulaessigeOberflaeche(element)
      if (!element.label.trim()) {
        issues.push(`${pos}: Kennzeichnung fehlt bei einem Element.`)
      } else if (type && type.styleLines.length > 0 && !element.styleLineId) {
        issues.push(`${pos} · ${name}: Stil-Linie wählen.`)
      } else if (exceedsMaxHeight(element)) {
        issues.push(`${pos} · ${name}: ${type?.label} max. ${type?.maxHeightCm} cm Höhe!`)
      } else if (fehlenderTuerAnschlag(element, vorgabe)) {
        issues.push(`${pos} · ${name}: Türanschlag links oder rechts wählen.`)
      } else if (offeneLineAbfrage(element)) {
        issues.push(`${pos} · ${name}: Frage „Frontscheibe und Aufkantung gleich?" beantworten.`)
      } else if (oberflaeche) {
        issues.push(`${pos} · ${name}: ${oberflaeche}`)
      } else if (Object.values(element.fieldValues ?? {}).some((v) => fehlenderFarbcode(v?.material))) {
        issues.push(`${pos} · ${name}: Farbton / Farbnummer der Sonderfarbe eintragen.`)
      } else if (!isFrontElementValid(element, vorgabe)) {
        issues.push(`${pos} · ${name}: Material auswählen.`)
      }
    })
    for (const befund of segmentBefunde(column, geo)) issues.push(`${pos}: ${befund}`)
  })
  // Schritt 7: zweiläufige Schiebetür erfordert die Anzahl der Schiebetüren.
  if (zwei && !fronts.schiebetuerAnzahl) {
    issues.push('Anzahl der Schiebetüren für den Schrank wählen.')
  }
  return issues
}

export function isFrontsComplete(
  fronts: FrontsData | undefined,
  geometrie: Array<SegmentGeometrie | undefined> = [],
): boolean {
  if (!fronts || fronts.columns.length === 0) return false
  // Schritt 7: zweiläufige Schiebetür ist exklusiv – die (einzige) Schiebetür-Spalte muss
  // gültig sein, leere Segmente sind zulässig; zusätzlich ist die Anzahl Pflicht.
  if (hasZweilaeufigeSchiebetuer(fronts)) {
    return (
      fronts.columns.every((col, i) => col.elements.length === 0 || isColumnValid(col, geometrie[i])) &&
      Boolean(fronts.schiebetuerAnzahl)
    )
  }
  return fronts.columns.every((col, i) => isColumnValid(col, geometrie[i]))
}

/** `getFrontsIssues` mit der Geometrie aus dem Entwurf (Korpusbreiten, -höhe, Serie). */
export function getFrontsIssuesFuerEntwurf(draft: Draft): string[] {
  return getFrontsIssues(draft.fronts, entwurfsGeometrie(draft))
}

/** `isFrontsComplete` mit der Geometrie aus dem Entwurf. */
export function isFrontsCompleteFuerEntwurf(draft: Draft): boolean {
  return isFrontsComplete(draft.fronts, entwurfsGeometrie(draft))
}
