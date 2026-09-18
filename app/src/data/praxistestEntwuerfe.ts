import type { Draft, KorpusEinheit, MaterialSelection, SegmentEquipmentItem } from '../types'

/**
 * PRAXISTEST — 20 vollständig ausgearbeitete Refugium-Entwürfe.
 *
 * Zweck: Der Konfigurator soll nicht an einem einzelnen Beispielschrank gemessen werden,
 * sondern an der Breite dessen, was im Verkauf tatsächlich vorkommt. Die 20 Entwürfe
 * decken zusammen jede Preisachse ab, die das Preisblatt kennt:
 *
 *   Maße        150–400 cm Breite · 18 R gegen 21 R · Tiefe 60 gegen 41 und 31 cm
 *   Fronten     Glatt in PG 1–4, Line (getrennte Aufkantung), Curve in PG 1 und PG 2–4,
 *               107 in PG 1 und PG 2–4, Glossy/Less, Schübe, offene Regalfelder,
 *               asymmetrische Türteilung am 100er Korpus (59 + 39 cm)
 *   Ausstattung Container (Raster/Craft/Conero), Schubladenunterteilung, Hemdeinsatz,
 *               Rollböden, Rollboden mit Schuhablage, Innenspiegel, Kleiderlift,
 *               Revisionsklappen, Rückwandausschnitte, Fußleistenausschnitt,
 *               beidseitige LED-Bänder, Verblendung nach Laufmetern
 *
 * Sie tragen ausschließlich Konfiguration und KEINEN Preis: Was sie kosten, rechnet die
 * Engine aus den Stammdaten. `npm run praxis:test` prüft danach jede einzelne Position
 * gegen die Preiszeilen der Mappe — ein hier eingetragener Betrag würde genau diese
 * Prüfung wertlos machen.
 */

// --- Materialbausteine (IDs aus der Farbmatrix, Preisgruppe je Kategorie) ---------
const DECOBOARD_SCHWARZ: MaterialSelection = {
  materialGroupId: 'decoboard',
  optionId: 'schwarz-u190vl',
  priceGroup: 'PG1',
}
const DECOBOARD_KASCHMIR: MaterialSelection = {
  materialGroupId: 'decoboard',
  optionId: 'kaschmirgrau-u12168sd',
  priceGroup: 'PG1',
}
const MATTLACK_WEISS: MaterialSelection = {
  materialGroupId: 'mattlack',
  optionId: 'verkehrsweiss-ral-9016',
  priceGroup: 'PG2',
}
const MATTLACK_FJORD: MaterialSelection = {
  materialGroupId: 'mattlack',
  optionId: 'fjord-sikkens-uo-10-20',
  priceGroup: 'PG2',
}
const FURNIER_EICHE: MaterialSelection = {
  materialGroupId: 'furnier',
  optionId: 'eiche-lackiert',
  priceGroup: 'PG3',
}
const FURNIER_NUSSBAUM: MaterialSelection = {
  materialGroupId: 'furnier',
  optionId: 'amerikanischer-nussbaum-geoelt',
  priceGroup: 'PG3',
}
const XTREME_VULKANSCHWARZ: MaterialSelection = {
  materialGroupId: 'xtreme-plus',
  optionId: 'vulkanschwarz-u12000xp',
  priceGroup: 'PG4',
}
const GLAS_STONE: MaterialSelection = {
  materialGroupId: 'glas',
  optionId: 'stone',
  priceGroup: 'PG3',
}

// --- Maßkonstanten ---------------------------------------------------------------

/** Korpushöhe der beiden Rasterstufen (Preisachse HÖHE von Korpus/Mittelseite/Außenset). */
const KORPUS_HOEHE_CM = { '18R': '235', '21R': '274' } as const
/** Fronthöhe = Raster × 12,8 cm − 3 mm Fuge (`lib/raster.ts`). */
const FRONT_HOEHE_CM = { '18R': '230,1', '21R': '268,5' } as const
const KORPUS_BREITE_CM = { '50': 50, '60': 60, '100': 100 } as const

type Rasterstufe = keyof typeof KORPUS_HOEHE_CM
type Breitenstufe = keyof typeof KORPUS_BREITE_CM
type Anschlag = 'links' | 'rechts'

// --- Bausteine -------------------------------------------------------------------

/**
 * Eine Drehtür. Der Griff wird nur bei „Glatt" gesetzt — nur diese Stil-Linie führt im
 * Front-Katalog `handleOptions`, die übrigen tragen ihr Griffbild in der Linie selbst.
 */
function drehtuer(
  id: string,
  label: string,
  breiteCm: string,
  styleLineId: string,
  material: MaterialSelection,
  raster: Rasterstufe,
  anschlag: Anschlag,
  zusatz: Record<string, unknown> = {},
) {
  return {
    id,
    typeId: 'drehtuer',
    label,
    widthCm: breiteCm,
    heightCm: FRONT_HOEHE_CM[raster],
    hoeheModus: 'raster' as const,
    hoeheRaster: raster === '18R' ? '18' : '21',
    tuerAnschlag: anschlag,
    styleLineId,
    ...(styleLineId === 'glatt' ? { griff: true, griffId: 'nr121' } : {}),
    fieldValues: { material: { material } },
    ...zusatz,
  }
}

