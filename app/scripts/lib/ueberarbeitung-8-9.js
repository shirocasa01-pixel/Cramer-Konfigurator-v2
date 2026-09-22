/**
 * ÜBERARBEITUNG 8 + 9 — fachliche Einzelquelle der Stammdaten-Migration.
 *
 * Wird ausschließlich von `scripts/migrate-ueberarbeitung-8-9.js` gelesen, nie vom
 * Produktivcode. Nach dem Lauf ist jeder Preis ein gewöhnliches Stammdatum, das Herr
 * Dietmann in der Mappe oder in der Verwaltung pflegen kann — der Konfigurator schlägt
 * nur noch nach, er rechnet keine Aufschläge.
 *
 * VIER ÄNDERUNGEN, jede mit ihrer Quelle:
 *
 *   1. MITTELSEITE (MIT-001) → HÖHE × TIEFE × PG
 *      Überarbeitung 8, S. 2: „Es muss aber auch der Preis der Mittelseite aus der
 *      Atriumliste verwendet werden. In dem Fall wäre das 227 € (PG2). (Statt Mittelseite
 *      steht bei Atrium Seite. Ist aber das gleiche.) Das gilt dann für alle Größen in
 *      PG 2 – PG4."
 *        PG 1   der gedruckte Refugium-Preis (S. 26), für alle drei Tiefen gleich —
 *               dieselbe Regel wie beim Korpus
 *        PG 2–4 Atrium „Seite (2,0 cm)" derselben Tiefe (S. 13 / 14 / 15)
 *        21 R   bei PG 2–4 der 18-Raster-Preis × 1,20 (S. 32, „Überhöhe bis 21R:
 *               Korpusse, Seiten und Fronten zzgl 20% auf den Preis des 18R Elementes")
 *
 *   2. EINLEGEBODEN (BOD-001) → BREITE × TIEFE × PG
 *      Überarbeitung 8, S. 5: „Wenn das Material nicht Decoboard (PG1) ist, müssen die
 *      Einlegebodenpreise in der Atrium Preisliste berücksichtigt werden. Siehe ‚Aufpreis
 *      für zusätzliche Böden' Seite 13 für Korpustiefe 31, Seite 14 bis 41, Seite 15 bis 60."
 *        PG 1   der gedruckte Refugium-Preis (S. 26), für alle drei Tiefen gleich
 *        PG 2–4 Atrium „Aufpreis für zusätzliche Böden" derselben Breite und Tiefe
 *
 *   3. KLEIDERSTANGE (KST-002) → eigener Baustein „Aufpreis zum Einlegeboden" à 15 €
 *      Überarbeitung 8, S. 5: „Wenn das Material nicht Decoboard (PG1) ist, muss auf die
 *      Einlegebodenpreise (siehe oben bei Einlegeboden) + 15 € berechnet werden."
 *      Der gedruckte Refugium-Preis bestätigt die Zerlegung: Kleiderstange mit Boden
 *      55 / 60 / 70 € = Einlegeboden 40 / 45 / 55 € + 15 €. Die Position „Einlegeboden
 *      inkl. Kleiderstange" setzt sich damit sichtbar aus zwei Stammdaten zusammen:
 *      Bodenpreis (BOD-001) + Kleiderstange (KST-002) — für alle Preisgruppen gleich.
 *
 *   4. DREHTÜR (DRT-001) → zusätzlich 21 Raster
 *      Überarbeitung 9, S. 1: „Wenn ich eine 21 Rastertüre konfiguriere bekomme ich keinen
 *      Preis." Die Drehtüren-Tabelle (S. 7) endet bei 18 Raster; S. 32 regelt die Überhöhe
 *      („… und Fronten zzgl 20% auf den Preis des 18R Elementes"). Die 1,20 dient nur
 *      dieser einmaligen Erzeugung — im Konfigurator steht danach eine fertige Preiszeile.
 *
 * Dazu ein Wert in „50 Meta": die Tiefenzugabe für die Kabelführung bei Beleuchtung
 * (Überarbeitung 8, S. 1: „Erhöht sich die Tiefe um + 1 cm").
 */

