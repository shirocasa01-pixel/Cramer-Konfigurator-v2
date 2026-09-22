/**
 * FRONT-KATALOG (Phase 5 + 9b) – kaskadierende Dropdown-Hierarchie:
 *
 *   Front-Typ  ->  Stil-Linie  ->  Felder (Material aus Farbmatrix / Freitext)
 *
 * Phase 9b ergänzt: Stil-Linie „Glatt“, Klappen (Stauraum/Hochstell/Schreib),
 * zweiläufige Schiebetür (Refugium, Edge/Curve), sowie die „handleOptions“-Marke
 * für Glatt/Less/Glossy (PTO- & Griff-Checkboxen + Griff-Dropdown in der UI).
 * Alle Material-Felder greifen auf dieselbe zentrale Farbmatrix zu.
 *
 * ÜBERARBEITUNG 3 (Fachberater 09/2026):
 *   - Klappen entfallen bei Kleiderschränken (`nichtBeiKleiderschrank`).
 *   - Drehtür: Türhöhe über drei exklusive Optionen (`hoeheModi`) + Türanschlag
 *     (`tuerAnschlag`).
 *   - Zweiläufige Schiebetür: kein Höhenfeld (`ohneHoehe`) – sie geht immer über die
 *     volle Korpushöhe.
 *   - Line / 107 / Curve / Glossy / Less haben eigene Preisspalten (`eigenePreisspalte`)
 *     und sind damit NICHT aus PG 1–4 wählbar.
 *   - Line: Ja/Nein-Abfrage „Frontscheibe und Aufkantung gleich?“ (`frontscheibeAufkantung`).
 *   - Glossy/Less: Materialoption „anders“ entfällt.
 *
 * ÜBERARBEITUNG 9 (Cramer, 09/2026):
 *   - Kein allgemeines Freitextfeld „Sonderwünsche“ mehr an katalogisierten Materialien
 *     (Glatt, 107, Curve, Line …). Material → Ausführung → Preisgruppe genügt. Freitext
 *     bleibt nur dort, wo fachlich eine Angabe fehlt: bei Sonderfarben (Farbcode, aus den
 *     Oberflächen-Stammdaten), bei „anders“ und in den eigenen Feldern (Griffleiste,
 *     Alulisene, Griffdetails …). Allgemeine Wünsche stehen in der „Sonderausstattung“.
 *   - Line: drei Gläser sind konstruktiv nicht möglich (`ausgeschlosseneOptionen`).
 */

import { ALLE_MATERIALGRUPPEN } from './materialMatrix.ts'

export type FrontFieldKind = 'material' | 'freetext'

/**
 * Bedingung, unter der ein Feld sichtbar wird. Ausgewertet zentral in
 * `lib/frontsHelpers.ts` (`isFrontFieldVisible`), damit UI, Validierung,
 * Zusammenfassung und AV-PDF dieselbe Sicht haben.
 */
export type FrontFieldCondition =
  /** „Line“: nur wenn Frontscheibe ≠ Aufkantung („Nein“). */
  | 'lineGetrennt'
  /** Wie `lineGetrennt`, zusätzlich nur bei Material Furnier oder Mattlack. */
  | 'lineGetrenntFurnierMattlack'
  /** Nur solange NICHT „anders“ gewählt ist – dort steht alles im Sonderausführungs-Feld. */
  | 'nichtBeiAnders'

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
   * Platzhalter des Freitextfeldes „Sonderausführung (anders)“. Überarbeitung 3
   * formuliert ihn je Stil-Linie unterschiedlich („Sonderausführung beschreiben“,
   * „Genaue Beschreibung der Sonderausführung“, „Sonderwunsch genau definieren“).
   */
  customPlaceholder?: string
  /** Sichtbarkeitsbedingung; ohne Angabe ist das Feld immer sichtbar. */
  visibleWhen?: FrontFieldCondition
  /**
   * „Line“-Aufkantung: die wählbaren Materialgruppen ergeben sich aus der Frontscheibe
   * (Furnier ⇒ alle Furniere, Gläser und Mattlacke; sonst dieselbe Gruppe).
   * Siehe `aufkantungGroupIds()` in `lib/frontsHelpers.ts`.
   */
  groupsFromFrontscheibe?: boolean
}