/** Zwei symmetrische Türen an einem Korpus (Breite je Tür = Korpusbreite − 1 cm). */
function tuerPaar(
  praefix: string,
  breiteCm: string,
  styleLineId: string,
  material: MaterialSelection,
  raster: Rasterstufe,
) {
  return [
    drehtuer(`${praefix}a`, `${praefix.toUpperCase()}-L`, breiteCm, styleLineId, material, raster, 'links'),
    drehtuer(`${praefix}b`, `${praefix.toUpperCase()}-R`, breiteCm, styleLineId, material, raster, 'rechts'),
  ]
}

/** Einlegeböden auf festen Rasterhöhen — der Regelfall in jedem Segment. */
function boeden(id: string, rasterStufen: number[]): SegmentEquipmentItem {
  return {
    id,
    optionId: 'einlegeboden',
    qty: rasterStufen.length,
    hoehen: rasterStufen.map((raster) => ({ modus: 'raster' as const, raster })),
  }
}

/** Einlegeboden inklusive Kleiderstange. */
function stange(id: string, raster: number, ausfuehrung: 'chrom' | 'schwarz' = 'chrom'): SegmentEquipmentItem {
  return {
    id,
    optionId: 'einlegeboden-kleiderstange',
    qty: 1,
    hoehen: [{ modus: 'raster', raster }],
    choices: { stangenAusfuehrung: ausfuehrung },
  }
}

interface EntwurfConfig {
  nr: number
  titel: string
  auftragsnummer?: string
  raster: Rasterstufe
  /** Tiefe: Standard 60 cm oder eine Sondertiefe (31–60 cm). */
  tiefeCm?: '31' | '41'
  breiten: Breitenstufe[]
  innen: MaterialSelection
  aussen: MaterialSelection
  abschlussMaterial?: MaterialSelection
  segmente: Array<{ elements: unknown[]; equipment?: SegmentEquipmentItem[] }>
  verblendung?: Draft['korpusGrunddaten'] extends undefined ? never : { art: 'korpusbuendig' | 'frontbuendig'; lfm: string; positionNote?: string }
  fussleiste?: { enabled: boolean; hoeheCm?: string; tiefeCm?: string }
  sondermasse?: string
  sonderausstattung?: string
  montage?: boolean
  lieferungRegional?: boolean
  filiale?: string
}

/**
 * Baut einen Entwurf und leitet dabei zwei Dinge ab, die sonst auseinanderlaufen:
 * die Gesamtmaße aus den Korpusbreiten und die Ausstattungs-Vorauswahl aus dem, was in
 * den Segmenten tatsächlich steht. Beides von Hand zu pflegen, wäre bei 20 Entwürfen
 * eine Fehlerquelle ohne Erkenntniswert.
 */
function baueEntwurf(cfg: EntwurfConfig): Draft {
  const korpusse: KorpusEinheit[] = cfg.breiten.map((breiteMode, i) => ({
    id: `p${cfg.nr}k${i + 1}`,
    breiteMode,
    lochreihe: true,
  }))
  const breiteCm = cfg.breiten.reduce((summe, b) => summe + KORPUS_BREITE_CM[b], 0)
  const selected = [
    ...new Set(cfg.segmente.flatMap((s) => (s.equipment ?? []).map((e) => e.optionId))),
  ]
  const nummer = String(cfg.nr).padStart(2, '0')

  return {
    id: `CRAMER-2026-PRAXIS-${nummer}`,
    // Über Date.UTC statt über zusammengesetzte Zeichenketten: Bei 20 Entwürfen liefe
    // eine Stundenzahl aus dem Index heraus (6 + 20 = „T26:00") und ergäbe einen
    // ungültigen Zeitstempel, an dem die Dashboard-Liste beim Formatieren scheitert.
    createdAt: new Date(Date.UTC(2026, 8, 18, 6, cfg.nr * 3)).toISOString(),
    consultant: { id: 'M-004', name: 'Sarib Test-Berater' },
    orderNumber: cfg.auftragsnummer ?? `2026-PRAXIS-${nummer}`,
    customerName: `Praxistest ${nummer} · ${cfg.titel}`,
    branchId: cfg.filiale ?? 'F-001',
    productGroupId: 'kleiderschraenke',
    seriesId: 'refugium',
    korpus: { innen: { ...cfg.innen }, aussen: { ...cfg.aussen } },
    korpusGrunddaten: {
      heightMode: cfg.raster,
      depthMode: cfg.tiefeCm ? 'custom' : '60',
      ...(cfg.tiefeCm ? { depthCm: cfg.tiefeCm } : {}),
      korpusse,
      abschlussSet: {
        position: 'beide',
        material: { ...(cfg.abschlussMaterial ?? cfg.aussen) },
      },
      ...(cfg.verblendung ? { verblendung: cfg.verblendung } : {}),
      ...(cfg.fussleiste ? { fussleiste: cfg.fussleiste } : {}),
      ...(cfg.sondermasse ? { sondermasse: cfg.sondermasse } : {}),
    },
    dimensions: {
      heightCm: KORPUS_HOEHE_CM[cfg.raster],
      widthCm: String(breiteCm),
      depthCm: cfg.tiefeCm ?? '60',
      segments: cfg.breiten.length,
    },
    ausstattung: { selected },
    fronts: {
      columns: cfg.segmente.map((s, i) => ({
        id: `p${cfg.nr}c${i + 1}`,
        elements: s.elements,
        equipment: s.equipment ?? [],
      })),
      ...(cfg.sonderausstattung ? { sonderausstattung: cfg.sonderausstattung } : {}),
    },
    pricingOptions: {
      montage: cfg.montage ?? false,
      lieferungRegional: cfg.lieferungRegional ?? false,
    },
  } as Draft
}

