/**
 * PREIS-LOOKUP — Artikelnummer + Achsenwerte → Preiszeile(n).
 *
 * Der Zugriff läuft über die Artikelnummern-Hierarchie und grenzt über die Achsen ein:
 *
 *     10-001-0003  Korpus (Refugium)   BREITE × HÖHE × TIEFE × PG   →  258 EUR
 *     20-006-0001  Drehtür             BREITE × HÖHE × LINIE+PG     →  348 EUR
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WAS DIE ACHSEN-REFORM HIER GEÄNDERT HAT
 *
 * 1. Eine Achse sagt selbst, wie ihr Wert zu lesen ist (`Achse.art` aus Blatt
 *    „35 Achsen"). Der Lookup kennt keine Sonderliste mehr, welche Achse numerisch ist
 *    und welche Listen führt — das steht in den Stammdaten und ist dort pflegbar.
 *
 * 2. Alle Maßachsen runden auf. Was früher die Preislogik MATRIX_AUF war, ist jetzt
 *    Eigenschaft der Achse: BREITE, HÖHE, TIEFE und LÄNGE suchen die kleinste Stufe, die
 *    das verlangte Maß noch abdeckt. Über der größten Stufe ⇒ Sondermaß, nie ein
 *    geschätzter Preis.
 *
 * 3. Ein Treffer kann aus MEHREREN Zeilen bestehen. Führt ein Artikel die Achse PREISART,
 *    liefert er je Bezugsgröße eine Zeile — etwa einen Grundpreis und einen Preis je
 *    Quadratmeter. Beide zusammen ergeben die Position; in der Kalkulation erscheinen sie
 *    als Teilpositionen. Das ersetzt die frühere Preislogik GRUND_PLUS_QM.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Findet sich keine Zelle, kommt `auf-anfrage` zurück — nie ein geschätzter Preis.
 * Das Ergebnis trägt die aufgelösten Achsen im Klartext mit, damit Positionsliste und
 * AV-PDF zeigen können, WARUM dieser Preis gilt.
 */

import {
  achsen as achsenKatalog,
  type AchseCode,
  type AchsenArt,
  type Artikel,
  type Preiszeile,
} from '../data/stammdaten.generated.ts'
import {
  achsenwertPasst,
  parsePreisart,
  parseStufe,
  parseZahl,
  waehleStufe,
  type Preisart,
  type StufenWert,
} from './preisAchsen.ts'
import { getStammdatenStand } from './stammdatenStore.ts'

// ---------------------------------------------------------------------------
// Indizes
//
// Sie werden aus dem Arbeitsstand aufgebaut, nicht aus dem generierten Modul: eine
// Änderung in der Stammdaten-Verwaltung muss sofort im nächsten Lookup wirken. Der
// Neuaufbau hängt an der `version` des Stores — solange sich nichts ändert, kostet
// der Zugriff nur einen Zahlenvergleich.
// ---------------------------------------------------------------------------

interface Indizes {
  version: number
  artikelNachNummer: Map<string, Artikel>
  zeilenNachArtikel: Map<string, Preiszeile[]>
}

let indizes: Indizes | null = null

function aktuelleIndizes(): Indizes {
  const stand = getStammdatenStand()
  if (indizes && indizes.version === stand.version) return indizes

  const artikelNachNummer = new Map<string, Artikel>(stand.artikel.map((a) => [a.artikelnummer, a]))
  const zeilenNachArtikel = new Map<string, Preiszeile[]>()
  for (const zeile of stand.preise) {
    const liste = zeilenNachArtikel.get(zeile.artikel)
    if (liste) liste.push(zeile)
    else zeilenNachArtikel.set(zeile.artikel, [zeile])
  }

  indizes = { version: stand.version, artikelNachNummer, zeilenNachArtikel }
  return indizes
}

// ---------------------------------------------------------------------------
// Achsen-Metadaten
// ---------------------------------------------------------------------------

const KATALOG = new Map(achsenKatalog.map((a) => [a.code, a]))

