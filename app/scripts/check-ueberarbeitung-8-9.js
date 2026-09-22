#!/usr/bin/env node
/**
 * REGRESSIONSTEST — Überarbeitung 8 + 9.
 *
 * Die zwölf Prüffälle aus der Vorgabe, dazu Verblendung, Sondertiefe und Innenmaterial.
 * Geprüft wird über dieselben Module, die Oberfläche und Kalkulation benutzen — keine
 * nachgebaute Logik. Die Beträge sind Prüffälle, keine Regel: Sie stehen so in den
 * Stammdaten (Preisliste S. 7, 13–15, 26, 32) und werden hier nur wiedergefunden.
 *
 *   npm run ue89:test
 */

import { berechneEntwurf } from '../src/lib/kalkulation.ts'
import {
  maxFrontRaster,
  normalisiereFrontenFuerEntwurf,
  pruefeSpalte,
  resthoeheBisOberkante,
  segmentGeometrie,
  setzeFrontbreite,
  standardbreiteNeuerFront,
  vorgegebenerTuerAnschlag,
} from '../src/lib/frontGeometrie.ts'
import { berechneAussenmass, verblendungLfm } from '../src/lib/korpusMass.ts'
import { resolvePriceGroup, isMaterialSelectionComplete } from '../src/lib/materialRules.ts'
import { getMaterialOption } from '../src/config/materialMatrix.ts'
import { ausgeschlosseneOptionIds, getStyleLine } from '../src/config/frontCatalog.ts'
import { aufkantungOptions } from '../src/lib/frontsHelpers.ts'
import { unzulaessigeOberflaeche, getFrontsIssues } from '../src/lib/frontsValidation.ts'
import { belegteRaster, rasterKollisionen } from '../src/lib/rasterBelegung.ts'
import { isEquipmentAvailableInSondertiefe } from '../src/config/equipment.ts'
import { getVisibleKorpusAreas } from '../src/config/korpus.ts'
import { getSeries } from '../src/config/productCatalog.ts'

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
}

let fehler = 0
function pruefe(ok, text, detail) {
  if (ok) console.log(`  ${c.green('✓')} ${text}`)
  else {
    fehler++
    console.log(`  ${c.red('✗')} ${text}${detail ? c.red(`  — ${detail}`) : ''}`)
  }
}
const kopf = (t) => console.log(c.bold(`\n${t}`))

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

const DECO = { materialGroupId: 'decoboard', optionId: 'eiche-milano-r20095nw', priceGroup: 'PG1' }
const LACK_9016 = { materialGroupId: 'mattlack', optionId: 'verkehrsweiss-ral-9016', priceGroup: 'PG2' }
const FURNIER = { materialGroupId: 'furnier', optionId: 'eiche-geoelt', priceGroup: 'PG3' }

let lfd = 0
const id = (p) => `${p}${++lfd}`

function tuer(label, breite, extra = {}) {
  return {
    id: id('el'),
    typeId: 'drehtuer',
    label,
    widthCm: String(breite),
    heightCm: '230,1',
    hoeheModus: 'raster',
    hoeheRaster: '18',
    styleLineId: 'glatt',
    fieldValues: { material: { material: DECO } },
    ...extra,
  }
}

/** Refugium-Entwurf mit Korpusbreiten und Spalten. */
function entwurf({ breiten, spalten, hoehe = '18R', tiefe = '60', tiefeCm, innen = DECO, jeKorpus, abschluss, ausstattung, verblendung }) {
  const korpusse = breiten.map((b) =>
    typeof b === 'number' && ![50, 60, 100].includes(b)
      ? { id: id('k'), breiteMode: 'custom', breiteCm: String(b), lochreihe: true }
      : { id: id('k'), breiteMode: String(b), lochreihe: true },
  )
  return {
    id: 'CRAMER-TEST-UE89',
    createdAt: '2026-09-22T00:00:00Z',
    consultant: { id: 't', name: 'Test' },
    orderNumber: '',
    customerName: 'Regressionstest',
    branchId: 'b',
    productGroupId: 'kleiderschraenke',
    seriesId: 'refugium',
    korpus: { innen },
    korpusInnenJeKorpus: jeKorpus ? Object.fromEntries(korpusse.map((k, i) => [k.id, jeKorpus[i]])) : undefined,
    korpusGrunddaten: {
      heightMode: hoehe,
      depthMode: tiefe,
      depthCm: tiefeCm,
      korpusse,
      abschlussSet: abschluss ?? { position: 'beide', material: DECO },
      verblendung,
    },
    ausstattung: { selected: ausstattung ?? ['einlegeboden', 'einlegeboden-kleiderstange'] },
    fronts: { columns: spalten.map((elements) => ({ id: id('col'), elements, equipment: [] })) },
  }
}
const geoVon = (d, i = 0) => segmentGeometrie(d.korpusGrunddaten, d.seriesId, i)
const position = (e, teil) => e.positionen.find((p) => p.label.includes(teil))
const fehlerMeldungen = (e) => e.meldungen.filter((m) => m.schwere === 'fehler').map((m) => m.text)

