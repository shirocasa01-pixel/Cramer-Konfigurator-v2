#!/usr/bin/env node
/**
 * SCHRITT 4 — Plausibilitäts-Check gegen das Vorgänger-Tool.
 *
 * Dasselbe Möbel, zwei Preisquellen: die Vorgänger-Fassung rechnete gegen die
 * normalisierte `priceList.json`, diese Fassung gegen das Excel-Preisblatt über
 * Artikelnummern. Die Positionsliste unten ist die **wörtliche Ausgabe** von
 * `npm run verify:demo` im alten Tool und dient als Sollwert.
 *
 * Weicht etwas ab, ist das entweder ein Fehler in der neuen Zuordnung oder eine
 * Abweichung zwischen den beiden Datenständen — beides gehört gesehen, nicht geglättet.
 *
 *   npm run kalk:test
 */

import { berechneEntwurf } from '../src/lib/kalkulation.ts'
import { demoEntwurf } from '../src/data/demoEntwurf.ts'

/** Sollwerte aus dem Vorgänger-Tool (Refugium 250 × 200 × 60, 4 Segmente). */
/**
 * Sollwerte für den Demo-Entwurf.
 *
 * Ursprünglich die Zahlen des Vorgänger-Tools. Zwei Korrekturen aus der Preisprobe
 * (09/2026) gelten seither auch hier — das Vorgänger-Tool hatte an beiden Stellen
 * dieselben Fehler:
 *
 *   • MITTELSEITEN: Refugium-Korpi bringen ihre linke Seite mit; nötig ist nur die
 *     Wand, die den Block rechts abschließt. Bei 4 Segmenten also 1 statt 3
 *     (−270 €). Siehe `anzahlMittelseiten()` in config/preisMapping.ts.
 *   • GRIFF: Der Stückgriff steckt im Türpreis und wird nicht mehr doppelt
 *     berechnet — Griff Nr. 121 entfällt als eigene Position (−50 €).
 *
 * Möbelpreis damit 5.033 € → 4.713 €. Alle übrigen Positionen sind unverändert,
 * die Parität der Engine bleibt geprüft.
 */
const REFERENZ = {
  positionen: 16,
  moebelpreis: 4713.0,
  montage: 471.3,
  gesamt: 5184.3,
  offen: 1,
  /** label → Einzelbetrag; `null` = auf Anfrage. */
  betraege: [
    ['Korpus 1', 258.0],
    ['Korpus 2', 258.0],
    ['Korpus 3', 258.0],
    ['Korpus 4', 309.0],
    ['Mittelseite', 135.0],
    // Der Artikelstamm schreibt „Aussenset" ohne ß — die Bezeichnung kommt von dort.
    ['Aussenset', 359.0],
    ['Drehtür „D1"', 348.0],
    ['Drehtür „D2"', 348.0],
    ['Schublade „S1"', 346.0],
    ['Schublade „S2"', 346.0],
    ['Drehtür „D3"', null],
    ['Einlegeboden', 180.0],
    ['Kleiderstange', 60.0],
    ['LED-Band', 1000.0],
    ['Innenschublade', 378.0],
    ['Innenspiegel', 130.0],
  ],
}

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
}

const eur = (n) =>
  n == null ? 'auf Anfrage' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

let fehler = 0
function pruefe(name, ist, soll) {
  const ok = ist === soll || (typeof ist === 'number' && typeof soll === 'number' && Math.abs(ist - soll) < 0.005)
  if (ok) console.log(`  ${c.green('✓')} ${name.padEnd(38)} ${String(ist).padStart(12)}`)
  else {
    fehler++
    console.log(`  ${c.red('✗')} ${name.padEnd(38)} ${String(ist).padStart(12)}   ${c.red(`erwartet ${soll}`)}`)
  }
}

const ergebnis = berechneEntwurf(demoEntwurf)

console.log(c.bold('\nSCHRITT 4 — Kalkulation gegen das Vorgänger-Tool'))
console.log(c.dim(`  ${demoEntwurf.customerName} · Preisliste ${ergebnis.gueltigkeit}\n`))

