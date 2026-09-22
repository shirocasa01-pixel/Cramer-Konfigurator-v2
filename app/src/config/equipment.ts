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
  | 'position' // Position (Freitext, z. B. „links, oben")
  | 'format' // Format (Freitext, z. B. „40 × 120 cm")
  | 'lfm' // Laufmeter (Verblendung – für Kalkulation)
  | 'rauchglas' // Aufpreis: Deckplatte in Rauchglas (Container)
  | 'note' // Allgemeine Notiz (Freitext)

export interface EquipmentVariant {
  value: string
  label: string
}

// ---------------------------------------------------------------------------
// Überarbeitung 2_2 — Höhen, Abhängigkeiten und Grenzen als DATEN
// ---------------------------------------------------------------------------

/**
 * Wie die Einbauhöhe eines Ausstattungsteils erfasst wird.
 *
 * Fachberater: „Die Verkäufer sollten die Höhen bei der Ausstattung standardmäßig in
 * Rastern auswählen. Angabe in cm soll nur der Ausnahmefall sein. Das macht die Planung
 * in der AV einfacher." Deshalb ist `raster` der Regelfall und cm die abwählbare Ausnahme.
 */
export type EquipmentHeightMode =
  /** Kein Höhenfeld — z. B. Container: steht immer am Schrankboden. */
  | 'keine'
  /** Rasterstufe (Regelfall) oder abweichend Zentimeter. */
  | 'raster'
  /** Wie `raster`, zusätzlich „am Korpusboden" als eigene Stufe. */
  | 'raster-oder-boden'

/**
 * Eine benannte Zusatz-Auswahl einer Option (Dropdown). Bewusst generisch: Kleiderstangen-
 * Oberfläche, Glasart und Montageseite unterscheiden sich nur in ihren Werten, nicht im
 * Verhalten — als eigene Felder wären das drei Sonderfälle im Rendering.
 */
export interface EquipmentChoice {
  /** Schlüssel in `SegmentEquipmentItem.choices`. */
  id: string
  label: string
  options: EquipmentVariant[]
  /** Vorauswahl (z. B. Kleiderstange „Chrom"). */
  standard?: string
  /** Bei dieser Auswahl zusätzlich ein Freitextfeld einblenden (z. B. „Wunschbreite"). */
  freitextBei?: { wert: string; label: string; platzhalter: string }
}

/**
 * Bezug auf ein anderes, im selben Segment konfiguriertes Ausstattungsteil.
 *
 * Fachberater zur Schubladenunterteilung: „Es muß immer gewählt werden für welche
 * Schublade die Unterteilung gedacht ist. Nur dann kann sie richtig montiert werden."
 * Dasselbe Muster beim Hemdeinsatz („auf welchen Einlegeboden").
 */
export interface EquipmentBezug {
  /** Options-IDs, die als Bezugsziel in Frage kommen. */
  optionIds: string[]
  label: string
  /** Ohne Bezugsziel im Segment ist die Option gar nicht wählbar. */
  pflicht?: boolean
}

export interface EquipmentOption {
  id: string
  label: string
  /** Schritt 6: standardmäßig vorausgewählt (abwählbar). */
  defaultSelected?: boolean
  /**
   * Bei Sondertiefe (Korpustiefe < 60 cm) verfügbar. Ursprünglich (S. 5) nur der
   * Einlegeboden; Überarbeitung 8, S. 1 erweitert die Liste: „Folgende Innenausstattungen
   * sind bei Sondertiefe doch auch möglich: Einlegeboden, LED-Syncro Licht, LED Band
   * Beleuchtung im Aluprofil, Glasboden, Rückwandausschnitt, Innenspiegel für Drehtür,
   * Krawattenspange, Kleiderbügel ausziehbar, Revisionsklappe." Die Regel steht damit je
   * Artikel hier — die Sondertiefe sperrt die Ausstattung nicht pauschal.
   */
  availableInSondertiefe?: boolean
  /**
   * Welche Raster das Teil im Korpus belegt (Überarbeitung 8, S. 5 — keine zwei Teile auf
   * derselben Position). Ausgewertet in `lib/rasterBelegung.ts`:
   *   'punkt'     genau die gewählte Einbauhöhe (Böden, Rollkorb …),
   *   'variante'  so viele Raster, wie die Variante hoch ist (Container „6R", Schublade
   *               „1,5R") — ab der Einbauhöhe bzw. ab Raster 1, wenn das Teil am Boden steht.
   * Ohne Angabe belegt das Teil keine Bodenposition (seitlich montierte Auszüge …).
   */
  rasterBelegung?: 'punkt' | 'variante'
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

