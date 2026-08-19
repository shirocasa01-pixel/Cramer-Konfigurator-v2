import { useEffect, useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { StepIndicator } from '../../components/layout/StepIndicator'
import { Button } from '../../components/ui/Button'
import { useDraft } from '../../context/DraftContext'
import { getProductGroup, getSeries } from '../../config/productCatalog'
import { getVisibleKorpusAreas } from '../../config/korpus'
import { isKorpusComplete } from '../../lib/korpusValidation'
import { isKorpusGrunddatenComplete } from '../../lib/korpusMass'
import { isDimensionsValid } from '../../lib/dimensionsValidation'
import { isSondertiefeDepth } from '../../lib/korpusMass'
import {
  defaultSelectedEquipmentIds,
  equipmentCategories,
  isEquipmentAvailableInSondertiefe,
} from '../../config/equipment'
import styles from './Ausstattung.module.css'

/**
 * SCHRITT 6 (Refugium) – Ausstattung-Vorauswahl.
 * Allgemeine „Häkchen"-Abfrage, welche Ausstattung im Möbel benötigt wird. Nur die
 * hier vorausgewählten Optionen werden später in Schritt 8 („Ausstattung hinter
 * Fronten") je Segment angeboten. Die beiden Einlegeboden-Essentials sind
 * standardmäßig aktiv (abwählbar). Bei Sondertiefe sind nur Einlegeböden möglich.
 */
export default function AusstattungPage() {
  const { draft, updateDraft } = useDraft()
  const navigate = useNavigate()

  const group = getProductGroup(draft?.productGroupId)
  const series = getSeries(draft?.productGroupId, draft?.seriesId)
  const isRefugium = series?.id === 'refugium'
  const sondertiefe = draft ? isSondertiefeDepth(draft) : false

  // Vorauswahl einmalig mit den Default-Essentials initialisieren; bei Sondertiefe
  // nicht zulässige Optionen konsistent entfernen. Der Änderungs-Guard verhindert Schleifen.
  useEffect(() => {
    if (!draft || !isRefugium) return
    const current = draft.ausstattung?.selected
    let next = current ?? defaultSelectedEquipmentIds()
    if (sondertiefe) next = next.filter(isEquipmentAvailableInSondertiefe)
    const changed =
      !current || next.length !== current.length || next.some((id, i) => id !== current[i])
    if (changed) updateDraft({ ausstattung: { selected: next } })
  }, [draft, isRefugium, sondertiefe, updateDraft])

  const selected = useMemo(() => new Set(draft?.ausstattung?.selected ?? []), [draft?.ausstattung?.selected])

  if (!draft) return <Navigate to="/" replace />
  if (!group || !series) return <Navigate to="/products" replace />
  // Schritt 6 ist Refugium-spezifisch – andere Serien überspringen ihn.
  if (!isRefugium) return <Navigate to="/fronts" replace />
  if (!isKorpusComplete(draft.korpus, getVisibleKorpusAreas(series, draft.korpusMode))) {
    return <Navigate to="/korpus" replace />
  }
  const grunddatenOk = series.korpusRaster
    ? isKorpusGrunddatenComplete(draft.korpusGrunddaten)
    : isDimensionsValid(draft.dimensions)
  if (!grunddatenOk) return <Navigate to="/dimensions" replace />

  function toggle(optionId: string) {
    const next = new Set(selected)
    if (next.has(optionId)) next.delete(optionId)
    else next.add(optionId)
    updateDraft({ ausstattung: { selected: [...next] } })
  }

  const selectedCount = selected.size

  return (
    <AppShell>
      <div className={styles.page}>
        <StepIndicator activeKey="ausstattung" />

        <header className={styles.header}>
          <h1 className={styles.title}>Ausstattung-Vorauswahl</h1>
          <p className={styles.subtitle}>
            Allgemein festlegen, welche Ausstattung der Schrank benötigt. Nur die hier vorausgewählten
            Optionen werden anschließend bei den Fronten („Ausstattung hinter Fronten") je Segment abgefragt.
          </p>
          <p className={styles.context}>
            {group.name} · Serie {series.name} · {selectedCount} ausgewählt
          </p>
        </header>

        {sondertiefe ? (
          <p className={styles.notice}>
            <strong>Sondertiefe erkannt.</strong> Bei Korpustiefen unter 60 cm sind als Ausstattung nur
            Einlegeböden möglich – die übrigen Optionen sind deaktiviert.
          </p>
        ) : null}

        {equipmentCategories.map((category) => (
          <section key={category.id} className={styles.category} aria-label={category.label}>
            <div className={styles.categoryHead}>
              <h2 className={styles.categoryTitle}>{category.label}</h2>
            </div>
            <div className={styles.options}>
              {category.options.map((option) => {
                const disabled = sondertiefe && !isEquipmentAvailableInSondertiefe(option.id)
                const checked = selected.has(option.id) && !disabled
                return (
                  <label
                    key={option.id}
                    className={[styles.option, disabled ? styles.optionDisabled : '']
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(option.id)}
                    />
                    <span className={styles.optionText}>
                      <span className={styles.optionLabel}>{option.label}</span>
                      {option.hint ? <span className={styles.optionHint}>{option.hint}</span> : null}
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        ))}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => navigate('/dimensions')}>
            Zurück
          </Button>
          <Button onClick={() => navigate('/fronts')}>Weiter zu den Fronten</Button>
          <span className={styles.hint}>
            Auswahl jederzeit änderbar – sie steuert nur, welche Ausstattung hinter den Fronten angeboten wird.
          </span>
        </div>
      </div>
    </AppShell>
  )
}
