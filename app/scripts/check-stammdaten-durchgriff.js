#!/usr/bin/env node
/**
 * DURCHGRIFF-PRÜFUNG — wirkt JEDE Änderung in der Stammdatenverwaltung im Konfigurator und
 * in der Kalkulation? Artikel für Artikel, Preiszeile für Preiszeile.
 *
 * Auftrag (Überarbeitung 9, 10/2026): „Ein Agent ändert pro Artikel alle möglichen Änderungen
 * und speichert sie, der andere springt auf und erstellt einen Kleiderschrank mit den
 * Änderungen — es MUSS identisch mit den Änderungen in der Stammdatenverwaltung sein. Wenn das
 * klappt, die alten Werte zurücksetzen und weiter zum nächsten Artikel."
 *
 * Genau diese Schleife, automatisch und wiederholbar:
 *
 *   1  ZIELSCHRANK   Für jede Preiszeile jedes Artikels, den der Konfigurator verbaut, wird
 *                    ein Refugium-Schrank erzeugt, der genau diese Zeile treffen muss
 *                    (Breite, Höhe, Tiefe, Preisgruppe, Stil-Linie, Variante, Ausführung …).
 *   2  ÄNDERN        Die Zeile wird um 111,11 € geändert — als GESPEICHERTER Stand, so wie
 *                    jedes Gerät ihn aus Supabase lädt (`uebernehmeServerStand`).
 *   3  VERGLEICHEN   Die Position muss sich um genau Menge × 111,11 € ändern, der Möbelpreis
 *                    ebenso — nicht mehr, nicht weniger, keine andere Position.
 *   4  ZURÜCKSETZEN  Ohne die Änderung muss wieder exakt der alte Betrag herauskommen.
 *
 * Dazu für jeden Artikel: „gesperrt" ⇒ seine Positionen stehen „auf Anfrage" und die
 * Kalkulation ist nicht verbindlich; für jeden Aufschlag: geänderter Satz ⇒ geänderter Betrag.
 * Und ein FINGERABDRUCK-Lauf: Jede Preiszeile bekommt einen eindeutigen Preis; jeder
 * berechnete Betrag in allen erzeugten Schränken muss genau einen davon tragen — ein Betrag
 * ohne Fingerabdruck käme nicht aus der Stammdatenverwaltung.
 *
 * Zeilen, die der Konfigurator nicht erreichen KANN, werden mit Grund aufgelistet (z. B.
 * Stückgriffe: laut Preisliste im Türpreis enthalten).
 *
 *   npm run durchgriff:test            (Zusammenfassung)
 *   npm run durchgriff:test -- --alle  (jede Zeile einzeln ausgeben)
 */

import { artikel as stammArtikel, preise as stammPreise } from '../src/data/stammdaten.generated.ts'
import { getArtikelListe, getPreisListe, preisSchluessel, setzeAllesZurueck, uebernehmeServerStand } from '../src/lib/stammdatenStore.ts'
import { berechneEntwurf } from '../src/lib/kalkulation.ts'
import {
  artikelAufschlaege,
  ausstattungLookups,
  containerLookups,
  frontLookups,
  serienRegeln,
  serviceZuschlaege,
  verblendungLookups,
} from '../src/config/preisMapping.ts'
import { equipmentCategories } from '../src/config/equipment.ts'
import { handles } from '../src/config/handles.ts'
import { materialFuer } from './lib/testMaterial.js'

const alleZeigen = process.argv.includes('--alle')
const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
}
const r2 = (n) => Math.round(n * 100) / 100
const DELTA = 111.11

setzeAllesZurueck()
uebernehmeServerStand([])

// ---------------------------------------------------------------------------
// Schrank-Baukasten (Refugium)
// ---------------------------------------------------------------------------

let lfd = 0

/**
 * Ein Refugium-Schrank. Alle Maße und Preisgruppen als Parameter — die Funktion kennt keine
 * Preise, sie beschreibt nur, was ein Berater im Konfigurator eingeben würde.
 */
