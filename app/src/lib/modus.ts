/**
 * SCHRITT 2 — Serien-Freigabe („Modus") lesen und prüfen.
 *
 * Ein Artikel trägt im Feld `Modus` die Kürzel der Serien, für die er freigegeben ist.
 * Diese Datei ist die **einzige** Stelle, an der Modus-Werte interpretiert werden — sowohl
 * zur Laufzeit im Konfigurator als auch beim Generieren der Stammdaten (`scripts/*.js`
 * importieren dieses Modul direkt; Node entfernt die Typen von sich aus).
 *
 * Bewusst maximal fehlertolerant, weil die Werte aus einer von Hand gepflegten Excel kommen:
 *
 *   `RP` · `R,P` · `R/P` · `R - P` · `_R_P_` · `p r`   → alle identisch: Refugium + Publicum
 *
 *   • Reihenfolge egal        — `RVP` ≡ `PVR` ≡ `VPR`
 *   • Trennzeichen egal       — alles außer A–Z wird ignoriert
 *   • Groß/klein egal (Match) — `r` findet `R`
 *
 * Die Schreibweise trägt trotzdem Bedeutung und bleibt deshalb erhalten (Blatt „00 Anleitung"):
 * GROSSBUCHSTABE = Standard · kleinbuchstabe = Sonderanfertigung, Preis auf Anfrage.
 * Für die Verfügbarkeits-Frage zählt beides als „verfügbar" — `istSonderanfertigung()`
 * unterscheidet, wo der Unterschied gebraucht wird.
 */

/** Ein Serien-Kürzel mit seiner kanonischen Position (aus Blatt „30 Programme"). */
export interface ModusCode {
  code: string
  position: number
}

/** Alles außer Buchstaben ist Kosmetik: `_`, `,`, `/`, `-`, Leerzeichen … */
function nurBuchstaben(raw: unknown): string {
  return String(raw ?? '').replace(/[^A-Za-z]/g, '')
}

/**
 * Steht der Artikel für diese Serie zur Verfügung?
 * Der Kern der Schritt-2-Anforderung — ein Buchstabe genügt, egal wo und wie geschrieben.
 */
export function modusErlaubt(modus: unknown, serienCode: string): boolean {
  const gesucht = nurBuchstaben(serienCode).toUpperCase()
  if (gesucht.length !== 1) return false
  return nurBuchstaben(modus).toUpperCase().includes(gesucht)
}

/**
 * Ist die Freigabe für diese Serie eine Sonderanfertigung (Kleinbuchstabe, Preis auf Anfrage)?
 * `false` heißt Standard **oder** gar nicht freigegeben — erst zusammen mit `modusErlaubt()`
 * aussagekräftig.
 */
export function istSonderanfertigung(modus: unknown, serienCode: string): boolean {
  const gesucht = nurBuchstaben(serienCode).toLowerCase()
  if (gesucht.length !== 1) return false
  return nurBuchstaben(modus).includes(gesucht)
}

/**
 * Die im Modus enthaltenen Serien-Kürzel — dedupliziert, unbekannte Zeichen verworfen,
 * in der Reihenfolge von `codes`.
 *
 * Generisch über die Kürzel-Liste: wird die generierte `SERIEN_CODES`-Tupel-Konstante
 * übergeben, ist das Ergebnis exakt `SerienCode[]` statt `string[]`.
 */
export function parseModus<T extends string>(modus: unknown, codes: readonly T[]): T[] {
  const vorhanden = new Set(nurBuchstaben(modus).toUpperCase())
  return codes.filter((code) => vorhanden.has(code.toUpperCase()))
}

/**
 * Bereinigt einen Modus-Wert zur kanonischen Buchstaben-Notation (`A_P_O_S__` → `APOS`).
 *
 * Erhält die Schreibweise des jeweils ersten Vorkommens, sortiert nach `position` und
 * meldet zurück, was dabei aufgefallen ist. Wird vom Bereinigungs-Script benutzt; zur
 * Laufzeit ist sie nützlich, um einen Wert anzuzeigen oder zu vergleichen.
 */
export function normalizeModus(
  raw: unknown,
  codes: ReadonlyMap<string, ModusCode>,
): { value: string; unknown: string[]; caseConflicts: string[] } {
  /** GROSSbuchstabe → tatsächlich übernommenes Zeichen */
  const kept = new Map<string, string>()
  const unknown: string[] = []
  const caseConflicts: string[] = []

  for (const ch of String(raw ?? '')) {
    if (!/[A-Za-z]/.test(ch)) continue
    const upper = ch.toUpperCase()
    if (!codes.has(upper)) {
      if (!unknown.includes(ch)) unknown.push(ch)
      continue
    }
    const bereits = kept.get(upper)
    if (bereits === undefined) kept.set(upper, ch)
    else if (bereits !== ch && !caseConflicts.includes(upper)) caseConflicts.push(upper)
  }

  const value = [...kept.entries()]
    .sort((a, b) => (codes.get(a[0])?.position ?? 0) - (codes.get(b[0])?.position ?? 0))
    .map(([, ch]) => ch)
    .join('')

  return { value, unknown, caseConflicts }
}
