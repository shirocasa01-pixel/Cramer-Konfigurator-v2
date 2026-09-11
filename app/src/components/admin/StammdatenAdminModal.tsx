import { useEffect, useMemo, useRef, useState } from 'react'
import {
  achsen as achsenKatalog,
  dropdowns,
  serien,
  teilearten,
  type Artikel,
  type Filiale,
  type Mitarbeiter,
  type Preiszeile,
} from '../../data/stammdaten.generated.ts'
import type { Oberflaeche, Oberflaechenkategorie, PreisgruppenFeld } from '../../types/index.ts'
import { formatEuroOderLeer, formatGanzzahl } from '../../lib/format.ts'
import { PRICE_GROUP_LABEL } from '../../lib/materialFormat.ts'
import { modusErlaubt } from '../../lib/modus.ts'
import { exportiereXlsx, importiereXlsx } from '../../lib/stammdatenExport.ts'
import {
  aendereFiliale,
  aendereKategorie,
  aendereMitarbeiter,
  aendereOberflaeche,
  dupliziereArtikel,
  idVorschlag,
  getImportProbleme,
  pruefeImportMarke,
  listeAenderungen,
  speichereAlleAenderungen,
  type AenderungsBereich,
  istArtikelGeaendert,
  istFilialeGeaendert,
  istKategorieGeaendert,
  istMitarbeiterGeaendert,
  istOberflaecheGeaendert,
  istPreisGeaendert,
  legeFilialeAn,
  legeKategorieAn,
  legeMitarbeiterAn,
  legeOberflaecheAn,
  naechsteSortierung,
  oberflaecheSchluessel,
  preisSchluessel,
  setzeAllesZurueck,
  uebernehmeImport,
} from '../../lib/stammdatenStore.ts'
import { useStammdaten } from '../../lib/useStammdaten.ts'
import { entferneZugang, getZugang, hatZugang, setzeZugang } from '../../lib/zugangStore.ts'
import { ArtikelDetailModal } from './ArtikelDetailModal'
import { BeraterZugang, LEERER_ZUGANG, pruefeZugangEntwurf, type ZugangEntwurf } from './BeraterZugang'
import { DataGrid, SpaltenMenue, useSpaltenLayout, type SpaltenDef, type ZeilenAktion } from './DataGrid'
import { AenderungenModal } from './AenderungenModal.tsx'
import { DatensatzModal, type FeldDef } from './DatensatzModal'
import { Handbuch } from './Handbuch'
import { MehrfachFilter } from './MehrfachFilter'
import styles from './StammdatenAdminModal.module.css'

/**
 * STAMMDATEN & ARTIKELVERWALTUNG.
 *
 * Fünf Bereiche über eine Reiterleiste: Artikelstamm, Preisblatt, Berater, Filialen und
 * das Handbuch. Aufteilung nach Aufgabe — die Tabelle ZEIGT, das Detail-Fenster ÄNDERT.
 * In der Fläche gibt es keine Eingabefelder; Doppelklick oder Stift öffnen den Editor,
 * und dort wird ausdrücklich gespeichert oder verworfen.
 *
 * Jeder Bereich zeigt den vollständigen Feldbestand seines Blattes. Was davon sichtbar
 * ist, in welcher Reihenfolge und wie breit, entscheidet der Benutzer — die Einstellung
 * bleibt je Bereich gemerkt.
 */

const MAX_ZEILEN = 300

/** Reiter-Bezeichnung je Bereich — für die Änderungsliste im Kopf. */
const BEREICH_TITEL: Record<AenderungsBereich, string> = {
  artikel: 'Artikelstamm',
  preise: 'Preisblatt',
  oberflaechen: 'Oberflächen',
  berater: 'Berater',
  filialen: 'Filialen',
}

export interface StammdatenAdminModalProps {
  open: boolean
  onClose: () => void
}

type Bereich = 'artikel' | 'preise' | 'oberflaechen' | 'berater' | 'filialen' | 'handbuch'

const j = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ')

const achsenBedeutung = (code: string) =>
  achsenKatalog.find((a) => a.code === code)?.bedeutung ?? code

// ---------------------------------------------------------------------------
// Spaltendefinitionen
// ---------------------------------------------------------------------------

const ARTIKEL_SPALTEN: SpaltenDef<Artikel>[] = [
  { id: 'artikelnummer', titel: 'Artikelnummer', breite: 132, mono: true, wert: (a) => a.artikelnummer },
  { id: 'kurzzeichen', titel: 'Kurzzeichen', breite: 96, mono: true, wert: (a) => a.kurzzeichen },
  { id: 'bezeichnung', titel: 'Bezeichnung', breite: 250, wert: (a) => a.bezeichnung },
  { id: 'bezeichnung2', titel: 'Bezeichnung 2', breite: 185, wert: (a) => a.bezeichnung2 },
  { id: 'teileart', titel: 'Teileart', breite: 150, wert: (a) => a.teileart },
  { id: 'dropdown', titel: 'Dropdown', breite: 170, wert: (a) => a.dropdown },
  { id: 'modus', titel: 'Modus', breite: 96, mono: true, wert: (a) => a.modus },
  { id: 'preislogik', titel: 'Preislogik', breite: 132, wert: (a) => a.preislogik },
  { id: 'einheit', titel: 'Einheit', breite: 110, wert: (a) => a.einheit },
  { id: 'achsenText', titel: 'Achsen', breite: 195, wert: (a) => a.achsenText },
  { id: 'achse1', titel: 'Achse 1', breite: 108, standard: false, wert: (a) => a.achsen[0] ?? '' },
  { id: 'achse2', titel: 'Achse 2', breite: 108, standard: false, wert: (a) => a.achsen[1] ?? '' },
  { id: 'achse3', titel: 'Achse 3', breite: 108, standard: false, wert: (a) => a.achsen[2] ?? '' },
  { id: 'achse4', titel: 'Achse 4', breite: 108, standard: false, wert: (a) => a.achsen[3] ?? '' },
  { id: 'achse5', titel: 'Achse 5', breite: 108, standard: false, wert: (a) => a.achsen[4] ?? '' },
  { id: 'preiszellen', titel: 'Preiszellen', breite: 94, numerisch: true, standard: false, wert: (a) => (a.preiszellen == null ? '' : formatGanzzahl(a.preiszellen)) },
  { id: 'oberflaeche', titel: 'Oberfläche', breite: 92, standard: false, wert: (a) => (a.oberflaeche ? 'J' : 'N') },
  { id: 'status', titel: 'Status', breite: 96, wert: (a) => a.status },
  { id: 'sortierung', titel: 'Sortierung', breite: 92, numerisch: true, standard: false, wert: (a) => (a.sortierung == null ? '' : formatGanzzahl(a.sortierung)) },
  { id: 'quelle', titel: 'Quelle', breite: 118, standard: false, wert: (a) => a.quelle },
  { id: 'bemerkung', titel: 'Bemerkung', breite: 300, standard: false, wert: (a) => a.bemerkung },
]

/** Preiszeile samt aufgelöstem Artikel — die Tabelle zeigt nie nur die Nummer. */
interface PreisZeileMitKontext {
  zeile: Preiszeile
  artikel: Artikel | undefined
  gruppenwechsel: boolean
}