// ---------------------------------------------------------------------------
// 01–04 · Grundraster: Breite, Sonderhöhe, alle vier Preisgruppen in „Glatt"
// ---------------------------------------------------------------------------

const p01 = baueEntwurf({
  nr: 1,
  titel: 'Basis 300 cm · Glatt PG 1 · 18 Raster',
  raster: '18R',
  breiten: ['100', '100', '100'],
  innen: DECOBOARD_SCHWARZ,
  aussen: DECOBOARD_SCHWARZ,
  segmente: [1, 2, 3].map((n) => ({
    elements: tuerPaar(`p1t${n}`, '49', 'glatt', DECOBOARD_SCHWARZ, '18R'),
    equipment: [boeden(`p1q${n}a`, [5, 9, 13]), stange(`p1q${n}b`, 16)],
  })),
  sonderausstattung: 'Referenzschrank: drei 100er Korpi, Glatt PG 1, Standardausstattung.',
})

const p02 = baueEntwurf({
  nr: 2,
  titel: 'Sonderhöhe 21 Raster · Glatt PG 2',
  raster: '21R',
  breiten: ['100', '100', '100'],
  innen: MATTLACK_WEISS,
  aussen: MATTLACK_WEISS,
  segmente: [1, 2, 3].map((n) => ({
    elements: tuerPaar(`p2t${n}`, '49', 'glatt', MATTLACK_WEISS, '21R'),
    equipment: [boeden(`p2q${n}a`, [6, 11, 16]), stange(`p2q${n}b`, 19, 'schwarz')],
  })),
  montage: true,
  sonderausstattung: 'Prüft die Sonderhöhe 21 Raster (+20 % gegenüber 18 Raster) über alle Positionen.',
})

const p03 = baueEntwurf({
  nr: 3,
  titel: 'Vier-Meter-Schrank · asymmetrische Türteilung · Glatt PG 3',
  raster: '18R',
  breiten: ['100', '100', '100', '100'],
  innen: FURNIER_EICHE,
  aussen: FURNIER_EICHE,
  segmente: [
    {
      elements: tuerPaar('p3t1', '49', 'glatt', FURNIER_EICHE, '18R'),
      equipment: [boeden('p3q1a', [5, 9, 13]), stange('p3q1b', 16)],
    },
    {
      // Asymmetrisch: 59 cm + 39 cm an einem 100er Korpus.
      elements: [
        drehtuer('p3t2a', 'D2-L', '59', 'glatt', FURNIER_EICHE, '18R', 'links'),
        drehtuer('p3t2b', 'D2-R', '39', 'glatt', FURNIER_EICHE, '18R', 'rechts'),
      ],
      equipment: [boeden('p3q2a', [4, 8, 12, 16])],
    },
    {
      elements: tuerPaar('p3t3', '49', 'glatt', FURNIER_EICHE, '18R'),
      equipment: [stange('p3q3a', 16)],
    },
    {
      // Offenes Regalfeld ohne Front — erzeugt bewusst keine Frontposition.
      elements: [{ id: 'p3t4a', typeId: 'offen', label: 'O1', widthCm: '99', heightCm: '230,1' }],
      equipment: [boeden('p3q4a', [4, 7, 10, 13, 16])],
    },
  ],
  montage: true,
  sondermasse: 'Nische 402 cm — Außenmaß darf 401 cm nicht überschreiten.',
  sonderausstattung: 'Asymmetrische Türteilung 59/39 cm am zweiten Korpus, viertes Segment offen.',
})

const p04 = baueEntwurf({
  nr: 4,
  titel: 'Xtreme Plus PG 4 · Glatt 4',
  raster: '18R',
  breiten: ['100', '100', '60'],
  innen: XTREME_VULKANSCHWARZ,
  aussen: XTREME_VULKANSCHWARZ,
  segmente: [
    {
      elements: tuerPaar('p4t1', '49', 'glatt', XTREME_VULKANSCHWARZ, '18R'),
      equipment: [boeden('p4q1a', [5, 9, 13]), stange('p4q1b', 16)],
    },
    {
      elements: tuerPaar('p4t2', '49', 'glatt', XTREME_VULKANSCHWARZ, '18R'),
      equipment: [boeden('p4q2a', [6, 12]), stange('p4q2b', 16)],
    },
    {
      elements: [drehtuer('p4t3a', 'D3', '59', 'glatt', XTREME_VULKANSCHWARZ, '18R', 'rechts')],
      equipment: [stange('p4q3a', 16)],
    },
  ],
  sonderausstattung: 'Höchste Preisgruppe: Xtreme Plus (PG 4) ⇒ Achsenwert „Glatt4".',
})

// ---------------------------------------------------------------------------
// 05–11 · Alle übrigen Stil-Linien mit ihren Preisspalten
// ---------------------------------------------------------------------------

