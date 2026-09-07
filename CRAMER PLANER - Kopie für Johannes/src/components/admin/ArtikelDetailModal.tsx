import { useEffect, useMemo, useState } from 'react'
import {
  achsen as achsenKatalog,
  artikelgruppen,
  preislogiken,
  produktgruppen,
  serien,
  teilearten,
  type AchseCode,
  type Artikel,
  type Preiszeile,
} from '../../data/stammdaten.generated.ts'
import { formatDezimal, parseEingabeDe } from '../../lib/format.ts'
import { parseModus } from '../../lib/modus.ts'
import {
  aendereArtikel,
  aenderePreiszeile,
  legeArtikelAn,
  legePreiszeileAn,
  loeschePreiszeile,
  preisSchluessel,
  type Achsenwerte,
} from '../../lib/stammdatenStore.ts'
import styles from './ArtikelDetailModal.module.css'

/**
 * ARTIKEL-DETAIL — Anlegen und Bearbeiten eines Artikels samt seiner Preiszeilen.
 *
 * Der Entwurf lebt vollständig im lokalen Formular-State. Erst „Änderungen speichern"
 * schreibt in den Store; „Abbrechen" verwirft alles. Das ist der Unterschied zur
 * früheren Inline-Bearbeitung: in einer Tabelle mit 1509 Zeilen ist ein versehentlicher
 * Tastendruck sonst eine stille Datenänderung, die niemandem auffällt.
 *
 * Drei Bereiche:
 *   Allgemein               Nummer, Bezeichnungen 1–4, Einheit, Beschreibung, Quelle
 *   Klassifikation & Status Teileart, Produktgruppe, Artikelgruppe, Modus, Status, Sortierung
 *   Preise & Achsen         Achsen A1–A5 des Artikels und alle seine Preiszellen
 *
 * Alle 22 Felder des Blattes „10 Artikel" sind vertreten — die Artikelnummer als
 * einziges nur beim Anlegen beschreibbar: sie ist Identität und wird laut
 * ARTIKELNUMMER-LOGIK.md nie geändert.
 */

const STATUS_WERTE = ['aktiv', 'gesperrt', 'entwurf'] as const
const PREIS_STATUS_WERTE = ['fixed', 'on-request', 'note'] as const
const ACHSEN_CODES = achsenKatalog.map((a) => a.code)

export interface ArtikelDetailModalProps {
  /** `null` ⇒ Anlegemodus. */
  artikel: Artikel | null
  /** Preiszeilen des Artikels (im Anlegemodus leer). */
  preiszeilen: Preiszeile[]
  /** Reiter, mit dem geöffnet wird. */
  startBereich?: Bereich
  onClose: () => void
}

type Bereich = 'allgemein' | 'klassifikation' | 'preise'

const BEREICHE: { id: Bereich; titel: string }[] = [
  { id: 'allgemein', titel: 'Allgemein' },
  { id: 'klassifikation', titel: 'Klassifikation & Status' },
  { id: 'preise', titel: 'Preise & Achsen' },
]

/** Leerer Artikel für den Anlegemodus. */
function leererArtikel(): Artikel {
  return {
    artikelnummer: '',
    kurzzeichen: '',
    bezeichnung: '',
    bezeichnung2: '',
    teileart: teilearten[0].code,
    produktgruppe: produktgruppen[0].code,
    artikelgruppe: artikelgruppen[0].code,
    modus: '',
    preislogik: 'FESTPREIS',
    einheit: 'Stück',
    achsenText: '—',
    achsen: [],
    preiszellen: null,
    oberflaeche: false,
    status: 'aktiv',
    sortierung: null,
    quelle: 'in der Anwendung angelegt',
    bemerkung: '',
  } as Artikel
}

