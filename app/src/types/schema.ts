/**
 * KONFIGURATOR-SCHEMA — der Aufbau der Oberfläche als Daten.
 *
 * Bisher stand jede Überschrift, jeder Hinweis und jedes Eingabefeld im JSX. Ein neues
 * Feld im Auftragskopf kostete sieben Stellen im Code (Typ, Maske, Zusammenfassung, PDF,
 * Initialwert, Duplizieren, Validierung). Das Schema beschreibt dieselbe Oberfläche
 * stattdessen als Daten; Maske, Zusammenfassung und PDF lesen alle dieselbe Definition.
 *
 * ZWEI ARTEN VON FELDERN, und der Unterschied ist wichtig:
 *
 *   GEBUNDEN    `bindung` zeigt auf ein bestehendes Feld des Entwurfs (`customerName`,
 *               `branchId` …). Diese Felder bleiben typisiert, weil Kalkulation, Dashboard
 *               und Supabase-Spalten daran hängen. Der Administrator kann sie umbenennen,
 *               umsortieren, zur Pflicht machen, aus dem PDF nehmen oder abschalten —
 *               aber nicht löschen.
 *   FREI        Kein `bindung`. Der Wert landet in `Draft.zusatzfelder[id]`. Solche Felder
 *               legt der Administrator selbst an; sie brauchen keine Code-Änderung.
 *
 * ABGELEITETE Felder (`quelle`) zeigen nur an — Berater, Datum, Entwurfsnummer. Sie sind
 * nicht eingebbar und stehen nicht im Entwurf, sondern werden beim Rendern berechnet.
 */

/** Feldtypen des Bausteinkatalogs. */
export type FeldTyp =
  | 'text'
  | 'mehrzeilig'
  | 'zahl'
  | 'auswahl'
  | 'checkbox'
  | 'datum'
  | 'hinweis'
  | 'ueberschrift'

/**
 * Bestehende Entwurfsfelder, an die ein Schemafeld gebunden werden kann.
 *
 * Bewusst eine feste Liste statt eines freien Pfades: Ein Tippfehler wäre sonst erst in
 * der Oberfläche zu sehen, und ein frei wählbarer Pfad würde beliebige Stellen des
 * Entwurfs beschreibbar machen.
 */
export type FeldBindung = 'orderNumber' | 'artikelnummer' | 'variantLabel' | 'customerName' | 'branchId'

/** Abgeleitete Anzeigewerte, die nicht im Entwurf stehen. */
export type FeldQuelle = 'berater' | 'datum' | 'entwurfsnummer' | 'variante'

/** Woher die Optionen einer Auswahl kommen. */
export type OptionenQuelle = 'filialen' | 'serien'

/** Wo ein Feld erscheint. */
export interface FeldSichtbarkeit {
  /** Erfassungsmaske (Schritt „Entwurf"). */
  maske: boolean
  /** Zusammenfassung vor dem Abschluss. */
  zusammenfassung: boolean
  /** AV-PDF. */
  pdf: boolean
}

/**
 * Sichtbarkeitsregel eines Feldes — die erste der im Editor pflegbaren Regelarten.
 *
 * Bewusst ein geschlossener Satz geprüfter Regeltypen statt einer freien Ausdruckssprache:
 * Was der Administrator hier einstellt, muss ohne Test ins Rechte laufen.
 */
export type SchemaRegel = {
  art: 'nurSerien'
  /** Serien-IDs, bei denen das Feld erscheint. Leer ⇒ Regel wirkt nicht. */
  serien: string[]
}

export interface SchemaFeld {
  /** Stabile technische Kennung; bei freien Feldern zugleich Schlüssel in `zusatzfelder`. */
  id: string
  typ: FeldTyp
  label: string
  /** Erklärung unter dem Feld. */
  hinweis?: string
  platzhalter?: string
  pflicht?: boolean
  /** false ⇒ deaktiviert: bleibt im Schema, erscheint aber nirgends. */
  aktiv: boolean
  sortierung: number
  bindung?: FeldBindung
  quelle?: FeldQuelle
  optionen?: OptionenQuelle
  /**
   * Dreistelliger Dropdown-Code aus der Artikelverwaltung (Block 2 der Artikelnummer).
   * Die Auswahl lädt dann die Artikel dieses Dropdowns für die gewählte Serie.
   */
  dropdownCode?: string
  zeigeIn: FeldSichtbarkeit
  /** true ⇒ erscheint in Zusammenfassung und PDF nur, wenn ein Wert erfasst ist. */
  nurWennGefuellt?: boolean
  /**
   * true ⇒ gehört zum Auslieferungsstand und hängt an typisiertem Code. Umbenennen,
   * umsortieren und abschalten ist erlaubt, Löschen nicht.
   */
  systemfeld?: boolean
  regeln?: SchemaRegel[]
}

export interface SchemaAbschnitt {
  id: string
  titel: string
  beschreibung?: string
  aktiv: boolean
  sortierung: number
  felder: SchemaFeld[]
}

export interface KonfiguratorSchema {
  /** Wird bei jeder Veröffentlichung hochgezählt. */
  version: number
  /** Auslieferungsstand, aus dem dieser Stand entstanden ist. */
  basisVersion: number
  abschnitte: SchemaAbschnitt[]
}
