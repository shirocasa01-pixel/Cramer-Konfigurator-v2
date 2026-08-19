/** Ein im System hinterlegter Berater (Vertriebsmitarbeiter). */
export interface Consultant {
  id: string
  /** Vollständiger Name – wird ab Phase 2 automatisch als „Berater“ gesetzt. */
  name: string
  email: string
  /** Nur für den Prototyp – niemals so in Produktion (siehe README, Sicherheitshinweis). */
  password: string
}

/** Rolle des angemeldeten Nutzers (Phase 10). */
export type UserRole = 'admin' | 'consultant'

/**
 * Administrator-Konto (Phase 10). Die Struktur trägt bewusst `isRoot` + eine Liste,
 * damit später problemlos mehrere Administratoren angelegt werden können.
 */
export interface Admin {
  id: string
  username: string
  email: string
  /** Nur Prototyp – in Produktion durch Hash/Backend/SSO ersetzen. */
  password: string
  /** true => Systemeigentümer (Root), im Onboarding einmalig eingerichtet. */
  isRoot: boolean
}

/** Anzeige-Repräsentation eines Admins (ohne sensible Felder) fürs Dashboard. */
export type AdminSummary = Pick<Admin, 'id' | 'username' | 'email' | 'isRoot'>

/** Konfigurierbare Regeln der Benutzerverwaltung + Betrieb (Phase 10/11). */
export interface UserSettings {
  /**
   * Produktions-Regel: true => Mitarbeiter-E-Mails müssen auf „@cramer.de“ enden.
   * false (Standard, Testphase) => beliebige Domain erlaubt (interne Freigabe).
   */
  enforceCramerEmail: boolean
  /**
   * Wartungsmodus-Schnellschalter (Admin-Dashboard, gerätelokal). Effektiv aktiv,
   * wenn dieser Wert ODER `appConfig.isMaintenanceMode` (global) true ist.
   */
  maintenanceMode: boolean
}

/** Eingeloggter Nutzer ohne sensible Felder (kein Passwort), inkl. Rolle. */
export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

/**
 * Eine Cramer-Filiale (Branch). Im Dropdown wird ausschließlich `name` angezeigt;
 * die vollständigen Angaben bleiben intern (später für AV-PDF, Angebote, ERP).
 */
export interface Branch {
  id: string
  name: string
  street: string
  postalCode: string
  city: string
  phone?: string
  email?: string
}

/**
 * Preisgruppe laut zentraler Farbmatrix (Kalkulations-Basis PG 1–PG 4).
 * `undefined` bedeutet „noch offen“ (z. B. kundenspezifisches „anders“ ohne Lack-Bezug).
 */
export type PriceGroup = 'PG1' | 'PG2' | 'PG3' | 'PG4'

/** Eine konkrete Material-/Farboption im Dropdown (aus der Farbmatrix). */
export interface MaterialOption {
  id: string
  /** Anzeigetext exakt laut Farbmatrix, inkl. Code, z. B. „Eiche Milano (R20095NW)“. */
  label: string
  /** Überschreibt die Gruppen-Preisgruppe (z. B. Wengé => PG4 in der PG3-Gruppe Furnier). */
  priceGroup?: PriceGroup
  /**
   * Schritt 5: Bei Auswahl dieser Option öffnet sich ein Freitextfeld für die genaue
   * Bezeichnung (z. B. Mattlack-Sonderfarben RAL/NCS/Sikkens, hinterlackierte Gläser).
   * Der Freitext wird in `MaterialSelection.note` gespeichert.
   */
  requiresFreeText?: boolean
  /** Label des Freitextfelds (falls `requiresFreeText`). */
  freeTextLabel?: string
}

/** Eine Materialgruppe (Decoboard, Mattlack, …) mit ihren Optionen. */
export interface MaterialGroup {
  id: string
  label: string
  priceGroup?: PriceGroup
  options: MaterialOption[]
}

/**
 * Eine Material-Auswahl – wiederverwendet in Korpus (Phase 4) und Fronten (Phase 5).
 * Sonderfälle über `materialGroupId`: `'anders'` (Freitext) und `'keine'` (z. B. keine Abdeckplatte).
 */
