import { useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import {
  getEntwurfSchema,
  hatOffenenEntwurf,
  subscribeSchema,
  veroeffentliche,
  verwerfeEntwurf,
} from '../../lib/schemaStore'
import { setzeEditorModus, useBearbeitungsModus } from '../../lib/editorModus'
import styles from './EditorLeiste.module.css'

/**
 * Die Leiste, die den Bearbeitungsmodus sichtbar hält.
 *
 * Sie liegt über dem echten Konfigurator, während der Administrator ihn umbaut, und
 * beantwortet die drei Fragen, die dabei zählen: Sehe ich gerade einen Entwurf oder den
 * veröffentlichten Stand, wie mache ich ihn gültig, und wie komme ich hier wieder raus.
 */
export function EditorLeiste() {
  const bearbeitung = useBearbeitungsModus()
  const schema = useSyncExternalStore(subscribeSchema, getEntwurfSchema, getEntwurfSchema)
  const offen = useSyncExternalStore(subscribeSchema, hatOffenenEntwurf, hatOffenenEntwurf)
  const navigate = useNavigate()

  if (!bearbeitung) return null

  return (
    <div className={styles.leiste} role="region" aria-label="Bearbeitungsmodus">
      <span className={styles.marke}>Bearbeitungsmodus</span>
      <span className={offen ? styles.statusEntwurf : styles.statusLive}>
        {offen ? 'Entwurf — für Berater noch nicht sichtbar' : `Veröffentlicht · Fassung ${schema.version}`}
      </span>
      {/*
        Die vier Ebenen stehen hier und nicht in einer Hilfeseite: Der Administrator liest
        sie genau dann, wenn er sie braucht — während er in der Oberfläche steht. Das ℹ️
        an jedem Auswahlfeld führt die Kette dann für dieses eine Feld durch.
      */}
      <span className={styles.hinweis}>
        Stift ✏️ ändert Texte · Plus fügt Bausteine hinzu · ℹ zeigt die Herkunft eines Feldes
      </span>
      <span className={styles.ebenen}>
        <b>1</b> Oberfläche → <b>2</b> Module → <b>3</b> Dropdowns (DDD) → <b>4</b> Artikel &amp;
        Stammdaten
      </span>
      <div className={styles.aktionen}>
        {offen ? (
          <>
            <Button variant="ghost" onClick={verwerfeEntwurf}>
              Entwurf verwerfen
            </Button>
            <Button onClick={veroeffentliche}>Veröffentlichen</Button>
          </>
        ) : null}
        <Button
          variant="ghost"
          onClick={() => {
            setzeEditorModus(false)
            navigate('/admin')
          }}
        >
          Bearbeitung beenden
        </Button>
      </div>
    </div>
  )
}