// ---------------------------------------------------------------------------
kopf('Test 1 — 100er Korpus, zwei Türen: Breiten hängen zusammen')
// ---------------------------------------------------------------------------
{
  const d = entwurf({ breiten: [100], spalten: [[tuer('D1', 49), tuer('D2', 49)]] })
  const geo = geoVon(d)
  pruefe(geo?.frontbereichMm === 980, `Frontbereich 100er = 98 cm (aus der Frontaufteilung)`, String(geo?.frontbereichMm))
  const spalte = setzeFrontbreite(d.fronts.columns[0], d.fronts.columns[0].elements[0].id, '59', geo)
  pruefe(spalte.elements[1].widthCm === '39', 'D1 → 59 cm ⇒ D2 automatisch 39 cm', spalte.elements[1].widthCm)
  pruefe(pruefeSpalte(spalte, geo).length === 0, '59 + 39 füllt den Frontbereich ohne Befund', pruefeSpalte(spalte, geo).join(' | '))
  const zuBreit = setzeFrontbreite(d.fronts.columns[0], d.fronts.columns[0].elements[0].id, '99', geo)
  pruefe(pruefeSpalte(zuBreit, geo).some((b) => b.includes('breiter als der Frontbereich')), 'D1 = 99 cm wird als Überbreite gemeldet')
  const d50 = entwurf({ breiten: [50], spalten: [[tuer('D1', 70)]] })
  pruefe(
    pruefeSpalte(d50.fronts.columns[0], geoVon(d50)).some((b) => b.includes('breiter')),
    '70-cm-Drehtür im 50er Korpus ist unzulässig',
  )
  pruefe(fehlerMeldungen(berechneEntwurf(d50)).length > 0, '… und die Kalkulation ist nicht verbindlich')
  // Neue Front im halb vollen 100er: bekommt genau den Rest.
  const halb = { ...d.fronts.columns[0], elements: [tuer('D1', 59)] }
  pruefe(standardbreiteNeuerFront(halb, 'drehtuer', geo) === 39, 'Zweite Tür neben D1 = 59 cm startet mit 39 cm', String(standardbreiteNeuerFront(halb, 'drehtuer', geo)))
  // Anschlag beim Türpaar vorgegeben.
  const [l, r] = d.fronts.columns[0].elements
  pruefe(
    vorgegebenerTuerAnschlag(d.fronts.columns[0], l.id, geo) === 'links' &&
      vorgegebenerTuerAnschlag(d.fronts.columns[0], r.id, geo) === 'rechts',
    'Türpaar: linke Tür links, rechte Tür rechts angeschlagen (keine Abfrage)',
  )
  const einzel = entwurf({ breiten: [60], spalten: [[tuer('D1', 59)]] })
  pruefe(vorgegebenerTuerAnschlag(einzel.fronts.columns[0], einzel.fronts.columns[0].elements[0].id, geoVon(einzel)) == null, 'Einzeltür: Anschlag bleibt frei wählbar')
}

