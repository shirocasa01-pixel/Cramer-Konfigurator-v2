/**
 * PREIS-LOOKUP — Artikelnummer + Achsenwerte → Preiszelle.
 *
 * Ersetzt die frühere Suche über Kategorie-Klartext (`category: 'Refugium Ausstattung'`,
 * `subcategory: 'Korpus 18 Raster (235cm hoch)'`) durch den Zugriff über die
 * Artikelnummern-Hierarchie. Statt Zeichenketten zu treffen, wird der Artikel adressiert
 * und über seine Achsen eingegrenzt:
 *
 *     10-10-05-0003  Korpus (Refugium)   BREITE × RASTER      60er · 18   →  258 EUR
 *     20-20-05-0001  Drehtür             BREITE × RASTER × LINIE_PG       →  348 EUR
 *
 * Zwei Regeln aus der gedruckten Preisliste sind hier abgebildet:
 *
 *   • BREITE  „Preis des nächstgrößeren Maßes" — ein Individualmaß wird auf das nächste
 *              bepreiste Bracket gehoben. Über dem größten Bracket ⇒ Sondermaß.
 *   • TIEFE / PG  Das Komma ist eine AUFZÄHLUNG („25,30" = zwei Tiefen), keine Dezimalstelle.
 *
 * Findet sich keine Zelle, kommt `auf-anfrage` zurück — nie ein geschätzter Preis.
 * Das Ergebnis trägt die aufgelösten Achsen im Klartext mit, damit Positionsliste und
 * AV-PDF zeigen können, WARUM dieser Preis gilt.
 */

import {
  achsen as achsenKatalog,
  type AchseCode,
  type Artikel,
  type Preiszeile,
} from '../data/stammdaten.generated.ts'
import { achsenwertPasst, parseBreite, parseZahl, waehleBreite, type BreitenWert } from './preisAchsen.ts'
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

/** Achsen, deren Komma eine Aufzählung ist. */
const LISTEN_ACHSEN: ReadonlySet<AchseCode> = new Set<AchseCode>(['PG', 'TIEFE'])

/** Achsen, die als Zahl verglichen werden („1.5" ≡ „1,5"). */
const ZAHL_ACHSEN: ReadonlySet<AchseCode> = new Set<AchseCode>(['RASTER', 'TIEFE'])

// ---------------------------------------------------------------------------
// Anfrage & Ergebnis
// ---------------------------------------------------------------------------

/**
 * Anforderungen an die Achsen. Nicht gesetzte Achsen filtern nicht — ein Artikel mit
 * einer einzigen Preiszelle braucht gar keine Angabe.
 */
