import type { Draft } from '../types'
import { praxistestEntwuerfe } from './praxistestEntwuerfe.ts'

/**
 * TEST- UND BEISPIEL-ENTWÜRFE.
 *
 * Diese Entwürfe sind KEINE fest eingeblendeten Referenzen mehr: Sie werden einmalig
 * über `npm run seed:entwuerfe` in Supabase geschrieben und verhalten sich danach wie
 * jeder andere Entwurf — sie lassen sich öffnen, duplizieren, bearbeiten und im
 * Dashboard löschen. Die früheren `verificationDrafts` hingen im Code fest und ließen
 * sich über die Oberfläche nicht entfernen.
 *
 * Alle drei tragen ausschließlich Konfiguration, keinen Preis: Was sie kosten, rechnet
 * die Engine aus den Stammdaten. Ein hier eingetragener Betrag würde genau die Frage
 * verdecken, für die es sie gibt.
 */

// --- Materialbausteine (IDs aus den Oberflächen-Stammdaten) ----------------------
const decoboardSchwarz = {
  materialGroupId: 'decoboard',
  optionId: 'schwarz-u190vl',
  priceGroup: 'PG1' as const,
}
const decoboardKaschmir = {
  materialGroupId: 'decoboard',
  optionId: 'kaschmirgrau-u12168sd',
  priceGroup: 'PG1' as const,
}
const mattlackFjord = {
  materialGroupId: 'mattlack',
  optionId: 'fjord-sikkens-uo-10-20',
  priceGroup: 'PG2' as const,
}
const furnierRaeuchereiche = {
  materialGroupId: 'furnier',
  optionId: 'raeuchereiche-geoelt-farbton-kann-variieren',
  priceGroup: 'PG3' as const,
}
const glasStone = {
  materialGroupId: 'glas',
  optionId: 'stone',
  priceGroup: 'PG3' as const,
}

// ---------------------------------------------------------------------------
// 1) Preisprobe — der Schrank aus „Cramer Planer_Überarbeitung Preise.pdf"
// ---------------------------------------------------------------------------

/**
 * Shop-Artikel 23855.44 „Refugium Kleiderschrank mit Standard-Ausstattung":
 * 3 × 100er Korpus, 18 Raster, Decoboard Schwarz, je Segment zwei Drehtüren mit
 * Bügelgriff, ein Einlegeboden und ein Einlegeboden inkl. Kleiderstange.
 *
 * Dient dem Abgleich gegen die gedruckte Preisliste (`npm run preis:test`).
 */
function preisprobeSegment(nr: number) {
  const tuer = (n: number) => ({
    id: `pe${n}`,
    typeId: 'drehtuer',
    label: `D${n}`,
    widthCm: '49',
    heightCm: '230',
    hoeheModus: 'cm' as const,
    tuerAnschlag: (n % 2 === 1 ? 'links' : 'rechts') as 'links' | 'rechts',
    styleLineId: 'glatt',
    griff: true,
    griffId: 'nr124',
    fieldValues: { material: { material: decoboardSchwarz } },
  })
  return {
    id: `pc${nr}`,
    elements: [tuer(nr * 2 - 1), tuer(nr * 2)],
    equipment: [
      { id: `pq${nr}a`, optionId: 'einlegeboden', qty: 1, hoehen: [{ modus: 'raster' as const, raster: 9 }] },
      {
        id: `pq${nr}b`,
        optionId: 'einlegeboden-kleiderstange',
        qty: 1,
        hoehen: [{ modus: 'raster' as const, raster: 15 }],
        choices: { stangenAusfuehrung: 'chrom' },
      },
    ],
  }
}

