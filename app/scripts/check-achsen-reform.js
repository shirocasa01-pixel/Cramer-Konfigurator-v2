#!/usr/bin/env node
/**
 * PRÜFUNG — Achsen- und Preislogik-Reform.
 *
 * Fünf Fragen, die nach der Umstellung beantwortet sein müssen:
 *
 *   A  Kennt der Stamm nur noch die drei Preislogiken?
 *   B  Benutzt jeder Artikel ausschließlich Achsen aus dem Katalog?
 *   C  Trägt jeder Wert einer Stufenachse einen lesbaren Zentimeter-Schwellenwert?
 *      (Ohne ihn fällt die Zeile aus der Nächstgrößer-Regel heraus und wird nie getroffen.)
 *   D  Sind die Werte der Achse PREISART bekannte Bezugsgrößen?
 *   E  Ist jede Achsenkombination eindeutig? Zwei Zeilen mit denselben Achsenwerten sind
 *      eine stille Preisgabel — welcher Betrag gilt, entscheidet dann die Zeilenreihenfolge.
 *
 *   npm run achsen:test
 */

import { achsen, artikel, preise, preislogiken } from '../src/data/stammdaten.generated.ts'
import { parsePreisart, parseStufe, PREISARTEN } from '../src/lib/preisAchsen.ts'

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
}

let fehler = 0
function pruefe(bedingung, text, detail) {
  if (bedingung) console.log(`  ${c.green('✓')} ${text}`)
  else {
    fehler += 1
    console.log(`  ${c.red('✗')} ${text}${detail ? c.red(`  — ${detail}`) : ''}`)
  }
}

const katalog = new Map(achsen.map((a) => [a.code, a]))
const zeilenNachArtikel = new Map()
for (const z of preise) {
  const liste = zeilenNachArtikel.get(z.artikel)
  if (liste) liste.push(z)
  else zeilenNachArtikel.set(z.artikel, [z])
}

console.log(c.bold('\nAchsen- und Preislogik-Reform'))
console.log(c.dim(`  ${artikel.length} Artikel · ${preise.length} Preiszeilen · ${achsen.length} Achsen`))

// --- A ----------------------------------------------------------------------------
console.log(c.bold('\nA — Preislogik'))
const erlaubteLogiken = new Set(preislogiken.map((p) => p.code))
pruefe(
  erlaubteLogiken.size === 3 && ['MATRIX', 'FESTPREIS', 'AUF_ANFRAGE'].every((x) => erlaubteLogiken.has(x)),
  `Nur noch ${[...erlaubteLogiken].join(' · ')}`,
)
const fremdeLogik = artikel.filter((a) => !erlaubteLogiken.has(a.preislogik))
pruefe(fremdeLogik.length === 0, 'Kein Artikel mit unbekannter Preislogik', fremdeLogik.map((a) => a.artikelnummer).slice(0, 5).join(', '))

// --- B ----------------------------------------------------------------------------
console.log(c.bold('\nB — Achsen-Katalog'))
const fremdeAchse = []
for (const a of artikel) {
  for (const code of a.achsen) if (!katalog.has(code)) fremdeAchse.push(`${a.artikelnummer}/${code}`)
}
pruefe(fremdeAchse.length === 0, 'Jede Artikel-Achse steht im Katalog', fremdeAchse.slice(0, 5).join(', '))

const veraltet = ['RASTER', 'VARIANTE', 'BEDINGUNG'].filter((x) => katalog.has(x))
pruefe(veraltet.length === 0, 'Die abgelösten Achsen sind verschwunden', veraltet.join(', '))

// --- C ----------------------------------------------------------------------------
console.log(c.bold('\nC — Stufenachsen tragen Zentimeter'))
const ohneMass = []
for (const a of artikel) {
  a.achsen.forEach((code, i) => {
    if (katalog.get(code)?.art !== 'stufe') return
    for (const z of zeilenNachArtikel.get(a.artikelnummer) ?? []) {
      const roh = (z.a[i] ?? '').trim()
      if (!roh) continue
      if (parseStufe(roh).cm == null) ohneMass.push(`${a.artikelnummer} ${code}="${roh}"`)
    }
  })
}
pruefe(ohneMass.length === 0, `Alle Werte der Stufenachsen sind einzuordnen`, ohneMass.slice(0, 5).join(' · '))