export interface MaterialSelection {
  materialGroupId: string
  optionId?: string
  /** Freitext – nur bei `materialGroupId === 'anders'`. */
  customText?: string
  /** Automatisch zugewiesene Preisgruppe (Hintergrund; bei „anders“ ggf. offen). */
  priceGroup?: PriceGroup
  /** Kontext-Freitext-Notiz zur Auswahl (Phase B: z. B. Abdeckplatte-Glas-Spezifikation). */
  note?: string
}

// ---------------------------------------------------------------------------
// Phase 5 – Fronten & Abschlüsse (Spalten-/Segment-Modell)
// ---------------------------------------------------------------------------

/** Wert eines Stil-Linien-Feldes (Material + Notiz, oder reiner Freitext). */
export interface FrontFieldValue {
  /** Bei Feldern vom Typ „material“. */
  material?: MaterialSelection
  /** Kurzer Freitext neben dem Material (z. B. RAL). */
  note?: string
  /** Bei Feldern vom Typ „freetext“. */
  text?: string
}

/** Ein einzelnes Front-Bauteil innerhalb einer Front-Typ-Spalte. */
export interface FrontElement {
  id: string
  /** Front-Typ (Verweis auf FrontType.id): schiebetuer | drehtuer | schuebe | offen | *klappe. */
  typeId: string
  /** Kennzeichnung / Position – Pflichtfeld (z. B. „D1“, „S1“, „oben links“). */
  label: string
  /** Feld A – Maße (optional). */
  widthCm?: string
  heightCm?: string
  /** Gewählte Stil-Linie (bei Typen mit Kaskade). */
  styleLineId?: string
  /** Werte der Stil-Linien-Felder (fieldId -> Wert). */
  fieldValues?: Record<string, FrontFieldValue>

  // --- Phase 9b: Griff-Logik (Glatt/Less/Glossy) ---
  /** Push-to-Open aktiv (unabhängig von Griff wählbar). */
  pto?: boolean
  /** Griff aktiv → schaltet die Griff-Auswahl frei. */
  griff?: boolean
  /** Gewählter Griff (Verweis auf handles.ts), nur wenn `griff`. */
  griffId?: string
  /** Einläufige Schiebetür: freie Laufschienenfarbe (z. B. RAL). */
  laufschienenfarbe?: string
  /** Zweiläufige Schiebetür (Refugium): Griffprofil – nur „edge“ | „curve“. */
  griffProfil?: 'edge' | 'curve'
  /**
   * Punkt 7.13: Pulverfarbe des Griffprofils. Freitext, weil es laut Dietmar keine
   * vordefinierte Liste gibt: „Grundsätzlich sind alle RAL-Classic Farben möglich."
   */
  griffProfilFarbe?: string
  /** Phase A: Freitext-Farbe direkt nach der Griffwahl („Farbe nach Griffwahl"). */
  griffFarbe?: string
}

/** Innenausbau „hinter der Front“ eines Segments (v. a. Refugium). */
export interface SegmentInterior {
  /** Anzahl Kleiderstangen. */
  kleiderstangen: number
  /** Böden mit freier Höhenangabe (Freitext, z. B. „auf 120 cm“). */
  boeden: Array<{ id: string; heightNote: string }>
  /** Systemseitige Lochreihe (Standard aktiv, abwählbar). */
  lochreihe: boolean
}

/**
 * Schritt 8 – ein konkret hinter einer Front konfiguriertes Ausstattungs-Element
 * (Refugium). Verweist auf den zentralen Ausstattungs-Katalog (`config/equipment.ts`);
 * die Detailfelder werden je Katalog-Option eingeblendet. Vollständig JSON-serialisierbar
 * (Supabase-/2D-3D-tauglich); Höhenangaben werden per Konvention als „ca." geführt.
 */