// ---------------------------------------------------------------------------
kopf('Test 2 — Korpus nachträglich verkleinern')
// ---------------------------------------------------------------------------
{
  const d = entwurf({ breiten: [100], spalten: [[tuer('D1', 49), tuer('D2', 49)]] })
  d.fronts.columns[0].korpusBreiteCm = 100
  d.korpusGrunddaten.korpusse[0].breiteMode = '50'
  const neu = normalisiereFrontenFuerEntwurf(d)
  const spalte = neu.columns[0]
  pruefe(Boolean(spalte.geometrieHinweis), '100 → 50: Segment wird als ungültig markiert', spalte.geometrieHinweis)
  pruefe(getFrontsIssues(neu, [geoVon(d)]).length > 0, '… und blockiert „Weiter"')
  const e = berechneEntwurf({ ...d, fronts: neu })
  pruefe(!e.vollstaendig && fehlerMeldungen(e).length > 0, '… und die Kalkulation', fehlerMeldungen(e).join(' | '))
  // Eindeutige Fälle werden neu gerechnet.
  const d2 = entwurf({ breiten: [50], spalten: [[tuer('D1', 49)]] })
  d2.fronts.columns[0].korpusBreiteCm = 50
  d2.korpusGrunddaten.korpusse[0].breiteMode = '60'
  const n2 = normalisiereFrontenFuerEntwurf(d2).columns[0]
  pruefe(n2.elements[0].widthCm === '59' && !n2.geometrieHinweis, '50 → 60: Einzeltür 49 → 59 cm neu gerechnet', n2.elements[0].widthCm)
  const d3 = entwurf({ breiten: [100], spalten: [[tuer('D1', 49), tuer('D2', 49)]] })
  d3.fronts.columns[0].korpusBreiteCm = 100
  d3.korpusGrunddaten.korpusse[0] = { ...d3.korpusGrunddaten.korpusse[0], breiteMode: 'custom', breiteCm: '80' }
  const n3 = normalisiereFrontenFuerEntwurf(d3).columns[0]
  pruefe(n3.elements.every((el) => el.widthCm === '39') && !n3.geometrieHinweis, '100 → 80: Türpaar 49/49 → 39/39 neu gerechnet', n3.elements.map((e) => e.widthCm).join('/'))
}

// ---------------------------------------------------------------------------
kopf('Test 3 — 18-Raster-Korpus / 21-Raster-Tür')
// ---------------------------------------------------------------------------
{
  const d = entwurf({ breiten: [60], spalten: [[tuer('D1', 59, { hoeheRaster: '21', heightCm: '268,5' })]] })
  const spalte = d.fronts.columns[0]
  pruefe(maxFrontRaster(spalte, spalte.elements[0].id, geoVon(d)) === 18, 'Auswahl endet bei 18 Raster')
  pruefe(pruefeSpalte(spalte, geoVon(d)).some((b) => b.includes('höher als der Korpus')), '21 Raster wird als unzulässig gemeldet')
}

// ---------------------------------------------------------------------------
kopf('Test 4 — 21 Raster, gültiger Fall: Preiszeile wird gefunden')
// ---------------------------------------------------------------------------
{
  const d = entwurf({ breiten: [50], hoehe: '21R', spalten: [[tuer('D1', 49, { hoeheRaster: '21', heightCm: '268,5' })]] })
  const e = berechneEntwurf(d)
  const p = position(e, 'Drehtür')
  pruefe(p?.status === 'berechnet' && p.einzelpreis === 312, '50er · 21 R · Glatt 1 = 312 € (18 R 260 € × 1,20, fertige Zeile)', `${p?.status} ${p?.einzelpreis}`)
  pruefe(pruefeSpalte(d.fronts.columns[0], geoVon(d)).length === 0, 'Kein Geometrie-Befund im 21-Raster-Korpus')
  // „Höhe bis Korpusoberkante" im 21-Raster-Korpus
  const ok = entwurf({ breiten: [50], hoehe: '21R', spalten: [[tuer('D1', 49, { hoeheModus: 'korpusoberkante', hoeheRaster: '', heightCm: '' })]] })
  const r = resthoeheBisOberkante(ok.fronts.columns[0], ok.fronts.columns[0].elements[0].id, geoVon(ok))
  pruefe(r?.raster === 21 && r.hoeheCm === 268.5, '„bis Korpusoberkante" im 21R-Korpus = 21 Raster ≙ 268,5 cm', JSON.stringify(r))
}

