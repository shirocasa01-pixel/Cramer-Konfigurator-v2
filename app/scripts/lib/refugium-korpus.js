/**
 * REFUGIUM-KORPUS → BREITE × RASTER × TIEFE × PG  (fachliche Einzelquelle)
 *
 * Der Refugium-Korpus trug bisher nur BREITE × RASTER: sechs Preiszeilen, ein Material
 * (Decoboard), eine Tiefe. Diese Datei beschreibt, womit er gefüllt wird — sie wird
 * ausschließlich von der Migration gelesen, nie vom Produktivcode. Nach dem Lauf ist
 * jeder Korpuspreis ein Stammdatum wie jedes andere.
 *
 * DREI REGELN, jede mit ihrer Quelle:
 *
 *   1. TIEFE wird zur eigenen Achse — 31 · 41 · 60 cm. Auch für Decoboard werden
 *      DREI getrennte Zeilen je Breite/Raster geschrieben, obwohl der Betrag heute
 *      identisch ist. Vorgabe: „Trotzdem drei separate Preiszeilen speichern, damit
 *      eine spätere Preisdifferenzierung ohne Strukturänderung möglich ist."
 *
 *   2. PG 1 = Decoboard = der GEDRUCKTE Refugium-Preis (Preisliste S. 26). Er gilt
 *      unverändert für alle drei Tiefen.
 *
 *   3. PG 2–4 = die Atrium-Korpuspreise derselben Breite, desselben Rasters und
 *      derselben Tiefe (Preisliste S. 13 / 14 / 15). Vorgabe: „Wenn die gewählte
 *      Innenausführung nicht Decoboard ist, sollen für Korpus und Seiten die
 *      entsprechenden Preise aus der Atrium-Preisliste übernommen werden."
 *
 * WOHER DIE ATRIUM-ZAHLEN STAMMEN
 * Nicht aus dem Artikelstamm: Der dort geführte Atrium-Korpus `10-001-0001` trägt in
 * der Mappe den ausdrücklichen Vorbehalt, die Haupttabellen hätten „aus dem
 * linearisierten PDF-Text nicht mit Sicherheit Zeile-für-Zeile den Korpusgrößen
 * zugeordnet werden" können — und tatsächlich sind seine Rasterstufen verschoben.
 * Die Werte unten sind deshalb koordinatenbasiert aus der gelieferten Preislisten-PDF
 * gelesen und Zelle für Zelle gegen das Seitenbild geprüft (240 von 240).
 */

/** Tiefenstufen der Preisliste, aufsteigend — zugleich die Achsenwerte. */
export const TIEFEN = ['31', '41', '60']

/** Breiten des Refugium-Korpus, wie sie im Stamm geschrieben stehen. */
export const BREITEN = ['50er', '60er', '100er']

/**
 * Die zusätzliche Bauteilseite („Seite (2,0 cm)" in der Atrium-Tabelle).
 *
 * In der Atrium-Preisliste ist sie die vierte SPALTE derselben Korpustabelle, und
 * genau so führt der Stamm sie auch: als Breitenwert des Korpus-Artikels. Deshalb
 * wandert sie hier ebenfalls als Breitenwert in den Refugium-Korpus und nicht in
 * einen eigenen Artikel.
 *
 * Sie wird von der Kalkulation VORERST NICHT gezogen — die Refugium-Mittelseite
 * (`10-002-0001`) und das Abschlussset (`10-003-0001`) bleiben unverändert. Die
 * Zeilen stehen bereit, sobald Cramer entscheidet, ob die Mittelseite künftig von
 * hier bepreist wird (offene Frage im Bericht).
 *
 * Für den Lookup ist der Wert ungefährlich: `parseBreite()` ordnet „Seite" bei 2 cm
 * ein, und die Nächstgrößer-Regel wählt für jede Korpusbreite ≥ 15 cm niemals ihn.
 */
export const SEITE_BREITE = 'Seite'

