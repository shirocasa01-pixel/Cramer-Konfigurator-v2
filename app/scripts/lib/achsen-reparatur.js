/**
 * ACHSENWERT-REPARATUR — ein belegter Extraktionsfehler in „20 Preise".
 *
 * Befund: 17 Preiszeilen tragen in der Achse `RASTER` den Wert `"5"`. Über die Spalte
 * `Ref` lassen sich alle 17 auf ihre Zeile in der Vorgänger-Extraktion zurückführen —
 * dort heißen sie:
 *
 *     20-20-20-0001  Schublade        11 Zeilen  ← „Mittlerer Schub 1,5R"      ⇒  1,5
 *     40-40-15-0001  Innenschublade    3 Zeilen  ← „Innenschublade 1,5 Raster" ⇒  1,5
 *     40-40-20-0019  Container         3 Zeilen  ← „Container 4,5R"            ⇒  4,5
 *
 * Es ist also durchgängig alles VOR dem Komma verlorengegangen. Die Ziffer allein ist
 * mehrdeutig — „5" steht einmal für 1,5 und einmal für 4,5 —, eine pauschale Ersetzung
 * wäre falsch. Deshalb je Artikel eine eigene Regel.
 *
 * Warum das zählt: derselbe Artikel führt beide Schreibweisen (110 Zeilen als „1.5",
 * 11 als „5"). Eine Abfrage auf 1,5 Raster findet die „5"-Zeilen nicht und liefert
 * „auf Anfrage" — der Fehler fällt niemandem auf, bis ein Angebot unvollständig ist.
 *
 * Die Tabelle ist die einzige Quelle für beide Verwender:
 *   • `scripts/fix-preisachsen.js` schreibt die Korrektur dauerhaft in die Mappe
 *   • `scripts/build-stammdaten.js` wendet sie beim Erzeugen an, solange das nicht geschehen ist
 *
 * Sie ist damit selbst-erledigend: ist die Mappe korrigiert, greift keine Regel mehr und
 * der Generator meldet das. Dann kann diese Datei ersatzlos entfallen.
 */

/**
 * @typedef {Object} Reparatur
 * @property {string} artikel   Artikelnummer
 * @property {string} achse     Achsen-Code (Spalte laut `Artikel.achsen`)
 * @property {string} falsch    fehlerhafter Zellwert
 * @property {string} richtig   korrigierter Zellwert
 * @property {string} beleg     Herkunft der Korrektur
 */

/** @type {Reparatur[]} */
export const ACHSEN_REPARATUREN = [
  {
    artikel: '20-009-0001',
    achse: 'RASTER',
    falsch: '5',
    richtig: '1.5',
    beleg: 'Ref → „Mittlerer Schub 1,5R" (Preisliste S. 11)',
  },
  {
    artikel: '40-016-0001',
    achse: 'RASTER',
    falsch: '5',
    richtig: '1.5',
    beleg: 'Ref → „Innenschublade 1,5 Raster - Glatt1 Decoboard" (S. 26)',
  },
  {
    artikel: '40-017-0019',
    achse: 'RASTER',
    falsch: '5',
    richtig: '4.5',
    beleg: 'Ref → „Container 4,5R - B47,5/57,5/97cm T50cm, 3 Schubladen" (S. 26)',
  },
]

/**
 * Liefert die Korrektur für einen Zellwert, oder `null`, wenn nichts zu tun ist.
 *
 * @param {string} artikel   Artikelnummer der Preiszeile
 * @param {string} achse     Achsen-Code der Spalte
 * @param {string} wert      aktueller Zellwert
 * @returns {Reparatur | null}
 */
export function findeReparatur(artikel, achse, wert) {
  return (
    ACHSEN_REPARATUREN.find((r) => r.artikel === artikel && r.achse === achse && r.falsch === wert) ?? null
  )
}
