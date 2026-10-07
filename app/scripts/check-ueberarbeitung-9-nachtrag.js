#!/usr/bin/env node
/**
 * PRÜFUNG — Überarbeitung 9 (Nachtrag 10/2026), Punkt für Punkt nach dem PDF.
 *
 *   S. 1  LED-Syncro 100er 400 € · Abschlussset einseitig ½ · kein Raumteiler beim
 *         Kleiderschrank · +1 cm Tiefe bei Beleuchtung, außer mit Fußleistenausschnitt
 *   S. 2  Basis-Container 3 R / 7,5 R · PG vom Innenkorpus, +30/40/50 % (auch Rauchglas)
 *   S. 3  Korpusboden ≠ Raster 1 · Rollkörbe PG 2–4
 *   S. 4  Kleiderbügelhalter ohne Einbauhöhe · Schubladenunterteilung immer PG 1 ·
 *         Rollboden mit Schuhablage Craft: Höhe je Stück, mind. ca. 35 cm Abstand
 *   S. 5  Gürtel-/Krawattenauszug: Höhe je Stück · Conero G/H nur 100er, Ausführung wählbar, PG
 *   S. 6  Weißglas hinterlackiert: Vollflächig / Passepartout, nur Drehtür
 *   S. 7  Line: Mattlack + Furnier für die Aufkantung
 *   S. 8  Schübe: Höhe in Raster (1 / 1,5 / 2), max. 40 cm
 *   Erg.  Montage/Lieferung je Entwurf überschreibbar · Raumteiler/Sichtrückwand „entwurf"
 *
 *   npm run ue9b:test
 */

