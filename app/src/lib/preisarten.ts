/**
 * PREISARTEN — wie ein Artikel zu seinem Preis kommt.
 *
 * Bis 09/2026 kannte der Stamm drei Preislogiken (FESTPREIS · MATRIX · AUF_ANFRAGE). Was
 * eine Matrix tatsächlich rechnete, stand nirgends ausdrücklich: Es ergab sich aus den
 * Achsen und aus der Spalte PREISART der Preiszeilen. Seit der Überarbeitung der
 * Stammdatenverwaltung trägt jeder Artikel diese Rechenweise als eigene Preisart:
 *
 *   FESTPREIS          Festpreis             ein fest hinterlegter Preis
 *   MATRIX_STUFE       Matrix – Stufenpreis  Lookup über die Achsen, Maße gehen auf die
 *                                            nächste HINTERLEGTE Stufe (Korpus 55 cm → 60er)
 *   MATRIX_MASS        Matrix – Maßgenau     Lookup über die Achsen, Betrag je Einheit ×
 *                                            tatsächliches Maß (Verblendung 3,35 m × 75 €/m)
 *   FEST_PLUS_MATRIX   Festpreis + Matrix    Grundpreis + variabler Preis je Einheit
 *                                            (Wandsteckboden 75 € + 1,5 m × 180 €/m)
 *   AUFSCHLAG          Aufschlag             % oder € auf eine festgelegte Preisbasis
 *   AUF_ANFRAGE        Auf Anfrage           bewusst ohne automatischen Preis
 *
 * Die Zuordnung der bestehenden Artikel folgt genau dem, was die Engine vorher schon
 * rechnete (`leitePreisartAb`) — dieselben Zahlen, jetzt mit Namen. Es gibt KEINE
 * pauschale Aufrundung: Gerundet wird nur bei „Matrix – Stufenpreis" (und bei Festpreisen
 * mit Stufenachse, wie bisher), und zwar nur auf Stufen, die in den Preiszeilen stehen.
 * „Maßgenau" interpoliert nie zwischen Preiszeilen — die Berechnungsregel ist die
 * Bezugsgröße der Zeile (€/cm, €/m, €/m²).
 *
 * Diese Datei ist zugleich die Quelle für die Migration der Excel-Mappe
 * (`scripts/migrate-preisarten.js` importiert sie) — die Namen und Kurztexte stehen
 * danach im Blatt „34 Preislogiken" und sind dort pflegbar.
 */

import { PREISARTEN, parsePreisart, type Preisart } from './preisAchsen.ts'

/** Die sechs Preisarten, in der Reihenfolge, in der die Verwaltung sie anbietet. */
export const PREISART_CODES = [
  'FESTPREIS',
  'MATRIX_STUFE',
  'MATRIX_MASS',
  'FEST_PLUS_MATRIX',
  'AUFSCHLAG',
  'AUF_ANFRAGE',
] as const

export type PreisartCode = (typeof PREISART_CODES)[number]

/**
 * Anzeigename und Kurzerklärung. Die Verwaltung liest beides aus dem generierten
 * Blatt „34 Preislogiken"; diese Tabelle ist die Vorgabe, aus der die Migration das
 * Blatt schreibt, und der Rückfall für Codes, die dort (noch) fehlen.
 */
export const PREISART_KATALOG: Record<PreisartCode, { titel: string; kurz: string }> = {
  FESTPREIS: { titel: 'Festpreis', kurz: 'Ein fest hinterlegter Preis.' },
  MATRIX_STUFE: {
    titel: 'Matrix – Stufenpreis',
    kurz: 'Matrix – Lookup über die Achsen. Maße gehen auf die nächste hinterlegte Stufe.',
  },
  MATRIX_MASS: {
    titel: 'Matrix – Maßgenau',
    kurz: 'Matrix – Lookup über die Achsen. Betrag je Einheit × tatsächliches Maß, ohne Stufen.',
  },
  FEST_PLUS_MATRIX: {
    titel: 'Festpreis + Matrix',
    kurz: 'Fester Grundpreis plus variabler Matrixpreis, z. B. je laufendem Meter.',
  },
  AUFSCHLAG: {
    titel: 'Aufschlag',
    kurz: 'Prozentsatz oder Betrag auf eine festgelegte Preisbasis.',
  },
  AUF_ANFRAGE: { titel: 'Auf Anfrage', kurz: 'Bewusst ohne automatischen Preis.' },
}

