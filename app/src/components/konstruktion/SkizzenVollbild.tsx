import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Konstruktion2D as Modell } from '../../lib/konstruktion'
import { useScrollSperre } from '../../lib/scrollSperre'
import { AnsichtsKontext, KonstruktionsAnsicht, type Ansicht, type Ausschnitt } from './ansichten'
import { AnsichtsTabs, SkizzenFuss } from './SkizzenTeile'
import styles from './Konstruktion2D.module.css'

/**
 * VOLLBILD DER 2D-SKIZZE — zum Vorführen im Kundengespräch.
 *
 * Stufenlos zoomen (Knöpfe, Mausrad, Zwei-Finger-Geste, Tasten + / − / 0) und verschieben
 * (Ziehen mit Maus oder Finger). Gezoomt wird über die `viewBox` der SVG, nicht per CSS-
 * Skalierung: Maßketten und Zahlen bleiben in jeder Stufe gestochen scharf. Die vier
 * Ansichten bleiben oben umschaltbar; Esc oder ✕ schließt.
 */

const MIN_ZOOM = 1
const MAX_ZOOM = 12
const STUFE = 1.25
const GANZ: Ausschnitt = { zoom: 1, cx: 0.5, cy: 0.5 }

function begrenze(a: Ausschnitt): Ausschnitt {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, a.zoom))
  // Der Mittelpunkt darf nur so weit wandern, dass der Ausschnitt in der Zeichnung bleibt.
  const rand = 0.5 / zoom
  return {
    zoom,
    cx: Math.min(1 - rand, Math.max(rand, a.cx)),
    cy: Math.min(1 - rand, Math.max(rand, a.cy)),
  }
}

