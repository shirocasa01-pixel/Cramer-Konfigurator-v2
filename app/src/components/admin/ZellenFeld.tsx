import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './ZellenFeld.module.css'

/**
 * EIN EINGABEFELD IN EINER DATENTABELLE — entkoppelt vom Formular darüber.
 *
 * Zwei Probleme der Artikelverwaltung lösen sich an derselben Stelle:
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. TIPP-VERZÖGERUNG
 *
 * Die Preistabelle eines Artikels hat bis zu 311 Zeilen mit je fünf Achsenzellen.
 * Ging jeder Tastendruck sofort in den Formular-State, rechnete React bei JEDEM
 * Buchstaben die ganze Tabelle neu durch — spürbar als Verzögerung beim Schreiben und
 * beim Löschen.
 *
 * Deshalb tippt man hier in einen LOKALEN Entwurf. Nach oben gemeldet wird erst beim
 * Verlassen des Feldes oder mit Enter (`onCommit`). Bis dahin rührt kein Tastendruck
 * den Formular-State an; die Zeile rendert allein. Escape verwirft den Entwurf.
 *
 * Das ist zugleich das fachlich richtige Verhalten: Ein halb getippter Achsenwert
 * („15" auf dem Weg zu „150") ist keine Änderung, die irgendwo ankommen müsste.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. DAS SCHWARZE BROWSER-MENÜ
 *
 * Vorher hingen die Vorschläge an einem nativen `<datalist>`. Das rendert der Browser
 * selbst: eigenes Farbschema, eigene Position, und vermischt mit der Formular-Historie
 * des Browsers — alte Tippfehler standen zwischen den echten Vorschlägen.
 *
 * Diese Liste ist deshalb eine eigene, im Design der Anwendung. Sie sitzt exakt unter
 * dem Feld (`position: fixed` über ein Portal, damit der waagerechte Bildlauf der
 * Tabelle sie nicht abschneidet) und enthält ausschließlich Werte, die der Artikel
 * selbst führt. Das native Autofill ist auf allen Feldern abgeschaltet.
 */

/** Schaltet Browser-Autofill, -Korrektur und Rechtschreibprüfung ab. */
export const OHNE_AUTOFILL = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
} as const

/** Höchstens so viele Vorschläge — eine längere Liste liest ohnehin niemand. */
const MAX_VORSCHLAEGE = 8

export interface ZellenFeldProps {
  /** Der gespeicherte Wert. Während des Tippens zeigt das Feld seinen Entwurf. */
  wert: string
  /** Wird bei Enter, beim Verlassen des Feldes und bei Auswahl eines Vorschlags gerufen. */
  onCommit: (wert: string) => void
  /** Vorschläge für die eigene Auswahlliste; leer ⇒ reines Textfeld. */
  vorschlaege?: readonly string[]
  platzhalter?: string
  ariaLabel?: string
  className?: string
  inputMode?: 'text' | 'decimal' | 'numeric'
  disabled?: boolean
}