const p05 = baueEntwurf({
  nr: 5,
  titel: 'Line mit getrennter Aufkantung',
  raster: '18R',
  breiten: ['100', '60', '50'],
  innen: FURNIER_NUSSBAUM,
  aussen: MATTLACK_FJORD,
  segmente: [
    {
      elements: tuerPaar('p5t1', '49', 'line', FURNIER_NUSSBAUM, '18R').map((t) => ({
        ...t,
        lineAufkantungGleich: false,
        fieldValues: {
          material: { material: FURNIER_NUSSBAUM },
          aufkantung: { material: { ...GLAS_STONE } },
          alulisene: { text: 'RAL 7021 schwarzgrau' },
        },
      })),
      equipment: [boeden('p5q1a', [5, 9, 13]), stange('p5q1b', 16)],
    },
    {
      elements: [
        drehtuer('p5t2a', 'D2', '59', 'line', FURNIER_NUSSBAUM, '18R', 'rechts', {
          lineAufkantungGleich: true,
        }),
      ],
      equipment: [stange('p5q2a', 16)],
    },
    {
      elements: [drehtuer('p5t3a', 'D3', '49', 'line', FURNIER_NUSSBAUM, '18R', 'links')],
      equipment: [boeden('p5q3a', [6, 11, 15])],
    },
  ],
  sonderausstattung: 'Line ist preisgruppen-unabhängig (Achsenwert „Line"); Aufkantung einmal getrennt, einmal gleich.',
})

const p06 = baueEntwurf({
  nr: 6,
  titel: 'Curve PG 1 · kompakt 150 cm',
  raster: '21R',
  breiten: ['100', '50'],
  innen: DECOBOARD_KASCHMIR,
  aussen: DECOBOARD_KASCHMIR,
  segmente: [
    {
      elements: tuerPaar('p6t1', '49', 'curve', DECOBOARD_KASCHMIR, '21R'),
      equipment: [boeden('p6q1a', [6, 11, 16]), stange('p6q1b', 19)],
    },
    {
      elements: [drehtuer('p6t2a', 'D2', '49', 'curve', DECOBOARD_KASCHMIR, '21R', 'rechts')],
      equipment: [boeden('p6q2a', [7, 13, 18])],
    },
  ],
  sonderausstattung: 'Curve in PG 1 ⇒ eigener Achsenwert „CurvePG1".',
})

const p07 = baueEntwurf({
  nr: 7,
  titel: 'Curve PG 3 · 300 cm',
  raster: '18R',
  breiten: ['100', '100', '100'],
  innen: FURNIER_EICHE,
  aussen: FURNIER_EICHE,
  segmente: [1, 2, 3].map((n) => ({
    elements: tuerPaar(`p7t${n}`, '49', 'curve', FURNIER_EICHE, '18R'),
    equipment: [boeden(`p7q${n}a`, [5, 10, 15]), stange(`p7q${n}b`, 17)],
  })),
  montage: true,
  sonderausstattung: 'Curve ab PG 2 ⇒ Achsenwert „CurvePG2-4"; muss sich von Praxistest 06 unterscheiden.',
})

const p08 = baueEntwurf({
  nr: 8,
  titel: 'Glossy · 200 cm',
  raster: '18R',
  breiten: ['100', '100'],
  innen: MATTLACK_WEISS,
  aussen: MATTLACK_WEISS,
  segmente: [1, 2].map((n) => ({
    elements: tuerPaar(`p8t${n}`, '49', 'glossy', MATTLACK_WEISS, '18R'),
    equipment: [boeden(`p8q${n}a`, [5, 9, 13]), stange(`p8q${n}b`, 16)],
  })),
  sonderausstattung: 'Glossy und Less teilen sich die Preisspalte „GlossyLess".',
})

const p09 = baueEntwurf({
  nr: 9,
  titel: 'Less · 21 Raster · 260 cm',
  raster: '21R',
  breiten: ['100', '100', '60'],
  innen: FURNIER_NUSSBAUM,
  aussen: FURNIER_NUSSBAUM,
  segmente: [
    {
      elements: tuerPaar('p9t1', '49', 'less', FURNIER_NUSSBAUM, '21R'),
      equipment: [boeden('p9q1a', [6, 11, 16]), stange('p9q1b', 19)],
    },
    {
      elements: tuerPaar('p9t2', '49', 'less', FURNIER_NUSSBAUM, '21R'),
      equipment: [boeden('p9q2a', [7, 14]), stange('p9q2b', 19)],
    },
    {
      elements: [drehtuer('p9t3a', 'D3', '59', 'less', FURNIER_NUSSBAUM, '21R', 'rechts')],
      equipment: [stange('p9q3a', 19)],
    },
  ],
  sonderausstattung: 'Less in 21 Raster — prüft Preisspalte „GlossyLess" zusammen mit der Sonderhöhe.',
})

const p10 = baueEntwurf({
  nr: 10,
  titel: '107 in PG 1 · 300 cm',
  raster: '18R',
  breiten: ['100', '100', '100'],
  innen: DECOBOARD_SCHWARZ,
  aussen: DECOBOARD_SCHWARZ,
  segmente: [1, 2, 3].map((n) => ({
    elements: tuerPaar(`p10t${n}`, '49', '107', DECOBOARD_SCHWARZ, '18R'),
    equipment: [boeden(`p10q${n}a`, [5, 9, 13]), stange(`p10q${n}b`, 16)],
  })),
  sonderausstattung: 'Stil-Linie 107 in PG 1 ⇒ Achsenwert „107PG1".',
})

