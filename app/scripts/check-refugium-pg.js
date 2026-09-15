#!/usr/bin/env node
/**
 * PRÜFUNG — Preisgruppen der Refugium-Innenausstattung.
 *
 * Fünf Fragen, die nach der Umstellung beantwortet sein müssen:
 *
 *   A  Stehen für jeden betroffenen Artikel PG1–PG4 als Preiszeilen im Stamm, und
 *      entsprechen die Beträge dem Basispreis × 1,00 / 1,30 / 1,40 / 1,50?
 *   B  Wechselt der Berater die Innenausführung, wechselt dann auch die Preisgruppe —
 *      und werden ALLE betroffenen Teile neu bewertet?
 *   C  Bleiben nicht betroffene Artikel preislich unberührt?
 *   D  Bleiben andere Möbelfamilien (Atrium, Velare, Publicum) unberührt?
 *   E  Ist „Korpus außen" verschwunden — als Schritt UND als Voraussetzung für Preise?
 *
 *   npm run pg:test
 */

import { berechneEntwurf } from '../src/lib/kalkulation.ts'
import { demoEntwurf } from '../src/data/demoEntwurf.ts'
import { artikel, preise } from '../src/data/stammdaten.generated.ts'
import { getVisibleKorpusAreas } from '../src/config/korpus.ts'
import { getSeries } from '../src/config/productCatalog.ts'
import { BETROFFENE_ARTIKEL, PG_FAKTOREN, PG_STUFEN, runde2 } from './lib/refugium-pg.js'
import {
  ATRIUM,
  BREITEN,
  REFUGIUM_KORPUS_ARTIKEL,
  SEITE_BREITE,
  SONDERHOEHE_FAKTOR,
  TIEFEN,
} from './lib/refugium-korpus.js'

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
}

let fehler = 0
function pruefe(bedingung, text, detail) {
  if (bedingung) {
    console.log(`  ${c.green('✓')} ${text}`)
  } else {
    fehler += 1
    console.log(`  ${c.red('✗')} ${text}${detail ? c.red(`  — ${detail}`) : ''}`)
  }
}

const klon = (d) => JSON.parse(JSON.stringify(d))
const artikelVon = (nr) => artikel.find((a) => a.artikelnummer === nr)
const zeilenVon = (nr) => preise.filter((p) => p.artikel === nr)

/** Entwurf mit einer bestimmten Innenausführung. */
function mitInnenausfuehrung(gruppe, option, pg) {
  const d = klon(demoEntwurf)
  d.korpus.innen = { materialGroupId: gruppe, optionId: option, priceGroup: pg }
  return d
}

