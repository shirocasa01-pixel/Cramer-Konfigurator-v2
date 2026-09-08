import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { StepIndicator } from '../../components/layout/StepIndicator'
import { Button } from '../../components/ui/Button'
import { DataField } from '../../components/ui/DataField'
import { Select } from '../../components/ui/Select'
import { TextField } from '../../components/ui/TextField'
import { useAuth } from '../../context/AuthContext'
import { useDraft } from '../../context/DraftContext'
import { getBranches } from '../../config/branches'
import { validateDraftForm, type DraftFormErrors } from '../../lib/draftValidation'
import styles from './NewDraft.module.css'

const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/**
 * PHASE 2 – „Neuen Entwurf anlegen“.
 * Berater & Datum automatisch; Auftragsnummer, Kunde & Filiale werden erfasst;
 * die Entwurfsnummer (Primary Key) vergibt das System eindeutig.
 */
export default function NewDraftPage() {
  const { user } = useAuth()
  const { draft, startNewDraft, updateDraft } = useDraft()
  const navigate = useNavigate()
  const started = useRef(false)

  // Genau einen frischen Entwurf anlegen, falls keiner existiert (StrictMode-sicher).
  useEffect(() => {
    if (!draft && !started.current && user) {
      started.current = true
      startNewDraft({ id: user.id, name: user.name })
    }
  }, [draft, user, startNewDraft])

  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const errors: DraftFormErrors = useMemo(
    () =>
      validateDraftForm({
        customerName: draft?.customerName ?? '',
        branchId: draft?.branchId ?? '',
      }),
    [draft?.customerName, draft?.branchId],
  )
  const isValid = Object.keys(errors).length === 0

  if (!draft) {
    return (
      <AppShell>
        <div className={styles.loading}>Entwurf wird vorbereitet …</div>
      </AppShell>
    )
  }

  const createdDate = dateFormatter.format(new Date(draft.createdAt))

  function markTouched(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function handleContinue() {
    setTouched({ customerName: true, branchId: true })
    if (isValid) navigate('/products')
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <StepIndicator activeKey="draft" />

        <header className={styles.header}>
          <h1 className={styles.title}>Neuen Entwurf anlegen</h1>
          <p className={styles.subtitle}>
            Berater und Datum werden automatisch übernommen. Kunde und Filiale sind Pflicht;
            Auftrags- und Artikelnummer sind optional und können später ergänzt werden
            (spätestens vor der AV-Übergabe). Die Entwurfsnummer vergibt das System eindeutig.
          </p>
        </header>

        <section className={styles.autoGrid} aria-label="Automatisch erfasste Daten">
          <DataField label="Berater" value={draft.consultant.name} auto />
          <DataField label="Datum" value={createdDate} auto />
          <DataField label="Entwurfsnummer" value={draft.id} auto mono />
        </section>

        <section className={styles.formGrid} aria-label="Eingaben">
          <TextField
            label="Auftragsnummer"
            placeholder="z. B. 2026-04711"
            hint="Optional – kann später ergänzt werden (spätestens vor der AV-Übergabe)."
            value={draft.orderNumber}
            onChange={(event) => updateDraft({ orderNumber: event.target.value })}
          />
          <TextField
            label="Artikelnummer"
            placeholder="z. B. AR-10245"
            hint="Optional – kann später ergänzt werden."
            value={draft.artikelnummer ?? ''}
            onChange={(event) => updateDraft({ artikelnummer: event.target.value })}
          />
          {/* Punkt 1.5: Der Berater benennt die Angebotsvariante selbst. Varianten
              desselben Kunden erscheinen in der Übersicht zusammengefasst. */}
          <TextField
            label="Variantenbezeichnung"
            placeholder="z. B. Variante A — Eiche geölt"
            hint="Optional – bei mehreren Angebotsvarianten für denselben Kunden."
            value={draft.variantLabel ?? ''}
            onChange={(event) => updateDraft({ variantLabel: event.target.value })}
          />
          <TextField
            label="Kunde *"
            required
            placeholder="Name des Kunden"
            value={draft.customerName}
            onChange={(event) => updateDraft({ customerName: event.target.value })}
            onBlur={() => markTouched('customerName')}
            error={touched.customerName ? errors.customerName : undefined}
          />
          <Select
            label="Ort / Filiale *"
            placeholder="Bitte wählen"
            options={getBranches().map((b) => ({ value: b.id, label: b.name }))}
            value={draft.branchId}
            onChange={(event) => {
              updateDraft({ branchId: event.target.value })
              markTouched('branchId')
            }}
            onBlur={() => markTouched('branchId')}
            error={touched.branchId ? errors.branchId : undefined}
          />
        </section>
        <p className={styles.legend}>* Pflichtfeld</p>

        <div className={styles.actions}>
          <Button onClick={handleContinue}>
            Weiter zur Produktauswahl
          </Button>
          {!isValid ? (
            <span className={styles.actionHint}>Bitte alle Pflichtfelder ausfüllen.</span>
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}