import { ATRIUM } from './refugium-korpus.js'

/** Tiefenstufen der Preisliste — zugleich die Achsenwerte der TIEFE-Achse. */
export const TIEFEN = ['31', '41', '60']

/** Seite der gedruckten Preisliste je Tiefe (Herkunftsnachweis an der Zeile). */
export const QUELLSEITE = { 31: 13, 41: 14, 60: 15 }

/** Preisgruppen in der Reihenfolge, in der die Zeilen entstehen. */
export const PG_STUFEN = ['PG1', 'PG2', 'PG3', 'PG4']

/** Tiefe, mit der die vorhandenen Refugium-Zeilen gekennzeichnet werden (Standard). */
export const BESTANDS_TIEFE = '60'

/** Überhöhe bis 21 Raster: 18-Raster-Preis × 1,20 (Preisliste S. 32). */
export const UEBERHOEHE_FAKTOR = 1.2

/** Rundung wie im Konfigurator (`runde2` in src/lib/kalkulation.ts). */
export function runde2(n) {
  return Math.round(n * 100) / 100
}

// ---------------------------------------------------------------------------
// 1 — Mittelseite
// ---------------------------------------------------------------------------

export const MITTELSEITE = {
  kurzzeichen: 'MIT-001',
  /** Atrium „Seite (2,0 cm)", 18 Raster, je Tiefe und Preisgruppe — S. 13 / 14 / 15. */
  seite18R(tiefe, pg) {
    return ATRIUM[tiefe]?.Seite?.[18]?.[pg] ?? null
  },
  bemerkung:
    'Überarbeitung 8: PG 1 = Refugium-Mittelseite (Preisliste S. 26), für alle Tiefen gleich. ' +
    'PG 2–4 = Atrium „Seite (2,0 cm)" derselben Tiefe (S. 13 / 14 / 15); 21 R = 18 R × 1,20 ' +
    '(S. 32 „Überhöhe bis 21R"). Bei unterschiedlichen Innenmaterialien gilt die höchste ' +
    'Preisgruppe der Korpi.',
  quelle: 'S. 26 · S. 13–15',
}

// ---------------------------------------------------------------------------
// 2 — Einlegeboden
// ---------------------------------------------------------------------------

/**
 * ATRIUM „AUFPREIS FÜR ZUSÄTZLICHE BÖDEN" — Preisliste S. 13 / 14 / 15, unterste Tabelle.
 *
 *   ATRIUM_BOEDEN[tiefe][breite][pg] → EUR
 *
 * Aus der gelieferten PDF („Atrium für tiefenachse refugium.pdf") Zelle für Zelle
 * abgelesen. Die frühere Text-Extraktion (`src/data/priceList.json`) hatte hier Breite und
 * Preisgruppe vertauscht (40/45/55 als „PG1/PG2/PG3") — sie ist deshalb NICHT die Quelle.
 * Gegenprobe: Die 60-cm-Zeile PG 1 (40 / 45 / 55 €) stimmt exakt mit dem gedruckten
 * Refugium-Einlegeboden (S. 26) überein.
 */
export const ATRIUM_BOEDEN = {
  // S. 13 — „Korpi 31cm tief"
  31: {
    '50er': { PG1: 30, PG2: 40, PG3: 45, PG4: 50 },
    '60er': { PG1: 35, PG2: 45, PG3: 50, PG4: 55 },
    '100er': { PG1: 45, PG2: 55, PG3: 60, PG4: 65 },
  },
  // S. 14 — „Korpi 41cm tief"
  41: {
    '50er': { PG1: 35, PG2: 45, PG3: 50, PG4: 55 },
    '60er': { PG1: 40, PG2: 50, PG3: 55, PG4: 60 },
    '100er': { PG1: 50, PG2: 60, PG3: 65, PG4: 70 },
  },
  // S. 15 — „Korpi 60cm tief"
  60: {
    '50er': { PG1: 40, PG2: 50, PG3: 55, PG4: 60 },
    '60er': { PG1: 45, PG2: 55, PG3: 60, PG4: 65 },
    '100er': { PG1: 55, PG2: 65, PG3: 70, PG4: 75 },
  },
}