export interface FrontStyleLine {
  id: string
  label: string
  fields: FrontField[]
  /** Phase 9b: schaltet PTO-/Griff-Checkboxen + Griff-Dropdown frei (Glatt/Less/Glossy). */
  handleOptions?: boolean
  /**
   * Überarbeitung 3: Die Linie hat in der Preisliste eine EIGENE Spalte und wird nicht
   * über PG 1–4 bepreist. Der Wert ist das Anzeige-Label („Line“, „107“, „Curve“,
   * „Glossy/Less“); bei „anders“ entfällt dadurch die manuelle Preisgruppen-Auswahl.
   */
  eigenePreisspalte?: string
  /**
   * Überarbeitung 3 („Line“): Nach der Materialwahl folgt die Ja/Nein-Frage
   * „Glas der Frontscheibe und der Aufkantung gleich?“. Bei „Nein“ teilt sich die
   * Ausführung in Frontscheibe und Aufkantung.
   */
  frontscheibeAufkantung?: boolean
  /**
   * Überarbeitung 9, S. 8: Oberflächen, die für diese Stil-Linie konstruktiv nicht gehen —
   * je Materialgruppe die Options-IDs der Stammdaten. Die Oberfläche bleibt in den
   * Stammdaten (andere Linien brauchen sie), diese Regel filtert sie nur hier heraus.
   */
  ausgeschlosseneOptionen?: Record<string, string[]>
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
  /** Zweiläufige Schiebetür: Griffprofil-Auswahl (nur Edge). */
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
   * Überarbeitung 3: „Stauraumklappen, Hochstellklappen und Schreibklappen werden bei
   * Kleiderschränken nicht benötigt." Der Typ verschwindet dort aus der Hinzufügen-Leiste.
   */
  nichtBeiKleiderschrank?: boolean
  /**
   * Überarbeitung 3 (Drehtür): Die Türhöhe wird über DREI exklusive Optionen erfasst —
   * „Höhe bis Korpusoberkante“, „Höhe (Raster)“ und „Höhe (cm)“. Wählt der Verkäufer
   * eine, sind die anderen beiden gesperrt.
   */
  hoeheModi?: boolean
  /**
   * Drehtür: Türanschlag links/rechts. Seit Überarbeitung 9 nur bei Einzeltüren abgefragt —
   * bei einem Türpaar nebeneinander gibt `lib/frontGeometrie.ts` ihn vor.
   */
  tuerAnschlag?: boolean
  /**
   * Überarbeitung 3 (zweiläufige Schiebetür): „Höhe immer über volle Höhe (technisch
   * nicht anders möglich)“ — das Höhenfeld entfällt deshalb vollständig.
   */
  ohneHoehe?: boolean
  /**
   * Punkt 7.7: Zulässige Türbreite in cm. Bei Decoboard und Xtreme Plus gilt das
   * erweiterte Maximum, weil diese Türblätter nicht hängen.
   */
  tuerbreiteCm?: { min: number; max: number; maxDecoboardXp?: number }
}