const p11 = baueEntwurf({
  nr: 11,
  titel: '107 in PG 4 · 21 Raster',
  raster: '21R',
  breiten: ['100', '60', '50'],
  innen: XTREME_VULKANSCHWARZ,
  aussen: XTREME_VULKANSCHWARZ,
  segmente: [
    {
      elements: tuerPaar('p11t1', '49', '107', XTREME_VULKANSCHWARZ, '21R'),
      equipment: [boeden('p11q1a', [6, 11, 16]), stange('p11q1b', 19)],
    },
    {
      elements: [drehtuer('p11t2a', 'D2', '59', '107', XTREME_VULKANSCHWARZ, '21R', 'links')],
      equipment: [stange('p11q2a', 19)],
    },
    {
      elements: [drehtuer('p11t3a', 'D3', '49', '107', XTREME_VULKANSCHWARZ, '21R', 'rechts')],
      equipment: [boeden('p11q3a', [8, 15])],
    },
  ],
  montage: true,
  lieferungRegional: true,
  sonderausstattung: '107 ab PG 2 ⇒ Achsenwert „107PG2-4", kombiniert mit der Sonderhöhe.',
})

// ---------------------------------------------------------------------------
// 12–13 · Sondertiefen (bei Sondertiefe ist nur der Einlegeboden zulässig)
// ---------------------------------------------------------------------------

const p12 = baueEntwurf({
  nr: 12,
  titel: 'Sondertiefe 41 cm · Glatt PG 2',
  raster: '18R',
  tiefeCm: '41',
  breiten: ['100', '100'],
  innen: MATTLACK_FJORD,
  aussen: MATTLACK_FJORD,
  segmente: [1, 2].map((n) => ({
    elements: tuerPaar(`p12t${n}`, '49', 'glatt', MATTLACK_FJORD, '18R'),
    equipment: [boeden(`p12q${n}a`, [4, 8, 12, 16])],
  })),
  sondermasse: 'Sondertiefe 41 cm — Dachschräge im Raum, Schrank darf nicht tiefer bauen.',
  sonderausstattung: 'Sondertiefe: laut Katalog ist nur der einfache Einlegeboden zulässig.',
})

const p13 = baueEntwurf({
  nr: 13,
  titel: 'Sondertiefe 31 cm · 21 Raster · Glatt PG 1',
  raster: '21R',
  tiefeCm: '31',
  breiten: ['100', '60'],
  innen: DECOBOARD_KASCHMIR,
  aussen: DECOBOARD_KASCHMIR,
  segmente: [
    {
      elements: tuerPaar('p13t1', '49', 'glatt', DECOBOARD_KASCHMIR, '21R'),
      equipment: [boeden('p13q1a', [5, 10, 15, 19])],
    },
    {
      elements: [drehtuer('p13t2a', 'D2', '59', 'glatt', DECOBOARD_KASCHMIR, '21R', 'rechts')],
      equipment: [boeden('p13q2a', [6, 12, 18])],
    },
  ],
  sonderausstattung: 'Flachste Tiefenstufe (31 cm) zusammen mit der Sonderhöhe 21 Raster.',
})

// ---------------------------------------------------------------------------
// 14–16 · Innenausbau: Craft, Conero, Rollböden und Spiegel
// ---------------------------------------------------------------------------

const p14 = baueEntwurf({
  nr: 14,
  titel: 'Container Craft · Schubladenunterteilung & Hemdeinsatz',
  raster: '18R',
  breiten: ['100', '100', '100'],
  innen: MATTLACK_WEISS,
  aussen: MATTLACK_WEISS,
  segmente: [
    {
      elements: tuerPaar('p14t1', '49', 'glatt', MATTLACK_WEISS, '18R'),
      equipment: [
        { id: 'p14q1a', optionId: 'container-craft', variant: 'A', rauchglas: false },
        { id: 'p14q1b', optionId: 'schubladenunterteilung-craft', qty: 2, bezugId: 'p14q1a' },
        boeden('p14q1c', [9, 13]),
        stange('p14q1d', 16),
      ],
    },
    {
      elements: tuerPaar('p14t2', '49', 'glatt', MATTLACK_WEISS, '18R'),
      equipment: [
        { id: 'p14q2a', optionId: 'container-craft', variant: 'B', rauchglas: true },
        { id: 'p14q2b', optionId: 'schubladenunterteilung-craft', qty: 1, bezugId: 'p14q2a' },
        boeden('p14q2c', [10, 14]),
        { id: 'p14q2d', optionId: 'hemdeinsatz-craft', qty: 1, bezugId: 'p14q2c' },
      ],
    },
    {
      elements: tuerPaar('p14t3', '49', 'glatt', MATTLACK_WEISS, '18R'),
      equipment: [
        { id: 'p14q3a', optionId: 'container-craft', variant: 'C', rauchglas: false },
        boeden('p14q3b', [11, 15]),
        { id: 'p14q3c', optionId: 'hemdeinsatz-craft', qty: 2, bezugId: 'p14q3b' },
        stange('p14q3d', 17),
      ],
    },
  ],
  montage: true,
  sonderausstattung: 'Craft-Modelle A, B und C; Deckplatte einmal in Rauchglas; Unterteilung und Hemdeinsatz mit Pflicht-Bezug.',
})