function schrank({
  breiten = [60],
  hoehe = '18R',
  tiefe = '60',
  innenPg = 'PG1',
  aussenPg,
  abschluss = 'keine',
  fussleiste = false,
  verblendung,
  elemente = [],
  equipment = [],
  korpusInnenJe,
  schiebetuerAnzahl,
} = {}) {
  lfd++
  const korpusse = breiten.map((b, i) => ({
    id: `k${i + 1}`,
    breiteMode: ['50', '60', '100'].includes(String(b)) ? String(b) : 'custom',
    breiteCm: ['50', '60', '100'].includes(String(b)) ? undefined : String(b),
    lochreihe: true,
  }))
  const columns = breiten.map((_, i) => ({
    id: `c${i + 1}`,
    elements: i === 0 ? elemente : [],
    equipment: i === 0 ? equipment : [],
  }))
  const auswahl = [...new Set(equipment.map((e) => e.optionId))]
  return {
    id: `DURCHGRIFF-${lfd}`,
    createdAt: '2026-10-07T00:00:00.000Z',
    consultant: { id: 'TEST', name: 'Durchgriff' },
    orderNumber: '',
    customerName: 'Durchgriff',
    branchId: 'F-001',
    productGroupId: 'kleiderschraenke',
    seriesId: 'refugium',
    korpus: { innen: materialFuer(innenPg) },
    ...(korpusInnenJe ? { korpusInnenJeKorpus: korpusInnenJe } : {}),
    korpusGrunddaten: {
      heightMode: ['18R', '21R'].includes(hoehe) ? hoehe : 'custom',
      heightCm: ['18R', '21R'].includes(hoehe) ? undefined : String(hoehe),
      depthMode: tiefe === '60' ? '60' : 'custom',
      depthCm: tiefe === '60' ? undefined : String(tiefe),
      korpusse,
      abschlussSet:
        abschluss === 'keine'
          ? { position: 'keine' }
          : { position: abschluss, material: materialFuer(aussenPg ?? innenPg) },
      ...(fussleiste ? { fussleiste: { enabled: true, hoeheCm: '10', tiefeCm: '5' } } : {}),
      ...(verblendung ? { verblendung } : {}),
    },
    ausstattung: { selected: auswahl },
    fronts: { columns, ...(schiebetuerAnzahl ? { schiebetuerAnzahl } : {}) },
    pricingOptions: { montage: true, lieferungRegional: true },
    isVerification: true,
  }
}

/** Schwellenwert in cm aus einem Stufenwert („60 cm | 60er" → 60, „273,4 cm | 21R" → 273.4). */
const cm = (w) => {
  const m = /^(\d+(?:[.,]\d+)?)\s*cm/.exec(String(w ?? '').trim())
  return m ? Number(m[1].replace(',', '.')) : undefined
}
/** Rasteretikett („235 cm | 18R" → „18R", „57,3 cm | 4,5R" → „4,5R"). */
const etikett = (w) => /\|\s*(.+)$/.exec(String(w ?? ''))?.[1]?.trim()
const achse = (art, zeile, code) => {
  const i = art.achsen.indexOf(code)
  return i >= 0 ? zeile.a[i] : undefined
}

/** LINIE_PG-Wert → Stil-Linie + Preisgruppe, wie der Berater sie wählt. */
function linieAus(wert) {
  const glatt = /^Glatt([1-4])$/.exec(wert)
  if (glatt) return { styleLineId: 'glatt', pg: `PG${glatt[1]}` }
  if (wert === 'CurvePG1') return { styleLineId: 'curve', pg: 'PG1' }
  if (wert === 'CurvePG2-4') return { styleLineId: 'curve', pg: 'PG3' }
  if (wert === '107PG1') return { styleLineId: '107', pg: 'PG1' }
  if (wert === '107PG2-4') return { styleLineId: '107', pg: 'PG4' }
  if (wert === 'Line') return { styleLineId: 'line', pg: 'PG2' }
  if (wert === 'GlossyLess') return { styleLineId: 'glossy', pg: 'PG1' }
  return null
}

const ausstattungsOption = (id) => equipmentCategories.flatMap((k) => k.options).find((o) => o.id === id)

// ---------------------------------------------------------------------------
// Welche Artikel verbaut der Konfigurator — und wie trifft ein Schrank eine Zeile?
// ---------------------------------------------------------------------------

