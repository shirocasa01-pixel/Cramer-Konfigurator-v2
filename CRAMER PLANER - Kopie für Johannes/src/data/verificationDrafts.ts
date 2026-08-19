import type { Draft } from '../types'
import { demoEntwurf } from './demoEntwurf'

/**
 * DEMO-/VERIFIZIERUNGS-ENTWÜRFE (Phase 9).
 *
 * Zwei reale Showroom-Referenzen (Refugium), fest im Code hinterlegt und im
 * Dashboard immer sichtbar (nicht löschbar). Sie prüfen die Gesamtpreis-Engine
 * (Korpus + Aussenset + Fronten + Innen + Upgrades) gegen bekannte Zielpreise.
 *
 * ⚠️ PROVISORISCHE STÜCKLISTEN: Die `positions` sind eine Best-Effort-Rekonstruktion
 * aus der Excel (Preiszeilen-IDs). Sie liegen nahe an den Zielpreisen
 * (Large 9.009 € / Medium 6.297 €), aber die EXAKTE Stückliste (Türanzahl/-typ,
 * Container-Modell, Aussenset-Anzahl, PTO-Basis) bestätigt der Fachbereich –
 * dann werden die IDs/Mengen hier final auf den Cent kalibriert.
 */

const anna = { id: 'M-001', name: 'Anna Berger' }
const branch = 'F-001'

const referenzEntwuerfe: Draft[] = [
  {
    id: 'CRAMER-2026-REF-9001',
    createdAt: '2026-07-07T09:00:00.000Z',
    consultant: anna,
    orderNumber: 'REF-LARGE',
    customerName: 'Referenz „Refugium Large" (Ziel 9.009 €)',
    branchId: branch,
    productGroupId: 'kleiderschraenke',
    seriesId: 'refugium',
    dimensions: { widthCm: '300', heightCm: '236', depthCm: '60', segments: 3 },
    vkPreis: '9.009,00',
    korpus: {
      innen: { materialGroupId: 'decoboard', optionId: 'eiche-milano', priceGroup: 'PG1' },
      aussen: { materialGroupId: 'mattlack', optionId: 'beigegrau', priceGroup: 'PG2' },
      abdeckplatte: { materialGroupId: 'keine' },
    },
    fronts: { columns: [] },
    pricingOptions: { montage: false, lieferungRegional: false },
    isVerification: true,
    positions: [
      { id: 'p1', bucket: 'korpus', label: 'Korpus 18R 100er (3 Segmente)', priceRowId: 1051, qty: 3 },
      { id: 'p2', bucket: 'korpus', label: 'Mittelseite 18R (2×)', priceRowId: 1099, qty: 2 },
      { id: 'p3', bucket: 'aussenset', label: 'Aussenset PG4 18R', priceRowId: 1061, qty: 1 },
      { id: 'p4', bucket: 'fronten', label: 'Zweiläufige Schiebetür Glossy/Glas Crea Stone 120er (2 Türen)', priceRowId: 1134, qty: 2 },
      { id: 'p4b', bucket: 'upgrade', label: 'PTO Schiebetürflügel (Push-to-Open, 2× – Fachbereich bestätigt)', priceRowId: 0, qty: 2, priceOverride: 978 },
      { id: 'p5', bucket: 'innen', label: 'Einlegeboden 100er (4×)', priceRowId: 1065, qty: 4 },
      { id: 'p6', bucket: 'innen', label: 'Kleiderstange 100er (2×)', priceRowId: 1068, qty: 2 },
      { id: 'p7', bucket: 'innen', label: 'LED-Band bis 18R', priceRowId: 1219, qty: 1 },
    ],
  },
  {
    id: 'CRAMER-2026-REF-9002',
    createdAt: '2026-07-07T09:30:00.000Z',
    consultant: anna,
    orderNumber: 'REF-MEDIUM',
    customerName: 'Referenz „Refugium Medium" (Ziel 6.297 €)',
    branchId: branch,
    productGroupId: 'kleiderschraenke',
    seriesId: 'refugium',
    dimensions: { widthCm: '190', heightCm: '235', depthCm: '60', segments: 3 },
    vkPreis: '6.297,00',
    korpus: {
      innen: { materialGroupId: 'decoboard', optionId: 'okapi-walnut', priceGroup: 'PG1' },
      aussen: { materialGroupId: 'decoboard', optionId: 'okapi-walnut', priceGroup: 'PG1' },
      abdeckplatte: { materialGroupId: 'keine' },
    },
    fronts: { columns: [] },
    pricingOptions: { montage: false, lieferungRegional: false },
    isVerification: true,
    positions: [
      { id: 'q1', bucket: 'korpus', label: 'Korpus 18R 60er (3 Segmente)', priceRowId: 1050, qty: 3 },
      { id: 'q2', bucket: 'korpus', label: 'Mittelseite 18R (2×)', priceRowId: 1099, qty: 2 },
      { id: 'q3', bucket: 'aussenset', label: 'Aussenset PG1 18R', priceRowId: 1055, qty: 1 },
      { id: 'q4', bucket: 'fronten', label: 'Drehtür Glatt 1 (Großes Regal 18R, 3×)', priceRowId: 127, qty: 3 },
      { id: 'q5', bucket: 'innen', label: 'Einlegeboden 60er (5×)', priceRowId: 1064, qty: 5 },
      { id: 'q6', bucket: 'innen', label: 'Kleiderstange 60er', priceRowId: 1067, qty: 1 },
      { id: 'q7', bucket: 'innen', label: 'Container Conero D Decoboard 60er (2×)', priceRowId: 1182, qty: 2 },
      { id: 'q8', bucket: 'innen', label: 'Aufpreis Rauchglas-Abdeckung Container (2×, Fachbereich bestätigt)', priceRowId: 1103, qty: 1, priceOverride: 159 },
    ],
  },
]

/**
 * Alle fest hinterlegten Entwürfe. `demoEntwurf` ist das Möbel aus der Live-Demo — der
 * einzige Entwurf mit vollständigen Fronten und Ausstattung und damit die End-to-End-Probe
 * der Kalkulations-Engine (`npm run kalk:test`).
 */
export const verificationDrafts: Draft[] = [...referenzEntwuerfe, demoEntwurf]

/** Zielpreise der Referenzobjekte (zur Anzeige „Ist vs. Ziel"). */
export const verificationTargets: Record<string, number> = {
  'CRAMER-2026-REF-9001': 9009,
  'CRAMER-2026-REF-9002': 6297,
}