export interface SegmentEquipmentItem {
  /** Instanz-ID (mehrfach pro Segment möglich). */
  id: string
  /** Verweis auf `EquipmentOption.id` (Ausstattungs-Katalog). */
  optionId: string
  /** Menge (bei mengenbasierten Optionen). */
  qty?: number
  /** Gewählte Variante (z. B. Container-Höhe „6R", Conero-Modell „D", Craft „A"). */
  variant?: string
  /** Höhenangabe – Freitext, per Konvention „ca." (z. B. „auf 120 cm"). */
  heightNote?: string
  /** Positionsangabe – Freitext (z. B. „links, oben"). */
  positionNote?: string
  /** Format – Freitext (z. B. Innenspiegel „40 × 120 cm", Sonderformat). */
  formatNote?: string
  /** Laufmeter (Verblendung) – Freitext, für die spätere Kalkulation. */
  lfm?: string
  /** Aufpreis: Deckplatte in Rauchglas (Container). */
  rauchglas?: boolean
  /** Allgemeine Notiz – Freitext. */
  note?: string
}

/** Eine Front-Typ-Spalte = ein physisches Korpus-Segment (von links nach rechts). */
export interface FrontColumn {
  id: string
  elements: FrontElement[]
  /** Innenausbau hinter der Front (Phase 9b, Legacy – durch `equipment` abgelöst). */
  interior?: SegmentInterior
  /**
   * Schritt 8: „Ausstattung hinter Fronten" dieses Segments (Refugium). Nur bei
   * Drehtür / zweiläufiger Schiebetür / Offen sichtbar; angeboten werden ausschließlich
   * die in Schritt 6 (`Draft.ausstattung`) vorausgewählten Optionen.
   */
  equipment?: SegmentEquipmentItem[]
}

/** Abschluss oben (Abschlussplatte). */
export interface AbschlussOben {
  mode: 'wieKorpus' | 'anders'
  /** Nur bei mode === 'anders'. */
  variant?: 'DP' | 'Glas' | 'UK'
  /** Nur bei variant === 'DP'. */
  dpStaerke?: '1cm' | '2cm' | '3cm'
}

export type AbschlussUntenType = 'SO' | 'SSP' | 'KS' | 'UK' | 'KG'

/** Abschluss unten (Sockel / Bodenabschluss) – exklusive Auswahl. */
export interface AbschlussUnten {
  type: AbschlussUntenType
  /** Nur bei type === 'KG' (KG / UK mit Fuß): Freitext für Fuß-Typen/Höhen. */
  footNote?: string
}

/** Gesamter Fronten-Datensatz (Phase 5). */
export interface FrontsData {
  columns: FrontColumn[]
  /** Grifffarbe – falls abweichend (Freitext, gilt für das ganze Möbel). */
  grifffarbe?: string
  abschlussOben?: AbschlussOben
  abschlussUnten?: AbschlussUnten
  /** Sonderausstattung – große Freitext-Notiz (unverändert im PDF). */
  sonderausstattung?: string
  /**
   * Schritt 7 (zweiläufige Schiebetür): Anzahl der Schiebetür-Elemente für den ganzen
   * Schrank. Zulässige Werte hängen von der Korpus-Anzahl ab (2 Korpi → 2, 3 → 3,
   * 4 → 2 oder 4). Nur gesetzt, wenn eine zweiläufige Schiebetür geplant ist (exklusiv).
   */
  schiebetuerAnzahl?: 2 | 3 | 4
}

// ---------------------------------------------------------------------------
// Phase 9 – Gesamtpreis-Modell (Korpus + Aussenset + Fronten + Innen + Upgrades)
// ---------------------------------------------------------------------------

/** Kostengruppe („Bucket") einer Preisposition. */
export type PriceBucket = 'korpus' | 'aussenset' | 'fronten' | 'innen' | 'upgrade'

/**
 * Eine einzelne Preisposition außerhalb der Front-Elemente (Korpus-Segmente,
 * Aussenset, Innenausstattung, Aufpreise). Verweist auf eine Zeile der zentralen
 * Preisliste (`priceRowId`) und wird mit `qty`/Fläche/Länge/Basis multipliziert –
 * je nach Einheit der Preiszeile (Stück, EUR/m², EUR/lfm, %). Die Phase-9-UI
 * erzeugt und pflegt diese Positionen; Demo-/Verifizierungs-Entwürfe seeden sie direkt.
 */