console.log(
  `  ${'Herkunft'.padEnd(12)} ${'Seg'.padEnd(4)} ${'Position'.padEnd(40)} ${'Artikel'.padEnd(15)} ${'Menge'.padStart(5)} ${'Betrag'.padStart(12)}`,
)
console.log(c.dim(`  ${'─'.repeat(96)}`))
for (const p of ergebnis.positionen) {
  const betrag = p.status === 'berechnet' ? eur(p.gesamt) : 'auf Anfrage'
  console.log(
    `  ${p.herkunft.padEnd(12)} ${String(p.segment ?? '–').padEnd(4)} ${p.label.slice(0, 40).padEnd(40)} ${(p.artikelnummer ?? '—').padEnd(15)} ${String(p.menge).padStart(5)} ${betrag.padStart(12)}`,
  )
  if (p.achsen.length) {
    console.log(c.dim(`  ${' '.repeat(18)}${p.achsen.map((a) => `${a.spalte} ${a.code}=${a.wert}`).join(' · ')}`))
  }
}
console.log(c.dim(`  ${'─'.repeat(96)}`))
console.log(`  ${'Möbelpreis'.padEnd(59)}${eur(ergebnis.moebelpreis).padStart(37)}`)
for (const z of ergebnis.zuschlaege) console.log(`  ${z.label.padEnd(59)}${eur(z.gesamt).padStart(37)}`)
console.log(c.bold(`  ${'GESAMT'.padEnd(59)}${eur(ergebnis.gesamt).padStart(37)}`))

console.log(c.bold('\n  Abgleich mit den Sollwerten des Vorgänger-Tools:'))
pruefe('Anzahl Positionen', ergebnis.positionen.length, REFERENZ.positionen)
pruefe('Möbelpreis', ergebnis.moebelpreis, REFERENZ.moebelpreis)
pruefe('Montage (+10 %)', ergebnis.zuschlaege.find((z) => /Montage/.test(z.label))?.gesamt ?? 0, REFERENZ.montage)
pruefe('Gesamt', ergebnis.gesamt, REFERENZ.gesamt)
pruefe('Positionen auf Anfrage', ergebnis.offenePositionen, REFERENZ.offen)

console.log(c.bold('\n  Positionsweiser Abgleich:'))
for (const [suchbegriff, sollBetrag] of REFERENZ.betraege) {
  const kern = suchbegriff.replace(/ „.*/, '')
  const kennung = /„([^"]*)"/.exec(suchbegriff)?.[1]
  const treffer = ergebnis.positionen.find(
    (p) => p.label.includes(kern) && (!kennung || p.label.includes(kennung)),
  )
  if (!treffer) {
    fehler++
    console.log(`  ${c.red('✗')} ${suchbegriff.padEnd(38)} ${c.red('nicht gefunden')}`)
    continue
  }
  const ist = treffer.status === 'berechnet' ? treffer.gesamt : null
  const ok = sollBetrag == null ? ist == null : ist != null && Math.abs(ist - sollBetrag) < 0.005
  if (ok) console.log(`  ${c.green('✓')} ${suchbegriff.padEnd(38)} ${eur(ist).padStart(12)}`)
  else {
    fehler++
    console.log(`  ${c.red('✗')} ${suchbegriff.padEnd(38)} ${eur(ist).padStart(12)}   ${c.red(`erwartet ${eur(sollBetrag)}`)}`)
  }
}

if (ergebnis.meldungen.length) {
  console.log(c.bold('\n  Meldungen:'))
  for (const m of ergebnis.meldungen) {
    const farbe = m.schwere === 'fehler' ? c.red : m.schwere === 'warnung' ? c.yellow : c.dim
    console.log(farbe(`    [${m.schwere.padEnd(8)}] ${m.text}`))
  }
}

console.log(
  fehler === 0
    ? c.green(`\n  Alle ${5 + REFERENZ.betraege.length} Sollwerte erreicht — die neue Engine rechnet identisch.\n`)
    : c.red(`\n  ${fehler} Abweichung(en) gegenüber dem Vorgänger-Tool.\n`),
)
process.exitCode = fehler ? 1 : 0