const PREIS_SPALTEN: SpaltenDef<PreisZeileMitKontext>[] = [
  { id: 'artikel', titel: 'Artikel', breite: 132, mono: true, wert: (r) => r.zeile.artikel },
  { id: 'bezeichnung', titel: 'Bezeichnung', breite: 235, wert: (r) => r.artikel?.bezeichnung ?? '' },
  { id: 'bezeichnung2', titel: 'Bezeichnung 2', breite: 180, standard: false, wert: (r) => r.artikel?.bezeichnung2 ?? '' },
  { id: 'teileart', titel: 'Teileart', breite: 148, standard: false, wert: (r) => r.artikel?.teileart ?? '' },
  { id: 'dropdown', titel: 'Dropdown', breite: 158, standard: false, wert: (r) => r.artikel?.dropdown ?? '' },
  { id: 'modus', titel: 'Modus', breite: 92, mono: true, standard: false, wert: (r) => r.artikel?.modus ?? '' },
  { id: 'preislogik', titel: 'Preislogik', breite: 130, standard: false, wert: (r) => r.artikel?.preislogik ?? '' },
  { id: 'einheit', titel: 'Einheit', breite: 108, standard: false, wert: (r) => r.artikel?.einheit ?? '' },
  { id: 'achsen', titel: 'Achsen', breite: 185, standard: false, wert: (r) => r.artikel?.achsenText ?? '' },
  { id: 'a1', titel: 'A1', breite: 150, wert: (r) => r.zeile.a[0] },
  { id: 'a2', titel: 'A2', breite: 118, wert: (r) => r.zeile.a[1] },
  { id: 'a3', titel: 'A3', breite: 128, wert: (r) => r.zeile.a[2] },
  { id: 'a4', titel: 'A4', breite: 98, wert: (r) => r.zeile.a[3] },
  { id: 'a5', titel: 'A5', breite: 98, wert: (r) => r.zeile.a[4] },
  // Deutsche Währungsdarstellung: 1.250,00 €
  { id: 'preis', titel: 'Preis', breite: 112, numerisch: true, mono: true, wert: (r) => formatEuroOderLeer(r.zeile.preis, '') },
  { id: 'status', titel: 'Status', breite: 104, wert: (r) => r.zeile.status },
  { id: 'seite', titel: 'Seite', breite: 68, numerisch: true, wert: (r) => r.zeile.seite },
  { id: 'ref', titel: 'Ref', breite: 74, numerisch: true, mono: true, standard: false, wert: (r) => String(r.zeile.ref ?? '') },
]

// ---------------------------------------------------------------------------
// Oberflächen — zwei Ebenen in EINER Tabelle
// ---------------------------------------------------------------------------

/**
 * Eine Zeile im Reiter „Oberflächen". Kategorie- und Oberflächen-Zeilen stehen bewusst in
 * derselben Liste, so wie in der Vorlage: die Kategorie führt ihre Farben an, darunter
 * folgen sie eingerückt. Getrennte Tabellen würden die Zuordnung genau dort verstecken,
 * wo sie gepflegt wird.
 */
interface OberflaechenZeile {
  art: 'kategorie' | 'oberflaeche'
  schluessel: string
  kategorie: Oberflaechenkategorie | undefined
  oberflaeche?: Oberflaeche
  gruppenwechsel: boolean
}

/** „PG 2" bzw. „— offen"; bei Oberflächen zeigt der Zusatz die geerbte Gruppe. */
function pgText(pg: PreisgruppenFeld, geerbt?: PreisgruppenFeld): string {
  if (pg) return PRICE_GROUP_LABEL[pg]
  if (geerbt) return `${PRICE_GROUP_LABEL[geerbt]} (von Kategorie)`
  return '— offen'
}

const OBERFLAECHEN_SPALTEN: SpaltenDef<OberflaechenZeile>[] = [
  {
    id: 'bezeichnung',
    titel: 'Bezeichnung',
    breite: 330,
    wert: (r) => (r.art === 'kategorie' ? (r.kategorie?.bezeichnung ?? '') : `    ${r.oberflaeche?.bezeichnung ?? ''}`),
  },
  {
    // Spalte 2 der Vorlage: bei einer Kategorie steht dort die Preisgruppe,
    // bei einer Farbe die Kategorie, zu der sie gehört.
    id: 'zuordnung',
    titel: 'Preisgruppe / Kategorie',
    breite: 200,
    wert: (r) =>
      r.art === 'kategorie'
        ? pgText(r.kategorie?.preisgruppe ?? '')
        : (r.kategorie?.bezeichnung ?? '⚠ unbekannte Kategorie'),
  },
  {
    id: 'preisgruppe',
    titel: 'Wirksame PG',
    breite: 160,
    wert: (r) =>
      r.art === 'kategorie'
        ? pgText(r.kategorie?.preisgruppe ?? '')
        : pgText(r.oberflaeche?.preisgruppe ?? '', r.kategorie?.preisgruppe ?? ''),
  },
  { id: 'art', titel: 'Art', breite: 110, wert: (r) => (r.art === 'kategorie' ? 'Kategorie' : 'Oberfläche') },
  {
    // Standardmäßig ausgeblendet: Der Berater sieht nur die Bezeichnung. Die ID bleibt
    // über das Spaltenmenü erreichbar, wenn jemand nachvollziehen muss, worauf eine alte
    // Angebotsposition zeigt.
    id: 'kennung',
    titel: 'ID',
    breite: 260,
    mono: true,
    standard: false,
    wert: (r) => (r.art === 'kategorie' ? (r.kategorie?.id ?? '') : (r.oberflaeche?.id ?? '')),
  },
  {
    id: 'standardauswahl',
    titel: 'Standardauswahl',
    breite: 130,
    standard: false,
    wert: (r) => (r.art === 'kategorie' ? (r.kategorie?.standardauswahl ? 'J' : 'N') : ''),
  },
  {
    id: 'freitext',
    titel: 'Freitext',
    breite: 200,
    standard: false,
    wert: (r) => (r.art === 'oberflaeche' && r.oberflaeche?.freitext ? (r.oberflaeche.freitextLabel || 'ja') : ''),
  },
  {
    id: 'status',
    titel: 'Status',
    breite: 96,
    wert: (r) => (r.art === 'kategorie' ? (r.kategorie?.status ?? '') : (r.oberflaeche?.status ?? '')),
  },
  {
    id: 'sortierung',
    titel: 'Sortierung',
    breite: 92,
    numerisch: true,
    standard: false,
    wert: (r) => formatGanzzahl(r.art === 'kategorie' ? (r.kategorie?.sortierung ?? 0) : (r.oberflaeche?.sortierung ?? 0)),
  },
  {
    id: 'bemerkung',
    titel: 'Bemerkung',
    breite: 320,
    standard: false,
    wert: (r) => (r.art === 'kategorie' ? (r.kategorie?.bemerkung ?? '') : (r.oberflaeche?.bemerkung ?? '')),
  },
]

/**
 * Formularmodell der beiden Editoren.
 *
 * `DatensatzModal` arbeitet mit Zeichenketten — der Datensatz führt aber `boolean` und
 * `number`. Die Umwandlung passiert an genau EINER Stelle (hier), statt im Modal eine
 * Typprüfung je Feld zu erfinden.
 */
interface KategorieForm {
  id: string
  bezeichnung: string
  preisgruppe: string
  standardauswahl: string
  sortierung: string
  status: string
  bemerkung: string
}

interface OberflaecheForm {
  id: string
  kategorie: string
  bezeichnung: string
  preisgruppe: string
  freitext: string
  freitextLabel: string
  sortierung: string
  status: string
  bemerkung: string
}

const PG_OPTIONEN = [
  { wert: '', titel: '— offen (AV klärt den Preis) —' },
  { wert: 'PG1', titel: 'Preisgruppe 1' },
  { wert: 'PG2', titel: 'Preisgruppe 2' },
  { wert: 'PG3', titel: 'Preisgruppe 3' },
  { wert: 'PG4', titel: 'Preisgruppe 4' },
]

const JA_NEIN = [
  { wert: 'ja', titel: 'ja' },
  { wert: 'nein', titel: 'nein' },
]

const STATUS_OPTIONEN = [
  { wert: 'aktiv', titel: 'aktiv — erscheint im Konfigurator' },
  { wert: 'gesperrt', titel: 'gesperrt — nur in der Verwaltung sichtbar' },
]

const zahl = (s: string, ersatz: number) => {
  const n = Number(String(s).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n) : ersatz
}

const KATEGORIE_FELDER: FeldDef<KategorieForm>[] = [
  {
    feld: 'id',
    label: 'ID',
    schluessel: true,
    mono: true,
    hinweis: 'Identität — steht so in gespeicherten Entwürfen und ist danach unveränderlich',
  },
  { feld: 'bezeichnung', label: 'Bezeichnung', breit: true, hinweis: 'Beschriftung des Material-Chips im Konfigurator' },
  {
    feld: 'preisgruppe',
    label: 'Preisgruppe',
    optionen: PG_OPTIONEN,
    hinweis: 'gilt für alle Oberflächen dieser Kategorie, sofern sie keine eigene tragen',
  },
  {
    feld: 'standardauswahl',
    label: 'Teil der Standardauswahl',
    optionen: JA_NEIN,
    hinweis: 'erscheint dort, wo „alle Materialien" zulässig sind (Außenkorpus, Schiebetür-Ausführung)',
  },
  { feld: 'sortierung', label: 'Sortierung', mono: true, hinweis: 'kleinere Zahl steht weiter vorne' },
  { feld: 'status', label: 'Status', optionen: STATUS_OPTIONEN },
  { feld: 'bemerkung', label: 'Bemerkung', breit: true },
]

