/**
 * ÜBERARBEITUNG 9 (Nachtrag 10/2026) — fachliche Einzelquelle der Stammdaten-Migration.
 *
 * Wird ausschließlich von `scripts/migrate-ueberarbeitung-9-nachtrag.js` gelesen, nie vom
 * Produktivcode. Nach dem Lauf ist jeder Preis eine gewöhnliche Preiszeile, die in der
 * Mappe oder in der Stammdatenverwaltung gepflegt werden kann — der Konfigurator schlägt
 * nur nach und rechnet keine Aufschläge.
 *
 * Quelle: „Überarbeitung 9 - Cramer Planer.pdf" (Herr Dietmann) und die Ergänzungen dazu.
 */

/** Rundung wie im Konfigurator (`runde2` in src/lib/kalkulation.ts). */
export function runde2(n) {
  return Math.round(n * 100) / 100
}

/**
 * Aufpreis zur Preisgruppe 1 (PDF S. 2, 3 und 5, jeweils gleich):
 * „Aufpreis Preisgruppe 1 zur Preisgruppe 2 = 30 % · 3 = 40 % · 4 = 50 %".
 * Dieselben Faktoren wie bei Conero/Craft (scripts/lib/refugium-pg.js).
 */
export const PG_FAKTOREN = { PG1: 1, PG2: 1.3, PG3: 1.4, PG4: 1.5 }
export const PG_STUFEN = Object.keys(PG_FAKTOREN)

/** S. 1: „Led-Syncro Licht für 100er Korpus bitte auf VK = 400 € anpassen (405 € in der PL sind ein Tippfehler)". */
export const LED_SYNCRO = {
  kurzzeichen: 'LEU-008',
  stufe: '100 cm | 100er',
  alt: 405,
  neu: 400,
}

/**
 * S. 2: Basis-Container (CON-019 Decoboard, CON-029 Rauchglas) — neue Höhen 3 R und 7,5 R
 * plus Preisgruppen. „Die Preisgruppe des Containers wird immer vom Innenkorpus übernommen."
 *
 * Höhenetikett wie bei 4,5 R / 6 R: Raster × 12,8 cm − 0,3 cm Frontversatz
 * (`hoeheFuerRaster` in src/lib/raster.ts) → 3 R = 38,1 cm, 7,5 R = 95,7 cm.
 *
 * Rauchglas-Deckplatte: „Aufpreis für Container Deckplatte mit Rauchglasfüllung (wie bei
 * Craft): Korpus 50er 210 €, 60er 220 €, 100er 230 €" — die bestehenden 4,5-R/6-R-Zeilen von
 * CON-029 sind genau Decoboard + dieser Aufpreis. „Aufpreis Container Deckplatte in weiteren
 * Preisgruppen außer Decoboard (PG1)": dieselben +30/40/50 % auf den ganzen Container.
 */
export const BASIS_CONTAINER = {
  decoboard: 'CON-019',
  rauchglas: 'CON-029',
  breiten: ['50 cm | 50er', '60 cm | 60er', '100 cm | 100er'],
  hoehen: {
    '3R': '38,1 cm | 3R',
    '4,5R': '57,3 cm | 4,5R',
    '6R': '76,5 cm | 6R',
    '7,5R': '95,7 cm | 7,5R',
  },
  /** Decoboard, PG 1, je Breite 50/60/100er. 3 R und 7,5 R neu laut S. 2. */
  decoboardPg1: {
    '3R': [526, 552, 666],
    '4,5R': [711, 747, 896],
    '6R': [896, 942, 1126],
    '7,5R': [1081, 1137, 1356],
  },
  rauchglasAufpreis: [210, 220, 230],
  bemerkung:
    'Überarbeitung 9: Höhen 3 R / 4,5 R / 6 R / 7,5 R. Preisgruppe = Innenkorpus; PG 2/3/4 = PG 1 + 30/40/50 % ' +
    '(Container und Deckplatte). Fertigungsmaße: 50er = 49,5cm · 60er = 59,5cm · 100er = 98,8cm.',
}

/**
 * S. 5: Conero G und H — PG-Aufschläge wie bei Conero A–F (dort schon hinterlegt). G und H
 * führen die Achse PG bereits, aber nur mit PG 1.
 */
export const CONERO_GH = ['CON-007', 'CON-008', 'CON-009', 'CON-010', 'CON-011', 'CON-012', 'CON-013', 'CON-014']