const p15 = baueEntwurf({
  nr: 15,
  titel: 'Container Conero · Gürtel-/Krawattenauszug & Schuhablage',
  raster: '18R',
  breiten: ['100', '100', '100'],
  // Innenkorpus bewusst in Decoboard (PG 1): Die Conero-Modelle G und H führen im
  // Preisblatt ausschließlich eine PG-1-Zeile (S. 30). Mit einem teureren Innenmaterial
  // liefe der Container ins Leere — die Front bleibt davon unberührt.
  innen: DECOBOARD_SCHWARZ,
  aussen: FURNIER_EICHE,
  segmente: [
    {
      elements: tuerPaar('p15t1', '49', 'glatt', FURNIER_EICHE, '18R'),
      equipment: [
        { id: 'p15q1a', optionId: 'container-conero', variant: 'G', rauchglas: true },
        { id: 'p15q1b', optionId: 'schubladenunterteilung-craft', qty: 1, bezugId: 'p15q1a' },
        stange('p15q1c', 16),
      ],
    },
    {
      elements: tuerPaar('p15t2', '49', 'glatt', FURNIER_EICHE, '18R'),
      equipment: [
        { id: 'p15q2a', optionId: 'container-conero', variant: 'H', rauchglas: false },
        {
          id: 'p15q2b',
          optionId: 'guertel-krawattenauszug-conero',
          qty: 2,
          hoehen: [{ modus: 'raster', raster: 12 }],
          choices: { montageseite: 'rechts' },
        },
        boeden('p15q2c', [14]),
      ],
    },
    {
      elements: tuerPaar('p15t3', '49', 'glatt', FURNIER_EICHE, '18R'),
      equipment: [
        { id: 'p15q3a', optionId: 'kleiderlift-conero' },
        {
          id: 'p15q3b',
          optionId: 'schuhablage-conero',
          qty: 3,
          choices: { breite: 'korpusbreite' },
        },
        boeden('p15q3c', [6, 10]),
      ],
    },
  ],
  montage: true,
  sonderausstattung: 'Conero G und H (nur 100er Korpus), Gürtel-/Krawattenauszug mit Montageseite, Schuhablage an Korpusbreite.',
})

const p16 = baueEntwurf({
  nr: 16,
  titel: 'Rollböden, Schuhablage Craft & Innenspiegel',
  raster: '18R',
  breiten: ['100', '100', '60'],
  innen: DECOBOARD_SCHWARZ,
  aussen: MATTLACK_FJORD,
  segmente: [
    {
      elements: tuerPaar('p16t1', '49', 'glatt', DECOBOARD_SCHWARZ, '18R'),
      equipment: [
        {
          id: 'p16q1a',
          optionId: 'rollboden',
          qty: 4,
          hoehen: [
            { modus: 'raster', raster: 3 },
            { modus: 'raster', raster: 5 },
            { modus: 'raster', raster: 7 },
            { modus: 'boden' },
          ],
        },
        {
          id: 'p16q1b',
          optionId: 'innenspiegel-drehtuer',
          formatNote: '40 × 120 cm',
          note: 'Auf der linken Drehtür, oberkant bündig.',
        },
        stange('p16q1c', 16),
      ],
    },
    {
      elements: tuerPaar('p16t2', '49', 'glatt', DECOBOARD_SCHWARZ, '18R'),
      equipment: [
        {
          id: 'p16q2a',
          optionId: 'rollboden-schuhablage-craft',
          qty: 2,
          hoehen: [{ modus: 'raster', raster: 4 }],
          positionNote: 'unten, hinter der rechten Tür',
        },
        { id: 'p16q2b', optionId: 'krawattenspange', qty: 1, positionNote: 'Höhe ca. 150 cm' },
        boeden('p16q2c', [9, 13]),
      ],
    },
    {
      elements: [drehtuer('p16t3a', 'D3', '59', 'glatt', DECOBOARD_SCHWARZ, '18R', 'rechts')],
      equipment: [
        { id: 'p16q3a', optionId: 'kleiderbuegelhalter', qty: 1, hoehen: [{ modus: 'raster', raster: 14 }], positionNote: 'rechts' },
        { id: 'p16q3b', optionId: 'kleiderlift' },
        stange('p16q3c', 16),
      ],
    },
  ],
  sonderausstattung: 'Rollböden mit eigener Höhe je Stück, Rollboden mit Schuhablage Craft (Preis aus der Korpusbreite), Innenspiegel 40 × 120 cm.',
})

// ---------------------------------------------------------------------------
// 17–18 · Bauseitige Anpassungen, Beleuchtung und Verblendung
// ---------------------------------------------------------------------------

