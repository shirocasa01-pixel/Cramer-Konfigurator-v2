/**
 * ZENTRALER AUSSTATTUNGS-KATALOG (Refugium – Schritte 6 & 8).
 *
 * Datengetriebene Einzelquelle für:
 *   • Schritt 6 „Ausstattung-Vorauswahl" – Häkchen-Liste (kategorisiert).
 *   • Schritt 8 „Ausstattung hinter Fronten" – je Segment werden ausschließlich die
 *     in Schritt 6 vorausgewählten Optionen angeboten; die jeweils passenden
 *     Detailfelder (Menge, Höhe „ca.", Variante, Position, lfm, Rauchglas-Deckplatte …)
 *     ergeben sich aus `detailFields`/`variants`.
 *
 * Quelle: Fachberater-PDF „Cramer Planer.pdf" S. 13 (Vorauswahl) und S. 21–25 (Detail).
 * Bewusst OHNE Preislogik (Kategorie B / manueller VK-Preis) – reine Erfassungsstruktur,
 * koordinaten-/JSON-fähig für spätere Supabase-Anbindung & 2D/3D-Visualisierung.
 */

/** Front-Typen, hinter denen überhaupt Ausstattung möglich ist (S. 21). */
export const EQUIPMENT_ELIGIBLE_FRONT_TYPES = ['drehtuer', 'schiebetuer-zwei', 'offen'] as const

/** Detailfeld-Typen, die eine Ausstattungs-Option in Schritt 8 einblenden kann. */
export type EquipmentDetailField =
  | 'qty' // Anzahl (Stepper)
  | 'height' // Höhe (Freitext, per Konvention „ca.")
  | 'position' // Position (Freitext, z. B. „links, oben")
  | 'format' // Format (Freitext, z. B. „40 × 120 cm")
  | 'lfm' // Laufmeter (Verblendung – für Kalkulation)
  | 'rauchglas' // Aufpreis: Deckplatte in Rauchglas (Container)
  | 'note' // Allgemeine Notiz (Freitext)

export interface EquipmentVariant {
  value: string
  label: string
}

export interface EquipmentOption {
  id: string
  label: string
  /** Schritt 6: standardmäßig vorausgewählt (abwählbar). */
  defaultSelected?: boolean
  /**
   * Bei Sondertiefe (Korpustiefe < 60 cm) verfügbar. Regel S. 5: „Bei Sondertiefen
   * sollen als Ausstattung nur Einlegeböden möglich sein!" → nur Einlegeboden = true.
   */
  availableInSondertiefe?: boolean
  /**
   * Schritt 8: nur hinter diesen Front-Typen anbieten (Teilmenge der eligiblen Typen).
   * `undefined` ⇒ hinter allen eligiblen Front-Typen. (z. B. Innenspiegel nur Drehtür.)
   */
  frontTypes?: string[]
  /** Schritt 8: einzublendende Detailfelder. */
  detailFields?: EquipmentDetailField[]
  /** Schritt 8: Varianten-Auswahl (Chips), z. B. Container-Höhen/Modelle. */
  variants?: EquipmentVariant[]
  /** Label über der Varianten-Auswahl. */
  variantLabel?: string
  /** Kurzer Hinweis (Schritt 6 & 8). */
  hint?: string
}

export interface EquipmentCategory {
  id: string
  label: string
  options: EquipmentOption[]
}

