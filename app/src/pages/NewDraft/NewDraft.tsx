import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { StepIndicator } from '../../components/layout/StepIndicator'
import { SchemaFeldEingabe } from '../../components/schema/SchemaFeldEingabe'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'
import { useDraft } from '../../context/DraftContext'
import { felderFuer, getAbschnitt, getSchema, subscribeSchema } from '../../lib/schemaStore'
import { pruefeSchemaFelder } from '../../lib/draftValidation'
import { schreibeWert } from '../../lib/schemaWerte'
import styles from './NewDraft.module.css'

/**
 * SCHRITT 1 — „Neuen Entwurf anlegen".
 *
 * Die Maske ist nicht mehr ausprogrammiert: Welche Felder sie zeigt, in welcher
 * Reihenfolge, mit welcher Beschriftung und welchen Pflichtangaben, steht im
 * Konfigurator-Schema (`config/konfigurator-schema.json`, Abschnitt `auftragskopf`) und
 * wird vom Administrator unter /admin gepflegt. Dieselbe Definition liest auch die
 * Zusammenfassung und das AV-PDF.
 */
export default function NewDraftPage() {
  const { user } = useAuth()
  const { draft, startNewDraft, updateDraft } = useDraft()
  const navigate = useNavigate()
  const started = useRef(false)
  const schema = useSyncExternalStore(subscribeSchema, getSchema, getSchema)

  // Genau einen frischen Entwurf anlegen, falls keiner existiert (StrictMode-sicher).
  useEffect(() => {
    if (!draft && !started.current && user) {
      started.current = true
      startNewDraft({ id: user.id, name: user.name })
    }
  }, [draft, user, startNewDraft])

  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const abschnitt = getAbschnitt('auftragskopf', schema)
  const felder = useMemo(
    () => felderFuer('auftragskopf', 'maske', { schema, serieId: draft?.seriesId }),
    [schema, draft?.seriesId],
  )
  // Abgeleitete Felder (Berater, Datum, Entwurfsnummer) stehen oben im eigenen Raster.
  const angezeigte = felder.filter((f) => f.quelle)
  const eingaben = felder.filter((f) => !f.quelle)

  const errors = useMemo(() => pruefeSchemaFelder(draft, eingaben), [draft, eingaben])
  const isValid = Object.keys(errors).length === 0

  if (!draft) {
    return (
      <AppShell>
        <div className={styles.loading}>Entwurf wird vorbereitet …</div>
      </AppShell>
    )
  }

  function handleContinue() {
    setTouched(Object.fromEntries(eingaben.map((f) => [f.id, true])))
    if (isValid) navigate('/products')
  }

  const pflichtVorhanden = eingaben.some((f) => f.pflicht)

  return (
    <AppShell>
      <div className={styles.page}>
        <StepIndicator activeKey="draft" />

        <header className={styles.header}>
          <h1 className={styles.title}>{abschnitt?.titel ?? 'Neuen Entwurf anlegen'}</h1>
          {abschnitt?.beschreibung ? <p className={styles.subtitle}>{abschnitt.beschreibung}</p> : null}
        </header>

        {angezeigte.length > 0 ? (
          <section className={styles.autoGrid} aria-label="Automatisch erfasste Daten">
            {angezeigte.map((feld) => (
              <SchemaFeldEingabe key={feld.id} feld={feld} draft={draft} onChange={() => {}} />
            ))}
          </section>
        ) : null}

        <section className={styles.formGrid} aria-label="Eingaben">
          {eingaben.map((feld) => (
            <SchemaFeldEingabe
              key={feld.id}
              feld={feld}
              draft={draft}
              onChange={(wert) => {
                updateDraft(schreibeWert(draft, feld, wert))
                if (feld.typ === 'auswahl') setTouched((prev) => ({ ...prev, [feld.id]: true }))
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, [feld.id]: true }))}
              fehler={touched[feld.id] ? errors[feld.id] : undefined}
            />
          ))}
        </section>
        {pflichtVorhanden ? <p className={styles.legend}>* Pflichtfeld</p> : null}

        <div className={styles.actions}>
          <Button onClick={handleContinue}>Weiter zur Produktauswahl</Button>
          {!isValid ? <span className={styles.actionHint}>Bitte alle Pflichtfelder ausfüllen.</span> : null}
        </div>
      </div>
    </AppShell>
  )
}
