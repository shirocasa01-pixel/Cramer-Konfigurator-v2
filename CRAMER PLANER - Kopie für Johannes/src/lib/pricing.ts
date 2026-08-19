import {
  expectedVariantPg,
  priceListMeta,
  priceRowMatchesProgram,
  priceRows,
  type PriceRow,
  type StyleLineId,
} from '../config/pricing'
import type { PriceGroup } from '../types'

/**
 * PREIS-ENGINE (Phase 7).
 *
 * `findPrice(query)` bildet eine konfigurierte Komponente auf eine Preiszeile ab:
 *   1. Kandidaten nach Programm/Kategorie/Stil-Linie/PG/Tiefe/Raster filtern.
 *   2. Breite über die „nächst-höheres-Bracket"-Regel auflösen (Individualmaß →
 *      Preis des nächsthöheren Standardmaßes).
 *   3. Kein Treffer / Breite über größtem Bracket → `on-request` (AV-Prüfung),
 *      niemals geraten.
 *
 * Alle Preise sind VK-EUR inkl. 19% MwSt. (siehe Farbmatrix/Meta).
 */

export interface PriceQuery {
  /** Serien-ID (z. B. 'refugium'); leer = Programm ignorieren. */
  programId?: string
  category?: string
  subcategory?: string
  /** Stil-Linie; steuert zusammen mit `pg` die passende Preis-Variante. */
  styleLine?: StyleLineId
  /** Material-Preisgruppe (bestimmt bei Glatt/Curve/107 die Preis-Variante). */
  pg?: PriceGroup
  /** Individuelle Breite (cm) – wird auf das nächst-höhere Bracket gerundet. */
  widthCm?: number
  /** Optionaler Tiefen-Filter (cm). */
  depthCm?: number
  /** Optionaler Raster-Filter (Höhen-/Segmentklasse). */
  heightRaster?: number
}

export type PriceResult =
  | {
      status: 'fixed'
      /** VK-EUR inkl. MwSt. */
      price: number
      unit: string
      /** Gematchtes Breiten-Bracket (Originaltext) oder null. */
      matchedWidth: string | null
      /** true, wenn ein Individualmaß auf das nächst-höhere Bracket gehoben wurde. */
      usedNextHigher: boolean
      rowId: number
    }
  | { status: 'on-request'; reason: string }

/**
 * Findet den Preis für eine Komponenten-Abfrage.
 * Hinweis: Für breitenabhängige Positionen sollte `widthCm` gesetzt sein – sonst
 * ist bei mehreren Brackets keine eindeutige Auswahl möglich (Fallback: erste Zeile).
 */