export const EINLEGEBODEN = {
  kurzzeichen: 'BOD-001',
  breiten: ['50er', '60er', '100er'],
  bemerkung:
    'Überarbeitung 8: Material = Innenkorpus, keine eigene Auswahl. PG 1 = Refugium-Preis ' +
    '(S. 26), für alle Tiefen gleich. PG 2–4 = Atrium „Aufpreis für zusätzliche Böden" ' +
    '(S. 13 bis 31 cm, S. 14 bis 41 cm, S. 15 bis 60 cm Korpustiefe). ' +
    'Fertigungsmaße: 50er = 49,5cm · 60er = 59,5cm · 100er = 98,8cm.',
  quelle: 'S. 26 · S. 13–15',
}

// ---------------------------------------------------------------------------
// 3 — Kleiderstange
// ---------------------------------------------------------------------------

export const KLEIDERSTANGE = {
  kurzzeichen: 'KST-002',
  bezeichnung: 'Kleiderstange - Aufpreis zum Einlegeboden, fest/verstellbar',
  /** „… + 15 € berechnet werden" — für jede Breite derselbe Betrag. */
  preis: 15,
  /** Die gedruckten Refugium-Preise vor der Zerlegung (S. 26) — nur zur Gegenprobe. */
  bisher: { '50er': 55, '60er': 60, '100er': 70 },
  bemerkung:
    'Überarbeitung 8: „Einlegeboden inkl. Kleiderstange" = Bodenpreis (BOD-001, Material wie ' +
    'Innenkorpus) + dieser Aufpreis. Gegenprobe Preisliste S. 26: 55 / 60 / 70 € = ' +
    '40 / 45 / 55 € Boden + 15 €. Chrom und Schwarz sind preisgleich.',
  /** Marker, an dem ein zweiter Lauf die bereits zerlegte Form erkennt. */
  marker: 'Aufpreis zum Einlegeboden',
}

// ---------------------------------------------------------------------------
// 4 — Drehtür 21 Raster
// ---------------------------------------------------------------------------

export const DREHTUER = {
  kurzzeichen: 'DRT-001',
  /** Etikett der 18-Raster-Stufe, von der abgeleitet wird. */
  quellRaster: '18R',
  /**
   * Höhenstufe 21 Raster: 21 × 12,8 cm − 0,3 cm = 268,5 cm (Fronthöhen-Formel, S. 16
   * „Effektive Frontmaße": 268,5 cm | 21).
   */
  zielStufe: '268,5 cm | 21R',
  bemerkung:
    'Überarbeitung 9: 21-Raster-Zeilen = 18-Raster-Preis × 1,20 (Preisliste S. 32 „Überhöhe ' +
    'bis 21R … Fronten zzgl 20% auf den Preis des 18R Elementes"). Fertige Preiszeilen, der ' +
    'Konfigurator rechnet nichts auf.',
}

// ---------------------------------------------------------------------------
// „50 Meta"
// ---------------------------------------------------------------------------

export const META_SCHLUESSEL = [
  {
    schluessel: 'beleuchtungTiefenzugabeMm',
    wert: '10',
    bedeutung:
      'Zusätzliche Korpustiefe (ohne Front) in mm, sobald eine Beleuchtung (LED-Band/Syncro) ' +
      'gewählt ist — Kabelführung zwischen Rückwand und Mauer. Nur Planungsmaß, keine Preisachse.',
  },
]