// ---------------------------------------------------------------------------
kopf('1.4 / 1.5 — „Höhe bis Korpusoberkante" und Rastererkennung')
// ---------------------------------------------------------------------------
{
  // Das gemeldete Fehlerbild: 100er Korpus, D1 und D2 nebeneinander, D2 „bis Oberkante".
  const d = entwurf({
    breiten: [100],
    spalten: [[tuer('D1', 49), tuer('D2', 49, { hoeheModus: 'korpusoberkante', hoeheRaster: '', heightCm: '' })]],
  })
  const normal = normalisiereFrontenFuerEntwurf(d)
  const d2 = normal.columns[0].elements[1]
  pruefe(d2.heightCm === '230,1' && d2.hoeheRaster === '18', 'Nachbartür zählt nicht: D2 = 18 Raster ≙ 230,1 cm (Raster eingetragen)', `${d2.heightCm} / ${d2.hoeheRaster}`)
  const e = berechneEntwurf({ ...d, fronts: normal })
  const p = e.positionen.find((x) => x.label.includes('D2'))
  pruefe(p?.status === 'berechnet' && p.einzelpreis === 260, '… und bekommt ihren Preis (50er · 18 R · Glatt 1 = 260 €)', `${p?.status} ${p?.einzelpreis}`)
  // Vorlage: zwei Schübe à 2 Raster darunter ⇒ 14 Raster.
  const schub = (label) => ({ id: id('el'), typeId: 'schuebe', label, widthCm: '59', heightCm: '25,3', styleLineId: 'glatt', fieldValues: { material: { material: DECO } } })
  const mitSchueben = entwurf({
    breiten: [60],
    spalten: [[schub('S1'), schub('S2'), tuer('D1', 59, { hoeheModus: 'korpusoberkante', hoeheRaster: '', heightCm: '' })]],
  })
  const r = resthoeheBisOberkante(mitSchueben.fronts.columns[0], mitSchueben.fronts.columns[0].elements[2].id, geoVon(mitSchueben))
  pruefe(r?.raster === 14 && r.hoeheCm === 178.9, 'Zwei Schübe à 2 R darunter ⇒ 14 Raster ≙ 178,9 cm', JSON.stringify(r))
  // Echte Sonderhöhe ⇒ kein künstlicher Rasterwert.
  const sonder = entwurf({ breiten: [60], spalten: [[tuer('D1', 59, { hoeheModus: 'cm', hoeheRaster: '', heightCm: '224,7' })]] })
  const s = normalisiereFrontenFuerEntwurf(sonder).columns[0].elements[0]
  pruefe(s.hoeheRaster === '', 'Sonderhöhe 224,7 cm ⇒ Rasterfeld bleibt leer', s.hoeheRaster)
  const exakt = entwurf({ breiten: [60], spalten: [[tuer('D1', 59, { hoeheModus: 'cm', hoeheRaster: '', heightCm: '178,9' })]] })
  pruefe(normalisiereFrontenFuerEntwurf(exakt).columns[0].elements[0].hoeheRaster === '14', '178,9 cm ⇒ 14 Raster erkannt')
}

// ---------------------------------------------------------------------------
kopf('Test 5 / 6 — Standardlack und Sonderfarbe')
// ---------------------------------------------------------------------------
{
  const std = { materialGroupId: 'mattlack', optionId: 'verkehrsweiss-ral-9016', priceGroup: resolvePriceGroup('mattlack', 'verkehrsweiss-ral-9016') }
  pruefe(std.priceGroup === 'PG2', 'Mattlack → Verkehrsweiß RAL 9016 = PG 2', std.priceGroup)
  pruefe(!getMaterialOption('mattlack', 'verkehrsweiss-ral-9016')?.requiresFreeText, '… kein Freitextfeld')
  pruefe(isMaterialSelectionComplete(std), '… vollständig ohne Farbcode')
  const erwartet = { 'sonderfarbe-sikkens': 'PG4', 'sonderfarbe-ncs': 'PG4', 'sonderfarbe-ral-design': 'PG4', 'sonderfarbe-ral-classic': 'PG3' }
  for (const [option, pg] of Object.entries(erwartet)) {
    const sel = { materialGroupId: 'mattlack', optionId: option, priceGroup: resolvePriceGroup('mattlack', option) }
    pruefe(
      sel.priceGroup === pg && getMaterialOption('mattlack', option)?.requiresFreeText && !isMaterialSelectionComplete(sel) && isMaterialSelectionComplete({ ...sel, note: 'S 7010-B' }),
      `${getMaterialOption('mattlack', option)?.label} = ${pg}, Farbcode ist Pflicht`,
      `${sel.priceGroup}`,
    )
  }
}