export const preisprobeEntwurf: Draft = {
  id: 'CRAMER-2026-PREISPROBE',
  createdAt: '2026-09-09T08:00:00.000Z',
  consultant: { id: 'M-001', name: 'Anna Berger' },
  orderNumber: 'Shop 23855.44',
  customerName: 'Preisprobe · Refugium Standard (Ziel 3.275 €)',
  branchId: 'F-001',
  productGroupId: 'kleiderschraenke',
  seriesId: 'refugium',
  korpus: { innen: { ...decoboardSchwarz }, aussen: { ...decoboardSchwarz } },
  korpusGrunddaten: {
    heightMode: '18R',
    depthMode: '60',
    korpusse: [
      { id: 'pk1', breiteMode: '100', lochreihe: true },
      { id: 'pk2', breiteMode: '100', lochreihe: true },
      { id: 'pk3', breiteMode: '100', lochreihe: true },
    ],
    abschlussSet: { position: 'beide', material: { ...decoboardSchwarz } },
  },
  dimensions: { heightCm: '235', widthCm: '300', depthCm: '60', segments: 3 },
  fronts: { columns: [preisprobeSegment(1), preisprobeSegment(2), preisprobeSegment(3)] },
  ausstattung: { selected: ['einlegeboden', 'einlegeboden-kleiderstange'] },
  pricingOptions: { montage: false, lieferungRegional: false },
}

// ---------------------------------------------------------------------------
// 2) Beispiel A — Drehtüren, Raster-Höhen, volle Innenausstattung
// ---------------------------------------------------------------------------

/**
 * Zeigt die Neuerungen der Überarbeitung 3 (Türhöhe über Raster und „bis
 * Korpusoberkante", Türanschlag, Stil-Linie „Line" mit getrennter Aufkantung,
 * Griffdetails) zusammen mit den Ausstattungs-Neuerungen aus 2_2 (Rasterhöhen je
 * Stück, Kleiderstange in Chrom/Schwarz, Glasart, Bezug auf eine Schublade).
 */