  // --- Überarbeitung 2_2: Regeln als Daten, nicht als Sonderfälle im Code ---
  /** Höhenerfassung; `undefined` ⇒ keine Höhe. */
  heightMode?: EquipmentHeightMode
  /**
   * Höhe JE STÜCK statt einmal für alle. Fachberater zum Einlegeboden: „Je Einlegeboden
   * muss 1x die Rasterhöhe ausgewählt werden." Zwei Böden auf derselben Höhe gibt es nicht.
   */
  heightPerPiece?: boolean
  /** Zusätzliche Auswahlfelder (Kleiderstangen-Oberfläche, Glasart, Montageseite …). */
  choices?: EquipmentChoice[]
  /**
   * Nur bei diesen Korpus-Nennbreiten (cm) lieferbar. Fachberater zum Rollkorb: „Den
   * Rollkorb gibt es nur beim 50er, 60er und 100er Korpus. Da er nicht in Sondergrößen
   * produziert werden können."
   */
  korpusBreitenCm?: number[]
  /** Mindest-Korpusbreite (cm) — „Bei Korpus kleiner 45er ist kein Kleiderlift möglich." */
  minKorpusBreiteCm?: number
  /** Mindest-Frontbreite (cm) — Innenspiegel: „Nicht bei Fronten kleiner als 47 cm." */
  minFrontBreiteCm?: number
  /** Höchstzahl im Segment — „Je Korpus ist nur 1 Kleiderlift möglich." */
  maxProKorpus?: number
  /** Obergrenze des Anzahl-Steppers. */
  maxAnzahl?: number
  /** Platzhalter des Positions-Freitextes. */
  positionPlaceholder?: string
  /** Platzhalter des Format-Freitextes. */
  formatPlaceholder?: string
  /**
   * Vorbelegung des Format-Freitextes. Überarbeitung 6, S. 5 (Innenspiegel):
   * „Standardformat 40x120cm sollte vorausgefüllt sein. Kann vom Verkäufer überschrieben
   * werden. Aber wenn er nichts einträgt soll 40x120 übernommen werden." Deshalb wird der
   * Wert beim Anlegen gesetzt UND bei leerem Feld als Standard ausgewiesen.
   */
  formatStandard?: string
  /** Platzhalter des Notiz-Freitextes; sonst der allgemeine Platzhalter. */
  notePlaceholder?: string
  /**
   * Position als Kästchen statt Freitext. Fachberater: „Ich finde es immer gut, wenn wenig
   * geschrieben werden muß. Daher würde ich 3 Kästchen zum anhaken vorgeben:
   * Links & rechts | links | rechts."
   */
  positionSeiten?: boolean
  /** Bezug auf ein anderes Ausstattungsteil desselben Segments. */
  bezug?: EquipmentBezug
  /**
   * Der Preis ergibt sich aus der Korpusbreite — es gibt deshalb KEINE manuelle
   * Breiten-/Variantenwahl. Fachberater: „Der richtige Preis wird automatisch durch die
   * Korpusbreite ermittelt."
   */
  preisAusKorpusbreite?: boolean
  /**
   * Beleuchtung mit Kabelführung hinter der Rückwand. Überarbeitung 8, S. 1: „Sobald bei der
   * Ausstattung eine Beleuchtung (LED-Band oder Syncro-Licht) gewählt wird, erhöht sich die
   * Tiefe um + 1 cm." Die Zugabe selbst steht in „50 Meta" (`beleuchtungTiefenzugabeMm`).
   */
  beleuchtung?: boolean
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
// --- Zusatz-Auswahlen (Überarbeitung 2_2) --------------------------------------
/** „Hier muss noch abgefragt werden, ob die Kleiderstange in Chrom oder schwarz …
    Beides ist preisgleich. Standardmäßig soll Chrom vorausgewählt sein." */
const KLEIDERSTANGE_AUSFUEHRUNG: EquipmentChoice = {
  id: 'stangenAusfuehrung',
  label: 'Kleiderstange – Ausführung',
  standard: 'chrom',
  options: [
    { value: 'chrom', label: 'Chrom' },
    { value: 'schwarz', label: 'Schwarz' },
  ],
}

/** „Hier soll abgefragt werden welches Glas verwendet werden soll?" */
const GLASART: EquipmentChoice = {
  id: 'glasart',
  label: 'Glasart',
  options: [
    { value: 'klarglas', label: 'Klarglas' },
    { value: 'rauchglas-grau', label: 'Rauchglas – grau' },
    { value: 'rauchglas-dark-grey', label: 'Rauchglas – dark grey' },
  ],
}

/** „Montage an der linken oder rechten Korpusseite?" */
const MONTAGESEITE: EquipmentChoice = {
  id: 'montageseite',
  label: 'Montageseite',
  options: [
    { value: 'links', label: 'linke Korpusseite' },
    { value: 'rechts', label: 'rechte Korpusseite' },
  ],
}

/** „Breite an Korpusbreite angepasst oder gibt es eine Wunschbreite?" */
const BREITE_ANPASSUNG: EquipmentChoice = {
  id: 'breite',
  label: 'Breite',
  standard: 'korpusbreite',
  options: [
    { value: 'korpusbreite', label: 'an Korpusbreite angepasst' },
    { value: 'wunsch', label: 'Wunschbreite' },
  ],
  freitextBei: { wert: 'wunsch', label: 'Wunschbreite (cm)', platzhalter: 'z. B. 48' },
}

/** Korpus-Nennbreiten, in denen der Rollkorb gefertigt wird (keine Sondergrößen). */
const ROLLKORB_BREITEN_CM = [50, 60, 100]

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
        detailFields: ['qty'],
        heightMode: 'raster',
        heightPerPiece: true,
        rasterBelegung: 'punkt',
        hint: 'Standardmäßig ausgewählt, abwählbar. Je Boden eine eigene Rasterhöhe. Material wie Korpus innen.',
      },
      {
        id: 'einlegeboden-kleiderstange',
        label: 'Einlegeboden inkl. Kleiderstange',
        defaultSelected: true,
        detailFields: ['qty'],
        heightMode: 'raster',
        heightPerPiece: true,
        rasterBelegung: 'punkt',
        choices: [KLEIDERSTANGE_AUSFUEHRUNG],
        hint: 'Standardmäßig ausgewählt, abwählbar. Boden im Material des Korpus innen; Chrom und Schwarz sind preisgleich.',
      },
      {
        id: 'container',
        label: 'Container',
        variants: CONTAINER_RASTER,
        variantLabel: 'Container-Höhe',
        // Keine Höhenabfrage: „Container stehen immer am Schrankboden."
        heightMode: 'keine',
        rasterBelegung: 'variante',
        detailFields: ['rauchglas', 'note'],
        hint: 'Steht immer am Schrankboden; Breite an Korpusbreite; Material wie Innenkorpus.',
      },
      {
        // Überarbeitung 6, S. 2: „Beim Rollboden muss auch für jeden der 4 Böden (Anzahl)
        // eine eigene Höhe definiert werden. So wie bei den Einlegeböden."
        id: 'rollboden',
        label: 'Rollboden',
        detailFields: ['qty'],
        heightMode: 'raster-oder-boden',
        heightPerPiece: true,
        rasterBelegung: 'punkt',
        hint: 'Material wie Innenkorpus. Je Boden eine eigene Einbauhöhe.',
      },
      {
        // Überarbeitung 6, S. 3: „Bei mehreren Innenschubladen müssen wir auch die Position
        // der 2., 3. oder 4. Schublade definieren können."
        id: 'innenschublade',
        label: 'Innenschublade',
        variants: SCHUBLADE_RASTER,
        variantLabel: 'Schubladenhöhe (Raster)',
        detailFields: ['qty'],
        heightMode: 'raster-oder-boden',
        heightPerPiece: true,
        rasterBelegung: 'variante',
        hint: 'An Korpusbreite angepasst; statt Griff 3 cm Spalt zum Greifen. Je Schublade eine eigene Einbauhöhe.',
      },
      {
        // Überarbeitung 6, S. 4: Position je Rollkorb definierbar; das Notizfeld ist
        // ausdrücklich gestrichen („Notiz ist nicht notwendig").
        id: 'rollkorb',
        label: 'Rollkorb',
        detailFields: ['qty'],
        heightMode: 'raster-oder-boden',
        heightPerPiece: true,
        rasterBelegung: 'punkt',
        korpusBreitenCm: ROLLKORB_BREITEN_CM,
        hint: 'Nur im 50er, 60er und 100er Korpus — er wird nicht in Sondergrößen gefertigt. Je Korb eine eigene Einbauhöhe.',
      },
      {
        id: 'innenspiegel-drehtuer',
        label: 'Innenspiegel für Drehtür',
        availableInSondertiefe: true,
        frontTypes: ['drehtuer'],
        detailFields: ['format', 'note'],
        // Überarbeitung 6, S. 5: Standardformat vorbelegen, Notizfeld fragt nach der Position.
        formatStandard: '40 × 120 cm',
        formatPlaceholder: '40 × 120 cm',
        notePlaceholder: 'z. B. genaue Position',
        hint: 'Format 40 × 120 cm; gewünschte Drehtür bzw. Sonderformat angeben.',
      },
      {
        id: 'kleiderlift',
        label: 'Kleiderlift',
        minKorpusBreiteCm: 45,
        maxProKorpus: 1,
        hint: 'Je Korpus nur einer; erst ab 45er Korpus möglich.',
      },
      {
        // Überarbeitung 6, S. 5: „Bei mehreren Glasböden müssen wir auch die Position der
        // 2., 3. oder 4. Glasboden definieren."
        id: 'glasboden',
        label: 'Glasboden',
        availableInSondertiefe: true,
        detailFields: ['qty'],
        heightMode: 'raster',
        heightPerPiece: true,
        rasterBelegung: 'punkt',
        choices: [GLASART],
        hint: 'Je Boden eine eigene Einbauhöhe.',
      },
      {
        // Die 47-cm-Regel steht im PDF unter DIESER Kachel, nicht unter dem Innenspiegel.
        id: 'krawattenspange',
        label: 'Krawattenspange',
        availableInSondertiefe: true,
        detailFields: ['qty', 'position'],
        minFrontBreiteCm: 47,
        // Überarbeitung 6, S. 6: Die Position wird als Höhe angegeben.
        positionPlaceholder: 'z. B. Höhe',
        hint: 'Nicht bei Fronten unter 47 cm.',
      },
      {
        id: 'kleiderbuegelhalter',
        label: 'Kleiderbügelhalter ausziehbar',
        availableInSondertiefe: true,
        detailFields: ['qty', 'position'],
        heightMode: 'raster',
        positionPlaceholder: 'z. B. rechts',
      },
      {
        // Format + Position als Freitext — die Vorlage zeigt hier weder Rasterhöhe
        // noch Seiten-Kästchen, nur einen genaueren Platzhalter für die Position.
        // Überarbeitung 6, S. 6: „Anzahl der Revisionsklappen … abfragen."
        id: 'revisionsklappe',
        label: 'Revisionsklappe',
        availableInSondertiefe: true,
        detailFields: ['qty', 'format', 'position'],
        formatPlaceholder: 'z. B. 40 × 20 cm',
        positionPlaceholder: 'z. B. genaue Angabe der Position',
      },
      {
        // Überarbeitung 6, S. 6: „… und Anzahl der Rückwandausschnitte abfragen."
        id: 'rueckwandausschnitt',
        label: 'Rückwandausschnitt',
        availableInSondertiefe: true,
        detailFields: ['qty', 'format', 'position'],
        formatPlaceholder: 'z. B. 40 × 20 cm',
        positionPlaceholder: 'z. B. genaue Angabe der Position',
      },
    ],
  },
  // Die Kategorie „Verblendung" ist mit Überarbeitung 6 (S. 7) aus der Ausstattung
  // entfallen: „Bitte diese Abfrage bei Ausstattung rausnehmen. Die Verblendung soll
  // unter ‚3. Maße' zwischen ‚Fußleistenausschnitt' und ‚Abschlusset' eingefügt werden."
  // Sie wird dort als EINE Auswahl je Möbel erfasst (`KorpusGrunddaten.verblendung`),
  // korpusbündig ODER frontbündig — beides zusammen gibt es nicht.
  {
    id: 'beleuchtung',
    label: 'Beleuchtung',
    options: [
      {
        id: 'led-syncro',
        label: 'LED-Syncro',
        availableInSondertiefe: true,
        beleuchtung: true,
        // In der Vorlage sind ANZAHL und POSITION beide gestrichen: „Positionsabfrage
        // braucht es nicht. Wird immer am Korpusdeckel montiert." und „Anzahl gibt es
        // nicht. Der Preis leitet sich vom Korpus ab."
        hint: 'Wird immer am Korpusdeckel montiert; der Preis ergibt sich aus dem Korpus.',
      },
      {
        id: 'led-band-aluprofil',
        label: 'LED-Band Aluprofil',
        availableInSondertiefe: true,
        beleuchtung: true,
        // „Anzahl gibt es nicht. Der Preis leitet sich vom Korpus ab."
        positionSeiten: true,
        // Überarbeitung 6, S. 8: „Wenn links + rechts ausgewählt wird, muss VK mal 2
        // gerechnet werden. Da links und rechts ein LED-Band verbaut wird."
        hint: 'Preis ergibt sich aus der Korpushöhe – keine Stückzahl. Bei „Links & rechts" wird der Preis je Schrankseite gerechnet, also doppelt.',
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
        // Überarbeitung 6, S. 9: „Dieses Notizfeld kann gelöscht werden."
        detailFields: ['rauchglas'],
        hint: 'Am Boden aufgesetzt; Breite an Korpusbreite; Material wie Innenkorpus.',
      },
      {
        id: 'schubladenunterteilung-craft',
        label: 'Schubladenunterteilung Craft',
        detailFields: ['qty'],
        // „Darf sich nur auswählen lassen, wenn es Schubladen (Container oder
        // Innenschubladen) im Schrank gibt. Es muß immer gewählt werden, für welche
        // Schublade die Unterteilung gedacht ist."
        bezug: {
          optionIds: ['container', 'innenschublade', 'container-craft', 'container-conero'],
          label: 'Für welche Schublade?',
          pflicht: true,
        },
      },
      {
        id: 'hemdeinsatz-craft',
        label: 'Hemdeinsatz Craft',
        detailFields: ['qty'],
        // „Hier muß abgefragt werden, auf welchen Einlegeboden der Hemdeinsatz gestellt
        // werden soll." Der Preis kommt aus der Korpusbreite.
        bezug: {
          optionIds: ['einlegeboden', 'einlegeboden-kleiderstange', 'glasboden'],
          label: 'Auf welchen Einlegeboden?',
          pflicht: true,
        },
        preisAusKorpusbreite: true,
      },
      {
        id: 'rollboden-schuhablage-craft',
        label: 'Rollboden mit Schuhablage Craft',
        rasterBelegung: 'punkt',
        // Keine manuelle Korpusbreiten-Variante mehr: „Der richtige Preis wird automatisch
        // durch die Korpusbreite ermittelt."
        preisAusKorpusbreite: true,
        heightMode: 'raster-oder-boden',
        // Überarbeitung 6, S. 10: „Benötigte Anzahl?" — der Preis ist ein Stückpreis.
        detailFields: ['qty', 'position'],
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
        // Überarbeitung 6, S. 11: „Notiz + Einbauhöhe löschen. Steht immer am Boden."
        detailFields: ['rauchglas'],
        heightMode: 'keine',
        hint: 'Steht immer am Schrankboden. Material wie Innenkorpus. Modelle G/H nur für 100er Korpus.',
      },
      {
        id: 'kleiderlift-conero',
        label: 'Kleiderlift Conero',
        maxProKorpus: 1,
        hint: 'Je Korpus ist immer nur ein Kleiderlift möglich.',
      },
      {
        id: 'guertel-krawattenauszug-conero',
        label: 'Gürtel-/Krawattenauszug Conero',
        detailFields: ['qty'],
        heightMode: 'raster',
        choices: [MONTAGESEITE],
      },
      {
        id: 'schuhablage-conero',
        label: 'Schuhablage Conero',
        detailFields: ['qty'],
        choices: [BREITE_ANPASSUNG],
      },
    ],
  },
]

