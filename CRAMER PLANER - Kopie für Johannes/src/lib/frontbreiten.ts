/**
 * FRONTBREITEN & AUSSENMASS — die Rechenregel aus Punkt 4.13.
 *
 * Grundsatz (Dietmar, Rückmeldung zu 4.13 Frage 6):
 *
 *     „In der Praxis läuft die Berechnung von der Frontbreite zum Korpus.
 *      Aus optischen Gründen ist es wichtig, dass die Fronten immer die
 *      gleichen Breiten haben."
 *
 * Der Berater wählt eine Korpus-Größenklasse (50er / 60er / 100er / Sondermaß).
 * Daraus ergeben sich Anzahl und Breite der Fronten — und ERST AUS DEN FRONTEN
 * das Außenmaß des Möbels. Die Korpus-Nennbreite ist also ein Namens- und
 * Preisschlüssel, nicht das Fertigungsmaß.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DIE FORMEL
 *
 *     Außenbreite = Σ Frontbreiten
 *                 + 3 mm je Fuge
 *                 + 10 mm je Abschlussset
 *
 * Fugen entstehen laut Dietmar ausschließlich an Fronten — nie am Korpus:
 *
 *     • zwischen zwei Fronten                          → Anzahl Fronten − 1
 *     • zwischen einer Front und einem Abschlussset    → 1 je Abschlussset
 *
 *     Fugen = (Anzahl Fronten − 1) + Anzahl Abschlusssets
 *
 * Gegengerechnet an allen drei Maßskizzen seiner Bug-Liste (S. 8–9):
 *
 *     Beispiel 1   3 × 50er,  je 1 Tür    3×490 + 4×3 + 2×10 = 1502 mm  ✔
 *     Beispiel 2   3 × 100er, je 2 Türen  6×490 + 7×3 + 2×10 = 2981 mm  ✔
 *     Beispiel 3   3 × 60er,  je 1 Tür    3×590 + 4×3 + 2×10 = 1802 mm  ✔
 *
 * Der Selbsttest `npm run mass:test` rechnet diese drei Fälle bei jeder Änderung nach.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WARUM GANZZAHLIGE MILLIMETER — wie in `raster.ts`: Zentimeter mit Nachkomma-
 * stellen und Fließkomma-Addition ergeben Maße wie 1501,9999999 mm. Gerechnet
 * wird deshalb ausschließlich in ganzen Millimetern.
 */

/** Luft zwischen zwei Bauteilen, in Millimetern. */
export const FUGE_MM = 3

/** Stärke eines Abschlusssets (Seitenset) in Millimetern. */
export const ABSCHLUSSSET_MM = 10

/** Kleinste bzw. größte Korpusbreite mit hinterlegter Frontaufteilung (cm). */
export const KORPUS_MIN_CM = 15
export const KORPUS_MAX_CM = 100

/**
 * Ab dieser Korpusbreite wird zweitürig geplant (Dietmar zu 4.13 Frage 5):
 * „Ab 61 sind laut Preisliste immer 2 Türen."
 */
export const ZWEITUERIG_AB_CM = 61

/**
 * Korpusbreiten, deren Frontbreite in Dietmars Tabelle nicht eindeutig ist.
 * Sie werden nach der Systematik berechnet und im Ergebnis als `bestaetigt: false`
 * gekennzeichnet, damit die Oberfläche darauf hinweisen kann.
 *
 *   35  — die Tabelle nennt 34 cm, die Randnotiz derselben Seite 35 cm.
 *   80  — die Zeile fehlt in der Tabelle („Den 80er Korpus habe ich ergänzt").
 *
 * Beide sind mit der nachgereichten Liste abzugleichen.
 */
export const UNBESTAETIGTE_KORPUSBREITEN_CM: readonly number[] = [35, 80]

/**
 * Restmaß = Korpusbreite − Summe der Frontbreiten, in Millimetern.
 *
 * Aus Dietmars Tabelle abgelesen und über alle 86 Zeilen gegengeprüft:
 *   15–60 cm  einteilig, Rest 10 mm      (50er Korpus → 490 mm Front)
 *   61–80 cm  zweiteilig, Rest 10 mm     (70er Korpus → 2 × 345 mm)
 *   81–100 cm zweiteilig, Rest 20 mm     (100er Korpus → 2 × 490 mm)
 *
 * Der Sprung des Restmaßes zwischen 79 und 81 ist genau die Stelle, an der in
 * der Tabelle die 80er-Zeile fehlte.
 */
function restmassMm(korpusMm: number): number {
  return korpusMm <= 800 ? 10 : 20
}

