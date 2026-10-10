import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { Draft } from '../../types'
import { Konstruktion2D } from './Konstruktion2D'
import styles from './KonstruktionsLayout.module.css'

/**
 * SPLIT-LAYOUT der Schritte „Maße", „Material", „Ausstattung" und „Fronten":
 * links die mitlaufende 2D-Skizze, rechts das Formular.
 *
 * Das Formular liegt bewusst RECHTS — kürzere Wege für Rechtshänder mit Maus oder Touchpad.
 * Die Trennlinie lässt sich ziehen (Maus, Finger, Pfeiltasten), damit der Berater die
 * Zeichnung im Kundengespräch groß machen kann; Doppelklick setzt sie zurück. Die Breite
 * merkt sich das Gerät (reine Bedienvorliebe, kein Entwurfsinhalt).
 *
 * Ohne strukturierte Korpus-Grunddaten (freie Maßeingabe) gibt es nichts zu zeichnen; dann
 * bleibt die Seite einspaltig. Auf schmalen Bildschirmen steht die Skizze über dem Formular.
 */

const SPEICHER = 'cramer-planer.skizze.breite.v1'
const MIN_SKIZZE = 280
const MIN_FORMULAR = 420
const SCHRITT = 40
/** Breite der Trennlinie — muss zur Spalte in `KonstruktionsLayout.module.css` passen. */
const TRENNER = 14

function gemerkteBreite(): number | null {
  try {
    const n = Number(localStorage.getItem(SPEICHER))
    return Number.isFinite(n) && n >= MIN_SKIZZE ? n : null
  } catch {
    return null
  }
}

function merke(breite: number | null) {
  try {
    if (breite == null) localStorage.removeItem(SPEICHER)
    else localStorage.setItem(SPEICHER, String(Math.round(breite)))
  } catch {
    // Privater Modus o. Ä.: dann eben ohne Gedächtnis.
  }
}

export function KonstruktionsLayout({ draft, children }: { draft: Draft; children: ReactNode }) {
  const [breite, setBreite] = useState<number | null>(gemerkteBreite)
  const split = useRef<HTMLDivElement>(null)
  const zug = useRef<{ start: number; breite: number; letzte: number } | null>(null)

  const begrenze = useCallback((wunsch: number) => {
    const el = split.current
    const rand = el ? parseFloat(getComputedStyle(el).paddingLeft) || 0 : 0
    const gesamt = (el?.clientWidth ?? window.innerWidth) - rand - TRENNER
    return Math.max(MIN_SKIZZE, Math.min(wunsch, gesamt - MIN_FORMULAR))
  }, [])

  const aktuelleBreite = () => breite ?? split.current?.querySelector('aside')?.getBoundingClientRect().width ?? 520

  function runter(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const start = aktuelleBreite()
    zug.current = { start: e.clientX, breite: start, letzte: start }
  }
  function ziehen(e: PointerEvent<HTMLDivElement>) {
    if (!zug.current) return
    const neu = begrenze(zug.current.breite + e.clientX - zug.current.start)
    zug.current.letzte = neu
    setBreite(neu)
  }
  function hoch(e: PointerEvent<HTMLDivElement>) {
    if (!zug.current) return
    // Der zuletzt gesetzte Wert — der Zustand `breite` ist in diesem Handler noch der alte.
    const ende = zug.current.letzte
    zug.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    merke(ende)
  }
  function taste(e: KeyboardEvent<HTMLDivElement>) {
    const richtung = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
    if (!richtung) return
    e.preventDefault()
    const neu = begrenze(aktuelleBreite() + richtung * SCHRITT)
    setBreite(neu)
    merke(neu)
  }
  function zuruecksetzen() {
    setBreite(null)
    merke(null)
  }

  if (!draft.korpusGrunddaten) return <>{children}</>
  return (
    <div ref={split} className={styles.split} style={
        breite != null
          ? // `min()`: Eine gemerkte Breite von einem großen Bildschirm drückt auf einem kleineren nie das Formular zusammen.
            { gridTemplateColumns: `min(${breite}px, calc(100% - ${MIN_FORMULAR + TRENNER}px)) ${TRENNER}px minmax(0, 1fr)` }
          : undefined
      }>
      <aside className={styles.skizze}>
        <Konstruktion2D draft={draft} />
      </aside>
      <div
        className={styles.trenner}
        role="separator"
        aria-orientation="vertical"
        aria-label="Breite der Skizze ändern"
        aria-valuenow={breite != null ? Math.round(breite) : undefined}
        tabIndex={0}
        title="Ziehen, um die Skizze größer oder kleiner zu machen · Doppelklick: zurücksetzen"
        onPointerDown={runter}
        onPointerMove={ziehen}
        onPointerUp={hoch}
        onPointerCancel={hoch}
        onKeyDown={taste}
        onDoubleClick={zuruecksetzen}
      >
        <span className={styles.griff} />
      </div>
      <div className={styles.formular}>{children}</div>
    </div>
  )
}