/**
 * AUS DEM KATALOG GENOMMENE OPTIONEN — nur für Klartext in Meldungen.
 *
 * Entwürfe, die vor der Umstellung gespeichert wurden, tragen diese IDs weiterhin. Sie
 * werden nicht mehr bepreist; die Kalkulation sagt aber, was weggefallen ist und wohin
 * es gewandert ist. Ohne diese Tabelle stünde dort die nackte ID.
 */
export const AUSGELAUFENE_AUSSTATTUNG: Record<string, string> = {
  'verblendung-korpusbuendig': 'Verblendung korpusbündig (jetzt im Schritt „Maße")',
  'verblendung-frontbuendig': 'Verblendung frontbündig (jetzt im Schritt „Maße")',
}

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

/** Anzeigename einer Option — auch für inzwischen entfallene IDs. */
export function equipmentAnzeigename(id: string): string {
  return OPTION_INDEX.get(id)?.label ?? AUSGELAUFENE_AUSSTATTUNG[id] ?? id
}

export function getEquipmentCategoryOf(id: string | undefined): EquipmentCategory | undefined {
  return id ? CATEGORY_OF.get(id) : undefined
}

/** IDs der standardmäßig vorausgewählten Essentials (Schritt-6-Startzustand). */
export function defaultSelectedEquipmentIds(): string[] {
  return equipmentCategories.flatMap((cat) => cat.options.filter((o) => o.defaultSelected).map((o) => o.id))
}