export function SkizzenVollbild({
  m,
  ansicht,
  onAnsicht,
  onSchliessen,
}: {
  m: Modell
  ansicht: Ansicht
  onAnsicht: (a: Ansicht) => void
  onSchliessen: () => void
}) {
  useScrollSperre(true)
  const [ausschnitt, setAusschnitt] = useState<Ausschnitt>(GANZ)
  const buehne = useRef<HTMLDivElement>(null)
  const zeiger = useRef(new Map<number, { x: number; y: number }>())
  const letzte = useRef<{ x: number; y: number; abstand?: number } | null>(null)

  // Neue Ansicht → wieder die ganze Zeichnung.
  useEffect(() => setAusschnitt(GANZ), [ansicht])

  /**
   * Bildschirmpunkt → Lage in der Zeichnung (0…1) und Pixel je Zeichnungseinheit bei Zoom 1.
   * Grundlage: `data-basis` (Gesamtgröße) und die Darstellung mit `meet` (eingepasst, mittig).
   */
  const geometrie = useCallback(() => {
    const el = buehne.current
    const svg = el?.querySelector('svg')
    const basis = svg?.getAttribute('data-basis')?.split(' ').map(Number)
    if (!el || !svg || !basis) return null
    const r = svg.getBoundingClientRect()
    const [b, h] = basis
    const pxJeEinheit = Math.min(r.width / b, r.height / h)
    return { r, b, h, pxJeEinheit }
  }, [])

  /** Zoomt um den Bildschirmpunkt (x, y) — der Punkt unter dem Mauszeiger bleibt stehen. */
  const zoomeUm = useCallback(
    (faktor: number, x?: number, y?: number) => {
      setAusschnitt((alt) => {
        const g = geometrie()
        const ziel = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, alt.zoom * faktor))
        if (!g || x == null || y == null) return begrenze({ ...alt, zoom: ziel })
        const mx = x - (g.r.left + g.r.width / 2)
        const my = y - (g.r.top + g.r.height / 2)
        const s1 = g.pxJeEinheit * alt.zoom
        const s2 = g.pxJeEinheit * ziel
        // Zeichnungspunkt unter dem Zeiger (relativ) vor und nach dem Zoom gleich halten.
        const px = alt.cx + mx / s1 / g.b
        const py = alt.cy + my / s1 / g.h
        return begrenze({ zoom: ziel, cx: px - mx / s2 / g.b, cy: py - my / s2 / g.h })
      })
    },
    [geometrie],
  )

  const verschiebe = useCallback(
    (dx: number, dy: number) => {
      setAusschnitt((alt) => {
        const g = geometrie()
        if (!g) return alt
        const s = g.pxJeEinheit * alt.zoom
        return begrenze({ ...alt, cx: alt.cx - dx / s / g.b, cy: alt.cy - dy / s / g.h })
      })
    },
    [geometrie],
  )

  // Mausrad: nicht passiv registrieren, sonst lässt sich das Scrollen nicht verhindern.
  useEffect(() => {
    const el = buehne.current
    if (!el) return
    const rad = (e: WheelEvent) => {
      e.preventDefault()
      zoomeUm(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY)
    }
    el.addEventListener('wheel', rad, { passive: false })
    return () => el.removeEventListener('wheel', rad)
  }, [zoomeUm])

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSchliessen()
      else if (e.key === '+' || e.key === '=') zoomeUm(STUFE)
      else if (e.key === '-') zoomeUm(1 / STUFE)
      else if (e.key === '0') setAusschnitt(GANZ)
    }
    window.addEventListener('keydown', taste)
    return () => window.removeEventListener('keydown', taste)
  }, [onSchliessen, zoomeUm])

  // Ziehen mit einem Zeiger verschiebt, zwei Zeiger (Finger) zoomen um ihre Mitte.
  function runter(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    zeiger.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    letzte.current = mitte()
  }
  function bewege(e: ReactPointerEvent<HTMLDivElement>) {
    if (!zeiger.current.has(e.pointerId)) return
    zeiger.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const jetzt = mitte()
    const vorher = letzte.current
    if (jetzt && vorher) {
      if (jetzt.abstand && vorher.abstand) zoomeUm(jetzt.abstand / vorher.abstand, jetzt.x, jetzt.y)
      verschiebe(jetzt.x - vorher.x, jetzt.y - vorher.y)
    }
    letzte.current = jetzt
  }
  function hoch(e: ReactPointerEvent<HTMLDivElement>) {
    zeiger.current.delete(e.pointerId)
    letzte.current = mitte()
  }
  function mitte(): { x: number; y: number; abstand?: number } | null {
    const p = [...zeiger.current.values()]
    if (p.length === 0) return null
    if (p.length === 1) return { x: p[0].x, y: p[0].y }
    return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2, abstand: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) }
  }

  return createPortal(
    <div className={styles.vollbild} role="dialog" aria-modal="true" aria-label="2D-Skizze im Vollbild">
      <div className={styles.vollbildKopf}>
        <AnsichtsTabs ansicht={ansicht} onWahl={onAnsicht} />
        <div className={styles.zoomLeiste} role="group" aria-label="Zoom">
          <button type="button" className={styles.zoomKnopf} onClick={() => zoomeUm(1 / STUFE)} aria-label="Verkleinern" disabled={ausschnitt.zoom <= MIN_ZOOM}>
            −
          </button>
          <span className={styles.zoomWert} aria-live="polite">
            {Math.round(ausschnitt.zoom * 100)} %
          </span>
          <button type="button" className={styles.zoomKnopf} onClick={() => zoomeUm(STUFE)} aria-label="Vergrößern" disabled={ausschnitt.zoom >= MAX_ZOOM}>
            +
          </button>
          <button type="button" className={styles.zoomText} onClick={() => setAusschnitt(GANZ)}>
            Einpassen
          </button>
        </div>
        <button type="button" className={styles.schliessen} onClick={onSchliessen} aria-label="Vollbild schließen" title="Schließen (Esc)">
          ✕
        </button>
      </div>
      <div
        ref={buehne}
        className={styles.vollbildBuehne}
        onPointerDown={runter}
        onPointerMove={bewege}
        onPointerUp={hoch}
        onPointerCancel={hoch}
        onDoubleClick={(e) => zoomeUm(2, e.clientX, e.clientY)}
      >
        <AnsichtsKontext.Provider value={{ ausschnitt, klasse: `${styles.svg} ${styles.svgVoll}` }}>
          <KonstruktionsAnsicht m={m} ansicht={ansicht} />
        </AnsichtsKontext.Provider>
      </div>
      <div className={styles.vollbildFuss}>
        <SkizzenFuss m={m} ansicht={ansicht} />
        <span className={styles.bedienung}>Mausrad oder zwei Finger: zoomen · Ziehen: verschieben · Doppelklick: hineinzoomen · 0: einpassen · Esc: schließen</span>
      </div>
    </div>,
    document.body,
  )
}