// ---------------------------------------------------------------------------
kopf('Test 7 — Line: drei Gläser nicht wählbar')
// ---------------------------------------------------------------------------
{
  const line = getStyleLine('drehtuer', 'line')
  const weg = ausgeschlosseneOptionIds(line, 'glas')
  for (const glas of ['wave-hinterlackiert', 'rauchglas-grau', 'rauchglas-dark-grey']) {
    pruefe(weg.includes(glas), `${glas} ist bei Line ausgeschlossen`)
  }
  const aufkantung = aufkantungOptions(['glas'], (g) => ausgeschlosseneOptionIds(line, g)).map((o) => o.value)
  pruefe(!aufkantung.some((v) => v.includes('rauchglas')), 'Auch die Aufkantung bietet sie nicht an')
  pruefe(ausgeschlosseneOptionIds(getStyleLine('drehtuer', 'glossy'), 'glas').length === 0, 'Andere Linien (Glossy) behalten die Gläser')
  const alt = { ...tuer('D1', 59), styleLineId: 'line', lineAufkantungGleich: true, fieldValues: { material: { material: { materialGroupId: 'glas', optionId: 'rauchglas-grau', priceGroup: 'PG3' } } } }
  pruefe(unzulaessigeOberflaeche(alt) != null, 'Ein Altentwurf mit Rauchglas an Line wird gemeldet')
}

// ---------------------------------------------------------------------------
kopf('Test 8 / 4.1 — Mittelseite: Atrium-Seite, teuerste Preisgruppe')
// ---------------------------------------------------------------------------
{
  const pg2 = entwurf({ breiten: [50, 60, 100], spalten: [[], [], []], innen: LACK_9016 })
  const m2 = position(berechneEntwurf(pg2), 'Mittelseite')
  pruefe(m2?.einzelpreis === 227, 'Korpus PG 2 · 60 cm · 18 R ⇒ Mittelseite 227 € (statt 135 €)', String(m2?.einzelpreis))
  const pg1 = entwurf({ breiten: [50, 60, 100], spalten: [[], [], []] })
  pruefe(position(berechneEntwurf(pg1), 'Mittelseite')?.einzelpreis === 135, 'Decoboard (PG 1) bleibt beim Refugium-Preis 135 €')
  const gemischt = entwurf({ breiten: [50, 60, 100], spalten: [[], [], []], jeKorpus: [DECO, LACK_9016, FURNIER] })
  const m3 = position(berechneEntwurf(gemischt), 'Mittelseite')
  const pgAchse = m3?.achsen.find((a) => a.code === 'PG')?.wert
  pruefe(pgAchse === 'PG3' && m3?.einzelpreis === 284, 'PG 1 + PG 2 + PG 3 ⇒ Mittelseite in PG 3 (284 €)', `${pgAchse} ${m3?.einzelpreis}`)
  const tief41 = entwurf({ breiten: [60], spalten: [[]], innen: LACK_9016, tiefe: 'custom', tiefeCm: '41' })
  pruefe(position(berechneEntwurf(tief41), 'Mittelseite')?.einzelpreis === 182, 'Tiefe 41 cm · PG 2 ⇒ Atrium S. 14 (182 €)')
}

// ---------------------------------------------------------------------------
kopf('Test 9 — Abschlussset links PG 3 / rechts PG 2')
// ---------------------------------------------------------------------------
{
  const d = entwurf({
    breiten: [60],
    spalten: [[]],
    abschluss: { position: 'beide', materialGetrennt: true, materialLinks: FURNIER, materialRechts: LACK_9016 },
  })
  const a = position(berechneEntwurf(d), 'Aussenset')
  pruefe(a?.achsen.find((x) => x.code === 'PG')?.wert === 'PG3' && a.einzelpreis === 432, 'Abschlussset in PG 3 (432 €)', `${a?.einzelpreis}`)
  const nurLinks = entwurf({
    breiten: [60],
    spalten: [[]],
    abschluss: { position: 'links', materialGetrennt: true, materialLinks: LACK_9016, materialRechts: FURNIER },
  })
  pruefe(position(berechneEntwurf(nurLinks), 'Aussenset')?.einzelpreis === 359, 'Nur links (PG 2): die rechte Auswahl zählt nicht (359 €)')
}

