/**
 * SCHRITT 3 — Zugriff auf die Stammdaten.
 *
 * Einzige Anlaufstelle für Artikel, Preise, Serien, Berater und Filialen. Die Daten
 * kommen aus `src/data/stammdaten.generated.ts`, das aus `Cramer-Stammdaten.xlsx` und
 * `ARTIKELNUMMER-LOGIK.md` erzeugt wird (`npm run data:build`). Nichts davon ist im
 * Code hinterlegt — eine neue Serie, ein neuer Griff oder ein geänderter Preis ist
 * eine Zeile in der Mappe.
 *
 * Die Dropdown-Regel steht so im Blatt „00 Anleitung":
 *
 *   Teileart = ein Schritt im Konfigurator
 *     └── Dropdown = ein Dropdown in diesem Schritt
 *           └── Artikel = die Einträge, gefiltert über Modus und Status
 */

import {
  SERIEN_CODES,
  dropdowns as alleDropdowns,
  artikelnummerLogik,
  meta,
  teilearten as alleTeilearten,
  serien,
  type Artikel,
  type Dropdown,
  type DropdownCode,
  type Filiale,
  type Mitarbeiter,
  type Preiszeile,
  type Teileart,
  type TeileartCode,
  type Serie,
  type SerienCode,
  type SerienId,
  // Explizite `.ts`-Endung: dieses Modul wird auch von `scripts/*.js` direkt in Node
  // geladen (Type Stripping), und Nodes ESM-Resolver kennt keine endungslosen Pfade.
} from '../data/stammdaten.generated.ts'
import { istSonderanfertigung, modusErlaubt, parseModus } from './modus.ts'
import { getArtikelNr } from './preisLookup.ts'
import {
  getArtikelListe,
  getFilialenListe,
  getMitarbeiterListe,
  getPreisListe,
} from './stammdatenStore.ts'

export type {
  Artikel,
  Dropdown,
  DropdownCode,
  Filiale,
  Mitarbeiter,
  Preiszeile,
  Teileart,
  TeileartCode,
  Serie,
  SerienCode,
  SerienId,
}
export { artikelnummerLogik, meta, serien }

// ---------------------------------------------------------------------------
// Serien
// ---------------------------------------------------------------------------

const serieNachId = new Map<string, Serie>(serien.map((s) => [s.id, s]))
const serieNachCode = new Map<string, Serie>(serien.map((s) => [s.code, s]))

export function getSerie(id: string | undefined): Serie | undefined {
  return id ? serieNachId.get(id) : undefined
}

export function getSerieByCode(code: string | undefined): Serie | undefined {
  return code ? serieNachCode.get(code.toUpperCase()) : undefined
}

/** Die im Modus eines Artikels freigegebenen Serien — in kanonischer Reihenfolge. */
export function serienVon(artikelOderModus: Artikel | string): Serie[] {
  const modus = typeof artikelOderModus === 'string' ? artikelOderModus : artikelOderModus.modus
  return parseModus(modus, SERIEN_CODES).map((code) => serieNachCode.get(code)!)
}

// ---------------------------------------------------------------------------
// Artikel
// ---------------------------------------------------------------------------

export function getArtikel(artikelnummer: string | undefined): Artikel | undefined {
  return artikelnummer ? getArtikelNr(artikelnummer) : undefined
}

/**
 * Steht dieser Artikel für die Serie zur Verfügung?
 * Fehlertolerant gegenüber der Schreibweise in der Excel (siehe `lib/modus.ts`):
 * `RP`, `R, P`, `R/P`, `R - P` und `_R_P_` führen alle zum selben Ergebnis.
 */
export function istVerfuegbar(artikel: Artikel, serieId: string | undefined): boolean {
  const serie = getSerie(serieId)
  return serie ? modusErlaubt(artikel.modus, serie.code) : false
}

/** Freigegeben, aber nur als Sonderanfertigung (Kleinbuchstabe) — Preis auf Anfrage. */
export function istSonderanfertigungFuer(artikel: Artikel, serieId: string | undefined): boolean {
  const serie = getSerie(serieId)
  return serie ? istSonderanfertigung(artikel.modus, serie.code) : false
}