/** Wie der Wert dieser Achse gelesen wird. Unbekannte Achse ⇒ exakter Textvergleich. */
export function achsenArt(code: AchseCode): AchsenArt {
  return KATALOG.get(code)?.art ?? 'text'
}

/** Klartext-Bedeutung einer Achse aus Blatt „35 Achsen". */
export function achsenBedeutung(code: AchseCode): string {
  return KATALOG.get(code)?.bedeutung ?? code
}

/** Alle Achsen des Katalogs — Grundlage der Auswahlfelder in der Verwaltung. */
export { achsenKatalog }

/** true, wenn die Achse ein Zentimetermaß führt (und damit aufrundet). */
export function istMassAchse(code: AchseCode): boolean {
  const art = achsenArt(code)
  return art === 'stufe' || art === 'mass'
}

/**
 * Welche Anfragegröße eine Maßachse bedient.
 *
 * BREITE und BREITE_CM fragen dieselbe Zahl ab — der Unterschied liegt darin, dass die
 * Stufenachse immer einen gedruckten Wert trägt, die Maßachse auch leer bleiben darf und
 * dann nur benennt, welches Maß die MENGE liefert.
 */
export type MassRichtung = 'breite' | 'hoehe' | 'tiefe' | 'laenge'

export function massRichtung(code: AchseCode): MassRichtung | undefined {
  switch (code) {
    case 'BREITE':
    case 'BREITE_CM':
      return 'breite'
    case 'HOEHE':
    case 'HOEHE_CM':
      return 'hoehe'
    case 'TIEFE':
    case 'TIEFE_CM':
      return 'tiefe'
    case 'LAENGE':
      return 'laenge'
    default:
      return undefined
  }
}

// ---------------------------------------------------------------------------
// Anfrage & Ergebnis
// ---------------------------------------------------------------------------

/**
 * Anforderungen an die Achsen. Nicht gesetzte Achsen filtern nicht — ein Artikel mit
 * einer einzigen Preiszelle braucht gar keine Angabe.
 */
export interface PreisAnfrage {
  artikelnummer: string
  /** Verlangte Breite in cm; wird auf die nächstgrößere Stufe gehoben. */
  breiteCm?: number
  /** Verlangte Höhe in cm (früher: Rasterstufe). */
  hoeheCm?: number
  tiefeCm?: number
  /** Laufende Länge in cm (Verblendung, LED-Band, Aufkantung). */
  laengeCm?: number
  /** Stil-Linie + Preisgruppe als kombinierter Achsenwert, z. B. „Glatt2". */
  liniePg?: string
  /** Material-Preisgruppe, wenn PG eine eigene Achse ist. */
  pg?: string
}

/** Eine aufgelöste Achse — Grundlage für die Klartext-Anzeige. */
export interface AufgelloesteAchse {
  code: AchseCode
  /** Klartext-Bedeutung aus Blatt „35 Achsen". */
  bedeutung: string
  /** Spaltenname im Preisblatt (A1–A5). */
  spalte: string
  wert: string
}

/** Eine gefundene Preiszeile mit ihrer Bezugsgröße. */
export interface PreisTeil {
  zeile: Preiszeile
  preis: number
  preisart: Preisart
  seite: string
}

export type PreisErgebnis =
  | {
      status: 'gefunden'
      artikel: Artikel
      /** Ein Eintrag je Bezugsgröße; bei Stückartikeln genau einer. */
      teile: PreisTeil[]
      achsen: AufgelloesteAchse[]
      /** true, wenn ein Maß auf eine größere Stufe gehoben wurde. */
      aufgerundet: boolean
      /** Die gewählten Stufen im Klartext („60 cm | 60er"), für den Positionshinweis. */
      gewaehlteStufen: string[]
      /** Welche Maße die Menge liefern sollen — aus den Maßachsen des Artikels. */
      mengenachsen: MassRichtung[]
    }
  | { status: 'auf-anfrage'; artikel?: Artikel; grund: string }

// ---------------------------------------------------------------------------
// Verfügbare Stufen (für Auswahlfelder und Plausibilitätsmeldungen)
// ---------------------------------------------------------------------------

