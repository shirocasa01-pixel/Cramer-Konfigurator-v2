/**
 * PREISPROBE — Konfigurator gegen die gedruckte Cramer-Preisliste.
 *
 * Gegenstand ist der Schrank aus „Cramer Planer_Überarbeitung Preise.pdf": der
 * Shop-Artikel 23855.44 „Refugium Kleiderschrank mit Standard-Ausstattung" —
 * 3 × 100er Korpus, 18 Raster (230 cm), Decoboard Schwarz, je Segment zwei Drehtüren
 * mit Bügelgriff, ein Einlegeboden und ein Einlegeboden inkl. Kleiderstange,
 * ohne Beleuchtung, ohne Montage.
 *
 * Der Entwurf wird durch die NORMALE Engine gerechnet; kein Preis wird hier gesetzt.
 * Verglichen wird gegen 3.275 € — den VK laut Preisliste. (Die 2.790 € auf der ersten
 * PDF-Seite sind der Shop-Preis und laut Fachberater falsch.)
 *
 *     node scripts/check-preisprobe.js
 */

import { berechneEntwurf } from '../src/lib/kalkulation.ts'
import { preisprobeEntwurf } from '../src/data/testEntwuerfe.ts'

/** VK laut Cramer-Preisliste (Vorgabe des Fachberaters). */
const ZIEL = 3275

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
}
const eur = (n) =>
  n == null ? 'auf Anfrage' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ergebnis = berechneEntwurf(preisprobeEntwurf)

console.log(c.bold('\nPREISPROBE — Refugium Standard (Shop-Artikel 23855.44)'))
console.log(c.dim(`  ${preisprobeEntwurf.customerName} · Preisliste ${ergebnis.gueltigkeit}\n`))

// Gleichartige Positionen zusammenfassen — die Liste soll lesbar bleiben.
const gruppen = new Map()
for (const p of ergebnis.positionen) {
  const schluessel = p.label.replace(/ „[^"]+"$/, '')
  const g = gruppen.get(schluessel) ?? { menge: 0, einzel: p.einzelpreis, gesamt: 0, artikel: p.artikelnummer }
  g.menge += p.menge
  g.gesamt += p.gesamt ?? 0
  gruppen.set(schluessel, g)
}

console.log(`  ${'Position'.padEnd(34)}${'Artikel'.padEnd(16)}${'Menge'.padStart(6)}${'Einzel'.padStart(12)}${'Betrag'.padStart(13)}`)
console.log('  ' + '─'.repeat(79))
for (const [label, g] of gruppen) {
  console.log(
    `  ${label.slice(0, 33).padEnd(34)}${c.dim((g.artikel ?? '—').padEnd(16))}${String(g.menge).padStart(4)} ×${eur(g.einzel).padStart(12)}${eur(g.gesamt).padStart(13)}`,
  )
}
console.log('  ' + '─'.repeat(79))
console.log(`  ${'Möbelpreis (Konfigurator)'.padEnd(56)}${eur(ergebnis.moebelpreis).padStart(23)}`)
console.log(`  ${'GESAMT (Konfigurator)'.padEnd(56)}${c.bold(eur(ergebnis.gesamt).padStart(23))}`)
console.log(`  ${'ZIEL laut Cramer-Preisliste'.padEnd(56)}${eur(ZIEL).padStart(23)}`)

const differenz = ergebnis.gesamt - ZIEL
const marke = differenz === 0 ? c.green('✓') : c.red('✗')
console.log(`  ${marke} ${'Abweichung'.padEnd(54)}${(differenz > 0 ? '+' : '') + eur(differenz).padStart(22)}`)

if (ergebnis.meldungen.length) {
  console.log(c.bold('\n  Meldungen:'))
  for (const m of ergebnis.meldungen) {
    const farbe = m.schwere === 'fehler' ? c.red : m.schwere === 'warnung' ? c.yellow : c.dim
    console.log(farbe(`    [${m.schwere.padEnd(8)}] ${m.text}`))
  }
}
console.log('')

process.exitCode = differenz === 0 ? 0 : 1
