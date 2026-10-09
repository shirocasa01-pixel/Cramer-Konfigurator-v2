#!/usr/bin/env node
/**
 * PRÜFUNG — Überarbeitung 10 (10/2026), Punkt für Punkt nach dem PDF und den Nachfragen.
 *
 *   S. 1   Zweiläufige Schiebetür: Korpushöhe 18–21 R (Sonderhöhen dazwischen) · 150er nur
 *          Decoboard / Xtreme Plus · Abschlusssets links & rechts Pflicht, 20 mm statt 10 mm
 *   S. 2–4 Symmetrische Korpus-Einteilung: je Tür ein Türfeld aus 1 Korpus (80–100) oder
 *          2 Korpi gleicher Gesamtbreite (bis 150) · Korpus ohne Mittelseite max. 100
 *          → Kalkulation: Anzahl × Tür in Türfeld-Breite (vorher: EINE Tür)
 *   S. 5   Curve: kein Griffprofil „Edge"
 *   Erg.   Raumteiler / Sichtrückwand: Beschriftung, nur sichtbar wenn aktiv · Stand der
 *          sechs Cramer-Antworten (Edge, Wandtablar, Aufkantung, Container, Tavolo, M-104)
 *   3D     Schrank-Modell der Vorschau folgt Breiten, Höhe und Korpus-Anzahl
 *
 *   npm run ue10:test
 */