// --- D ----------------------------------------------------------------------------
console.log(c.bold('\nD — Bezugsgrößen'))
const bekannteArten = new Set(Object.values(PREISARTEN))
const fremdeArt = []
let mitPreisart = 0
for (const a of artikel) {
  const i = a.achsen.findIndex((code) => katalog.get(code)?.art === 'preisart')
  if (i < 0) continue
  mitPreisart += 1
  for (const z of zeilenNachArtikel.get(a.artikelnummer) ?? []) {
    const roh = (z.a[i] ?? '').trim()
    if (!roh) continue
    if (!bekannteArten.has(roh) || parsePreisart(roh) !== roh) fremdeArt.push(`${a.artikelnummer}="${roh}"`)
  }
}
pruefe(fremdeArt.length === 0, `${mitPreisart} Artikel führen eine PREISART, alle Werte sind bekannt`, fremdeArt.slice(0, 5).join(' · '))

// --- E ----------------------------------------------------------------------------
console.log(c.bold('\nE — Eindeutigkeit der Achsenkombinationen'))

/**
 * BEKANNTE MEHRDEUTIGKEITEN — Altbestand aus der PDF-Extraktion, nicht aus der Reform.
 *
 * Bei diesen fünf Artikeln ließ sich schon in der Vorgänger-Extraktion nicht sicher
 * rekonstruieren, welcher Betrag zu welcher Zeile gehört; sie tragen den Befund selbst
 * in ihrer Bemerkung („Best-effort Spaltenzuordnung; Originaltabelle zur Prüfung
 * empfohlen"). Keiner davon ist über den Refugium-Konfigurator erreichbar.
 *
 * Sie stehen hier namentlich, damit die Prüfung trotzdem scharf bleibt: Wird an einem
 * ANDEREN Artikel eine Mehrdeutigkeit eingebaut, schlägt sie fehl. Wird einer der fünf
 * anhand der gedruckten Preisliste bereinigt, gehört er aus dieser Liste gestrichen.
 */
const BEKANNTE_MEHRDEUTIGKEITEN = new Set([
  '10-001-0001', // Korpus (Atrium / Velare / Porticus) — Haupttabellen nicht zeilenweise zuzuordnen
  '10-001-0002', // Korpus Publicum — „Zeile 18 Raster nur teilweise eindeutig lesbar"
  '80-034-0001', // Tischplatte Massiv Nussbaum — vier Staffelpreise ohne Achse
  '80-034-0002', // Tischplatte Massiv Wildeiche — dito
  '80-035-0001', // Atlas Zentralfuss — drei Größen, im Preisblatt nicht unterschieden
])

const doppelt = []
const bekanntBetroffen = new Set()
for (const a of artikel) {
  // Artikel ganz ohne Achsen führen bewusst mehrere Zeilen — dort ist Mehrdeutigkeit
  // kein Befund, sondern der bekannte Zustand.
  if (a.achsen.length === 0) continue
  const gesehen = new Set()
  for (const z of zeilenNachArtikel.get(a.artikelnummer) ?? []) {
    const key = a.achsen.map((_, i) => (z.a[i] ?? '').trim()).join('|')
    if (!gesehen.has(key)) {
      gesehen.add(key)
      continue
    }
    if (BEKANNTE_MEHRDEUTIGKEITEN.has(a.artikelnummer)) bekanntBetroffen.add(a.artikelnummer)
    else doppelt.push(`${a.artikelnummer} [${key}]`)
  }
}
pruefe(doppelt.length === 0, 'Keine neuen Preiszeilen mit identischen Achsenwerten', doppelt.slice(0, 5).join(' · '))
if (bekanntBetroffen.size > 0) {
  console.log(
    c.dim(
      `    bekannt und unverändert (Altbestand der Extraktion): ${[...bekanntBetroffen].join(', ')}`,
    ),
  )
}

console.log(
  fehler === 0
    ? c.green(c.bold('\nAlle Prüfungen bestanden.\n'))
    : c.red(c.bold(`\n${fehler} Prüfung(en) fehlgeschlagen.\n`)),
)
process.exit(fehler === 0 ? 0 : 1)