export const beispielDrehtuerEntwurf: Draft = {
  id: 'CRAMER-2026-TEST-0001',
  createdAt: '2026-09-09T08:10:00.000Z',
  consultant: { id: 'M-001', name: 'Anna Berger' },
  orderNumber: '2026-TEST-01',
  customerName: 'Testentwurf A · Drehtüren mit Raster-Höhen & Innenausstattung',
  branchId: 'F-001',
  productGroupId: 'kleiderschraenke',
  seriesId: 'refugium',
  korpus: { innen: { ...furnierRaeuchereiche }, aussen: { ...mattlackFjord } },
  korpusGrunddaten: {
    heightMode: '18R',
    depthMode: '60',
    korpusse: [
      { id: 'ak1', breiteMode: '100', lochreihe: true },
      { id: 'ak2', breiteMode: '60', lochreihe: true },
      { id: 'ak3', breiteMode: '50', lochreihe: true },
    ],
    abschlussSet: { position: 'beide', material: { ...mattlackFjord } },
    sondermasse: 'Nische 302 cm — Außenmaß darf 301 cm nicht überschreiten.',
  },
  dimensions: { heightCm: '235', widthCm: '215', depthCm: '60', segments: 3 },
  ausstattung: {
    selected: [
      'einlegeboden',
      'einlegeboden-kleiderstange',
      'innenschublade',
      'glasboden',
      'kleiderlift',
      'schubladenunterteilung-craft',
      'led-band-aluprofil',
    ],
  },
  fronts: {
    columns: [
      {
        // 100er Korpus: zwei Drehtüren, Höhe über Raster bzw. bis Korpusoberkante.
        id: 'ac1',
        elements: [
          {
            id: 'ae1',
            typeId: 'drehtuer',
            label: 'D1',
            widthCm: '49',
            heightCm: '230,1',
            hoeheModus: 'raster',
            hoeheRaster: '18',
            tuerAnschlag: 'links',
            styleLineId: 'glatt',
            griff: true,
            griffId: 'nr121',
            griffFarbe: 'Oberfläche schwarz matt, Position mittig',
            fieldValues: { material: { material: mattlackFjord, note: 'Sonderwunsch: Kanten umlaufend' } },
          },
          {
            id: 'ae2',
            typeId: 'drehtuer',
            label: 'D2',
            widthCm: '49',
            heightCm: '230,1',
            hoeheModus: 'raster',
            hoeheRaster: '18',
            tuerAnschlag: 'rechts',
            styleLineId: 'glatt',
            griff: true,
            griffId: 'nr121',
            griffFarbe: 'Oberfläche schwarz matt, Position mittig',
            fieldValues: { material: { material: mattlackFjord } },
          },
        ],
        equipment: [
          {
            id: 'aq1',
            optionId: 'einlegeboden',
            qty: 3,
            hoehen: [
              { modus: 'raster', raster: 5 },
              { modus: 'raster', raster: 9 },
              { modus: 'raster', raster: 13 },
            ],
          },
          {
            id: 'aq2',
            optionId: 'einlegeboden-kleiderstange',
            qty: 1,
            hoehen: [{ modus: 'raster', raster: 16 }],
            choices: { stangenAusfuehrung: 'schwarz' },
          },
          {
            id: 'aq3',
            optionId: 'innenschublade',
            qty: 2,
            variant: '1,5R',
            hoehen: [{ modus: 'boden' }],
          },
          {
            id: 'aq4',
            optionId: 'schubladenunterteilung-craft',
            qty: 1,
            bezugId: 'aq3',
          },
        ],
      },
      {
        // 60er Korpus: Stil-Linie „Line" mit getrennter Frontscheibe/Aufkantung.
        id: 'ac2',
        elements: [
          {
            id: 'ae3',
            typeId: 'drehtuer',
            label: 'D3',
            widthCm: '59',
            heightCm: '230,1',
            hoeheModus: 'raster',
            hoeheRaster: '18',
            tuerAnschlag: 'rechts',
            styleLineId: 'line',
            lineAufkantungGleich: false,
            fieldValues: {
              material: { material: furnierRaeuchereiche },
              aufkantung: { material: { ...glasStone } },
              alulisene: { text: 'RAL 7021 schwarzgrau' },
              freitext: { text: 'Sonderwunsch: Lisene bündig zur Aufkantung' },
            },
          },
        ],
        equipment: [
          {
            id: 'aq5',
            optionId: 'glasboden',
            qty: 2,
            hoehen: [{ modus: 'raster', raster: 7 }],
            choices: { glasart: 'rauchglas-grau' },
          },
          { id: 'aq6', optionId: 'kleiderlift', qty: 1 },
          { id: 'aq7', optionId: 'led-band-aluprofil', seiten: { links: true, rechts: true } },
        ],
      },
      {
        // 50er Korpus: Schübe in „107" und ein offenes Fach.
        id: 'ac3',
        elements: [
          {
            id: 'ae4',
            typeId: 'schuebe',
            label: 'S1',
            widthCm: '49',
            heightCm: '25,3',
            styleLineId: '107',
            fieldValues: {
              griffleisteRal: { text: 'RAL 9005' },
              material: { material: decoboardKaschmir, note: 'Sonderwunsch: Griffleiste bündig' },
            },
          },
          {
            id: 'ae5',
            typeId: 'schuebe',
            label: 'S2',
            widthCm: '49',
            heightCm: '25,3',
            styleLineId: '107',
            fieldValues: {
              griffleisteRal: { text: 'RAL 9005' },
              material: { material: decoboardKaschmir },
            },
          },
          { id: 'ae6', typeId: 'offen', label: 'O1', widthCm: '49', heightCm: '178,9' },
        ],
        equipment: [
          {
            id: 'aq8',
            optionId: 'einlegeboden',
            qty: 2,
            hoehen: [
              { modus: 'raster', raster: 6 },
              { modus: 'raster', raster: 11 },
            ],
          },
        ],
      },
    ],
    sonderausstattung:
      'Testentwurf A: zeigt Raster-Höhen (Front und Ausstattung), Türanschlag, Line mit getrennter Aufkantung, 107 mit Griffleiste sowie Kleiderstange in Schwarz.',
  },
  pricingOptions: { montage: true, lieferungRegional: false },
}

// ---------------------------------------------------------------------------
// 3) Beispiel B — zweiläufige Schiebetür, Glossy/Less, Container
// ---------------------------------------------------------------------------