/**
 * Je Artikel ein Baumeister: Preiszeile → Schrank, der genau sie treffen muss — oder
 * `{ grund }`, wenn der Konfigurator diese Zeile nicht erreichen kann.
 */
const baumeister = new Map()
const wo = new Map()
const merke = (nr, beschreibung, fn) => {
  if (!baumeister.has(nr)) baumeister.set(nr, fn)
  if (!wo.has(nr)) wo.set(nr, beschreibung)
}

const regel = serienRegeln.refugium
const hoeheModus = (w) => etikett(w) === '21R' ? '21R' : etikett(w) === '18R' ? '18R' : null

// Korpus: BREITE × HOEHE × TIEFE × PG
merke(regel.korpus.artikel, 'Korpus', (z, a) => {
  const b = cm(achse(a, z, 'BREITE'))
  if (!b || b < 15) return { grund: `Breitenstufe „${achse(a, z, 'BREITE')}" — keine Korpusbreite (15–100 cm) trifft sie` }
  return schrank({ breiten: [b], hoehe: hoeheModus(achse(a, z, 'HOEHE')), tiefe: String(cm(achse(a, z, 'TIEFE'))), innenPg: achse(a, z, 'PG') })
})
// Mittelseite: HOEHE × TIEFE × PG — zwei Korpi, beide in derselben PG
merke(regel.mittelseite.artikel, 'Mittelseite', (z, a) =>
  schrank({ breiten: [60, 60], hoehe: hoeheModus(achse(a, z, 'HOEHE')), tiefe: String(cm(achse(a, z, 'TIEFE'))), innenPg: achse(a, z, 'PG') }),
)
// Außenset (Abschlussset): HOEHE × PG — PG aus dem Material des Abschlusssets
merke(regel.aussenset.artikel, 'Abschlussset', (z, a) =>
  schrank({ hoehe: hoeheModus(achse(a, z, 'HOEHE')), abschluss: 'beide', aussenPg: achse(a, z, 'PG') }),
)
merke(regel.fussleistenausschnitt.artikel, 'Fußleistenausschnitt', () => schrank({ fussleiste: true }))
for (const [art, l] of Object.entries(verblendungLookups)) {
  merke(l.artikel, `Verblendung ${art}`, () =>
    schrank({ verblendung: { art, seiten: { links: true, oben: true, rechts: true }, lfm: '5', lfmManuell: true } }),
  )
}

/**
 * Zweiläufige Schiebetür (Überarbeitung 10): zwei Türen über Türfelder, die genau die Breite
 * der Zeile haben — 80er / 100er aus je einem Korpus, 120er / 150er aus je zwei Korpi.
 * Abschlusssets links & rechts, 18 Raster. 150er gibt es nur in Decoboard oder Xtreme Plus.
 */
const SCHIEBETUER_FELDER = { 80: [80], 100: [100], 120: [60, 60], 150: [100, 50] }
function schiebetuerSchrank(breite, linie) {
  const feld = SCHIEBETUER_FELDER[breite]
  if (!feld) return { grund: `Breitenstufe ${breite} cm — kein Türfeld aus ein oder zwei Korpi` }
  const material = breite > 120 ? materialFuer(linie.pg, ['decoboard', 'xtreme-plus']) : materialFuer(linie.pg)
  const el = {
    id: 'e1',
    typeId: 'schiebetuer-zwei',
    label: 'ST1',
    styleLineId: linie.styleLineId === 'glossy' ? 'glossy-less' : linie.styleLineId,
    griffProfil: 'edge',
    fieldValues: { material: { material } },
  }
  return schrank({ breiten: [...feld, ...feld], abschluss: 'beide', elemente: [el], schiebetuerAnzahl: 2 })
}

