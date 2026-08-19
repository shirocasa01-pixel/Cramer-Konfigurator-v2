import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import styles from './DataGrid.module.css'

/**
 * DATA GRID — Tabellen-Umgebung nach Excel-Vorbild.
 *
 * Kann, was man von einer Tabelle erwartet: Zeilennummern, Zellauswahl über Blöcke,
 * Kopieren nach Excel, Spaltenbreiten ziehen und Spalten aus-/einblenden. Bewusst ohne
 * Tabellen-Bibliothek — das sind ~250 Zeilen gegen eine Abhängigkeit mit eigener API,
 * eigenem Update-Zyklus und 40 KB Bundle.
 *
 * Die SPALTENREIHENFOLGE ist fest und ergibt sich allein aus der Reihenfolge der
 * `SpaltenDef`-Einträge. Sie ist bewusst nicht verschiebbar: die Spalten-IDs tragen die
 * Zuordnung zu den Excel-Feldern, und eine je Benutzer abweichende Anordnung hätte beim
 * Kopieren nach Excel und beim Export stillschweigend andere Spalten geliefert.
 *
 * Die Tabelle ist eine ANZEIGE. Verändert wird ausschließlich im Detail-Fenster; ein
 * Klick in eine Zelle markiert, er bearbeitet nicht. In 1509 Zeilen wäre ein
 * versehentlicher Tastendruck sonst eine stille Datenänderung.
 */

export interface SpaltenDef<T> {
  /** Stabile ID — Schlüssel für Breite, Reihenfolge und Sichtbarkeit. */
  id: string
  titel: string
  /** Startbreite in Pixeln. */
  breite: number
  /** Monospace — für Nummern mit fester Stellenzahl. */
  mono?: boolean
  /** Rechtsbündig mit Tabellenziffern. */
  numerisch?: boolean
  /** false ⇒ standardmäßig ausgeblendet (bleibt über das Spaltenmenü erreichbar). */
  standard?: boolean
  /** Zellinhalt als Text — auch die Grundlage fürs Kopieren. */
  wert: (zeile: T) => string
  /** Optionale eigene Darstellung. */
  render?: (zeile: T) => ReactNode
}

/**
 * Kleinste ziehbare Spaltenbreite. Bewusst schmal: der Kunde soll Spalten wie in Excel
 * beliebig eng ziehen können, unabhängig davon, wie viel Text in der Zelle steht. 24 px
 * ist die Untergrenze, bei der die 9 px breite Greiffläche des Schiebers noch bedienbar
 * bleibt — darunter ließe sich die Spalte nicht wieder aufziehen.
 */
const MIN_BREITE = 24

interface SpaltenLayout {
  breiten: Record<string, number>
  versteckt: string[]
}

/**
 * Spaltenbreiten und -sichtbarkeit, im Browser gemerkt. Wer sich sein Raster einmal
 * eingerichtet hat, findet es beim nächsten Öffnen wieder vor.
 *
 * Die Reihenfolge gehört ausdrücklich NICHT dazu — sie steht in der Spaltendefinition.
 * Ältere gespeicherte Layouts enthalten noch ein `reihenfolge`-Feld; es wird beim Lesen
 * einfach ignoriert und beim nächsten Schreiben entfernt.
 */
