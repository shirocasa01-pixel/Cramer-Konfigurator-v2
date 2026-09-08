/**
 * DEUTSCHE ZAHLEN- UND WÄHRUNGSFORMATE — eine Stelle für die ganze Anwendung.
 *
 *     1250      →  „1.250,00 €"      Punkt tausendert, Komma dezimiert, € steht hinten
 *     350.99    →  „350,99 €"
 *
 * Warum zentral: sobald zwei Stellen im Code eigene Formatierung bauen, driften sie.
 * Und die Richtung Text → Zahl braucht dieselbe Sorgfalt — ein Berater tippt „1.250,00",
 * `Number()` macht daraus `NaN`, und der Preis wäre still verschwunden.
 *
 * Das schmale bzw. geschützte Leerzeichen vor dem € (U+202F/U+00A0), das `Intl` setzt,
 * wird auf ein normales Leerzeichen normalisiert: die jsPDF-Standardschrift (Helvetica,
 * WinAnsi) kann es nicht darstellen und würde im AV-PDF ein Kästchen zeichnen.
 */

const EURO = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const DEZIMAL = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const GANZZAHL = new Intl.NumberFormat('de-DE')

/** Normalisiert die schmalen Leerzeichen aus `Intl` auf ein gewöhnliches. */
function normalisiereLeerzeichen(text: string): string {
  return text.replace(/[  ]/g, ' ')
}

/** `1250` → `„1.250,00 €"`. */
export function formatEuro(wert: number): string {
  return normalisiereLeerzeichen(EURO.format(wert))
}

/** Wie `formatEuro`, aber `null`/`undefined` → Platzhalter statt „0,00 €". */
export function formatEuroOderLeer(wert: number | null | undefined, platzhalter = '—'): string {
  return wert == null ? platzhalter : formatEuro(wert)
}

/** `1250.5` → `„1.250,50"` — ohne Währungszeichen, z. B. für Eingabefelder. */
export function formatDezimal(wert: number): string {
  return normalisiereLeerzeichen(DEZIMAL.format(wert))
}

/**
 * MASSANGABE — `298.1` → `„298,1"`, `60` → `„60"`.
 *
 * Eigener Formatierer, weil `formatDezimal` immer zwei Nachkommastellen setzt:
 * „ca. 60,00 cm" liest sich in einem Möbelmaß falsch genau. Höchstens eine
 * Nachkommastelle, keine nachlaufende Null, Komma als Dezimaltrenner.
 */
export function formatMassZahl(wert: number): string {
  return normalisiereLeerzeichen(
    new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(wert),
  )
}

/** `1509` → `„1.509"`. */
export function formatGanzzahl(wert: number): string {
  return normalisiereLeerzeichen(GANZZAHL.format(wert))
}

/**
 * MASCHINENWERTE → Zahl. Für Zahlen, die aus einer Datei kommen, nicht aus einer Tastatur:
 * Zellwerte der Stammdatenmappe, Spalten eines Excel-Imports.
 *
 *     „1.250,00 €"  →  1250
 *     „531.86"      →  531.86
 *     „350,99"      →  350.99
 *     „"            →  null
 *
 * Die Unterscheidung: enthält der Text ein Komma, gilt deutsche Schreibweise (Punkte
 * sind Tausendertrenner). Sonst wird der Punkt als Dezimaltrenner gelesen — so bleiben
 * die Rohwerte aus dem Preisblatt („531.86") lesbar.
 *
 * NICHT für Beratereingaben verwenden — dafür gibt es `parseEingabeDe()`. Der Unterschied
 * ist genau der Fall „1.250": aus der Mappe heißt das eintausendzweihundertfünfzig, aus
 * einem Eingabefeld ebenfalls — aber diese Funktion läse hier 1,25. Siehe unten.
 */
export function parseDezimal(roh: string | number | null | undefined): number | null {
  if (roh == null) return null
  if (typeof roh === 'number') return Number.isFinite(roh) ? roh : null

  const bereinigt = roh.replace(/[^\d.,-]/g, '').trim()
  if (!bereinigt) return null

  const normalisiert = bereinigt.includes(',')
    ? bereinigt.replace(/\./g, '').replace(',', '.')
    : bereinigt
  const zahl = Number(normalisiert)
  return Number.isFinite(zahl) ? zahl : null
}

/**
 * BERATEREINGABEN → Zahl, strikt nach deutscher Schreibweise.
 *
 *     „350,99"       →  350.99      Komma dezimiert
 *     „1.250"        →  1250        Punkt tausendert — NICHT 1,25
 *     „1.250,00 €"   →  1250        Währungszeichen und Leerzeichen sind egal
 *     „1.250.000"    →  1250000
 *     „350"          →  350
 *     „350.99"       →  350.99      Zugeständnis an den Ziffernblock, siehe unten
 *     „1.2500"       →  null        „.2500" ist keine Tausendergruppe und kein Preis
 *     „350,99,50"    →  null
 *
 * Warum eine eigene Funktion: `parseDezimal()` liest einen alleinstehenden Punkt als
 * Dezimaltrenner. Wer „1.250" in das VK-Feld tippt, meinte 1.250,00 € und bekam 1,25 € —
 * genau der gemeldete Fehler mit den falschen Tausendertrennzeichen.
 *
 * Die Regel hier: ein Punkt ist Tausendertrenner, wenn genau drei Ziffern folgen. Sonst
 * kann er keiner sein („350.9", „350.99"), und dann wird er als Dezimalpunkt gelesen. Das
 * ist bewusst tolerant: auf dem Ziffernblock liegt ein Punkt, kein Komma, und ein Berater,
 * der „350.99" tippt, meint keine 35.099 €. Beide Wege enden im selben Ergebnis, und
 * ausgegeben wird ohnehin immer deutsch.
 */
export function parseEingabeDe(roh: string | number | null | undefined): number | null {
  if (roh == null) return null
  if (typeof roh === 'number') return Number.isFinite(roh) ? roh : null

  const bereinigt = roh.replace(/[^\d.,-]/g, '').trim()
  if (!bereinigt) return null

  // Minus nur ganz vorn, und höchstens eines.
  const negativ = bereinigt.startsWith('-')
  const ziffern = bereinigt.slice(negativ ? 1 : 0)
  if (ziffern.includes('-')) return null

  let normalisiert: string
  const kommas = ziffern.split(',').length - 1

  if (kommas > 1) return null

  if (kommas === 1) {
    // Komma entscheidet: alles davor ist Vorkommateil, Punkte darin sind Tausendertrenner.
    const [vor, nach] = ziffern.split(',')
    normalisiert = `${vor.replace(/\./g, '')}.${nach}`
  } else if (ziffern.includes('.')) {
    const gruppen = ziffern.split('.')
    const rest = gruppen.slice(1)
    // Alle Nachgruppen dreistellig ⇒ Tausendertrenner („1.250", „1.250.000").
    if (rest.every((g) => /^\d{3}$/.test(g))) {
      normalisiert = gruppen.join('')
    } else if (gruppen.length === 2) {
      // Ein einzelner Punkt, der kein Tausendertrenner sein kann ⇒ Dezimalpunkt.
      normalisiert = ziffern
    } else {
      return null
    }
  } else {
    normalisiert = ziffern
  }

  const zahl = Number(normalisiert)
  if (!Number.isFinite(zahl)) return null
  return negativ ? -zahl : zahl
}
