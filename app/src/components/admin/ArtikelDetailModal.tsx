import { useEffect, useMemo, useState } from 'react'
import {
  achsen as achsenKatalog,
  dropdowns,
  preislogiken,
  serien,
  teilearten,
  type AchseCode,
  type Artikel,
  type Preiszeile,
} from '../../data/stammdaten.generated.ts'
import { formatDezimal, parseEingabeDe } from '../../lib/format.ts'
import { PREISARTEN, baueStufenwert, cmText, parseStufe } from '../../lib/preisAchsen.ts'
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
 *   Klassifikation & Status Teileart, Dropdown, Modus, Status, Sortierung
 *   Preise & Achsen         Achsen A1–A5 des Artikels und alle seine Preiszellen
 *
 * Alle 22 Felder des Blattes „10 Artikel" sind vertreten — die Artikelnummer als
 * einziges nur beim Anlegen beschreibbar: sie ist Identität und wird laut
 * ARTIKELNUMMER-LOGIK.md nie geändert.
 */

const STATUS_WERTE = ['aktiv', 'gesperrt', 'entwurf'] as const
const PREIS_STATUS_WERTE = ['fixed', 'on-request', 'note'] as const

/**
 * Vorschläge für die rechte Hälfte der geteilten Zelle.
 *
 * Sie sind ausdrücklich nur Vorschläge: Die Liste wird um die Etiketten ergänzt, die der
 * Artikel schon benutzt, und bleibt frei beschreibbar. Ein fest verdrahteter Wertevorrat
 * würde genau das wiederholen, was die Reform beseitigt hat — Wissen im Code statt in
 * den Stammdaten.
 */
const BREITEN_ETIKETTEN = ['40er', '50er', '50/60er', '60er', '80er', '100er', '120er', '150er', 'Seite']
const RASTER_ETIKETTEN = ['1R', '1,5R', '2R', '3R', '4R', '4,5R', '6R', '8R', '9R', '12R', '14R', '15R', '18R', '21R']
const PREISART_WERTE = [PREISARTEN.FIX, PREISARTEN.CM, PREISARTEN.M, PREISARTEN.QM]

/**
 * Der Name einer Achse ohne ihre Erläuterung.
 *
 * Die Bedeutung aus Blatt „35 Achsen" führt beides in einem Satz: „HÖHE (cm + Raster) —
 * Höhenstufe, wird aufgerundet". Ins Auswahlfeld passt nur der Name; die volle Bedeutung
 * steht im Spaltenkopf der Preistabelle und als Tooltip.
 */