export function useSpaltenLayout<T>(spalten: SpaltenDef<T>[], speicherSchluessel: string) {
  const standard = useCallback(
    (): SpaltenLayout => ({
      breiten: Object.fromEntries(spalten.map((s) => [s.id, s.breite])),
      versteckt: spalten.filter((s) => s.standard === false).map((s) => s.id),
    }),
    [spalten],
  )

  const [layout, setLayout] = useState<SpaltenLayout>(() => {
    const basis = standard()
    try {
      const roh = localStorage.getItem(speicherSchluessel)
      if (!roh) return basis
      const gespeichert = JSON.parse(roh) as Partial<SpaltenLayout>
      return {
        breiten: { ...basis.breiten, ...(gespeichert.breiten ?? {}) },
        versteckt: gespeichert.versteckt ?? basis.versteckt,
      }
    } catch {
      return basis
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(speicherSchluessel, JSON.stringify(layout))
    } catch {
      /* best-effort */
    }
  }, [layout, speicherSchluessel])

  const setBreite = useCallback((id: string, breite: number) => {
    setLayout((l) => ({ ...l, breiten: { ...l.breiten, [id]: Math.max(MIN_BREITE, Math.round(breite)) } }))
  }, [])

  const toggleSpalte = useCallback((id: string) => {
    setLayout((l) => ({
      ...l,
      versteckt: l.versteckt.includes(id) ? l.versteckt.filter((x) => x !== id) : [...l.versteckt, id],
    }))
  }, [])

  const versteckeSpalte = useCallback((id: string) => {
    setLayout((l) => (l.versteckt.includes(id) ? l : { ...l, versteckt: [...l.versteckt, id] }))
  }, [])

  const alleZeigen = useCallback(() => setLayout((l) => ({ ...l, versteckt: [] })), [])
  const zuruecksetzen = useCallback(() => setLayout(standard()), [standard])

  /** Sichtbare Spalten — in der festen Reihenfolge der Spaltendefinition. */
  const sichtbar = useMemo(
    () => spalten.filter((s) => !layout.versteckt.includes(s.id)),
    [spalten, layout.versteckt],
  )

  return {
    layout,
    sichtbar,
    /** Alle Spalten — für das Spaltenmenü. */
    alle: spalten,
    setBreite,
    toggleSpalte,
    versteckeSpalte,
    alleZeigen,
    zuruecksetzen,
  }
}

// ---------------------------------------------------------------------------
// Spaltenmenü
// ---------------------------------------------------------------------------

