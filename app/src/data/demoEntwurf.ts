import type { Draft } from '../types'

/**
 * Möbel aus der Live-Demo der Präsentation, vollständig als Entwurf modelliert:
 * Refugium 250 × 200 × 60, 4 Segmente – 2 Drehtüren, 1 Segment mit 2 Schüben und
 * offenem Fach, 1 Drehtür auf 70 cm.
 *
 * Dient als End-to-End-Probe der Kalkulations-Engine: `npm run kalk:test` rechnet ihn
 * durch und vergleicht Position für Position mit der Ausgabe des Vorgänger-Tools.
 * Deshalb bitte nicht „nebenbei" ändern — jede Änderung verschiebt die Sollwerte.
 *
 * Das Möbel ist bewusst unbequem: die Höhe 200 cm ist kein Rastermaß, und die Drehtür
 * auf 70 cm liegt über dem größten bepreisten Standardmaß. Beides muss die Engine
 * erkennen und ausweisen, statt es glattzurechnen.
 */
const mattlackSchwarzgrau = {
  materialGroupId: 'mattlack',
  optionId: 'schwarzgrau-ral-7021',
  priceGroup: 'PG2' as const,
}

export const demoEntwurf: Draft = {
  id: 'DEMO-LIVE',
  createdAt: '2026-07-13T09:00:00.000Z',
  consultant: { id: 'M-001', name: 'Anna Berger' },
  orderNumber: '2026-AB067',
  customerName: 'Live-Demo (Refugium 250×200×60)',
  branchId: 'F-002',
  productGroupId: 'kleiderschraenke',
  seriesId: 'refugium',
  korpus: {
    innen: { materialGroupId: 'decoboard', optionId: 'interior-white-w10100sd', priceGroup: 'PG1' },
    aussen: { materialGroupId: 'mattlack', optionId: 'graubeige-ral-1019', priceGroup: 'PG2' },
  },
  korpusGrunddaten: {
    heightMode: 'custom',
    heightCm: '200',
    depthMode: '60',
    korpusse: [
      { id: 'k1', breiteMode: '60', lochreihe: true },
      { id: 'k2', breiteMode: '60', lochreihe: true },
      { id: 'k3', breiteMode: '60', lochreihe: true },
      { id: 'k4', breiteMode: 'custom', breiteCm: '70', lochreihe: true },
    ],
    abschlussSet: {
      position: 'beide',
      material: { materialGroupId: 'mattlack', optionId: 'graubeige-ral-1019', priceGroup: 'PG2' },
    },
  },
  dimensions: { heightCm: '200', widthCm: '250', depthCm: '60', segments: 4 },
  fronts: {
    columns: [
      {
        id: 'c1',
        elements: [
          {
            id: 'e1', typeId: 'drehtuer', label: 'D1', widthCm: '60', heightCm: '195',
            hoeheModus: 'cm', tuerAnschlag: 'links',
            styleLineId: 'glatt', pto: true,
            fieldValues: { material: { material: mattlackSchwarzgrau } },
          },
        ],
        equipment: [
          { id: 'q1', optionId: 'einlegeboden', qty: 4 },
          { id: 'q2', optionId: 'einlegeboden-kleiderstange', qty: 1 },
        ],
      },
      {
        id: 'c2',
        elements: [
          {
            id: 'e2', typeId: 'drehtuer', label: 'D2', widthCm: '60', heightCm: '195',
            hoeheModus: 'cm', tuerAnschlag: 'rechts',
            styleLineId: 'glatt', pto: true,
            fieldValues: { material: { material: mattlackSchwarzgrau } },
          },
        ],
        // Die Menge des LED-Bands folgt seit Überarbeitung 6 (S. 8) der Seitenwahl:
        // „Links & rechts" heißt zwei Bänder und damit den doppelten Preis.
        equipment: [{ id: 'q3', optionId: 'led-band-aluprofil', seiten: { links: true, rechts: true } }],
      },
      {
        id: 'c3',
        elements: [
          {
            id: 'e3', typeId: 'schuebe', label: 'S1', widthCm: '60', heightCm: '20',
            styleLineId: 'curve', fieldValues: { material: { material: mattlackSchwarzgrau } },
          },
          {
            id: 'e4', typeId: 'schuebe', label: 'S2', widthCm: '60', heightCm: '20',
            styleLineId: 'curve', fieldValues: { material: { material: mattlackSchwarzgrau } },
          },
          { id: 'e5', typeId: 'offen', label: 'R1', widthCm: '60', heightCm: '155' },
        ],
        equipment: [{ id: 'q4', optionId: 'innenschublade', qty: 2, variant: '1,5R', heightNote: '18' }],
      },
      {
        id: 'c4',
        elements: [
          {
            id: 'e6', typeId: 'drehtuer', label: 'D3', widthCm: '70', heightCm: '195',
            hoeheModus: 'cm', tuerAnschlag: 'rechts',
            // Nr. 127 ist seit Überarbeitung 3 auf Glossy/Less beschränkt (klebt nur auf Glas).
            styleLineId: 'glatt', griff: true, griffId: 'nr121',
            fieldValues: { material: { material: mattlackSchwarzgrau } },
          },
        ],
        equipment: [{ id: 'q5', optionId: 'innenspiegel-drehtuer', qty: 1 }],
      },
    ],
    abschlussUnten: { type: 'SO' },
    sonderausstattung: 'LED an den inneren Seiten aller Drehtüren',
  },
  pricingOptions: { montage: true, lieferungRegional: false },
  isVerification: true,
}