/** Die tatsächlich bepreisten Stufen einer Maßachse (cm), aufsteigend. */
export function verfuegbareStufen(artikelnummer: string, code: AchseCode): StufenWert[] {
  const { artikelNachNummer, zeilenNachArtikel } = aktuelleIndizes()
  const art = artikelNachNummer.get(artikelnummer)
  if (!art) return []
  const index = art.achsen.indexOf(code)
  if (index < 0) return []
  const gesehen = new Map<string, StufenWert>()
  for (const zeile of zeilenNachArtikel.get(artikelnummer) ?? []) {
    const roh = zeile.a[index]
    if (roh && !gesehen.has(roh)) gesehen.set(roh, parseStufe(roh))
  }
  return [...gesehen.values()].sort((a, b) => (a.cm ?? 0) - (b.cm ?? 0))
}

/** Die bepreisten Höhenstufen eines Artikels in cm — für Meldungen über Sondermaße. */
export function verfuegbareHoehenCm(artikelnummer: string): number[] {
  return verfuegbareStufen(artikelnummer, 'HOEHE')
    .map((s) => s.cm)
    .filter((n): n is number => n != null)
}

/** Die bepreisten Tiefenstufen eines Artikels in cm. */
export function verfuegbareTiefen(artikelnummer: string): number[] {
  return verfuegbareStufen(artikelnummer, 'TIEFE')
    .map((s) => s.cm)
    .filter((n): n is number => n != null)
}