// Fronten: BREITE × HOEHE × TIEFE × LINIE_PG
for (const [typeId, l] of Object.entries(frontLookups)) {
  merke(l.artikel, `Front ${typeId}`, (z, a) => {
    const linie = linieAus(achse(a, z, 'LINIE_PG') ?? '')
    if (!linie) return { grund: `Stil-Linie/PG „${achse(a, z, 'LINIE_PG')}" ist im Konfigurator nicht wählbar` }
    const breite = cm(achse(a, z, 'BREITE'))
    const hoehe = cm(achse(a, z, 'HOEHE'))
    const tiefe = cm(achse(a, z, 'TIEFE'))
    if (typeId === 'schiebetuer-zwei') return schiebetuerSchrank(breite, linie)
    const el = {
      id: 'e1',
      typeId,
      label: 'F1',
      widthCm: String(breite ?? 60),
      heightCm: hoehe != null ? String(hoehe) : undefined,
      styleLineId: linie.styleLineId,
      fieldValues: { material: { material: materialFuer(linie.pg) } },
    }
    return schrank({ elemente: [el], tiefe: tiefe ? String(tiefe) : '60' })
  })
}

// Griffe: nur nicht im Türpreis enthaltene (Edge, € je lfm) sind eigene Positionen.
for (const a of stammArtikel.filter((x) => x.dropdown === 'GRIFF')) {
  const handle = handles.find((h) => (h.id === 'edge' ? /edge/i.test(a.bezeichnung) : new RegExp(`\\bNr\\.\\s*${h.id.replace('nr', '')}\\b`).test(a.bezeichnung)))
  merke(a.artikelnummer, `Griff ${handle?.label ?? a.bezeichnung}`, (z, art) => {
    if (art.preislogik === 'FESTPREIS') return { grund: 'Stückgriff — laut Preisliste im Türpreis enthalten, keine eigene Position' }
    const el = {
      id: 'e1', typeId: 'drehtuer', label: 'D1', widthCm: '59', heightCm: '195', hoeheModus: 'cm', tuerAnschlag: 'links',
      styleLineId: 'glatt', griff: true, griffId: handle?.id, griffFarbe: 'RAL 9005',
      fieldValues: { material: { material: materialFuer('PG1') } },
    }
    return schrank({ elemente: [el] })
  })
}

// Ausstattung
function ausstattung(optionId, z, a, extra = {}) {
  const o = ausstattungsOption(optionId)
  const breite = cm(achse(a, z, 'BREITE')) ?? 60
  const tiefe = cm(achse(a, z, 'TIEFE'))
  const pg = achse(a, z, 'PG') ?? 'PG1'
  const item = {
    id: 'q1',
    optionId,
    qty: 1,
    hoehen: o?.heightMode && o.heightMode !== 'keine' ? [{ modus: 'raster', raster: 3 }] : undefined,
    ...extra,
  }
  return schrank({ breiten: [breite], tiefe: tiefe ? String(tiefe) : '60', innenPg: pg, equipment: [item] })
}
for (const [optionId, l] of Object.entries(ausstattungLookups)) {
  merke(l.artikel, `Ausstattung ${optionId}`, (z, a) => {
    if (l.festePg && achse(a, z, 'PG') && achse(a, z, 'PG') !== l.festePg) {
      return { grund: `rechnet immer ${l.festePg} (Überarbeitung 9) — die Zeile ${achse(a, z, 'PG')} wird bewusst nicht gezogen` }
    }
    if (optionId === 'led-band-aluprofil') {
      const h = cm(achse(a, z, 'HOEHE'))
      return schrank({ hoehe: String(h), equipment: [{ id: 'q1', optionId, seiten: { links: true, rechts: false } }] })
    }
    if (optionId === 'innenschublade') {
      return ausstattung(optionId, z, a, { variant: etikett(achse(a, z, 'HOEHE')) })
    }
    return ausstattung(optionId, z, a)
  })
  for (const k of l.komponenten ?? []) {
    merke(k.artikel, `${k.label} (zu ${optionId})`, (z, a) => ausstattung(optionId, z, a))
  }
}
for (const [optionId, varianten] of Object.entries(containerLookups)) {
  for (const [variante, l] of Object.entries(varianten)) {
    const ziele = [{ artikel: l.artikel, rauchglas: false }, ...(l.artikelBeiAuswahl ? [{ artikel: l.artikelBeiAuswahl, rauchglas: true }] : [])]
    for (const [wahl, t] of Object.entries(l.artikelJeAuswahl?.artikel ?? {})) {
      ziele.push({ artikel: t.artikel, rauchglas: false, wahl }, ...(t.artikelBeiAuswahl ? [{ artikel: t.artikelBeiAuswahl, rauchglas: true, wahl }] : []))
    }
    for (const ziel of ziele) {
      merke(ziel.artikel, `${optionId} ${variante}${ziel.wahl ? ` · ${ziel.wahl}` : ''}${ziel.rauchglas ? ' · Rauchglas' : ''}`, (z, a) => {
        const v = optionId === 'container' ? etikett(achse(a, z, 'HOEHE')) : variante
        return ausstattung(optionId, z, a, {
          variant: v,
          rauchglas: ziel.rauchglas,
          ...(ziel.wahl ? { choices: { funktionsauszug: ziel.wahl } } : {}),
        })
      })
    }
  }
}