import { berechneEntwurf, preisOptionen } from '../src/lib/kalkulation.ts'
import { getArtikelNr } from '../src/lib/preisLookup.ts'
import { aendereArtikel, setzeAllesZurueck } from '../src/lib/stammdatenStore.ts'
import { aufschlagAbfrageSichtbar } from '../src/config/preisMapping.ts'
import { getEquipmentOption, equipmentVariantenSperrgrund, equipmentChoiceGilt } from '../src/config/equipment.ts'
import { getFrontType } from '../src/config/frontCatalog.ts'
import { belegteRaster, rasterKollisionen } from '../src/lib/rasterBelegung.ts'
import { berechneAussenmass, describeKorpusGrunddatenZeilen } from '../src/lib/korpusMass.ts'
import { aufkantungGroupIds, brauchtGlasLackierung, frontHoeheAusRaster } from '../src/lib/frontsHelpers.ts'
import { exceedsMaxHeight, fehlendeGlasLackierung } from '../src/lib/frontsValidation.ts'
import { demoEntwurf } from '../src/data/demoEntwurf.ts'
import { materialFuer } from './lib/testMaterial.js'

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
}
let fehler = 0
function pruefe(bedingung, text, detail) {
  console.log(`  ${bedingung ? c.green('✓') : c.red('✗')} ${text}`)
  if (!bedingung) {
    fehler++
    if (detail !== undefined) console.log(c.dim(`      ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 600)}`))
  }
}
const eur = (n) => (n == null ? '—' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const r2 = (n) => Math.round(n * 100) / 100

/** Demo-Entwurf mit Ausstattung in Segment `spalte` (0-basiert) und optional anderem Innen-PG. */
function mit({ equipment = [], spalte = 0, innenPg, korpusBreite, aenderung } = {}) {
  const d = structuredClone(demoEntwurf)
  d.fronts.columns[spalte].equipment = equipment
  const auswahl = new Set(d.ausstattung?.selected ?? [])
  for (const e of equipment) auswahl.add(e.optionId)
  d.ausstattung = { selected: [...auswahl] }
  if (innenPg) d.korpus.innen = materialFuer(innenPg)
  if (korpusBreite) d.korpusGrunddaten.korpusse[spalte] = { ...d.korpusGrunddaten.korpusse[spalte], breiteMode: String(korpusBreite) }
  aenderung?.(d)
  return d
}
const posVon = (e, nr) => e.positionen.filter((p) => p.artikelnummer === nr)

// ---------------------------------------------------------------------------
console.log(c.bold('\nS. 1 — LED-Syncro, Abschlussset, Raumteiler, Korpusvertiefung'))
{
  const e = berechneEntwurf(mit({ equipment: [{ id: 'l', optionId: 'led-syncro', qty: 1 }], spalte: 3, korpusBreite: 100 }))
  const led = posVon(e, '50-024-0008')[0]
  pruefe(led?.gesamt === 400, `LED-Syncro im 100er Korpus: ${eur(led?.gesamt)} € (400 €, nicht 405 €)`, led)
}
{
  const beide = berechneEntwurf(demoEntwurf).positionen.find((p) => p.artikelnummer === '10-003-0001')
  const nurLinks = berechneEntwurf(mit({ aenderung: (d) => (d.korpusGrunddaten.abschlussSet.position = 'links') })).positionen.find(
    (p) => p.artikelnummer === '10-003-0001',
  )
  const nurRechts = berechneEntwurf(mit({ aenderung: (d) => (d.korpusGrunddaten.abschlussSet.position = 'rechts') })).positionen.find(
    (p) => p.artikelnummer === '10-003-0001',
  )
  pruefe(
    nurLinks?.gesamt === r2(beide.gesamt / 2) && nurRechts?.gesamt === r2(beide.gesamt / 2) && nurLinks.einzelpreis === beide.einzelpreis,
    `Abschlussset nur links / nur rechts: ${eur(nurLinks?.gesamt)} € = ½ von ${eur(beide.gesamt)} € (Listenpreis bleibt Einzelpreis)`,
    { beide, nurLinks },
  )
  pruefe(/½ des Listenpreises/.test(nurLinks?.hinweis ?? '') && nurLinks?.menge === 0.5, 'Begründung „½ des Listenpreises" und Menge 0,5 sichtbar')
}
{
  aendereArtikel('90-037-0001', { status: 'aktiv' })
  const schrank = berechneEntwurf({ ...demoEntwurf, raumteiler: true })
  const sideboard = berechneEntwurf({ ...demoEntwurf, productGroupId: 'sideboards', raumteiler: true })
  setzeAllesZurueck()
  pruefe(!schrank.zuschlaege.some((z) => z.zuschlagArt === 'raumteiler'), 'Kleiderschrank: auch ein alter Raumteiler-Haken wird nicht berechnet')
  pruefe(sideboard.zuschlaege.some((z) => z.zuschlagArt === 'raumteiler' && z.status === 'berechnet'), 'Andere Möbel: Raumteiler rechnet weiter (bei aktivem Artikel)')
  pruefe(!aufschlagAbfrageSichtbar('raumteiler', 'kleiderschraenke', 'aktiv', false), 'Abfrage Raumteiler beim Kleiderschrank ausgeblendet — auch bei aktivem Artikel')
}
{
  const g = structuredClone(demoEntwurf.korpusGrunddaten)
  const ohne = berechneAussenmass(g, { beleuchtung: true })
  const mitAusschnitt = berechneAussenmass({ ...g, fussleiste: { enabled: true, hoeheCm: '10', tiefeCm: '5' } }, { beleuchtung: true })
  pruefe(ohne.beleuchtungZugabeCm === 1 && ohne.korpustiefeCm === 61, `Beleuchtung: Korpus ${ohne.korpustiefeCm} cm (60 + 1 cm Kabelführung)`, ohne)
  pruefe(
    mitAusschnitt.beleuchtungZugabeCm == null && mitAusschnitt.korpustiefeCm === 60,
    `Beleuchtung + Fußleistenausschnitt: Korpus ${mitAusschnitt.korpustiefeCm} cm — kein zusätzlicher cm`,
    mitAusschnitt,
  )
  const zeilen = describeKorpusGrunddatenZeilen({ ...g, fussleiste: { enabled: true, hoeheCm: '10', tiefeCm: '5' } }, { beleuchtung: true })
  pruefe(zeilen.some((z) => /im Fußleistenausschnitt/.test(z.value)), 'Zusammenfassung/PDF nennen die Kabelführung im Fußleistenausschnitt')
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nS. 2 — Basis-Container 3 R / 7,5 R, Preisgruppe vom Innenkorpus'))
{
  const soll = {
    '3R': [526, 552, 666],
    '4,5R': [711, 747, 896],
    '6R': [896, 942, 1126],
    '7,5R': [1081, 1137, 1356],
  }
  const rauch = [210, 220, 230]
  const breiten = [50, 60, 100]
  let alle = true
  const fehlt = []
  for (const [variante, preise] of Object.entries(soll)) {
    breiten.forEach((b, i) => {
      for (const [pg, f] of [['PG1', 1], ['PG2', 1.3], ['PG3', 1.4], ['PG4', 1.5]]) {
        for (const rauchglas of [false, true]) {
          const e = berechneEntwurf(mit({ equipment: [{ id: 'c', optionId: 'container', variant: variante, rauchglas }], spalte: 0, korpusBreite: b, innenPg: pg }))
          const p = posVon(e, rauchglas ? '40-017-0029' : '40-017-0019')[0]
          const erwartet = r2((preise[i] + (rauchglas ? rauch[i] : 0)) * f)
          if (p?.gesamt !== erwartet) {
            alle = false
            fehlt.push(`${variante} ${b}er ${pg}${rauchglas ? ' Rauchglas' : ''}: ${p?.gesamt} ≠ ${erwartet}`)
          }
        }
      }
    })
  }
  pruefe(alle, 'Alle 96 Kombinationen (4 Höhen × 3 Breiten × 4 PG × Deckplatte) laut PDF S. 2', fehlt.slice(0, 6))
  const e = berechneEntwurf(mit({ equipment: [{ id: 'c', optionId: 'container', variant: '7,5R' }], spalte: 0, korpusBreite: 60, innenPg: 'PG3' }))
  const p = posVon(e, '40-017-0019')[0]
  pruefe(p?.gesamt === 1591.8 && /Preisgruppe PG 3 aus der Innenausführung/.test(p.hinweis ?? ''), `Beispiel 7,5 R · 60er · Innen PG 3: 1.137 € × 1,4 = ${eur(p?.gesamt)} €, Herkunft der PG benannt`)
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nS. 3 — Korpusboden ≠ Raster 1, Rollkörbe mit Preisgruppe'))
{
  const items = [{ id: 'r', optionId: 'rollboden', qty: 2, hoehen: [{ modus: 'raster', raster: 1 }, { modus: 'boden' }] }]
  pruefe(rasterKollisionen(items).length === 0, 'Rollboden Raster 1 + Rollboden am Korpusboden: keine Kollision mehr', rasterKollisionen(items))
  const zweiAmBoden = [{ id: 'r', optionId: 'rollboden', qty: 2, hoehen: [{ modus: 'boden' }, { modus: 'boden' }] }]
  pruefe(rasterKollisionen(zweiAmBoden).length === 1, 'Zwei Rollböden am Korpusboden kollidieren weiterhin')
  const mitContainer = [
    { id: 'c', optionId: 'container', variant: '6R' },
    { id: 'r', optionId: 'rollboden', qty: 1, hoehen: [{ modus: 'boden' }] },
  ]
  pruefe(/Korpusboden bis Raster 6/.test(rasterKollisionen(mitContainer)[0]?.text ?? ''), 'Container 6 R belegt „Korpusboden bis Raster 6"', rasterKollisionen(mitContainer))
  pruefe(belegteRaster(mitContainer, { itemId: 'r', stueck: 0 }).has(0), 'Der Chip „am Korpusboden" ist dann gesperrt (Position 0 belegt)')
}
{
  for (const [pg, f] of [['PG1', 1], ['PG2', 1.3], ['PG3', 1.4], ['PG4', 1.5]]) {
    const e = berechneEntwurf(mit({ equipment: [{ id: 'k', optionId: 'rollkorb', qty: 1, hoehen: [{ modus: 'raster', raster: 3 }] }], spalte: 0, innenPg: pg }))
    const p = posVon(e, '40-016-0002')[0]
    pruefe(p?.gesamt === r2(140 * f), `Rollkorb 60er · Innen ${pg}: ${eur(p?.gesamt)} € (140 € × ${f})`, p)
  }
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nS. 4 — Kleiderbügelhalter, Schubladenunterteilung, Rollboden mit Schuhablage Craft'))
{
  const k = getEquipmentOption('kleiderbuegelhalter')
  pruefe(!k.heightMode && k.detailFields.includes('position'), 'Kleiderbügelhalter: keine Einbauhöhe mehr, Position als Text')
  for (const pg of ['PG1', 'PG3']) {
    const e = berechneEntwurf(
      mit({
        equipment: [
          { id: 's', optionId: 'innenschublade', qty: 1, variant: '1,5R', hoehen: [{ modus: 'raster', raster: 2 }] },
          { id: 'u', optionId: 'schubladenunterteilung-craft', qty: 1, bezugId: 's' },
        ],
        spalte: 0,
        innenPg: pg,
      }),
    )
    const p = posVon(e, '40-023-0011')[0]
    pruefe(p?.gesamt === 183 && /Immer Preisgruppe PG 1/.test(p.hinweis ?? ''), `Schubladenunterteilung bei Innen ${pg}: ${eur(p?.gesamt)} € (immer PG 1 = 183 €)`, p)
  }
  const craft = getEquipmentOption('rollboden-schuhablage-craft')
  pruefe(craft.heightPerPiece && !craft.detailFields.includes('position'), 'Rollboden mit Schuhablage Craft: Höhe je Stück, kein Positionsfeld')
  const nah = [{ id: 'x', optionId: 'rollboden-schuhablage-craft', qty: 2, hoehen: [{ modus: 'raster', raster: 2 }, { modus: 'raster', raster: 4 }] }]
  const weit = [{ id: 'x', optionId: 'rollboden-schuhablage-craft', qty: 2, hoehen: [{ modus: 'raster', raster: 2 }, { modus: 'raster', raster: 5 }] }]
  const cm = [{ id: 'x', optionId: 'rollboden-schuhablage-craft', qty: 2, hoehen: [{ modus: 'cm', cm: '40' }, { modus: 'cm', cm: '70' }] }]
  pruefe(rasterKollisionen(nah).some((k) => /mindestens ca. 35 cm/.test(k.text)), '2 Raster Abstand (ca. 25,6 cm) → Meldung „mindestens ca. 35 cm"', rasterKollisionen(nah))
  pruefe(rasterKollisionen(weit).length === 0, '3 Raster Abstand (ca. 38,4 cm) → in Ordnung', rasterKollisionen(weit))
  pruefe(rasterKollisionen(cm).length === 1, 'Auch Sonderhöhen in cm: 40 und 70 cm (30 cm Abstand) → Meldung')
  const gesperrt = belegteRaster(nah, { itemId: 'x', stueck: 1 })
  pruefe(gesperrt.has(3) && gesperrt.has(4) && !gesperrt.has(5), 'Im Raster-Dropdown sind zu nahe Höhen gesperrt (Raster 3/4 gesperrt, 5 frei)')
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nS. 5 — Gürtel-/Krawattenauszug, Conero G/H'))
{
  pruefe(getEquipmentOption('guertel-krawattenauszug-conero').heightPerPiece, 'Gürtel-/Krawattenauszug Conero: Wunschhöhe je Stück')
  const conero = getEquipmentOption('container-conero')
  pruefe(
    equipmentVariantenSperrgrund(conero, 'G', 60) != null && equipmentVariantenSperrgrund(conero, 'H', 50) != null && equipmentVariantenSperrgrund(conero, 'G', 100) == null,
    'Conero G/H nur im 100er Korpus wählbar',
  )
  const falsch = berechneEntwurf(mit({ equipment: [{ id: 'g', optionId: 'container-conero', variant: 'G' }], spalte: 0, korpusBreite: 60 }))
  pruefe(
    posVon(falsch, '40-017-0007')[0]?.status === 'auf-anfrage' && falsch.meldungen.some((m) => m.schwere === 'fehler' && /nur im 100er/.test(m.text)),
    'Altentwurf Conero G im 60er → Fehler, kein hochgestufter Preis',
  )
  const fa = conero.choices.find((ch) => ch.id === 'funktionsauszug')
  pruefe(equipmentChoiceGilt(fa, 'G') && equipmentChoiceGilt(fa, 'H') && !equipmentChoiceGilt(fa, 'A'), 'Ausführung des Funktionsauszugs nur bei G und H')
  const faelle = [
    ['G', '12-hosenhalter', false, '40-017-0007', 760],
    ['G', '6-hosenhalter-1-waeschesack', false, '40-017-0011', 760],
    ['G', '2-waeschesaecke', true, '40-017-0010', 960],
    ['H', '12-hosenhalter', false, '40-017-0013', 1080],
    ['H', '6-hosenhalter-1-waeschesack', true, '40-017-0031', 1280],
    ['H', '2-waeschesaecke', false, '40-017-0032', 1080],
  ]
  for (const [v, wahl, rauchglas, nr, preis] of faelle) {
    const e = berechneEntwurf(
      mit({ equipment: [{ id: 'g', optionId: 'container-conero', variant: v, rauchglas, choices: { funktionsauszug: wahl } }], spalte: 0, korpusBreite: 100 }),
    )
    const p = posVon(e, nr)[0]
    pruefe(p?.gesamt === preis, `Conero ${v} · ${wahl}${rauchglas ? ' · Rauchglas' : ''} → ${nr} ${eur(p?.gesamt)} €`, e.positionen.filter((x) => x.dropdown === 'CONTAINER'))
  }
  const pg4 = berechneEntwurf(mit({ equipment: [{ id: 'g', optionId: 'container-conero', variant: 'H' }], spalte: 0, korpusBreite: 100, innenPg: 'PG4' }))
  pruefe(posVon(pg4, '40-017-0013')[0]?.gesamt === 1620, `Conero H · Innen PG 4: ${eur(posVon(pg4, '40-017-0013')[0]?.gesamt)} € (1.080 € × 1,5)`)
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nS. 6–8 — Weißglas, Line, Schübe'))
{
  const weiss = (typeId) => ({
    id: 'w', typeId, label: 'W1', styleLineId: 'less',
    fieldValues: { glas: { material: { materialGroupId: 'glas', optionId: 'weissglas-hinterlackiert', note: 'RAL 9010' } } },
  })
  pruefe(brauchtGlasLackierung(weiss('drehtuer')) && fehlendeGlasLackierung(weiss('drehtuer')), 'Drehtür Weißglas hinterlackiert: Vollflächig/Passepartout ist Pflicht')
  pruefe(!fehlendeGlasLackierung({ ...weiss('drehtuer'), glasLackierung: 'passepartout' }), '… mit „Passepartout" vollständig')
  pruefe(!brauchtGlasLackierung(weiss('schuebe')) && !brauchtGlasLackierung(weiss('schiebetuer')), 'Bei Schüben und Schiebetüren nicht abgefragt')
  const line = (gruppe) => ({ id: 'l', typeId: 'drehtuer', styleLineId: 'line', fieldValues: { material: { material: { materialGroupId: gruppe, optionId: 'x' } } } })
  pruefe(['furnier', 'mattlack'].every((g) => ['furnier', 'mattlack'].every((x) => aufkantungGroupIds(line(g)).includes(x))), 'Line: bei Furnier UND Mattlack sind für die Aufkantung Lacke und Furniere wählbar')
  const schub = getFrontType('schuebe')
  pruefe(schub.maxHeightCm === 40 && schub.hoeheRasterStufen.join() === '1,1.5,2', 'Schübe: Raster 1 / 1,5 / 2 wählbar, max. 40 cm')
  pruefe(exceedsMaxHeight({ typeId: 'schuebe', heightCm: '41' }) && !exceedsMaxHeight({ typeId: 'schuebe', heightCm: '40' }), 'Schub 41 cm wird gemeldet, 40 cm nicht')
  pruefe([1, 1.5, 2].map(frontHoeheAusRaster).join() === '12.5,18.9,25.3', 'Rasterhöhen = Preisstufen der Schübe (12,5 / 18,9 / 25,3 cm)')
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nErgänzungen — Montage/Lieferung je Entwurf, Raumteiler/Sichtrückwand'))
{
  const basis = { ...demoEntwurf, pricingOptions: { montage: true, lieferungRegional: true } }
  const vorgabe = berechneEntwurf(basis)
  const angepasst = berechneEntwurf({ ...basis, pricingOptions: { ...basis.pricingOptions, montageProzent: 7.5, lieferungProzent: 0 } })
  const m = angepasst.zuschlaege.find((z) => z.zuschlagArt === 'montage')
  const l = angepasst.zuschlaege.find((z) => z.zuschlagArt === 'lieferung')
  pruefe(m?.gesamt === r2(angepasst.gesamtmoebelpreis * 0.075) && /7,5 %/.test(m.label), `Montage auf 7,5 % überschrieben → ${m?.label}: ${eur(m?.gesamt)} €`)
  pruefe(/angepasst \(Vorgabe 10 %\)/.test(m?.hinweis ?? ''), 'Hinweis nennt die Vorgabe aus der Artikelverwaltung (10 %)')
  pruefe(l?.gesamt === 0, 'Lieferung auf 0 % → 0,00 €')
  pruefe(vorgabe.zuschlaege.find((z) => z.zuschlagArt === 'montage')?.gesamt === r2(vorgabe.gesamtmoebelpreis * 0.1), 'Ohne Eintrag gilt weiter der Satz aus der Artikelverwaltung (10 %)')
  const opt = preisOptionen({ pricingOptions: { montage: false, lieferungRegional: true, montageProzent: 8 } })
  pruefe(opt.montageProzent === 8 && opt.montage === false, 'Häkchen umschalten behält den überschriebenen Satz')
  pruefe(preisOptionen({ pricingOptions: { montage: true, lieferungRegional: true, montageProzent: 150 } }).montageProzent === undefined, 'Unsinnige Sätze (> 100 %) zählen nicht')
  pruefe(getArtikelNr('90-037-0001')?.status === 'entwurf' && getArtikelNr('90-037-0004')?.status === 'entwurf', 'Raumteiler und Sichtrückwand stehen auf „entwurf"')
  pruefe(
    !aufschlagAbfrageSichtbar('sichtrueckwand', 'sideboards', 'entwurf', false) && aufschlagAbfrageSichtbar('sichtrueckwand', 'sideboards', 'entwurf', true) && aufschlagAbfrageSichtbar('sichtrueckwand', 'sideboards', 'aktiv', false),
    'Abfrage nur bei aktivem Artikel — ein gesetzter Haken bleibt zum Abwählen sichtbar',
  )
}

console.log(fehler === 0 ? c.green(c.bold('\nAlle Prüfungen bestanden.\n')) : c.red(c.bold(`\n${fehler} Prüfung(en) fehlgeschlagen.\n`)))
process.exit(fehler === 0 ? 0 : 1)
