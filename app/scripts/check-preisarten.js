#!/usr/bin/env node
/**
 * PRÜFUNG — Preisarten, Aufschläge, Montage und Lieferung (Überarbeitung 09/2026).
 *
 * Jede Preisart mit einem konkreten Artikel aus dem Stamm, dazu die zweistufige
 * Kalkulation und die Frage, ob Artikelverwaltung, Konfigurator, Kalkulation und PDF
 * dasselbe zeigen:
 *
 *   A  Stamm: jeder Artikel trägt eine der sechs Preisarten, Preiszeilen passen dazu
 *   B  Lookup-Audit: jede Zuordnung des Konfigurators trifft einen aktiven Artikel
 *   C  Festpreis
 *   D  Matrix – Stufenpreis (hinterlegte Stufe, keine pauschale Aufrundung)
 *   E  Matrix – Maßgenau (tatsächliches Maß, keine Interpolation)
 *   F  Festpreis + Matrix (Grundpreis und variabler Preis getrennt)
 *   G  Zweistufige Kalkulation — das Beispiel aus der Vorgabe: 3.000 + 200 → 3.616 €
 *   H  Montage und Lieferung mit geänderten Sätzen, abwählbar, unabhängig voneinander
 *   I  Gesperrte Artikel und Altstände
 *   J  Supabase-Stand wirkt auf die Kalkulation
 *   K  Abschluss, Snapshot und PDF zeigen dieselben Zahlen
 *   L  Preisprobe der Verwaltung = Position der Kalkulation
 *   M  Antworten Cramer (23.09.2026): Edge-Länge, Wandtablar, Aufkantung, Container,
 *      Tavolo, Personalnummer M-104
 *
 *   npm run preisart:test
 */

