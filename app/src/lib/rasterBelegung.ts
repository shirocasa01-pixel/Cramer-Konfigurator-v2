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
 *               Ab der Einbauhöhe — oder ab dem Korpusboden, wenn das Teil am Boden steht
 *               (Container: „Steht immer am Schrankboden").
 *
 * Sonderhöhen in cm nehmen nicht teil: „ca. 118 cm" ist bewusst eine Absprache mit der AV,
 * keine Rasterposition. Teile ohne `rasterBelegung` (seitlich montierte Auszüge, Spiegel …)
 * belegen keine Bodenposition.
 *
 * KORPUSBODEN ≠ RASTER 1 (Überarbeitung 9, S. 3): „Einbauhöhe Korpusboden und Raster 1 sind
 * nicht die gleiche Höhe. Am Korpusboden ist aufliegend auf der Bodenplatte (mit kleiner
 * Luft). 1 Raster ist ca. 10 cm über Bodenplatte." Der Korpusboden ist deshalb die eigene
 * Position 0. Ein Teil, das am Boden steht, belegt den Boden und so viele Raster darüber,
 * wie es hoch ist (Container 6 R: Korpusboden bis Raster 6).
 *
 * MINDESTABSTAND (Überarbeitung 9, S. 4 + Ergänzung): Bei Optionen mit `mindestAbstandCm`
 * (Rollboden mit Schuhablage Craft: ca. 35 cm / 3 Raster) dürfen zwei Stück nicht näher
 * beieinander liegen — „35 cm drüber nicht machbar".
 */

import { getEquipmentOption } from '../config/equipment.ts'
import type { EquipmentHoehe, SegmentEquipmentItem } from '../types/index.ts'

export interface RasterBereich {
  itemId: string
  /** Index des Stücks bei Teilen mit einer Höhe je Stück. */
  stueck: number
  von: number
  bis: number
  /** Klartext für Meldungen: „Container 6 Raster (Korpusboden bis Raster 6)". */
  text: string
}

/** Position des Korpusbodens — unterhalb von Raster 1. */
export const KORPUSBODEN = 0

/** Rastermaß (12,8 cm) und Lage von Raster 1 über der Bodenplatte (ca. 10 cm, S. 3). */
const RASTER_CM = 12.8
const RASTER_1_UEBER_BODEN_CM = 10

/** Bauhöhe aus einer Varianten-Bezeichnung („6R" → 6, „1,5R" → 1,5). */
export function varianteRaster(variante: string | undefined): number | undefined {
  const treffer = /^(\d+(?:[.,]\d+)?)\s*R$/i.exec(variante?.trim() ?? '')
  return treffer ? Number(treffer[1].replace(',', '.')) : undefined
}

function startRaster(hoehe: EquipmentHoehe | undefined, amBoden: boolean): number | undefined {
  if (amBoden) return KORPUSBODEN
  if (!hoehe) return undefined
  if (hoehe.modus === 'boden') return KORPUSBODEN
  if (hoehe.modus === 'raster' && hoehe.raster != null && hoehe.raster >= 1) return hoehe.raster
  return undefined
}

function positionText(p: number): string {
  return p === KORPUSBODEN ? 'am Korpusboden' : `Raster ${p}`
}

function bereichText(von: number, bis: number): string {
  if (von === bis) return positionText(von)
  return von === KORPUSBODEN ? `Korpusboden bis Raster ${bis}` : `Raster ${von}–${bis}`
}

/** Ungefähre Einbauhöhe in cm über der Bodenplatte — für den Mindestabstand. */
export function hoeheCmVon(hoehe: EquipmentHoehe | undefined): number | undefined {
  if (!hoehe) return undefined
  if (hoehe.modus === 'boden') return 0
  if (hoehe.modus === 'raster' && hoehe.raster != null && hoehe.raster >= 1) {
    return RASTER_1_UEBER_BODEN_CM + (hoehe.raster - 1) * RASTER_CM
  }
  if (hoehe.modus === 'cm') {
    const n = Number(String(hoehe.cm ?? '').replace(',', '.').replace(/[^\d.]/g, ''))
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  return undefined
}

/** cm über der Bodenplatte für eine Rasterposition (0 = Korpusboden). */
function positionCm(p: number): number {
  return p === KORPUSBODEN ? 0 : RASTER_1_UEBER_BODEN_CM + (p - 1) * RASTER_CM
}

function hoeheText(hoehe: EquipmentHoehe | undefined): string {
  if (!hoehe) return '—'
  if (hoehe.modus === 'boden') return 'am Korpusboden'
  if (hoehe.modus === 'raster') return `Raster ${hoehe.raster}`
  return `ca. ${hoehe.cm} cm`
}

const cmText = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

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
      // Vom Korpusboden aus reicht ein 6-R-Teil bis Raster 6; ab Raster k bis k + 5.
      bis = von === KORPUSBODEN ? Math.ceil(hoehe) : von + Math.ceil(hoehe) - 1
    }
    const name = option.label + (option.rasterBelegung === 'variante' && item.variant ? ` ${item.variant.replace('R', ' Raster')}` : '')
    bereiche.push({ itemId: item.id, stueck, von, bis, text: `${name} (${bereichText(von, bis)})` })
  }
  return bereiche
}