// --- Materialgruppen-Teilmengen laut Fronten-/Farb-Doku --------------------------
//
// Die IDs verweisen auf Oberflächenkategorien der Stammdaten (Reiter „Oberflächen").
// Sie sagen, WELCHE Kategorien eine Stil-Linie konstruktiv zulässt — die Farben darin
// kommen ausschließlich aus den Stammdaten. Wo alles zulässig ist, steht der Platzhalter
// `ALLE_MATERIALGRUPPEN`; dann zieht die Auswahl auch neu angelegte Kategorien mit.
const ALLE = [ALLE_MATERIALGRUPPEN]
const GLAS_ONLY = ['glas']
const LINE_GROUPS = ['glas', 'mattlack', 'furnier']
/** Überarbeitung 9, S. 8: Wave hinterlackiert, Rauchglas grau, Rauchglas dark grey. */
const LINE_AUSGESCHLOSSENE_GLAESER = ['wave-hinterlackiert', 'rauchglas-grau', 'rauchglas-dark-grey']
/** Überarbeitung 3: „Hier alle Furnier, Gläser und Mattlacke auflisten“ (Line-Aufkantung bei Furnier). */
export const LINE_AUFKANTUNG_GROUPS = ['furnier', 'glas', 'mattlack']
const CLASSIC_DREH_GROUPS = ['decoboard', 'mattlack', 'furnier', 'xtreme-plus']
// Schritt 7: „Curve nicht in Glas" (S. 18) – Glas ist bei 107/Curve NICHT zulässig.
const CURVE_GROUPS = ['decoboard', 'mattlack', 'furnier', 'xtreme-plus']
const EDGE_GROUPS = ['decoboard', 'mattlack', 'furnier', 'xtreme-plus', 'glas']

// --- Platzhalter (Überarbeitung 3, exakte Schreibweisen) -------------------------
const PH_ANDERS_BESCHREIBEN = 'Sonderausführung beschreiben'
const PH_ANDERS_GENAU = 'Genaue Beschreibung der Sonderausführung'
const PH_ANDERS_SCHIEBE = 'Sonderwunsch genau definieren'

// --- Feld-Builder ---------------------------------------------------------------
function matField(
  id: string,
  label: string,
  materialGroupIds: string[],
  opts: {
    withNote?: boolean
    notePlaceholder?: string
    allowCustom?: boolean
    customPlaceholder?: string
  } = {},
): FrontField {
  return {
    id,
    label,
    kind: 'material',
    materialGroupIds,
    allowCustom: opts.allowCustom ?? true,
    withNote: opts.withNote ?? false,
    notePlaceholder: opts.notePlaceholder ?? 'Freitext (z. B. RAL)',
    customPlaceholder: opts.customPlaceholder,
  }
}

function textField(id: string, label: string, placeholder = 'Freitext (z. B. RAL)'): FrontField {
  return { id, label, kind: 'freetext', placeholder }
}

// 107 = Curve: Griffleiste gepulvert (Freitext RAL) + Material (ohne Glas).
// Überarbeitung 3: Der Griffleisten-Freitext wird jetzt bei ALLEN Materialien abgefragt
// („Bei 107 Decoboard + Xtreme Plus fehlt jeweils die Angabe gepulvert in") und der
// Platzhalter verliert den Sikkens-Zusatz.
// Überarbeitung 9, S. 9: „107 Fronten bitte auch für Curve übernehmen" — beide Linien
// teilen deshalb bewusst DIESELBE Feldliste: Materialwahl, Standardlacke samt Sonderfarben
// (Preisgruppe aus den Stammdaten, Farbcode als Pflichtfeld), kein allgemeiner Freitext.
// Die Preisspalten bleiben getrennt (`eigenePreisspalte` „107" bzw. „Curve").
const curveFields: FrontField[] = [
  textField('griffleisteRal', 'Griffleiste gepulvert in:', 'z. B. RAL'),
  matField('material', 'Material', CURVE_GROUPS, {
    customPlaceholder: PH_ANDERS_GENAU,
  }),
]