export function findPrice(query: PriceQuery): PriceResult {
  let candidates = priceRows.filter(
    (r) => r.priceStatus === 'fixed' && typeof r.price === 'number',
  )
  candidates = candidates.filter((r) => priceRowMatchesProgram(r, query.programId))
  if (query.category) candidates = candidates.filter((r) => r.category === query.category)
  if (query.subcategory) candidates = candidates.filter((r) => r.subcategory === query.subcategory)

  if (query.styleLine) {
    const styleLine = query.styleLine
    candidates = candidates.filter((r) => r.styleLine === styleLine)
    const evp = expectedVariantPg(styleLine, query.pg)
    if (evp) candidates = candidates.filter((r) => r.variantPg === evp)
  }

  if (typeof query.heightRaster === 'number') {
    const hr = query.heightRaster
    candidates = candidates.filter(
      (r) => r.heightRaster == null || r.heightRaster === hr || r.rasterFromSub === hr,
    )
  }
  if (typeof query.depthCm === 'number') {
    const d = query.depthCm
    candidates = candidates.filter((r) => r.depthCm.length === 0 || r.depthCm.includes(d))
  }

  if (candidates.length === 0) {
    return { status: 'on-request', reason: 'Keine passende Preiszeile in der Preisliste gefunden.' }
  }

  // Breiten-Bracket: „nächst-höheres verfügbares Maß".
  if (typeof query.widthCm === 'number') {
    const width = query.widthCm
    const withWidth = candidates
      .filter((r): r is PriceRow & { width: { sortCm: number } } =>
        Boolean(r.width && typeof r.width.sortCm === 'number'),
      )
      .sort((a, b) => a.width.sortCm - b.width.sortCm)

    if (withWidth.length > 0) {
      const chosen = withWidth.find((r) => r.width.sortCm >= width)
      if (!chosen) {
        const largest = withWidth[withWidth.length - 1].width.sortCm
        return {
          status: 'on-request',
          reason: `Breite ${width} cm liegt über dem größten Standardmaß (${largest} cm) – Sondermaß, AV-Prüfung.`,
        }
      }
      return {
        status: 'fixed',
        price: chosen.price as number,
        unit: chosen.unit,
        matchedWidth: chosen.width.raw,
        usedNextHigher: chosen.width.sortCm > width,
        rowId: chosen.id,
      }
    }
    // Keine breitenbehafteten Kandidaten → breitenunabhängige Position (unten).
  }

  // Breitenunabhängig: bevorzugt eine Zeile ohne Breiten-Bracket, sonst die erste.
  const pick = candidates.find((r) => !r.width) ?? candidates[0]
  return {
    status: 'fixed',
    price: pick.price as number,
    unit: pick.unit,
    matchedWidth: pick.width?.raw ?? null,
    usedNextHigher: false,
    rowId: pick.id,
  }
}

// ---------------------------------------------------------------------------
// Summen & Aufschläge
// ---------------------------------------------------------------------------

export interface PriceLineItem {
  label: string
  /** VK-EUR inkl. MwSt.; null bei on-request. */
  price: number | null
  onRequest: boolean
}

export interface PriceTotals {
  /** Summe aller fixen Positionen (inkl. MwSt.). */
  subtotal: number
  /** Optionaler Montage-Aufschlag (+10%). */
  montage: number
  /** Optionaler Aufschlag Lieferung regional (+3%). */
  lieferung: number
  total: number
  /** Anzahl Positionen ohne kalkulierbaren Preis (AV-Prüfung). */
  onRequestCount: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function computeTotals(
  items: PriceLineItem[],
  opts: { montage?: boolean; lieferung?: boolean } = {},
): PriceTotals {
  const subtotal = round2(
    items.reduce((sum, it) => sum + (it.onRequest ? 0 : it.price ?? 0), 0),
  )
  const montage = opts.montage ? round2(subtotal * priceListMeta.montageSurchargePct) : 0
  const lieferung = opts.lieferung ? round2(subtotal * priceListMeta.lieferungRegionalPct) : 0
  return {
    subtotal,
    montage,
    lieferung,
    total: round2(subtotal + montage + lieferung),
    onRequestCount: items.filter((it) => it.onRequest).length,
  }
}

// Formatierung und Parsing liegen zentral in `lib/format.ts` — hier nur die Weiterleitung,
// damit die bestehenden Aufrufstellen unverändert bleiben.
export { formatEuro } from './format'
import { formatEuro as formatEuroDe, parseEingabeDe } from './format'

/**
 * Parst die VK-Preis-Eingabe des Beraters — strikt deutsch: „9.009,00" sind neuntausend­
 * neun Euro, nicht neun. Leere/ungültige Eingabe → null. (Phase A: manuelle Preisbildung.)
 */
export function parseVkPreis(raw: string | undefined): number | null {
  return parseEingabeDe(raw)
}

/** Formatiert eine manuelle VK-Preis-Eingabe als EUR; leere/ungültige Eingabe → „Offen". */
export function formatVkPreis(raw: string | undefined): string {
  const n = parseVkPreis(raw)
  return n == null ? 'Offen' : formatEuroDe(n)
}