export interface FrontAufteilung {
  /** Eingegebene Korpusbreite in Millimetern. */
  korpusMm: number
  /** Anzahl Fronten dieses Korpus (1 oder 2). */
  anzahl: number
  /** Breite je Front in Millimetern. */
  frontMm: number
  /** Summe der Frontbreiten dieses Korpus. */
  summeMm: number
  /**
   * false, wenn die Breite in Dietmars Tabelle nicht eindeutig belegt ist
   * (siehe `UNBESTAETIGTE_KORPUSBREITEN_CM`) oder außerhalb von 15–100 cm liegt.
   */
  bestaetigt: boolean
  /** Klartext-Begründung, falls `bestaetigt === false`. */
  hinweis?: string
}

/**
 * Frontaufteilung einer Korpusbreite.
 *
 * @param korpusCm Korpus-Nennbreite in Zentimetern (15–100 laut Vorgabe).
 * @returns Aufteilung, oder `null` bei einer Breite ≤ 0.
 */
export function frontAufteilung(korpusCm: number | undefined): FrontAufteilung | null {
  if (korpusCm == null || !Number.isFinite(korpusCm) || korpusCm <= 0) return null

  const korpusMm = Math.round(korpusCm * 10)
  const anzahl = korpusCm >= ZWEITUERIG_AB_CM ? 2 : 1
  const frontMm = Math.round((korpusMm - restmassMm(korpusMm)) / anzahl)
  const summeMm = frontMm * anzahl

  const ausserhalb = korpusCm < KORPUS_MIN_CM || korpusCm > KORPUS_MAX_CM
  const unbestaetigt = UNBESTAETIGTE_KORPUSBREITEN_CM.includes(korpusCm)

  let hinweis: string | undefined
  if (ausserhalb) {
    hinweis = `Korpusbreite ${korpusCm} cm liegt außerhalb der hinterlegten Tabelle (${KORPUS_MIN_CM}–${KORPUS_MAX_CM} cm). Frontbreite nach der Systematik gerechnet – bitte mit der AV abstimmen.`
  } else if (unbestaetigt) {
    hinweis = `Für den ${korpusCm}er Korpus ist die Frontbreite in der Vorgabe nicht eindeutig. Wert nach der Systematik gerechnet – Abgleich mit der nachgereichten Liste offen.`
  }

  return { korpusMm, anzahl, frontMm, summeMm, bestaetigt: !ausserhalb && !unbestaetigt, hinweis }
}

export interface AussenbreiteErgebnis {
  /** Außenbreite des Möbels in Millimetern. */
  gesamtMm: number
  /** Summe aller Frontbreiten. */
  frontenSummeMm: number
  /** Anzahl Fronten über das ganze Möbel. */
  anzahlFronten: number
  /** Anzahl Fugen laut Regel. */
  anzahlFugen: number
  /** Anzahl Abschlusssets (0–2). */
  anzahlAbschlusssets: number
  /** Rechenweg im Klartext – steht so in der Oberfläche und im AV-PDF. */
  rechenweg: string
}

/**
 * Außenbreite aus den Frontbreiten.
 *
 * @param frontenMm Breiten aller Fronten des Möbels, von links nach rechts.
 * @param anzahlAbschlusssets 0, 1 oder 2 — je Seite eines.
 */
export function aussenbreiteMm(
  frontenMm: readonly number[],
  anzahlAbschlusssets: number,
): AussenbreiteErgebnis {
  const anzahlFronten = frontenMm.length
  const frontenSummeMm = frontenMm.reduce((summe, mm) => summe + mm, 0)
  // Ohne Front gibt es auch keine Fuge – sonst käme bei einem leeren Möbel ein Maß heraus.
  const anzahlFugen = anzahlFronten === 0 ? 0 : anzahlFronten - 1 + anzahlAbschlusssets
  const gesamtMm =
    frontenSummeMm + anzahlFugen * FUGE_MM + anzahlAbschlusssets * ABSCHLUSSSET_MM

  const teile = [`${anzahlFronten} × Front = ${frontenSummeMm} mm`]
  if (anzahlFugen > 0) teile.push(`${anzahlFugen} × Fuge à ${FUGE_MM} mm = ${anzahlFugen * FUGE_MM} mm`)
  if (anzahlAbschlusssets > 0) {
    teile.push(
      `${anzahlAbschlusssets} × Abschlussset à ${ABSCHLUSSSET_MM} mm = ${anzahlAbschlusssets * ABSCHLUSSSET_MM} mm`,
    )
  }

  return {
    gesamtMm,
    frontenSummeMm,
    anzahlFronten,
    anzahlFugen,
    anzahlAbschlusssets,
    rechenweg: `${teile.join('  +  ')}  =  ${gesamtMm} mm`,
  }
}

/** Anzahl der Abschlusssets aus der Positionsangabe. */
export function anzahlAbschlusssets(position: string | undefined): number {
  if (position === 'beide') return 2
  if (position === 'links' || position === 'rechts') return 1
  return 0
}

/** Millimeter → Zentimeter mit einer Nachkommastelle. */
export function mmZuCm(mm: number): number {
  return Math.round(mm) / 10
}
