/**
 * FRONT-KATALOG (Phase 5 + 9b) – kaskadierende Dropdown-Hierarchie:
 *
 *   Front-Typ  ->  Stil-Linie  ->  Felder (Material aus Farbmatrix / Freitext)
 *
 * Phase 9b ergänzt: Stil-Linie „Glatt“, Klappen (Stauraum/Hochstell/Schreib),
 * zweiläufige Schiebetür (Refugium, Edge/Curve), sowie die „handleOptions“-Marke
 * für Glatt/Less/Glossy (PTO- & Griff-Checkboxen + Griff-Dropdown in der UI).
 * Alle Material-Felder greifen auf dieselbe zentrale Farbmatrix zu.
 */

export type FrontFieldKind = 'material' | 'freetext'

export interface FrontField {
  id: string
  label: string
  kind: FrontFieldKind
  materialGroupIds?: string[]
  allowCustom?: boolean
  withNote?: boolean
  notePlaceholder?: string
  placeholder?: string
  /**
   * Schritt 7: Feld ausblenden, wenn das referenzierte Geschwister-Materialfeld eine
   * dieser Gruppen gewählt hat. Für 107/Curve gilt: der Griffleisten-Freitext entfällt
   * bei Xtreme Plus oder Decoboard (S. 20).
   */
  hideWhenSiblingGroupIn?: { fieldId: string; groups: string[] }
}

export interface FrontStyleLine {
  id: string
  label: string
  fields: FrontField[]
  /** Phase 9b: schaltet PTO-/Griff-Checkboxen + Griff-Dropdown frei (Glatt/Less/Glossy). */
  handleOptions?: boolean
}

export interface FrontType {
  id: string
  label: string
  /** Leer bei „Offen (Regal)“ – kein Material/Front, nur Kennzeichnung & Maße. */
  styleLines: FrontStyleLine[]
  /** Harte Höhensperre in cm (Schreibklappe = 45). */
  maxHeightCm?: number
  /** Einläufige Schiebetür: Freitextfeld „Laufschienenfarbe“. */
  laufschiene?: boolean
  /** Zweiläufige Schiebetür: Griffprofil-Auswahl (nur Edge/Curve). */
  griffProfil?: boolean
  /** Nur bei Refugium anbietbar (zweiläufige Schiebetür). */
  refugiumOnly?: boolean
  /**
   * Punkt 7.11 — Dietmar: „keine einläufige Schiebetür beim Kleiderschrank."
   * Der Typ wird für Refugium vollständig ausgeblendet; damit entfällt auch die
   * Lücke, über die dort Glossy in allen Materialgruppen wählbar war.
   */
  nichtBeiRefugium?: boolean
  /**
   * Punkt 7.7: Zulässige Türbreite in cm. Bei Decoboard und Xtreme Plus gilt das
   * erweiterte Maximum, weil diese Türblätter nicht hängen.
   */
  tuerbreiteCm?: { min: number; max: number; maxDecoboardXp?: number }
}

// --- Materialgruppen-Teilmengen laut Fronten-/Farb-Doku --------------------------
const ALL5 = ['decoboard', 'mattlack', 'furnier', 'glas', 'xtreme-plus']
const GLAS_ONLY = ['glas']
const LINE_GROUPS = ['glas', 'mattlack', 'furnier']
const CLASSIC_DREH_GROUPS = ['decoboard', 'mattlack', 'furnier', 'xtreme-plus']
// Schritt 7: „Curve nicht in Glas" (S. 18) – Glas ist bei 107/Curve NICHT zulässig.
const CURVE_GROUPS = ['decoboard', 'mattlack', 'furnier', 'xtreme-plus']
const EDGE_GROUPS = ['decoboard', 'mattlack', 'furnier', 'xtreme-plus', 'glas']

// --- Feld-Builder ---------------------------------------------------------------
function matField(
  id: string,
  label: string,
  materialGroupIds: string[],
  opts: { withNote?: boolean; notePlaceholder?: string; allowCustom?: boolean } = {},
): FrontField {
  return {
    id,
    label,
    kind: 'material',
    materialGroupIds,
    allowCustom: opts.allowCustom ?? true,
    withNote: opts.withNote ?? false,
    notePlaceholder: opts.notePlaceholder ?? 'Freitext (z. B. RAL)',
  }
}

function textField(id: string, label: string, placeholder = 'Freitext (z. B. RAL)'): FrontField {
  return { id, label, kind: 'freetext', placeholder }
}

// 107 = Curve: Griffleiste gepulvert (Freitext RAL/Sikkens) + Material (ohne Glas) + Freitext.
// S. 20: Der Griffleisten-Freitext entfällt bei Xtreme Plus oder Decoboard.
const curveFields: FrontField[] = [
  {
    ...textField('griffleisteRal', 'Griffleiste gepulvert in:', 'z.B. RAL oder Sikkens'),
    hideWhenSiblingGroupIn: { fieldId: 'material', groups: ['decoboard', 'xtreme-plus'] },
  },
  matField('material', 'Material', CURVE_GROUPS, { withNote: true }),
]

