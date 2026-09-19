import { useSyncExternalStore } from 'react'
import { SchemaFeldEingabe } from './SchemaFeldEingabe'
import { useDraft } from '../../context/DraftContext'
import { felderFuer, getSchema, subscribeSchema } from '../../lib/schemaStore'
import { schreibeWert } from '../../lib/schemaWerte'
import styles from './SchemaAbschnittFelder.module.css'

/**
 * Die vom Administrator ergänzten Bausteine eines Schritts.
 *
 * Jede Konfigurator-Seite bindet diese Komponente einmal ein. Im Auslieferungsstand ist
 * sie leer und rendert nichts; sobald der Administrator unter /admin einen Hinweis, eine
 * Überschrift oder ein Eingabefeld ergänzt, erscheint es hier — ohne dass die Seite selbst
 * angefasst werden muss.
 *
 * Der Auftragskopf ist bewusst ausgenommen: Dort rendert die Maske ihre Felder selbst,
 * weil sie zusätzlich die automatisch erfassten Angaben oben abbildet.
 */
export function SchemaAbschnittFelder({ abschnittId }: { abschnittId: string }) {
  const schema = useSyncExternalStore(subscribeSchema, getSchema, getSchema)
  const { draft, updateDraft } = useDraft()

  if (!draft) return null
  const felder = felderFuer(abschnittId, 'maske', { schema, serieId: draft.seriesId })
  if (felder.length === 0) return null

  return (
    <section className={styles.block} aria-label="Ergänzende Angaben">
      {felder.map((feld) => (
        <SchemaFeldEingabe
          key={feld.id}
          feld={feld}
          draft={draft}
          onChange={(wert) => updateDraft(schreibeWert(draft, feld, wert))}
        />
      ))}
    </section>
  )
}