// ---------------------------------------------------------------------------
kopf('Test 10 — Einlegeboden im Material des Innenkorpus')
// ---------------------------------------------------------------------------
{
  const mitBoden = (innen, tiefe = '60', tiefeCm) => {
    const d = entwurf({ breiten: [60], spalten: [[tuer('D1', 59, { tuerAnschlag: 'links' })]], innen, tiefe, tiefeCm })
    d.fronts.columns[0].equipment = [
      { id: 'b1', optionId: 'einlegeboden', qty: 1, hoehen: [{ modus: 'raster', raster: 4 }] },
      { id: 'b2', optionId: 'einlegeboden-kleiderstange', qty: 1, hoehen: [{ modus: 'raster', raster: 12 }], choices: { stangenAusfuehrung: 'chrom' } },
    ]
    return berechneEntwurf(d)
  }
  const lack = mitBoden(LACK_9016)
  const boden = lack.positionen.find((p) => p.label === 'Einlegeboden')
  pruefe(boden?.einzelpreis === 55 && boden.achsen.some((a) => a.wert === 'PG2'), 'Mattlack PG 2 · 60 cm · 60er ⇒ Atrium-Boden 55 € (S. 15)', `${boden?.einzelpreis}`)
  const stange = lack.positionen.find((p) => p.label.includes('Kleiderstange'))
  pruefe(
    stange?.gesamt === 70 && stange.teile.length === 2 && stange.teile[1].bezeichnung === 'Kleiderstange' && stange.teile[1].preis === 15,
    'Einlegeboden inkl. Kleiderstange = 55 € Boden + 15 € Kleiderstange (zwei sichtbare Teile)',
    JSON.stringify(stange?.teile),
  )
  const deco = mitBoden(DECO)
  pruefe(deco.positionen.find((p) => p.label === 'Einlegeboden')?.einzelpreis === 45, 'Decoboard PG 1 ⇒ Refugium-Preis 45 €')
  pruefe(deco.positionen.find((p) => p.label.includes('Kleiderstange'))?.gesamt === 60, 'Decoboard: Kleiderstangenboden 60 € wie gedruckt (45 + 15)')
  const tief31 = mitBoden(LACK_9016, 'custom', '31')
  pruefe(tief31.positionen.find((p) => p.label === 'Einlegeboden')?.einzelpreis === 45, 'Tiefe 31 cm · PG 2 · 60er ⇒ Atrium S. 13 (45 €)')
}

// ---------------------------------------------------------------------------
kopf('Test 11 — Belegte Raster')
// ---------------------------------------------------------------------------
{
  const items = [
    { id: 'c', optionId: 'container', variant: '6R' },
    { id: 'b', optionId: 'einlegeboden', qty: 1, hoehen: [{ modus: 'raster', raster: 4 }] },
  ]
  pruefe(rasterKollisionen(items, 18).length === 1, 'Container 1–6 + Einlegeboden auf Raster 4 ⇒ Konflikt', rasterKollisionen(items, 18).map((k) => k.text).join(' | '))
  const belegt = belegteRaster(items, { itemId: 'b', stueck: 0 })
  pruefe([1, 2, 3, 4, 5, 6].every((r) => belegt.has(r)) && !belegt.has(7), 'Für den Boden sind Raster 1–6 gesperrt, 7 ist frei')
  const zweiBoeden = [{ id: 'x', optionId: 'einlegeboden', qty: 2, hoehen: [{ modus: 'raster', raster: 8 }, { modus: 'raster', raster: 8 }] }]
  pruefe(rasterKollisionen(zweiBoeden, 18).length === 1, 'Zwei Böden auf derselben Rasterhöhe ⇒ Konflikt')
}