import { artikel as stammArtikel, preise as stammPreise } from '../src/data/stammdaten.generated.ts'
import {
  aendereArtikel,
  getArtikelListe,
  getMitarbeiterListe,
  setzeAllesZurueck,
  uebernehmeServerStand,
} from '../src/lib/stammdatenStore.ts'
import { findePreis, getArtikelNr, preisartVon, preiszeilenVon } from '../src/lib/preisLookup.ts'
import { berechneEntwurf, bepreiseProbe } from '../src/lib/kalkulation.ts'
import { PREISART_CODES, leitePreisartAb, pruefePreisart } from '../src/lib/preisarten.ts'
import { aufgeloestePreise, erzeugePricingSnapshot } from '../src/lib/pricingSnapshot.ts'
import { kalkulationsUebersicht } from '../src/lib/kalkulationsUebersicht.ts'
import {
  artikelAufschlaege,
  ausstattungLookups,
  containerLookups,
  frontLookups,
  serienRegeln,
  serviceZuschlaege,
  verblendungLookups,
} from '../src/config/preisMapping.ts'
import { handles } from '../src/config/handles.ts'
import { demoEntwurf } from '../src/data/demoEntwurf.ts'

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
}
let fehler = 0
function pruefe(bedingung, text, detail) {
  console.log(`  ${bedingung ? c.green('✓') : c.red('✗')} ${text}`)
  if (!bedingung) {
    fehler++
    if (detail !== undefined) console.log(c.dim(`      ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`))
  }
}
const eur = (n) => (n == null ? '—' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const r2 = (n) => Math.round(n * 100) / 100
const probe = (nr, masse) => {
  const a = getArtikelNr(nr)
  return bepreiseProbe(a, preiszeilenVon(nr), masse)
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nA — Stamm: sechs Preisarten, Preiszeilen passen dazu'))
const codes = new Set(PREISART_CODES)
const fremd = stammArtikel.filter((a) => !codes.has(a.preislogik))
pruefe(fremd.length === 0, `Alle ${stammArtikel.length} Artikel tragen eine der sechs Preisarten`, fremd.map((a) => a.artikelnummer).slice(0, 5))
const verteilung = {}
for (const a of stammArtikel) verteilung[a.preislogik] = (verteilung[a.preislogik] ?? 0) + 1
console.log(c.dim(`    ${Object.entries(verteilung).map(([k, n]) => `${k} ${n}`).join(' · ')}`))
const zeilenJe = new Map()
for (const p of stammPreise) (zeilenJe.get(p.artikel) ?? zeilenJe.set(p.artikel, []).get(p.artikel)).push(p)
// Die Matrix-Preisarten sind genau das, was die Engine vorher aus den Zeilen ableitete.
const umgedeutet = stammArtikel.filter(
  (a) => a.preislogik.startsWith('MATRIX') || a.preislogik === 'FEST_PLUS_MATRIX',
).filter((a) => leitePreisartAb(a, zeilenJe.get(a.artikelnummer) ?? []) !== a.preislogik)
pruefe(umgedeutet.length === 0, 'Jede Matrix-Preisart entspricht der bisherigen Rechenweise (keine Umdeutung)', umgedeutet.map((a) => a.artikelnummer))
// Ohne Ausnahme: Die Tavolo-Massivplatten (vier €/m²-Zeilen ohne unterscheidende Achse)
// stehen seit dem 23.09.2026 auf „entwurf" / „Auf Anfrage" und fallen damit heraus.
const unstimmig = stammArtikel
  .filter((a) => a.status === 'aktiv' && a.preislogik !== 'AUF_ANFRAGE')
  .map((a) => [a, pruefePreisart(a, zeilenJe.get(a.artikelnummer) ?? [])])
  .filter(([, p]) => p.length > 0)
pruefe(unstimmig.length === 0, 'Preiszeilen passen zur Preisart (aktive Artikel)', unstimmig.map(([a, p]) => `${a.artikelnummer}: ${p[0]}`))

// ---------------------------------------------------------------------------
console.log(c.bold('\nB — Lookup-Audit: jede Zuordnung des Konfigurators'))
const zuordnungen = []
const refugium = serienRegeln.refugium
for (const [name, l] of Object.entries({ korpus: refugium.korpus, mittelseite: refugium.mittelseite, aussenset: refugium.aussenset, fussleistenausschnitt: refugium.fussleistenausschnitt })) {
  if (l) zuordnungen.push([`Refugium ${name}`, l.artikel, 'bauteil'])
}
for (const [id, l] of Object.entries(frontLookups)) zuordnungen.push([`Front ${id}`, l.artikel, 'bauteil'])
for (const [id, l] of Object.entries(ausstattungLookups)) {
  zuordnungen.push([`Ausstattung ${id}`, l.artikel, 'bauteil'])
  for (const k of l.komponenten ?? []) zuordnungen.push([`Ausstattung ${id} + ${k.label}`, k.artikel, 'bauteil'])
}
for (const [id, varianten] of Object.entries(containerLookups)) {
  for (const [v, l] of Object.entries(varianten)) {
    zuordnungen.push([`${id} ${v}`, l.artikel, 'bauteil'])
    if (l.artikelBeiAuswahl) zuordnungen.push([`${id} ${v} Rauchglas`, l.artikelBeiAuswahl, 'bauteil'])
  }
}
for (const [id, l] of Object.entries(verblendungLookups)) zuordnungen.push([`Verblendung ${id}`, l.artikel, 'bauteil'])
for (const z of artikelAufschlaege) zuordnungen.push([`Aufschlag ${z.art}`, z.artikel, 'aufschlag'])
for (const z of serviceZuschlaege) zuordnungen.push([`Zuschlag ${z.art}`, z.artikel, 'aufschlag'])

const fehlend = [], nichtAktiv = [], falscheArt = []
for (const [was, nr, rolle] of zuordnungen) {
  const a = getArtikelNr(nr)
  if (!a) { fehlend.push(`${was} → ${nr}`); continue }
  if (a.status !== 'aktiv') nichtAktiv.push(`${was} → ${nr} (${a.status})`)
  const art = preisartVon(a)
  if (rolle === 'aufschlag' ? art !== 'AUFSCHLAG' : art === 'AUFSCHLAG' || art === 'AUF_ANFRAGE') falscheArt.push(`${was} → ${nr} (${art})`)
}
pruefe(fehlend.length === 0, `${zuordnungen.length} Zuordnungen, jede trifft einen Artikel im Stamm`, fehlend)
pruefe(falscheArt.length === 0, 'Bauteile rechnen als Festpreis/Matrix, Zuschläge als Aufschlag', falscheArt)
pruefe(nichtAktiv.length === 0, 'Alle zugeordneten Artikel sind aktiv (Excel-Stand)', nichtAktiv)
// Griffe: jede Griff-Option des Konfigurators muss einen Griff-Artikel finden.
const griffArtikel = getArtikelListe().filter((a) => a.dropdown === 'GRIFF')
const ohneArtikel = handles
  .filter((h) => h.id !== 'sondergriff')
  .filter((h) => {
    const nr = /^nr(\d+)$/i.exec(h.id)?.[1]
    return !griffArtikel.some((a) => (nr ? new RegExp(`\\bNr\\.\\s*${nr}\\b`, 'i').test(a.bezeichnung) : /edge/i.test(a.bezeichnung)))
  })
pruefe(ohneArtikel.length === 0, `Alle ${handles.length - 1} Griff-Optionen finden ihren Artikel (Dropdown GRIFF)`, ohneArtikel.map((h) => h.id))
const edge = griffArtikel.find((a) => /edge/i.test(a.bezeichnung))
pruefe(edge && preisartVon(edge) === 'MATRIX_MASS', `Edge-Griff ${edge?.artikelnummer} rechnet maßgenau je Meter (40 €/m)`)

// ---------------------------------------------------------------------------
console.log(c.bold('\nC — Festpreis'))
const fuss = probe('50-027-0007', {})
pruefe(fuss.status === 'berechnet' && fuss.gesamt === 240 && fuss.preisart === 'FESTPREIS', `Fußleistenausschnitt 50-027-0007: ${eur(fuss.gesamt)} € (Preisliste S. 32: 240 €)`, fuss)
const fuss2 = probe('50-027-0007', { menge: 2 })
pruefe(fuss2.gesamt === 480, 'Menge 2 → 480 €', fuss2)

// ---------------------------------------------------------------------------
console.log(c.bold('\nD — Matrix – Stufenpreis'))
const k60 = probe('10-001-0003', { breiteCm: 60, hoeheCm: 235, tiefeCm: 60, pg: 'PG1' })
pruefe(k60.status === 'berechnet' && k60.gesamt === 258 && k60.preisart === 'MATRIX_STUFE', `Korpus Refugium 60er · 18 R · 60 cm · PG 1: ${eur(k60.gesamt)} € (258 €)`, k60)
const k55 = probe('10-001-0003', { breiteCm: 55, hoeheCm: 235, tiefeCm: 60, pg: 'PG1' })
pruefe(k55.gesamt === 258 && /gehoben/.test(k55.hinweis ?? ''), `55 cm → hinterlegte Stufe 60er: ${eur(k55.gesamt)} € (${k55.hinweis})`, k55)
const k50 = probe('10-001-0003', { breiteCm: 50, hoeheCm: 235, tiefeCm: 60, pg: 'PG1' })
pruefe(k50.status === 'berechnet' && k50.gesamt < 258, `50 cm bleibt 50er (${eur(k50.gesamt)} €) — keine pauschale Aufrundung`, k50)
// 1 cm Toleranz für gerundete Nennmaße (STUFEN_TOLERANZ_CM) — 101 cm ist noch der 100er.
const k102 = probe('10-001-0003', { breiteCm: 102, hoeheCm: 235, tiefeCm: 60, pg: 'PG1' })
pruefe(k102.status === 'auf-anfrage', `102 cm über der größten Stufe → auf Anfrage (${k102.grund?.slice(0, 60)}…)`, k102)
const kOhne = probe('10-001-0003', { hoeheCm: 235, tiefeCm: 60, pg: 'PG1' })
pruefe(kOhne.status === 'auf-anfrage', 'Ohne Breite wird keine Stufe geraten → auf Anfrage', kOhne)

// ---------------------------------------------------------------------------
console.log(c.bold('\nE — Matrix – Maßgenau'))
const v335 = probe('90-038-0002', { laengeCm: 335 })
pruefe(v335.status === 'berechnet' && v335.gesamt === 251.25 && v335.preisart === 'MATRIX_MASS', `Verblendung korpusbündig 3,35 m × 75 €/m = ${eur(v335.gesamt)} € (251,25 €)`, v335)
const v401 = probe('90-038-0002', { laengeCm: 401 })
pruefe(v401.gesamt === 300.75, `4,01 m × 75 €/m = ${eur(v401.gesamt)} € — nicht auf 5 m gerundet`, v401)
const lam = probe('40-022-0001', { laengeCm: 120, pg: 'PG2' })
pruefe(lam.gesamt === 1890, `Lamellen PG 2 · 1,2 m × 1.575 €/m = ${eur(lam.gesamt)} € (1.890 €)`, lam)
// Maßgenau mit hinterlegten Maßwerten: nur ein genau passender Wert zählt, keine Interpolation.
const synth = { ...getArtikelNr('90-038-0002'), artikelnummer: 'TEST-MASS', preislogik: 'MATRIX_MASS' }
const synthZeilen = [
  { artikel: 'TEST-MASS', a: ['100 cm', '€/m', '', '', ''], preis: 40, status: 'fixed', seite: '', ref: null },
  { artikel: 'TEST-MASS', a: ['200 cm', '€/m', '', '', ''], preis: 35, status: 'fixed', seite: '', ref: null },
]
const s150 = bepreiseProbe(synth, synthZeilen, { laengeCm: 150 })
pruefe(s150.status === 'auf-anfrage' && /interpoliert/.test(s150.grund), '150 cm zwischen den Zeilen 100/200 cm → auf Anfrage, nicht interpoliert', s150)
const s200 = bepreiseProbe(synth, synthZeilen, { laengeCm: 200 })
pruefe(s200.gesamt === 70, `200 cm genau hinterlegt → 2 m × 35 €/m = ${eur(s200.gesamt)} €`, s200)

// ---------------------------------------------------------------------------
console.log(c.bold('\nF — Festpreis + Matrix'))
const ws = probe('40-020-0008', { laengeCm: 150 })
pruefe(ws.status === 'berechnet' && ws.gesamt === 345 && ws.preisart === 'FEST_PLUS_MATRIX', `Wandsteckboden 1,5 m: 75 € + 1,5 m × 180 €/m = ${eur(ws.gesamt)} € (345 €)`, ws)
pruefe(
  ws.teile?.[0]?.bezeichnung === 'Grundpreis' && ws.teile[0].gesamt === 75 && ws.teile?.[1]?.bezeichnung === 'variabler Preis' && ws.teile[1].gesamt === 270,
  'Grundpreis (75 €) und variabler Preis (270 €) getrennt ausgewiesen',
  ws.teile,
)
const wp = probe('40-020-0007', { breiteCm: 100, tiefeCm: 200, pg: 'PG3' })
pruefe(wp.gesamt === 615, `Wandpaneel PG 3 · 1,0 × 2,0 m: 75 € + 2 m² × 270 €/m² = ${eur(wp.gesamt)} € (Preisliste S. 33)`, wp)
const ohneGrund = bepreiseProbe(
  { ...getArtikelNr('40-020-0008'), artikelnummer: 'TEST-FPM' },
  [{ artikel: 'TEST-FPM', a: ['', '€/m', '', '', ''], preis: 180, status: 'fixed', seite: '', ref: null }],
  { laengeCm: 150 },
)
pruefe(ohneGrund.status === 'auf-anfrage' && /Grundpreis/.test(ohneGrund.grund), 'Fehlt der Grundpreis → auf Anfrage statt halber Preis', ohneGrund)

// ---------------------------------------------------------------------------
console.log(c.bold('\nG — Zweistufige Kalkulation: Beispiel aus der Vorgabe'))
/*
 * Artikel und Ausstattung 3.000 € (Verblendung korpusbündig, 40 lfm × 75 €), Raumteiler als
 * Betrag 200 € (Aufschlag in € auf den Möbelpreis), Montage 10 %, Lieferung 3 %.
 */
const beispiel = {
  id: 'TEST-BEISPIEL',
  createdAt: '2026-09-22T00:00:00.000Z',
  consultant: { id: 'M-001', name: 'Test' },
  orderNumber: '',
  customerName: 'Beispiel',
  branchId: 'F-001',
  productGroupId: 'kleiderschraenke',
  seriesId: 'refugium',
  korpusGrunddaten: {
    heightMode: '18R',
    depthMode: '60',
    korpusse: [],
    abschlussSet: { position: 'keine' },
    verblendung: { art: 'korpusbuendig', lfm: '40', lfmManuell: true },
  },
  raumteiler: true,
}
aendereArtikel('90-037-0001', { aufschlag: 200, aufschlagEinheit: '€' })
const g = berechneEntwurf(beispiel)
setzeAllesZurueck()
const zeile = (e, art) => e.zuschlaege.find((z) => z.zuschlagArt === art)
pruefe(g.moebelpreis === 3000, `Artikel und Ausstattung        ${eur(g.moebelpreis)} €`)
pruefe(g.summeArtikelAufschlaege === 200, `Artikelbezogene Aufschläge       ${eur(g.summeArtikelAufschlaege)} €`)
pruefe(g.gesamtmoebelpreis === 3200, `Gesamtmöbelpreis               ${eur(g.gesamtmoebelpreis)} €`)
pruefe(zeile(g, 'montage')?.gesamt === 320, `Montage (10 %)                   ${eur(zeile(g, 'montage')?.gesamt)} €`)
pruefe(zeile(g, 'lieferung')?.gesamt === 96, `Lieferung (3 %)                   ${eur(zeile(g, 'lieferung')?.gesamt)} €`)
pruefe(g.gesamt === 3616, `Gesamtpreis inkl. Montage und Lieferung ${eur(g.gesamt)} €`)

console.log(c.bold('\n  … und mit Prozent-Aufschlägen am Demo-Entwurf'))
const d = berechneEntwurf({ ...demoEntwurf, raumteiler: true, sichtRueckwandAussen: true, pricingOptions: { montage: true, lieferungRegional: true } })
const rt = zeile(d, 'raumteiler')?.gesamt, srw = zeile(d, 'sichtrueckwand')?.gesamt
pruefe(rt === r2(d.moebelpreis * 0.05), `Raumteiler 5 % auf den Möbelpreis ${eur(d.moebelpreis)} € = ${eur(rt)} €`)
pruefe(srw === r2(d.moebelpreis * 0.1), `Sichtrückwand 10 % auf den Möbelpreis = ${eur(srw)} € (nicht auf Möbelpreis + Raumteiler)`)
pruefe(d.gesamtmoebelpreis === r2(d.moebelpreis + rt + srw), `Gesamtmöbelpreis = Möbelpreis + beide Aufschläge = ${eur(d.gesamtmoebelpreis)} €`)
pruefe(zeile(d, 'montage')?.gesamt === r2(d.gesamtmoebelpreis * 0.1), `Montage 10 % auf den Gesamtmöbelpreis = ${eur(zeile(d, 'montage')?.gesamt)} €`)
pruefe(zeile(d, 'lieferung')?.gesamt === r2(d.gesamtmoebelpreis * 0.03), `Lieferung 3 % auf den Gesamtmöbelpreis (nicht auf + Montage) = ${eur(zeile(d, 'lieferung')?.gesamt)} €`)
pruefe(d.gesamt === r2(d.gesamtmoebelpreis + zeile(d, 'montage').gesamt + zeile(d, 'lieferung').gesamt), 'Gesamt = Gesamtmöbelpreis + Montage + Lieferung — nichts doppelt')
pruefe(d.zuschlaege.filter((z) => z.zuschlagArt === 'montage').length === 1, 'Montage genau einmal in der Kalkulation')
const ohne = berechneEntwurf({ ...demoEntwurf, pricingOptions: { montage: true, lieferungRegional: true } })
pruefe(ohne.gesamtmoebelpreis === ohne.moebelpreis && ohne.artikelAufschlaege.length === 0, 'Ohne Raumteiler/Sichtrückwand: Gesamtmöbelpreis = Möbelpreis, Montage wie bisher')

// ---------------------------------------------------------------------------
console.log(c.bold('\nH — Montage und Lieferung: Sätze änderbar, abwählbar'))
aendereArtikel('90-039-0001', { aufschlag: 12 })
aendereArtikel('90-039-0002', { aufschlag: 5 })
const h = berechneEntwurf({ ...demoEntwurf, pricingOptions: { montage: true, lieferungRegional: true } })
pruefe(zeile(h, 'montage')?.gesamt === r2(h.gesamtmoebelpreis * 0.12) && /12 %/.test(zeile(h, 'montage').label), `Montage auf 12 % geändert → ${zeile(h, 'montage')?.label}: ${eur(zeile(h, 'montage')?.gesamt)} €`)
pruefe(zeile(h, 'lieferung')?.gesamt === r2(h.gesamtmoebelpreis * 0.05), `Lieferung auf 5 % geändert → ${eur(zeile(h, 'lieferung')?.gesamt)} €`)
setzeAllesZurueck()
const nurLief = berechneEntwurf({ ...demoEntwurf, pricingOptions: { montage: false, lieferungRegional: true } })
const mAus = nurLief.serviceAuswahl.find((s) => s.art === 'montage')
pruefe(!zeile(nurLief, 'montage') && mAus && !mAus.aktiv && mAus.position.gesamt === r2(nurLief.gesamtmoebelpreis * 0.1), 'Montage abgewählt: zählt nicht, Betrag bleibt zur Information sichtbar')
pruefe(nurLief.gesamt === r2(nurLief.gesamtmoebelpreis + zeile(nurLief, 'lieferung').gesamt), 'Gesamt nur mit Lieferung')
pruefe(zeile(nurLief, 'montage') === undefined && zeile(nurLief, 'lieferung')?.gesamt === zeile(d, 'lieferung') ? true : zeile(nurLief, 'lieferung')?.gesamt === r2(nurLief.gesamtmoebelpreis * 0.03), 'Lieferung unabhängig von der Montage')
const m = getArtikelNr('90-039-0001'), l = getArtikelNr('90-039-0002')
pruefe(m?.preislistenNr === '21033' && l?.preislistenNr === '21032', 'Preislisten-Nr. 21033 (Montage) und 21032 (Lieferung) hinterlegt')
pruefe(zeile(d, 'montage')?.preislistenNr === '21033', 'Die Montage-Position trägt Art.-Nr. 21033 in die Kalkulation')

// ---------------------------------------------------------------------------
console.log(c.bold('\nI — Gesperrte Artikel und Altstände'))
aendereArtikel('10-001-0003', { status: 'gesperrt' })
const gk = berechneEntwurf(demoEntwurf)
const korpusPos = gk.positionen.filter((p) => p.artikelnummer === '10-001-0003')
pruefe(korpusPos.length > 0 && korpusPos.every((p) => p.status === 'auf-anfrage') && !gk.vollstaendig, 'Korpus gesperrt → Korpuspositionen „auf Anfrage", Kalkulation nicht verbindlich')
setzeAllesZurueck()
aendereArtikel('90-037-0001', { status: 'gesperrt' })
const gr = berechneEntwurf({ ...demoEntwurf, raumteiler: true })
pruefe(zeile(gr, 'raumteiler')?.status === 'auf-anfrage' && gr.summeArtikelAufschlaege === 0 && !gr.vollstaendig, 'Raumteiler gesperrt → Aufschlag „auf Anfrage", nicht geschätzt, nicht verbindlich')
setzeAllesZurueck()
aendereArtikel('90-039-0001', { status: 'entwurf' })
const ge = berechneEntwurf({ ...demoEntwurf, pricingOptions: { montage: true, lieferungRegional: true } })
pruefe(zeile(ge, 'montage')?.status === 'auf-anfrage' && ge.gesamt === r2(ge.gesamtmoebelpreis + zeile(ge, 'lieferung').gesamt), 'Montage auf Entwurf → auf Anfrage, Lieferung rechnet weiter')
setzeAllesZurueck()
// Altstand: ein Supabase-Override mit der früheren Preislogik MATRIX rechnet unverändert.
const vorher = probe('90-038-0002', { laengeCm: 335 }).gesamt
aendereArtikel('90-038-0002', { preislogik: 'MATRIX' })
pruefe(preisartVon(getArtikelNr('90-038-0002')) === 'MATRIX_MASS' && probe('90-038-0002', { laengeCm: 335 }).gesamt === vorher, 'Altstand „MATRIX" → als Maßgenau abgeleitet, gleicher Betrag')
setzeAllesZurueck()
pruefe(findePreis({ artikelnummer: '90-037-0001' }).status === 'auf-anfrage', 'Ein Aufschlag-Artikel wird nie als Bauteil bepreist')

// ---------------------------------------------------------------------------
console.log(c.bold('\nJ — Supabase-Stand wirkt auf die Kalkulation'))
uebernehmeServerStand([
  { bereich: 'artikel', schluessel: '90-039-0001', aktion: 'geaendert', daten: { aufschlag: 8 }, version: 3 },
])
const j = berechneEntwurf({ ...demoEntwurf, pricingOptions: { montage: true, lieferungRegional: false } })
pruefe(zeile(j, 'montage')?.gesamt === r2(j.gesamtmoebelpreis * 0.08), `Montage-Satz 8 % aus Supabase → ${eur(zeile(j, 'montage')?.gesamt)} €`)
// Der Altstand vom 22.09.: Raumteiler als „entwurf" mit Preislogik AUF_ANFRAGE.
uebernehmeServerStand([
  { bereich: 'artikel', schluessel: '90-037-0001', aktion: 'geaendert', daten: { status: 'entwurf', preislogik: 'AUF_ANFRAGE' }, version: 1 },
])
const alt = berechneEntwurf({ ...demoEntwurf, raumteiler: true })
pruefe(zeile(alt, 'raumteiler')?.status === 'auf-anfrage', 'Alt-Override „Raumteiler entwurf/AUF_ANFRAGE" blockiert den Aufschlag sichtbar (deshalb bereinigt)')
uebernehmeServerStand([])

// ---------------------------------------------------------------------------
console.log(c.bold('\nK — Abschluss, Snapshot und PDF zeigen dieselben Zahlen'))
const draftK = { ...demoEntwurf, raumteiler: true, pricingOptions: { montage: true, lieferungRegional: true } }
const live = aufgeloestePreise(draftK)
const ue = kalkulationsUebersicht(live)
const betrag = (art) => ue.find((z) => z.art === art)?.betrag
pruefe(
  ue.map((z) => z.art).join(',') === 'moebel,aufschlag,aufschlaegeSumme,gesamtmoebel,service,service,gesamt',
  'Reihenfolge: Artikel → Aufschläge → Gesamtmöbelpreis → Montage → Lieferung → Gesamt',
  ue.map((z) => z.art),
)
pruefe(betrag('moebel') === live.moebelpreis && betrag('gesamtmoebel') === live.gesamtmoebelpreis && betrag('gesamt') === live.gesamt, 'Übersicht = Kalkulation')
pruefe(ue.find((z) => z.art === 'gesamt')?.label === 'Gesamtpreis inkl. Montage und Lieferung', 'Summenzeile benennt Montage und Lieferung')
const snap = erzeugePricingSnapshot(draftK, '2026-09-22T12:00:00.000Z')
const eingefroren = aufgeloestePreise({ ...draftK, finalizedAt: '2026-09-22T12:00:00.000Z', pricing_snapshot: snap })
const ueSnap = kalkulationsUebersicht(eingefroren)
pruefe(
  JSON.stringify(ueSnap.map((z) => [z.art, z.betrag])) === JSON.stringify(ue.map((z) => [z.art, z.betrag])),
  'Eingefrorener Auftrag zeigt dieselben Zeilen und Beträge',
)
// Ein Snapshot von vor der Überarbeitung (ohne Stufe und Gesamtmöbelpreis):
const altSnap = { ...snap, gesamtmoebelpreis: undefined, zuschlaege: snap.zuschlaege.map(({ zuschlagStufe, ...z }) => z) }
const ueAlt = kalkulationsUebersicht(aufgeloestePreise({ ...draftK, finalizedAt: '2026-09-22T12:00:00.000Z', pricing_snapshot: altSnap }))
pruefe(ueAlt.find((z) => z.art === 'gesamtmoebel')?.betrag === live.gesamtmoebelpreis, 'Alter Snapshot: Gesamtmöbelpreis wird aus den Zuschlägen zurückgerechnet')

try {
  const { buildPdf } = await import('../src/lib/generatePdf.ts')
  const pdf = buildPdf(draftK).output()
  const zahlen = [live.moebelpreis, live.gesamtmoebelpreis, live.gesamt, zeile(berechneEntwurf(draftK), 'montage').gesamt]
    .map((n) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  const fehlt = zahlen.filter((z) => !pdf.includes(z))
  pruefe(pdf.includes('Artikel und Ausstattung') && pdf.includes('Artikelbezogene Aufschl'), 'PDF enthält den Abschnitt „Kalkulation" mit beiden Stufen')
  pruefe(fehlt.length === 0, `PDF druckt dieselben Beträge (${zahlen.join(' · ')})`, fehlt)
  pruefe(pdf.includes('21033'), 'PDF druckt die Preislisten-Nr. der Montage (21033)')
} catch (e) {
  console.log(c.yellow(`  – PDF-Prüfung übersprungen (Node ohne Browser-APIs): ${e.message.split('\n')[0]}`))
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nL — Preisprobe der Verwaltung = Position der Kalkulation'))
const demo = berechneEntwurf(demoEntwurf)
for (const pos of demo.positionen.filter((p) => p.artikelnummer === '10-001-0003').slice(0, 2)) {
  const achse = (code) => pos.achsen.find((a) => a.code === code)?.wert
  const cm = (w) => Number(String(w).split('cm')[0].replace(',', '.'))
  const p = probe('10-001-0003', { breiteCm: cm(achse('BREITE')), hoeheCm: cm(achse('HOEHE')), tiefeCm: cm(achse('TIEFE')), pg: achse('PG') })
  pruefe(p.gesamt === pos.gesamt, `${pos.label}: Preisprobe ${eur(p.gesamt)} € = Kalkulation ${eur(pos.gesamt)} €`)
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nM — Antworten Cramer auf die Rückfragen (23.09.2026)'))
const mitFront = (spaltenIndex, elementIndex, patch) => {
  const columns = structuredClone(demoEntwurf.fronts.columns)
  Object.assign(columns[spaltenIndex].elements[elementIndex], patch)
  return { ...demoEntwurf, fronts: { ...demoEntwurf.fronts, columns } }
}
const griffPos = (e) => e.positionen.filter((p) => p.dropdown === 'GRIFF')

// 1 · Edge-Griff: 40 €/lfm, Länge = Türhöhe — ohne eigene Längeneingabe.
const edgeDreh = griffPos(berechneEntwurf(mitFront(3, 0, { griffId: 'edge' })))
pruefe(
  edgeDreh.length === 1 && edgeDreh[0].status === 'berechnet' && edgeDreh[0].gesamt === 78 && edgeDreh[0].preisart === 'MATRIX_MASS',
  `Edge an Drehtür „D3" (195 cm): 1,95 m × 40 €/m = ${eur(edgeDreh[0]?.gesamt)} € (78 €)`,
  edgeDreh,
)
pruefe(
  edgeDreh[0]?.teile?.[0]?.mengeText === '1,95 m' && /Türhöhe 195 cm/.test(edgeDreh[0]?.hinweis ?? ''),
  `Menge und Herkunft der Länge ausgewiesen („${edgeDreh[0]?.teile?.[0]?.mengeText}", „${edgeDreh[0]?.hinweis}")`,
  edgeDreh[0],
)
const edgeSchiebe = griffPos(
  berechneEntwurf(mitFront(3, 0, { typeId: 'schiebetuer', heightCm: '230', hoeheModus: undefined, tuerAnschlag: undefined, griffId: 'edge' })),
)
pruefe(edgeSchiebe[0]?.status === 'berechnet' && edgeSchiebe[0].gesamt === 92, `Edge an Schiebetür 230 cm (volle Türhöhe): ${eur(edgeSchiebe[0]?.gesamt)} € (92 €)`, edgeSchiebe)
const edgeSchub = griffPos(berechneEntwurf(mitFront(2, 0, { styleLineId: 'glatt', griff: true, griffId: 'edge' })))
pruefe(
  edgeSchub[0]?.status === 'auf-anfrage' && /Schüben und Klappen/.test(edgeSchub[0].hinweis ?? ''),
  'Edge an einem Schub: keine Länge festgelegt → auf Anfrage mit Begründung, nichts geraten',
  edgeSchub,
)
pruefe(griffPos(berechneEntwurf(demoEntwurf)).length === 0, 'Stückgriff Nr. 121 bleibt im Türpreis enthalten (keine eigene Position)')

// 2 · KMK-Wandtablar laut Preisliste: Festpreis + Matrix, 75 € + 180 €/lfm.
const wt = probe('40-020-0003', { laengeCm: 150 })
pruefe(
  wt.status === 'berechnet' && wt.preisart === 'FEST_PLUS_MATRIX' && wt.gesamt === 345 && wt.teile?.[0]?.gesamt === 75 && wt.teile?.[1]?.gesamt === 270,
  `KMK-Wandtablar 40-020-0003 · 1,5 m: 75 € + 1,5 m × 180 €/m = ${eur(wt.gesamt)} € (statt Festpreis 255 €)`,
  wt,
)

// 3 · Hintere Aufkantung laut Preisliste: 45 €/lfm.
const ak = probe('50-027-0001', { laengeCm: 200 })
pruefe(ak.status === 'berechnet' && ak.preisart === 'MATRIX_MASS' && ak.gesamt === 90, `Hintere Aufkantung 50-027-0001 · 2 m × 45 €/m = ${eur(ak.gesamt)} € (statt 45 € je Stück)`, ak)

// 4 · Container 4,5 R / 6 R mit Rauchglas-Deckplatte: freigegeben, regulär berechnet.
pruefe(getArtikelNr('40-017-0029')?.status === 'aktiv', 'Container mit Rauchglas-Deckplatte 40-017-0029 ist aktiv')
const mitContainer = (rauchglas) => {
  const columns = structuredClone(demoEntwurf.fronts.columns)
  columns[0].equipment.push({ id: 'qc', optionId: 'container', variant: '4,5R', rauchglas, qty: 1 })
  return berechneEntwurf({ ...demoEntwurf, fronts: { ...demoEntwurf.fronts, columns } })
}
const con = mitContainer(true).positionen.filter((p) => p.artikelnummer === '40-017-0029')
pruefe(con.length === 1 && con[0].status === 'berechnet' && con[0].gesamt === 967, `Rauchglas-Häkchen · 60er · 4,5 R: ${eur(con[0]?.gesamt)} € (Preisliste S. 26: 967 €), nicht auf Anfrage`, con)
const conDeco = mitContainer(false).positionen.filter((p) => p.artikelnummer === '40-017-0019')
pruefe(conDeco[0]?.gesamt === 747, `Ohne Häkchen weiter die Decoboard-Deckplatte: ${eur(conDeco[0]?.gesamt)} € (747 €)`, conDeco)

// 5 · Tavolo-Massivplatten: nicht verbaut → entwurf / Auf Anfrage.
for (const nr of ['80-034-0001', '80-034-0002']) {
  const a = getArtikelNr(nr)
  pruefe(
    a?.status === 'entwurf' && preisartVon(a) === 'AUF_ANFRAGE' && findePreis({ artikelnummer: nr, breiteCm: 200, tiefeCm: 100 }).status === 'auf-anfrage',
    `${nr} ${a?.bezeichnung}: Status „entwurf", Preisart „Auf Anfrage"`,
  )
}

// 6 · Personalnummer: Herr Kerschbaummayr bekommt M-104, Sarib behält M-004.
const kerschbaummayr = {
  bereich: 'mitarbeiter', schluessel: 'M-104', aktion: 'neu', version: 1,
  daten: { personalnr: 'M-104', name: 'Dietmar Kerschbaummayr', email: 'kerschbaummayr@cramer-moebel.de', rolle: 'berater', filiale: 'F-003', status: 'aktiv', bemerkung: '' },
}
uebernehmeServerStand([kerschbaummayr])
const ma = getMitarbeiterListe()
const nrDoppelt = ma.map((m) => m.personalnr).filter((nr, i, alle) => alle.indexOf(nr) !== i)
pruefe(
  ma.filter((m) => m.personalnr === 'M-004').map((m) => m.name).join() === 'Sarib Test-Berater' &&
    ma.filter((m) => m.personalnr === 'M-104').map((m) => m.name).join() === 'Dietmar Kerschbaummayr',
  'M-004 = Sarib Test-Berater, M-104 = Dietmar Kerschbaummayr (Stand aus Supabase)',
)
pruefe(nrDoppelt.length === 0, 'Keine Personalnummer doppelt vergeben', nrDoppelt)
uebernehmeServerStand([])

console.log(fehler === 0 ? c.green(c.bold('\nAlle Prüfungen bestanden.\n')) : c.red(c.bold(`\n${fehler} Prüfung(en) fehlgeschlagen.\n`)))
process.exit(fehler === 0 ? 0 : 1)
