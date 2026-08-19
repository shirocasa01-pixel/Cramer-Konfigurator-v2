import { useEffect, useMemo, useRef, useState } from 'react'
import {
  achsen as achsenKatalog,
  produktgruppen,
  serien,
  teilearten,
  type Artikel,
  type Filiale,
  type Mitarbeiter,
  type Preiszeile,
} from '../../data/stammdaten.generated.ts'
import { formatEuroOderLeer, formatGanzzahl } from '../../lib/format.ts'
import { modusErlaubt } from '../../lib/modus.ts'
import { exportiereXlsx, importiereXlsx } from '../../lib/stammdatenExport.ts'
import {
  aendereFiliale,
  aendereMitarbeiter,
  dupliziereArtikel,
  istArtikelGeaendert,
  istFilialeGeaendert,
  istMitarbeiterGeaendert,
  istPreisGeaendert,
  legeFilialeAn,
  legeMitarbeiterAn,
  loescheArtikel,
  loescheFiliale,
  loescheMitarbeiter,
  loeschePreiszeile,
  preisSchluessel,
  setzeAllesZurueck,
  uebernehmeImport,
  zaehleAenderungen,
} from '../../lib/stammdatenStore.ts'
import { useStammdaten } from '../../lib/useStammdaten.ts'
import { entferneZugang, getZugang, hatZugang, setzeZugang } from '../../lib/zugangStore.ts'
import { ArtikelDetailModal } from './ArtikelDetailModal'
import { BeraterZugang, LEERER_ZUGANG, pruefeZugangEntwurf, type ZugangEntwurf } from './BeraterZugang'
import { DataGrid, SpaltenMenue, useSpaltenLayout, type SpaltenDef, type ZeilenAktion } from './DataGrid'
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

export interface StammdatenAdminModalProps {
  open: boolean
  onClose: () => void
}