// ---------------------------------------------------------------------------
kopf('Test 12 — Beleuchtung: +1 cm Planungstiefe, Preisachse bleibt 60')
// ---------------------------------------------------------------------------
{
  const ohne = entwurf({ breiten: [60], spalten: [[]], innen: LACK_9016, ausstattung: ['einlegeboden'] })
  const mit = entwurf({ breiten: [60], spalten: [[]], innen: LACK_9016, ausstattung: ['einlegeboden', 'led-band-aluprofil'] })
  const m = berechneAussenmass(mit.korpusGrunddaten, { beleuchtung: true })
  pruefe(m.korpustiefeCm === 61 && m.korpustiefeNennCm === 60, 'Korpustiefe ohne Front: 60 → 61 cm', `${m.korpustiefeCm}`)
  const k1 = position(berechneEntwurf(ohne), 'Korpus 1')
  const k2 = position(berechneEntwurf(mit), 'Korpus 1')
  pruefe(k1?.einzelpreis === k2?.einzelpreis && k2?.achsen.find((a) => a.code === 'TIEFE')?.wert === '60 cm', 'Korpus bleibt die 60er-Preiszeile (656 €)', `${k1?.einzelpreis} / ${k2?.einzelpreis}`)
}

// ---------------------------------------------------------------------------
kopf('3.2 — Sondertiefe sperrt nicht pauschal')
// ---------------------------------------------------------------------------
{
  const erlaubt = ['einlegeboden', 'led-syncro', 'led-band-aluprofil', 'glasboden', 'rueckwandausschnitt', 'innenspiegel-drehtuer', 'krawattenspange', 'kleiderbuegelhalter', 'revisionsklappe']
  pruefe(erlaubt.every(isEquipmentAvailableInSondertiefe), 'Die neun Ausstattungen aus Überarbeitung 8 sind bei Sondertiefe möglich')
  pruefe(!isEquipmentAvailableInSondertiefe('container'), 'Container bleibt bei Sondertiefe gesperrt')
}

// ---------------------------------------------------------------------------
kopf('5.1 — Refugium innen ohne Xtreme Plus')
// ---------------------------------------------------------------------------
{
  const innen = getVisibleKorpusAreas(getSeries('kleiderschraenke', 'refugium'), 'komplett').find((a) => a.id === 'innen')
  pruefe(innen && !innen.materialGroupIds.includes('xtreme-plus'), 'Bereich „a. Innen" bietet kein Xtreme Plus an', innen?.materialGroupIds.join(', '))
}

// ---------------------------------------------------------------------------
kopf('7 — Verblendung: Haken → Laufmeter → Preis')
// ---------------------------------------------------------------------------
{
  const d = entwurf({
    breiten: [100, 100, 100],
    spalten: [[], [], []],
    verblendung: { art: 'korpusbuendig', seiten: { links: true, oben: true } },
  })
  pruefe(verblendungLfm(d.korpusGrunddaten) === 5.35, 'Links + Oben ⇒ 2,35 m + 3,00 m = 5,35 lfm', String(verblendungLfm(d.korpusGrunddaten)))
  const p = position(berechneEntwurf(d), 'Verblendung')
  pruefe(p?.gesamt === 401.25 && p.label === 'Verblendung korpusbündig (Links, Oben) · 5,35 lfm', 'Korpusbündig: 5,35 × 75 €/lfm = 401,25 €', `${p?.label} ${p?.gesamt}`)
  d.korpusGrunddaten.verblendung = { art: 'frontbuendig', seiten: { links: true, oben: true, rechts: true } }
  pruefe(position(berechneEntwurf(d), 'Verblendung')?.gesamt === 1155, 'Frontbündig, alle drei Seiten: 7,70 × 150 €/lfm = 1.155 €')
  d.korpusGrunddaten.verblendung = { art: 'korpusbuendig', seiten: { links: true }, lfm: '2,4', lfmManuell: true }
  pruefe(position(berechneEntwurf(d), 'Verblendung')?.gesamt === 180, 'Manuell überschrieben 2,4 lfm × 75 € = 180 €')
}

// ---------------------------------------------------------------------------
console.log(
  fehler === 0
    ? c.green(c.bold('\nAlle Prüfungen bestanden.\n'))
    : c.red(c.bold(`\n${fehler} Prüfung(en) fehlgeschlagen.\n`)),
)
process.exit(fehler === 0 ? 0 : 1)