import { readFileSync } from 'node:fs'
import { berechneEntwurf } from '../src/lib/kalkulation.ts'
import { getArtikelNr } from '../src/lib/preisLookup.ts'
import { setzeAllesZurueck, uebernehmeServerStand, getPreisListe, getMitarbeiterListe } from '../src/lib/stammdatenStore.ts'
import { aufschlagAbfrageSichtbar } from '../src/config/preisMapping.ts'
import { berechneAussenmass, describeKorpusGrunddatenZeilen } from '../src/lib/korpusMass.ts'
import { griffProfilAnwendbar } from '../src/lib/frontsHelpers.ts'
import { getFrontsIssuesFuerEntwurf, isFrontsCompleteFuerEntwurf } from '../src/lib/frontsValidation.ts'
import {
  schiebetuerAufteilungen,
  schiebetuerBefunde,
  schiebetuerHoeheProblem,
  schiebetuerAnzahlText,
  zerlegeInTuerfelder,
} from '../src/lib/schiebetuer.ts'
import { schrankModell } from '../src/lib/schrankModell.ts'
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
    if (detail !== undefined) console.log(c.dim(`      ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 700)}`))
  }
}
const eur = (n) => (n == null ? '—' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

setzeAllesZurueck()
uebernehmeServerStand([])

/** Refugium-Kleiderschrank wie im Konfigurator — mit oder ohne zweiläufige Schiebetür. */
function schrank({ breiten = [100, 100], hoehe = '18R', abschluss = 'beide', tuer, anzahl, fronten } = {}) {
  const korpusse = breiten.map((b, i) => ({
    id: `k${i + 1}`,
    breiteMode: ['50', '60', '100'].includes(String(b)) ? String(b) : 'custom',
    breiteCm: ['50', '60', '100'].includes(String(b)) ? undefined : String(b),
    lochreihe: true,
  }))
  const columns = breiten.map((_, i) => ({
    id: `c${i + 1}`,
    elements: fronten ? fronten[i] ?? [] : i === 0 && tuer ? [tuer] : [],
    equipment: [],
  }))
  return {
    id: 'UE10',
    createdAt: '2026-10-09T00:00:00.000Z',
    consultant: { id: 'TEST', name: 'Ü10' },
    orderNumber: '',
    customerName: 'Ü10',
    branchId: 'F-001',
    productGroupId: 'kleiderschraenke',
    seriesId: 'refugium',
    korpus: { innen: materialFuer('PG1') },
    korpusGrunddaten: {
      heightMode: ['18R', '21R'].includes(hoehe) ? hoehe : 'custom',
      heightCm: ['18R', '21R'].includes(hoehe) ? undefined : String(hoehe),
      depthMode: '60',
      korpusse,
      abschlussSet: abschluss === 'keine' ? { position: 'keine' } : { position: abschluss, material: materialFuer('PG1') },
    },
    ausstattung: { selected: [] },
    fronts: { columns, ...(anzahl ? { schiebetuerAnzahl: anzahl } : {}) },
    pricingOptions: { montage: true, lieferungRegional: true },
    isVerification: true,
  }
}
const schiebetuer = (styleLineId = 'glatt', material = materialFuer('PG1')) => ({
  id: 'st',
  typeId: 'schiebetuer-zwei',
  label: 'ST1',
  styleLineId,
  griffProfil: 'edge',
  griffProfilFarbe: 'RAL 9005',
  fieldValues: { material: { material } },
})
/** Irgendein Glas — Glossy / Less hat eine eigene Preisspalte, die Preisgruppe zählt nicht. */
const glas = () => ['PG1', 'PG2', 'PG3', 'PG4'].map((pg) => { try { return materialFuer(pg, ['glas']) } catch { return null } }).find(Boolean)
const tuerPos = (e) => e.positionen.find((p) => p.artikelnummer === '20-008-0001')
const zeilenpreis = (breite, linie) =>
  getPreisListe().find((z) => z.artikel === '20-008-0001' && z.a[0].startsWith(`${breite} cm`) && z.a[1] === linie)?.preis

// ---------------------------------------------------------------------------
console.log(c.bold('\nS. 2–4 — Türfelder: symmetrische Korpus-Einteilung'))
{
  const fall = (breiten, anzahl, gruppe) => schiebetuerAufteilungen(breiten, gruppe).find((a) => a.anzahl === anzahl)
  let a = fall([100, 100], 2)
  pruefe(a.zulaessig && a.tuerbreiteCm === 100 && a.felder.map((f) => f.korpusIndizes.length).join() === '1,1', '2 × 100er → 2 Türen à 100 (je ein Korpus)', a)
  a = fall([50, 50, 100], 2)
  pruefe(a.zulaessig && a.felder[0].korpusIndizes.join() === '0,1' && a.felder[1].korpusIndizes.join() === '2', '„1 + 2 Korpus ½ Breite, 3 Korpus ½ Breite" → 2 Türen à 100', a)
  a = fall([100, 50, 100, 50], 2, 'decoboard')
  pruefe(a.zulaessig && a.tuerbreiteCm === 150, '2 × (100 + 50) in Decoboard → 2 Türen à 150', a)
  a = fall([100, 50, 100, 50], 2, 'mattlack')
  pruefe(!a.zulaessig && /Decoboard oder Xtreme Plus/.test(a.gruende.join()), '… in Mattlack → nicht zulässig („150er nur in Decoboard oder Xtreme Plus")', a)
  a = fall([100, 100, 100], 3)
  pruefe(a.zulaessig && a.tuerbreiteCm === 100, '3 × 100er → 3 Türen à 100', a)
  pruefe(fall([100, 100, 100], 2).felder.length === 0, '3 × 100er lassen sich nicht in 2 gleiche Felder teilen')
  a = fall([50, 50, 50, 50, 50, 50], 3)
  pruefe(a.zulaessig && a.felder.every((f) => f.korpusIndizes.length === 2), '6 × 50er → 3 Türen à 100, je zwei Korpi', a)
  a = fall([50, 50, 50, 50, 50, 50, 50, 50], 4)
  pruefe(a.zulaessig && a.felder.length === 4, '8 × 50er → 4 Türen à 100 (4 bis 8 Module)', a)
  a = fall([60, 60, 60, 60], 4)
  pruefe(!a.zulaessig && /mindestens 80/.test(a.gruende.join()), '4 × 60er mit 4 Türen → 60 cm je Tür, unter 80 cm', a)
  a = fall([60, 60, 60, 60], 2)
  pruefe(a.zulaessig && a.tuerbreiteCm === 120, '4 × 60er mit 2 Türen → 2 Türen à 120 aus je zwei Korpi', a)
  a = fall([40, 40, 40, 120], 2)
  pruefe(!a.zulaessig && /höchstens 2 Korpi/.test(a.gruende.join()), 'Drei Korpi in einem Türfeld → nicht zulässig', a)
  a = fall([110, 110], 2)
  pruefe(!a.zulaessig && /ohne Mittelseite/.test(a.gruende.join()), '2 × 110 (Sondermaß) → „Korpus ohne Mittelseite höchstens 100"', a)
  pruefe(zerlegeInTuerfelder([100, 99.96], 2) != null, 'Sondermaße mit Nachkommastelle: Toleranz 0,05 cm')
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nS. 1 — Korpushöhe 18 bis 21 Raster'))
{
  const h = (hoehe) => schiebetuerHoeheProblem(schrank({ hoehe }).korpusGrunddaten)
  pruefe(!h('18R') && !h('21R'), '18 R und 21 R zulässig')
  pruefe(!h('250') && !h('235') && !h('274'), 'Sonderhöhen 235–274 cm zulässig')
  pruefe(Boolean(h('220')) && Boolean(h('280')), '220 cm und 280 cm gesperrt', [h('220'), h('280')])
  const d = schrank({ hoehe: '220', tuer: schiebetuer(), anzahl: 2 })
  pruefe(!isFrontsCompleteFuerEntwurf(d) && getFrontsIssuesFuerEntwurf(d).some((i) => /18 bis 21 Raster/.test(i)), 'Fronten-Schritt mit 220 cm unvollständig')
  pruefe(berechneEntwurf(d).vollstaendig === false, 'Kalkulation mit 220 cm nicht verbindlich')
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nS. 1 — Abschlusssets links & rechts, 20 mm'))
{
  const ohne = schrank({ tuer: undefined })
  const mit = schrank({ tuer: schiebetuer(), anzahl: 2 })
  const mOhne = berechneAussenmass(ohne.korpusGrunddaten, { schiebetuer: false })
  const mMit = berechneAussenmass(mit.korpusGrunddaten, { schiebetuer: true })
  pruefe(mOhne.gesamtbreiteCm === 199.5 && mMit.gesamtbreiteCm === 201.5, `2 × 100er: Außenbreite ${mOhne.gesamtbreiteCm} → ${mMit.gesamtbreiteCm} cm (2 × 10 mm mehr)`, [mOhne, mMit])
  pruefe(/2 × Abschlussset à 20 mm/.test(mMit.rechenweg ?? ''), 'Rechenweg nennt „2 × Abschlussset à 20 mm"', mMit.rechenweg)
  const zeile = describeKorpusGrunddatenZeilen(mit.korpusGrunddaten, { schiebetuer: true }).find((z) => z.label === 'Abschlussset')
  pruefe(/20 mm/.test(zeile?.value ?? '') && /nicht sichtbar/.test(zeile?.value ?? ''), 'Zusammenfassung / AV-PDF: „20 mm … von vorne nicht sichtbar"', zeile)
  const nurLinks = schrank({ abschluss: 'links', tuer: schiebetuer(), anzahl: 2 })
  pruefe(schiebetuerBefunde(nurLinks).some((b) => /links und rechts/.test(b)), 'Nur links → Befund „links und rechts immer notwendig"')
  pruefe(berechneEntwurf(nurLinks).vollstaendig === false, '… und Kalkulation nicht verbindlich')
  pruefe(schiebetuerBefunde(mit).length === 0, 'Links & rechts, 18 R, 2 × 100er → kein Befund', schiebetuerBefunde(mit))
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nKalkulation — Anzahl × Tür in Türfeld-Breite (bisher nur EINE Tür)'))
{
  let e = berechneEntwurf(schrank({ tuer: schiebetuer('glossy-less', glas()), anzahl: 2 }))
  let p = tuerPos(e)
  const glossy100 = zeilenpreis(100, 'GlossyLess')
  pruefe(p?.menge === 2 && p?.einzelpreis === glossy100 && p?.gesamt === 2 * glossy100, `Testentwurf B (2 × 100er, Glossy/Less): 2 × ${eur(glossy100)} = ${eur(p?.gesamt)} €`, p)
  e = berechneEntwurf(schrank({ breiten: [100, 100, 100], tuer: schiebetuer(), anzahl: 3 }))
  p = tuerPos(e)
  pruefe(p?.menge === 3 && p?.einzelpreis === zeilenpreis(100, 'Glatt1'), `3 × 100er, Glatt PG 1: 3 × ${eur(zeilenpreis(100, 'Glatt1'))} €`, p)
  e = berechneEntwurf(schrank({ breiten: [60, 60, 60, 60], tuer: schiebetuer(), anzahl: 2 }))
  p = tuerPos(e)
  pruefe(p?.menge === 2 && p?.einzelpreis === zeilenpreis(120, 'Glatt1'), `4 × 60er, 2 Türen: 2 × 120er (${eur(zeilenpreis(120, 'Glatt1'))} €)`, p)
  pruefe(e.vollstaendig, '… Kalkulation verbindlich', e.meldungen?.filter((m) => m.schwere === 'fehler'))
  e = berechneEntwurf(schrank({ breiten: [100, 50, 100, 50], tuer: schiebetuer('glatt', materialFuer('PG1', ['decoboard'])), anzahl: 2 }))
  p = tuerPos(e)
  pruefe(p?.menge === 2 && p?.einzelpreis === zeilenpreis(150, 'Glatt1'), `2 × (100 + 50) Decoboard: 2 × 150er (${eur(zeilenpreis(150, 'Glatt1'))} €)`, p)
  const d = schrank({ breiten: [100, 100], tuer: schiebetuer(), anzahl: 2 })
  pruefe(/2 Stück à 100er/.test(schiebetuerAnzahlText(d) ?? '') && /Tür 2: Korpus 2/.test(schiebetuerAnzahlText(d) ?? ''), `AV-Zeile: „${schiebetuerAnzahlText(d)}"`)
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nS. 5 — Curve ohne Griffprofil „Edge"'))
{
  pruefe(!griffProfilAnwendbar({ typeId: 'schiebetuer-zwei', styleLineId: 'curve' }), 'Schiebetür zweiläufig, Curve → kein Griffprofil')
  pruefe(griffProfilAnwendbar({ typeId: 'schiebetuer-zwei', styleLineId: 'glatt' }), 'Glatt → Griffprofil Edge')
  pruefe(!griffProfilAnwendbar({ typeId: 'drehtuer', styleLineId: 'glatt' }), 'Drehtür → kein Griffprofil (das ist der Edge-Griff, eine andere Auswahl)')
  const quelle = readFileSync(new URL('../src/lib/frontsFormat.ts', import.meta.url), 'utf8')
  pruefe(/griffProfilAnwendbar\(element\)/.test(quelle), 'Zusammenfassung / AV-PDF prüfen dieselbe Regel (frontsFormat.ts)')
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nRaumteiler & Sichtrückwand — Beschriftung und Sichtbarkeit'))
{
  const quelle = readFileSync(new URL('../src/pages/Korpus/Korpus.tsx', import.meta.url), 'utf8')
  const satz = (nr) => String(getArtikelNr(nr)?.aufschlag).replace('.', ',')
  const rt = /RAUMTEILER_CHECKBOX = '([^']+)'/.exec(quelle)?.[1]?.replace('{satz}', satz('90-037-0001'))
  const sr = /SICHTRUECKWAND_CHECKBOX = '([^']+)'/.exec(quelle)?.[1]?.replace('{satz}', satz('90-037-0004'))
  pruefe(rt === 'Raumteiler (5% Aufschlag auf den Möbelpreis)', `„${rt}"`)
  pruefe(sr === 'Sichtrückwand (10% Aufschlag auf den Möbelpreis)', `„${sr}"`)
  pruefe(getArtikelNr('90-037-0001')?.status === 'entwurf' && getArtikelNr('90-037-0004')?.status === 'entwurf', 'Beide Artikel stehen auf „entwurf"')
  pruefe(!aufschlagAbfrageSichtbar('sichtrueckwand', 'sideboards', 'entwurf', false), 'Entwurf → Abfrage ausgeblendet')
  uebernehmeServerStand([
    { bereich: 'artikel', schluessel: '90-037-0004', aktion: 'geaendert', daten: { ...getArtikelNr('90-037-0004'), status: 'aktiv' }, version: 1 },
  ])
  pruefe(aufschlagAbfrageSichtbar('sichtrueckwand', 'sideboards', getArtikelNr('90-037-0004')?.status, false), 'In der Verwaltung auf „aktiv" gespeichert → Abfrage erscheint')
  uebernehmeServerStand([])
  pruefe(!aufschlagAbfrageSichtbar('raumteiler', 'kleiderschraenke', 'aktiv', false), 'Raumteiler beim Kleiderschrank nie (Überarbeitung 9)')
}

// ---------------------------------------------------------------------------
console.log(c.bold('\nStand der sechs Cramer-Antworten (Mappe = Preisliste)'))
{
  const edge = getArtikelNr('30-012-0001')
  const edgePreis = getPreisListe().filter((z) => z.artikel === '30-012-0001')
  pruefe(edge?.preislogik === 'MATRIX_MASS' && edge?.status === 'aktiv' && edgePreis.length === 1 && edgePreis[0].preis === 40, 'Edge-Griff: 40 €/lfm, aktiv (Länge aus der Türhöhe)', edgePreis)
  const tablar = getPreisListe().filter((z) => z.artikel === '40-020-0003').map((z) => `${z.a[1]}=${z.preis}`).sort().join(' ')
  pruefe(getArtikelNr('40-020-0003')?.preislogik === 'FEST_PLUS_MATRIX' && tablar === 'Fixpreis=75 €/m=180', `KMK-Wandtablar: Festpreis + Matrix (${tablar})`)
  const auf = getPreisListe().filter((z) => z.artikel === '50-027-0001')
  pruefe(auf.length === 1 && auf[0].a[1] === '€/m' && auf[0].preis === 45, 'Hintere Aufkantung: 45 €/lfd. m')
  pruefe(getArtikelNr('40-017-0029')?.status === 'aktiv', 'Container Rauchglas-Deckplatte 40-017-0029: aktiv')
  pruefe(['80-034-0001', '80-034-0002'].every((n) => getArtikelNr(n)?.status === 'entwurf' && getArtikelNr(n)?.preislogik === 'AUF_ANFRAGE'), 'Tavolo-Massivplatten: entwurf / auf Anfrage')
  const ma = getMitarbeiterListe()
  pruefe(ma.filter((m) => m.personalnr === 'M-004').map((m) => m.name).join() === 'Sarib Test-Berater', 'M-004 = Sarib (Mappe); Herr Kerschbaummayr als M-104 liegt in Supabase')
}

// ---------------------------------------------------------------------------
console.log(c.bold('\n3D — Schrank-Modell folgt den Maßen'))
{
  const d = schrank({ breiten: [50, 60, 80, 100], abschluss: 'beide' })
  const m = schrankModell(d, 'drehtueren')
  pruefe(m && m.korpusse.length === 4 && m.korpusse.map((k) => k.breiteCm).join() === '50,60,80,100', '4 Module 50er / 60er / 80er / 100er', m?.korpusse)
  pruefe(m && m.breiteCm === 292 && m.hoeheCm === 235 && m.tiefeCm === 60, `Modell 292 × 235 × 60 cm (290 + 2 × 1 cm Abschlussset)`, m && [m.breiteCm, m.hoeheCm, m.tiefeCm])
  pruefe(m && m.bauteile.filter((t) => t.art === 'drehtuer').length === 6, 'Standard-Drehtüren: 1 + 1 + 2 + 2 = 6')
  const hoch = schrankModell(schrank({ breiten: [50, 60, 80, 100], hoehe: '21R' }), 'drehtueren')
  pruefe(hoch?.hoeheCm === 274, 'Höhe 21 R → Modell 274 cm hoch')
  const acht = schrankModell(schrank({ breiten: [50, 50, 50, 50, 50, 50, 50, 50] }), 'ohne')
  pruefe(acht?.korpusse.length === 8 && acht.bauteile.every((t) => !['drehtuer', 'schiebetuer'].includes(t.art)), '8 Module, „Ohne Fronten"')
  const st = schrankModell(schrank({ breiten: [100, 100], tuer: schiebetuer(), anzahl: 2 }), 'geplant')
  pruefe(st?.schiebetueren === 2 && st.breiteCm === 204, 'Geplante zweiläufige Schiebetür: 2 Türen über 100 + 100 + 2 × 2 cm', st && [st.schiebetueren, st.breiteCm])
  const ebenen = new Set(st?.bauteile.filter((t) => t.art === 'schiebetuer').map((t) => t.z))
  pruefe(ebenen.size === 2, 'Schiebetüren laufen in zwei Ebenen')
  const schub = { id: 's1', typeId: 'schuebe', label: 'S1', widthCm: '49', heightCm: '25,3', styleLineId: 'glatt', fieldValues: {} }
  const dreh = { id: 'd1', typeId: 'drehtuer', label: 'D1', widthCm: '49', heightCm: '201,5', styleLineId: 'glatt', tuerAnschlag: 'links', fieldValues: {} }
  const gm = schrankModell(schrank({ breiten: [50, 50], fronten: [[schub, dreh], []] }), 'geplant')
  pruefe(gm?.bauteile.filter((t) => t.art === 'schublade').length === 1 && gm.bauteile.filter((t) => t.art === 'drehtuer').length === 1, 'Geplante Fronten: Schub unten, Drehtür darüber')
  const sY = gm?.bauteile.find((t) => t.art === 'schublade')
  const dY = gm?.bauteile.find((t) => t.art === 'drehtuer')
  pruefe(sY && dY && dY.y > sY.y + sY.h, 'Drehtür sitzt über dem Schub', [sY, dY])
  pruefe(schrankModell(schrank({ breiten: [] })) === null, 'Ohne Korpus kein Modell')
}

console.log(fehler === 0 ? c.green(c.bold('\nAlle Prüfungen bestanden.\n')) : c.red(c.bold(`\n${fehler} Befund(e).\n`)))
process.exit(fehler === 0 ? 0 : 1)