// --- Varianten-Bausteine -------------------------------------------------------
const CONTAINER_RASTER: EquipmentVariant[] = [
  { value: '3R', label: '3 Raster' },
  { value: '4,5R', label: '4,5 Raster' },
  { value: '6R', label: '6 Raster' },
  { value: '7,5R', label: '7,5 Raster' },
]
const SCHUBLADE_RASTER: EquipmentVariant[] = [
  { value: '1R', label: '1 Raster' },
  { value: '1,5R', label: '1,5 Raster' },
  { value: '2R', label: '2 Raster' },
]
const CRAFT_MODELLE: EquipmentVariant[] = [
  { value: 'A', label: 'Craft A' },
  { value: 'B', label: 'Craft B' },
  { value: 'C', label: 'Craft C' },
]
const CONERO_MODELLE: EquipmentVariant[] = [
  { value: 'A', label: 'Conero A' },
  { value: 'B', label: 'Conero B' },
  { value: 'C', label: 'Conero C' },
  { value: 'D', label: 'Conero D' },
  { value: 'E', label: 'Conero E' },
  { value: 'F', label: 'Conero F' },
  { value: 'G', label: 'Conero G (nur 100er)' },
  { value: 'H', label: 'Conero H (nur 100er)' },
]
const KORPUSBREITE: EquipmentVariant[] = [
  { value: '50er', label: '50er Korpus' },
  { value: '60er', label: '60er Korpus' },
  { value: '100er', label: '100er Korpus' },
]

/**
 * Kategorien & Optionen (S. 13). Die beiden Einlegeboden-Essentials sind standardmäßig
 * vorausgewählt (abwählbar); nur der einfache Einlegeboden ist bei Sondertiefe verfügbar.
 */
export const equipmentCategories: EquipmentCategory[] = [
  {
    id: 'essentials',
    label: 'Essentials',
    options: [
      {
        id: 'einlegeboden',
        label: 'Einlegeboden',
        defaultSelected: true,
        availableInSondertiefe: true,
        detailFields: ['qty', 'height'],
        hint: 'Standardmäßig ausgewählt, abwählbar.',
      },
      {
        id: 'einlegeboden-kleiderstange',
        label: 'Einlegeboden inkl. Kleiderstange',
        defaultSelected: true,
        detailFields: ['qty', 'height'],
        hint: 'Standardmäßig ausgewählt, abwählbar.',
      },
      {
        id: 'container',
        label: 'Container',
        variants: CONTAINER_RASTER,
        variantLabel: 'Container-Höhe',
        detailFields: ['height', 'rauchglas', 'note'],
        hint: 'Am Schrankboden aufgesetzt; Breite an Korpusbreite; Material wie Innenkorpus.',
      },
      { id: 'rollboden', label: 'Rollboden', detailFields: ['qty', 'height'], hint: 'Material wie Innenkorpus.' },
      {
        id: 'innenschublade',
        label: 'Innenschublade',
        variants: SCHUBLADE_RASTER,
        variantLabel: 'Höhe (Raster)',
        detailFields: ['qty', 'height'],
        hint: 'An Korpusbreite angepasst; statt Griff 3 cm Spalt zum Greifen.',
      },
      { id: 'rollkorb', label: 'Rollkorb', detailFields: ['qty', 'note'], hint: 'Fix; Material wie Innenkorpus.' },
      {
        id: 'innenspiegel-drehtuer',
        label: 'Innenspiegel für Drehtür',
        frontTypes: ['drehtuer'],
        detailFields: ['format', 'note'],
        hint: 'Format 40 × 120 cm; gewünschte Drehtür bzw. Sonderformat angeben.',
      },
      { id: 'kleiderlift', label: 'Kleiderlift', detailFields: ['qty'], hint: 'Fix.' },
      { id: 'glasboden', label: 'Glasboden', detailFields: ['qty', 'height'] },
      { id: 'krawattenspange', label: 'Krawattenspange', detailFields: ['qty', 'position'] },
      { id: 'kleiderbuegelhalter', label: 'Kleiderbügelhalter ausziehbar', detailFields: ['qty', 'position'] },
      { id: 'revisionsklappe', label: 'Revisionsklappe', detailFields: ['format', 'position'] },
      { id: 'rueckwandausschnitt', label: 'Rückwandausschnitt', detailFields: ['format', 'position'] },
    ],
  },
  {
    id: 'verblendung',
    label: 'Verblendung',
    options: [
      {
        id: 'verblendung-korpusbuendig',
        label: 'Verblendung korpusbündig',
        detailFields: ['lfm', 'position'],
        hint: 'Bei Schiebetürschrank nur seitlich möglich. Lfm für Kalkulation angeben.',
      },
      {
        id: 'verblendung-frontbuendig',
        label: 'Verblendung frontbündig',
        detailFields: ['lfm', 'position'],
        hint: 'Bei Schiebetürschrank nur seitlich möglich. Lfm für Kalkulation angeben.',
      },
    ],
  },
  {
    id: 'beleuchtung',
    label: 'Beleuchtung',
    options: [
      { id: 'led-syncro', label: 'LED-Syncro', detailFields: ['qty', 'position'] },
      {
        id: 'led-band-aluprofil',
        label: 'LED-Band Aluprofil',
        detailFields: ['qty', 'position'],
        hint: 'Seiten werden aufgedoppelt (2 statt 1) – reduziert die Lichtbreite.',
      },
    ],
  },
  {
    id: 'craft',
    label: 'Ausstattung-Craft',
    options: [
      {
        id: 'container-craft',
        label: 'Container Craft',
        variants: CRAFT_MODELLE,
        variantLabel: 'Craft-Modell',
        detailFields: ['rauchglas', 'note'],
        hint: 'Am Boden aufgesetzt; Breite an Korpusbreite; Material wie Innenkorpus.',
      },
      { id: 'schubladenunterteilung-craft', label: 'Schubladenunterteilung Craft', detailFields: ['qty'] },
      { id: 'hemdeinsatz-craft', label: 'Hemdeinsatz Craft', detailFields: ['qty'] },
      {
        id: 'rollboden-schuhablage-craft',
        label: 'Rollboden mit Schuhablage Craft',
        variants: KORPUSBREITE,
        variantLabel: 'Korpusbreite',
        detailFields: ['position'],
      },
    ],
  },
  {
    id: 'conero',
    label: 'Ausstattung-Conero',
    options: [
      {
        id: 'container-conero',
        label: 'Container Conero',
        variants: CONERO_MODELLE,
        variantLabel: 'Conero-Modell',
        detailFields: ['rauchglas', 'note'],
        hint: 'Am Boden aufgesetzt; Material wie Innenkorpus. Modelle G/H nur für 100er Korpus.',
      },
      { id: 'kleiderlift-conero', label: 'Kleiderlift Conero', detailFields: ['qty'] },
      { id: 'guertel-krawattenauszug-conero', label: 'Gürtel-/Krawattenauszug Conero', detailFields: ['qty'] },
      { id: 'schuhablage-conero', label: 'Schuhablage Conero', detailFields: ['qty'] },
    ],
  },
]

