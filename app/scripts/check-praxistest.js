#!/usr/bin/env node
/**
 * PRAXISTEST — 20 Entwürfe, jede Position gegen die Stammdaten.
 *
 * Die übrigen Prüfskripte vergleichen Gesamtsummen gegen feste Sollwerte. Das genügt
 * nicht, um zu zeigen, dass der Konfigurator das Preisblatt WIRKLICH liest: Eine
 * Position kann zufällig stimmen, obwohl die falsche Zeile gezogen wurde.
 *
 * Dieses Skript rechnet deshalb jede Position ein zweites Mal nach — nicht über
 * `findePreis()`, sondern direkt über das rohe `preise`-Array aus
 * `stammdaten.generated.ts`. Gesucht wird die Zeile, die zu Artikelnummer UND allen
 * ausgewiesenen Achsenwerten passt; ihr Betrag muss der Betrag der Position sein.
 * Stimmt beides überein, ist ausgeschlossen, dass ein stiller Fallback (wie der frühere
 * „immer Glatt1") greift.
 *
 * Geprüft wird je Entwurf:
 *   1. Jeder Teilbetrag steckt so in den Stammdaten (Artikel + Achsen ⇒ genau diese Zeile)
 *   2. Teilbetrag  = Stammdatenpreis × Menge          (auf den Cent)
 *   3. Position    = Summe ihrer Teilbeträge          (auf den Cent)
 *   4. Möbelpreis  = Summe aller Positionen           (auf den Cent)
 *   5. Gesamt      = Möbelpreis + Zuschläge           (auf den Cent)
 *
 *   npm run praxis:test            # Übersicht
 *   npm run praxis:test -- --voll  # zusätzlich jede Position einzeln
 */

import { berechneEntwurf } from '../src/lib/kalkulation.ts'
import { praxistestEntwuerfe } from '../src/data/praxistestEntwuerfe.ts'
import { artikel, preise } from '../src/data/stammdaten.generated.ts'

const voll = process.argv.includes('--voll')

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
}

const eur = (n) =>
  n == null ? '—' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** Cent-genau: alles unter einem halben Cent gilt als gleich. */
const gleich = (a, b) => a != null && b != null && Math.abs(a - b) < 0.005

const artikelNachNummer = new Map(artikel.map((a) => [a.artikelnummer, a]))
const zeilenNachArtikel = new Map()
for (const zeile of preise) {
  const liste = zeilenNachArtikel.get(zeile.artikel)
  if (liste) liste.push(zeile)
  else zeilenNachArtikel.set(zeile.artikel, [zeile])
}

/**
 * Die Preiszeilen, die zu Artikel + ausgewiesenen Achsenwerten passen.
 *
 * Die PREISART-Achse bleibt außen vor: Sie unterscheidet die Teilbeträge einer
 * Position (Grundpreis / je Meter / je m²) und darf deshalb nicht mitfiltern.
 */
function passendeZeilen(position) {
  const art = artikelNachNummer.get(position.artikelnummer)
  if (!art) return { fehler: `Artikel ${position.artikelnummer} steht nicht im Stamm.`, zeilen: [] }
  const zeilen = (zeilenNachArtikel.get(position.artikelnummer) ?? []).filter((zeile) =>
    position.achsen.every((achse, index) => {
      if (achse.code === 'PREISART') return true
      return String(zeile.a[index] ?? '') === String(achse.wert ?? '')
    }),
  )
  return { zeilen }
}

let fehler = 0
let geprueft = 0
const offeneGesamt = []
const meldungenGesamt = []
const uebersicht = []

function melde(entwurf, text) {
  fehler++
  console.log(`      ${c.red('✗')} ${text}`)
  meldungenGesamt.push(`${entwurf.id}: ${text}`)
}

console.log(c.bold('\nPRAXISTEST — 20 Entwürfe gegen die Stammdaten'))
console.log(c.dim(`  ${praxistestEntwuerfe.length} Entwürfe · ${preise.length} Preiszeilen · ${artikel.length} Artikel\n`))

