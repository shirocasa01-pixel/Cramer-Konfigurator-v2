/**
 * RASTER-BELEGUNG DER AUSSTATTUNG — keine zwei Teile auf derselben Position.
 *
 * Überarbeitung 8, S. 5 (Einlegeboden und Einlegeboden inkl. Kleiderstange): „Bei mehreren
 * Einlegeböden oder anderen Ausstattungsvarianten, darf nicht mehrfach die gleiche Position
 * besetzt werden. Ist z. B. ein 6 Raster Container geplant sind die unteren 6 Raster
 * blockiert."
 *
 * Als allgemeine Modulregel: Jedes Teil belegt einen Rasterbereich [von, bis]. Welcher das
 * ist, sagt der Katalog (`EquipmentOption.rasterBelegung`), nicht diese Datei:
 *
 *   'punkt'     Boden, Kleiderstangenboden, Rollboden, Rollkorb — genau die gewählte Stufe
 *               (die Rasterhöhe bezeichnet die Unterkante des Teils).
 *   'variante'  Bauhöhe aus der Variante („6R", „1,5R"), aufgerundet auf ganze Raster.
 *               Ab der Einbauhöhe — oder ab Raster 1, wenn das Teil am Boden steht
 *               (Container: „Steht immer am Schrankboden").
 *
 * Sonderhöhen in cm nehmen nicht teil: „ca. 118 cm" ist bewusst eine Absprache mit der AV,
 * keine Rasterposition. Teile ohne `rasterBelegung` (seitlich montierte Auszüge, Spiegel …)
 * belegen keine Bodenposition.
 */

import { getEquipmentOption } from '../config/equipment.ts'
import type { EquipmentHoehe, SegmentEquipmentItem } from '../types/index.ts'

export interface RasterBereich {
  itemId: string
  /** Index des Stücks bei Teilen mit einer Höhe je Stück. */
  stueck: number
  von: number
  bis: number
  /** Klartext für Meldungen: „Container 6 Raster (Raster 1–6)". */
  text: string
}

/** Bauhöhe aus einer Varianten-Bezeichnung („6R" → 6, „1,5R" → 1,5). */
function varianteRaster(variante: string | undefined): number | undefined {
  const treffer = /^(\d+(?:[.,]\d+)?)\s*R$/i.exec(variante?.trim() ?? '')
  return treffer ? Number(treffer[1].replace(',', '.')) : undefined
}

function startRaster(hoehe: EquipmentHoehe | undefined, amBoden: boolean): number | undefined {
  if (amBoden) return 1
  if (!hoehe) return undefined
  if (hoehe.modus === 'boden') return 1
  if (hoehe.modus === 'raster' && hoehe.raster != null && hoehe.raster >= 1) return hoehe.raster
  return undefined
}

function bereichText(von: number, bis: number): string {
  return von === bis ? `Raster ${von}` : `Raster ${von}–${bis}`
}

/** Alle belegten Rasterbereiche eines Teils (je Stück einer). */
export function bereicheVon(item: SegmentEquipmentItem): RasterBereich[] {
  const option = getEquipmentOption(item.optionId)
  if (!option?.rasterBelegung) return []
  const amBoden = option.heightMode === 'keine' || option.heightMode == null
  const anzahl = option.heightPerPiece ? Math.max(1, item.qty ?? 1) : 1
  const hoehen = item.hoehen ?? []
  const bereiche: RasterBereich[] = []
  for (let stueck = 0; stueck < anzahl; stueck++) {
    const von = startRaster(hoehen[stueck], amBoden)
    if (von == null) continue
    let bis = von
    if (option.rasterBelegung === 'variante') {
      const hoehe = varianteRaster(item.variant)
      if (hoehe == null) continue
      bis = von + Math.ceil(hoehe) - 1
    }
    const name = option.label + (option.rasterBelegung === 'variante' && item.variant ? ` ${item.variant.replace('R', ' Raster')}` : '')
    bereiche.push({ itemId: item.id, stueck, von, bis, text: `${name} (${bereichText(von, bis)})` })
  }
  return bereiche
}

/**
 * Welche Raster sind — außer durch das angefragte Stück selbst — schon belegt?
 * Grundlage der gesperrten Einträge im Raster-Dropdown.
 */
export function belegteRaster(
  items: SegmentEquipmentItem[],
  ausser: { itemId: string; stueck: number },
): Map<number, string> {
  const belegt = new Map<number, string>()
  for (const item of items) {
    for (const b of bereicheVon(item)) {
      if (b.itemId === ausser.itemId && b.stueck === ausser.stueck) continue
      for (let r = b.von; r <= b.bis; r++) if (!belegt.has(r)) belegt.set(r, b.text)
    }
  }
  return belegt
}

/**
 * Raster, die ein Stück mit dieser Bauhöhe ab `start` belegen würde. Für das Dropdown:
 * Eine 2-Raster-Schublade auf Raster 5 braucht 5 UND 6.
 */
export function benoetigteRaster(item: SegmentEquipmentItem, start: number): number[] {
  const option = getEquipmentOption(item.optionId)
  if (option?.rasterBelegung !== 'variante') return [start]
  const hoehe = varianteRaster(item.variant)
  const n = hoehe != null ? Math.ceil(hoehe) : 1
  return Array.from({ length: n }, (_, i) => start + i)
}

export interface RasterKollision {
  text: string
}

/**
 * Alle Überschneidungen im Segment — für die Prüfung vor „Weiter" (ein Container, der erst
 * NACH den Böden eingeplant wird, sperrt nachträglich deren Positionen).
 */
export function rasterKollisionen(items: SegmentEquipmentItem[], korpusRaster?: number): RasterKollision[] {
  const alle = items.flatMap(bereicheVon)
  const befunde: RasterKollision[] = []
  for (let i = 0; i < alle.length; i++) {
    for (let j = i + 1; j < alle.length; j++) {
      const a = alle[i]
      const b = alle[j]
      if (a.von <= b.bis && b.von <= a.bis) {
        befunde.push({ text: `${a.text} und ${b.text} belegen dieselbe Position — bitte eine Einbauhöhe ändern.` })
      }
    }
  }
  if (korpusRaster != null) {
    for (const b of alle) {
      if (b.bis >= korpusRaster) {
        befunde.push({ text: `${b.text} reicht bis an den Korpusdeckel (Raster ${korpusRaster}).` })
      }
    }
  }
  return befunde
}