export interface DraftPosition {
  id: string
  bucket: PriceBucket
  /** Klartext-Bezeichnung für Zusammenfassung/PDF. */
  label: string
  /** Verweis auf `priceList.json` (row.id). */
  priceRowId: number
  /** Menge (Stück, Segmente, …). Bei nicht-Stück-Einheiten meist 1. */
  qty: number
  /** Bei Einheit EUR/m²: Fläche in m². */
  areaM2?: number
  /** Bei Einheit EUR/lfm bzw. EUR/lfd.m: Länge in Metern. */
  lengthM?: number
  /** Bei %-Einheiten: Basisbetrag, auf den der Prozentsatz wirkt (z. B. Möbelpreis). */
  percentBase?: number
  /**
   * Bestätigter Stückpreis, der die Preiszeile überschreibt (Betrag = override × qty).
   * Für Fachbereich-bestätigte Sonderpreise, die in der (lückenhaften) Excel-Extraktion
   * nicht als exakte Zeile vorliegen – siehe Verifizierungs-Entwürfe.
   */
  priceOverride?: number
}

// ---------------------------------------------------------------------------
// Phase B – Korpus Innen (Innenausbau) & Rückwand
// ---------------------------------------------------------------------------

/**
 * Innenausbau des Korpus (Phase B) – korpusweit, getrennt von den per-Segment-
 * Angaben „Hinter der Front". Alle Elemente sind optional (Checkbox-gesteuert);
 * die Eingabefelder erscheinen erst bei Aktivierung.
 */
export interface KorpusInnen {
  /** A) Rückwand Innen – an ⇒ Material-/Farbauswahl sichtbar (ohne zweite Sicht-Checkbox). */
  rueckwand: { enabled: boolean; material?: MaterialSelection }
  /** B) Lochreihe – an ⇒ Freitext-Notiz (Position / Anzahl). */
  lochreihe: { enabled: boolean; note?: string }
  /** C) Einlegeböden – an ⇒ „Anzahl Einlegeböden" (Freitext). */
  einlegeboeden: {
    enabled: boolean
    anzahl?: string
    /** D) Kleiderstange – nur unter Einlegeböden; an ⇒ „Menge & Art". */
    kleiderstange: { enabled: boolean; note?: string }
  }
}

// ---------------------------------------------------------------------------
// Schritt 4 – Korpus-Grunddaten (Maß-Raster, koordinatenfähig für 2D/3D)
// ---------------------------------------------------------------------------

/** Eine Korpus-Einheit (von links nach rechts). Breite je Korpus ⇒ koordinatenfähig. */
export interface KorpusEinheit {
  id: string
  /** Breiten-Modus: Standard-Korpus (50/60/100 cm) oder Sondermaß. */
  breiteMode: '50' | '60' | '100' | 'custom'
  /** Bei `breiteMode === 'custom'`: Breite in cm (15–100). */
  breiteCm?: string
  /** Korpus mit Lochreihe? (Standard aktiv.) */
  lochreihe: boolean
}

/**
 * Außen-Abschlussset links/rechts (Schritt 4).
 *
 * Punkt 5.11: Als einziger Bauteil-Bereich trägt das Seitenset die Auswahl „anders"
 * mit Freitext UND Preisgruppe — sonst käme es ohne Preis in die Kalkulation.
 * Fußleistenausschnitt, Sonderformen und Sonderausstattung bekommen das
 * ausdrücklich NICHT (Dietmar zu 5.11).
 */
export interface AbschlussSet {
  position: 'keine' | 'links' | 'rechts' | 'beide'
  /** Material des 10-mm-Abschlusssets (Verweis auf materialMatrix-Gruppen-ID oder `anders`). */
  material?: string
  /** Nur bei `material === 'anders'`: Bezeichnung der Sonderausführung. */
  materialFreitext?: string
  /** Nur bei `material === 'anders'`: manuell gewählte Preisgruppe für die Kalkulation. */
  preisgruppe?: PriceGroup
}

/** Fußleistenausschnitt (Schritt 4) – erhöht die Gesamttiefe. */
export interface Fussleiste {
  enabled: boolean
  hoeheCm?: string
  tiefeCm?: string
}