const p17 = baueEntwurf({
  nr: 17,
  titel: 'Revisionsklappen, Rückwandausschnitte & Fußleistenausschnitt',
  raster: '18R',
  breiten: ['100', '100', '100'],
  innen: MATTLACK_WEISS,
  aussen: MATTLACK_WEISS,
  fussleiste: { enabled: true, hoeheCm: '12', tiefeCm: '3' },
  segmente: [
    {
      elements: tuerPaar('p17t1', '49', 'glatt', MATTLACK_WEISS, '18R'),
      equipment: [
        {
          id: 'p17q1a',
          optionId: 'revisionsklappe',
          qty: 2,
          formatNote: '40 × 20 cm',
          positionNote: 'unten links, Zugang Wasseranschluss',
        },
        boeden('p17q1b', [9, 13]),
      ],
    },
    {
      elements: tuerPaar('p17t2', '49', 'glatt', MATTLACK_WEISS, '18R'),
      equipment: [
        {
          id: 'p17q2a',
          optionId: 'rueckwandausschnitt',
          qty: 3,
          formatNote: '20 × 10 cm',
          positionNote: 'Steckdosen auf 30 cm Höhe',
        },
        stange('p17q2b', 16),
      ],
    },
    {
      elements: tuerPaar('p17t3', '49', 'glatt', MATTLACK_WEISS, '18R'),
      equipment: [
        { id: 'p17q3a', optionId: 'revisionsklappe', qty: 1, formatNote: '30 × 30 cm', positionNote: 'oben rechts' },
        { id: 'p17q3b', optionId: 'rueckwandausschnitt', qty: 1, formatNote: '15 × 15 cm', positionNote: 'Lüftung' },
        boeden('p17q3c', [8, 12, 16]),
      ],
    },
  ],
  sondermasse: 'Fußleistenausschnitt 12 × 3 cm umlaufend — Altbau, Sockelleiste bleibt stehen.',
  sonderausstattung: 'Prüft die bauseitigen Anpassungen: Revisionsklappen, Rückwandausschnitte, Fußleistenausschnitt.',
})

const p18 = baueEntwurf({
  nr: 18,
  titel: 'Beidseitige LED-Bänder, LED-Syncro & Verblendung korpusbündig',
  // Bewusst 18 Raster: Das LED-Band führt seine Höhenachse nur bis 235 cm. In 21 Rastern
  // wäre die Position „auf Anfrage" — und genau der beidseitige LED-Preis soll hier
  // belegt werden. Die 21-Raster-Lücke zeigen die Entwürfe 02, 06, 09, 11, 13 und 20.
  raster: '18R',
  breiten: ['100', '100', '60'],
  innen: FURNIER_NUSSBAUM,
  aussen: FURNIER_NUSSBAUM,
  verblendung: { art: 'korpusbuendig', lfm: '2,4', positionNote: 'links und oben, Anschluss an die Wand' },
  segmente: [
    {
      elements: tuerPaar('p18t1', '49', 'glatt', FURNIER_NUSSBAUM, '18R'),
      equipment: [
        { id: 'p18q1a', optionId: 'led-band-aluprofil', seiten: { links: true, rechts: true } },
        boeden('p18q1b', [8, 14]),
        stange('p18q1c', 16),
      ],
    },
    {
      elements: tuerPaar('p18t2', '49', 'glatt', FURNIER_NUSSBAUM, '18R'),
      equipment: [
        { id: 'p18q2a', optionId: 'led-band-aluprofil', seiten: { links: true } },
        { id: 'p18q2b', optionId: 'led-syncro' },
        stange('p18q2c', 16),
      ],
    },
    {
      elements: [drehtuer('p18t3a', 'D3', '59', 'glatt', FURNIER_NUSSBAUM, '18R', 'rechts')],
      equipment: [
        { id: 'p18q3a', optionId: 'glasboden', qty: 2, hoehen: [{ modus: 'raster', raster: 10 }, { modus: 'raster', raster: 15 }], choices: { glasart: 'rauchglas-grau' } },
        stange('p18q3b', 16),
      ],
    },
  ],
  montage: true,
  lieferungRegional: true,
  sonderausstattung: 'LED-Band links+rechts (Preis je Schrankseite, also doppelt), einmal nur links, dazu LED-Syncro und Verblendung nach Laufmetern.',
})

// ---------------------------------------------------------------------------
// 19–20 · Gemischte Fronten und Maximalausbau
// ---------------------------------------------------------------------------

const p19 = baueEntwurf({
  nr: 19,
  titel: 'Gemischt: Drehtüren, Schübe und offene Regalfelder',
  raster: '18R',
  breiten: ['100', '60', '50'],
  innen: DECOBOARD_KASCHMIR,
  aussen: DECOBOARD_KASCHMIR,
  segmente: [
    {
      elements: tuerPaar('p19t1', '49', 'glatt', DECOBOARD_KASCHMIR, '18R'),
      equipment: [boeden('p19q1a', [5, 9, 13]), stange('p19q1b', 16)],
    },
    {
      // Schübe unten, darüber ein offenes Fach.
      elements: [
        {
          id: 'p19t2a',
          typeId: 'schuebe',
          label: 'S1',
          widthCm: '59',
          heightCm: '25,3',
          styleLineId: '107',
          fieldValues: {
            griffleisteRal: { text: 'RAL 9005' },
            material: { material: DECOBOARD_KASCHMIR },
          },
        },
        {
          id: 'p19t2b',
          typeId: 'schuebe',
          label: 'S2',
          widthCm: '59',
          heightCm: '25,3',
          styleLineId: '107',
          fieldValues: {
            griffleisteRal: { text: 'RAL 9005' },
            material: { material: DECOBOARD_KASCHMIR },
          },
        },
        { id: 'p19t2c', typeId: 'offen', label: 'O1', widthCm: '59', heightCm: '178,9' },
      ],
      equipment: [boeden('p19q2a', [8, 12, 16])],
    },
    {
      elements: [drehtuer('p19t3a', 'D3', '49', 'glatt', DECOBOARD_KASCHMIR, '18R', 'rechts')],
      equipment: [
        { id: 'p19q3a', optionId: 'innenschublade', qty: 2, variant: '1,5R', hoehen: [{ modus: 'boden' }, { modus: 'raster', raster: 4 }] },
        { id: 'p19q3b', optionId: 'rollkorb', qty: 1, hoehen: [{ modus: 'boden' }] },
        stange('p19q3c', 16),
      ],
    },
  ],
  sonderausstattung: 'Geschlossene und offene Felder im selben Möbel; Schübe in der Linie 107; Innenschubladen und Rollkorb.',
})