/** Ist eine Option bei Sondertiefe zulässig? (Liste aus Überarbeitung 8, S. 1.) */
export function isEquipmentAvailableInSondertiefe(id: string): boolean {
  return Boolean(getEquipmentOption(id)?.availableInSondertiefe)
}

// ---------------------------------------------------------------------------
// Regelauswertung (Überarbeitung 2_2)
// ---------------------------------------------------------------------------

/** Maße des Segments, gegen die die Katalog-Regeln geprüft werden. */
export interface SegmentMasse {
  /** Korpus-Nennbreite (cm) — Schlüssel für Rollkorb, Kleiderlift, Preisableitung. */
  korpusBreiteCm?: number
  /** Schmalste Front des Segments (cm) — Schlüssel für den Innenspiegel. */
  frontBreiteCm?: number
  /** Rasterstufe des Korpus — begrenzt die wählbaren Einbau-Raster. */
  korpusRaster?: number
}

/**
 * Warum eine Option in diesem Segment nicht wählbar ist — oder `null`, wenn sie es ist.
 *
 * Bewusst ein KLARTEXT statt eines booleschen Werts: Der Verkäufer soll im Kundengespräch
 * begründen können, warum etwas nicht geht („nicht im 45er Korpus"), statt vor einer
 * kommentarlos fehlenden Zeile zu stehen. Sind die Maße noch unbekannt, wird NICHT
 * gesperrt — eine Regel ohne Datengrundlage darf nichts verbieten.
 */