export interface ArtikelFilter {
  /** Nur Artikel, die für diese Serie freigegeben sind. */
  serieId?: string
  /** Nur Artikel dieses Konfigurator-Schritts. */
  teileart?: TeileartCode
  /** Nur Artikel dieses Dropdowns. */
  dropdown?: DropdownCode
  /**
   * Gesperrte und Entwurfs-Artikel mitliefern. Standard `false` — laut „00 Anleitung"
   * erscheint im Konfigurator ausschließlich Status `aktiv`.
   */
  auchInaktive?: boolean
}

/** Artikel nach Serie / Schritt / Dropdown, sortiert nach der Spalte `Sortierung`. */
export function findeArtikel(filter: ArtikelFilter = {}): Artikel[] {
  const serie = getSerie(filter.serieId)
  if (filter.serieId && !serie) return []

  return getArtikelListe()
    .filter((a) => {
      if (!filter.auchInaktive && a.status !== 'aktiv') return false
      if (serie && !modusErlaubt(a.modus, serie.code)) return false
      if (filter.teileart && a.teileart !== filter.teileart) return false
      if (filter.dropdown && a.dropdown !== filter.dropdown) return false
      return true
    })
    .sort(
      (a, b) =>
        (a.sortierung ?? Number.MAX_SAFE_INTEGER) - (b.sortierung ?? Number.MAX_SAFE_INTEGER) ||
        a.bezeichnung.localeCompare(b.bezeichnung, 'de'),
    )
}

/** Kurzform: alle für eine Serie freigegebenen Artikel. */
export function artikelFuerSerie(serieId: string | undefined): Artikel[] {
  return findeArtikel({ serieId })
}

/** Die Einträge eines Dropdowns — Dropdown × Serie, wie im Blatt „00 Anleitung" beschrieben. */
export function dropdownEintraege(
  dropdown: DropdownCode,
  serieId: string | undefined,
): Artikel[] {
  return findeArtikel({ dropdown, serieId })
}

// ---------------------------------------------------------------------------
// Schritte & Dropdowns
// ---------------------------------------------------------------------------

/** Konfigurator-Schritte in der Reihenfolge der Mappe. */
export const schritte: readonly Teileart[] = [...alleTeilearten].sort(
  (a, b) => a.reihenfolge - b.reihenfolge,
)

/**
 * Die Dropdowns eines Schritts — leer gefilterte weggelassen, wenn eine Serie gesetzt ist.
 * Damit verschwindet z. B. „Abdeckplatte" für Refugium automatisch, weil kein einziger
 * Abdeckplatten-Artikel ein `R` im Modus trägt.
 */
export function dropdownsFuerSchritt(
  teileart: TeileartCode,
  serieId?: string,
): Dropdown[] {
  return alleDropdowns
    .filter((ag) => ag.teileart === teileart)
    .filter((ag) => serieId === undefined || dropdownEintraege(ag.code, serieId).length > 0)
    .sort((a, b) => a.nr.localeCompare(b.nr))
}

// ---------------------------------------------------------------------------
// Preise
// ---------------------------------------------------------------------------

/** Alle Preiszellen eines Artikels. Ihre Achsen-Bedeutung steht in `Artikel.achsen`. */
export function preiseFuer(artikelnummer: string): Preiszeile[] {
  return getPreisListe().filter((p) => p.artikel === artikelnummer)
}

/**
 * Preiszelle über die Achsenwerte. Verglichen wird nur, was übergeben wird — `['-80cm']`
 * trifft also jede Zeile mit A1 = „-80cm", unabhängig von A2–A5.
 *
 * Kein Treffer liefert bewusst `undefined` statt eines geratenen Preises: die Preisliste
 * ist eine PDF-Extraktion mit dokumentierten Lücken, und ein falscher Preis im
 * Kundengespräch ist teurer als ein „auf Anfrage".
 */
export function findePreis(artikelnummer: string, achsenwerte: string[]): Preiszeile | undefined {
  return preiseFuer(artikelnummer).find((zeile) =>
    achsenwerte.every(
      (wert, i) => wert === '' || zeile.a[i]?.toLowerCase() === wert.toLowerCase(),
    ),
  )
}

// ---------------------------------------------------------------------------
// Artikelnummer
// ---------------------------------------------------------------------------

export interface ArtikelnummerTeile {
  /** Block 1, zweistellig — Hauptschritt im Konfigurator. */
  teileart: string
  /** Block 2, dreistellig und systemweit eindeutig — das Auswahlfeld. */
  dropdown: string
  /** Block 3, vierstellig — laufende Nummer innerhalb des Dropdowns. */
  laufend: string
}

