/**
 * RASTER-LOGIK — Umrechnung zwischen Zentimetern und Rastern.
 *
 * Berater und Kunde denken in Zentimetern, die Preisliste ist auf Raster geschlüsselt.
 * Die Umrechnung ist eine FORMEL, keine Nachschlagetabelle:
 *
 *     Fronthöhe    H = R × 128 mm − 3 mm           (in allen Programmen identisch)
 *     Korpushöhe   H = R × 128 mm + Offset(Serie)  Atrium 52 · Velare 37 · Publicum 52 · Refugium 46
 *
 * Alle drei Konstanten stehen im Blatt „50 Meta" bzw. `meta.korpusOffsetMm` — sie sind
 * hier nicht mehr hinterlegt.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WARUM GANZZAHLIGE MILLIMETER?
 *
 * `Math.ceil()` auf Fließkommazahlen greift an exakten Rastermaßen daneben:
 *
 *     (153.3 + 0.3) / 12.8  →  12.000000000000002  →  Math.ceil → 13   FALSCH
 *     (158.8 - 5.2) / 12.8  →  12.000000000000002  →  Math.ceil → 13   FALSCH
 *     (81.4  - 4.6) / 12.8  →   6.000000000000001  →  Math.ceil →  7   FALSCH
 *
 * Über alle Programme und Raster 1–21 sind das genau fünf Stellen. An allen übrigen
 * liefert die Fließkomma-Rechnung zufällig das Richtige — ein Test, der nur 18 R prüft,
 * findet den Fehler NIE. Im Betrieb wäre jedes Möbel dieser Höhen still eine Rasterstufe
 * zu teuer. Deshalb wird ausschließlich in ganzzahligen Millimetern gerechnet; die
 * Aufwärts-Division läuft über `Math.floor((a + b - 1) / b)` ohne echte Division.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { meta } from '../data/stammdaten.generated.ts'

/** Ein Raster in Millimetern (12,8 cm) — Blatt „50 Meta", Schlüssel `rasterMm`. */
export const RASTER_MM = meta.rasterMm

/** Fronthöhen-Offset in Millimetern (−0,3 cm) — Schlüssel `frontOffsetMm`. */
export const FRONT_OFFSET_MM = meta.frontOffsetMm

/** Korpushöhen-Offset einer Serie in Millimetern; unbekannte Serie ⇒ `null`. */
export function korpusOffsetMm(serieId: string | undefined): number | null {
  if (!serieId) return null
  const offsets: Record<string, number> = meta.korpusOffsetMm
  return offsets[serieId] ?? null
}

/** cm → ganzzahlige Millimeter (kaufmännisch gerundet). */
export function cmToMm(cm: number): number {
  return Math.round(cm * 10)
}

/** Ganzzahlige Millimeter → cm mit einer Nachkommastelle. */
export function mmToCm(mm: number): number {
  return Math.round(mm) / 10
}

/** Ganzzahlige Aufwärts-Division ohne Fließkomma-Risiko (a, b > 0). */
function ceilDiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b)
}

/**
 * Rasterstufe für eine Höhe — aufgerundet auf das nächstgrößere Raster.
 * Das ist die Preislisten-Regel „Preis des nächstgrößeren Maßes" in exakter Form.
 */
export function rasterFuerHoehe(hoeheCm: number, offsetMm: number): number {
  const mm = cmToMm(hoeheCm) - offsetMm
  if (mm <= 0) return 1
  return ceilDiv(mm, RASTER_MM)
}

/** Rasterstufe für eine FRONT-Höhe (Offset −0,3 cm, alle Programme). */
export function frontRaster(hoeheCm: number): number {
  return rasterFuerHoehe(hoeheCm, FRONT_OFFSET_MM)
}

/** Höhe (cm) zu einer Rasterstufe — die Formel in Vorwärtsrichtung. */
export function hoeheFuerRaster(raster: number, offsetMm: number): number {
  return mmToCm(raster * RASTER_MM + offsetMm)
}

/** true, wenn die Höhe exakt auf einer Rasterstufe liegt (kein Sondermaß). */
export function istExaktesRastermass(hoeheCm: number, offsetMm: number): boolean {
  const mm = cmToMm(hoeheCm) - offsetMm
  return mm > 0 && mm % RASTER_MM === 0
}

/**
 * Hebt eine Rasterstufe auf die nächste TATSÄCHLICH bepreiste Stufe an. Die
 * Drehtüren-Tabelle kennt z. B. nur 4, 6, 8, 9, 15 und 18 Raster, der Refugium-Korpus
 * nur 18 und 21.
 *
 * @returns nächstgrößere verfügbare Stufe oder `null`, wenn die Höhe über der größten
 *          bepreisten Stufe liegt (⇒ Sondermaß, AV-Prüfung).
 */
export function aufVerfuegbaresRaster(raster: number, verfuegbar: readonly number[]): number | null {
  return [...verfuegbar].sort((a, b) => a - b).find((r) => r >= raster) ?? null
}

/** Vollständige Auflösung einer Höhe — inklusive Sondermaß- und Anhebungs-Erkennung. */
export interface RasterAufloesung {
  /** Eingegebene Höhe (cm). */
  eingabeCm: number
  /** Rechnerische Rasterstufe (aufgerundet). */
  raster: number
  /** Tatsächlich bepreiste Stufe. */
  bepreistesRaster: number | null
  /** Höhe (cm), die der bepreisten Stufe entspricht. */
  bepreisteHoeheCm: number | null
  /** true, wenn die Eingabe kein exaktes Rastermaß ist. */
  istSondermass: boolean
  /** true, wenn wegen fehlender Zwischenstufen zusätzlich angehoben wurde. */
  angehoben: boolean
}

export function loeseRasterAuf(
  hoeheCm: number,
  offsetMm: number,
  verfuegbar?: readonly number[],
): RasterAufloesung {
  const raster = rasterFuerHoehe(hoeheCm, offsetMm)
  const bepreistesRaster =
    verfuegbar && verfuegbar.length > 0 ? aufVerfuegbaresRaster(raster, verfuegbar) : raster
  return {
    eingabeCm: hoeheCm,
    raster,
    bepreistesRaster,
    bepreisteHoeheCm: bepreistesRaster == null ? null : hoeheFuerRaster(bepreistesRaster, offsetMm),
    istSondermass: !istExaktesRastermass(hoeheCm, offsetMm),
    angehoben: bepreistesRaster != null && bepreistesRaster !== raster,
  }
}