export function equipmentSperrgrund(
  option: EquipmentOption,
  masse: SegmentMasse,
): string | null {
  const { korpusBreiteCm, frontBreiteCm } = masse
  if (option.korpusBreitenCm && korpusBreiteCm != null && !option.korpusBreitenCm.includes(korpusBreiteCm)) {
    return `Nur im ${option.korpusBreitenCm.map((b) => `${b}er`).join(', ')} Korpus lieferbar (hier: ${korpusBreiteCm}er).`
  }
  if (option.minKorpusBreiteCm != null && korpusBreiteCm != null && korpusBreiteCm < option.minKorpusBreiteCm) {
    return `Erst ab ${option.minKorpusBreiteCm}er Korpus möglich (hier: ${korpusBreiteCm}er).`
  }
  if (option.minFrontBreiteCm != null && frontBreiteCm != null && frontBreiteCm < option.minFrontBreiteCm) {
    return `Nicht bei Fronten unter ${option.minFrontBreiteCm} cm (hier: ${frontBreiteCm} cm).`
  }
  return null
}

/**
 * Größte wählbare Rasterstufe für einen Einbau.
 *
 * Fachberater: „Bei einem Kleiderschrank mit 18 Raster kann der Verkäufer den Boden also
 * zwischen 1 und 17 Raster platzieren (der oberste Raster ist ja immer schon der
 * Korpusdeckel)." Ohne bekannte Korpushöhe gilt der Bereich der Vorlage (1–20).
 */