const OBERFLAECHE_FELDER = (kategorien: readonly Oberflaechenkategorie[]): FeldDef<OberflaecheForm>[] => [
  {
    feld: 'kategorie',
    label: 'Oberflächenkategorie',
    schluessel: true,
    optionen: kategorien.map((k) => ({ wert: k.id, titel: `${k.bezeichnung} (${pgText(k.preisgruppe)})` })),
    hinweis: 'bestimmt Preisgruppe und Dropdown — zusammen mit der ID die Identität, danach unveränderlich',
  },
  // Kein ID-Feld: Die ID wird beim Anlegen aus der Bezeichnung gebildet
  // („Schwarz RAL 9005" ⇒ `schwarz-ral-9005`) und ist danach unveränderlich.
  {
    feld: 'bezeichnung',
    label: 'Bezeichnung',
    breit: true,
    hinweis: 'exakter Anzeigetext im Dropdown, z. B. „Verkehrsweiß RAL 9016" — daraus entsteht auch die ID',
  },
  {
    feld: 'preisgruppe',
    label: 'Abweichende Preisgruppe',
    optionen: PG_OPTIONEN,
    hinweis: 'leer lassen ⇒ Preisgruppe der Kategorie (Ausnahme z. B. Wengé)',
  },
  {
    feld: 'freitext',
    label: 'Freitextfeld öffnen',
    optionen: JA_NEIN,
    hinweis: 'für Sonderfarben, bei denen der Berater die genaue Bezeichnung nachträgt',
  },
  { feld: 'freitextLabel', label: 'Beschriftung des Freitextfelds', breit: true, hinweis: 'nur wirksam, wenn oben „ja" steht' },
  { feld: 'sortierung', label: 'Sortierung', mono: true },
  { feld: 'status', label: 'Status', optionen: STATUS_OPTIONEN },
  { feld: 'bemerkung', label: 'Bemerkung', breit: true },
]

interface BeraterZeile {
  m: Mitarbeiter
  filiale: Filiale | undefined
}

/**
 * Zugangslage in einem Wort. Zeigt NIE das Passwort, nur ob eines hinterlegt ist —
 * die Spalte wandert per Strg+C nach Excel und über den Bildschirm der Filiale.
 */
function zugangText(m: Mitarbeiter): string {
  if (m.status !== 'aktiv') return '🔒 gesperrt'
  if (!hatZugang(m.personalnr)) return '— kein Passwort'
  if (!m.email.trim()) return '⚠ ohne E-Mail'
  return '✓ freigeschaltet'
}

const BERATER_SPALTEN: SpaltenDef<BeraterZeile>[] = [
  { id: 'personalnr', titel: 'Personalnr', breite: 110, mono: true, wert: (r) => r.m.personalnr },
  { id: 'name', titel: 'Name', breite: 200, wert: (r) => r.m.name },
  { id: 'email', titel: 'E-Mail', breite: 240, wert: (r) => r.m.email },
  { id: 'zugang', titel: 'Zugang', breite: 150, wert: (r) => zugangText(r.m) },
  { id: 'rolle', titel: 'Rolle', breite: 110, wert: (r) => r.m.rolle },
  { id: 'filiale', titel: 'Filiale', breite: 100, mono: true, wert: (r) => r.m.filiale },
  { id: 'filialname', titel: 'Filialname', breite: 250, wert: (r) => r.filiale?.name ?? (r.m.filiale ? '⚠ unbekannt' : '') },
  { id: 'ort', titel: 'Ort', breite: 130, wert: (r) => r.filiale?.ort ?? '' },
  { id: 'status', titel: 'Status', breite: 96, wert: (r) => r.m.status },
  { id: 'bemerkung', titel: 'Bemerkung', breite: 280, standard: false, wert: (r) => r.m.bemerkung },
]

const FILIAL_SPALTEN: SpaltenDef<Filiale>[] = [
  { id: 'filialnr', titel: 'Filialnr', breite: 96, mono: true, wert: (f) => f.filialnr },
  { id: 'name', titel: 'Name', breite: 290, wert: (f) => f.name },
  { id: 'strasse', titel: 'Straße', breite: 200, wert: (f) => f.strasse },
  { id: 'plz', titel: 'PLZ', breite: 78, mono: true, wert: (f) => f.plz },
  { id: 'ort', titel: 'Ort', breite: 150, wert: (f) => f.ort },
  { id: 'telefon', titel: 'Telefon', breite: 150, mono: true, wert: (f) => f.telefon },
  { id: 'email', titel: 'E-Mail', breite: 210, wert: (f) => f.email },
  { id: 'status', titel: 'Status', breite: 96, wert: (f) => f.status },
  { id: 'altId', titel: 'Alt-ID', breite: 240, mono: true, standard: false, wert: (f) => f.altId },
]

// ---------------------------------------------------------------------------