/**
 * Welche Positionen sind — außer durch das angefragte Stück selbst — schon belegt oder
 * wegen des Mindestabstands gesperrt? Grundlage der gesperrten Einträge im Raster-Dropdown
 * und des Chips „am Korpusboden" (Position 0).
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
  // Mindestabstand zu den übrigen Stück derselben Option: zu nahe Positionen sperren.
  const eigenes = items.find((i) => i.id === ausser.itemId)
  const abstand = eigenes ? getEquipmentOption(eigenes.optionId)?.mindestAbstandCm : undefined
  if (eigenes && abstand) {
    const andere = (eigenes.hoehen ?? [])
      .slice(0, Math.max(1, eigenes.qty ?? 1))
      .map((h, stueck) => ({ h, stueck, cm: hoeheCmVon(h) }))
      .filter((x) => x.stueck !== ausser.stueck && x.cm != null)
    for (let p = KORPUSBODEN; p <= 30; p++) {
      if (belegt.has(p)) continue
      const zuNah = andere.find((x) => Math.abs((x.cm as number) - positionCm(p)) < abstand)
      if (zuNah) belegt.set(p, `zu nah an Stück ${zuNah.stueck + 1} (${hoeheText(zuNah.h)}) — mindestens ca. ${abstand} cm Abstand`)
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
  const anzahl = start === KORPUSBODEN ? n + 1 : n
  return Array.from({ length: anzahl }, (_, i) => start + i)
}

export interface RasterKollision {
  text: string
}

/**
 * Stück einer Option mit Mindestabstand, die zu dicht beieinander liegen. Sonderhöhen in cm
 * zählen hier mit — 35 cm sind eine Fertigungsgrenze, keine Rasterfrage.
 */
export function abstandsVerstoesse(items: SegmentEquipmentItem[]): RasterKollision[] {
  const befunde: RasterKollision[] = []
  for (const item of items) {
    const option = getEquipmentOption(item.optionId)
    const abstand = option?.mindestAbstandCm
    if (!option || !abstand) continue
    const anzahl = option.heightPerPiece ? Math.max(1, item.qty ?? 1) : 1
    const stuecke = (item.hoehen ?? []).slice(0, anzahl).map((h, i) => ({ h, i, cm: hoeheCmVon(h) }))
    for (let a = 0; a < stuecke.length; a++) {
      for (let b = a + 1; b < stuecke.length; b++) {
        const x = stuecke[a]
        const y = stuecke[b]
        if (x.cm == null || y.cm == null) continue
        const diff = Math.abs(x.cm - y.cm)
        if (diff < abstand) {
          befunde.push({
            text:
              `${option.label}: Stück ${x.i + 1} (${hoeheText(x.h)}) und Stück ${y.i + 1} (${hoeheText(y.h)}) liegen nur ca. ` +
              `${cmText(diff)} cm auseinander — mindestens ca. ${abstand} cm (3 Raster) sind nötig, darunter ist es nicht machbar.`,
          })
        }
      }
    }
  }
  return befunde
}

/**
 * Alle Überschneidungen im Segment — für die Prüfung vor „Weiter" (ein Container, der erst
 * NACH den Böden eingeplant wird, sperrt nachträglich deren Positionen).
 */
export function rasterKollisionen(items: SegmentEquipmentItem[], korpusRaster?: number): RasterKollision[] {
  const alle = items.flatMap(bereicheVon)
  const befunde: RasterKollision[] = [...abstandsVerstoesse(items)]
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
