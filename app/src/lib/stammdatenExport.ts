/**
 * EXCEL-RUNDE — Arbeitsstand exportieren, bearbeitete Mappe wieder einlesen.
 *
 * Die Spaltennamen sind identisch mit denen der Stammdatenmappe („10 Artikel",
 * „20 Preise", „40 Mitarbeiter", „41 Filialen"). Damit ist der Export nicht nur ein
 * Abzug, sondern eine Datei, die man in Excel bearbeiten und unverändert
 * zurückspielen kann — und die sich mit der Original-Mappe vergleichen lässt.
 *
 * Der Import ordnet ausschließlich über die Spaltenüberschriften zu, nicht über die
 * Position. Wer in Excel eine Spalte verschiebt oder eine Hilfsspalte einfügt, bricht
 * damit nichts.
 */

import type { Artikel, Filiale, Mitarbeiter, Preiszeile } from '../data/stammdaten.generated.ts'
import type { Oberflaeche, Oberflaechenkategorie } from '../types/index.ts'
import {
  pruefeArtikel,
  pruefeBlattSchema,
  pruefeFiliale,
  pruefeKategorie,
  pruefeMitarbeiter,
  pruefeOberflaeche,
  pruefePreiszeile,
} from './stammdatenValidierung.ts'
import { parseDezimal } from './format.ts'
import { leseXlsx, schreibeXlsx, ladeHerunter, type GelesenesBlatt, type XlsxBlatt } from './xlsxBrowser.ts'
import { preisSchluessel, type Achsenwerte } from './stammdatenStore.ts'

/**
 * Blattnamen — ein Blatt je Reiter der Stammdatenverwaltung.
 *
 * Der Export bildet damit die Verwaltung 1:1 ab: Wer die Mappe öffnet, findet unten
 * dieselben Reiter wieder, die er im Konfigurator sieht. Der Reiter „Oberflächen" führt
 * zwei Ebenen mit verschiedenen Spalten und wird deshalb auf zwei Blätter aufgeteilt.
 */
export const BLATT = {
  artikel: 'Artikelstamm',
  preise: 'Preisblatt & Achsen',
  kategorien: 'Oberflächenkategorien',
  oberflaechen: 'Oberflächen',
  mitarbeiter: 'Berater',
  filialen: 'Filialen',
} as const

/**
 * Frühere Blattnamen (die der Stammdatenmappe `Cramer-Stammdaten.xlsx`).
 *
 * Der Import akzeptiert beide Schreibweisen: eine unveränderte Original-Mappe lässt sich
 * genauso einspielen wie ein Export aus dieser Anwendung. Sonst wäre der Umstieg auf die
 * Reiter-Namen ein Bruch für jede Datei, die schon im Umlauf ist.
 */
const BLATT_ALIAS: Record<string, string> = {
  '10 Artikel': BLATT.artikel,
  '20 Preise': BLATT.preise,
  '40 Mitarbeiter': BLATT.mitarbeiter,
  '41 Filialen': BLATT.filialen,
}

/** Spalten, ohne die ein Blatt nicht verarbeitbar ist. */
const PFLICHTSPALTEN: Record<string, string[]> = {
  [BLATT.artikel]: ['Artikelnummer', 'Bezeichnung'],
  [BLATT.preise]: ['Artikel', 'Preis'],
  [BLATT.kategorien]: ['ID', 'Bezeichnung'],
  [BLATT.oberflaechen]: ['ID', 'Kategorie', 'Bezeichnung'],
  [BLATT.mitarbeiter]: ['Personalnr', 'Name'],
  [BLATT.filialen]: ['Filialnr', 'Name'],
}

// ---------------------------------------------------------------------------
// Spaltenzuordnung
// ---------------------------------------------------------------------------

const ARTIKEL_SPALTEN: [string, (a: Artikel) => string][] = [
  ['Artikelnummer', (a) => a.artikelnummer],
  ['Kurzzeichen', (a) => a.kurzzeichen],
  ['Bezeichnung', (a) => a.bezeichnung],
  ['Bezeichnung 2', (a) => a.bezeichnung2],
  ['Teileart', (a) => a.teileart],
  ['Dropdown', (a) => a.dropdown],
  ['Modus', (a) => a.modus],
  ['Preislogik', (a) => a.preislogik],
  ['Einheit', (a) => a.einheit],
  ['Achsen', (a) => a.achsenText],
  ['Achse 1', (a) => a.achsen[0] ?? ''],
  ['Achse 2', (a) => a.achsen[1] ?? ''],
  ['Achse 3', (a) => a.achsen[2] ?? ''],
  ['Achse 4', (a) => a.achsen[3] ?? ''],
  ['Achse 5', (a) => a.achsen[4] ?? ''],
  ['Preiszellen', (a) => String(a.preiszellen ?? '')],
  ['Oberfläche', (a) => (a.oberflaeche ? 'J' : 'N')],
  ['Status', (a) => a.status],
  ['Sortierung', (a) => String(a.sortierung ?? '')],
  ['Quelle', (a) => a.quelle],
  ['Bemerkung', (a) => a.bemerkung],
]