export function SpaltenMenue<T>({
  spalten,
  versteckt,
  onToggle,
  onAlleZeigen,
  onZuruecksetzen,
}: {
  spalten: SpaltenDef<T>[]
  versteckt: string[]
  onToggle: (id: string) => void
  onAlleZeigen: () => void
  onZuruecksetzen: () => void
}) {
  const [offen, setOffen] = useState(false)
  const wurzel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!offen) return
    const beiKlick = (e: MouseEvent) => {
      if (wurzel.current && !wurzel.current.contains(e.target as Node)) setOffen(false)
    }
    const beiEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOffen(false)
      }
    }
    document.addEventListener('mousedown', beiKlick)
    document.addEventListener('keydown', beiEsc, true)
    return () => {
      document.removeEventListener('mousedown', beiKlick)
      document.removeEventListener('keydown', beiEsc, true)
    }
  }, [offen])

  return (
    <div className={styles.menueWurzel} ref={wurzel}>
      <button
        type="button"
        className={styles.menueTrigger}
        aria-expanded={offen}
        aria-haspopup="true"
        onClick={() => setOffen((v) => !v)}
      >
        Spalten anpassen
        <span className={styles.menueZaehler}>
          {spalten.length - versteckt.length}/{spalten.length}
        </span>
      </button>

      {offen ? (
        <div className={styles.menuePanel} role="menu">
          <div className={styles.menueKopf}>
            <span>Angezeigte Spalten</span>
            <div className={styles.menueKopfAktionen}>
              <button type="button" className={styles.linkButton} onClick={onAlleZeigen}>
                alle
              </button>
              <button type="button" className={styles.linkButton} onClick={onZuruecksetzen}>
                zurücksetzen
              </button>
            </div>
          </div>
          <div className={styles.menueListe}>
            {spalten.map((s) => (
              <label key={s.id} className={styles.menueEintrag}>
                <input type="checkbox" checked={!versteckt.includes(s.id)} onChange={() => onToggle(s.id)} />
                <span>{s.titel}</span>
              </label>
            ))}
          </div>
          <p className={styles.menueFuss}>
            Breite im Spaltenkopf ziehen · Doppelklick auf die Trennlinie setzt sie zurück ·
            Rechtsklick blendet eine Spalte aus.
          </p>
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Zellauswahl
// ---------------------------------------------------------------------------

interface Auswahl {
  vonZeile: number
  bisZeile: number
  vonSpalte: number
  bisSpalte: number
}

const normalisiere = (a: Auswahl) => ({
  z1: Math.min(a.vonZeile, a.bisZeile),
  z2: Math.max(a.vonZeile, a.bisZeile),
  s1: Math.min(a.vonSpalte, a.bisSpalte),
  s2: Math.max(a.vonSpalte, a.bisSpalte),
})

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

export interface ZeilenAktion<T> {
  id: string
  titel: string
  symbol: string
  /** true ⇒ rot eingefärbt (löschende Aktion). */
  gefahr?: boolean
  ausfuehren: (zeile: T) => void
}

export interface DataGridProps<T> {
  spalten: SpaltenDef<T>[]
  breiten: Record<string, number>
  onBreite: (id: string, breite: number) => void
  onVersteckeSpalte?: (id: string) => void
  zeilen: T[]
  zeilenId: (zeile: T) => string
  /** Doppelklick auf die Zeile. */
  onOeffnen?: (zeile: T) => void
  aktionen?: ZeilenAktion<T>[]
  zeilenKlasse?: (zeile: T) => string | undefined
  gruppenKopf?: (zeile: T, vorherige: T | undefined) => ReactNode
  leerText?: string
  maxZeilen?: number
}

export function DataGrid<T>({
  spalten,
  breiten,
  onBreite,
  onVersteckeSpalte,
  zeilen,
  zeilenId,
  onOeffnen,
  aktionen = [],
  zeilenKlasse,
  gruppenKopf,
  leerText = 'Keine Daten.',
  maxZeilen = 300,
}: DataGridProps<T>) {
  const sichtbare = zeilen.slice(0, maxZeilen)
  const ziehtRef = useRef<{ id: string; startX: number; startBreite: number } | null>(null)
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null)
  /**
   * Ref statt State: beim Ziehen kommen die `pointerover`-Ereignisse schneller, als React
   * neu rendert. Als State gelesen sähen die Handler noch den alten Wert `false` und
   * würden die ersten Zellen der Bewegung verschlucken.
   */
  const waehltRef = useRef(false)
  const [kopiert, setKopiert] = useState(false)
  const wurzelRef = useRef<HTMLDivElement>(null)

  // --- Breite ziehen ---------------------------------------------------------------
  const beiPointerDown = (e: React.PointerEvent, id: string, standardBreite: number) => {
    e.preventDefault()
    e.stopPropagation()
    // Fallback ist die Startbreite der Spalte, nicht MIN_BREITE — sonst spränge eine noch
    // nie gezogene Spalte beim Anfassen auf die Mindestbreite zusammen.
    ziehtRef.current = { id, startX: e.clientX, startBreite: breiten[id] ?? standardBreite }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const beiPointerMove = (e: React.PointerEvent) => {
    const z = ziehtRef.current
    if (z) onBreite(z.id, z.startBreite + (e.clientX - z.startX))
  }
  const beiPointerUp = (e: React.PointerEvent) => {
    if (!ziehtRef.current) return
    ziehtRef.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  // --- Auswahl ---------------------------------------------------------------------
  const starteAuswahl = (z: number, s: number, erweitern: boolean) => {
    setAuswahl((alt) =>
      erweitern && alt
        ? { ...alt, bisZeile: z, bisSpalte: s }
        : { vonZeile: z, bisZeile: z, vonSpalte: s, bisSpalte: s },
    )
    waehltRef.current = true
  }

  const erweitereAuswahl = (z: number, s: number) => {
    if (!waehltRef.current) return
    setAuswahl((alt) => (alt ? { ...alt, bisZeile: z, bisSpalte: s } : alt))
  }

  const waehleZeile = (z: number) =>
    setAuswahl({ vonZeile: z, bisZeile: z, vonSpalte: 0, bisSpalte: spalten.length - 1 })

  const waehleSpalte = (s: number) =>
    setAuswahl({ vonZeile: 0, bisZeile: sichtbare.length - 1, vonSpalte: s, bisSpalte: s })

  useEffect(() => {
    const beiUp = () => { waehltRef.current = false }
    document.addEventListener('pointerup', beiUp)
    return () => document.removeEventListener('pointerup', beiUp)
  }, [])

  /** Der markierte Block als Tabulator-getrennter Text — genau das, was Excel erwartet. */
  const auswahlAlsText = useCallback((): string => {
    if (!auswahl) return ''
    const { z1, z2, s1, s2 } = normalisiere(auswahl)
    const zeilenText: string[] = []
    for (let z = z1; z <= z2 && z < sichtbare.length; z++) {
      const felder: string[] = []
      for (let s = s1; s <= s2 && s < spalten.length; s++) {
        felder.push(spalten[s].wert(sichtbare[z]).replace(/\t/g, ' ').replace(/\r?\n/g, ' '))
      }
      zeilenText.push(felder.join('\t'))
    }
    return zeilenText.join('\n')
  }, [auswahl, sichtbare, spalten])

  // Kopieren mit Strg/Cmd+C, solange die Auswahl im Grid liegt.
  useEffect(() => {
    if (!auswahl) return
    const beiCopy = (e: ClipboardEvent) => {
      const wurzel = wurzelRef.current
      if (!wurzel) return
      // Nicht eingreifen, wenn der Fokus in einem Eingabefeld außerhalb liegt.
      const aktiv = document.activeElement
      if (aktiv && aktiv !== document.body && !wurzel.contains(aktiv)) return
      const text = auswahlAlsText()
      if (!text) return
      e.clipboardData?.setData('text/plain', text)
      e.preventDefault()
      setKopiert(true)
      window.setTimeout(() => setKopiert(false), 1600)
    }
    document.addEventListener('copy', beiCopy)
    return () => document.removeEventListener('copy', beiCopy)
  }, [auswahl, auswahlAlsText])

  const istMarkiert = (z: number, s: number) => {
    if (!auswahl) return false
    const { z1, z2, s1, s2 } = normalisiere(auswahl)
    return z >= z1 && z <= z2 && s >= s1 && s <= s2
  }

  const anzahlMarkiert = auswahl
    ? (() => {
        const { z1, z2, s1, s2 } = normalisiere(auswahl)
        return (Math.min(z2, sichtbare.length - 1) - z1 + 1) * (s2 - s1 + 1)
      })()
    : 0

  // Zeilennummer + Datenspalten + Füllspalte (+ Aktionsspalte).
  const spaltenGesamt = spalten.length + 2 + (aktionen.length ? 1 : 0)

  const nrBreite = 52
  const aktionsBreite = aktionen.length ? 28 + aktionen.length * 26 : 0
  /**
   * Ausdrückliche Pixelbreite der Tabelle. Ohne sie (also bei `width: max-content`) fällt
   * der Browser auf die automatische Spaltenverteilung zurück und gibt jeder Spalte
   * mindestens die Breite ihres Inhalts — dann ließe sich keine Spalte enger als ihr Text
   * ziehen. Genau das war der gemeldete Fehler.
   */
  const tabellenBreite =
    nrBreite + aktionsBreite + spalten.reduce((summe, s) => summe + (breiten[s.id] ?? s.breite), 0)

  return (
    <div className={styles.wurzel} ref={wurzelRef} tabIndex={-1}>
      {anzahlMarkiert > 1 || kopiert ? (
        <div className={styles.auswahlHinweis} role="status">
          {kopiert ? '✓ in die Zwischenablage kopiert' : `${anzahlMarkiert} Zellen markiert · Strg+C kopiert`}
        </div>
      ) : null}

      <div className={styles.scrollFlaeche}>
        <table className={styles.grid} style={{ width: `${tabellenBreite}px` }}>
          <colgroup>
            <col style={{ width: `${nrBreite}px` }} />
            {spalten.map((s) => (
              <col key={s.id} style={{ width: `${breiten[s.id] ?? s.breite}px` }} />
            ))}
            {/*
              Füllspalte OHNE Breitenangabe. `.grid` ist mindestens so breit wie die
              Fläche; ohne sie verteilte der Browser den Überschuss auf alle Spalten und
              eine eng gezogene Spalte wäre wieder breiter — genau das soll nicht passieren.
              Diese eine Spalte schluckt den Rest, alle anderen behalten ihre Pixelbreite.
            */}
            <col />
            {aktionen.length ? <col style={{ width: `${aktionsBreite}px` }} /> : null}
          </colgroup>

          <thead>
            <tr>
              <th className={styles.nrKopf} title="Zeilennummer">
                #
              </th>
              {spalten.map((s, si) => (
                <th
                  key={s.id}
                  className={s.numerisch ? styles.thNum : undefined}
                  title={`${s.titel} — klicken markiert die Spalte, Trennlinie ziehen ändert die Breite`}
                  onClick={() => waehleSpalte(si)}
                  onContextMenu={(e) => {
                    if (!onVersteckeSpalte) return
                    e.preventDefault()
                    onVersteckeSpalte(s.id)
                  }}
                >
                  <span className={styles.thTitel}>{s.titel}</span>
                  <span
                    className={styles.resizer}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Breite von ${s.titel} ändern`}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => beiPointerDown(e, s.id, s.breite)}
                    onPointerMove={beiPointerMove}
                    onPointerUp={beiPointerUp}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      onBreite(s.id, s.breite)
                    }}
                  />
                </th>
              ))}
              <th className={styles.fuellKopf} aria-hidden="true" />
              {aktionen.length ? <th className={styles.fuellKopf} aria-label="Aktionen" /> : null}
            </tr>
          </thead>

          <tbody>
            {sichtbare.length === 0 ? (
              <tr>
                <td colSpan={spaltenGesamt} className={styles.leer}>
                  {leerText}
                </td>
              </tr>
            ) : null}

            {sichtbare.map((zeile, zi) => {
              const kopf = gruppenKopf?.(zeile, zi > 0 ? sichtbare[zi - 1] : undefined)
              return (
                // Die Gruppenüberschrift ist eine EIGENE Zeile über der Datenzeile – sonst
                // verschwindet die erste Zeile jeder Gruppe hinter ihrer eigenen Überschrift.
                <Fragment key={zeilenId(zeile)}>
                  {kopf ? (
                    <tr>
                      <td colSpan={spaltenGesamt} className={styles.gruppenZelle}>
                        {kopf}
                      </td>
                    </tr>
                  ) : null}
                  <tr className={zeilenKlasse?.(zeile)}>
                    <th
                      className={styles.nrZelle}
                      scope="row"
                      onClick={() => waehleZeile(zi)}
                      title="Zeile markieren"
                    >
                      {zi + 1}
                    </th>

                    {spalten.map((s, si) => (
                      <td
                        key={s.id}
                        className={[
                          s.mono ? styles.mono : '',
                          s.numerisch ? styles.num : '',
                          istMarkiert(zi, si) ? styles.markiert : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onPointerDown={(e) => starteAuswahl(zi, si, e.shiftKey)}
                        onPointerEnter={() => erweitereAuswahl(zi, si)}
                        onDoubleClick={onOeffnen ? () => onOeffnen(zeile) : undefined}
                        title={s.wert(zeile)}
                      >
                        {s.render ? s.render(zeile) : s.wert(zeile)}
                      </td>
                    ))}

                    <td className={styles.fuellZelle} />

                    {aktionen.length ? (
                      <td className={styles.aktionZelle}>
                        {aktionen.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            className={[styles.aktion, a.gefahr ? styles.aktionGefahr : ''].filter(Boolean).join(' ')}
                            title={a.titel}
                            aria-label={a.titel}
                            onClick={() => a.ausfuehren(zeile)}
                          >
                            {a.symbol}
                          </button>
                        ))}
                      </td>
                    ) : null}
                  </tr>
                </Fragment>
              )
            })}

            {zeilen.length > maxZeilen ? (
              <tr>
                <td colSpan={spaltenGesamt} className={styles.leer}>
                  {zeilen.length - maxZeilen} weitere Zeilen ausgeblendet — Suche oder Filter eingrenzen.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