export function StammdatenAdminModal({ open, onClose }: StammdatenAdminModalProps) {
  const stand = useStammdaten()
  const [bereich, setBereich] = useState<Bereich>('artikel')
  const [suche, setSuche] = useState('')
  const [serienFilter, setSerienFilter] = useState<string[]>([])
  const [teileartFilter, setTeileartFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [dropdownFilter, setDropdownFilter] = useState<string[]>([])
  const [meldung, setMeldung] = useState<{ art: 'info' | 'fehler'; text: string } | null>(null)
  /** Aufgeklappte Änderungsliste im Kopf. */
  /** Vorschau-Fenster „Änderungen" (frueher ein Panel ueber den Tabellen). */
  const [aenderungenOffen, setAenderungenOffen] = useState(false)
  /** Zweite Stufe des uebergeordneten Speicherns im Kopf. */
  const [speichernBestaetigt, setSpeichernBestaetigt] = useState(false)
  /** Gruene Erfolgsmeldung des letzten Imports (bis der Benutzer sie ausblendet). */
  const [importErfolg, setImportErfolg] = useState<string | null>(null)
  /** Sprungziel im Gitter; `lauf` zählt hoch, damit derselbe Klick erneut wirkt. */
  const [fokus, setFokus] = useState<{ zeilenId: string; lauf: number } | null>(null)

  const [artikelEditor, setArtikelEditor] = useState<{ artikel: Artikel | null; bereich?: 'allgemein' | 'preise' } | null>(null)
  const [beraterEditor, setBeraterEditor] = useState<{ datensatz: Mitarbeiter | null; zugang: ZugangEntwurf } | null>(null)
  const [filialEditor, setFilialEditor] = useState<{ datensatz: Filiale | null } | null>(null)
  const [kategorieEditor, setKategorieEditor] = useState<{ datensatz: KategorieForm | null } | null>(null)
  const [oberflaecheEditor, setOberflaecheEditor] = useState<{
    datensatz: OberflaecheForm | null
    schluessel: string | null
    /** Beim Anlegen aus einer Kategoriezeile heraus bereits gewählt. */
    vorbelegteKategorie?: string
  } | null>(null)
  const dateiRef = useRef<HTMLInputElement>(null)

  const artikelLayout = useSpaltenLayout(ARTIKEL_SPALTEN, 'cramer-planer.grid.artikel.v2')
  const preisLayout = useSpaltenLayout(PREIS_SPALTEN, 'cramer-planer.grid.preise.v2')
  const beraterLayout = useSpaltenLayout(BERATER_SPALTEN, 'cramer-planer.grid.berater.v1')
  const filialLayout = useSpaltenLayout(FILIAL_SPALTEN, 'cramer-planer.grid.filialen.v1')
  const oberflaechenLayout = useSpaltenLayout(OBERFLAECHEN_SPALTEN, 'cramer-planer.grid.oberflaechen.v1')

  const einEditorOffen = Boolean(
    artikelEditor || beraterEditor || filialEditor || kategorieEditor || oberflaecheEditor,
  )

  useEffect(() => {
    if (!open) return
    const beiEsc = (e: KeyboardEvent) => {
      // Nur schließen, wenn kein Editor darüber liegt – der fängt Escape selbst ab.
      if (e.key === 'Escape' && !einEditorOffen) onClose()
    }
    document.addEventListener('keydown', beiEsc)
    return () => document.removeEventListener('keydown', beiEsc)
  }, [open, onClose, einEditorOffen])

  useEffect(() => setMeldung(null), [bereich])

  const artikelNach = useMemo(() => new Map(stand.artikel.map((a) => [a.artikelnummer, a])), [stand.artikel])
  const filialeNach = useMemo(() => new Map(stand.filialen.map((f) => [f.filialnr, f])), [stand.filialen])

  const passt = useMemo(() => {
    const begriff = suche.trim().toLowerCase()
    return (a: Artikel | undefined, zusatz: string) => {
      if (a) {
        if (serienFilter.length && !serienFilter.some((c) => modusErlaubt(a.modus, c))) return false
        if (teileartFilter.length && !teileartFilter.includes(a.teileart)) return false
        if (statusFilter.length && !statusFilter.includes(a.status)) return false
        if (dropdownFilter.length && !dropdownFilter.includes(a.dropdown)) return false
      }
      if (!begriff) return true
      const text = a
        ? `${a.artikelnummer} ${a.kurzzeichen} ${a.bezeichnung} ${a.bezeichnung2} ${a.dropdown} ${zusatz}`
        : zusatz
      return text.toLowerCase().includes(begriff)
    }
  }, [suche, serienFilter, teileartFilter, statusFilter, dropdownFilter])

  const gefilterteArtikel = useMemo(() => stand.artikel.filter((a) => passt(a, '')), [stand.artikel, passt])

  const gefiltertePreise = useMemo(() => {
    const gefiltert = stand.preise.filter((p) => passt(artikelNach.get(p.artikel), p.a.join(' ')))
    const sortiert = [...gefiltert].sort((x, y) => x.artikel.localeCompare(y.artikel))
    let letzter = ''
    return sortiert.map<PreisZeileMitKontext>((zeile) => {
      const gruppenwechsel = zeile.artikel !== letzter
      letzter = zeile.artikel
      return { zeile, artikel: artikelNach.get(zeile.artikel), gruppenwechsel }
    })
  }, [stand.preise, artikelNach, passt])

  const gefilterteBerater = useMemo(() => {
    const begriff = suche.trim().toLowerCase()
    return stand.mitarbeiter
      .filter((m) => !statusFilter.length || statusFilter.includes(m.status))
      .filter((m) => !begriff || `${m.personalnr} ${m.name} ${m.email} ${m.rolle} ${m.filiale}`.toLowerCase().includes(begriff))
      .map<BeraterZeile>((m) => ({ m, filiale: filialeNach.get(m.filiale) }))
  }, [stand.mitarbeiter, filialeNach, suche, statusFilter])

  /**
   * Kategorien und ihre Oberflächen zu EINER Liste verflochten. Passt eine Farbe zur
   * Suche, bleibt ihre Kategoriezeile stehen — sonst stünde die Farbe ohne die Zeile da,
   * in der ihre Preisgruppe steht.
   */
  const gefilterteOberflaechen = useMemo(() => {
    const begriff = suche.trim().toLowerCase()
    const passtStatus = (s: string) => !statusFilter.length || statusFilter.includes(s)
    const zeilen: OberflaechenZeile[] = []

    for (const k of stand.oberflaechenkategorien) {
      const farben = stand.oberflaechen.filter(
        (o) =>
          o.kategorie === k.id &&
          passtStatus(o.status) &&
          (!begriff || `${o.id} ${o.bezeichnung} ${o.preisgruppe} ${o.bemerkung}`.toLowerCase().includes(begriff)),
      )
      const kategoriePasst =
        passtStatus(k.status) && (!begriff || `${k.id} ${k.bezeichnung} ${k.preisgruppe}`.toLowerCase().includes(begriff))
      if (!kategoriePasst && farben.length === 0) continue

      zeilen.push({ art: 'kategorie', schluessel: `kat:${k.id}`, kategorie: k, gruppenwechsel: true })
      for (const o of farben) {
        zeilen.push({
          art: 'oberflaeche',
          schluessel: `obf:${oberflaecheSchluessel(o)}`,
          kategorie: k,
          oberflaeche: o,
          gruppenwechsel: false,
        })
      }
    }

    // Verwaiste Farben (Kategorie gelöscht) dürfen nicht unsichtbar werden — sonst
    // stünde in einem Entwurf ein Material, das die Verwaltung gar nicht mehr kennt.
    const bekannt = new Set(stand.oberflaechenkategorien.map((k) => k.id))
    for (const o of stand.oberflaechen.filter((x) => !bekannt.has(x.kategorie))) {
      zeilen.push({
        art: 'oberflaeche',
        schluessel: `obf:${oberflaecheSchluessel(o)}`,
        kategorie: undefined,
        oberflaeche: o,
        gruppenwechsel: false,
      })
    }
    return zeilen
  }, [stand.oberflaechenkategorien, stand.oberflaechen, suche, statusFilter])

  const gefilterteFilialen = useMemo(() => {
    const begriff = suche.trim().toLowerCase()
    return stand.filialen.filter(
      (f) => !begriff || `${f.filialnr} ${f.name} ${f.strasse} ${f.plz} ${f.ort} ${f.email}`.toLowerCase().includes(begriff),
    )
  }, [stand.filialen, suche])

  const aenderungsListe = listeAenderungen()
  const aenderungen = aenderungsListe.length
  const ausstehend = aenderungsListe.filter((a) => a.ausstehend).length
  const importProbleme = getImportProbleme()
  /** Schnellzugriff je Bereich: hat DIESE Zeile eine Import-Beanstandung? */
  const problemFuer = (bereich: AenderungsBereich, zeilenId: string): { probleme: string[] } | undefined =>
    importProbleme.find((p) => p.bereich === bereich && p.zeilenId === zeilenId)

  /**
   * Zeilenklasse eines Gitters: Import-Beanstandung schlägt die Änderungsmarke, weil sie
   * eine Aufforderung ist und nicht nur ein Hinweis.
   */
  function zeilenKlasseFuer(bereich: AenderungsBereich, zeilenId: string, geaendert: boolean) {
    if (problemFuer(bereich, zeilenId)) return styles.zeileImportfehler
    return geaendert ? styles.zeileGeaendert : undefined
  }

  /**
   * Springt aus der Änderungsliste in die betroffene Zeile: Reiter wechseln, Filter
   * räumen (sonst hätte die Zeile die Suche womöglich gar nicht überstanden) und die
   * Zeilen-ID an das Gitter geben. Der Zähler im Schlüssel erzwingt, dass auch ein
   * zweiter Klick auf dieselbe Zeile wieder scrollt.
   */
  function springeZu(aenderung: { bereich: AenderungsBereich; zeilenId: string }) {
    setBereich(aenderung.bereich)
    setSuche('')
    setSerienFilter([])
    setTeileartFilter([])
    setStatusFilter([])
    setDropdownFilter([])
    setFokus((f) => ({ zeilenId: aenderung.zeilenId, lauf: (f?.lauf ?? 0) + 1 }))
    setAenderungenOffen(false)
  }
  const aktiveFilter = serienFilter.length + teileartFilter.length + statusFilter.length + dropdownFilter.length
  const istArtikelBereich = bereich === 'artikel' || bereich === 'preise'

  // --- Aktionen ---------------------------------------------------------------------

  /**
   * Die Gitter kennen KEINE Löschen-Aktion mehr.
   *
   * Stammdaten werden nicht entfernt, sondern auf `gesperrt` gesetzt: Ein gelöschter
   * Artikel nimmt seine Preiszeilen mit und reißt in jedem bereits gespeicherten Angebot,
   * das ihn referenziert, ein Loch — rückgängig machen lässt sich das nur über
   * „Zurücksetzen", also durch Verwerfen aller Änderungen. „Gesperrt" erreicht dasselbe
   * (der Datensatz verschwindet aus dem Konfigurator), bleibt aber nachvollziehbar und
   * jederzeit umkehrbar. Den Status setzt der jeweilige Editor.
   */
  const artikelAktionen: ZeilenAktion<Artikel>[] = [
    { id: 'edit', titel: 'Bearbeiten', symbol: '✎', ausfuehren: (a) => setArtikelEditor({ artikel: a }) },
    {
      id: 'dup',
      titel: 'Duplizieren — nächste freie Nummer im selben Nummernkreis',
      symbol: '⧉',
      ausfuehren: (a) => {
        const ergebnis = dupliziereArtikel(a.artikelnummer)
        if ('fehler' in ergebnis) {
          setMeldung({ art: 'fehler', text: ergebnis.fehler })
          return
        }
        setMeldung({ art: 'info', text: `Kopie als ${ergebnis.nummer} angelegt — jetzt anpassen.` })
        const kopie = { ...a, artikelnummer: ergebnis.nummer, kurzzeichen: '', quelle: `Kopie von ${a.artikelnummer}` }
        setArtikelEditor({ artikel: kopie })
      },
    },
  ]

  const preisAktionen: ZeilenAktion<PreisZeileMitKontext>[] = [
    { id: 'edit', titel: 'Artikel bearbeiten', symbol: '✎', ausfuehren: (r) => r.artikel && setArtikelEditor({ artikel: r.artikel, bereich: 'preise' }) },
  ]

  const beraterAktionen: ZeilenAktion<BeraterZeile>[] = [
    { id: 'edit', titel: 'Bearbeiten', symbol: '✎', ausfuehren: (r) => setBeraterEditor({ datensatz: r.m, zugang: LEERER_ZUGANG }) },
  ]

  // --- Oberflächen: Datensatz ⇄ Formular -------------------------------------------

  const alsKategorieForm = (k: Oberflaechenkategorie): KategorieForm => ({
    id: k.id,
    bezeichnung: k.bezeichnung,
    preisgruppe: k.preisgruppe,
    standardauswahl: k.standardauswahl ? 'ja' : 'nein',
    sortierung: String(k.sortierung),
    status: k.status,
    bemerkung: k.bemerkung,
  })

  const alsOberflaecheForm = (o: Oberflaeche): OberflaecheForm => ({
    id: o.id,
    kategorie: o.kategorie,
    bezeichnung: o.bezeichnung,
    preisgruppe: o.preisgruppe,
    freitext: o.freitext ? 'ja' : 'nein',
    freitextLabel: o.freitextLabel,
    sortierung: String(o.sortierung),
    status: o.status,
    bemerkung: o.bemerkung,
  })

  function oeffneOberflaeche(zeile: OberflaechenZeile) {
    if (zeile.art === 'kategorie') {
      if (zeile.kategorie) setKategorieEditor({ datensatz: alsKategorieForm(zeile.kategorie) })
      return
    }
    if (!zeile.oberflaeche) return
    setOberflaecheEditor({
      datensatz: alsOberflaecheForm(zeile.oberflaeche),
      schluessel: oberflaecheSchluessel(zeile.oberflaeche),
    })
  }

  const oberflaechenAktionen: ZeilenAktion<OberflaechenZeile>[] = [
    { id: 'edit', titel: 'Bearbeiten', symbol: '✎', ausfuehren: oeffneOberflaeche },
    {
      id: 'neu',
      titel: 'Oberfläche in dieser Kategorie anlegen',
      symbol: '＋',
      ausfuehren: (r) =>
        setOberflaecheEditor({ datensatz: null, schluessel: null, vorbelegteKategorie: r.kategorie?.id }),
    },
  ]

  const filialAktionen: ZeilenAktion<Filiale>[] = [
    { id: 'edit', titel: 'Bearbeiten', symbol: '✎', ausfuehren: (f) => setFilialEditor({ datensatz: f }) },
  ]

  function handleExport() {
    const name = exportiereXlsx({
      artikel: bereich === 'artikel' ? gefilterteArtikel : stand.artikel,
      preise: bereich === 'preise' ? gefiltertePreise.map((r) => r.zeile) : stand.preise,
      mitarbeiter: stand.mitarbeiter,
      filialen: stand.filialen,
      oberflaechenkategorien: stand.oberflaechenkategorien,
      oberflaechen: stand.oberflaechen,
    })
    setMeldung({ art: 'info', text: `${name} heruntergeladen — ein Blatt je Reiter, Spaltennamen wie in der Verwaltung.` })
  }

  /**
   * Excel einlesen — ohne Abbruch.
   *
   * Erfolg und Beanstandung werden getrennt gemeldet: Das grüne Banner sagt, was
   * angekommen ist, das gelbe, was nachgearbeitet werden muss. Beides steht nebeneinander,
   * weil ein Import in aller Regel beides enthält.
   */
  async function handleImport(datei: File) {
    try {
      const ergebnis = await importiereXlsx(datei)
      const { uebernommen, neu, geaendert, bereiche } = uebernehmeImport(ergebnis)
      if (!uebernommen) {
        setImportErfolg(null)
        setMeldung({
          art: 'fehler',
          text: ['Nichts übernommen — keine bekannten Blattnamen gefunden.', ...ergebnis.meldungen].join(' '),
        })
        return
      }
      setImportErfolg(
        `${neu} neue Datensätze hinzugefügt · ${geaendert} aktualisiert — gelesen: ${bereiche.join(' · ')}.`,
      )
      setMeldung(
        ergebnis.meldungen.length ? { art: 'fehler', text: ergebnis.meldungen.join(' ') } : null,
      )
      // Nach einem Import zaehlt zuerst das Ergebnis-Banner; ein offenes
      // Änderungs-Fenster wuerde es verdecken.
      setAenderungenOffen(false)
    } catch (err) {
      setImportErfolg(null)
      setMeldung({ art: 'fehler', text: `Import fehlgeschlagen: ${(err as Error).message}` })
    }
  }

  if (!open) return null

  return (
    <>
      <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Stammdaten und Artikelverwaltung">
        <header className={styles.topbar}>
          <div className={styles.marke}>
            <span className={styles.markePunkt} aria-hidden="true" />
            Stammdaten &amp; Artikelverwaltung
          </div>
          <span className={styles.topbarSub}>
            {formatGanzzahl(stand.artikel.length)} Artikel · {formatGanzzahl(stand.preise.length)} Preiszeilen ·{' '}
            {stand.mitarbeiter.length} Mitarbeiter · {stand.filialen.length} Filialen
          </span>
          {aenderungen > 0 ? (
            <button
              type="button"
              className={styles.dirtyBadge}
              aria-haspopup="dialog"
              title="Änderungen im Detail anzeigen"
              onClick={() => setAenderungenOffen(true)}
            >
              {/* Grammatik zaehlt: „1 Änderung", ab zwei „Änderungen". Der Zusatz
                  unterscheidet weiter zwischen noch nicht bestaetigt und bereits
                  gespeichert — diese Information traegt der Knopf als einzige Stelle. */}
              {ausstehend > 0
                ? `${ausstehend} ${ausstehend === 1 ? 'Änderung' : 'Änderungen'} ausstehend`
                : `${aenderungen} ${aenderungen === 1 ? 'Änderung' : 'Änderungen'} gespeichert`}
            </button>
          ) : null}
          <span className={styles.spacer} />

          <input
            ref={dateiRef}
            type="file"
            accept=".xlsx"
            hidden
            onChange={(e) => {
              const datei = e.target.files?.[0]
              if (datei) void handleImport(datei)
              e.target.value = ''
            }}
          />
          <button type="button" className={styles.topbarButton} onClick={() => dateiRef.current?.click()}>
            Excel importieren
          </button>
          <button type="button" className={styles.topbarButton} onClick={handleExport}>
            Excel exportieren
          </button>
          {aenderungen > 0 ? (
            <button
              type="button"
              className={styles.topbarButton}
              onClick={() => {
                if (window.confirm(`Alle ${aenderungen} Änderung(en) verwerfen und den Stand aus Cramer-Stammdaten.xlsx wiederherstellen?`)) {
                  setzeAllesZurueck()
                  setMeldung(null)
                }
              }}
            >
              Zurücksetzen
            </button>
          ) : null}

          {/*
            Der übergeordnete Speichern-Knopf — bewusst zwischen „Zurücksetzen" und dem
            Schließen-Kreuz. Er ist die EINZIGE Stelle mit Rückfrage: die Editoren übernehmen
            nur in den Bearbeitungsstand, hier wird alles über alle Reiter hinweg verbindlich.
          */}
          {ausstehend > 0 ? (
            <button
              type="button"
              className={[styles.topbarButton, styles.topbarSpeichern].join(' ')}
              onClick={() => {
                if (!speichernBestaetigt) {
                  setSpeichernBestaetigt(true)
                  return
                }
                const anzahl = speichereAlleAenderungen()
                setSpeichernBestaetigt(false)
                setMeldung({
                  art: 'info',
                  text: `${anzahl} Änderung(en) gespeichert — sie gelten jetzt im Konfigurator und in der Kalkulation.`,
                })
              }}
              onBlur={() => setSpeichernBestaetigt(false)}
              title="Alle gesammelten Änderungen aller Reiter verbindlich übernehmen"
            >
              {speichernBestaetigt ? 'Wirklich speichern?' : `Speichern (${ausstehend})`}
            </button>
          ) : null}

          <button type="button" className={styles.schliessen} onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </header>

        <nav className={styles.reiter} role="tablist">
          {(
            [
              ['artikel', 'Artikelstamm', stand.artikel.length],
              ['preise', 'Preisblatt & Achsen', stand.preise.length],
              ['oberflaechen', 'Oberflächen', stand.oberflaechen.length],
              ['berater', 'Berater', stand.mitarbeiter.length],
              ['filialen', 'Filialen', stand.filialen.length],
              ['handbuch', 'Handbuch', null],
            ] as [Bereich, string, number | null][]
          ).map(([id, titel, anzahl]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={bereich === id}
              className={j(styles.reiterKnopf, bereich === id && styles.reiterAktiv)}
              onClick={() => setBereich(id)}
            >
              {titel}
              {anzahl != null ? <span className={styles.reiterZaehler}>{formatGanzzahl(anzahl)}</span> : null}
            </button>
          ))}
        </nav>

        {bereich !== 'handbuch' ? (
          <div className={styles.werkzeugleiste}>
            <div className={styles.sucheWrap}>
              <span className={styles.sucheIcon} aria-hidden="true">
                ⌕
              </span>
              <input
                type="search"
                className={styles.suche}
                placeholder="Suchen …"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
              />
            </div>

            {istArtikelBereich ? (
              <>
                <MehrfachFilter
                  label="Serie"
                  optionen={serien.map((s) => ({ wert: s.code, titel: `${s.code} · ${s.name}` }))}
                  ausgewaehlt={serienFilter}
                  onChange={setSerienFilter}
                />
                <MehrfachFilter
                  label="Teileart"
                  optionen={teilearten.map((t) => ({ wert: t.code, titel: `${t.nr} · ${t.schritt}` }))}
                  ausgewaehlt={teileartFilter}
                  onChange={setTeileartFilter}
                />
                <MehrfachFilter
                  label="Dropdown"
                  optionen={dropdowns.map((d) => ({ wert: d.code, titel: `${d.nr} · ${d.bezeichnung}` }))}
                  ausgewaehlt={dropdownFilter}
                  onChange={setDropdownFilter}
                />
              </>
            ) : null}

            {bereich !== 'filialen' ? (
              <MehrfachFilter
                label="Status"
                optionen={[
                  { wert: 'aktiv', titel: 'aktiv' },
                  { wert: 'gesperrt', titel: 'gesperrt' },
                  { wert: 'entwurf', titel: 'entwurf' },
                ]}
                ausgewaehlt={statusFilter}
                onChange={setStatusFilter}
              />
            ) : null}

            {aktiveFilter > 0 || suche ? (
              <button
                type="button"
                className={styles.filterReset}
                onClick={() => {
                  setSuche('')
                  setSerienFilter([])
                  setTeileartFilter([])
                  setStatusFilter([])
                  setDropdownFilter([])
                }}
              >
                Filter zurücksetzen
              </button>
            ) : null}

            <span className={styles.spacer} />

            {bereich === 'artikel' ? (
              <SpaltenMenue spalten={artikelLayout.alle} versteckt={artikelLayout.layout.versteckt} onToggle={artikelLayout.toggleSpalte} onAlleZeigen={artikelLayout.alleZeigen} onZuruecksetzen={artikelLayout.zuruecksetzen} />
            ) : null}
            {bereich === 'preise' ? (
              <SpaltenMenue spalten={preisLayout.alle} versteckt={preisLayout.layout.versteckt} onToggle={preisLayout.toggleSpalte} onAlleZeigen={preisLayout.alleZeigen} onZuruecksetzen={preisLayout.zuruecksetzen} />
            ) : null}
            {bereich === 'berater' ? (
              <SpaltenMenue spalten={beraterLayout.alle} versteckt={beraterLayout.layout.versteckt} onToggle={beraterLayout.toggleSpalte} onAlleZeigen={beraterLayout.alleZeigen} onZuruecksetzen={beraterLayout.zuruecksetzen} />
            ) : null}
            {bereich === 'filialen' ? (
              <SpaltenMenue spalten={filialLayout.alle} versteckt={filialLayout.layout.versteckt} onToggle={filialLayout.toggleSpalte} onAlleZeigen={filialLayout.alleZeigen} onZuruecksetzen={filialLayout.zuruecksetzen} />
            ) : null}
            {bereich === 'oberflaechen' ? (
              <SpaltenMenue spalten={oberflaechenLayout.alle} versteckt={oberflaechenLayout.layout.versteckt} onToggle={oberflaechenLayout.toggleSpalte} onAlleZeigen={oberflaechenLayout.alleZeigen} onZuruecksetzen={oberflaechenLayout.zuruecksetzen} />
            ) : null}

            {bereich === 'artikel' ? (
              <button type="button" className={styles.primaer} onClick={() => setArtikelEditor({ artikel: null })}>
                + Neuer Artikel
              </button>
            ) : null}
            {bereich === 'berater' ? (
              <button type="button" className={styles.primaer} onClick={() => setBeraterEditor({ datensatz: null, zugang: LEERER_ZUGANG })}>
                + Neuer Berater
              </button>
            ) : null}
            {bereich === 'filialen' ? (
              <button type="button" className={styles.primaer} onClick={() => setFilialEditor({ datensatz: null })}>
                + Neue Filiale
              </button>
            ) : null}
            {bereich === 'oberflaechen' ? (
              <>
                <button type="button" className={styles.topbarButton} onClick={() => setKategorieEditor({ datensatz: null })}>
                  + Neue Kategorie
                </button>
                <button
                  type="button"
                  className={styles.primaer}
                  onClick={() => setOberflaecheEditor({ datensatz: null, schluessel: null })}
                >
                  + Neue Oberfläche
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {importErfolg ? (
          <div className={styles.importErfolg} role="status">
            <span aria-hidden="true">✓</span>
            <span>{importErfolg}</span>
            <button type="button" className={styles.aenderungZu} onClick={() => setImportErfolg(null)}>
              ausblenden
            </button>
          </div>
        ) : null}

        {importProbleme.length > 0 ? (
          <div className={styles.importWarnung} role="alert">
            <span aria-hidden="true">⚠</span>
            <span>
              {importProbleme.length} fehlerhafte/unvollständige Einträge importiert — bitte prüfen. Die
              betroffenen Zeilen sind im Gitter markiert; per Doppelklick nacharbeiten.
            </span>
            <button
              type="button"
              className={styles.aenderungZu}
              onClick={() => springeZu(importProbleme[0])}
            >
              → zum ersten Eintrag
            </button>
          </div>
        ) : null}

        {meldung ? (
          <div className={meldung.art === 'fehler' ? styles.meldungFehler : styles.meldungInfo}>
            {meldung.text}
            <button type="button" className={styles.meldungZu} onClick={() => setMeldung(null)} aria-label="Meldung schließen">
              ✕
            </button>
          </div>
        ) : null}

        <div className={styles.gitterFlaeche}>
          {bereich === 'artikel' ? (
            <DataGrid
              spalten={artikelLayout.sichtbar}
              breiten={artikelLayout.layout.breiten}
              onBreite={artikelLayout.setBreite}
              fokusZeile={fokus?.zeilenId}
              fokusLauf={fokus?.lauf}
              onVersteckeSpalte={artikelLayout.versteckeSpalte}
              zeilen={gefilterteArtikel}
              zeilenId={(a) => a.artikelnummer}
              onOeffnen={(a) => setArtikelEditor({ artikel: a })}
              aktionen={artikelAktionen}
              maxZeilen={MAX_ZEILEN}
              leerText="Kein Artikel passt zur Filterung."
              zeilenKlasse={(a) =>
                j(
                  problemFuer('artikel', a.artikelnummer) && styles.zeileImportfehler,
                  !problemFuer('artikel', a.artikelnummer) &&
                    istArtikelGeaendert(a.artikelnummer) &&
                    styles.zeileGeaendert,
                  a.status === 'gesperrt' && styles.zeileGesperrt,
                  a.status === 'entwurf' && styles.zeileEntwurf,
                )
              }
            />
          ) : null}

          {bereich === 'preise' ? (
            <DataGrid
              spalten={preisLayout.sichtbar}
              breiten={preisLayout.layout.breiten}
              onBreite={preisLayout.setBreite}
              fokusZeile={fokus?.zeilenId}
              fokusLauf={fokus?.lauf}
              onVersteckeSpalte={preisLayout.versteckeSpalte}
              zeilen={gefiltertePreise}
              zeilenId={(r) => preisSchluessel(r.zeile)}
              onOeffnen={(r) => r.artikel && setArtikelEditor({ artikel: r.artikel, bereich: 'preise' })}
              aktionen={preisAktionen}
              maxZeilen={MAX_ZEILEN}
              leerText="Keine Preiszeile passt zur Filterung."
              zeilenKlasse={(r) =>
                zeilenKlasseFuer('preise', preisSchluessel(r.zeile), istPreisGeaendert(preisSchluessel(r.zeile)))
              }
              gruppenKopf={(r) =>
                r.gruppenwechsel ? (
                  <span className={styles.gruppe}>
                    <span className={styles.gruppeNr}>{r.zeile.artikel}</span>
                    <span className={styles.gruppeName}>{r.artikel?.bezeichnung ?? 'unbekannter Artikel'}</span>
                    {r.artikel ? (
                      <span className={styles.gruppeMeta}>
                        {r.artikel.teileart} · {r.artikel.dropdown} · {r.artikel.einheit}
                      </span>
                    ) : null}
                    <span className={styles.gruppeAchsen}>
                      {r.artikel && r.artikel.achsen.length > 0 ? (
                        r.artikel.achsen.map((code, i) => (
                          <span key={code} className={styles.achsenTag}>
                            <b>A{i + 1}</b> {achsenBedeutung(code)}
                          </span>
                        ))
                      ) : (
                        <span className={styles.achsenTag}>ohne Achsen</span>
                      )}
                    </span>
                  </span>
                ) : null
              }
            />
          ) : null}

          {bereich === 'oberflaechen' ? (
            <DataGrid
              spalten={oberflaechenLayout.sichtbar}
              breiten={oberflaechenLayout.layout.breiten}
              onBreite={oberflaechenLayout.setBreite}
              fokusZeile={fokus?.zeilenId}
              fokusLauf={fokus?.lauf}
              onVersteckeSpalte={oberflaechenLayout.versteckeSpalte}
              zeilen={gefilterteOberflaechen}
              zeilenId={(r) => r.schluessel}
              onOeffnen={oeffneOberflaeche}
              aktionen={oberflaechenAktionen}
              maxZeilen={MAX_ZEILEN}
              leerText="Keine Oberfläche passt zur Filterung."
              zeilenKlasse={(r) =>
                j(
                  problemFuer('oberflaechen', r.schluessel) && styles.zeileImportfehler,
                  r.art === 'kategorie' && styles.zeileEntwurf,
                  r.art === 'kategorie' && r.kategorie && istKategorieGeaendert(r.kategorie.id) && styles.zeileGeaendert,
                  r.art === 'oberflaeche' &&
                    r.oberflaeche &&
                    istOberflaecheGeaendert(oberflaecheSchluessel(r.oberflaeche)) &&
                    styles.zeileGeaendert,
                  (r.art === 'kategorie' ? r.kategorie?.status : r.oberflaeche?.status) === 'gesperrt' &&
                    styles.zeileGesperrt,
                )
              }
            />
          ) : null}

          {bereich === 'berater' ? (
            <DataGrid
              spalten={beraterLayout.sichtbar}
              breiten={beraterLayout.layout.breiten}
              onBreite={beraterLayout.setBreite}
              fokusZeile={fokus?.zeilenId}
              fokusLauf={fokus?.lauf}
              onVersteckeSpalte={beraterLayout.versteckeSpalte}
              zeilen={gefilterteBerater}
              zeilenId={(r) => r.m.personalnr}
              onOeffnen={(r) => setBeraterEditor({ datensatz: r.m, zugang: LEERER_ZUGANG })}
              aktionen={beraterAktionen}
              leerText="Kein Mitarbeiter passt zur Filterung."
              zeilenKlasse={(r) =>
                zeilenKlasseFuer('berater', r.m.personalnr, istMitarbeiterGeaendert(r.m.personalnr))
              }
            />
          ) : null}

          {bereich === 'filialen' ? (
            <DataGrid
              spalten={filialLayout.sichtbar}
              breiten={filialLayout.layout.breiten}
              onBreite={filialLayout.setBreite}
              fokusZeile={fokus?.zeilenId}
              fokusLauf={fokus?.lauf}
              onVersteckeSpalte={filialLayout.versteckeSpalte}
              zeilen={gefilterteFilialen}
              zeilenId={(f) => f.filialnr}
              onOeffnen={(f) => setFilialEditor({ datensatz: f })}
              aktionen={filialAktionen}
              leerText="Keine Filiale passt zur Suche."
              zeilenKlasse={(f) => zeilenKlasseFuer('filialen', f.filialnr, istFilialeGeaendert(f.filialnr))}
            />
          ) : null}

          {bereich === 'handbuch' ? <Handbuch /> : null}
        </div>

        <footer className={styles.statusleiste}>
          <span>
            Grundstand <code>Cramer-Stammdaten.xlsx</code> · Doppelklick öffnet den Editor · Zellen
            markieren und <kbd>Strg</kbd>+<kbd>C</kbd> kopiert nach Excel
          </span>
          <span className={styles.statusRechts}>
            {bereich === 'artikel' ? `${formatGanzzahl(gefilterteArtikel.length)} von ${formatGanzzahl(stand.artikel.length)} Artikeln` : null}
            {bereich === 'preise' ? `${formatGanzzahl(gefiltertePreise.length)} von ${formatGanzzahl(stand.preise.length)} Preiszeilen` : null}
            {bereich === 'oberflaechen'
              ? `${stand.oberflaechenkategorien.length} Kategorien · ${formatGanzzahl(stand.oberflaechen.length)} Oberflächen`
              : null}
            {bereich === 'berater' ? `${gefilterteBerater.length} von ${stand.mitarbeiter.length} Mitarbeitern` : null}
            {bereich === 'filialen' ? `${gefilterteFilialen.length} von ${stand.filialen.length} Filialen` : null}
            {bereich === 'handbuch' ? 'Pflegeregeln und Nummernsystematik' : null}
          </span>
        </footer>
      </div>

      {artikelEditor ? (
        <ArtikelDetailModal
          artikel={artikelEditor.artikel}
          preiszeilen={artikelEditor.artikel ? stand.preise.filter((p) => p.artikel === artikelEditor.artikel!.artikelnummer) : []}
          startBereich={artikelEditor.bereich}
          onClose={() => {
            if (artikelEditor.artikel) pruefeImportMarke('artikel', artikelEditor.artikel.artikelnummer)
            setArtikelEditor(null)
          }}
        />
      ) : null}

      {beraterEditor ? (
        <DatensatzModal<Mitarbeiter>
          titel={beraterEditor.datensatz ? beraterEditor.datensatz.name : 'Berater'}
          datensatz={beraterEditor.datensatz}
          leerwert={() => ({ personalnr: '', name: '', email: '', rolle: 'berater', filiale: stand.filialen[0]?.filialnr ?? '', status: 'aktiv', bemerkung: '' })}
          untertitel={(e) => `${e.personalnr || 'neue Personalnummer'} · ${e.rolle}`}
          felder={BERATER_FELDER(stand.filialen)}
          zusatz={(e) => (
            <BeraterZugang
              vorhanden={hatZugang(e.personalnr)}
              gesetztAm={getZugang(e.personalnr)?.gesetztAm ?? null}
              status={e.status}
              email={e.email}
              wert={beraterEditor.zugang}
              onChange={(zugang) => setBeraterEditor((s) => (s ? { ...s, zugang } : s))}
            />
          )}
          onSpeichern={async (entwurf, anlegen) => {
            const zugang = beraterEditor.zugang
            const problem = pruefeZugangEntwurf(zugang, hatZugang(entwurf.personalnr))
            if (problem) return problem

            // Erst der Stammsatz: schlägt er fehl (Nummer vergeben, Name leer), darf kein
            // Passwort auf einer Personalnummer landen, die es gar nicht gibt.
            if (anlegen) {
              const stammProblem = legeMitarbeiterAn(entwurf)
              if (stammProblem) return stammProblem
            } else {
              aendereMitarbeiter(entwurf.personalnr, entwurf)
            }

            if (zugang.entziehen) entferneZugang(entwurf.personalnr)
            else if (zugang.neuesPasswort) await setzeZugang(entwurf.personalnr, zugang.neuesPasswort)
            pruefeImportMarke('berater', entwurf.personalnr)
            return null
          }}
          onClose={() => setBeraterEditor(null)}
        />
      ) : null}

      {kategorieEditor ? (
        <DatensatzModal<KategorieForm>
          titel={kategorieEditor.datensatz ? kategorieEditor.datensatz.bezeichnung : 'Oberflächenkategorie'}
          datensatz={kategorieEditor.datensatz}
          leerwert={() => ({
            id: '',
            bezeichnung: '',
            preisgruppe: '',
            standardauswahl: 'ja',
            sortierung: String(naechsteSortierung()),
            status: 'aktiv',
            bemerkung: '',
          })}
          untertitel={(e) =>
            `${e.id || idVorschlag(e.bezeichnung) || 'neue ID'} · ${pgText(e.preisgruppe as PreisgruppenFeld)}`
          }
          felder={KATEGORIE_FELDER}
          onSpeichern={(entwurf, anlegen) => {
            const datensatz: Oberflaechenkategorie = {
              // Beim Anlegen darf die ID leer bleiben — dann wird sie aus der Bezeichnung
              // gebildet, damit niemand von Hand „raeuchereiche-geoelt" tippen muss.
              id: (entwurf.id.trim() || idVorschlag(entwurf.bezeichnung)).toLowerCase(),
              bezeichnung: entwurf.bezeichnung.trim(),
              preisgruppe: entwurf.preisgruppe as PreisgruppenFeld,
              standardauswahl: entwurf.standardauswahl === 'ja',
              sortierung: zahl(entwurf.sortierung, naechsteSortierung()),
              status: entwurf.status === 'gesperrt' ? 'gesperrt' : 'aktiv',
              bemerkung: entwurf.bemerkung,
            }
            if (anlegen) return legeKategorieAn(datensatz)
            aendereKategorie(datensatz.id, datensatz)
            pruefeImportMarke('oberflaechen', `kat:${datensatz.id}`)
            return null
          }}
          onClose={() => setKategorieEditor(null)}
        />
      ) : null}

      {oberflaecheEditor ? (
        <DatensatzModal<OberflaecheForm>
          titel={oberflaecheEditor.datensatz ? oberflaecheEditor.datensatz.bezeichnung : 'Oberfläche'}
          datensatz={oberflaecheEditor.datensatz}
          leerwert={() => {
            const kategorie =
              oberflaecheEditor.vorbelegteKategorie ?? stand.oberflaechenkategorien[0]?.id ?? ''
            return {
              id: '',
              kategorie,
              bezeichnung: '',
              preisgruppe: '',
              freitext: 'nein',
              freitextLabel: '',
              sortierung: String(naechsteSortierung(kategorie)),
              status: 'aktiv',
              bemerkung: '',
            }
          }}
          untertitel={(e) => {
            const k = stand.oberflaechenkategorien.find((x) => x.id === e.kategorie)
            const wirksam = (e.preisgruppe || k?.preisgruppe || '') as PreisgruppenFeld
            return `${k?.bezeichnung ?? 'ohne Kategorie'} · ${e.id || idVorschlag(e.bezeichnung) || 'neue ID'} · ${pgText(wirksam)}`
          }}
          felder={OBERFLAECHE_FELDER(stand.oberflaechenkategorien)}
          onSpeichern={(entwurf, anlegen) => {
            const datensatz: Oberflaeche = {
              id: (entwurf.id.trim() || idVorschlag(entwurf.bezeichnung)).toLowerCase(),
              kategorie: entwurf.kategorie,
              bezeichnung: entwurf.bezeichnung.trim(),
              preisgruppe: entwurf.preisgruppe as PreisgruppenFeld,
              freitext: entwurf.freitext === 'ja',
              freitextLabel: entwurf.freitextLabel.trim(),
              sortierung: zahl(entwurf.sortierung, naechsteSortierung(entwurf.kategorie)),
              status: entwurf.status === 'gesperrt' ? 'gesperrt' : 'aktiv',
              bemerkung: entwurf.bemerkung,
            }
            if (anlegen) return legeOberflaecheAn(datensatz)
            aendereOberflaeche(oberflaecheEditor.schluessel ?? oberflaecheSchluessel(datensatz), datensatz)
            pruefeImportMarke('oberflaechen', `obf:${oberflaecheSchluessel(datensatz)}`)
            return null
          }}
          onClose={() => setOberflaecheEditor(null)}
        />
      ) : null}

      {filialEditor ? (
        <DatensatzModal<Filiale>
          titel={filialEditor.datensatz ? filialEditor.datensatz.name : 'Filiale'}
          datensatz={filialEditor.datensatz}
          leerwert={() => ({ filialnr: '', name: '', strasse: '', plz: '', ort: '', telefon: '', email: '', status: 'aktiv', altId: '' })}
          untertitel={(e) => `${e.filialnr || 'neue Filialnummer'}${e.ort ? ` · ${e.ort}` : ''}`}
          felder={FILIAL_FELDER}
          onSpeichern={(entwurf, anlegen) => {
            if (anlegen) return legeFilialeAn(entwurf)
            aendereFiliale(entwurf.filialnr, entwurf)
            pruefeImportMarke('filialen', entwurf.filialnr)
            return null
          }}
          onClose={() => setFilialEditor(null)}
        />
      ) : null}

      {/* Vorschau-Fenster der Änderungen — liegt bewusst ueber allem, statt wie
          frueher als Panel ueber den Tabellen zu stehen, wo es bei langen Listen
          untergegangen ist. */}
      <AenderungenModal
        offen={aenderungenOffen}
        aenderungen={aenderungsListe}
        bereichTitel={BEREICH_TITEL}
        onClose={() => setAenderungenOffen(false)}
        onSpringeZu={springeZu}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Feldmasken der beiden einfachen Bereiche
// ---------------------------------------------------------------------------

const BERATER_FELDER = (filialen: readonly Filiale[]): FeldDef<Mitarbeiter>[] => [
  { feld: 'personalnr', label: 'Personalnummer', schluessel: true, mono: true, hinweis: 'Identität — nach dem Anlegen nicht mehr änderbar' },
  { feld: 'name', label: 'Name' },
  { feld: 'email', label: 'E-Mail', hinweis: 'zugleich die Anmeldung im Konfigurator' },
  {
    feld: 'rolle',
    label: 'Rolle',
    optionen: [
      { wert: 'berater', titel: 'berater — erscheint im Berater-Dropdown' },
      { wert: 'admin', titel: 'admin — Systemadministration' },
    ],
  },
  {
    feld: 'filiale',
    label: 'Filiale',
    optionen: [{ wert: '', titel: '— ohne Filiale —' }, ...filialen.map((f) => ({ wert: f.filialnr, titel: `${f.filialnr} · ${f.name}` }))],
  },
  {
    feld: 'status',
    label: 'Status',
    optionen: [
      { wert: 'aktiv', titel: 'aktiv' },
      { wert: 'gesperrt', titel: 'gesperrt' },
    ],
    hinweis: 'nur „aktiv" erscheint im Konfigurator',
  },
  { feld: 'bemerkung', label: 'Bemerkung', breit: true },
]

const FILIAL_FELDER: FeldDef<Filiale>[] = [
  { feld: 'filialnr', label: 'Filialnummer', schluessel: true, mono: true, hinweis: 'Muster F-00x — Identität, nicht änderbar' },
  { feld: 'name', label: 'Name', breit: true },
  { feld: 'strasse', label: 'Straße' },
  { feld: 'plz', label: 'PLZ', mono: true },
  { feld: 'ort', label: 'Ort' },
  { feld: 'telefon', label: 'Telefon', mono: true },
  { feld: 'email', label: 'E-Mail' },
  {
    feld: 'status',
    label: 'Status',
    optionen: [
      { wert: 'aktiv', titel: 'aktiv' },
      { wert: 'gesperrt', titel: 'gesperrt' },
    ],
  },
  { feld: 'altId', label: 'Alt-ID', mono: true, breit: true, hinweis: 'frühere Code-ID — löst branchId gespeicherter Entwürfe auf, bitte nicht ändern' },
]