export function istPreisartCode(code: unknown): code is PreisartCode {
  return typeof code === 'string' && (PREISART_CODES as readonly string[]).includes(code)
}

/** Nur die beiden Felder, die für die Ableitung zählen — Artikel aus Stamm, Overlay oder Import. */
interface ArtikelKern {
  preislogik: string
  achsen: readonly string[]
}

interface ZeileKern {
  a: readonly string[]
  preis: number | null
}

/** Die Bezugsgrößen, die die Preiszeilen eines Artikels führen. */
export function bezugsgroessen(artikel: Pick<ArtikelKern, 'achsen'>, zeilen: readonly ZeileKern[]): Set<Preisart> {
  const index = artikel.achsen.indexOf('PREISART')
  const arten = new Set<Preisart>()
  for (const z of zeilen) {
    if (z.preis == null) continue
    arten.add(index >= 0 ? parsePreisart(z.a[index]) : PREISARTEN.FIX)
  }
  return arten
}

/**
 * PREISART AUS DEM BESTAND ABLEITEN — für Artikel, die noch die alte Preislogik MATRIX
 * tragen (Altstände in Supabase, alte Excel-Exporte).
 *
 * Die Regel bildet ab, was der Lookup vor der Überarbeitung tatsächlich gerechnet hat:
 *
 *   Zeilen je Einheit UND ein Fixpreis   → Festpreis + Matrix  (Grundpreis + Menge × Betrag)
 *   nur Zeilen je Einheit                → Matrix – Maßgenau   (Menge × Betrag)
 *   sonst                                → Matrix – Stufenpreis (Lookup, Stufen runden auf)
 */
export function leitePreisartAb(artikel: Pick<ArtikelKern, 'achsen'>, zeilen: readonly ZeileKern[]): PreisartCode {
  const arten = bezugsgroessen(artikel, zeilen)
  const mitFix = arten.has(PREISARTEN.FIX)
  const jeEinheit = [...arten].some((a) => a !== PREISARTEN.FIX)
  if (jeEinheit && mitFix) return 'FEST_PLUS_MATRIX'
  if (jeEinheit) return 'MATRIX_MASS'
  return 'MATRIX_STUFE'
}

/**
 * Frühere Preislogik-Codes. `null` heißt: aus den Preiszeilen ableiten. Die Prozent-
 * Logiken sind mit der Stammdaten-Reform (09/2026) gestrichen worden und bleiben
 * „Auf Anfrage" — daran ändert diese Überarbeitung nichts.
 */
const ALTE_CODES: Record<string, PreisartCode | null> = {
  MATRIX: null,
  MATRIX_AUF: null,
  PRO_LFM: null,
  PRO_QM: null,
  GRUND_PLUS_QM: null,
  SATZPREIS: 'FESTPREIS',
  PROZENT_ARTIKEL: 'AUF_ANFRAGE',
  PROZENT_MOEBEL: 'AUF_ANFRAGE',
  PROZENT_AUFTRAG: 'AUF_ANFRAGE',
}

/**
 * DIE PREISART, NACH DER GERECHNET WIRD.
 *
 * Ein gültiger Code gilt so, wie er gepflegt ist. Ein alter Code (MATRIX aus einem
 * Supabase-Altstand) wird aus den Preiszeilen abgeleitet — genau so, wie die Engine ihn
 * vorher gerechnet hat. So ändert ein Altstand seinen Preis nicht, nur weil sich der
 * Name der Rechenweise geändert hat.
 */
