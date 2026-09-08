/**
 * Build-Zeit-Anteil der Modus-Verarbeitung: die Serien-Kürzel aus der Mappe lesen.
 *
 * Die eigentliche Interpretationslogik steht bewusst NICHT hier, sondern in
 * `src/lib/modus.ts` — dieselbe Implementierung, die auch im Browser läuft.
 * Node entfernt die Typen beim Import selbst (Type Stripping, ab Node 22.18/23.6),
 * es gibt also keine zweite Fassung, die auseinanderlaufen könnte.
 */

export { normalizeModus, parseModus, modusErlaubt, istSonderanfertigung } from '../../src/lib/modus.ts'

/**
 * Liest die Serien-Kürzel aus dem Blatt „30 Programme" — die einzige Quelle der Wahrheit.
 * Kein hartcodiertes Alphabet: kommt eine Serie dazu, reicht eine neue Zeile in der Mappe.
 *
 * @param {Array<Record<string, string>>} rows  Zeilen von „30 Programme"
 * @returns {Map<string, {code: string, id: string, name: string, focus: string, position: number}>}
 */
export function readProgramCodes(rows) {
  const codes = new Map()
  for (const row of rows) {
    const code = (row['Code'] ?? '').trim().toUpperCase()
    if (!code) continue
    if (code.length !== 1 || !/[A-Z]/.test(code)) {
      throw new Error(`"30 Programme" Zeile ${row._row}: Code "${row['Code']}" ist kein einzelner Buchstabe.`)
    }
    if (codes.has(code)) {
      throw new Error(`"30 Programme": Code "${code}" doppelt vergeben (Zeile ${row._row}).`)
    }
    codes.set(code, {
      code,
      id: (row['ID'] ?? '').trim(),
      name: (row['Programm'] ?? '').trim(),
      focus: (row['Schwerpunkt'] ?? '').trim(),
      position: Number(row['Position im Modus']) || codes.size + 1,
    })
  }
  if (codes.size === 0) throw new Error('"30 Programme" enthält keine Serien-Codes.')
  return codes
}