export function ZellenFeld({
  wert,
  onCommit,
  vorschlaege,
  platzhalter,
  ariaLabel,
  className,
  inputMode,
  disabled,
}: ZellenFeldProps) {
  /** `null` = nicht in Bearbeitung, es gilt `wert`. */
  const [entwurf, setEntwurf] = useState<string | null>(null)
  const [offen, setOffen] = useState(false)
  const [markiert, setMarkiert] = useState(-1)
  const feldRef = useRef<HTMLInputElement>(null)
  const listenId = useId()

  const angezeigt = entwurf ?? wert

  const gefiltert = (() => {
    if (!vorschlaege?.length) return []
    const suche = (entwurf ?? '').trim().toLowerCase()
    // Ohne Entwurf die volle Liste: Wer das Feld anklickt, will sehen, was es gibt.
    const treffer = suche
      ? vorschlaege.filter((v) => v.toLowerCase().includes(suche))
      : [...vorschlaege]
    return treffer.slice(0, MAX_VORSCHLAEGE)
  })()

  const schliessen = useCallback(() => {
    setOffen(false)
    setMarkiert(-1)
  }, [])

  /** Entwurf nach oben melden — aber nur, wenn er sich vom gespeicherten Wert unterscheidet. */
  const uebernehmen = useCallback(
    (roh?: string) => {
      const neu = roh ?? entwurf
      setEntwurf(null)
      schliessen()
      if (neu != null && neu !== wert) onCommit(neu)
    },
    [entwurf, onCommit, schliessen, wert],
  )

  function beiTaste(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && gefiltert.length > 0) {
      e.preventDefault()
      setOffen(true)
      setMarkiert((m) => (m + 1) % gefiltert.length)
      return
    }
    if (e.key === 'ArrowUp' && gefiltert.length > 0) {
      e.preventDefault()
      setOffen(true)
      setMarkiert((m) => (m <= 0 ? gefiltert.length - 1 : m - 1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      uebernehmen(offen && markiert >= 0 ? gefiltert[markiert] : undefined)
      return
    }
    if (e.key === 'Escape') {
      // Gibt es einen Entwurf oder eine offene Liste, verwirft Escape nur diese und das
      // Modal bleibt stehen. Ist beides leer, gehört die Taste dem Modal — sonst ließe
      // sich das Fenster aus einem Eingabefeld heraus nie mit Escape schließen.
      if (entwurf == null && !offen) return
      e.stopPropagation()
      setEntwurf(null)
      schliessen()
    }
  }

  return (
    <span className={styles.huelle}>
      <input
        ref={feldRef}
        className={className}
        value={angezeigt}
        placeholder={platzhalter}
        aria-label={ariaLabel}
        inputMode={inputMode}
        disabled={disabled}
        role={vorschlaege?.length ? 'combobox' : undefined}
        aria-expanded={vorschlaege?.length ? offen : undefined}
        aria-controls={vorschlaege?.length ? listenId : undefined}
        aria-autocomplete={vorschlaege?.length ? 'list' : undefined}
        {...OHNE_AUTOFILL}
        onChange={(e) => {
          setEntwurf(e.target.value)
          setMarkiert(-1)
          if (vorschlaege?.length) setOffen(true)
        }}
        onFocus={() => {
          if (vorschlaege?.length) setOffen(true)
        }}
        onKeyDown={beiTaste}
        onBlur={() => uebernehmen()}
      />
      {offen && gefiltert.length > 0 ? (
        <VorschlagsListe
          id={listenId}
          anker={feldRef}
          eintraege={gefiltert}
          markiert={markiert}
          aktuell={wert}
          // `onMouseDown` statt `onClick`: Der Klick darf nicht erst das Feld verlassen
          // (blur ⇒ übernehmen ⇒ Liste weg), bevor die Auswahl ankommt.
          onWaehlen={(v) => {
            feldRef.current?.focus()
            uebernehmen(v)
          }}
        />
      ) : null}
    </span>
  )
}

/**
 * Die Auswahlliste selbst — als Portal an `document.body`.
 *
 * Die Preistabelle scrollt waagerecht (`overflow-x`), und ein absolut positioniertes
 * Kind wäre an deren Rand abgeschnitten. Deshalb hängt die Liste im Body und wird über
 * die Bildschirmkoordinaten des Feldes ausgerichtet — sie bleibt beim Scrollen daran
 * kleben, weil die Position bei jedem Bildlauf neu berechnet wird.
 */
function VorschlagsListe({
  id,
  anker,
  eintraege,
  markiert,
  aktuell,
  onWaehlen,
}: {
  id: string
  anker: React.RefObject<HTMLInputElement>
  eintraege: readonly string[]
  markiert: number
  aktuell: string
  onWaehlen: (wert: string) => void
}) {
  const [rahmen, setRahmen] = useState<{ links: number; oben: number; breite: number } | null>(null)

  useLayoutEffect(() => {
    function messen() {
      const feld = anker.current
      if (!feld) return
      const r = feld.getBoundingClientRect()
      const neu = { links: r.left, oben: r.bottom + 4, breite: Math.max(r.width, 140) }
      // Nur bei echter Verschiebung neu rendern — der Lauscher feuert bei jedem
      // Bildlauf-Schritt, und ein neues Objekt allein ist noch keine neue Position.
      setRahmen((alt) =>
        alt && alt.links === neu.links && alt.oben === neu.oben && alt.breite === neu.breite
          ? alt
          : neu,
      )
    }
    messen()
    // `capture`, damit auch der Bildlauf INNERHALB der Tabelle mitgenommen wird.
    window.addEventListener('scroll', messen, true)
    window.addEventListener('resize', messen)
    return () => {
      window.removeEventListener('scroll', messen, true)
      window.removeEventListener('resize', messen)
    }
  }, [anker])

  if (!rahmen) return null

  return createPortal(
    <ul
      id={id}
      role="listbox"
      className={styles.liste}
      style={{ left: rahmen.links, top: rahmen.oben, minWidth: rahmen.breite }}
    >
      {eintraege.map((v, i) => (
        <li key={v}>
          <button
            type="button"
            role="option"
            aria-selected={v === aktuell}
            className={[styles.eintrag, i === markiert ? styles.eintragMarkiert : '']
              .filter(Boolean)
              .join(' ')}
            onMouseDown={(e) => {
              e.preventDefault()
              onWaehlen(v)
            }}
          >
            {v}
          </button>
        </li>
      ))}
    </ul>,
    document.body,
  )
}