export function effektivePreisart(artikel: ArtikelKern, zeilen: readonly ZeileKern[]): PreisartCode {
  if (istPreisartCode(artikel.preislogik)) return artikel.preislogik
  const alt = ALTE_CODES[artikel.preislogik]
  return alt ?? leitePreisartAb(artikel, zeilen)
}

/** true, wenn der gepflegte Code ein früherer ist und abgeleitet wurde. */
export function istAlterCode(preislogik: string): boolean {
  return !istPreisartCode(preislogik)
}

// ---------------------------------------------------------------------------
// Aufschläge
// ---------------------------------------------------------------------------

export type AufschlagEinheit = '%' | '€'

/**
 * WORAUF EIN AUFSCHLAG RECHNET — und damit, in welcher Stufe der Kalkulation er steht.
 *
 *   MOEBELPREIS         Summe aller Artikelpositionen. Artikelbezogene Aufschläge
 *                       (Raumteiler, Sichtrückwand) gehören zum Möbel: Sie ergeben mit
 *                       dem Möbelpreis zusammen den GESAMTMÖBELPREIS.
 *   GESAMTMOEBELPREIS   Möbelpreis inkl. artikelbezogener Aufschläge. Nur für die
 *                       nachgelagerten Zuschläge Montage und Lieferung — sie rechnen
 *                       beide unabhängig voneinander auf diese Summe, nie aufeinander,
 *                       und verändern den Möbelpreis selbst nicht.
 */
export const AUFSCHLAG_BASEN = ['MOEBELPREIS', 'GESAMTMOEBELPREIS'] as const
export type AufschlagBasis = (typeof AUFSCHLAG_BASEN)[number]

export const AUFSCHLAG_BASIS_KATALOG: Record<AufschlagBasis, { titel: string; kurz: string }> = {
  MOEBELPREIS: {
    titel: 'Möbelpreis',
    kurz: 'Summe aller Artikelpositionen — artikelbezogener Aufschlag, gehört zum Gesamtmöbelpreis.',
  },
  GESAMTMOEBELPREIS: {
    titel: 'Gesamtmöbelpreis',
    kurz: 'Möbelpreis inkl. artikelbezogener Aufschläge — nachgelagert (Montage, Lieferung).',
  },
}

export interface AufschlagDefinition {
  /** Prozentpunkte (5 = 5 %) bzw. Betrag in EUR. */
  wert: number
  einheit: AufschlagEinheit
  basis: AufschlagBasis
}

/** Die Aufschlags-Felder eines Artikels — bei Altständen ohne die Felder: undefined. */
export interface AufschlagFelder {
  aufschlag?: number | null
  aufschlagEinheit?: string
  aufschlagBasis?: string
}

/** Liest die Aufschlags-Angaben; `null`, wenn eine davon fehlt oder ungültig ist. */
export function aufschlagVon(a: AufschlagFelder): AufschlagDefinition | null {
  const wert = a.aufschlag
  if (wert == null || !Number.isFinite(wert) || wert < 0) return null
  if (a.aufschlagEinheit !== '%' && a.aufschlagEinheit !== '€') return null
  if (!(AUFSCHLAG_BASEN as readonly string[]).includes(a.aufschlagBasis ?? '')) return null
  return { wert, einheit: a.aufschlagEinheit, basis: a.aufschlagBasis as AufschlagBasis }
}

/** „10 %" · „3,5 %" · „25,00 €" */
export function aufschlagText(def: Pick<AufschlagDefinition, 'wert' | 'einheit'>): string {
  if (def.einheit === '%') return `${String(Math.round(def.wert * 100) / 100).replace('.', ',')} %`
  return `${def.wert.toFixed(2).replace('.', ',')} €`
}

// ---------------------------------------------------------------------------
// Konsistenz: passen Preisart, Achsen und Preiszeilen zusammen?
// ---------------------------------------------------------------------------

/**
 * Prüft, ob die Preiszeilen die gewählte Preisart tragen können. Leer ⇒ alles passt.
 *
 * Genau diese Bedingungen prüft auch der Lookup (`findePreis`) — wer sie in der
 * Verwaltung sieht, weiß vorher, warum eine Position „auf Anfrage" stehen würde.
 */