/** Betrag einer Position, über die Artikelnummer gefunden. */
function betrag(ergebnis, artikelnummer) {
  return ergebnis.positionen.filter((p) => p.artikelnummer === artikelnummer).reduce((s, p) => s + (p.gesamt ?? 0), 0)
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nA — Preiszeilen und Beträge im Stamm'))
// ---------------------------------------------------------------------------
for (const nr of Object.keys(BETROFFENE_ARTIKEL)) {
  const a = artikelVon(nr)
  const idx = a?.achsen.indexOf('PG') ?? -1
  if (!a || idx < 0) {
    pruefe(false, `${nr} trägt eine PG-Achse`, 'Achse fehlt — Migration gelaufen?')
    continue
  }
  const zeilen = zeilenVon(nr)
  const basis = zeilen.filter((z) => z.a[idx] === 'PG1')
  let stimmt = basis.length > 0
  let abweichung = ''
  for (const b of basis) {
    for (const stufe of PG_STUFEN.slice(1)) {
      // Dieselbe Zelle, nur andere Preisgruppe: alle übrigen Achsen müssen gleich sein.
      const partner = zeilen.find((z) => z.a[idx] === stufe && z.a.every((v, i) => i === idx || v === b.a[i]))
      const soll = runde2(b.preis * PG_FAKTOREN[stufe])
      if (!partner) {
        stimmt = false
        abweichung = `${stufe} fehlt für ${b.a.filter(Boolean).join(' / ')}`
      } else if (partner.preis !== soll) {
        stimmt = false
        abweichung = `${stufe} ist ${partner.preis}, erwartet ${soll}`
      }
    }
  }
  pruefe(stimmt, `${nr}  ${basis.length} Basiszeile(n) × 4 Preisgruppen  ${c.dim(a.bezeichnung)}`, abweichung)
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nB — Materialwechsel schlägt auf die Preise durch'))
// ---------------------------------------------------------------------------
const INNENSCHUBLADE = '40-016-0001'
const varianten = [
  ['decoboard', 'interior-white-w10100sd', 'PG1'],
  ['mattlack', 'schwarzgrau-ral-7021', 'PG2'],
  ['furnier', undefined, 'PG3'],
  ['xtreme-plus', undefined, 'PG4'],
]
const basisErgebnis = berechneEntwurf(mitInnenausfuehrung(...varianten[0]))
const basisBetrag = betrag(basisErgebnis, INNENSCHUBLADE)
pruefe(basisBetrag > 0, `PG1 liefert einen Betrag für die Innenschublade (${basisBetrag.toFixed(2)} €)`)

for (const [gruppe, option, pg] of varianten) {
  const ergebnis = berechneEntwurf(mitInnenausfuehrung(gruppe, option, pg))
  const ist = betrag(ergebnis, INNENSCHUBLADE)
  const soll = runde2(basisBetrag * PG_FAKTOREN[pg])
  pruefe(
    Math.abs(ist - soll) < 0.005,
    `Innenausführung ${gruppe.padEnd(12)} → ${pg} → ${ist.toFixed(2)} €`,
    ist === soll ? '' : `erwartet ${soll.toFixed(2)} €`,
  )
  // Der Preis muss aus der gespeicherten Zeile kommen, nicht aus einer Rechnung:
  // die Position weist die benutzte PG als Achse aus.
  const position = ergebnis.positionen.find((p) => p.artikelnummer === INNENSCHUBLADE)
  const achse = position?.achsen.find((x) => x.code === 'PG')
  pruefe(achse?.wert === pg, `  … und stammt aus der Preiszeile mit Achse PG = ${pg}`, `Achse zeigt „${achse?.wert ?? '—'}"`)
}

const gesamtPg1 = berechneEntwurf(mitInnenausfuehrung(...varianten[0])).gesamt
const gesamtPg4 = berechneEntwurf(mitInnenausfuehrung(...varianten[3])).gesamt
pruefe(gesamtPg4 > gesamtPg1, `Gesamtpreis folgt dem Materialwechsel (${gesamtPg1.toFixed(2)} € → ${gesamtPg4.toFixed(2)} €)`)

// ---------------------------------------------------------------------------
console.log(c.bold('\nC — Nicht betroffene Artikel bleiben unverändert'))
// ---------------------------------------------------------------------------
const UNBETROFFEN = ['40-014-0001', '40-015-0002', '40-018-0001', '50-024-0006']
for (const nr of UNBETROFFEN) {
  const werte = varianten.map(([g, o, pg]) => betrag(berechneEntwurf(mitInnenausfuehrung(g, o, pg)), nr))
  const gleich = werte.every((w) => Math.abs(w - werte[0]) < 0.005)
  pruefe(gleich, `${nr} unverändert über alle vier Preisgruppen (${werte[0].toFixed(2)} €)  ${c.dim(artikelVon(nr)?.bezeichnung ?? '')}`, werte.join(' / '))
  pruefe(!artikelVon(nr)?.achsen.includes('PG'), `${nr} hat KEINE PG-Achse bekommen`)
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nD — Andere Möbelfamilien unberührt'))
// ---------------------------------------------------------------------------
// Jeder Artikel, der eine PG-Achse trägt, ohne dass er migriert wurde, muss sie schon
// vorher gehabt haben. Kontrolle über den Modus: die Migration fasst nur Refugium an.
const migriert = new Set(Object.keys(BETROFFENE_ARTIKEL))
const fremdeMitPg = artikel.filter((a) => a.achsen.includes('PG') && !migriert.has(a.artikelnummer))
pruefe(
  fremdeMitPg.every((a) => a.artikelnummer !== ''),
  `${fremdeMitPg.length} Artikel anderer Serien führen weiterhin ihre eigene PG-Achse`,
)
const nurRefugiumMigriert = [...migriert].every((nr) => /R/.test(artikelVon(nr)?.modus ?? ''))
pruefe(nurRefugiumMigriert, 'Alle migrierten Artikel sind für Refugium freigegeben (Modus enthält „R")')
const atriumKorpus = zeilenVon('10-001-0001')
pruefe(atriumKorpus.length > 0, `Atrium-Korpus 10-001-0001 unverändert im Stamm (${atriumKorpus.length} Preiszeilen)`)

// ---------------------------------------------------------------------------
console.log(c.bold('\nE — „Korpus außen" ist vollständig entfernt'))
// ---------------------------------------------------------------------------
const refugium = getSeries('kleiderschraenke', 'refugium')
for (const modus of ['komplett', 'getrennt']) {
  const bereiche = getVisibleKorpusAreas(refugium, modus).map((a) => a.id)
  pruefe(
    !bereiche.some((id) => id.startsWith('aussen')),
    `Refugium (Modus „${modus}") zeigt keinen Außenkorpus-Bereich  ${c.dim(bereiche.join(', '))}`,
  )
}
const atrium = getSeries('kleiderschraenke', 'atrium') ?? getSeries('sideboards', 'atrium')
if (atrium) {
  const bereicheAtrium = getVisibleKorpusAreas(atrium, 'komplett').map((a) => a.id)
  pruefe(bereicheAtrium.includes('aussen'), `Atrium behält seinen Außenkorpus  ${c.dim(bereicheAtrium.join(', '))}`)
}

// Ein Entwurf ganz OHNE `korpus.aussen` muss das Außenset trotzdem bepreisen —
// die Preisgruppe kommt jetzt aus dem Abschlussset.
const ohneAussen = klon(demoEntwurf)
delete ohneAussen.korpus.aussen
const ergebnisOhne = berechneEntwurf(ohneAussen)
const aussenset = ergebnisOhne.positionen.find((p) => p.bucket === 'aussenset')
pruefe(
  aussenset?.status === 'berechnet',
  `Außenset wird ohne „Korpus außen" bepreist (${aussenset?.gesamt?.toFixed(2) ?? '—'} €, PG aus dem Abschlussset)`,
  aussenset?.hinweis,
)
pruefe(
  !ergebnisOhne.meldungen.some((m) => /Außenkorpus/.test(m.text)),
  'Keine Meldung verlangt noch ein Material des Außenkorpus',
)
// Altbestand: Ein Entwurf ohne Abschlussset-Material fällt weiterhin auf `korpus.aussen`
// zurück und behält damit exakt seinen bisherigen Preis.
const altbestand = klon(demoEntwurf)
delete altbestand.korpusGrunddaten.abschlussSet.material
const ergebnisAlt = berechneEntwurf(altbestand)
const aussensetAlt = ergebnisAlt.positionen.find((p) => p.bucket === 'aussenset')
pruefe(
  aussensetAlt?.gesamt === aussenset?.gesamt,
  `Alt-Entwurf ohne Abschlussset-Material behält seinen Außenset-Preis (${aussensetAlt?.gesamt?.toFixed(2) ?? '—'} €)`,
)

// ---------------------------------------------------------------------------
console.log(c.bold('\nF — Korpus: BREITE × RASTER × TIEFE × PG'))
// ---------------------------------------------------------------------------
const korpus = artikelVon(REFUGIUM_KORPUS_ARTIKEL)
const kZeilen = zeilenVon(REFUGIUM_KORPUS_ARTIKEL)
const iB = korpus?.achsen.indexOf('BREITE') ?? -1
const iR = korpus?.achsen.indexOf('RASTER') ?? -1
const iT = korpus?.achsen.indexOf('TIEFE') ?? -1
const iP = korpus?.achsen.indexOf('PG') ?? -1

pruefe(
  korpus?.achsen.join(' × ') === 'BREITE × RASTER × TIEFE × PG',
  `Achsen: ${korpus?.achsen.join(' × ') ?? '—'}`,
)
// 4 Breitenwerte (3 Korpi + Seite) × 2 Raster × 3 Tiefen × 4 Preisgruppen
pruefe(kZeilen.length === 96, `${kZeilen.length} Preiszeilen (erwartet 96 = 4 × 2 × 3 × 4)`)

const korpusPreis = (breite, raster, tiefe, pg) =>
  kZeilen.find(
    (z) => z.a[iB] === breite && z.a[iR] === String(raster) && z.a[iT] === tiefe && z.a[iP] === pg,
  )?.preis

// Lückenlosigkeit
const luecken = []
for (const breite of [...BREITEN, SEITE_BREITE]) {
  for (const raster of [18, 21]) {
    for (const tiefe of TIEFEN) {
      for (const pg of PG_STUFEN) {
        if (korpusPreis(breite, raster, tiefe, pg) == null) luecken.push(`${breite}/${raster}R/${tiefe}/${pg}`)
      }
    }
  }
}
pruefe(luecken.length === 0, 'Jede Kombination hat genau eine Preiszeile', luecken.slice(0, 5).join(', '))

// Regel 2: PG 1 ist über alle drei Tiefen gleich — aber als getrennte Zeilen gespeichert.
for (const breite of BREITEN) {
  for (const raster of [18, 21]) {
    const werte = TIEFEN.map((t) => korpusPreis(breite, raster, t, 'PG1'))
    pruefe(
      werte.every((w) => w === werte[0]) && werte[0] != null,
      `PG1 ${breite} · ${raster} R: alle drei Tiefen ${werte[0]} € — eigene Zeile je Tiefe`,
      werte.join(' / '),
    )
  }
}

// Regel 3: PG 2–4 bei 18 Rastern = Atrium-Preis derselben Breite und Tiefe.
let atriumTreffer = 0
const atriumAbweichung = []
for (const breite of [...BREITEN, SEITE_BREITE]) {
  for (const tiefe of TIEFEN) {
    for (const pg of PG_STUFEN) {
      // Für die Bauteilseite gilt die Atrium-Quelle auch in PG 1 — dort gibt es keinen
      // gedruckten Refugium-Preis.
      if (pg === 'PG1' && breite !== SEITE_BREITE) continue
      const soll = ATRIUM[tiefe][breite][18][pg]
      const ist = korpusPreis(breite, 18, tiefe, pg)
      if (ist === soll) atriumTreffer += 1
      else atriumAbweichung.push(`${breite}/${tiefe}/${pg}: ${ist} statt ${soll}`)
    }
  }
}
pruefe(
  atriumAbweichung.length === 0,
  `${atriumTreffer} Werte stimmen mit der Atrium-Preisliste (S. 13/14/15) überein`,
  atriumAbweichung.slice(0, 3).join(' · '),
)

// Regel: 21 Raster = 18 Raster × 1,20 — aber NUR wo kein gedruckter Preis existiert.
const sonderAbweichung = []
for (const breite of [...BREITEN, SEITE_BREITE]) {
  for (const tiefe of TIEFEN) {
    for (const pg of PG_STUFEN) {
      if (pg === 'PG1' && breite !== SEITE_BREITE) continue
      const soll = runde2(korpusPreis(breite, 18, tiefe, pg) * SONDERHOEHE_FAKTOR)
      const ist = korpusPreis(breite, 21, tiefe, pg)
      if (ist !== soll) sonderAbweichung.push(`${breite}/${tiefe}/${pg}: ${ist} statt ${soll}`)
    }
  }
}
pruefe(sonderAbweichung.length === 0, '21 Raster = 18 Raster × 1,20 (PG 2–4 und Bauteilseite)', sonderAbweichung.slice(0, 3).join(' · '))

// PG 1 behält die GEDRUCKTEN 21-Raster-Preise und wird nicht überrechnet.
const gedruckt = { '50er': [237, 285], '60er': [258, 309], '100er': [309, 372] }
for (const [breite, [p18, p21]] of Object.entries(gedruckt)) {
  const ist18 = korpusPreis(breite, 18, '60', 'PG1')
  const ist21 = korpusPreis(breite, 21, '60', 'PG1')
  pruefe(
    ist18 === p18 && ist21 === p21,
    `PG1 ${breite}: gedruckte Preise erhalten (18 R = ${ist18} €, 21 R = ${ist21} € ≠ ${runde2(p18 * 1.2)} €)`,
  )
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nG — Korpus in der Kalkulation'))
// ---------------------------------------------------------------------------
/** Entwurf mit fester Tiefe und Innenausführung. */
function mitTiefe(tiefeCm, pg) {
  const d = mitInnenausfuehrung('decoboard', 'interior-white-w10100sd', pg)
  d.korpusGrunddaten.depthMode = 'custom'
  d.korpusGrunddaten.depthCm = String(tiefeCm)
  return d
}
// Der Demo-Entwurf hat 60er-Korpi bei 18 Rastern; erwartet wird die Zeile 60er/18/60/PG.
function korpusPos(ergebnis) {
  return ergebnis.positionen.find((p) => p.label === 'Korpus 1')
}

const eDeco = berechneEntwurf(mitInnenausfuehrung('decoboard', 'interior-white-w10100sd', 'PG1'))
pruefe(korpusPos(eDeco)?.einzelpreis === 258, `Decoboard 60er/18 R/60 cm → ${korpusPos(eDeco)?.einzelpreis} € (gedruckt 258 €)`)

const eLack = berechneEntwurf(mitInnenausfuehrung('mattlack', 'schwarzgrau-ral-7021', 'PG2'))
pruefe(
  korpusPos(eLack)?.einzelpreis === ATRIUM['60']['60er'][18].PG2,
  `Mattlack → ${korpusPos(eLack)?.einzelpreis} € (Atrium 60 cm/60er/18 R/PG2 = ${ATRIUM['60']['60er'][18].PG2} €)`,
)
const achsenLack = korpusPos(eLack)?.achsen ?? []
pruefe(
  achsenLack.find((a) => a.code === 'TIEFE')?.wert === '60' && achsenLack.find((a) => a.code === 'PG')?.wert === 'PG2',
  `  … und weist die Achsen aus: ${achsenLack.map((a) => `${a.code}=${a.wert}`).join(' · ')}`,
)

// Nächstgrößeres Maß: 45 cm gibt es nicht, 60 cm schon.
const e45 = berechneEntwurf(mitTiefe(45, 'PG1'))
pruefe(
  korpusPos(e45)?.achsen.find((a) => a.code === 'TIEFE')?.wert === '60',
  `Tiefe 45 cm wird auf die Stufe 60 cm gehoben (${korpusPos(e45)?.einzelpreis} €)`,
)
const e31 = berechneEntwurf(mitTiefe(31, 'PG1'))
pruefe(
  korpusPos(e31)?.achsen.find((a) => a.code === 'TIEFE')?.wert === '31',
  `Tiefe 31 cm trifft die Stufe 31 cm genau (${korpusPos(e31)?.einzelpreis} €)`,
)
const e31Lack = berechneEntwurf((() => { const d = mitTiefe(31, 'PG2'); d.korpus.innen.materialGroupId = 'mattlack'; return d })())
pruefe(
  korpusPos(e31Lack)?.einzelpreis === ATRIUM['31']['60er'][18].PG2,
  `Tiefe 31 cm + Mattlack → ${korpusPos(e31Lack)?.einzelpreis} € (Atrium S. 13 = ${ATRIUM['31']['60er'][18].PG2} €)`,
)
// Decoboard bleibt über alle Tiefen preisgleich.
const decoTiefen = [31, 41, 60].map((t) => korpusPos(berechneEntwurf(mitTiefe(t, 'PG1')))?.einzelpreis)
pruefe(
  decoTiefen.every((v) => v === decoTiefen[0]),
  `Decoboard ist über 31/41/60 cm preisgleich (${decoTiefen.join(' / ')} €)`,
)

// ---------------------------------------------------------------------------
console.log(
  fehler === 0
    ? c.green(c.bold('\nAlle Prüfungen bestanden.\n'))
    : c.red(c.bold(`\n${fehler} Prüfung(en) fehlgeschlagen.\n`)),
)
process.exit(fehler === 0 ? 0 : 1)
