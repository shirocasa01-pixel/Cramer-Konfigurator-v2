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
  /**
   * Stamm-Filiale des Beraters aus Blatt „40 Mitarbeiter" (Spalte `Filiale`).
   *
   * „Überarbeitung 2", S. 1: „Grundsätzlich ist jeder Verkäufer fix an ein
   * Verkaufshaus gebunden. Diese Filiale sollte auch standardmäßig vorausgewählt
   * sein." Sie ist eine VORBELEGUNG, keine Sperre — bei einer Urlaubsvertretung
   * bleibt das Dropdown im Entwurf frei änderbar.
   */
  branchId?: string
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

// ---------------------------------------------------------------------------
// Oberflächen-Stammdaten (Reiter „Oberflächen") — die pflegbare Fassung der Farbmatrix
// ---------------------------------------------------------------------------

/**
 * Preisgruppe als Stammdatenfeld. Leer heißt „offen": bei einer Kategorie klärt die AV
 * den Preis, bei einer Oberfläche gilt die Preisgruppe ihrer Kategorie.
 */
export type PreisgruppenFeld = PriceGroup | ''

/** Datensatz-Status im Stammdaten-Gitter — wie bei Artikeln, Beratern und Filialen. */
export type StammdatenStatus = 'aktiv' | 'gesperrt'

/**
 * EBENE 1 — Oberflächenkategorie (Mattlack, Decoboard, Gläser, Furnier …).
 *
 * Die Kategorie trägt die Preisgruppe; alle Oberflächen darunter erben sie, sofern sie
 * keine eigene führen. Aus einer Kategorie wird im Konfigurator ein Material-Chip.
 */
export interface Oberflaechenkategorie {
  /** Identität — Verweisziel von `Oberflaeche.kategorie` und von den Bereichs-/Front-Regeln. */
  id: string
  bezeichnung: string
  preisgruppe: PreisgruppenFeld
  /**
   * Wird die Kategorie bei Fronten angeboten, wenn dort „alle Materialien" zulässig sind?
   * Sonderwerkstoffe („nur über anders") und Akustikpaneele stehen deshalb auf `false`.
   */
  standardauswahl: boolean
  sortierung: number
  status: StammdatenStatus
  bemerkung: string
}

/**
 * EBENE 2 — konkrete Oberfläche/Farbe (Schwarz RAL 9005, Eiche Milano …).
 *
 * `id` ist nur INNERHALB der Kategorie eindeutig — „schwarz" gibt es in Decoboard,
 * Mattlack und Gläsern. Der Schlüssel über den ganzen Bestand ist `kategorie::id`;
 * gespeicherte Entwürfe halten beides getrennt (`materialGroupId` + `optionId`) und
 * bleiben damit unverändert lesbar.
 */
export interface Oberflaeche {
  id: string
  /** Verweis auf `Oberflaechenkategorie.id`. */
  kategorie: string
  bezeichnung: string
  /** Abweichende Preisgruppe; leer ⇒ die der Kategorie (z. B. Wengé PG 4 in der PG-3-Gruppe). */
  preisgruppe: PreisgruppenFeld
  /** Bei Auswahl öffnet sich ein Freitextfeld für die genaue Bezeichnung. */
  freitext: boolean
  freitextLabel: string
  sortierung: number
  status: StammdatenStatus
  bemerkung: string
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