for (const entwurf of praxistestEntwuerfe) {
  const e = berechneEntwurf(entwurf)
  const nummer = entwurf.id.replace('CRAMER-2026-', '')
  const offen = e.positionen.filter((p) => p.status !== 'berechnet')
  const berechnet = e.positionen.filter((p) => p.status === 'berechnet')

  console.log(
    `  ${c.cyan(nummer.padEnd(12))} ${entwurf.customerName.replace(/^Praxistest \d+ · /, '').slice(0, 52).padEnd(54)} ${eur(e.gesamt).padStart(12)} €`,
  )
  console.log(
    c.dim(
      `               ${e.positionen.length} Positionen · ${berechnet.length} bepreist · ` +
        `${offen.length} auf Anfrage · ${entwurf.dimensions.widthCm}×${entwurf.dimensions.heightCm}×${entwurf.dimensions.depthCm} cm`,
    ),
  )

  // --- 1–3) Jede Position gegen die Stammdaten -----------------------------------
  for (const p of berechnet) {
    const { fehler: artFehler, zeilen } = passendeZeilen(p)
    if (artFehler) {
      melde(entwurf, `${p.label}: ${artFehler}`)
      continue
    }
    if (zeilen.length === 0) {
      const achsenText = p.achsen.map((a) => `${a.code}=${a.wert}`).join(' · ')
      melde(entwurf, `${p.label} (${p.artikelnummer}): keine Stammdatenzeile für ${achsenText || 'diese Achsen'}.`)
      continue
    }

    const betraege = new Set(zeilen.map((z) => z.preis))
    for (const teil of p.teile) {
      geprueft++
      if (!betraege.has(teil.preis)) {
        melde(
          entwurf,
          `${p.label} (${p.artikelnummer}): Teilbetrag ${eur(teil.preis)} € steht nicht in den Stammdaten ` +
            `(dort: ${[...betraege].map(eur).join(' / ')} €).`,
        )
        continue
      }
      if (!gleich(teil.gesamt, teil.preis * teil.menge)) {
        melde(
          entwurf,
          `${p.label}: ${eur(teil.preis)} € × ${teil.menge} ergibt ${eur(teil.preis * teil.menge)} €, ` +
            `die Position weist ${eur(teil.gesamt)} € aus.`,
        )
      }
    }

    const summeTeile = p.teile.reduce((s, t) => s + t.gesamt, 0)
    if (!gleich(p.gesamt, summeTeile)) {
      melde(entwurf, `${p.label}: Positionsbetrag ${eur(p.gesamt)} € ≠ Summe der Teilbeträge ${eur(summeTeile)} €.`)
    }

    if (voll) {
      const achsenText = p.achsen.filter((a) => a.wert).map((a) => `${a.code}=${a.wert}`).join(' · ')
      console.log(
        c.dim(
          `      ${c.green('✓')} ${p.label.slice(0, 38).padEnd(38)} ${(p.artikelnummer ?? '').padEnd(14)} ` +
            `${String(p.menge).padStart(3)} × ${eur(p.einzelpreis).padStart(10)} = ${eur(p.gesamt).padStart(11)} €  ${achsenText}`,
        ),
      )
    }
  }

  // --- 4) Möbelpreis = Summe der Positionen --------------------------------------
  const summePositionen = berechnet.reduce((s, p) => s + (p.gesamt ?? 0), 0)
  if (!gleich(e.moebelpreis, summePositionen)) {
    melde(entwurf, `Möbelpreis ${eur(e.moebelpreis)} € ≠ Summe der Positionen ${eur(summePositionen)} €.`)
  }

  // --- 5) Gesamt = Möbelpreis + Zuschläge ----------------------------------------
  const summeZuschlaege = e.zuschlaege.reduce((s, z) => s + (z.gesamt ?? 0), 0)
  if (!gleich(e.gesamt, e.moebelpreis + summeZuschlaege)) {
    melde(
      entwurf,
      `Gesamt ${eur(e.gesamt)} € ≠ Möbelpreis ${eur(e.moebelpreis)} € + Zuschläge ${eur(summeZuschlaege)} €.`,
    )
  }

  for (const p of offen) {
    offeneGesamt.push({ entwurf: nummer, label: p.label, artikel: p.artikelnummer, grund: p.hinweis ?? '' })
  }
  for (const m of e.meldungen.filter((m) => m.schwere === 'fehler')) {
    offeneGesamt.push({ entwurf: nummer, label: '(Meldung)', artikel: '', grund: m.text })
  }

  uebersicht.push({
    id: entwurf.id,
    titel: entwurf.customerName.replace(/^Praxistest \d+ · /, ''),
    masse: `${entwurf.dimensions.widthCm} × ${entwurf.dimensions.heightCm} × ${entwurf.dimensions.depthCm}`,
    positionen: e.positionen.length,
    offen: offen.length,
    moebelpreis: e.moebelpreis,
    gesamt: e.gesamt,
  })
}

// --- Auswertung -------------------------------------------------------------------

if (offeneGesamt.length) {
  console.log(c.bold(`\n  Positionen ohne Preis (${offeneGesamt.length}) — kein Rechenfehler, sondern eine Lücke im Stamm:`))
  const gruppiert = new Map()
  for (const o of offeneGesamt) {
    const schluessel = `${o.label} · ${o.grund}`.slice(0, 150)
    const eintrag = gruppiert.get(schluessel)
    if (eintrag) eintrag.push(o.entwurf)
    else gruppiert.set(schluessel, [o.entwurf])
  }
  for (const [text, entwuerfe] of gruppiert) {
    console.log(c.yellow(`    ! ${text}`))
    console.log(c.dim(`      betrifft: ${entwuerfe.join(', ')}`))
  }
}

console.log(c.bold('\n  Übersicht'))
console.log(
  c.dim(`    ${'Entwurf'.padEnd(24)} ${'Maße (B×H×T)'.padEnd(18)} ${'Pos.'.padStart(5)} ${'offen'.padStart(6)} ${'Möbelpreis'.padStart(14)} ${'Gesamt'.padStart(14)}`),
)
for (const u of uebersicht) {
  console.log(
    `    ${u.id.replace('CRAMER-2026-', '').padEnd(24)} ${u.masse.padEnd(18)} ${String(u.positionen).padStart(5)} ${String(u.offen).padStart(6)} ${eur(u.moebelpreis).padStart(14)} ${eur(u.gesamt).padStart(14)}`,
  )
}
const summeAlle = uebersicht.reduce((s, u) => s + (u.gesamt ?? 0), 0)
console.log(c.dim(`    ${'─'.repeat(88)}`))
console.log(`    ${'Summe aller 20 Entwürfe'.padEnd(55)} ${eur(summeAlle).padStart(28)}`)

console.log(
  fehler === 0
    ? c.green(`\n  ${geprueft} Teilbeträge gegen die Stammdaten geprüft — keine Abweichung.\n`)
    : c.red(`\n  ${fehler} Abweichung(en) bei ${geprueft} geprüften Teilbeträgen.\n`),
)
process.exitCode = fehler ? 1 : 0