export function ArtikelDetailModal({
  artikel,
  preiszeilen,
  startBereich = 'allgemein',
  onClose,
}: ArtikelDetailModalProps) {
  const anlegen = artikel === null
  const [bereich, setBereich] = useState<Bereich>(startBereich)
  const [form, setForm] = useState<Artikel>(() => ({ ...(artikel ?? leererArtikel()) }))
  const [zeilen, setZeilen] = useState<Preiszeile[]>(() => preiszeilen.map((z) => ({ ...z, a: [...z.a] as Achsenwerte })))
  const [entfernt, setEntfernt] = useState<string[]>([])
  /** Rohe Tastatureingabe je Preiszeile, solange das Feld den Fokus hat. */
  const [preisEingaben, setPreisEingaben] = useState<Record<number, string>>({})
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    function beiEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', beiEsc)
    return () => document.removeEventListener('keydown', beiEsc)
  }, [onClose])

  const setFeld = <K extends keyof Artikel>(feld: K, wert: Artikel[K]) =>
    setForm((f) => ({ ...f, [feld]: wert }))

  /** Die im Modus erkannten Serien — die Auswertung ist dieselbe wie im Konfigurator. */
  const erkannteSerien = useMemo(() => {
    const codes = parseModus(form.modus, serien.map((s) => s.code))
    return codes.map((c) => serien.find((s) => s.code === c)!).filter(Boolean)
  }, [form.modus])

  function speichern() {
    const nummer = form.artikelnummer.trim()
    if (!form.bezeichnung.trim()) {
      setFehler('Bitte eine Bezeichnung angeben.')
      setBereich('allgemein')
      return
    }

    if (anlegen) {
      const problem = legeArtikelAn({ ...form, artikelnummer: nummer })
      if (problem) {
        setFehler(problem)
        setBereich('allgemein')
        return
      }
    } else {
      aendereArtikel(nummer, form)
    }

    // Preiszeilen: entfernte zuerst, dann geänderte/neue.
    for (const schluessel of entfernt) loeschePreiszeile(schluessel)
    for (const zeile of zeilen) {
      const original = preiszeilen.find((z) => preisSchluessel(z) === preisSchluessel(zeile))
      if (!original) {
        const problem = legePreiszeileAn(zeile)
        if (problem) {
          setFehler(problem)
          setBereich('preise')
          return
        }
        continue
      }
      const geaendert =
        original.preis !== zeile.preis ||
        original.status !== zeile.status ||
        original.seite !== zeile.seite ||
        original.a.join('|') !== zeile.a.join('|')
      if (geaendert) aenderePreiszeile(preisSchluessel(original), zeile)
    }

    onClose()
  }

  const achsenAnzahl = Math.max(form.achsen.length, 1)

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Artikel bearbeiten">
      <div className={styles.dialog}>
        <header className={styles.kopf}>
          <div>
            <h2 className={styles.titel}>{anlegen ? 'Neuer Artikel' : form.bezeichnung || 'Artikel'}</h2>
            <p className={styles.untertitel}>
              {anlegen ? (
                'Artikelnummer nach dem Muster TT-PP-GG-NNNN vergeben'
              ) : (
                <>
                  <span className={styles.mono}>{form.artikelnummer}</span>
                  {form.kurzzeichen ? ` · ${form.kurzzeichen}` : ''} · {zeilen.length} Preiszeile(n)
                </>
              )}
            </p>
          </div>
          <button type="button" className={styles.schliessen} onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </header>

        <nav className={styles.reiter} role="tablist">
          {BEREICHE.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={bereich === b.id}
              className={[styles.reiterKnopf, bereich === b.id ? styles.reiterAktiv : ''].filter(Boolean).join(' ')}
              onClick={() => setBereich(b.id)}
            >
              {b.titel}
              {b.id === 'preise' ? <span className={styles.reiterZaehler}>{zeilen.length}</span> : null}
            </button>
          ))}
        </nav>

        {fehler ? <div className={styles.fehler}>{fehler}</div> : null}

        <div className={styles.koerper}>
          {bereich === 'allgemein' ? (
            <div className={styles.felder}>
              <Feld label="Artikelnummer" hinweis={anlegen ? 'Muster TT-PP-GG-NNNN' : 'Identität — nicht änderbar'}>
                <input
                  className={[styles.input, styles.mono].join(' ')}
                  value={form.artikelnummer}
                  readOnly={!anlegen}
                  placeholder="30-30-05-0016"
                  onChange={(e) => setFeld('artikelnummer', e.target.value)}
                />
              </Feld>
              <Feld label="Kurzzeichen" hinweis="Lesehilfe, kein Schlüssel">
                <input
                  className={styles.input}
                  value={form.kurzzeichen}
                  onChange={(e) => setFeld('kurzzeichen', e.target.value)}
                />
              </Feld>
              <Feld label="Bezeichnung 1" breit>
                <input
                  className={styles.input}
                  value={form.bezeichnung}
                  onChange={(e) => setFeld('bezeichnung', e.target.value)}
                />
              </Feld>
              <Feld label="Bezeichnung 2" breit>
                <input
                  className={styles.input}
                  value={form.bezeichnung2}
                  onChange={(e) => setFeld('bezeichnung2', e.target.value)}
                />
              </Feld>
              <Feld label="Einheit">
                <input
                  className={styles.input}
                  value={form.einheit}
                  onChange={(e) => setFeld('einheit', e.target.value)}
                />
              </Feld>
              <Feld label="Oberfläche relevant">
                <label className={styles.schalter}>
                  <input
                    type="checkbox"
                    checked={form.oberflaeche}
                    onChange={(e) => setFeld('oberflaeche', e.target.checked)}
                  />
                  <span>Material-/Farbwahl wirkt auf diesen Artikel</span>
                </label>
              </Feld>
              <Feld label="Quelle" hinweis="Herkunft in der gedruckten Preisliste">
                <input
                  className={styles.input}
                  value={form.quelle}
                  onChange={(e) => setFeld('quelle', e.target.value)}
                />
              </Feld>
              <Feld label="Preiszellen" hinweis="Anzahl laut Stamm">
                <input
                  className={[styles.input, styles.num].join(' ')}
                  value={form.preiszellen ?? ''}
                  onChange={(e) =>
                    setFeld('preiszellen', e.target.value === '' ? null : Number(e.target.value) || null)
                  }
                />
              </Feld>
              <Feld label="Bemerkung" breit voll>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={form.bemerkung}
                  onChange={(e) => setFeld('bemerkung', e.target.value)}
                />
              </Feld>
            </div>
          ) : null}

          {bereich === 'klassifikation' ? (
            <div className={styles.felder}>
              <Feld label="Teileart" hinweis="Stelle 1 der Artikelnummer">
                <select
                  className={styles.input}
                  value={form.teileart}
                  onChange={(e) => setFeld('teileart', e.target.value as Artikel['teileart'])}
                >
                  {teilearten.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.nr} · {t.code} — {t.bezeichnung}
                    </option>
                  ))}
                </select>
              </Feld>
              <Feld label="Produktgruppe" hinweis="Schritt im Konfigurator">
                <select
                  className={styles.input}
                  value={form.produktgruppe}
                  onChange={(e) => setFeld('produktgruppe', e.target.value as Artikel['produktgruppe'])}
                >
                  {produktgruppen.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.nr} · {p.code} — {p.bezeichnung}
                    </option>
                  ))}
                </select>
              </Feld>
              <Feld label="Artikelgruppe" hinweis="Dropdown im Schritt">
                <select
                  className={styles.input}
                  value={form.artikelgruppe}
                  onChange={(e) => setFeld('artikelgruppe', e.target.value as Artikel['artikelgruppe'])}
                >
                  {artikelgruppen.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.nr} · {a.code} — {a.bezeichnung}
                    </option>
                  ))}
                </select>
              </Feld>
              <Feld label="Preislogik">
                <select
                  className={styles.input}
                  value={form.preislogik}
                  onChange={(e) => setFeld('preislogik', e.target.value as Artikel['preislogik'])}
                >
                  {preislogiken.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} — {p.bedeutung}
                    </option>
                  ))}
                </select>
              </Feld>
              <Feld label="Status">
                <select
                  className={styles.input}
                  value={form.status}
                  onChange={(e) => setFeld('status', e.target.value as Artikel['status'])}
                >
                  {STATUS_WERTE.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Feld>
              <Feld label="Sortierung" hinweis="Reihenfolge im Dropdown">
                <input
                  className={[styles.input, styles.num].join(' ')}
                  value={form.sortierung ?? ''}
                  onChange={(e) =>
                    setFeld('sortierung', e.target.value === '' ? null : Number(e.target.value) || null)
                  }
                />
              </Feld>

              <Feld
                label="Modus — Serien-Freigabe"
                hinweis="Reihenfolge und Trennzeichen egal · GROSS = Standard, klein = Sonderanfertigung"
                breit
                voll
              >
                <input
                  className={[styles.input, styles.mono].join(' ')}
                  value={form.modus}
                  placeholder="z. B. AVPR"
                  onChange={(e) => setFeld('modus', e.target.value)}
                />
                <div className={styles.serienChips}>
                  {serien.map((s) => {
                    const aktiv = erkannteSerien.some((e) => e.code === s.code)
                    return (
                      <button
                        key={s.code}
                        type="button"
                        className={[styles.chip, aktiv ? styles.chipAktiv : ''].filter(Boolean).join(' ')}
                        title={`${s.name} — ${s.schwerpunkt}`}
                        onClick={() => {
                          const vorhanden = parseModus(form.modus, serien.map((x) => x.code))
                          const neu = aktiv
                            ? vorhanden.filter((c) => c !== s.code)
                            : [...vorhanden, s.code]
                          const sortiert = serien.filter((x) => neu.includes(x.code)).map((x) => x.code)
                          setFeld('modus', sortiert.join(''))
                        }}
                      >
                        <span className={styles.chipCode}>{s.code}</span>
                        {s.name}
                      </button>
                    )
                  })}
                </div>
              </Feld>
            </div>
          ) : null}

          {bereich === 'preise' ? (
            <div className={styles.preiseBereich}>
              <div className={styles.achsenBox}>
                <div className={styles.achsenKopf}>
                  Achsen dieses Artikels
                  <span className={styles.achsenHinweis}>
                    legt fest, was die Spalten A1–A5 der Preiszeilen bedeuten
                  </span>
                </div>
                <div className={styles.achsenReihe}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <label key={i} className={styles.achsenFeld}>
                      <span className={styles.achsenLabel}>A{i + 1}</span>
                      <select
                        className={styles.input}
                        value={form.achsen[i] ?? ''}
                        onChange={(e) => {
                          const neu = [...form.achsen]
                          if (e.target.value === '') neu.splice(i)
                          else neu[i] = e.target.value as AchseCode
                          const bereinigt = neu.filter(Boolean) as AchseCode[]
                          setForm((f) => ({
                            ...f,
                            achsen: bereinigt,
                            achsenText: bereinigt.length ? bereinigt.join(' × ') : '—',
                          }))
                        }}
                      >
                        <option value="">—</option>
                        {ACHSEN_CODES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.preisScroll}>
              <table className={styles.preisTabelle}>
                <thead>
                  <tr>
                    {Array.from({ length: achsenAnzahl }, (_, i) => (
                      <th key={i}>
                        A{i + 1}
                        <span className={styles.spaltenBedeutung}>
                          {form.achsen[i]
                            ? achsenKatalog.find((a) => a.code === form.achsen[i])?.bedeutung ?? form.achsen[i]
                            : 'ohne Achse'}
                        </span>
                      </th>
                    ))}
                    <th className={styles.thNum}>Preis (EUR)</th>
                    <th>Status</th>
                    <th>Seite</th>
                    <th aria-label="Aktion" />
                  </tr>
                </thead>
                <tbody>
                  {zeilen.length === 0 ? (
                    <tr>
                      <td colSpan={achsenAnzahl + 4} className={styles.preisLeer}>
                        Noch keine Preiszeile.
                      </td>
                    </tr>
                  ) : null}

                  {zeilen.map((zeile, index) => (
                    <tr key={`${preisSchluessel(zeile)}-${index}`}>
                      {Array.from({ length: achsenAnzahl }, (_, i) => (
                        <td key={i}>
                          <input
                            className={styles.zellInput}
                            value={zeile.a[i] ?? ''}
                            disabled={!form.achsen[i]}
                            onChange={(e) => {
                              const neuA = [...zeile.a] as Achsenwerte
                              neuA[i] = e.target.value
                              setZeilen((zs) => zs.map((z, j) => (j === index ? { ...z, a: neuA } : z)))
                            }}
                          />
                        </td>
                      ))}
                      <td>
                        {/* Deutsche Eingabe: „1.250,00" sind eintausendzweihundertfünfzig.
                            Der Punkt tausendert, das Komma dezimiert. Gespeichert wird immer
                            die Zahl, angezeigt beim Verlassen des Feldes die formatierte
                            Fassung. */}
                        <input
                          className={[styles.zellInput, styles.num, styles.mono].join(' ')}
                          inputMode="decimal"
                          value={preisEingaben[index] ?? (zeile.preis == null ? '' : formatDezimal(zeile.preis))}
                          onChange={(e) => {
                            const roh = e.target.value
                            setPreisEingaben((p) => ({ ...p, [index]: roh }))
                            const wert = parseEingabeDe(roh)
                            setZeilen((zs) =>
                              zs.map((z, j) => (j === index ? { ...z, preis: roh.trim() === '' ? null : wert ?? z.preis } : z)),
                            )
                          }}
                          onBlur={() =>
                            setPreisEingaben((p) => {
                              const kopie = { ...p }
                              delete kopie[index]
                              return kopie
                            })
                          }
                        />
                      </td>
                      <td>
                        <select
                          className={styles.zellInput}
                          value={zeile.status}
                          onChange={(e) =>
                            setZeilen((zs) =>
                              zs.map((z, j) =>
                                j === index ? { ...z, status: e.target.value as Preiszeile['status'] } : z,
                              ),
                            )
                          }
                        >
                          {PREIS_STATUS_WERTE.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className={[styles.zellInput, styles.num].join(' ')}
                          value={zeile.seite}
                          onChange={(e) =>
                            setZeilen((zs) => zs.map((z, j) => (j === index ? { ...z, seite: e.target.value } : z)))
                          }
                        />
                      </td>
                      <td className={styles.preisAktion}>
                        <button
                          type="button"
                          className={styles.entfernen}
                          title="Preiszeile entfernen"
                          onClick={() => {
                            const original = preiszeilen.find(
                              (z) => preisSchluessel(z) === preisSchluessel(zeile),
                            )
                            if (original) setEntfernt((e) => [...e, preisSchluessel(original)])
                            setZeilen((zs) => zs.filter((_, j) => j !== index))
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              <button
                type="button"
                className={styles.zeileHinzu}
                disabled={anlegen}
                title={anlegen ? 'Erst den Artikel speichern, dann Preiszeilen anlegen' : undefined}
                onClick={() =>
                  setZeilen((zs) => [
                    ...zs,
                    {
                      artikel: form.artikelnummer,
                      a: ['', '', '', '', ''] as Achsenwerte,
                      preis: null,
                      status: 'fixed',
                      seite: '',
                      ref: null,
                    },
                  ])
                }
              >
                + Preiszeile hinzufügen
              </button>
            </div>
          ) : null}
        </div>

        <footer className={styles.fuss}>
          <span className={styles.fussHinweis}>
            Übernimmt Artikel und Preiszeilen in den Bearbeitungsstand. Verbindlich werden sie
            mit „Speichern" oben im Kopf.
          </span>
          <button type="button" className={styles.abbrechen} onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className={styles.speichern} onClick={speichern}>
            {anlegen ? 'Artikel anlegen' : 'Speichern'}
          </button>
        </footer>
      </div>
    </div>
  )
}

/** Ein Formularfeld mit Beschriftung und optionalem Hinweis. */
function Feld({
  label,
  hinweis,
  breit,
  voll,
  children,
}: {
  label: string
  hinweis?: string
  breit?: boolean
  voll?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={[styles.feld, breit ? styles.feldBreit : '', voll ? styles.feldVoll : ''].filter(Boolean).join(' ')}>
      <span className={styles.feldLabel}>{label}</span>
      {children}
      {hinweis ? <span className={styles.feldHinweis}>{hinweis}</span> : null}
    </div>
  )
}