  // --- Überarbeitung 3: Drehtür-Höhe & Türanschlag ---
  /**
   * Wie die Türhöhe erfasst wurde – die drei Optionen schließen sich gegenseitig aus:
   *   `korpusoberkante` – Tür läuft bis zur Oberkante des Schrankes (Resthöhe wird
   *                       aus Korpusraster minus den übrigen Fronten der Spalte errechnet),
   *   `raster`          – Eingabe in Rastern, `heightCm` wird daraus berechnet (Einbahn),
   *   `cm`              – freie Höheneingabe in `heightCm`.
   * `undefined` = Altbestand/andere Front-Typen: `heightCm` ist die einzige Quelle.
   */
  hoeheModus?: 'korpusoberkante' | 'raster' | 'cm'
  /** Eingabe „Höhe (Raster)“ – nur bei `hoeheModus === 'raster'`; 3–21 Raster. */
  hoeheRaster?: string
  /**
   * Türanschlag einer Drehtür. Laut Überarbeitung 3 unabhängig von der Position der Tür
   * im Schrank immer abzufragen.
   */
  tuerAnschlag?: 'rechts' | 'links'
  /**
   * Stil-Linie „Line“: Antwort auf „(Glas der) Frontscheibe und der Aufkantung gleich?“.
   * `false` teilt die Ausführung in Frontscheibe (`fieldValues.material`) und Aufkantung
   * (`fieldValues.aufkantung`) und blendet bei Furnier/Mattlack die „Alulisene gepulvert in“
   * ein. `undefined` = noch nicht beantwortet.
   */
  lineAufkantungGleich?: boolean

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
 * Einbauhöhe eines Ausstattungsteils (Überarbeitung 2_2).
 *
 * `raster` ist der Regelfall — die AV plant in Rastern. `cm` ist die ausdrückliche
 * Ausnahme („Sonderhöhe ca."), `boden` steht für „am Korpusboden" und braucht keinen Wert.
 */
export interface EquipmentHoehe {
  modus: 'raster' | 'cm' | 'boden'
  /** Rasterstufe (1 … Korpusraster − 1); nur bei `modus === 'raster'`. */
  raster?: number
  /** Sonderhöhe in cm (Freitext, per Konvention „ca."); nur bei `modus === 'cm'`. */
  cm?: string
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
  /**
   * Höhenangabe – Freitext, per Konvention „ca." (z. B. „auf 120 cm").
   *
   * ALTBESTAND: Seit Überarbeitung 2_2 wird die Einbauhöhe strukturiert in `hoehen`
   * erfasst (Raster als Regelfall). Das Feld bleibt, damit vor der Umstellung
   * gespeicherte Entwürfe ihre Angabe behalten und weiterhin angezeigt werden.
   */
  heightNote?: string
  /**
   * Einbauhöhen — bei `heightPerPiece` eine je Stück (Einlegeböden), sonst genau eine.
   * Die Rasterstufe ist der Regelfall; cm bleibt die Ausnahme, „am Korpusboden" gibt es
   * nur, wo der Katalog `raster-oder-boden` vorsieht.
   */
  hoehen?: EquipmentHoehe[]
  /** Werte der Zusatz-Auswahlen (`EquipmentChoice.id` → Wert), z. B. `glasart`. */
  choices?: Record<string, string>
  /** Freitext zu einer Auswahl (z. B. Wunschbreite in cm), je `EquipmentChoice.id`. */
  choiceTexte?: Record<string, string>
  /** Position als Kästchen (Verblendung, LED-Band, Revisionsklappe …). */
  seiten?: { links?: boolean; rechts?: boolean }
  /**
   * Instanz-ID des Bezugselements im selben Segment — „für welche Schublade" bzw.
   * „auf welchen Einlegeboden".
   */
  bezugId?: string
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
 * Außen-Abschlussset links/rechts.
 *
 * Die POSITION wird im Schritt „Maße" gewählt, weil sie das Außenmaß verändert
 * (10 mm je Seite plus eine 3-mm-Fuge). Das MATERIAL steht dagegen im Schritt
 * „Korpus" bei allen übrigen Materialien — vorher wurde es an beiden Stellen
 * abgefragt („Überarbeitung 2", S. 3).
 *
 * Punkt 5.11 bleibt gültig: Das Seitenset ist der einzige Bereich mit „anders"
 * inklusive Preisgruppe — das steckt in `MaterialSelection` und gilt damit auch
 * für die getrennte Wahl links/rechts.
 */
export interface AbschlussSet {
  position: 'keine' | 'links' | 'rechts' | 'beide'
  /** Material beider Seiten. Gilt, solange `materialGetrennt` nicht gesetzt ist. */
  material?: MaterialSelection
  /**
   * true ⇒ links und rechts werden getrennt gewählt („Überarbeitung 2", S. 4:
   * „Material für Abschlusset links und rechts getrennt wählen").
   */
  materialGetrennt?: boolean
  materialLinks?: MaterialSelection
  materialRechts?: MaterialSelection
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
// Preis-Snapshot – abgeschlossene Aufträge von den Stammdaten entkoppeln
// ---------------------------------------------------------------------------

/** Woher eine Preisposition stammt — entscheidend für die Transparenz zum Berater. */
export type PositionsHerkunft = 'gewaehlt' | 'abgeleitet' | 'zuschlag'

/** „auf-anfrage" ⇒ es gab keine Preiszeile; der Betrag wurde NIE geschätzt. */
export type PositionsStatus = 'berechnet' | 'auf-anfrage'

/**
 * Eine aufgelöste Preis-Achse (A1–A5), wie sie zum Einfrier-Zeitpunkt gegriffen hat.
 *
 * Strukturgleich zu `AufgelloesteAchse` aus `lib/preisLookup.ts`, aber bewusst ohne
 * Import: die Entwurfs-Typen sollen nicht an der Lookup-Schicht hängen. `code` ist
 * hier `string` statt der engeren Achsen-Union — beim Zuweisen passt das, und beim
 * Zurücklesen aus JSON wäre die engere Angabe ohnehin nicht überprüfbar.
 */
export interface PricingSnapshotAchse {
  code: string
  /** Spaltenname im Preisblatt (A1–A5). */
  spalte: string
  /** Klartext-Bedeutung aus Blatt „35 Achsen". */
  bedeutung: string
  wert: string
}

/** Eine eingefrorene Preisposition — Bezeichnung, Menge, Einzelpreis, Betrag. */
export interface PricingSnapshotPosition {
  id: string
  herkunft: PositionsHerkunft
  bucket: PriceBucket
  /** 1-basierte Segmentnummer, falls die Position zu einem Segment gehört. */
  segment?: number
  label: string
  artikelnummer?: string
  kurzzeichen?: string
  teileart?: string
  produktgruppe?: string
  artikelgruppe?: string
  achsen: PricingSnapshotAchse[]
  einheit?: string
  /** Seite der gedruckten Preisliste. */
  seite?: string
  menge: number
  einzelpreis: number | null
  gesamt: number | null
  status: PositionsStatus
  hinweis?: string
}

/**
 * EINGEFRORENER PREISSTAND eines abgeschlossenen Auftrags.
 *
 * Kernregel des Auftragsarchivs: Ein abgeschlossener Auftrag ist ein Dokument, kein
 * Live-Report. Ändert die Artikelverwaltung morgen einen Preis, darf sich der gestern
 * abgeschlossene Auftrag NICHT rückwirkend verändern — sonst stimmt das, was der Kunde
 * unterschrieben hat, nicht mehr mit dem überein, was das System zeigt.
 *
 * Deshalb wird der Snapshot GENAU EINMAL geschrieben: beim Finalisieren. Danach bleibt
 * er unangetastet (siehe `friereBeimSpeichernEin` in `lib/pricingSnapshot.ts`). Offene
 * Entwürfe tragen bewusst keinen Snapshot — sie rechnen bei jedem Laden neu.
 *
 * Der Schlüssel heißt absichtlich `pricing_snapshot` (snake_case, abweichend vom
 * restlichen Entwurf): So heißt er auch in der Supabase-Spalte `configuration` und ist
 * dort direkt auffindbar.
 */
export interface PricingSnapshot {
  /** ISO-8601 — Zeitpunkt des Einfrierens (= Finalisierung). */
  frozenAt: string
  /** Interne Version des Stammdaten-Stands, aus dem gerechnet wurde. */
  stammdatenVersion: number
  /** Gültigkeitsangabe des Preisblatts (Preisstand). */
  gueltigkeit: string
  waehrung: string
  positionen: PricingSnapshotPosition[]
  zuschlaege: PricingSnapshotPosition[]
  /** Summe der Bauteil-Positionen (ohne Zuschläge). */
  moebelpreis: number
  /** Möbelpreis + alle Zuschläge. */
  gesamt: number
  offenePositionen: number
  /** false ⇒ beim Einfrieren waren Positionen offen; der Betrag stand unter Vorbehalt. */
  vollstaendig: boolean
  /** Manuell gesetzter VK-Preis (Rohtext, de-DE) zum Einfrier-Zeitpunkt. */
  vkPreis?: string
  /** Derselbe VK-Preis als Zahl — erspart späteres Neuparsen. */
  vkPreisNumerisch: number | null
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
  /**
   * PAPIERKORB — Zeitpunkt (ISO-8601), zu dem der Entwurf verworfen wurde. Fehlt das
   * Feld, ist der Entwurf aktiv.
   *
   * Die Marke steht bewusst IM ENTWURF und nicht in einer eigenen Tabellenspalte: Die
   * Tabelle `projects` kennt keine solche Spalte, und `saveProject()` verwirft unbekannte
   * Spalten stillschweigend, um das Speichern nicht scheitern zu lassen — eine Löschung
   * wäre damit lautlos verloren gegangen. Das `configuration`-JSON wird dagegen immer
   * vollständig geschrieben. Kommt später eine echte Spalte dazu, kann sie diesen Wert
   * spiegeln, ohne dass sich an der Oberfläche etwas ändert.
   */
  deletedAt?: string

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

  /**
   * Eingefrorener Preisstand. Wird beim Finalisieren genau einmal gesetzt und danach
   * nie wieder angefasst; offene Entwürfe tragen ihn nicht. Siehe `PricingSnapshot`.
   */
  pricing_snapshot?: PricingSnapshot

  /** true => fest hinterlegter Demo-/Verifizierungs-Entwurf (nicht löschbar, Referenz). */
  isVerification?: boolean
}