/**
 * Aufschlag für Sonderhöhen bis einschließlich 21 Raster: „Preis Sonderhöhe =
 * Preis 18 Raster × 1,20".
 *
 * Gilt hier NUR für PG 2–4: Für PG 1 druckt die Refugium-Preisliste eigene
 * 21-Raster-Preise (285 / 309 / 372 €). Ein gedruckter Preis wird nicht durch einen
 * gerechneten ersetzt — 237 × 1,20 ergäbe 284,40 € statt der gedruckten 285 €.
 * Die Atrium-Tabellen enden dagegen bei 18 Rastern; dort ist die Regel die einzige
 * Quelle für 21 Raster.
 */
export const SONDERHOEHE_FAKTOR = 1.2

/** Rasterstufen des Refugium-Korpus. */
export const RASTER_STANDARD = 18
export const RASTER_SONDER = 21

/** Preisgruppen in der Reihenfolge, in der die Zeilen entstehen. */
export const PG_STUFEN = ['PG1', 'PG2', 'PG3', 'PG4']

/** Rundung wie im Konfigurator (`runde2` in src/lib/kalkulation.ts). */
export function runde2(n) {
  return Math.round(n * 100) / 100
}

/**
 * ATRIUM-KORPUSPREISE, Preisliste S. 13 / 14 / 15.
 *
 *   ATRIUM[tiefe][breite][raster][preisgruppe] → EUR
 *
 * Vollständig übernommen, auch die Raster 4 / 6 / 8 / 14, die Refugium heute nicht
 * führt: Die Tabelle ist damit der komplette, prüfbare Abzug der drei Seiten — und
 * eine spätere Rasterstufe kostet keine erneute Erfassung.
 *
 * ZWEI GEDRUCKTE AUFFÄLLIGKEITEN, bewusst unverändert übernommen (sie stehen so in
 * der Preisliste; „keine Preise schätzen"):
 *   • 41 cm · 8 Raster · 50er · PG 2 = 248 € — zwischen PG 1 (243 €) und PG 3 (404 €)
 *     ungewöhnlich niedrig.
 *   • 60 cm · 18 Raster · 60er · PG 2 = 656 € — gegenüber 50er (639 €) nur knapp höher.
 */