const PREIS_SPALTEN: [string, (p: Preiszeile, a: Artikel | undefined) => string][] = [
  ['Artikel', (p) => p.artikel],
  // Die Merkmalsspalten sind in der Mappe Formeln auf „10 Artikel" – hier als Klartext,
  // damit der Export für sich allein lesbar ist. Der Import ignoriert sie.
  ['Bezeichnung', (_p, a) => a?.bezeichnung ?? ''],
  ['Teileart', (_p, a) => a?.teileart ?? ''],
  ['Dropdown', (_p, a) => a?.dropdown ?? ''],
  ['Modus', (_p, a) => a?.modus ?? ''],
  ['Preislogik', (_p, a) => a?.preislogik ?? ''],
  ['Einheit', (_p, a) => a?.einheit ?? ''],
  ['Achsen', (_p, a) => a?.achsenText ?? ''],
  ['A1', (p) => p.a[0]],
  ['A2', (p) => p.a[1]],
  ['A3', (p) => p.a[2]],
  ['A4', (p) => p.a[3]],
  ['A5', (p) => p.a[4]],
  ['Preis', (p) => (p.preis == null ? '' : String(p.preis))],
  ['Status', (p) => p.status],
  ['Seite', (p) => p.seite],
  ['Ref', (p) => String(p.ref ?? '')],
]

const MITARBEITER_SPALTEN: [string, (m: Mitarbeiter) => string][] = [
  ['Personalnr', (m) => m.personalnr],
  ['Name', (m) => m.name],
  ['E-Mail', (m) => m.email],
  ['Rolle', (m) => m.rolle],
  ['Filiale', (m) => m.filiale],
  ['Status', (m) => m.status],
  ['Bemerkung', (m) => m.bemerkung],
]

const FILIAL_SPALTEN: [string, (f: Filiale) => string][] = [
  ['Filialnr', (f) => f.filialnr],
  ['Name', (f) => f.name],
  ['Straße', (f) => f.strasse],
  ['PLZ', (f) => f.plz],
  ['Ort', (f) => f.ort],
  ['Telefon', (f) => f.telefon],
  ['E-Mail', (f) => f.email],
  ['Status', (f) => f.status],
  ['Alt-ID', (f) => f.altId],
]

const KATEGORIE_SPALTEN: [string, (k: Oberflaechenkategorie) => string][] = [
  ['ID', (k) => k.id],
  ['Bezeichnung', (k) => k.bezeichnung],
  ['Preisgruppe', (k) => k.preisgruppe ?? ''],
  ['Standardauswahl', (k) => (k.standardauswahl ? 'J' : 'N')],
  ['Sortierung', (k) => String(k.sortierung ?? '')],
  ['Status', (k) => k.status],
  ['Bemerkung', (k) => k.bemerkung],
]

const OBERFLAECHEN_SPALTEN: [string, (o: Oberflaeche) => string][] = [
  ['ID', (o) => o.id],
  ['Kategorie', (o) => o.kategorie],
  ['Bezeichnung', (o) => o.bezeichnung],
  ['Abweichende Preisgruppe', (o) => o.preisgruppe ?? ''],
  ['Freitextfeld', (o) => (o.freitext ? 'J' : 'N')],
  ['Freitext-Beschriftung', (o) => o.freitextLabel],
  ['Sortierung', (o) => String(o.sortierung ?? '')],
  ['Status', (o) => o.status],
  ['Bemerkung', (o) => o.bemerkung],
]