export const EQUIPMENT_RASTER_MAX_FALLBACK = 20

export function equipmentMaxRaster(korpusRaster: number | undefined): number {
  if (korpusRaster == null || korpusRaster < 2) return EQUIPMENT_RASTER_MAX_FALLBACK
  return korpusRaster - 1
}

/** Standardwerte der Zusatz-Auswahlen einer Option (z. B. Kleiderstange „Chrom"). */
export function equipmentChoiceDefaults(option: EquipmentOption | undefined): Record<string, string> {
  const werte: Record<string, string> = {}
  for (const choice of option?.choices ?? []) {
    if (choice.standard) werte[choice.id] = choice.standard
  }
  return werte
}

/** Ist in der Ausstattungs-Vorauswahl eine Beleuchtung mit Kabelführung gewählt? */
export function hatBeleuchtung(selected: readonly string[] | undefined): boolean {
  return (selected ?? []).some((id) => Boolean(getEquipmentOption(id)?.beleuchtung))
}

/** Klartext der bei Sondertiefe möglichen Optionen — für Hinweis und Modulregel. */
export function sondertiefeOptionenText(): string {
  return equipmentCategories
    .flatMap((cat) => cat.options)
    .filter((o) => o.availableInSondertiefe)
    .map((o) => o.label)
    .join(', ')
}