/**
 * S. 5: „Außerdem muss es beim Conero H Container zum Anhaken sein, welche Variante geliefert
 * werden soll: 12 Hosenhalter · 6 Hosenhalter / 1 Wäschesack · 2 Wäschesäcke."
 * Die Mappe führte für H nur „12 Hosenhalter". Die beiden anderen Ausführungen entstehen nach
 * dem Muster von G (dort sind alle drei Ausführungen preisgleich): Preis wie H 12 Hosenhalter.
 */
export const CONERO_H_NEU = [
  {
    vorlage: 'CON-013',
    nummer: '40-40-20-0030',
    kurzzeichen: 'CON-030',
    bezeichnung: 'Container Conero H Rollboden+72H+Funktionsauszug 6 Hosenhalter/1 Waeschesack – Deckplatte Decoboard',
    sortierung: 131,
  },
  {
    vorlage: 'CON-014',
    nummer: '40-40-20-0031',
    kurzzeichen: 'CON-031',
    bezeichnung: 'Container Conero H Rollboden+72H+Funktionsauszug 6 Hosenhalter/1 Waeschesack – Deckplatte Rauchglas grau',
    sortierung: 141,
  },
  {
    vorlage: 'CON-013',
    nummer: '40-40-20-0032',
    kurzzeichen: 'CON-032',
    bezeichnung: 'Container Conero H Rollboden+72H+Funktionsauszug 2 Waeschesaecke – Deckplatte Decoboard',
    sortierung: 132,
  },
  {
    vorlage: 'CON-014',
    nummer: '40-40-20-0033',
    kurzzeichen: 'CON-033',
    bezeichnung: 'Container Conero H Rollboden+72H+Funktionsauszug 2 Waeschesaecke – Deckplatte Rauchglas grau',
    sortierung: 142,
  },
]
export const CONERO_H_BEMERKUNG =
  'Überarbeitung 9, S. 5: Ausführung beim Conero H wählbar; preisgleich mit „12 Hosenhalter" (wie bei Conero G). ' +
  'Nur im 100er Korpus. Fertigungsmaße: 100er = 98,8cm.'

/** S. 3: „Preise für Rollkörbe für Preisgruppe 2 bis 4 anpassen" — Rollkorb bekommt die Achse PG. */
export const ROLLKORB = {
  kurzzeichen: 'AZG-002',
  bemerkung: 'Überarbeitung 9, S. 3: Preisgruppe = Innenkorpus; PG 2/3/4 = PG 1 + 30/40/50 %. Keine Sonderbreiten.',
}

/**
 * Ergänzung zum PDF: „Raumteiler und Sichtrückwand … auf Entwurf setzen in der Stammdaten-
 * verwaltung, weil es selten genutzt wird." Die Abfrage erscheint im Konfigurator nur bei
 * aktivem Artikel.
 */
export const AUF_ENTWURF = [
  {
    kurzzeichen: 'ZUS-001',
    bemerkungZusatz:
      ' · Überarbeitung 9: auf „entwurf" (selten genutzt) — die Abfrage im Konfigurator erscheint erst, wenn der Artikel aktiv ist. Beim Kleiderschrank nie.',
  },
  {
    kurzzeichen: 'ZUS-004',
    bemerkungZusatz:
      ' · Überarbeitung 9: auf „entwurf" (selten genutzt) — die Abfrage im Konfigurator erscheint erst, wenn der Artikel aktiv ist.',
  },
]

/**
 * BREITENSTUFE „50/60er" (Craft) — Befund der Durchgriff-Prüfung zu Überarbeitung 9.
 *
 * Die Craft-Artikel führen eine gemeinsame Stufe für den 50er UND 60er Korpus. Ihre
 * Schwelle stand auf 50 cm („50 cm | 50/60er"); der Stufenpreis rundet auf die nächste
 * hinterlegte Stufe — ein 60er Korpus landete deshalb beim 80er-Preis (Schubladen-
 * unterteilung 201 statt 183 €, Container Craft A 60er 80er-Preis usw.). Die Schwelle
 * gehört auf 60 cm: dann gelten 50er und 60er, und erst darüber der 80er.
 */
export const BREITENSTUFE_50_60 = { alt: '50 cm | 50/60er', neu: '60 cm | 50/60er' }

/** S. 4: „Bitte bei der Schubladenunterteilung immer mit Preisgruppe 1 rechnen." */
export const SCHUBLADENUNTERTEILUNG = {
  kurzzeichen: 'ZUB-011',
  bemerkung:
    'Überarbeitung 9, S. 4: immer Preisgruppe 1 — die Unterteilung ist immer Decoboard Anthrazitgrau (passt zum Farbton der Schublade). ' +
    'Die Zeilen PG 2–4 bleiben stehen, werden vom Konfigurator aber nicht gezogen.',
}