export function pruefePreisart(
  artikel: ArtikelKern & AufschlagFelder,
  zeilen: readonly ZeileKern[],
): string[] {
  const preisart = effektivePreisart(artikel, zeilen)
  const probleme: string[] = []
  const arten = bezugsgroessen(artikel, zeilen)
  const mitFix = arten.has(PREISARTEN.FIX)
  const jeEinheit = [...arten].filter((a) => a !== PREISARTEN.FIX)
  const hatPreisartAchse = artikel.achsen.includes('PREISART')

  switch (preisart) {
    case 'FESTPREIS':
    case 'MATRIX_STUFE':
      if (arten.size === 0) probleme.push('Keine Preiszeile mit Betrag hinterlegt.')
      if (jeEinheit.length > 0) {
        probleme.push(
          `Preiszeilen je Einheit (${jeEinheit.join(', ')}) passen nicht zu „${PREISART_KATALOG[preisart].titel}" — „Matrix – Maßgenau" oder „Festpreis + Matrix" wählen.`,
        )
      }
      break
    case 'MATRIX_MASS':
      if (!hatPreisartAchse) probleme.push('„Matrix – Maßgenau" braucht die Achse PREISART (€/cm · €/m · €/m²).')
      if (jeEinheit.length === 0) probleme.push('Keine Preiszeile je Einheit (€/cm · €/m · €/m²) hinterlegt.')
      if (mitFix) probleme.push('Eine Zeile „Fixpreis" gehört zu „Festpreis + Matrix", nicht zu „Maßgenau".')
      break
    case 'FEST_PLUS_MATRIX':
      if (!hatPreisartAchse) probleme.push('„Festpreis + Matrix" braucht die Achse PREISART.')
      if (!mitFix) probleme.push('Grundpreis fehlt — eine Preiszeile mit PREISART „Fixpreis" anlegen.')
      if (jeEinheit.length === 0) probleme.push('Variabler Preis fehlt — eine Preiszeile je Einheit (€/cm · €/m · €/m²) anlegen.')
      break
    case 'AUFSCHLAG': {
      if (artikel.aufschlag == null || !Number.isFinite(artikel.aufschlag)) probleme.push('Aufschlag: Satz bzw. Betrag fehlt.')
      else if (artikel.aufschlag < 0) probleme.push('Aufschlag: der Wert darf nicht negativ sein.')
      if (artikel.aufschlagEinheit !== '%' && artikel.aufschlagEinheit !== '€') probleme.push('Aufschlag: Einheit (% oder €) fehlt.')
      if (!(AUFSCHLAG_BASEN as readonly string[]).includes(artikel.aufschlagBasis ?? '')) {
        probleme.push('Aufschlag: Berechnungsbasis fehlt (Möbelpreis oder Gesamtmöbelpreis).')
      }
      break
    }
    case 'AUF_ANFRAGE':
      break
  }

  // Maßachsen, die die MENGE liefern müssen: €/m und €/cm brauchen eine Länge, €/m² zwei Maße.
  if (preisart === 'MATRIX_MASS' || preisart === 'FEST_PLUS_MATRIX') {
    const massachsen = artikel.achsen.filter((c) => /^(BREITE|HOEHE|TIEFE)(_CM)?$|^LAENGE$/.test(c))
    if (jeEinheit.some((a) => a === PREISARTEN.M || a === PREISARTEN.CM) && !artikel.achsen.includes('LAENGE')) {
      probleme.push('Ein Betrag je Meter/Zentimeter braucht die Achse LÄNGE — sie liefert die Menge.')
    }
    if (jeEinheit.includes(PREISARTEN.QM) && massachsen.length < 2) {
      probleme.push('Ein Betrag je m² braucht zwei Maßachsen (z. B. Breite und Tiefe) — sie liefern die Fläche.')
    }
  }
  return probleme
}
