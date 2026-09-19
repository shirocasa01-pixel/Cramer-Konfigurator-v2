import { useState, useSyncExternalStore } from 'react'
import { AbschnittTexteModal } from './AbschnittTexteModal'
import { abschnittTexte, getEntwurfSchema, getSchema, subscribeSchema } from '../../lib/schemaStore'
import { useEditorModus } from '../../lib/editorModus'
import styles from './Editierbar.module.css'

/**
 * Überschrift und Einleitung eines Konfigurator-Schritts.
 *
 * Beide kommen aus dem Schema; im Bearbeitungsmodus hängt ein Stift daran. Für den
 * Berater sieht die Seite unverändert aus — dieselbe Überschrift, derselbe Absatz, kein
 * zusätzliches Markup.
 */
export function AbschnittKopf({
  abschnittId,
  standardTitel,
  titelKlasse,
  textKlasse,
  /** Ersetzt den Titel (z. B. wenn eine Seite je Serie eine andere Maske zeigt). */
  titelUeberschreibung,
}: {
  abschnittId: string
  standardTitel: string
  titelKlasse?: string
  textKlasse?: string
  titelUeberschreibung?: string
}) {
  const roh = useSyncExternalStore(subscribeSchema, getEntwurfSchema, getEntwurfSchema)
  const bearbeitung = useEditorModus()
  const [offen, setOffen] = useState(false)
  // Der Administrator sieht seinen Entwurf, der Berater den veroeffentlichten Stand.
  const texte = abschnittTexte(abschnittId, { titel: standardTitel }, bearbeitung ? roh : getSchema())

  return (
    <div className={styles.kopf}>
      <h1 className={titelKlasse}>
        {titelUeberschreibung ?? texte.titel}
        {bearbeitung ? (
          <button
            type="button"
            className={styles.kopfWerkzeug}
            title="Überschrift und Einleitung bearbeiten"
            onClick={() => setOffen(true)}
          >
            ✏️
          </button>
        ) : null}
      </h1>
      {texte.beschreibung ? <p className={textKlasse}>{texte.beschreibung}</p> : null}

      <AbschnittTexteModal abschnittId={abschnittId} offen={offen} onSchliessen={() => setOffen(false)} />
    </div>
  )
}
