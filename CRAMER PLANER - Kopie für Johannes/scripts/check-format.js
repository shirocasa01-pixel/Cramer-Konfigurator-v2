/**
 * Zahlen- und Währungsformate prüfen — `npm run format:test`.
 *
 * Der Anlass ist der gemeldete Fehler „Preis wird im US-Format interpretiert":
 * „1.250" im VK-Feld ergab 1,25 € statt 1.250,00 €. Diese Datei hält fest, welche
 * Eingabe zu welcher Zahl führen MUSS, damit das nicht unbemerkt zurückkommt.
 *
 * Bewusst ohne Test-Framework: das sind zwei Schleifen gegen eine Abhängigkeit, die
 * ihrerseits gepflegt werden will. Passt zum Rest von `scripts/`.
 */

import { formatDezimal, formatEuro, parseDezimal, parseEingabeDe } from '../src/lib/format.ts'

let fehler = 0

function pruefe(bezeichnung, ist, soll) {
  const gleich = Object.is(ist, soll)
  if (!gleich) {
    fehler++
    console.error(`  ✗ ${bezeichnung}\n      erwartet: ${JSON.stringify(soll)}\n      erhalten: ${JSON.stringify(ist)}`)
  }
  return gleich
}

// --- Beratereingaben: strikt deutsch ---------------------------------------------------

const EINGABEN = [
  // [Eingabe, erwartete Zahl]
  ['350,99', 350.99],
  ['350,99 €', 350.99],
  ['1.250', 1250],           // der gemeldete Fehler: früher 1.25
  ['1.250,00', 1250],
  ['1.250,00 €', 1250],
  ['1.250.000', 1250000],
  ['1.250.000,50', 1250000.5],
  ['9.009,00', 9009],
  ['350', 350],
  ['0,99', 0.99],
  ['-350,99', -350.99],
  ['350.99', 350.99],        // Ziffernblock-Zugeständnis: kein Tausendertrenner möglich
  ['350.9', 350.9],
  ['', null],
  ['   ', null],
  ['abc', null],
  ['350,99,50', null],       // zwei Kommas
  ['1.2500', 1.25],          // einzelner Punkt, keine Tausendergruppe ⇒ Dezimalpunkt
  ['1.250.00', null],        // mehrere Punkte, nicht alle dreistellig ⇒ nicht deutbar
]

console.log('Beratereingaben (parseEingabeDe):')
for (const [eingabe, soll] of EINGABEN) {
  pruefe(`„${eingabe}" → ${soll}`, parseEingabeDe(eingabe), soll)
}

// --- Maschinenwerte: Mappe und Excel-Import --------------------------------------------

const MASCHINE = [
  ['531.86', 531.86],        // Rohwert aus dem Preisblatt
  ['1.250,00', 1250],
  ['350,99', 350.99],
  ['', null],
]

console.log('Maschinenwerte (parseDezimal):')
for (const [eingabe, soll] of MASCHINE) {
  pruefe(`„${eingabe}" → ${soll}`, parseDezimal(eingabe), soll)
}

// --- Ausgabe: immer deutsch ------------------------------------------------------------

console.log('Ausgabe (formatEuro / formatDezimal):')
pruefe('350.99 → „350,99 €"', formatEuro(350.99), '350,99 €')
pruefe('1250 → „1.250,00 €"', formatEuro(1250), '1.250,00 €')
pruefe('9009 → „9.009,00 €"', formatEuro(9009), '9.009,00 €')
pruefe('1250.5 → „1.250,50"', formatDezimal(1250.5), '1.250,50')
// Kein schmales Leerzeichen — die jsPDF-Standardschrift kann es nicht darstellen.
pruefe('kein U+202F/U+00A0 im Euro-Format', /[  ]/.test(formatEuro(1250)), false)

// --- Rundlauf: Eingabe → Zahl → Anzeige → Eingabe --------------------------------------

console.log('Rundlauf (Eingabe → formatDezimal → parseEingabeDe):')
for (const wert of [350.99, 1250, 9009, 1250000.5, 0.99]) {
  pruefe(`${wert} bleibt ${wert}`, parseEingabeDe(formatDezimal(wert)), wert)
}

if (fehler > 0) {
  console.error(`\n${fehler} Prüfung(en) fehlgeschlagen.`)
  process.exit(1)
}
console.log('\nAlle Format-Prüfungen bestanden.')
