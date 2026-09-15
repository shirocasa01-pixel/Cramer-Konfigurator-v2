/**
 * REFUGIUM-INNENAUSSTATTUNG → PREISGRUPPEN  (fachliche Einzelquelle)
 *
 * Bis hierher kannte das Preisblatt für die Refugium-Innenausstattung nur EINEN Preis.
 * Dietmar Cramer, Überarbeitung 6: „Wir fertigen ja 90 % unserer Kleiderschränke innen
 * in Decoboard. Daher ist die Preisliste auch nur auf Decoboard (Preisgruppe 1)
 * aufgebaut. Es gibt bei den Kleiderschränken keine Preise für die Preisgruppen 2–4.
 * Das wollen wir nun anpassen. […] Wenn ihr von mir keine Info bekommt, ist nur der
 * Preis in der Preisgruppe 1 relevant."
 *
 * Diese Datei ist die EINZIGE Stelle, an der steht, WELCHE Artikel betroffen sind und
 * WARUM. Sie wird nur von der Migration gelesen, nie vom Produktivcode: nach dem Lauf
 * sind die Preise Stammdaten wie alle anderen, und der Konfigurator schlägt sie über
 * die vorhandene PG-Achse nach. Die Prozentsätze unten sind damit ein einmaliges
 * Rechenwerkzeug — kein Laufzeit-Aufschlag.
 *
 * WARUM ÜBERHAUPT EINE LISTE UND KEINE REGEL?
 * Eine Regel wie „alles unter INNENAUSSTATTUNG mit Modus R" träfe auch Teile, für die
 * Cramer ausdrücklich KEINE Angabe gemacht hat — und seine Regel lautet: ohne Angabe
 * bleibt es bei PG 1. Geraten wird hier nichts.
 */

/**
 * Aufschlagsfaktoren, seitengleich auf allen sechs annotierten Seiten der
 * Überarbeitung 6 (S. 2, 3, 4, 9, 10, 11):
 *
 *   „Aufpreis Preisgruppe 1 zur Preisgruppe 2 = 30 %
 *    Aufpreis Preisgruppe 1 zur Preisgruppe 3 = 40 %
 *    Aufpreis Preisgruppe 1 zur Preisgruppe 4 = 50 %"
 */
export const PG_FAKTOREN = Object.freeze({
  PG1: 1.0,
  PG2: 1.3,
  PG3: 1.4,
  PG4: 1.5,
})

/** Reihenfolge, in der die Zeilen angelegt werden. */
export const PG_STUFEN = ['PG1', 'PG2', 'PG3', 'PG4']

/**
 * Rundung wie im Konfigurator (`runde2` in src/lib/kalkulation.ts): zwei Nachkommastellen,
 * kaufmännisch. Bewusst dieselbe Formel, damit ein migrierter Preis und ein gerechneter
 * Preis nie um einen Cent auseinanderlaufen.
 */
export function runde2(n) {
  return Math.round(n * 100) / 100
}

/**
 * BETROFFENE ARTIKEL — neue Artikelnummer (XX-XXX-XXXX) → Begründung.
 *
 * Zwei unabhängige Belege, die sich decken:
 *   • „Ü6 S. n"  — Dietmar Cramer hat diese Position im PDF ausdrücklich annotiert.
 *   • „Oberfläche=J" — die Mappe selbst führt den Artikel in Spalte R als
 *     material-/farbabhängig. Genau diese Artikel und keine anderen.
 */
export const BETROFFENE_ARTIKEL = Object.freeze({
  '40-014-0003': 'Rollboden — Ü6 S. 2 („Aufpreis für Rollboden in weiteren Preisgruppen")',
  '40-016-0001': 'Innenschublade — Ü6 S. 3 („Aufpreis für Innenschubladen …")',
  '40-017-0001': 'Container Conero A — Ü6 S. 11 („Aufpreis für Container …"), Oberfläche=J',
  '40-017-0002': 'Container Conero B — Ü6 S. 11, Oberfläche=J',
  '40-017-0003': 'Container Conero C — Ü6 S. 11, Oberfläche=J',
  '40-017-0004': 'Container Conero D — Ü6 S. 11, Oberfläche=J',
  '40-017-0005': 'Container Conero E — Ü6 S. 11, Oberfläche=J',
  '40-017-0006': 'Container Conero F — Ü6 S. 11, Oberfläche=J',
  '40-017-0015': 'Container Craft A — Ü6 S. 9 („Aufpreis für Container …"), Oberfläche=J',
  '40-017-0016': 'Container Craft B — Ü6 S. 9, Oberfläche=J',
  '40-017-0017': 'Container Craft C — Ü6 S. 9, Oberfläche=J',
  '40-023-0008': 'Hemdeinsatz Craft — Ü6 S. 10 („Aufpreis für Einsatz …"), Oberfläche=J',
  '40-023-0010': 'Rollboden mit Schuhablage Craft — Ü6 S. 10, Oberfläche=J',
  '40-023-0011': 'Schubladenunterteilung Craft — Ü6 S. 9 („Aufpreis für Unterteilungen …"), Oberfläche=J',
})

/**
 * AUSDRÜCKLICH NICHT MIGRIERT — offene fachliche Zuordnung.
 *
 * Diese Artikel wären plausible Kandidaten, sind aber nicht belegt. Sie bleiben bei
 * einem Preis (= PG 1) und stehen im Abschlussbericht als Rückfrage. Ein erfundener
 * Aufschlag wäre im Kundengespräch teurer als eine offene Frage.
 */
export const OFFENE_ZUORDNUNG = Object.freeze({
  '40-016-0002':
    'Rollkorb — Ü6 S. 4 zeigt im Bild den Rollkorb, die Überschrift darunter spricht aber von „Innenschubladen". Welche Position ist gemeint?',
  '40-017-0019':
    'Container (Basis, B47,5/57,5) — in Ü6 nicht annotiert, Spalte Oberfläche=N. Die Oberfläche im Konfigurator sagt jedoch „Material wie Innenkorpus". Gilt der Aufschlag auch hier?',
  '40-017-0018':
    'Aufpreis Container Deckplatte Rauchglas — nicht annotiert, führt im Stamm gar keine Achse und drei unbeschriftete Preiszeilen. Gilt der PG-Aufschlag auch auf den Aufpreis?',
})