/**
 * Zerlegt `30-012-0011` anhand der im Markdown beschriebenen Blockstruktur.
 * Ändert sich das Nummernschema dort, ändert sich diese Funktion mit.
 */
export function parseArtikelnummer(nr: string): ArtikelnummerTeile | null {
  const bloecke = artikelnummerLogik.bloecke
  const teile = nr.split(artikelnummerLogik.trennzeichen)
  if (teile.length !== bloecke.length) return null
  if (!teile.every((teil, i) => teil.length === bloecke[i].laenge && /^\d+$/.test(teil))) return null
  return {
    teileart: teile[0],
    dropdown: teile[1],
    laufend: teile[2],
  }
}

/** Präfix-Suche wie im ERP: `30-` alle Beschläge, `20-20-05-` alle Drehtüren. */
export function sucheNachPraefix(praefix: string): Artikel[] {
  return getArtikelListe().filter((a) => a.artikelnummer.startsWith(praefix))
}

// ---------------------------------------------------------------------------
// Berater & Filialen
// ---------------------------------------------------------------------------

/**
 * Berater und Filialen kommen aus dem ARBEITSSTAND, nicht aus dem generierten Grundstand.
 *
 * Bis dahin waren es Modul-Konstanten über `stammdaten.generated.ts` — eine Sperrung in
 * der Verwaltung erreichte den Konfigurator damit überhaupt nicht, auch nicht nach einem
 * Neuladen. Seit „Löschen" durch den Status ersetzt ist, MUSS „gesperrt" wirken; deshalb
 * sind es Funktionen über dem Store, die bei jedem Aufruf den aktuellen Stand lesen.
 */

/** Nur aktive Berater — das Berater-Dropdown und die Anmeldung. */
export function getBerater(): Mitarbeiter[] {
  return getMitarbeiterListe().filter((m) => m.rolle === 'berater' && m.status === 'aktiv')
}

export function getAdministratoren(): Mitarbeiter[] {
  return getMitarbeiterListe().filter((m) => m.rolle === 'admin' && m.status === 'aktiv')
}

/** Alle Mitarbeiter, auch gesperrte — für die Verwaltung und die Auflösung alter Entwürfe. */
export function getAlleMitarbeiter(): Mitarbeiter[] {
  return getMitarbeiterListe()
}

/**
 * Mitarbeiter per Personalnummer — bewusst OHNE Statusfilter: Ein gesperrter Berater
 * verschwindet aus den Auswahllisten, sein Name muss auf einem alten Angebot aber
 * weiterhin auflösbar bleiben.
 */
export function getMitarbeiter(personalnr: string | undefined): Mitarbeiter | undefined {
  return personalnr ? getMitarbeiterListe().find((m) => m.personalnr === personalnr) : undefined
}

/** Anmeldung: gesperrte Konten werden hier absichtlich NICHT gefunden. */
export function getMitarbeiterByEmail(email: string | undefined): Mitarbeiter | undefined {
  const gesucht = email?.trim().toLowerCase()
  if (!gesucht) return undefined
  return getMitarbeiterListe().find((m) => m.email.toLowerCase() === gesucht && m.status === 'aktiv')
}

/** Auswählbare Filialen — gesperrte fallen heraus. */
export function getFilialenAuswahl(): Filiale[] {
  return getFilialenListe().filter((f) => f.status !== 'gesperrt')
}

/**
 * Filiale per Filialnummer — oder per früherer Code-ID (Spalte `Alt-ID`).
 *
 * Gespeicherte Entwürfe tragen in `Draft.branchId` noch Slugs wie
 * `cramer-wohnvilla-hamburg`. Die Zuordnung steht in der Mappe, nicht im Code.
 * Auch hier ohne Statusfilter — eine gesperrte Filiale muss auf alten Angeboten
 * weiterhin mit Namen und Anschrift erscheinen.
 */
export function getFiliale(idOderAltId: string | undefined): Filiale | undefined {
  if (!idOderAltId) return undefined
  const alle = getFilialenListe()
  return (
    alle.find((f) => f.filialnr === idOderAltId) ?? alle.find((f) => f.altId === idOderAltId)
  )
}