function achsenKurzname(bedeutung: string): string {
  return bedeutung.split('—')[0].trim()
}

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
    dropdown: dropdowns[0].code,
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

  /**
   * Etiketten, die dieser Artikel in der Spalte schon führt — sie stehen im Dropdown
   * ganz oben. So schreibt niemand versehentlich „60ER" neben „60er" und erzeugt damit
   * eine zweite, nie getroffene Preisstufe.
   */
  const etikettVorschlaege = (spalte: number): string[] => {
    const code = form.achsen[spalte]
    const ausDaten = zeilen
      .map((z) => parseStufe(z.a[spalte]).etikett)
      .filter(Boolean)
    const standard = code === 'HOEHE' ? RASTER_ETIKETTEN : code === 'BREITE' ? BREITEN_ETIKETTEN : []
    return [...new Set([...ausDaten, ...standard])]
  }

  /** Freie Textwerte, die dieser Artikel in der Spalte schon führt (PG, LINIE+PG, AUSFÜHRUNG). */
  const textVorschlaege = (spalte: number): string[] =>
    [...new Set(zeilen.map((z) => (z.a[spalte] ?? '').trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'de'),
    )

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Artikel bearbeiten">
      <div className={styles.dialog}>
        <header className={styles.kopf}>
          <div>
            <h2 className={styles.titel}>{anlegen ? 'Neuer Artikel' : form.bezeichnung || 'Artikel'}</h2>
            <p className={styles.untertitel}>
              {anlegen ? (
                'Artikelnummer nach dem Muster TT-DDD-NNNN vergeben'
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
              <Feld label="Artikelnummer" hinweis={anlegen ? 'Muster TT-DDD-NNNN' : 'Identität — nicht änderbar'}>
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
              <Feld label="Teileart" hinweis="Block 1 · Hauptschritt im Konfigurator">
                <select
                  className={styles.input}
                  value={form.teileart}
                  onChange={(e) => setFeld('teileart', e.target.value as Artikel['teileart'])}
                >
                  {teilearten.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.nr} · {t.code} — {t.schritt}
                    </option>
                  ))}
                </select>
              </Feld>
              <Feld label="Dropdown" hinweis="Block 2 · Auswahlfeld, in dem der Artikel erscheint">
                <select
                  className={styles.input}
                  value={form.dropdown}
                  onChange={(e) => setFeld('dropdown', e.target.value as Artikel['dropdown'])}
                >
                  {dropdowns.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.nr} · {d.code} — {d.bezeichnung}
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
                        {achsenKatalog.map((a) => (
                          <option key={a.code} value={a.code} title={a.bedeutung}>
                            {achsenKurzname(a.bedeutung)}
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
                          <Achsenzelle
                            code={form.achsen[i]}
                            wert={zeile.a[i] ?? ''}
                            etikettVorschlaege={etikettVorschlaege(i)}
                            textVorschlaege={textVorschlaege(i)}
                            onChange={(neu) => {
                              const neuA = [...zeile.a] as Achsenwerte
                              neuA[i] = neu
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

/**
 * EINE ACHSENZELLE — die Eingabe richtet sich nach der Art der Achse.
 *
 * Stammdatenverwaltung Reform, 17.09.2026:
 *
 *   „Wenn BREITE (cm+__er) oder HÖHE (cm+Raster) gewählt sind, dann muss die Zelle
 *    geteilt sein, links gibt man den Zentimeter-Schwellenwert an (ist ja matrix_auf)
 *    und rechts Dropdown, wo man dann die Raster / __er wählen kann. Links vorformatiert
 *    mit cm im Feld und rechts Raster / er, dass man klar erkennt, wo was rein soll."
 *
 * Vier Fälle:
 *
 *   stufe     geteilt: Zentimeter | gedruckte Bezeichnung (Dropdown mit Freitext)
 *   mass      nur Zentimeter; leer = die Achse benennt bloß das Maß für die Menge
 *   preisart  geschlossene Auswahl: Fixpreis · €/cm · €/m · €/m²
 *   text/liste  Freitext mit Vorschlägen aus den übrigen Zeilen desselben Artikels
 *
 * Gespeichert wird immer EIN String in der Zelle („60 cm | 60er"). Die Teilung ist eine
 * Eingabehilfe, kein zweites Datenfeld — die Mappe behält ihre fünf Achsenspalten.
 */
function Achsenzelle({
  code,
  wert,
  etikettVorschlaege,
  textVorschlaege,
  onChange,
}: {
  code: AchseCode | undefined
  wert: string
  etikettVorschlaege: string[]
  textVorschlaege: string[]
  onChange: (wert: string) => void
}) {
  const art = code ? achsenKatalog.find((a) => a.code === code)?.art : undefined
  const listenId = `achsenwerte-${code ?? 'leer'}`

  if (!code) {
    return <input className={styles.zellInput} value={wert} disabled readOnly />
  }

  if (art === 'preisart') {
    return (
      <select className={styles.zellInput} value={wert} onChange={(e) => onChange(e.target.value)}>
        <option value="">{PREISARTEN.FIX} (Vorgabe)</option>
        {PREISART_WERTE.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    )
  }

  if (art === 'stufe' || art === 'mass') {
    const { cm, etikett } = parseStufe(wert)
    const setze = (neuCm: number | null, neuEtikett: string) =>
      onChange(neuCm == null && !neuEtikett ? '' : baueStufenwert(neuCm, neuEtikett))

    const cmFeld = (
      <span className={styles.masseingabe}>
        <input
          className={styles.zellInput}
          inputMode="decimal"
          value={cm == null ? '' : cmText(cm)}
          aria-label="Zentimeter-Schwellenwert"
          onChange={(e) => {
            const roh = e.target.value.trim().replace(',', '.')
            const zahl = roh === '' ? null : Number(roh)
            setze(zahl != null && Number.isFinite(zahl) ? zahl : null, etikett)
          }}
        />
        <span className={styles.masseinheit}>cm</span>
      </span>
    )

    // Maßachsen tragen kein Etikett — sie benennen nur, welches Maß die Menge liefert.
    if (art === 'mass') return cmFeld

    return (
      <span className={styles.geteilteZelle}>
        {cmFeld}
        <input
          className={[styles.zellInput, styles.etikettFeld].join(' ')}
          list={listenId}
          value={etikett}
          placeholder={code === 'HOEHE' ? 'Raster' : 'er'}
          aria-label={code === 'HOEHE' ? 'Rasterbezeichnung' : 'Breitenbezeichnung'}
          onChange={(e) => setze(cm, e.target.value)}
        />
        <datalist id={listenId}>
          {etikettVorschlaege.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </span>
    )
  }

  return (
    <>
      <input
        className={styles.zellInput}
        list={listenId}
        value={wert}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listenId}>
        {textVorschlaege.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </>
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
