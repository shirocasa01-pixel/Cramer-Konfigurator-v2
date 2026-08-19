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
import { parseDezimal } from './format.ts'
import { leseXlsx, schreibeXlsx, ladeHerunter, type GelesenesBlatt, type XlsxBlatt } from './xlsxBrowser.ts'
import type { Achsenwerte } from './stammdatenStore.ts'

/** Blattnamen — identisch zur Stammdatenmappe. */
export const BLATT = {
  artikel: '10 Artikel',
  preise: '20 Preise',
  mitarbeiter: '40 Mitarbeiter',
  filialen: '41 Filialen',
} as const

// ---------------------------------------------------------------------------
// Spaltenzuordnung
// ---------------------------------------------------------------------------

const ARTIKEL_SPALTEN: [string, (a: Artikel) => string][] = [
  ['Artikelnummer', (a) => a.artikelnummer],
  ['Kurzzeichen', (a) => a.kurzzeichen],
  ['Bezeichnung', (a) => a.bezeichnung],
  ['Bezeichnung 2', (a) => a.bezeichnung2],
  ['Teileart', (a) => a.teileart],
  ['Produktgruppe', (a) => a.produktgruppe],
  ['Artikelgruppe', (a) => a.artikelgruppe],
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
  ['Produktgruppe', (_p, a) => a?.produktgruppe ?? ''],
  ['Artikelgruppe', (_p, a) => a?.artikelgruppe ?? ''],
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
}

/**
 * Schreibt den übergebenen Stand als `.xlsx` und stößt den Download an.
 * Übergeben wird, was gerade sichtbar ist — gefiltert exportieren ist damit möglich.
 */
export function exportiereXlsx(daten: ExportDaten, dateiname?: string): string {
  const artikelNach = new Map(daten.artikel.map((a) => [a.artikelnummer, a]))

  const blaetter: XlsxBlatt[] = [
    baueBlatt(BLATT.artikel, ARTIKEL_SPALTEN, daten.artikel, () => undefined as never),
    baueBlatt(BLATT.preise, PREIS_SPALTEN, daten.preise, (p) => artikelNach.get(p.artikel)),
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

export interface ImportErgebnis {
  artikel?: Artikel[]
  preise?: Preiszeile[]
  mitarbeiter?: Mitarbeiter[]
  filialen?: Filiale[]
  /** Was gelesen wurde und was auffiel — wird dem Benutzer gezeigt. */
  meldungen: string[]
}

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
      teileart: (z['Teileart'] ?? '') as Artikel['teileart'],
      produktgruppe: (z['Produktgruppe'] ?? '') as Artikel['produktgruppe'],
      artikelgruppe: (z['Artikelgruppe'] ?? '') as Artikel['artikelgruppe'],
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

/** Liest eine hochgeladene Mappe. Fehlende Blätter bleiben schlicht unberührt. */
export async function importiereXlsx(datei: File): Promise<ImportErgebnis> {
  const puffer = await datei.arrayBuffer()
  const blaetter = leseXlsx(puffer)
  const meldungen: string[] = []
  const ergebnis: ImportErgebnis = { meldungen }

  if (blaetter.length === 0) {
    meldungen.push('Die Datei enthält kein lesbares Tabellenblatt.')
    return ergebnis
  }

  for (const blatt of blaetter) {
    switch (blatt.name) {
      case BLATT.artikel:
        ergebnis.artikel = leseArtikelBlatt(blatt, meldungen)
        break
      case BLATT.preise:
        ergebnis.preise = lesePreisBlatt(blatt, meldungen)
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
      default:
        meldungen.push(`Blatt „${blatt.name}" übersprungen — kein bekannter Blattname.`)
    }
  }

  // Referenzintegrität prüfen, solange sich noch etwas ändern lässt.
  if (ergebnis.preise && ergebnis.artikel) {
    const nummern = new Set(ergebnis.artikel.map((a) => a.artikelnummer))
    const verwaist = ergebnis.preise.filter((p) => !nummern.has(p.artikel))
    if (verwaist.length > 0) {
      meldungen.push(
        `${verwaist.length} Preiszeile(n) verweisen auf einen Artikel, den es im Import nicht gibt (z. B. ${verwaist[0].artikel}) — sie wären nicht auffindbar.`,
      )
    }
  }

  return ergebnis
}