// ---------------------------------------------------------------------------
// 1 — Fingerabdruck: kommt JEDER Betrag aus den Stammdaten?
// ---------------------------------------------------------------------------

console.log(c.bold('\nDurchgriff Stammdatenverwaltung → Konfigurator → Kalkulation'))
const zuPruefen = [...baumeister.keys()].map((nr) => ({ nr, art: stammArtikel.find((a) => a.artikelnummer === nr) })).filter((x) => x.art)
const zeilenJe = new Map(zuPruefen.map(({ nr }) => [nr, stammPreise.filter((p) => p.artikel === nr)]))
console.log(c.dim(`  ${zuPruefen.length} Artikel im Konfigurator, ${[...zeilenJe.values()].reduce((s, z) => s + z.length, 0)} Preiszeilen`))

const faelle = [] // { nr, zeile, schluessel, draft | grund }
for (const { nr, art } of zuPruefen) {
  for (const zeile of zeilenJe.get(nr)) {
    const ergebnis = baumeister.get(nr)(zeile, art)
    faelle.push({ nr, art, zeile, schluessel: preisSchluessel(zeile), ...(ergebnis?.grund ? { grund: ergebnis.grund } : { draft: ergebnis }) })
  }
}
const mitSchrank = faelle.filter((f) => f.draft)

// Jede Preiszeile ALLER Artikel bekommt einen eindeutigen Preis.
const FINGERABDRUCK_BASIS = 900000
const alleZeilen = getPreisListe()
const fingerabdruck = new Map()
const fpOverrides = alleZeilen.map((z, i) => {
  fingerabdruck.set(FINGERABDRUCK_BASIS + i, preisSchluessel(z))
  return { bereich: 'preise', schluessel: preisSchluessel(z), aktion: 'geaendert', daten: { ...z, preis: FINGERABDRUCK_BASIS + i }, version: 1 }
})
uebernehmeServerStand(fpOverrides)
const fremdeBetraege = []
const getroffen = new Map() // schluessel → Anzahl
for (const f of mitSchrank) {
  const e = berechneEntwurf(f.draft)
  for (const p of e.positionen) {
    if (p.status !== 'berechnet') continue
    for (const t of p.teile) {
      const k = fingerabdruck.get(t.preis)
      if (!k) fremdeBetraege.push(`${p.artikelnummer} „${p.label}": ${t.preis} € stammt aus keiner Preiszeile`)
      else getroffen.set(k, (getroffen.get(k) ?? 0) + 1)
    }
  }
}
uebernehmeServerStand([])
console.log(c.bold('\n  1  Fingerabdruck — jeder berechnete Betrag stammt aus einer Preiszeile'))
console.log(`    ${fremdeBetraege.length === 0 ? c.green('✓') : c.red('✗')} ${mitSchrank.length} Schränke, ${[...getroffen.values()].reduce((s, n) => s + n, 0)} Teilbeträge — ${fremdeBetraege.length} ohne Herkunft`)
for (const t of [...new Set(fremdeBetraege)].slice(0, 15)) console.log(c.red(`      ${t}`))

// ---------------------------------------------------------------------------
// 2 — Ändern · Vergleichen · Zurücksetzen, Zeile für Zeile
// ---------------------------------------------------------------------------

