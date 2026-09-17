/**
 * WERTELISTEN-BLÄTTER SCHREIBEN — „34 Preislogiken", „35 Achsen" und Verwandte.
 *
 * Diese Blätter sind kurze, vollständig bekannte Aufzählungen. Sie werden deshalb nicht
 * zeilenweise gepflegt, sondern in einem Zug neu geschrieben: vorhandene Zeilen
 * überschrieben, überzählige geleert, fehlende angehängt. Eine geleerte Zeile fällt aus
 * `readTable()` heraus, weil dort jede Zelle leer ist — Löschen braucht es nicht.
 *
 * Gemeinsam genutzt von `migrate-achsen-reform.js` und `migrate-varianten-artikel.js`:
 * Beide dürfen den Achsen-Katalog schreiben, und zwei Fassungen derselben Schleife wären
 * zwei Gelegenheiten, ihn unterschiedlich zu schreiben.
 */

import { appendRow, setOrCreateCellString } from './xlsx-raw.js'

/**
 * @param {object} blatt        Ergebnis von `editSheet()`
 * @param {object} tab          Ergebnis von `readTable()` desselben Blattes
 * @param {Array<{code: string, bedeutung: string, art?: string}>} eintraege
 * @param {string[]} spalten    Spaltennamen für code und bedeutung, in dieser Reihenfolge
 * @param {string} [zusatzSpalte] Optionale dritte Spalte (z. B. „Art"); wird bei Bedarf angelegt
 */
export function schreibeWerteliste(blatt, tab, eintraege, spalten, zusatzSpalte) {
  const ersteZeile = 2
  const spaltenRefs = spalten.map((n) => tab.header.get(n))
  let zusatzRef = zusatzSpalte ? tab.header.get(zusatzSpalte) : undefined
  if (zusatzSpalte && !zusatzRef) {
    // Neue Spalte direkt rechts neben der letzten bekannten anlegen.
    const letzte = [...tab.header.values()].sort()[tab.header.size - 1]
    zusatzRef = String.fromCharCode(letzte.charCodeAt(0) + 1)
    setOrCreateCellString(blatt, `${zusatzRef}1`, zusatzSpalte)
  }

  eintraege.forEach((eintrag, i) => {
    const werte = [eintrag.code, eintrag.bedeutung]
    if (i < tab.rows.length) {
      const zeile = ersteZeile + i
      spaltenRefs.forEach((ref, j) => setOrCreateCellString(blatt, `${ref}${zeile}`, werte[j]))
      if (zusatzRef) setOrCreateCellString(blatt, `${zusatzRef}${zeile}`, eintrag.art ?? '')
      return
    }
    const neu = {}
    spaltenRefs.forEach((ref, j) => { neu[ref] = werte[j] })
    if (zusatzRef && eintrag.art) neu[zusatzRef] = eintrag.art
    appendRow(blatt, neu)
  })

  for (let i = eintraege.length; i < tab.rows.length; i++) {
    const zeile = ersteZeile + i
    for (const ref of [...spaltenRefs, zusatzRef].filter(Boolean)) {
      setOrCreateCellString(blatt, `${ref}${zeile}`, '')
    }
  }
}