// „Line“ (Überarbeitung 3 + 9): Material → „Glas der Frontscheibe und der Aufkantung
// gleich?" → eine oder zwei Ausführungen → Alulisene. Die Ja/Nein-Frage steht OBERHALB der
// Glasausführung (Überarbeitung 9, S. 8); das allgemeine Freitextfeld ist entfallen.
const lineFields: FrontField[] = [
  matField('material', 'Material (Glas / Mattlack / Furnier)', LINE_GROUPS, {
    customPlaceholder: PH_ANDERS_GENAU,
  }),
  {
    id: 'aufkantung',
    label: 'Ausführung Aufkantung',
    kind: 'material',
    materialGroupIds: LINE_AUFKANTUNG_GROUPS,
    allowCustom: false,
    visibleWhen: 'lineGetrennt',
    groupsFromFrontscheibe: true,
  },
  {
    ...textField('alulisene', 'Alulisene gepulvert in', 'z. B. RAL oder Sikkens'),
    visibleWhen: 'lineGetrenntFurnierMattlack',
  },
]

// --- Drehtüren / Schübe / Klappen (identische Baumstruktur) ----------------------
// Glatt/Glossy/Less: Material + PTO/Griff-Checkboxen (handleOptions). Glatt N = PG N.
// Glossy/Less: Überarbeitung 3 — „Option anders streichen“, eigene Preisspalte.
const drehStyleLines: FrontStyleLine[] = [
  {
    id: 'glatt',
    label: 'Glatt',
    fields: [
      matField('material', 'Material', CLASSIC_DREH_GROUPS, {
        customPlaceholder: PH_ANDERS_BESCHREIBEN,
      }),
    ],
    handleOptions: true,
  },
  {
    id: 'glossy',
    label: 'Glossy',
    fields: [
      matField('glas', 'Glas', GLAS_ONLY, {
        allowCustom: false,
      }),
    ],
    handleOptions: true,
    eigenePreisspalte: 'Glossy/Less',
  },
  {
    id: 'less',
    label: 'Less',
    fields: [
      matField('glas', 'Glas', GLAS_ONLY, {
        allowCustom: false,
      }),
    ],
    handleOptions: true,
    eigenePreisspalte: 'Glossy/Less',
  },
  {
    id: 'line',
    label: 'Line',
    fields: lineFields,
    eigenePreisspalte: 'Line',
    frontscheibeAufkantung: true,
    // Überarbeitung 9, S. 8: „Folgende 3 Gläser nur bei Line bitte entfernen. Sie
    // funktionieren bei Line nicht."
    ausgeschlosseneOptionen: { glas: LINE_AUSGESCHLOSSENE_GLAESER },
  },
  { id: '107', label: '107', fields: curveFields, eigenePreisspalte: '107' },
  { id: 'curve', label: 'Curve', fields: curveFields, eigenePreisspalte: 'Curve' },
]

// --- Schiebetüren einläufig (grifflos: Glatt/Schiene/Glossy/Less/Classic + Edge) --
const schiebeStyleLines: FrontStyleLine[] = [
  { id: 'glatt', label: 'Glatt', fields: [matField('material', 'Ausführung', ALLE)], handleOptions: true },
  { id: 'schiene', label: 'Schiene', fields: [matField('material', 'Ausführung', ALLE)] },
  {
    id: 'glossy',
    label: 'Glossy',
    fields: [matField('material', 'Ausführung', ALLE)],
    handleOptions: true,
    eigenePreisspalte: 'Glossy/Less',
  },
  {
    id: 'less',
    label: 'Less',
    fields: [matField('material', 'Ausführung (Glas)', GLAS_ONLY)],
    handleOptions: true,
    eigenePreisspalte: 'Glossy/Less',
  },
  { id: 'classic', label: 'Classic', fields: [matField('material', 'Material', ALLE)] },
  { id: 'edge', label: 'Edge', fields: [textField('griffRal', 'Griff RAL'), matField('material', 'Material (inkl. Glas hinterlackiert)', EDGE_GROUPS)] },
]