console.log(c.bold('\n  2  Preiszeile ändern (gespeichert) → Schrank rechnen → vergleichen → zurücksetzen'))
const befunde = { ok: 0, nichtGetroffen: [], falsch: [], zuruecksetzen: [] }
const jeArtikel = new Map()
for (const f of mitSchrank) {
  const vorher = berechneEntwurf(f.draft)
  const eigene = (e) => e.positionen.filter((p) => p.artikelnummer === f.nr || p.teile.some((t) => t.artikelnummer === f.nr))
  // Speichern, wie es jedes Gerät aus Supabase lädt:
  const preisNeu = r2((f.zeile.preis ?? 0) + DELTA)
  uebernehmeServerStand([{ bereich: 'preise', schluessel: f.schluessel, aktion: 'geaendert', daten: { ...f.zeile, preis: preisNeu }, version: 1 }])
  const nachher = berechneEntwurf(f.draft)
  uebernehmeServerStand([])
  const zurueck = berechneEntwurf(f.draft)

  // Welche Teilbeträge hat die geänderte Zeile gespeist? Die mit dem neuen Preis.
  const teile = eigene(nachher).flatMap((p) => p.teile.filter((t) => t.preis === preisNeu).map((t) => ({ p, t })))
  const erwartet = r2(teile.reduce((s, { t }) => s + t.menge * DELTA, 0))
  const diffMoebel = r2(nachher.moebelpreis - vorher.moebelpreis)
  const status = jeArtikel.get(f.nr) ?? { ok: 0, fehler: 0, ausgelassen: 0 }
  if (teile.length === 0) {
    befunde.nichtGetroffen.push(`${f.nr} ${f.art.kurzzeichen} [${f.zeile.a.filter(Boolean).join(' · ')}] — ${eigene(nachher).map((p) => `${p.status}${p.hinweis ? ': ' + p.hinweis.slice(0, 110) : ''}`).join(' | ') || 'keine Position'}`)
    status.fehler++
  } else if (diffMoebel !== erwartet || Math.abs(erwartet) < 0.001) {
    befunde.falsch.push(`${f.nr} ${f.art.kurzzeichen} [${f.zeile.a.filter(Boolean).join(' · ')}] — Möbelpreis +${diffMoebel} €, erwartet +${erwartet} €`)
    status.fehler++
  } else if (zurueck.moebelpreis !== vorher.moebelpreis || zurueck.gesamt !== vorher.gesamt) {
    befunde.zuruecksetzen.push(`${f.nr} [${f.zeile.a.filter(Boolean).join(' · ')}] — nach dem Zurücksetzen ${zurueck.gesamt} statt ${vorher.gesamt}`)
    status.fehler++
  } else {
    befunde.ok++
    status.ok++
    if (alleZeigen) console.log(c.dim(`      ✓ ${f.nr} [${f.zeile.a.filter(Boolean).join(' · ')}] +${erwartet} €`))
  }
  jeArtikel.set(f.nr, status)
}
for (const f of faelle.filter((x) => x.grund)) {
  const s = jeArtikel.get(f.nr) ?? { ok: 0, fehler: 0, ausgelassen: 0 }
  s.ausgelassen++
  jeArtikel.set(f.nr, s)
}
console.log(`    ${befunde.ok === mitSchrank.length ? c.green('✓') : c.red('✗')} ${befunde.ok} von ${mitSchrank.length} erreichbaren Preiszeilen: Änderung kommt exakt an, Zurücksetzen stellt den alten Betrag her`)
for (const [titel, liste] of [
  ['Änderung kommt NICHT an (Zeile wird nicht gezogen)', befunde.nichtGetroffen],
  ['Betrag weicht ab', befunde.falsch],
  ['Zurücksetzen unvollständig', befunde.zuruecksetzen],
]) {
  if (liste.length === 0) continue
  console.log(c.red(`    ✗ ${titel}: ${liste.length}`))
  for (const t of liste.slice(0, alleZeigen ? 999 : 25)) console.log(c.red(`      ${t}`))
  if (!alleZeigen && liste.length > 25) console.log(c.dim(`      … ${liste.length - 25} weitere (--alle)`))
}

// ---------------------------------------------------------------------------
// 3 — Artikel gesperrt ⇒ „auf Anfrage"
// ---------------------------------------------------------------------------