/**
 * Korpus-Grunddaten (Schritt 4, Refugium) – strukturiert & KOORDINATENFÄHIG:
 * Höhe/Tiefe zentral, Breite je Korpus, Positionen ableitbar (`computeKorpusKoordinaten`).
 * Bewusste Basis für die spätere 2D/3D-Visualisierung. Vollständig JSON-serialisierbar.
 *
 * Punkt 4.7/4.11: Die früheren Fixmaß-Häkchen je Dimension sind entfallen. Was
 * genau einzuhalten ist, schreibt der Berater in `sondermasse` — so, wie er es der
 * AV auch am Telefon sagen würde.
 */
export interface KorpusGrunddaten {
  /** Höhe: 18 Raster (~235 cm) / 21 Raster (~274 cm) / anders (50–274 cm). */
  heightMode: '18R' | '21R' | 'custom'
  heightCm?: string
  /** Tiefe: 60 cm / anders (31–60 cm; Sondertiefe ⇒ nur Einlegeböden als Ausstattung). */
  depthMode: '60' | 'custom'
  depthCm?: string
  /** Korpus-Einheiten von links nach rechts. */
  korpusse: KorpusEinheit[]
  abschlussSet?: AbschlussSet
  fussleiste?: Fussleiste
  /** Sonderformen (Ecklösungen/Abschrägungen) – nur Erfassung, nicht berechnet (Freitext). */
  sonderformen?: string
  /**
   * Punkt 4.11: Fixmaße und Sondermaße im Klartext an die AV. Ersetzt die
   * Fixmaß-Häkchen aus 4.7. Geht unverändert ins AV-PDF und wird weder in der
   * Maßberechnung noch in der Kalkulation ausgewertet.
   */
  sondermasse?: string
}

// ---------------------------------------------------------------------------
// Schritt 6 – Ausstattung-Vorauswahl (Häkchen)
// ---------------------------------------------------------------------------

/**
 * Schritt 6 (Refugium): allgemeine Vorauswahl der benötigten Ausstattung („Häkchen").
 * Es werden ausschließlich die hier gewählten Optionen später in Schritt 8
 * („Ausstattung hinter Fronten") je Segment angeboten. Die IDs verweisen auf den
 * zentralen Ausstattungs-Katalog (`config/equipment.ts`).
 */
export interface AusstattungAuswahl {
  /** IDs der vorausgewählten Ausstattungs-Optionen. */
  selected: string[]
}

// ---------------------------------------------------------------------------
// Entwurf (Single Source of Truth)
// ---------------------------------------------------------------------------

/**
 * Ein Konfigurations-Entwurf. Der Primary Key ist die Entwurfsnummer `id`.
 * Zentrale „Single Source of Truth“: Alle Phasen ergänzen dieses Objekt und
 * speisen daraus Visualisierung, Regel-Engine und AV-PDF. Neue Felder werden
 * bewusst optional ergänzt, damit keine Umstrukturierung nötig ist.
 */
export interface Draft {
  id: string
  createdAt: string
  consultant: { id: string; name: string }
  orderNumber: string
  /** Artikelnummer (Schritt 2) – optional, nachträglich befüllbar (erst vor AV-Übergabe Pflicht). */
  artikelnummer?: string
  customerName: string
  branchId: string
  /**
   * Verweis auf den Ursprungs-Entwurf, wenn dieser per „Duplizieren" als Variante
   * entstanden ist (Schritt 1). Die genaue Varianten-Gruppen-/Nummern-Logik (Frage B7)
   * wird später nachgezogen – dieses Feld ist der flexible Platzhalter dafür.
   */
  variantOf?: string
  /**
   * Punkt 1.5: Vom Berater vergebene Bezeichnung der Angebotsvariante
   * (z. B. „Variante A — Eiche geölt"). Das automatische Kennzeichen beim
   * Duplizieren genügt laut Dietmar ausdrücklich nicht.
   */
  variantLabel?: string

  // --- Phase 3 ---
  productGroupId?: string
  seriesId?: string