/** Alle in den Preiszeilen eines Artikels vorkommenden Werte einer Achse. */
export function belegteAchsenwerte(artikelnummer: string, code: AchseCode): string[] {
  const { artikelNachNummer, zeilenNachArtikel } = aktuelleIndizes()
  const art = artikelNachNummer.get(artikelnummer)
  if (!art) return []
  const index = art.achsen.indexOf(code)
  if (index < 0) return []
  const werte = new Set<string>()
  for (const zeile of zeilenNachArtikel.get(artikelnummer) ?? []) {
    const roh = (zeile.a[index] ?? '').trim()
    if (roh) werte.add(roh)
  }
  return [...werte].sort((a, b) => a.localeCompare(b, 'de'))
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/** Das verlangte Maß für eine Maßachse. */
function massAnfrage(code: AchseCode, anfrage: PreisAnfrage): number | undefined {
  switch (massRichtung(code)) {
    case 'breite':
      return anfrage.breiteCm
    case 'hoehe':
      return anfrage.hoeheCm
    case 'tiefe':
      return anfrage.tiefeCm
    case 'laenge':
      return anfrage.laengeCm
    default:
      return undefined
  }
}

/**
 * Der verlangte Wert für eine Merkmalsachse.
 *
 * AUSFÜHRUNG ist hier bewusst nicht mehr aufgeführt: Seit jede Ausführungsvariante ein
 * eigener Artikel ist (Decoboard und Rauchglas z. B. als getrennte Container-Artikel),
 * führt kein Artikel im Stamm diese Achse mehr — die Auswahl passiert über die
 * Artikelnummer, nicht über einen Achsenwert.
 */
function merkmalAnfrage(code: AchseCode, anfrage: PreisAnfrage): string | undefined {
  switch (code) {
    case 'LINIE_PG':
      return anfrage.liniePg
    case 'PG':
      return anfrage.pg
    default:
      return undefined
  }
}

/**
 * Sucht die Preiszelle(n) zu einer Anfrage.
 *
 * Ablauf: erst die Merkmalsachsen als harte Filter, dann je Maßachse die passende Stufe
 * wählen, zuletzt nach Bezugsgröße (PREISART) gruppieren.
 */
export function findePreis(anfrage: PreisAnfrage): PreisErgebnis {
  const { artikelNachNummer, zeilenNachArtikel } = aktuelleIndizes()
  const art = artikelNachNummer.get(anfrage.artikelnummer)
  if (!art) {
    return { status: 'auf-anfrage', grund: `Artikel ${anfrage.artikelnummer} steht nicht im Stamm.` }
  }
  if (art.status !== 'aktiv') {
    return { status: 'auf-anfrage', artikel: art, grund: `Artikel ${art.artikelnummer} ist ${art.status}.` }
  }

  let kandidaten = zeilenNachArtikel.get(art.artikelnummer) ?? []
  if (kandidaten.length === 0) {
    return {
      status: 'auf-anfrage',
      artikel: art,
      grund:
        art.preislogik === 'AUF_ANFRAGE'
          ? 'Für diesen Artikel ist bewusst kein Preis hinterlegt (Preislogik AUF_ANFRAGE).'
          : 'Für diesen Artikel ist keine Preiszeile hinterlegt.',
    }
  }

  // --- 1) Merkmalsachsen als harte Filter ------------------------------------------
  art.achsen.forEach((achse, index) => {
    const kind = achsenArt(achse)
    if (kind !== 'text' && kind !== 'liste') return
    const soll = merkmalAnfrage(achse, anfrage)
    if (soll == null || soll === '') {
      // Nur überspringen, wenn die Achse für diesen Artikel ohnehin nur einen Wert führt
      // (Artikel mit einer einzigen Preiszelle). Führt sie mehrere Werte — z. B. die
      // Drehtür mit Glatt1..4/CurvePG1/CurvePG2-4/Line/… —, darf NICHT stillschweigend
      // die erste Zeile gewinnen: Vor der Farb-/Stil-Linien-Wahl (liniePg/pg noch
      // undefined) lieferte das sonst immer Glatt1/PG1, unabhängig von der später
      // gewählten Linie.
      const vorhandeneWerte = new Set(kandidaten.map((zeile) => zeile.a[index]).filter(Boolean))
      if (vorhandeneWerte.size > 1) kandidaten = []
      return
    }
    kandidaten = kandidaten.filter((zeile) =>
      achsenwertPasst(zeile.a[index], soll, { listenAchse: kind === 'liste' }),
    )
  })

  if (kandidaten.length === 0) {
    return { status: 'auf-anfrage', artikel: art, grund: gefragtText(art, anfrage) }
  }

  // --- 2) Maßachsen: je Achse die nächstgrößere Stufe wählen -----------------------
  let aufgerundet = false
  const gewaehlteStufen: string[] = []
  const mengenachsen: MassRichtung[] = []

  for (let index = 0; index < art.achsen.length; index++) {
    const achse = art.achsen[index]
    if (!istMassAchse(achse)) continue
    const richtung = massRichtung(achse)
    if (richtung) mengenachsen.push(richtung)

    const gesucht = massAnfrage(achse, anfrage)
    if (gesucht == null) continue

    const werte = new Map<string, StufenWert>()
    for (const zeile of kandidaten) {
      const roh = zeile.a[index]
      if (roh && !werte.has(roh)) werte.set(roh, parseStufe(roh))
    }
    // Leere Spalte ⇒ die Achse benennt nur das Maß für die Menge und filtert nicht.
    if (werte.size === 0) continue

    const { treffer, aufgerundet: hoch } = waehleStufe([...werte.values()], gesucht)
    if (!treffer) {
      const groesste = [...werte.values()]
        .map((w) => w.cm)
        .filter((n): n is number => n != null)
        .sort((a, b) => b - a)[0]
      return {
        status: 'auf-anfrage',
        artikel: art,
        grund:
          groesste != null
            ? `${achsenBedeutung(achse)}: ${gesucht} cm liegt über dem größten Standardmaß (${groesste} cm) – Sondermaß, AV-Prüfung.`
            : `${achsenBedeutung(achse)}: ${gesucht} cm ist keiner Stufe zuzuordnen.`,
      }
    }
    kandidaten = kandidaten.filter((z) => z.a[index] === treffer.raw)
    aufgerundet = aufgerundet || hoch
    gewaehlteStufen.push(treffer.raw)
  }

  if (kandidaten.length === 0) {
    return { status: 'auf-anfrage', artikel: art, grund: gefragtText(art, anfrage) }
  }

  // --- 3) Nach Bezugsgröße gruppieren ----------------------------------------------
  const preisartIndex = art.achsen.findIndex((a) => achsenArt(a) === 'preisart')
  const teile: PreisTeil[] = []
  const gesehen = new Set<Preisart>()

  for (const zeile of kandidaten) {
    const preisart = preisartIndex >= 0 ? parsePreisart(zeile.a[preisartIndex]) : parsePreisart(undefined)
    // Je Bezugsgröße zählt die erste Zeile. Mehrere Zeilen mit derselben Bezugsgröße
    // sind ein Pflegefehler; still zu addieren wäre die teuerste Art, ihn zu verstecken.
    if (gesehen.has(preisart)) continue
    if (zeile.preis == null) continue
    gesehen.add(preisart)
    teile.push({ zeile, preis: zeile.preis, preisart, seite: zeile.seite })
    if (preisartIndex < 0) break
  }

  if (teile.length === 0) {
    const erste = kandidaten[0]
    return {
      status: 'auf-anfrage',
      artikel: art,
      grund:
        erste.status === 'on-request'
          ? 'Die Preiszeile ist als „auf Anfrage" hinterlegt.'
          : erste.status === 'note'
            ? 'Die Preiszeile trägt einen Hinweis statt eines Betrags.'
            : 'Die Preiszeile trägt keinen Betrag.',
    }
  }

  const leit = teile[0].zeile
  return {
    status: 'gefunden',
    artikel: art,
    teile,
    aufgerundet,
    gewaehlteStufen,
    mengenachsen,
    achsen: art.achsen.map((code, index) => ({
      code,
      bedeutung: achsenBedeutung(code),
      spalte: `A${index + 1}`,
      wert: leit.a[index] ?? '',
    })),
  }
}

function gefragtText(art: Artikel, anfrage: PreisAnfrage): string {
  const gefragt = art.achsen
    .map((a) => {
      const mass = massAnfrage(a, anfrage)
      if (mass != null) return `${a}=${mass} cm`
      const merkmal = merkmalAnfrage(a, anfrage)
      return merkmal ? `${a}=${merkmal}` : null
    })
    .filter(Boolean)
    .join(', ')
  return `Keine Preiszeile für ${art.bezeichnung} mit ${gefragt || 'diesen Angaben'}.`
}

/** Artikel per Nummer — für Positionslisten, die den vollen Klartext zeigen. */
export function getArtikelNr(artikelnummer: string): Artikel | undefined {
  return aktuelleIndizes().artikelNachNummer.get(artikelnummer)
}

/**
 * Die bepreisten Rasterstufen eines Artikels.
 *
 * Nach der Reform steht das Raster nur noch als ETIKETT an der Höhenachse („235 cm | 18R");
 * maßgeblich ist der Zentimeterwert. Diese Funktion liest die Etiketten zurück, damit
 * Auswahlfelder weiterhin „18 Raster" anbieten können.
 */
export function verfuegbareRaster(artikelnummer: string): number[] {
  const werte = new Set<number>()
  for (const stufe of verfuegbareStufen(artikelnummer, 'HOEHE')) {
    const zahl = parseZahl(/^([\d.,]+)\s*R$/i.exec(stufe.etikett)?.[1])
    if (zahl != null) werte.add(zahl)
  }
  return [...werte].sort((a, b) => a - b)
}

/**
 * Zentimeterhöhe zu einem Raster-Etikett eines Artikels („4,5R" ⇒ 57,3 cm).
 *
 * Genau das war der Anlass der Reform: „Raster bei Korpus und Drehtüren zum Beispiel
 * unterschiedlich (keine universelle Maßeinheit)." Die Umrechnung steht deshalb nicht
 * mehr im Code, sondern in der Preiszeile des jeweiligen Artikels — hier wird sie nur
 * nachgeschlagen.
 */
export function hoeheFuerRasterEtikett(artikelnummer: string, raster: number): number | undefined {
  for (const stufe of verfuegbareStufen(artikelnummer, 'HOEHE')) {
    const zahl = parseZahl(/^([\d.,]+)\s*R$/i.exec(stufe.etikett)?.[1])
    if (zahl != null && Math.abs(zahl - raster) < 0.001) return stufe.cm ?? undefined
  }
  return undefined
}