export interface PreisAnfrage {
  artikelnummer: string
  /** Verlangte Breite in cm; wird auf das nächstgrößere Bracket gehoben. */
  breiteCm?: number
  /** Rasterstufe — vorher über `verfuegbareRaster()` auf eine bepreiste Stufe heben. */
  raster?: number
  /** Stil-Linie + Preisgruppe als kombinierter Achsenwert, z. B. „Glatt2". */
  liniePg?: string
  /** Material-Preisgruppe, wenn PG eine eigene Achse ist. */
  pg?: string
  tiefeCm?: number
  variante?: string
  /** Wert der Achse BEDINGUNG (Staffel aus der Preisliste). */
  bedingung?: string
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

export type PreisErgebnis =
  | {
      status: 'gefunden'
      artikel: Artikel
      zeile: Preiszeile
      preis: number
      achsen: AufgelloesteAchse[]
      /** true, wenn die Breite auf ein größeres Bracket gehoben wurde. */
      aufgerundet: boolean
      /** Der gewählte Breitenwert im Original („100er"), falls die Breite eine Achse ist. */
      gewaehlteBreite?: string
    }
  | { status: 'auf-anfrage'; artikel?: Artikel; grund: string }

// ---------------------------------------------------------------------------
// Achsen-Metadaten
// ---------------------------------------------------------------------------

/** Klartext-Bedeutung einer Achse aus Blatt „35 Achsen" (z. B. BREITE → „Breite in cm"). */
function bedeutungVon(code: AchseCode): string {
  return achsenKatalog.find((a) => a.code === code)?.bedeutung ?? code
}

/** Die tatsächlich bepreisten Rasterstufen eines Artikels — aus den Daten, nicht hinterlegt. */
export function verfuegbareRaster(artikelnummer: string): number[] {
  const { artikelNachNummer, zeilenNachArtikel } = aktuelleIndizes()
  const art = artikelNachNummer.get(artikelnummer)
  if (!art) return []
  const index = art.achsen.indexOf('RASTER')
  if (index < 0) return []
  const werte = new Set<number>()
  for (const zeile of zeilenNachArtikel.get(artikelnummer) ?? []) {
    const zahl = parseZahl(zeile.a[index])
    if (zahl != null) werte.add(zahl)
  }
  return [...werte].sort((a, b) => a - b)
}

/**
 * Die tatsächlich bepreisten Tiefenstufen eines Artikels (cm), aufsteigend.
 *
 * Gegenstück zu `verfuegbareRaster()`: Die Preisliste führt die Tiefe in Stufen
 * (31 · 41 · 60 cm), der Berater gibt aber ein Zentimetermaß ein. Damit die
 * Preislisten-Regel „Preis des nächstgrößeren Maßes" auch hier greift, muss die
 * Kalkulation die Stufen kennen — genau wie bei den Rastern. Die Liste kommt aus
 * den Daten, nicht aus einer Konstante: eine neue Tiefe in der Mappe wirkt sofort.
 */
export function verfuegbareTiefen(artikelnummer: string): number[] {
  const { artikelNachNummer, zeilenNachArtikel } = aktuelleIndizes()
  const art = artikelNachNummer.get(artikelnummer)
  if (!art) return []
  const index = art.achsen.indexOf('TIEFE')
  if (index < 0) return []
  const werte = new Set<number>()
  for (const zeile of zeilenNachArtikel.get(artikelnummer) ?? []) {
    // Das Komma ist in dieser Achse eine Aufzählung („25,30" = zwei Tiefen).
    for (const teil of zeile.a[index].split(',')) {
      const zahl = parseZahl(teil)
      if (zahl != null) werte.add(zahl)
    }
  }
  return [...werte].sort((a, b) => a - b)
}

/** Die bepreisten Breitenwerte eines Artikels, bereits eingeordnet. */
export function verfuegbareBreiten(artikelnummer: string): BreitenWert[] {
  const { artikelNachNummer, zeilenNachArtikel } = aktuelleIndizes()
  const art = artikelNachNummer.get(artikelnummer)
  if (!art) return []
  const index = art.achsen.indexOf('BREITE')
  if (index < 0) return []
  const gesehen = new Map<string, BreitenWert>()
  for (const zeile of zeilenNachArtikel.get(artikelnummer) ?? []) {
    const roh = zeile.a[index]
    if (roh && !gesehen.has(roh)) gesehen.set(roh, parseBreite(roh))
  }
  return [...gesehen.values()]
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/** Wert der Anfrage für eine bestimmte Achse (ohne BREITE — die läuft über Brackets). */
function anfragewert(achse: AchseCode, anfrage: PreisAnfrage): string | undefined {
  switch (achse) {
    case 'RASTER':
      return anfrage.raster != null ? String(anfrage.raster) : undefined
    case 'LINIE_PG':
      return anfrage.liniePg
    case 'PG':
      return anfrage.pg
    case 'TIEFE':
      return anfrage.tiefeCm != null ? String(anfrage.tiefeCm) : undefined
    case 'VARIANTE':
      return anfrage.variante
    case 'BEDINGUNG':
      return anfrage.bedingung
    default:
      return undefined
  }
}

/**
 * Sucht die Preiszelle zu einer Anfrage.
 *
 * Ablauf: erst alle Achsen außer BREITE als harte Filter anwenden, dann unter den
 * verbliebenen Zeilen das passende Breiten-Bracket wählen.
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
          : 'Für diesen Artikel ist keine Preiszelle hinterlegt.',
    }
  }

  // --- 1) Alle Achsen außer BREITE als harte Filter -------------------------------
  const breitenIndex = art.achsen.indexOf('BREITE')
  art.achsen.forEach((achse, index) => {
    if (index === breitenIndex) return
    const soll = anfragewert(achse, anfrage)
    if (soll == null || soll === '') return
    const gefiltert = kandidaten.filter((zeile) =>
      achsenwertPasst(zeile.a[index], soll, {
        listenAchse: LISTEN_ACHSEN.has(achse),
        numerisch: ZAHL_ACHSEN.has(achse),
      }),
    )
    // Führt ein Filter ins Leere, bleibt das Feld leer – der Grund wird unten gemeldet.
    kandidaten = gefiltert
  })

  if (kandidaten.length === 0) {
    const gefragt = art.achsen
      .map((a) => ({ a, v: anfragewert(a, anfrage) }))
      .filter((x) => x.v)
      .map((x) => `${x.a}=${x.v}`)
      .join(', ')
    return {
      status: 'auf-anfrage',
      artikel: art,
      grund: `Keine Preiszeile für ${art.bezeichnung} mit ${gefragt || 'diesen Angaben'}.`,
    }
  }

  // --- 2) Breiten-Bracket ----------------------------------------------------------
  let gewaehlt = kandidaten[0]
  let aufgerundet = false
  let gewaehlteBreite: string | undefined

  if (breitenIndex >= 0 && anfrage.breiteCm != null) {
    const werte = new Map<string, BreitenWert>()
    for (const zeile of kandidaten) {
      const roh = zeile.a[breitenIndex]
      if (roh && !werte.has(roh)) werte.set(roh, parseBreite(roh))
    }
    const { treffer, aufgerundet: hochgesetzt } = waehleBreite([...werte.values()], anfrage.breiteCm)
    if (!treffer) {
      const groesste = [...werte.values()]
        .map((w) => w.sortCm)
        .filter((n): n is number => n != null)
        .sort((a, b) => b - a)[0]
      return {
        status: 'auf-anfrage',
        artikel: art,
        grund:
          groesste != null
            ? `Breite ${anfrage.breiteCm} cm liegt über dem größten Standardmaß (${groesste} cm) – Sondermaß, AV-Prüfung.`
            : `Breite ${anfrage.breiteCm} cm ist keinem Bracket zuzuordnen.`,
      }
    }
    const passend = kandidaten.find((z) => z.a[breitenIndex] === treffer.raw)
    if (!passend) {
      return { status: 'auf-anfrage', artikel: art, grund: `Breiten-Bracket „${treffer.raw}" nicht auflösbar.` }
    }
    gewaehlt = passend
    aufgerundet = hochgesetzt
    gewaehlteBreite = treffer.raw
  }

  if (gewaehlt.preis == null) {
    return {
      status: 'auf-anfrage',
      artikel: art,
      grund:
        gewaehlt.status === 'on-request'
          ? 'Die Preiszeile ist als „auf Anfrage" hinterlegt.'
          : 'Die Preiszeile trägt keinen Betrag.',
    }
  }

  return {
    status: 'gefunden',
    artikel: art,
    zeile: gewaehlt,
    preis: gewaehlt.preis,
    aufgerundet,
    gewaehlteBreite,
    achsen: art.achsen.map((code, index) => ({
      code,
      bedeutung: bedeutungVon(code),
      spalte: `A${index + 1}`,
      wert: gewaehlt.a[index] ?? '',
    })),
  }
}

/** Artikel per Nummer — für Positionslisten, die den vollen Klartext zeigen. */
export function getArtikelNr(artikelnummer: string): Artikel | undefined {
  return aktuelleIndizes().artikelNachNummer.get(artikelnummer)
}