/**
 * Zeigt die zweiläufige Schiebetür nach Überarbeitung 3 (kein Höhenfeld, Griffprofil
 * ausschließlich „Edge", eigene Preisspalte für Glossy/Less) und die Container-Logik
 * aus 2_2 (keine Höhenabfrage, Deckplatte in Rauchglas).
 */
export const beispielSchiebetuerEntwurf: Draft = {
  id: 'CRAMER-2026-TEST-0002',
  createdAt: '2026-09-09T08:20:00.000Z',
  consultant: { id: 'M-001', name: 'Anna Berger' },
  orderNumber: '2026-TEST-02',
  customerName: 'Testentwurf B · Zweiläufige Schiebetür Glossy & Container',
  branchId: 'F-002',
  productGroupId: 'kleiderschraenke',
  seriesId: 'refugium',
  korpus: { innen: { ...decoboardKaschmir }, aussen: { ...glasStone } },
  korpusGrunddaten: {
    heightMode: '21R',
    depthMode: '60',
    korpusse: [
      { id: 'bk1', breiteMode: '100', lochreihe: true },
      { id: 'bk2', breiteMode: '100', lochreihe: true },
    ],
    abschlussSet: { position: 'beide', material: { ...mattlackFjord } },
  },
  dimensions: { heightCm: '274', widthCm: '200', depthCm: '60', segments: 2 },
  ausstattung: {
    selected: ['einlegeboden', 'einlegeboden-kleiderstange', 'container', 'rollkorb', 'krawattenspange'],
  },
  fronts: {
    columns: [
      {
        id: 'bc1',
        elements: [
          {
            // Zweiläufig: kein Höhenfeld, Griffprofil nur „Edge".
            id: 'be1',
            typeId: 'schiebetuer-zwei',
            label: 'ST1',
            widthCm: '100',
            styleLineId: 'glossy-less',
            griffProfil: 'edge',
            griffProfilFarbe: 'RAL 9005 tiefschwarz',
            fieldValues: { material: { material: glasStone, note: 'Sonderwunsch: Rahmen in Sonderfarbe' } },
          },
        ],
        equipment: [
          {
            id: 'bq1',
            optionId: 'container',
            qty: 1,
            variant: '4,5R',
            rauchglas: true,
            note: 'Sonderausstattung: Griffmulde schwarz',
          },
          {
            id: 'bq2',
            optionId: 'einlegeboden-kleiderstange',
            qty: 1,
            hoehen: [{ modus: 'raster', raster: 18 }],
            choices: { stangenAusfuehrung: 'chrom' },
          },
        ],
      },
      {
        id: 'bc2',
        elements: [],
        equipment: [
          {
            id: 'bq3',
            optionId: 'rollkorb',
            qty: 2,
            hoehen: [{ modus: 'boden' }],
            note: '100er Korpus — Rollkorb lieferbar',
          },
          {
            id: 'bq4',
            optionId: 'einlegeboden',
            qty: 4,
            hoehen: [
              { modus: 'raster', raster: 6 },
              { modus: 'raster', raster: 10 },
              { modus: 'raster', raster: 14 },
              { modus: 'cm', cm: '205' },
            ],
          },
        ],
      },
    ],
    schiebetuerAnzahl: 2,
    sonderausstattung:
      'Testentwurf B: zeigt die zweiläufige Schiebetür (Höhe immer über die volle Korpushöhe, Griffprofil nur Edge), Glossy/Less mit eigener Preisspalte, Container mit Rauchglas-Deckplatte und eine Sonderhöhe in cm.',
  },
  pricingOptions: { montage: true, lieferungRegional: true },
}

/** Alle Entwürfe, die `npm run seed:entwuerfe` in die Datenbank schreibt. */
export const testEntwuerfe: Draft[] = [
  preisprobeEntwurf,
  beispielDrehtuerEntwurf,
  beispielSchiebetuerEntwurf,
  ...praxistestEntwuerfe,
]