const p20 = baueEntwurf({
  nr: 20,
  titel: 'Maximalausbau 400 cm · 21 Raster · alle Bausteine',
  raster: '21R',
  breiten: ['100', '100', '100', '100'],
  innen: XTREME_VULKANSCHWARZ,
  aussen: GLAS_STONE,
  abschlussMaterial: MATTLACK_FJORD,
  verblendung: { art: 'frontbuendig', lfm: '3,2', positionNote: 'rechts, Anschluss an die Dachschräge' },
  fussleiste: { enabled: true, hoeheCm: '10', tiefeCm: '2,5' },
  segmente: [
    {
      elements: tuerPaar('p20t1', '49', 'glatt', XTREME_VULKANSCHWARZ, '21R'),
      equipment: [
        { id: 'p20q1a', optionId: 'container-craft', variant: 'B', rauchglas: true },
        { id: 'p20q1b', optionId: 'schubladenunterteilung-craft', qty: 2, bezugId: 'p20q1a' },
        { id: 'p20q1c', optionId: 'led-band-aluprofil', seiten: { links: true, rechts: true } },
        boeden('p20q1d', [10, 15]),
        stange('p20q1e', 19),
      ],
    },
    {
      elements: [
        drehtuer('p20t2a', 'D2-L', '59', 'curve', XTREME_VULKANSCHWARZ, '21R', 'links'),
        drehtuer('p20t2b', 'D2-R', '39', 'curve', XTREME_VULKANSCHWARZ, '21R', 'rechts'),
      ],
      equipment: [
        // Conero D statt G/H: Der Innenkorpus ist Xtreme Plus (PG 4), und nur die
        // Modelle A–F führen Preiszeilen über alle vier Preisgruppen.
        { id: 'p20q2a', optionId: 'container-conero', variant: 'D', rauchglas: false },
        {
          id: 'p20q2b',
          optionId: 'guertel-krawattenauszug-conero',
          qty: 1,
          hoehen: [{ modus: 'raster', raster: 13 }],
          choices: { montageseite: 'links' },
        },
        { id: 'p20q2c', optionId: 'innenspiegel-drehtuer', formatNote: '40 × 120 cm', note: 'linke Tür' },
        boeden('p20q2d', [17]),
      ],
    },
    {
      elements: tuerPaar('p20t3', '49', 'line', GLAS_STONE, '21R').map((t) => ({
        ...t,
        lineAufkantungGleich: false,
        fieldValues: {
          material: { material: GLAS_STONE },
          aufkantung: { material: { ...MATTLACK_FJORD } },
        },
      })),
      equipment: [
        { id: 'p20q3a', optionId: 'revisionsklappe', qty: 1, formatNote: '40 × 20 cm', positionNote: 'unten rechts' },
        { id: 'p20q3b', optionId: 'rueckwandausschnitt', qty: 2, formatNote: '20 × 10 cm', positionNote: 'Steckdosen' },
        { id: 'p20q3c', optionId: 'rollboden', qty: 2, hoehen: [{ modus: 'boden' }, { modus: 'raster', raster: 4 }] },
        stange('p20q3d', 19),
      ],
    },
    {
      elements: tuerPaar('p20t4', '49', 'glatt', XTREME_VULKANSCHWARZ, '21R'),
      equipment: [
        { id: 'p20q4a', optionId: 'kleiderlift' },
        { id: 'p20q4b', optionId: 'glasboden', qty: 2, hoehen: [{ modus: 'raster', raster: 9 }, { modus: 'raster', raster: 14 }], choices: { glasart: 'rauchglas-dark-grey' } },
        { id: 'p20q4c', optionId: 'krawattenspange', qty: 2, positionNote: 'Höhe ca. 160 cm' },
        { id: 'p20q4d', optionId: 'led-syncro' },
        stange('p20q4e', 19),
      ],
    },
  ],
  montage: true,
  lieferungRegional: true,
  sondermasse: 'Nische 402 cm, Dachschräge rechts ab 250 cm — Verblendung frontbündig einplanen.',
  sonderausstattung: 'Maximalausbau: drei Stil-Linien, Craft und Conero, LED beidseitig, Verblendung, Revisionsklappe, Innenspiegel.',
})

/** Die 20 Praxistest-Entwürfe in der Reihenfolge ihrer Nummern. */
export const praxistestEntwuerfe: Draft[] = [
  p01, p02, p03, p04, p05, p06, p07, p08, p09, p10,
  p11, p12, p13, p14, p15, p16, p17, p18, p19, p20,
]