// --- Abgeleitete Nachschlage-Helfer -------------------------------------------
const OPTION_INDEX: Map<string, EquipmentOption> = new Map(
  equipmentCategories.flatMap((cat) => cat.options.map((opt) => [opt.id, opt])),
)
const CATEGORY_OF: Map<string, EquipmentCategory> = new Map(
  equipmentCategories.flatMap((cat) => cat.options.map((opt) => [opt.id, cat])),
)

export function getEquipmentOption(id: string | undefined): EquipmentOption | undefined {
  return id ? OPTION_INDEX.get(id) : undefined
}

export function getEquipmentCategoryOf(id: string | undefined): EquipmentCategory | undefined {
  return id ? CATEGORY_OF.get(id) : undefined
}

/** IDs der standardmäßig vorausgewählten Essentials (Schritt-6-Startzustand). */
export function defaultSelectedEquipmentIds(): string[] {
  return equipmentCategories.flatMap((cat) => cat.options.filter((o) => o.defaultSelected).map((o) => o.id))
}

/** Ist eine Option bei Sondertiefe zulässig? (Nur einfache Einlegeböden.) */
export function isEquipmentAvailableInSondertiefe(id: string): boolean {
  return Boolean(getEquipmentOption(id)?.availableInSondertiefe)
}
