import { useSyncExternalStore } from 'react'
import { BausteinPlus } from './BausteinPlus'
import { EditierHuelle } from './EditierHuelle'
import { SchemaFeldEingabe } from './SchemaFeldEingabe'
import { useDraft } from '../../context/DraftContext'
import { felderFuer, getEntwurfSchema, getSchema, subscribeSchema } from '../../lib/schemaStore'
import { schreibeWert } from '../../lib/schemaWerte'
import { useEditorModus } from '../../lib/editorModus'
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
  const roh = useSyncExternalStore(subscribeSchema, getEntwurfSchema, getEntwurfSchema)
  const { draft, updateDraft } = useDraft()
  const bearbeitung = useEditorModus()

  const schema = bearbeitung ? roh : getSchema()

  if (!draft) return null

  const abschnitt = schema.abschnitte.find((a) => a.id === abschnittId)
  // Im Bearbeitungsmodus auch die abgeschalteten zeigen — sonst kann man sie nicht
  // wieder einschalten.
  const felder = bearbeitung
    ? [...(abschnitt?.felder ?? [])].sort((a, b) => a.sortierung - b.sortierung)
    : felderFuer(abschnittId, 'maske', { schema, serieId: draft.seriesId })

  if (felder.length === 0 && !bearbeitung) return null

  return (
    <section className={styles.block} aria-label="Ergänzende Angaben">
      {felder.map((feld) => (
        <EditierHuelle key={feld.id} feld={feld} abschnittId={abschnittId}>
          <SchemaFeldEingabe
            feld={feld}
            draft={draft}
            onChange={(wert) => updateDraft(schreibeWert(draft, feld, wert))}
          />
        </EditierHuelle>
      ))}
      <BausteinPlus abschnittId={abschnittId} vorhandeneIds={felder.map((f) => f.id)} />
    </section>
  )
}