type Bereich = 'artikel' | 'preise' | 'berater' | 'filialen' | 'handbuch'

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
  { id: 'teileart', titel: 'Teileart', breite: 124, wert: (a) => a.teileart },
  { id: 'produktgruppe', titel: 'Produktgruppe', breite: 150, wert: (a) => a.produktgruppe },
  { id: 'artikelgruppe', titel: 'Artikelgruppe', breite: 160, wert: (a) => a.artikelgruppe },
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
  { id: 'teileart', titel: 'Teileart', breite: 120, standard: false, wert: (r) => r.artikel?.teileart ?? '' },
  { id: 'produktgruppe', titel: 'Produktgruppe', breite: 148, standard: false, wert: (r) => r.artikel?.produktgruppe ?? '' },
  { id: 'artikelgruppe', titel: 'Artikelgruppe', breite: 158, standard: false, wert: (r) => r.artikel?.artikelgruppe ?? '' },
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
  const [gruppenFilter, setGruppenFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [teileartFilter, setTeileartFilter] = useState<string[]>([])
  const [meldung, setMeldung] = useState<{ art: 'info' | 'fehler'; text: string } | null>(null)

  const [artikelEditor, setArtikelEditor] = useState<{ artikel: Artikel | null; bereich?: 'allgemein' | 'preise' } | null>(null)
  const [beraterEditor, setBeraterEditor] = useState<{ datensatz: Mitarbeiter | null; zugang: ZugangEntwurf } | null>(null)
  const [filialEditor, setFilialEditor] = useState<{ datensatz: Filiale | null } | null>(null)
  const dateiRef = useRef<HTMLInputElement>(null)

  const artikelLayout = useSpaltenLayout(ARTIKEL_SPALTEN, 'cramer-planer.grid.artikel.v2')
  const preisLayout = useSpaltenLayout(PREIS_SPALTEN, 'cramer-planer.grid.preise.v2')
  const beraterLayout = useSpaltenLayout(BERATER_SPALTEN, 'cramer-planer.grid.berater.v1')
  const filialLayout = useSpaltenLayout(FILIAL_SPALTEN, 'cramer-planer.grid.filialen.v1')

  const einEditorOffen = Boolean(artikelEditor || beraterEditor || filialEditor)

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
        if (gruppenFilter.length && !gruppenFilter.includes(a.produktgruppe)) return false
        if (statusFilter.length && !statusFilter.includes(a.status)) return false
        if (teileartFilter.length && !teileartFilter.includes(a.teileart)) return false
      }
      if (!begriff) return true
      const text = a
        ? `${a.artikelnummer} ${a.kurzzeichen} ${a.bezeichnung} ${a.bezeichnung2} ${a.artikelgruppe} ${zusatz}`
        : zusatz
      return text.toLowerCase().includes(begriff)
    }
  }, [suche, serienFilter, gruppenFilter, statusFilter, teileartFilter])

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

  const gefilterteFilialen = useMemo(() => {
    const begriff = suche.trim().toLowerCase()
    return stand.filialen.filter(
      (f) => !begriff || `${f.filialnr} ${f.name} ${f.strasse} ${f.plz} ${f.ort} ${f.email}`.toLowerCase().includes(begriff),
    )
  }, [stand.filialen, suche])

  const aenderungen = zaehleAenderungen()
  const aktiveFilter = serienFilter.length + gruppenFilter.length + statusFilter.length + teileartFilter.length
  const istArtikelBereich = bereich === 'artikel' || bereich === 'preise'

  // --- Aktionen ---------------------------------------------------------------------

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
    {
      id: 'del',
      titel: 'Löschen',
      symbol: '🗑',
      gefahr: true,
      ausfuehren: (a) => {
        const zeilen = stand.preise.filter((p) => p.artikel === a.artikelnummer).length
        const ok = window.confirm(
          `„${a.bezeichnung}" (${a.artikelnummer}) löschen?` +
            (zeilen > 0 ? `\n\n${zeilen} zugehörige Preiszeile(n) werden mit entfernt — ohne Artikel wären sie nicht auffindbar.` : ''),
        )
        if (ok) loescheArtikel(a.artikelnummer)
      },
    },
  ]

  const preisAktionen: ZeilenAktion<PreisZeileMitKontext>[] = [
    { id: 'edit', titel: 'Artikel bearbeiten', symbol: '✎', ausfuehren: (r) => r.artikel && setArtikelEditor({ artikel: r.artikel, bereich: 'preise' }) },
    {
      id: 'del',
      titel: 'Preiszeile löschen',
      symbol: '🗑',
      gefahr: true,
      ausfuehren: (r) => {
        const achsen = r.zeile.a.filter(Boolean).join(' · ') || 'ohne Achsenwerte'
        if (window.confirm(`Preiszeile ${r.zeile.artikel} (${achsen}) löschen?`)) {
          loeschePreiszeile(preisSchluessel(r.zeile))
        }
      },
    },
  ]

  const beraterAktionen: ZeilenAktion<BeraterZeile>[] = [
    { id: 'edit', titel: 'Bearbeiten', symbol: '✎', ausfuehren: (r) => setBeraterEditor({ datensatz: r.m, zugang: LEERER_ZUGANG }) },
    {
      id: 'del',
      titel: 'Löschen',
      symbol: '🗑',
      gefahr: true,
      ausfuehren: (r) => {
        if (!window.confirm(`Mitarbeiter „${r.m.name}" (${r.m.personalnr}) löschen?`)) return
        loescheMitarbeiter(r.m.personalnr)
        // Zugang mit entfernen — sonst erbt eine später neu vergebene Personalnummer
        // stillschweigend das alte Passwort.
        entferneZugang(r.m.personalnr)
      },
    },
  ]

  const filialAktionen: ZeilenAktion<Filiale>[] = [
    { id: 'edit', titel: 'Bearbeiten', symbol: '✎', ausfuehren: (f) => setFilialEditor({ datensatz: f }) },
    {
      id: 'del',
      titel: 'Löschen',
      symbol: '🗑',
      gefahr: true,
      ausfuehren: (f) => {
        if (!window.confirm(`Filiale „${f.name}" (${f.filialnr}) löschen?`)) return
        const problem = loescheFiliale(f.filialnr)
        if (problem) setMeldung({ art: 'fehler', text: problem })
      },
    },
  ]

  function handleExport() {
    const name = exportiereXlsx({
      artikel: bereich === 'artikel' ? gefilterteArtikel : stand.artikel,
      preise: bereich === 'preise' ? gefiltertePreise.map((r) => r.zeile) : stand.preise,
      mitarbeiter: stand.mitarbeiter,
      filialen: stand.filialen,
    })
    setMeldung({ art: 'info', text: `${name} heruntergeladen — vier Blätter, Spaltennamen wie in der Mappe.` })
  }

  async function handleImport(datei: File) {
    try {
      const ergebnis = await importiereXlsx(datei)
      const { uebernommen, bereiche } = uebernehmeImport(ergebnis)
      const text = uebernommen
        ? `${bereiche.join(' · ')} übernommen.`
        : 'Nichts übernommen — keine bekannten Blattnamen gefunden.'
      setMeldung({
        art: ergebnis.meldungen.length ? 'fehler' : 'info',
        text: [text, ...ergebnis.meldungen].join(' '),
      })
    } catch (err) {
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
          {aenderungen > 0 ? <span className={styles.dirtyBadge}>{aenderungen} geändert</span> : null}
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
          <button type="button" className={styles.schliessen} onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </header>

        <nav className={styles.reiter} role="tablist">
          {(
            [
              ['artikel', 'Artikelstamm', stand.artikel.length],
              ['preise', 'Preisblatt & Achsen', stand.preise.length],
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
                  label="Produktgruppe"
                  optionen={produktgruppen.map((p) => ({ wert: p.code, titel: p.bezeichnung }))}
                  ausgewaehlt={gruppenFilter}
                  onChange={setGruppenFilter}
                />
                <MehrfachFilter
                  label="Teileart"
                  optionen={teilearten.map((t) => ({ wert: t.code, titel: `${t.code} — ${t.bezeichnung}` }))}
                  ausgewaehlt={teileartFilter}
                  onChange={setTeileartFilter}
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
                  setGruppenFilter([])
                  setStatusFilter([])
                  setTeileartFilter([])
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
              onVersteckeSpalte={artikelLayout.versteckeSpalte}
              zeilen={gefilterteArtikel}
              zeilenId={(a) => a.artikelnummer}
              onOeffnen={(a) => setArtikelEditor({ artikel: a })}
              aktionen={artikelAktionen}
              maxZeilen={MAX_ZEILEN}
              leerText="Kein Artikel passt zur Filterung."
              zeilenKlasse={(a) =>
                j(
                  istArtikelGeaendert(a.artikelnummer) && styles.zeileGeaendert,
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
              onVersteckeSpalte={preisLayout.versteckeSpalte}
              zeilen={gefiltertePreise}
              zeilenId={(r) => preisSchluessel(r.zeile)}
              onOeffnen={(r) => r.artikel && setArtikelEditor({ artikel: r.artikel, bereich: 'preise' })}
              aktionen={preisAktionen}
              maxZeilen={MAX_ZEILEN}
              leerText="Keine Preiszeile passt zur Filterung."
              zeilenKlasse={(r) => (istPreisGeaendert(preisSchluessel(r.zeile)) ? styles.zeileGeaendert : undefined)}
              gruppenKopf={(r) =>
                r.gruppenwechsel ? (
                  <span className={styles.gruppe}>
                    <span className={styles.gruppeNr}>{r.zeile.artikel}</span>
                    <span className={styles.gruppeName}>{r.artikel?.bezeichnung ?? 'unbekannter Artikel'}</span>
                    {r.artikel ? (
                      <span className={styles.gruppeMeta}>
                        {r.artikel.teileart} · {r.artikel.produktgruppe} · {r.artikel.artikelgruppe} · {r.artikel.einheit}
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

          {bereich === 'berater' ? (
            <DataGrid
              spalten={beraterLayout.sichtbar}
              breiten={beraterLayout.layout.breiten}
              onBreite={beraterLayout.setBreite}
              onVersteckeSpalte={beraterLayout.versteckeSpalte}
              zeilen={gefilterteBerater}
              zeilenId={(r) => r.m.personalnr}
              onOeffnen={(r) => setBeraterEditor({ datensatz: r.m, zugang: LEERER_ZUGANG })}
              aktionen={beraterAktionen}
              leerText="Kein Mitarbeiter passt zur Filterung."
              zeilenKlasse={(r) => (istMitarbeiterGeaendert(r.m.personalnr) ? styles.zeileGeaendert : undefined)}
            />
          ) : null}

          {bereich === 'filialen' ? (
            <DataGrid
              spalten={filialLayout.sichtbar}
              breiten={filialLayout.layout.breiten}
              onBreite={filialLayout.setBreite}
              onVersteckeSpalte={filialLayout.versteckeSpalte}
              zeilen={gefilterteFilialen}
              zeilenId={(f) => f.filialnr}
              onOeffnen={(f) => setFilialEditor({ datensatz: f })}
              aktionen={filialAktionen}
              leerText="Keine Filiale passt zur Suche."
              zeilenKlasse={(f) => (istFilialeGeaendert(f.filialnr) ? styles.zeileGeaendert : undefined)}
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
          onClose={() => setArtikelEditor(null)}
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
            return null
          }}
          onClose={() => setBeraterEditor(null)}
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
            return null
          }}
          onClose={() => setFilialEditor(null)}
        />
      ) : null}
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