console.log(c.bold('\n  3  Artikel in der Verwaltung sperren → Position „auf Anfrage", Kalkulation nicht verbindlich'))
const sperrFehler = []
let sperrOk = 0
for (const { nr, art } of zuPruefen) {
  const fall = mitSchrank.find((f) => f.nr === nr)
  if (!fall) continue
  uebernehmeServerStand([{ bereich: 'artikel', schluessel: nr, aktion: 'geaendert', daten: { status: 'gesperrt' }, version: 1 }])
  const e = berechneEntwurf(fall.draft)
  uebernehmeServerStand([])
  const pos = e.positionen.filter((p) => p.artikelnummer === nr)
  const komp = e.positionen.filter((p) => p.artikelnummer !== nr && p.status === 'auf-anfrage')
  if ((pos.length > 0 && pos.every((p) => p.status === 'auf-anfrage') && !e.vollstaendig) || (pos.length === 0 && komp.length > 0 && !e.vollstaendig)) sperrOk++
  else sperrFehler.push(`${nr} ${art.kurzzeichen} ${art.bezeichnung}`)
}
console.log(`    ${sperrFehler.length === 0 ? c.green('✓') : c.red('✗')} ${sperrOk} Artikel: gesperrt ⇒ auf Anfrage`)
for (const t of sperrFehler) console.log(c.red(`      ${t}`))

// ---------------------------------------------------------------------------
// 4 — Aufschläge: Satz ändern ⇒ Betrag folgt
// ---------------------------------------------------------------------------

console.log(c.bold('\n  4  Aufschläge (Montage, Lieferung, Raumteiler, Sichtrückwand) — Satz ändern'))
const aufschlagFehler = []
const basisSchrank = { ...schrank({ breiten: [60, 60] }), productGroupId: 'sideboards', raumteiler: true, sichtRueckwandAussen: true }
for (const z of [...serviceZuschlaege, ...artikelAufschlaege]) {
  const a = getArtikelListe().find((x) => x.artikelnummer === z.artikel)
  const satz = 7.25
  uebernehmeServerStand([
    { bereich: 'artikel', schluessel: z.artikel, aktion: 'geaendert', daten: { aufschlag: satz, status: 'aktiv' }, version: 1 },
    ...artikelAufschlaege.filter((x) => x.artikel !== z.artikel).map((x) => ({ bereich: 'artikel', schluessel: x.artikel, aktion: 'geaendert', daten: { status: 'aktiv' }, version: 1 })),
  ])
  const e = berechneEntwurf(basisSchrank)
  uebernehmeServerStand([])
  const pos = e.zuschlaege.find((p) => p.artikelnummer === z.artikel)
  const basis = z.art === 'montage' || z.art === 'lieferung' ? e.gesamtmoebelpreis : e.moebelpreis
  if (pos?.gesamt === r2((basis * satz) / 100) && /7,25 %/.test(pos.label)) {
    console.log(`    ${c.green('✓')} ${a.bezeichnung}: Satz 7,25 % gespeichert → ${pos.gesamt.toFixed(2).replace('.', ',')} €`)
  } else {
    aufschlagFehler.push(`${z.artikel}: ${pos?.gesamt} statt ${r2((basis * satz) / 100)}`)
    console.log(`    ${c.red('✗')} ${a.bezeichnung}: ${pos?.gesamt} statt ${r2((basis * satz) / 100)}`)
  }
}

// ---------------------------------------------------------------------------
// 6 — Oberflächen: Preisgruppe in der Verwaltung ändern ⇒ bestehender Entwurf folgt
// ---------------------------------------------------------------------------

