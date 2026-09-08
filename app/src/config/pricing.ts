import type { PriceGroup } from '../types'
import priceListJson from '../data/priceList.json'

/**
 * PREIS-FUNDAMENT (Phase 7) – Zugriff auf die normalisierte Cramer-Preisliste.
 *
 * Datenquelle: `src/data/priceList.json` (1:1-Normalisierung der Excel
 * „Cramer Inbau Preisliste 06.2026", generiert – niemals von Hand editieren).
 * Jede Preiszeile ist über Programm × Kategorie × Stil-Linie × PG × Breiten-
 * Bracket adressierbar. Die Engine dazu liegt in `src/lib/pricing.ts`.
 *
 * WICHTIG (Datenlücken): Die Excel ist eine PDF-Extraktion mit dokumentierten
 * Lücken (u. a. Korpi 41/60cm, Publicum Regale, Teile der Abdeckplatten – siehe
 * Blatt „Unklar_Seiten"). Fehlt eine Preiszeile, liefert die Engine bewusst
 * `on-request` („Preis auf Anfrage / AV-Prüfung") statt zu raten.
 */

/** Front-Stil-Linien, die im Preis eine Rolle spielen (aus Spalte „Variante/Frontart"). */
export type StyleLineId = 'glatt' | 'curve' | '107' | 'line' | 'glossy-less'

export type PriceStatus = 'fixed' | 'on-request' | 'note'

/** Normalisierte Breiten-Angabe einer Preiszeile (heterogene Rohformate vereinheitlicht). */
export interface PriceWidth {
  /** Originaltext aus der Excel (z. B. „50er (49cm)", „T50-51", „bis 60cm", „18R"). */
  raw: string
  kind: 'code' | 'raster' | 'upper' | 'nominal' | 'side' | 'plain' | 'unparsed'
  /** Nominal-Breite (z. B. 50 bei „50er"). */
  nominalCm?: number
  /** Zweite Nominal-Breite bei kombinierten Brackets („50/60er"). */
  nominalCm2?: number | null
  /** Tatsächliches Fertigungsmaß in Klammern (z. B. 49 bei „50er (49cm)"). */
  actualCm?: number | null
  /** Obergrenze bei Range-Brackets („bis 60cm", „-80cm"). */
  upperBoundCm?: number
  /** Raster-Anzahl bei Raster-Brackets („18R", „21R"). */
  rasterCount?: number
  /** Raster-Code bei Katalog-Codes („T50-51" → 51). */
  rasterCode?: number
  /** Kanonischer Sortier-/Vergleichswert in cm für die „nächst-höheres-Bracket"-Regel. */
  sortCm: number | null
}

/** Eine normalisierte Preiszeile. */
export interface PriceRow {
  id: number
  /** Zulässige Serien-IDs (z. B. `['refugium']`) oder `['*']` = alle Programme. */
  programs: string[] | null
  programsRaw: string
  category: string
  subcategory: string
  articleNr: string | null
  variant: string | null
  /** Geparste Stil-Linie (falls die Variante eine ist). */
  styleLine: StyleLineId | null
  /** Glatt-Stufe 1–4 (nur bei styleLine === 'glatt'). */
  glattTier: number | null
  /** In der Variante kodierte Preisgruppe: 'PG1' | 'PG2-4' (Curve/107) bzw. 'PG1'…'PG4' (Glatt). */
  variantPg: string | null
  /** Preisgruppe(n) aus der PG-Spalte (z. B. `['PG3','PG4']` bei „PG3-4"). */
  pg: string[] | null
  pgRaw: string | null
  width: PriceWidth | null
  heightCm: number | null
  heightRaster: number | null
  /** Raster-Anzahl aus der Unterkategorie (z. B. „Türen 4 Raster" → 4). */
  rasterFromSub: number | null
  /** Zulässige Tiefen in cm (z. B. `[25,30]` bei „25/30cm"). */
  depthCm: number[]
  depthRaw: string | null
  /** VK-EUR inkl. 19% MwSt.; `null` bei on-request/note. */
  price: number | null
  unit: string
  priceStatus: PriceStatus
  condition: string | null
  page: number | null
}

export interface PriceListMeta {
  validity: string
  currency: string
  vatRate: number
  vatNote: string
  montageSurchargePct: number
  lieferungRegionalPct: number
  priceGroups: Record<string, string>
  source: string
  rowCount: number
}

// Einmalige, klar begrenzte Typ-Zusicherung an der JSON-Grenze.
export const priceListMeta = priceListJson.meta as PriceListMeta
export const priceRows = priceListJson.rows as unknown as PriceRow[]

/**
 * Welche in der Variante kodierte Preisgruppe erwartet eine Stil-Linie bei
 * gegebener Material-PG? (Regel „Glatt N = PG N"; Curve/107 unterscheiden nur
 * PG1 vs. PG2-4; Line & Glossy/Less sind PG-unabhängig → kein Filter.)
 */
export function expectedVariantPg(styleLine: StyleLineId, pg: PriceGroup | undefined): string | null {
  if (styleLine === 'glatt') return pg ?? null
  if (styleLine === 'curve' || styleLine === '107') return pg === 'PG1' ? 'PG1' : 'PG2-4'
  return null
}

/** Prüft, ob eine Preiszeile für die gegebene Serie gilt (`['*']` = alle). */
export function priceRowMatchesProgram(row: PriceRow, programId: string | undefined): boolean {
  if (!programId) return true
  if (!row.programs) return false
  return row.programs.includes('*') || row.programs.includes(programId)
}

// Schneller Zugriff per row.id (für gespeicherte Preispositionen / Demo-Entwürfe).
const rowsById = new Map<number, PriceRow>(priceRows.map((row) => [row.id, row]))

/** Preiszeile per id (aus `priceList.json`). */
export function getPriceRowById(id: number): PriceRow | undefined {
  return rowsById.get(id)
}
