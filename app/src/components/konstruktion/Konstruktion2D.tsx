import { useMemo, useState } from 'react'
import type { Draft } from '../../types'
import { konstruktion } from '../../lib/konstruktion'
import { KonstruktionsAnsicht, type Ansicht } from './ansichten'
import { AnsichtsTabs, SkizzenFuss } from './SkizzenTeile'
import { SkizzenVollbild } from './SkizzenVollbild'
import styles from './Konstruktion2D.module.css'

/**
 * BEGLEITENDE 2D-KONSTRUKTIONSANSICHT (links neben dem Formular).
 *
 * Vier Ansichten (`ansichten.tsx`), umschaltbar per Tab; unten links öffnet ein Knopf
 * dieselbe Ansicht im Vollbild mit Zoom und Verschieben (`SkizzenVollbild.tsx`).
 * Das Modell kommt aus `lib/konstruktion.ts`, jedes Bauteil aus `bauteile/`.
 */
export function Konstruktion2D({ draft }: { draft: Draft }) {
  const [ansicht, setAnsicht] = useState<Ansicht>('vorne')
  const [vollbild, setVollbild] = useState(false)
  const { korpusGrunddaten, fronts, seriesId, ausstattung, sichtRueckwandAussen } = draft
  const modell = useMemo(
    () => konstruktion({ korpusGrunddaten, fronts, seriesId, ausstattung, sichtRueckwandAussen }),
    [korpusGrunddaten, fronts, seriesId, ausstattung, sichtRueckwandAussen],
  )

  return (
    <section className={styles.wrap} aria-label="2D-Konstruktionsansicht">
      <AnsichtsTabs ansicht={ansicht} onWahl={setAnsicht} />
      {modell ? (
        <>
          <div className={styles.buehne}>
            <KonstruktionsAnsicht m={modell} ansicht={ansicht} />
            <button
              type="button"
              className={styles.vollbildKnopf}
              onClick={() => setVollbild(true)}
              title="Skizze im Vollbild öffnen — zoomen und verschieben"
              aria-label="Skizze im Vollbild öffnen"
            >
              <VergroessernIcon />
            </button>
          </div>
          <SkizzenFuss m={modell} ansicht={ansicht} />
          {vollbild ? (
            <SkizzenVollbild m={modell} ansicht={ansicht} onAnsicht={setAnsicht} onSchliessen={() => setVollbild(false)} />
          ) : null}
        </>
      ) : (
        <p className={styles.leer}>Sobald Höhe, Tiefe und jede Korpusbreite feststehen, erscheint hier die Skizze.</p>
      )}
    </section>
  )
}

/** Vergrößern-Symbol (zwei diagonale Pfeile, wie Lucide „Maximize2"). */
function VergroessernIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}