console.log(c.bold('\n  6  Preisgruppe einer Kategorie / Farbe ändern → Korpus, Front, Ausstattung folgen'))
const pgFehler = []
{
  const mat = materialFuer('PG2')
  const tuer = {
    id: 'e1', typeId: 'drehtuer', label: 'D1', widthCm: '59', heightCm: '230', hoeheModus: 'cm', tuerAnschlag: 'links',
    styleLineId: 'glatt', fieldValues: { material: { material: mat } },
  }
  const entwurf = schrank({ breiten: [60], innenPg: 'PG2', elemente: [tuer], equipment: [{ id: 'q1', optionId: 'rollboden', qty: 1, hoehen: [{ modus: 'raster', raster: 3 }] }] })
  entwurf.korpus.innen = mat
  const zeilePg = (e, nr) => e.positionen.find((p) => p.artikelnummer === nr)?.achsen.find((a) => a.code === 'PG' || a.code === 'LINIE_PG')?.wert
  const pruefePg = (titel, overrides, erwartet) => {
    uebernehmeServerStand(overrides)
    const e = berechneEntwurf(entwurf)
    uebernehmeServerStand([])
    const ist = { korpus: zeilePg(e, '10-001-0003'), front: zeilePg(e, '20-006-0001'), rollboden: zeilePg(e, '40-014-0003') }
    const ok = ist.korpus === erwartet.pg && ist.front === erwartet.linie && ist.rollboden === erwartet.pg
    console.log(`    ${ok ? c.green('✓') : c.red('✗')} ${titel}: Korpus ${ist.korpus} · Tür ${ist.front} · Rollboden ${ist.rollboden}`)
    if (!ok) pgFehler.push(titel)
  }
  pruefePg('Ausgangslage (Farbe in PG 2)', [], { pg: 'PG2', linie: 'Glatt2' })
  const kategorie = mat.materialGroupId
  pruefePg(
    `Kategorie „${kategorie}" auf PG 3 gespeichert`,
    [{ bereich: 'kategorien', schluessel: mat.materialGroupId, aktion: 'geaendert', daten: { preisgruppe: 'PG3' }, version: 1 }],
    { pg: 'PG3', linie: 'Glatt3' },
  )
  pruefePg(
    `Nur die Farbe „${mat.optionId}" auf PG 4 gespeichert`,
    [{ bereich: 'oberflaechen', schluessel: `${mat.materialGroupId}::${mat.optionId}`, aktion: 'geaendert', daten: { preisgruppe: 'PG4' }, version: 1 }],
    { pg: 'PG4', linie: 'Glatt4' },
  )
  pruefePg('Zurückgesetzt', [], { pg: 'PG2', linie: 'Glatt2' })
}

// ---------------------------------------------------------------------------
// 5 — Was der Konfigurator nicht erreichen kann
// ---------------------------------------------------------------------------

const ausgelassen = faelle.filter((f) => f.grund)
console.log(c.bold(`\n  5  Nicht erreichbare Preiszeilen (${ausgelassen.length}) — mit Grund`))
const nachGrund = new Map()
for (const f of ausgelassen) {
  const k = `${f.nr} ${f.art.kurzzeichen} — ${f.grund}`
  nachGrund.set(k, (nachGrund.get(k) ?? 0) + 1)
}
for (const [k, n] of nachGrund) console.log(c.dim(`    · ${k} (${n} Zeile${n === 1 ? '' : 'n'})`))

// ---------------------------------------------------------------------------
// Ergebnis je Artikel
// ---------------------------------------------------------------------------

console.log(c.bold('\n  Je Artikel'))
for (const { nr, art } of zuPruefen) {
  const s = jeArtikel.get(nr) ?? { ok: 0, fehler: 0, ausgelassen: 0 }
  const zeichen = s.fehler > 0 ? c.red('✗') : s.ok > 0 ? c.green('✓') : c.dim('·')
  if (s.fehler > 0 || alleZeigen) {
    console.log(`    ${zeichen} ${nr} ${art.kurzzeichen.padEnd(8)} ${String(s.ok).padStart(3)} ok · ${s.fehler} Fehler · ${s.ausgelassen} nicht erreichbar — ${wo.get(nr)}`)
  }
}
const artikelOk = zuPruefen.filter(({ nr }) => (jeArtikel.get(nr)?.fehler ?? 0) === 0).length
console.log(c.dim(`    ${artikelOk} von ${zuPruefen.length} Artikeln ohne Befund${alleZeigen ? '' : ' (Einzelliste mit --alle)'}`))

const fehler =
  fremdeBetraege.length + befunde.nichtGetroffen.length + befunde.falsch.length + befunde.zuruecksetzen.length + sperrFehler.length + aufschlagFehler.length + pgFehler.length
console.log(fehler === 0 ? c.green(c.bold('\nAlle Prüfungen bestanden.\n')) : c.red(c.bold(`\n${fehler} Befund(e).\n`)))
process.exit(fehler === 0 ? 0 : 1)