  // --- Phase 4 (Korpus) ---
  /** Korpus-Auswahl je Bereich (Bereichs-ID -> Auswahl), z. B. innen/aussen/abdeckplatte. */
  korpus?: Record<string, MaterialSelection>
  /**
   * Außenkorpus-Modus (Phase 9b): „komplett“ (ein Material für den ganzen Außenkorpus,
   * Bereich `aussen`) oder „getrennt“ (Bereiche `aussenLinks` / `aussenRechts` separat).
   * Die Abdeckplatte ist in beiden Modi eigenständig.
   */
  korpusMode?: 'komplett' | 'getrennt'
  /**
   * Phase B: „Sicht-Rückwand?" – blendet Material-/Farbauswahl für die Außen-Rückwand ein
   * (Auswahl liegt in `korpus['rueckwandAussen']`). false/undefined ⇒ keine Sicht-Rückwand.
   */
  sichtRueckwandAussen?: boolean
  /** Phase B: Innenausbau des Korpus (Rückwand innen / Lochreihe / Einlegeböden / Kleiderstange). */
  korpusInnen?: KorpusInnen
  /**
   * Punkt 5.3: Innenmaterial je Korpus, geschlüsselt über `KorpusEinheit.id`.
   *
   * Dietmars Beispiel: ein Schrank aus drei Korpi, links und rechts innen Decoboard
   * (dahinter Drehtüren), der mittlere teilweise offen und deshalb innen furniert.
   * Das Abschlussset links/rechts trägt dagegen „in 99 % der Fälle das gleiche
   * Material" und bleibt eine einzige Auswahl (`korpusGrunddaten.abschlussSet`).
   *
   * Leer ⇒ für alle Korpi gilt die einheitliche Auswahl aus `korpus.innen`.
   */
  korpusInnenJeKorpus?: Record<string, MaterialSelection>

  // --- Phase 4.5 (Maße & Segmente) ---
  dimensions?: {
    heightCm?: string
    widthCm?: string
    depthCm?: string
    /** Anzahl Korpus-Segmente (Spalten) – initialisiert die Front-Typ-Spalten. */
    segments?: number
  }

  /**
   * Schritt 4 (Refugium): strukturierte, koordinatenfähige Korpus-Grunddaten.
   * Ist dies gesetzt, werden die Legacy-`dimensions` daraus abgeleitet (`deriveDimensions`),
   * damit alle bestehenden Downstream-Konsumenten unverändert weiterlaufen.
   */
  korpusGrunddaten?: KorpusGrunddaten

  // --- Schritt 6 (Ausstattung-Vorauswahl) ---
  /** Refugium: allgemeine Ausstattungs-Vorauswahl; filtert die Angebote in Schritt 8. */
  ausstattung?: AusstattungAuswahl

  // --- Phase 5 (Fronten & Abschlüsse) ---
  fronts?: FrontsData

  // --- Phase 6 (Abschluss) ---
  /** Optimiertes Scan-Bild der Handzeichnung (Data-URL, via Smartphone-Bridge). */
  scanImage?: string
  /** Zeitpunkt der Finalisierung (ISO-8601); gesetzt => Entwurf „abgeschlossen“. */
  finalizedAt?: string

  // --- Phase 8 (Preis-Transparenz) ---
  /** Optionale Aufschläge für die Preis-Kalkulation (Montage +10%, Lieferung regional +3%). */
  pricingOptions?: {
    montage: boolean
    lieferungRegional: boolean
  }

  // --- Phase 9 (Gesamtpreis: Korpus + Aussenset + Innen + Upgrades) ---
  /** Preispositionen außerhalb der Front-Elemente (Metadaten; erzeugen ab Phase A keinen Preis mehr). */
  positions?: DraftPosition[]

  // --- Phase A (Manuelle Preisbildung) ---
  /**
   * Manuell kalkulierter Verkaufspreis (Freitext-Eingabe des Beraters, de-DE).
   * Ersetzt die automatische Kalkulation: einziger verbindlicher Preis, wird
   * gespeichert und als Endpreis auf das AV-PDF gedruckt. `positions`/
   * `pricingOptions` bleiben als Metadaten erhalten, erzeugen aber keinen Preis.
   */
  vkPreis?: string

  /** true => fest hinterlegter Demo-/Verifizierungs-Entwurf (nicht löschbar, Referenz). */
  isVerification?: boolean
}