function baueBlatt<T, E>(
  name: string,
  spalten: [string, (eintrag: T, extra: E) => string][],
  eintraege: readonly T[],
  extra: (eintrag: T) => E,
): XlsxBlatt {
  return {
    name,
    zeilen: [
      spalten.map(([titel]) => titel),
      ...eintraege.map((e) => spalten.map(([, lies]) => lies(e, extra(e)))),
    ],
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface ExportDaten {
  artikel: readonly Artikel[]
  preise: readonly Preiszeile[]
  mitarbeiter: readonly Mitarbeiter[]
  filialen: readonly Filiale[]
  oberflaechenkategorien: readonly Oberflaechenkategorie[]
  oberflaechen: readonly Oberflaeche[]
}

/**
 * Schreibt den übergebenen Stand als `.xlsx` und stößt den Download an.
 * Übergeben wird, was gerade sichtbar ist — gefiltert exportieren ist damit möglich.
 */
export function exportiereXlsx(daten: ExportDaten, dateiname?: string): string {
  const artikelNach = new Map(daten.artikel.map((a) => [a.artikelnummer, a]))

  // Reihenfolge wie die Reiter der Verwaltung — die Mappe liest sich wie das Programm.
  const blaetter: XlsxBlatt[] = [
    baueBlatt(BLATT.artikel, ARTIKEL_SPALTEN, daten.artikel, () => undefined as never),
    baueBlatt(BLATT.preise, PREIS_SPALTEN, daten.preise, (p) => artikelNach.get(p.artikel)),
    baueBlatt(BLATT.kategorien, KATEGORIE_SPALTEN, daten.oberflaechenkategorien, () => undefined as never),
    baueBlatt(BLATT.oberflaechen, OBERFLAECHEN_SPALTEN, daten.oberflaechen, () => undefined as never),
    baueBlatt(BLATT.mitarbeiter, MITARBEITER_SPALTEN, daten.mitarbeiter, () => undefined as never),
    baueBlatt(BLATT.filialen, FILIAL_SPALTEN, daten.filialen, () => undefined as never),
  ]

  const stempel = new Date().toISOString().slice(0, 10)
  const name = dateiname ?? `Cramer-Stammdaten-${stempel}.xlsx`
  ladeHerunter(schreibeXlsx(blaetter), name)
  return name
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/** Ein importierter Datensatz, der die Regeln nicht erfüllt — übernommen, aber markiert. */
export interface ImportProblem {
  bereich: 'artikel' | 'preise' | 'oberflaechen' | 'berater' | 'filialen'
  /** Zeilen-ID im Gitter des Bereichs — Sprungziel für „zur Änderung". */
  zeilenId: string
  titel: string
  probleme: string[]
}

export interface ImportErgebnis {
  artikel?: Artikel[]
  preise?: Preiszeile[]
  mitarbeiter?: Mitarbeiter[]
  filialen?: Filiale[]
  oberflaechenkategorien?: Oberflaechenkategorie[]
  oberflaechen?: Oberflaeche[]
  /** Was gelesen wurde und was auffiel — wird dem Benutzer gezeigt. */
  meldungen: string[]
  /** Übernommene, aber unvollständige/fehlerhafte Datensätze. */
  probleme: ImportProblem[]
}

const jaNein = (v: string | undefined) => (v ?? '').trim().toUpperCase() === 'J'

const achsenWert = (roh: string) => roh.trim()

function leseArtikelBlatt(blatt: GelesenesBlatt, meldungen: string[]): Artikel[] {
  const artikel: Artikel[] = []
  for (const z of blatt.zeilen) {
    const nummer = (z['Artikelnummer'] ?? '').trim()
    if (!nummer) continue
    const achsen = [1, 2, 3, 4, 5]
      .map((i) => achsenWert(z[`Achse ${i}`] ?? ''))
      .filter(Boolean) as Artikel['achsen']
    artikel.push({
      artikelnummer: nummer,
      kurzzeichen: z['Kurzzeichen'] ?? '',
      bezeichnung: z['Bezeichnung'] ?? '',
      bezeichnung2: z['Bezeichnung 2'] ?? '',
      // Alt-Mappen kennen noch „Produktgruppe" bzw. „Artikelgruppe". Beide werden als
      // Aliase akzeptiert, damit eine vor der Umstellung exportierte Datei nicht wertlos wird.
      teileart: (z['Teileart'] ?? z['Produktgruppe'] ?? '') as Artikel['teileart'],
      dropdown: (z['Dropdown'] ?? z['Artikelgruppe'] ?? '') as Artikel['dropdown'],
      modus: z['Modus'] ?? '',
      preislogik: (z['Preislogik'] ?? '') as Artikel['preislogik'],
      einheit: z['Einheit'] ?? '',
      achsenText: z['Achsen'] ?? (achsen.length ? achsen.join(' × ') : '—'),
      achsen,
      preiszellen: parseDezimal(z['Preiszellen']),
      oberflaeche: (z['Oberfläche'] ?? '').trim().toUpperCase() === 'J',
      status: (z['Status'] ?? 'aktiv') as Artikel['status'],
      sortierung: parseDezimal(z['Sortierung']),
      quelle: z['Quelle'] ?? '',
      bemerkung: z['Bemerkung'] ?? '',
    })
  }
  const doppelt = artikel.length - new Set(artikel.map((a) => a.artikelnummer)).size
  if (doppelt > 0) meldungen.push(`${doppelt} doppelte Artikelnummer(n) im Blatt „${blatt.name}".`)
  return artikel
}

function lesePreisBlatt(blatt: GelesenesBlatt, meldungen: string[]): Preiszeile[] {
  const preise: Preiszeile[] = []
  let ohnePreis = 0
  for (const z of blatt.zeilen) {
    const artikel = (z['Artikel'] ?? '').trim()
    if (!artikel) continue
    const preis = parseDezimal(z['Preis'])
    if (preis == null && (z['Preis'] ?? '').trim() !== '') ohnePreis++
    preise.push({
      artikel,
      a: [z['A1'] ?? '', z['A2'] ?? '', z['A3'] ?? '', z['A4'] ?? '', z['A5'] ?? ''] as Achsenwerte,
      preis,
      status: (z['Status'] ?? 'fixed') as Preiszeile['status'],
      seite: z['Seite'] ?? '',
      ref: parseDezimal(z['Ref']),
    })
  }
  if (ohnePreis > 0) meldungen.push(`${ohnePreis} Preisangabe(n) waren keine Zahl und wurden auf „leer" gesetzt.`)
  return preise
}

/**
 * Liest eine hochgeladene Mappe — Blatt für Blatt, Zeile für Zeile geprüft.
 *
 * Der Import bricht NICHT ab. Ein Blatt, dem Pflichtspalten fehlen, wird übersprungen und
 * gemeldet; eine Zeile, die die Regeln verletzt, wird übernommen und in `probleme`
 * vermerkt. Die Verwaltung markiert sie danach im Gitter, sodass sie per Doppelklick
 * nachgearbeitet werden kann — statt dass eine 1.500-Zeilen-Datei am ersten Tippfehler
 * scheitert.
 */
export async function importiereXlsx(datei: File): Promise<ImportErgebnis> {
  const puffer = await datei.arrayBuffer()
  const blaetter = leseXlsx(puffer)
  const meldungen: string[] = []
  const probleme: ImportProblem[] = []
  const ergebnis: ImportErgebnis = { meldungen, probleme }

  if (blaetter.length === 0) {
    meldungen.push('Die Datei enthält kein lesbares Tabellenblatt.')
    return ergebnis
  }

  for (const blatt of blaetter) {
    const name = BLATT_ALIAS[blatt.name] ?? blatt.name
    const pflicht = PFLICHTSPALTEN[name]
    if (!pflicht) {
      meldungen.push(`Blatt „${blatt.name}" übersprungen — kein bekannter Blattname.`)
      continue
    }
    const schemaFehler = pruefeBlattSchema(blatt.name, blatt.kopf, pflicht)
    if (schemaFehler) {
      meldungen.push(schemaFehler)
      continue
    }

    switch (name) {
      case BLATT.artikel:
        ergebnis.artikel = leseArtikelBlatt(blatt, meldungen)
        break
      case BLATT.preise:
        ergebnis.preise = lesePreisBlatt(blatt, meldungen)
        break
      case BLATT.kategorien:
        ergebnis.oberflaechenkategorien = blatt.zeilen
          .filter((z) => (z['ID'] ?? '').trim())
          .map((z) => ({
            id: (z['ID'] ?? '').trim(),
            bezeichnung: z['Bezeichnung'] ?? '',
            preisgruppe: (z['Preisgruppe'] ?? '').trim() as Oberflaechenkategorie['preisgruppe'],
            standardauswahl: jaNein(z['Standardauswahl']),
            sortierung: parseDezimal(z['Sortierung']) ?? 0,
            status: (z['Status'] ?? 'aktiv') as Oberflaechenkategorie['status'],
            bemerkung: z['Bemerkung'] ?? '',
          }))
        break
      case BLATT.oberflaechen:
        ergebnis.oberflaechen = blatt.zeilen
          .filter((z) => (z['ID'] ?? '').trim())
          .map((z) => ({
            id: (z['ID'] ?? '').trim(),
            kategorie: (z['Kategorie'] ?? '').trim(),
            bezeichnung: z['Bezeichnung'] ?? '',
            preisgruppe: (z['Abweichende Preisgruppe'] ?? '').trim() as Oberflaeche['preisgruppe'],
            freitext: jaNein(z['Freitextfeld']),
            freitextLabel: z['Freitext-Beschriftung'] ?? '',
            sortierung: parseDezimal(z['Sortierung']) ?? 0,
            status: (z['Status'] ?? 'aktiv') as Oberflaeche['status'],
            bemerkung: z['Bemerkung'] ?? '',
          }))
        break
      case BLATT.mitarbeiter:
        ergebnis.mitarbeiter = blatt.zeilen
          .filter((z) => (z['Personalnr'] ?? '').trim())
          .map((z) => ({
            personalnr: z['Personalnr'] ?? '',
            name: z['Name'] ?? '',
            email: z['E-Mail'] ?? '',
            rolle: (z['Rolle'] ?? '').toLowerCase(),
            filiale: z['Filiale'] ?? '',
            status: z['Status'] ?? 'aktiv',
            bemerkung: z['Bemerkung'] ?? '',
          }))
        break
      case BLATT.filialen:
        ergebnis.filialen = blatt.zeilen
          .filter((z) => (z['Filialnr'] ?? '').trim())
          .map((z) => ({
            filialnr: z['Filialnr'] ?? '',
            name: z['Name'] ?? '',
            strasse: z['Straße'] ?? '',
            plz: z['PLZ'] ?? '',
            ort: z['Ort'] ?? '',
            telefon: z['Telefon'] ?? '',
            email: z['E-Mail'] ?? '',
            status: z['Status'] ?? 'aktiv',
            altId: z['Alt-ID'] ?? '',
          }))
        break
    }
  }

  pruefeImportZeilen(ergebnis)
  return ergebnis
}

/**
 * Prüft jeden eingelesenen Datensatz gegen das Regelwerk und sammelt die Verstöße.
 *
 * Verweise werden gegen den IMPORT geprüft, nicht gegen den laufenden Bestand: Wer eine
 * Mappe einspielt, will wissen, ob SIE in sich stimmig ist.
 */
function pruefeImportZeilen(ergebnis: ImportErgebnis) {
  const artikelnummern = ergebnis.artikel ? new Set(ergebnis.artikel.map((a) => a.artikelnummer)) : undefined
  const kategorien = ergebnis.oberflaechenkategorien
    ? new Set(ergebnis.oberflaechenkategorien.map((k) => k.id))
    : undefined

  const sammle = (
    bereich: ImportProblem['bereich'],
    zeilenId: string,
    titel: string,
    probleme: string[],
  ) => {
    if (probleme.length > 0) ergebnis.probleme.push({ bereich, zeilenId, titel, probleme })
  }

  for (const a of ergebnis.artikel ?? []) {
    sammle('artikel', a.artikelnummer, `${a.artikelnummer} · ${a.bezeichnung}`, pruefeArtikel(a))
  }
  for (const p of ergebnis.preise ?? []) {
    const achsen = p.a.filter(Boolean).join(' · ') || 'ohne Achsenwerte'
    sammle('preise', preisSchluessel(p), `${p.artikel} · ${achsen}`, pruefePreiszeile(p, artikelnummern))
  }
  for (const k of ergebnis.oberflaechenkategorien ?? []) {
    sammle('oberflaechen', `kat:${k.id}`, `Kategorie ${k.bezeichnung || k.id}`, pruefeKategorie(k))
  }
  for (const o of ergebnis.oberflaechen ?? []) {
    sammle(
      'oberflaechen',
      `obf:${o.kategorie}::${o.id}`,
      `${o.bezeichnung || o.id} (${o.kategorie})`,
      pruefeOberflaeche(o, kategorien),
    )
  }
  for (const m of ergebnis.mitarbeiter ?? []) {
    sammle('berater', m.personalnr, `${m.personalnr} · ${m.name}`, pruefeMitarbeiter(m as Mitarbeiter))
  }
  for (const f of ergebnis.filialen ?? []) {
    sammle('filialen', f.filialnr, `${f.filialnr} · ${f.name}`, pruefeFiliale(f as Filiale))
  }
}