// --- Drehtüren / Schübe / Klappen (identische Baumstruktur) ----------------------
// Glatt/Glossy/Less: Material + PTO/Griff-Checkboxen (handleOptions). Glatt N = PG N.
const drehStyleLines: FrontStyleLine[] = [
  { id: 'glatt', label: 'Glatt', fields: [matField('material', 'Material', CLASSIC_DREH_GROUPS, { withNote: true })], handleOptions: true },
  { id: 'glossy', label: 'Glossy', fields: [matField('glas', 'Glas', GLAS_ONLY, { withNote: true })], handleOptions: true },
  { id: 'less', label: 'Less', fields: [matField('glas', 'Glas', GLAS_ONLY, { withNote: true })], handleOptions: true },
  { id: 'line', label: 'Line', fields: [matField('material', 'Material (Glas / Mattlack / Furnier)', LINE_GROUPS, { withNote: true })] },
  { id: '107', label: '107', fields: curveFields },
  { id: 'curve', label: 'Curve', fields: curveFields },
]

// --- Schiebetüren einläufig (grifflos: Glatt/Schiene/Glossy/Less/Classic + Edge) --
const schiebeStyleLines: FrontStyleLine[] = [
  { id: 'glatt', label: 'Glatt', fields: [matField('material', 'Ausführung', ALL5, { withNote: true })], handleOptions: true },
  { id: 'schiene', label: 'Schiene', fields: [matField('material', 'Ausführung', ALL5, { withNote: true })] },
  { id: 'glossy', label: 'Glossy', fields: [matField('material', 'Ausführung', ALL5, { withNote: true })], handleOptions: true },
  { id: 'less', label: 'Less', fields: [matField('material', 'Ausführung (Glas)', GLAS_ONLY)], handleOptions: true },
  { id: 'classic', label: 'Classic', fields: [matField('material', 'Material', ALL5)] },
  { id: 'edge', label: 'Edge', fields: [textField('griffRal', 'Griff RAL'), matField('material', 'Material (inkl. Glas hinterlackiert)', EDGE_GROUPS)] },
]

// --- Schiebetüren zweiläufig (Refugium): Glatt / Curve / Glossy·Less --------------
// Schritt 7 (S. 17/18): Line NICHT möglich; Glatt gilt für Decoboard/Mattlack/Furnier/
// Xtreme Plus; Curve nicht in Glas; Glossy & Less nur in Glas.
const schiebeZweiStyleLines: FrontStyleLine[] = [
  { id: 'glatt', label: 'Glatt', fields: [matField('material', 'Material', CLASSIC_DREH_GROUPS, { withNote: true })] },
  { id: 'curve', label: 'Curve', fields: [matField('material', 'Material', CURVE_GROUPS, { withNote: true })] },
  { id: 'glossy-less', label: 'Glossy / Less', fields: [matField('material', 'Material (Glas)', GLAS_ONLY, { withNote: true })] },
]

export const frontTypes: FrontType[] = [
  { id: 'drehtuer', label: 'Drehtür', styleLines: drehStyleLines },
  {
    id: 'schiebetuer',
    label: 'Schiebetür (einläufig)',
    styleLines: schiebeStyleLines,
    laufschiene: true,
    nichtBeiRefugium: true,
  },
  {
    id: 'schiebetuer-zwei',
    label: 'Schiebetür (zweiläufig)',
    styleLines: schiebeZweiStyleLines,
    griffProfil: true,
    refugiumOnly: true,
    tuerbreiteCm: { min: 80, max: 120, maxDecoboardXp: 150 },
  },
  // Schübe: exakt die Baumstruktur der Drehtüren (laut Doku).
  { id: 'schuebe', label: 'Schübe', styleLines: drehStyleLines },
  // Klappen (Phase 9b) – Stil-Linien wie Drehtüren.
  { id: 'stauraumklappe', label: 'Stauraumklappe', styleLines: drehStyleLines, maxHeightCm: 45 },
  { id: 'hochstellklappe', label: 'Hochstellklappe', styleLines: drehStyleLines },
  { id: 'schreibklappe', label: 'Schreibklappe', styleLines: drehStyleLines, maxHeightCm: 45 },
  // Offen (Regal): kein Material/Front – nur Kennzeichnung & Maße.
  { id: 'offen', label: 'Offen (Regal)', styleLines: [] },
]

export function getFrontType(id: string | undefined): FrontType | undefined {
  return id ? frontTypes.find((type) => type.id === id) : undefined
}

/**
 * Front-Typen, die für die aktuelle Serie anbietbar sind.
 * Zweiläufige Schiebetür nur bei Refugium, einläufige Schiebetür dort gar nicht (7.11).
 */
export function getAvailableFrontTypes(seriesId: string | undefined): FrontType[] {
  const istRefugium = seriesId === 'refugium'
  return frontTypes.filter((type) => {
    if (type.refugiumOnly && !istRefugium) return false
    if (type.nichtBeiRefugium && istRefugium) return false
    return true
  })
}

export function getStyleLine(
  typeId: string | undefined,
  styleLineId: string | undefined,
): FrontStyleLine | undefined {
  const type = getFrontType(typeId)
  return type && styleLineId ? type.styleLines.find((line) => line.id === styleLineId) : undefined
}