export const ATRIUM = {
  // Preisliste S. 13 — „Korpi 31cm tief"
  '31': {
    '50er': {
      4: { PG1: 171, PG2: 215, PG3: 284, PG4: 337 },
      6: { PG1: 188, PG2: 243, PG3: 308, PG4: 368 },
      8: { PG1: 221, PG2: 287, PG3: 367, PG4: 445 },
      14: { PG1: 216, PG2: 271, PG3: 339, PG4: 402 },
      18: { PG1: 345, PG2: 455, PG3: 584, PG4: 721 },
    },
    '60er': {
      4: { PG1: 179, PG2: 233, PG3: 296, PG4: 355 },
      6: { PG1: 197, PG2: 257, PG3: 328, PG4: 397 },
      8: { PG1: 231, PG2: 305, PG3: 389, PG4: 473 },
      14: { PG1: 228, PG2: 286, PG3: 357, PG4: 425 },
      18: { PG1: 364, PG2: 488, PG3: 626, PG4: 776 },
    },
    '100er': {
      4: { PG1: 256, PG2: 330, PG3: 421, PG4: 497 },
      6: { PG1: 272, PG2: 357, PG3: 457, PG4: 545 },
      8: { PG1: 320, PG2: 420, PG3: 541, PG4: 650 },
      14: { PG1: 318, PG2: 396, PG3: 496, PG4: 584 },
      18: { PG1: 497, PG2: 663, PG3: 776, PG4: 1060 },
    },
    'Seite': {
      4: { PG1: 48, PG2: 60, PG3: 75, PG4: 93 },
      6: { PG1: 60, PG2: 77, PG3: 95, PG4: 119 },
      8: { PG1: 74, PG2: 92, PG3: 116, PG4: 144 },
      14: { PG1: 70, PG2: 87, PG3: 109, PG4: 136 },
      18: { PG1: 126, PG2: 159, PG3: 198, PG4: 248 },
    },
  },
  // Preisliste S. 14 — „Korpi 41cm tief"
  '41': {
    '50er': {
      4: { PG1: 189, PG2: 245, PG3: 311, PG4: 371 },
      6: { PG1: 206, PG2: 267, PG3: 339, PG4: 406 },
      8: { PG1: 243, PG2: 248, PG3: 404, PG4: 491 },
      14: { PG1: 333, PG2: 438, PG3: 557, PG4: 686 },
      18: { PG1: 390, PG2: 512, PG3: 655, PG4: 809 },
    },
    '60er': {
      4: { PG1: 198, PG2: 257, PG3: 326, PG4: 392 },
      6: { PG1: 218, PG2: 284, PG3: 361, PG4: 437 },
      8: { PG1: 258, PG2: 338, PG3: 430, PG4: 524 },
      14: { PG1: 355, PG2: 468, PG3: 599, PG4: 737 },
      18: { PG1: 417, PG2: 551, PG3: 704, PG4: 874 },
    },
    '100er': {
      4: { PG1: 280, PG2: 362, PG3: 460, PG4: 547 },
      6: { PG1: 330, PG2: 392, PG3: 499, PG4: 598 },
      8: { PG1: 355, PG2: 464, PG3: 595, PG4: 658 },
      14: { PG1: 484, PG2: 638, PG3: 820, PG4: 1009 },
      18: { PG1: 562, PG2: 743, PG3: 956, PG4: 1184 },
    },
    'Seite': {
      4: { PG1: 54, PG2: 68, PG3: 84, PG4: 105 },
      6: { PG1: 69, PG2: 86, PG3: 107, PG4: 134 },
      8: { PG1: 83, PG2: 102, PG3: 129, PG4: 161 },
      14: { PG1: 119, PG2: 149, PG3: 185, PG4: 231 },
      18: { PG1: 146, PG2: 182, PG3: 227, PG4: 284 },
    },
  },
  // Preisliste S. 15 — „Korpi 60cm tief"
  '60': {
    '50er': {
      4: { PG1: 236, PG2: 303, PG3: 384, PG4: 456 },
      6: { PG1: 257, PG2: 330, PG3: 417, PG4: 498 },
      8: { PG1: 276, PG2: 393, PG3: 482, PG4: 606 },
      14: { PG1: 423, PG2: 548, PG3: 695, PG4: 852 },
      18: { PG1: 492, PG2: 639, PG3: 813, PG4: 1001 },
    },
    '60er': {
      4: { PG1: 249, PG2: 320, PG3: 404, PG4: 483 },
      6: { PG1: 272, PG2: 350, PG3: 443, PG4: 536 },
      8: { PG1: 323, PG2: 419, PG3: 531, PG4: 645 },
      14: { PG1: 447, PG2: 584, PG3: 741, PG4: 911 },
      18: { PG1: 524, PG2: 656, PG3: 870, PG4: 1074 },
    },
    '100er': {
      4: { PG1: 353, PG2: 450, PG3: 572, PG4: 678 },
      6: { PG1: 375, PG2: 486, PG3: 617, PG4: 737 },
      8: { PG1: 447, PG2: 579, PG3: 738, PG4: 890 },
      14: { PG1: 614, PG2: 801, PG3: 1023, PG4: 1254 },
      18: { PG1: 711, PG2: 929, PG3: 1190, PG4: 1467 },
    },
    'Seite': {
      4: { PG1: 65, PG2: 81, PG3: 101, PG4: 126 },
      6: { PG1: 55, PG2: 69, PG3: 86, PG4: 108 },
      8: { PG1: 101, PG2: 126, PG3: 158, PG4: 197 },
      14: { PG1: 149, PG2: 186, PG3: 231, PG4: 290 },
      18: { PG1: 182, PG2: 227, PG3: 284, PG4: 354 },
    },
  },}

/**
 * GEDRUCKTE REFUGIUM-KORPUSPREISE (Preisliste S. 26) — die PG-1-Grundlage.
 *
 * Sie werden aus dem Artikelstamm gelesen, nicht hier hinterlegt: Die sechs Zeilen
 * stehen bereits in der Mappe, und eine zweite Fassung im Code wäre die sichere
 * Quelle für stille Abweichungen. Diese Konstante nennt nur den Artikel.
 */
export const REFUGIUM_KORPUS_ARTIKEL = '10-001-0003'
