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
console.log(c.bold('  Frontaufteilung — alle 86 Zeilen der Maßtabelle'))

/**
 * Die vollständige Tabelle aus „Frontbreiten.pdf": [Korpusbreite cm, Anzahl Fronten, Frontbreite mm].
 * Bewusst Zeile für Zeile hinterlegt und nicht aus derselben Formel erzeugt, die geprüft
 * werden soll — sonst prüfte der Test sich selbst.
 */
const FRONTBREITEN_TABELLE = [
  [15, 1, 140],
  [16, 1, 150],
  [17, 1, 160],
  [18, 1, 170],
  [19, 1, 180],
  [20, 1, 190],
  [21, 1, 200],
  [22, 1, 210],
  [23, 1, 220],
  [24, 1, 230],
  [25, 1, 240],
  [26, 1, 250],
  [27, 1, 260],
  [28, 1, 270],
  [29, 1, 280],
  [30, 1, 290],
  [31, 1, 300],
  [32, 1, 310],
  [33, 1, 320],
  [34, 1, 330],
  [35, 1, 340],
  [36, 1, 350],
  [37, 1, 360],
  [38, 1, 370],
  [39, 1, 380],
  [40, 1, 390],
  [41, 1, 400],
  [42, 1, 410],
  [43, 1, 420],
  [44, 1, 430],
  [45, 1, 440],
  [46, 1, 450],
  [47, 1, 460],
  [48, 1, 470],
  [49, 1, 480],
  [50, 1, 490],
  [51, 1, 500],
  [52, 1, 510],
  [53, 1, 520],
  [54, 1, 530],
  [55, 1, 540],
  [56, 1, 550],
  [57, 1, 560],
  [58, 1, 570],
  [59, 1, 580],
  [60, 1, 590],
  [61, 2, 295],
  [62, 2, 300],
  [63, 2, 305],
  [64, 2, 310],
  [65, 2, 315],
  [66, 2, 320],
  [67, 2, 325],
  [68, 2, 330],
  [69, 2, 335],
  [70, 2, 340],
  [71, 2, 345],
  [72, 2, 350],
  [73, 2, 355],
  [74, 2, 360],
  [75, 2, 365],
  [76, 2, 370],
  [77, 2, 375],
  [78, 2, 380],
  [79, 2, 385],
  [80, 2, 390],
  [81, 2, 395],
  [82, 2, 400],
  [83, 2, 405],
  [84, 2, 410],
  [85, 2, 415],
  [86, 2, 420],
  [87, 2, 425],
  [88, 2, 430],
  [89, 2, 435],
  [90, 2, 440],
  [91, 2, 445],
  [92, 2, 450],
  [93, 2, 455],
  [94, 2, 460],
  [95, 2, 465],
  [96, 2, 470],
  [97, 2, 475],
  [98, 2, 480],
  [99, 2, 485],
  [100, 2, 490]
]

let tabellenfehler = 0
for (const [korpusCm, anzahl, frontMm] of FRONTBREITEN_TABELLE) {
  const a = frontAufteilung(korpusCm)
  if (!a || a.anzahl !== anzahl || a.frontMm !== frontMm) {
    console.log(
      c.red(`  ✗ ${korpusCm}er Korpus: erwartet ${anzahl} × ${frontMm} mm, berechnet ${a ? `${a.anzahl} × ${a.frontMm} mm` : 'nichts'}`),
    )
    tabellenfehler++
    fehler++
  }
}
ok(
  `alle ${FRONTBREITEN_TABELLE.length} Zeilen (15–100 cm) stimmen`,
  tabellenfehler === 0,
  tabellenfehler === 0 ? '15–60 einteilig · 61–100 zweiteilig' : `${tabellenfehler} Abweichung(en)`,
)

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
