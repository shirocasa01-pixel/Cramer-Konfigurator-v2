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
 *   Produktgruppe = ein Schritt im Konfigurator
 *     └── Artikelgruppe = ein Dropdown in diesem Schritt
 *           └── Artikel = die Einträge, gefiltert über Modus und Status
 */

import {
  SERIEN_CODES,
  artikelgruppen as alleArtikelgruppen,
  artikelnummerLogik,
  filialen as alleFilialen,
  meta,
  mitarbeiter as alleMitarbeiter,
  produktgruppen as alleProduktgruppen,
  serien,
  type Artikel,
  type Artikelgruppe,
  type ArtikelgruppeCode,
  type Filiale,
  type Mitarbeiter,
  type Preiszeile,
  type Produktgruppe,
  type ProduktgruppeCode,
  type Serie,
  type SerienCode,
  type SerienId,
  // Explizite `.ts`-Endung: dieses Modul wird auch von `scripts/*.js` direkt in Node
  // geladen (Type Stripping), und Nodes ESM-Resolver kennt keine endungslosen Pfade.
} from '../data/stammdaten.generated.ts'
import { istSonderanfertigung, modusErlaubt, parseModus } from './modus.ts'
import { getArtikelNr } from './preisLookup.ts'
import { getArtikelListe, getPreisListe } from './stammdatenStore.ts'

export type {
  Artikel,
  Artikelgruppe,
  ArtikelgruppeCode,
  Filiale,
  Mitarbeiter,
  Preiszeile,
  Produktgruppe,
  ProduktgruppeCode,
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
  produktgruppe?: ProduktgruppeCode
  /** Nur Artikel dieses Dropdowns. */
  artikelgruppe?: ArtikelgruppeCode
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
      if (filter.produktgruppe && a.produktgruppe !== filter.produktgruppe) return false
      if (filter.artikelgruppe && a.artikelgruppe !== filter.artikelgruppe) return false
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

/** Die Einträge eines Dropdowns — Artikelgruppe × Serie, wie im Blatt „00 Anleitung" beschrieben. */
export function dropdownEintraege(
  artikelgruppe: ArtikelgruppeCode,
  serieId: string | undefined,
): Artikel[] {
  return findeArtikel({ artikelgruppe, serieId })
}

// ---------------------------------------------------------------------------
// Schritte & Dropdowns
// ---------------------------------------------------------------------------

/** Konfigurator-Schritte in der Reihenfolge der Mappe. */
export const schritte: readonly Produktgruppe[] = [...alleProduktgruppen].sort(
  (a, b) => a.reihenfolge - b.reihenfolge,
)

/**
 * Die Dropdowns eines Schritts — leer gefilterte weggelassen, wenn eine Serie gesetzt ist.
 * Damit verschwindet z. B. „Abdeckplatte" für Refugium automatisch, weil kein einziger
 * Abdeckplatten-Artikel ein `R` im Modus trägt.
 */
export function dropdownsFuerSchritt(
  produktgruppe: ProduktgruppeCode,
  serieId?: string,
): Artikelgruppe[] {
  return alleArtikelgruppen
    .filter((ag) => ag.produktgruppe === produktgruppe)
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
  teileart: string
  produktgruppe: string
  artikelgruppe: string
  laufend: string
}

/**
 * Zerlegt `30-30-05-0011` anhand der im Markdown beschriebenen Blockstruktur.
 * Ändert sich das Nummernschema dort, ändert sich diese Funktion mit.
 */
export function parseArtikelnummer(nr: string): ArtikelnummerTeile | null {
  const bloecke = artikelnummerLogik.bloecke
  const teile = nr.split(artikelnummerLogik.trennzeichen)
  if (teile.length !== bloecke.length) return null
  if (!teile.every((teil, i) => teil.length === bloecke[i].laenge && /^\d+$/.test(teil))) return null
  return {
    teileart: teile[0],
    produktgruppe: teile[1],
    artikelgruppe: teile[2],
    laufend: teile[3],
  }
}

/** Präfix-Suche wie im ERP: `30-` alle Beschläge, `20-20-05-` alle Drehtüren. */
export function sucheNachPraefix(praefix: string): Artikel[] {
  return getArtikelListe().filter((a) => a.artikelnummer.startsWith(praefix))
}

// ---------------------------------------------------------------------------
// Berater & Filialen
// ---------------------------------------------------------------------------

/** Nur aktive Berater — das Berater-Dropdown und die Anmeldung. */
export const berater: readonly Mitarbeiter[] = alleMitarbeiter.filter(
  (m) => m.rolle === 'berater' && m.status === 'aktiv',
)

export const administratoren: readonly Mitarbeiter[] = alleMitarbeiter.filter(
  (m) => m.rolle === 'admin' && m.status === 'aktiv',
)

export const mitarbeiter: readonly Mitarbeiter[] = alleMitarbeiter

export function getMitarbeiter(personalnr: string | undefined): Mitarbeiter | undefined {
  return personalnr ? alleMitarbeiter.find((m) => m.personalnr === personalnr) : undefined
}

export function getMitarbeiterByEmail(email: string | undefined): Mitarbeiter | undefined {
  const gesucht = email?.trim().toLowerCase()
  return gesucht ? alleMitarbeiter.find((m) => m.email.toLowerCase() === gesucht) : undefined
}

export const filialen: readonly Filiale[] = alleFilialen.filter((f) => f.status !== 'gesperrt')

/**
 * Filiale per Filialnummer — oder per früherer Code-ID (Spalte `Alt-ID`).
 *
 * Gespeicherte Entwürfe tragen in `Draft.branchId` noch Slugs wie
 * `cramer-wohnvilla-hamburg`. Die Zuordnung steht in der Mappe, nicht im Code.
 */
export function getFiliale(idOderAltId: string | undefined): Filiale | undefined {
  if (!idOderAltId) return undefined
  return (
    alleFilialen.find((f) => f.filialnr === idOderAltId) ??
    alleFilialen.find((f) => f.altId === idOderAltId)
  )
}
