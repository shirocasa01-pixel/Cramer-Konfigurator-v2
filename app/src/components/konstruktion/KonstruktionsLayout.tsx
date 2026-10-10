import type { ReactNode } from 'react'
import type { Draft } from '../../types'
import { Konstruktion2D } from './Konstruktion2D'
import styles from './KonstruktionsLayout.module.css'

/**
 * SPLIT-LAYOUT der Schritte „Maße", „Material", „Ausstattung" und „Fronten":
 * links die mitlaufende 2D-Skizze, rechts das Formular.
 *
 * Das Formular liegt bewusst RECHTS — kürzere Wege für Rechtshänder mit Maus oder Touchpad.
 * Ohne strukturierte Korpus-Grunddaten (Serien mit freier Maßeingabe) gibt es nichts zu
 * zeichnen; dann bleibt die Seite einspaltig wie bisher. Auf schmalen Bildschirmen steht die
 * Skizze über dem Formular.
 */
export function KonstruktionsLayout({ draft, children }: { draft: Draft; children: ReactNode }) {
  if (!draft.korpusGrunddaten) return <>{children}</>
  return (
    <div className={styles.split}>
      <aside className={styles.skizze}>
        <Konstruktion2D draft={draft} />
      </aside>
      <div className={styles.formular}>{children}</div>
    </div>
  )
}