// --- Schiebetüren zweiläufig (Refugium): Glatt / Curve / Glossy·Less --------------
// Schritt 7 (S. 17/18): Line NICHT möglich; Glatt gilt für Decoboard/Mattlack/Furnier/
// Xtreme Plus; Curve nicht in Glas; Glossy & Less nur in Glas.
// Überarbeitung 3: Sonderausführungs-Platzhalter „Sonderwunsch genau definieren“;
// Glossy/Less mit eigener Preisspalte (nicht aus PG 1–4 wählbar).
const schiebeZweiStyleLines: FrontStyleLine[] = [
  {
    id: 'glatt',
    label: 'Glatt',
    fields: [
      matField('material', 'Material', CLASSIC_DREH_GROUPS, {
        customPlaceholder: PH_ANDERS_SCHIEBE,
      }),
    ],
  },
  {
    id: 'curve',
    label: 'Curve',
    fields: [
      matField('material', 'Material', CURVE_GROUPS, {
        customPlaceholder: PH_ANDERS_SCHIEBE,
      }),
    ],
    eigenePreisspalte: 'Curve',
  },
  {
    id: 'glossy-less',
    label: 'Glossy / Less',
    fields: [
      matField('material', 'Material (Glas)', GLAS_ONLY, {
        customPlaceholder: PH_ANDERS_SCHIEBE,
      }),
    ],
    eigenePreisspalte: 'Glossy/Less',
  },
]

export const frontTypes: FrontType[] = [
  { id: 'drehtuer', label: 'Drehtür', styleLines: drehStyleLines, hoeheModi: true, tuerAnschlag: true },
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
    ohneHoehe: true,
    tuerbreiteCm: { min: 80, max: 120, maxDecoboardXp: 150 },
  },
  // Schübe: exakt die Baumstruktur der Drehtüren (laut Doku).
  { id: 'schuebe', label: 'Schübe', styleLines: drehStyleLines },
  // Klappen (Phase 9b) – Stil-Linien wie Drehtüren; bei Kleiderschränken ausgeblendet.
  { id: 'stauraumklappe', label: 'Stauraumklappe', styleLines: drehStyleLines, maxHeightCm: 45, nichtBeiKleiderschrank: true },
  { id: 'hochstellklappe', label: 'Hochstellklappe', styleLines: drehStyleLines, nichtBeiKleiderschrank: true },
  { id: 'schreibklappe', label: 'Schreibklappe', styleLines: drehStyleLines, maxHeightCm: 45, nichtBeiKleiderschrank: true },
  // Offen (Regal): kein Material/Front – nur Kennzeichnung & Maße.
  { id: 'offen', label: 'Offen (Regal)', styleLines: [] },
]

/** Produktgruppe, für die die Klappen entfallen (Überarbeitung 3). */
export const KLEIDERSCHRANK_GROUP_ID = 'kleiderschraenke'

export function getFrontType(id: string | undefined): FrontType | undefined {
  return id ? frontTypes.find((type) => type.id === id) : undefined
}

/**
 * Front-Typen, die für die aktuelle Serie/Produktgruppe anbietbar sind.
 * Zweiläufige Schiebetür nur bei Refugium, einläufige Schiebetür dort gar nicht (7.11);
 * Klappen entfallen bei Kleiderschränken (Überarbeitung 3).
 */
export function getAvailableFrontTypes(
  seriesId: string | undefined,
  productGroupId?: string,
): FrontType[] {
  const istRefugium = seriesId === 'refugium'
  const istKleiderschrank = productGroupId === KLEIDERSCHRANK_GROUP_ID
  return frontTypes.filter((type) => {
    if (type.refugiumOnly && !istRefugium) return false
    if (type.nichtBeiRefugium && istRefugium) return false
    if (type.nichtBeiKleiderschrank && istKleiderschrank) return false
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

/**
 * Options-IDs, die diese Stil-Linie in einer Materialgruppe nicht anbietet (Line-Gläser).
 * Eine Quelle für Dropdown, Aufkantung und Validierung.
 */
export function ausgeschlosseneOptionIds(styleLine: FrontStyleLine | undefined, groupId: string | undefined): string[] {
  if (!styleLine?.ausgeschlosseneOptionen || !groupId) return []
  return styleLine.ausgeschlosseneOptionen[groupId] ?? []
}
