#!/usr/bin/env node
/**
 * PUNKT 4.13 — Selbsttest der Maßberechnung gegen Dietmars Maßskizzen.
 *
 * Die drei Beispiele auf S. 8–9 seiner Bug-Liste sind die einzige belastbare
 * Gegenprobe für die Formel. Sie stehen hier als Sollwerte, damit eine spätere
 * Änderung an `lib/frontbreiten.ts` sofort auffällt statt still falsche Außenmaße
 * ins Kundengespräch zu tragen.
 *
 *   npm run mass:test
 */

import {
  aussenbreiteMm,
  frontAufteilung,
  UNBESTAETIGTE_KORPUSBREITEN_CM,
} from '../src/lib/frontbreiten.ts'

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
}

let fehler = 0
const ok = (text, bedingung, zusatz = '') => {
  console.log(`  ${bedingung ? c.green('✓') : c.red('✗')} ${text.padEnd(58)} ${c.dim(zusatz)}`)
  if (!bedingung) fehler++
}

console.log(c.bold('\nPUNKT 4.13 — Maßberechnung gegen die Maßskizzen\n'))

// ---------------------------------------------------------------------------
// 1) Frontaufteilung aus der Korpusbreite
// ---------------------------------------------------------------------------
console.log(c.bold('  Frontaufteilung (Tabelle aus der Bug-Liste, S. 7)'))
const tabelle = [
  [15, 1, 140], [20, 1, 190], [35, 1, 340], [50, 1, 490], [60, 1, 590],
  [61, 2, 300], [70, 2, 345], [79, 2, 390], [80, 2, 395],
  [81, 2, 395], [90, 2, 440], [100, 2, 490],
]
for (const [korpusCm, anzahl, frontMm] of tabelle) {
  const a = frontAufteilung(korpusCm)
  ok(
    `${String(korpusCm).padStart(3)}er Korpus → ${anzahl} × ${frontMm} mm`,
    a != null && a.anzahl === anzahl && a.frontMm === frontMm,
    a ? `${a.anzahl} × ${a.frontMm} mm` : 'kein Ergebnis',
  )
}

// ---------------------------------------------------------------------------
// 2) Die drei Maßskizzen
// ---------------------------------------------------------------------------
console.log(c.bold('\n  Außenbreite (Beispiele 1–3, S. 8–9)'))
const skizzen = [
  ['Beispiel 1 — 3 × 50er Korpus, je 1 Tür', [50, 50, 50], 2, 1502],
  ['Beispiel 2 — 3 × 100er Korpus, je 2 Türen', [100, 100, 100], 2, 2981],
  ['Beispiel 3 — 3 × 60er Korpus, je 1 Tür', [60, 60, 60], 2, 1802],
]
for (const [name, korpi, sets, soll] of skizzen) {
  const fronten = korpi.flatMap((k) => {
    const a = frontAufteilung(k)
    return Array.from({ length: a.anzahl }, () => a.frontMm)
  })
  const e = aussenbreiteMm(fronten, sets)
  ok(name, e.gesamtMm === soll, `${e.gesamtMm} mm (Soll ${soll}) · ${e.anzahlFugen} Fugen`)
}

// ---------------------------------------------------------------------------
// 3) Randfälle, die die Regel sonst still verletzt
// ---------------------------------------------------------------------------
console.log(c.bold('\n  Randfälle'))
const ohneSet = aussenbreiteMm([490, 490, 490], 0)
ok('ohne Abschlussset entfallen auch dessen Fugen', ohneSet.anzahlFugen === 2 && ohneSet.gesamtMm === 1476,
   `${ohneSet.gesamtMm} mm · ${ohneSet.anzahlFugen} Fugen`)

const einSet = aussenbreiteMm([490, 490, 490], 1)
ok('ein Abschlussset → eine Fuge mehr', einSet.anzahlFugen === 3 && einSet.gesamtMm === 1489,
   `${einSet.gesamtMm} mm · ${einSet.anzahlFugen} Fugen`)

const leer = aussenbreiteMm([], 2)
ok('ohne Front kein Maß statt „nur Abschlusssets"', leer.anzahlFugen === 0 && leer.gesamtMm === 20,
   `${leer.gesamtMm} mm`)

const einzeln = aussenbreiteMm([490], 2)
ok('einzelner Korpus mit beidseitigem Abschlussset', einzeln.gesamtMm === 516,
   `${einzeln.gesamtMm} mm · ${einzeln.anzahlFugen} Fugen`)

ok('Breite außerhalb 15–100 cm wird gekennzeichnet', frontAufteilung(120)?.bestaetigt === false)
ok('Breite 0 liefert kein Ergebnis', frontAufteilung(0) === null)

// ---------------------------------------------------------------------------
// 4) Offene Punkte sichtbar halten
// ---------------------------------------------------------------------------
console.log(c.bold('\n  Noch nicht bestätigte Tabellenwerte'))
for (const cm of UNBESTAETIGTE_KORPUSBREITEN_CM) {
  const a = frontAufteilung(cm)
  console.log(
    c.yellow(`  ! ${cm}er Korpus → ${a.anzahl} × ${a.frontMm} mm — nach Systematik gerechnet, Abgleich offen`),
  )
}

console.log(
  fehler === 0
    ? c.green(`\n  Alle Sollwerte erreicht — die Maßformel stimmt mit den Skizzen überein.\n`)
    : c.red(`\n  ${fehler} Abweichung(en).\n`),
)
process.exitCode = fehler === 0 ? 0 : 1
