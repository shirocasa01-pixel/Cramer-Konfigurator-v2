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
  getEquipmentOption,
  isEquipmentAvailableInSondertiefe,
} from '../../config/equipment'
import { entferneAbgewaehlteAusstattung } from '../../lib/frontsHelpers'
import type { Draft } from '../../types'
import { AbschnittKopf } from '../../components/schema/AbschnittKopf'
import { Beschriftung, BeschriftungsGruppe, useTexte } from '../../components/schema/Beschriftung'
import { Inspector } from '../../components/schema/Inspector'
import { SchemaAbschnittFelder } from '../../components/schema/SchemaAbschnittFelder'
import styles from './Ausstattung.module.css'

/**
 * SCHRITT 6 (Refugium) – Ausstattung-Vorauswahl.
 * Allgemeine „Häkchen"-Abfrage, welche Ausstattung im Möbel benötigt wird. Nur die
 * hier vorausgewählten Optionen werden später in Schritt 8 („Ausstattung hinter
 * Fronten") je Segment angeboten. Die beiden Einlegeboden-Essentials sind
 * standardmäßig aktiv (abwählbar). Bei Sondertiefe sind nur Einlegeböden möglich.
 */
/**
 * Patch für eine geänderte Vorauswahl — samt Aufräumen der bereits erfassten Teile.
 *
 * Überarbeitung 6, S. 1: Eine abgewählte Option muss auch aus den Segmenten und damit
 * aus der Kalkulation verschwinden. Beides gehört in EINEN Schreibvorgang, sonst gibt es
 * einen Zwischenzustand, in dem die Vorauswahl schon leer und der Preis noch alt ist.
 */
function auswahlPatch(aktuell: Draft, selected: string[]): Partial<Draft> {
  const fronts = entferneAbgewaehlteAusstattung(aktuell.fronts, selected)
  return fronts === aktuell.fronts
    ? { ausstattung: { selected } }
    : { ausstattung: { selected }, fronts }
}

export default function AusstattungPage() {
  const { draft, updateDraftFrom } = useDraft()
  const navigate = useNavigate()
  const t = useTexte('ausstattung')

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
    // Optionen, die es im Katalog nicht mehr gibt (Überarbeitung 6: die Verblendung ist
    // in den Schritt „Maße" gewandert), fallen aus der Vorauswahl — und mit ihnen die
    // dazu erfassten Teile. Sonst bliebe eine Auswahl stehen, die nirgends mehr sichtbar ist.
    next = next.filter((id) => getEquipmentOption(id) !== undefined)
    if (sondertiefe) next = next.filter(isEquipmentAvailableInSondertiefe)
    const changed =
      !current || next.length !== current.length || next.some((id, i) => id !== current[i])
    const verwaist = entferneAbgewaehlteAusstattung(draft.fronts, next) !== draft.fronts
    if (changed || verwaist) updateDraftFrom((aktuell) => auswahlPatch(aktuell, next))
  }, [draft, isRefugium, sondertiefe, updateDraftFrom])

  const selected = useMemo(() => new Set(draft?.ausstattung?.selected ?? []), [draft?.ausstattung?.selected])


  if (!draft) return <Navigate to="/" replace />
  if (!group || !series) return <Navigate to="/products" replace />
  // Schritt 6 ist Refugium-spezifisch – andere Serien überspringen ihn.
  if (!isRefugium) return <Navigate to="/fronts" replace />
  // Reihenfolge wie im Workflow: erst Maße, dann Korpus.
  const grunddatenOk = series.korpusRaster
    ? isKorpusGrunddatenComplete(draft.korpusGrunddaten)
    : isDimensionsValid(draft.dimensions)
  if (!grunddatenOk) return <Navigate to="/dimensions" replace />
  if (!isKorpusComplete(draft.korpus, getVisibleKorpusAreas(series, draft.korpusMode))) {
    return <Navigate to="/korpus" replace />
  }

  function toggle(optionId: string) {
    const next = new Set(selected)
    if (next.has(optionId)) next.delete(optionId)
    else next.add(optionId)
    // Abwählen heißt: raus aus der Vorauswahl UND raus aus den Segmenten (Überarbeitung 6, S. 1).
    updateDraftFrom((aktuell) => auswahlPatch(aktuell, [...next]))
  }

  const selectedCount = selected.size

  return (
    <AppShell>
      <div className={styles.page}>
        <StepIndicator activeKey="ausstattung" />

        <header className={styles.header}>
          <AbschnittKopf
            abschnittId="ausstattung"
            standardTitel="Ausstattung-Vorauswahl"
            titelKlasse={styles.title}
            textKlasse={styles.subtitle}
          />
          <p className={styles.context}>
            {group.name} · Serie {series.name} · {selectedCount} ausgewählt
          </p>
        </header>

        {sondertiefe ? (
          <Beschriftung
            abschnittId="ausstattung"
            schluessel="sondertiefe"
            standard="Sondertiefe erkannt. Bei Korpustiefen unter 60 cm sind als Ausstattung nur Einlegeböden möglich – die übrigen Optionen sind deaktiviert."
            as="p"
            className={styles.notice}
            mehrzeilig
          />
        ) : null}

        {/*
          ERKLÄRTEXTE UNTER DEN OPTIONEN.

          Der Satz unter „Einlegeboden" („Standardmäßig ausgewählt, abwählbar. Je Boden
          eine eigene Rasterhöhe.") ist das, was den Berater durch diesen Schritt führt —
          und das, was sich mit jeder Praxisrunde ändert. Beschriftung und Erklärtext jeder
          Option sind deshalb editierbar, der Stift sitzt an der Kategorie-Überschrift und
          öffnet alle Optionen dieser Kategorie zusammen.

          Die OPTION selbst bleibt Code: An ihrer Kennung hängen die Artikel, die
          Sondertiefen-Regel und die Abfrage hinter den Fronten.
        */}
        {equipmentCategories.map((category) => (
          <section key={category.id} className={styles.category} aria-label={category.label}>
            <div className={styles.categoryHead}>
              <h2 className={styles.categoryTitle}>
                <Beschriftung
                  abschnittId="ausstattung"
                  schluessel={`kategorie.${category.id}`}
                  standard={category.label}
                />
                <BeschriftungsGruppe
                  abschnittId="ausstattung"
                  titel={`„${category.label}" beschriften`}
                  eintraege={category.options.flatMap((o) => [
                    {
                      schluessel: `option.${o.id}.label`,
                      standard: o.label,
                      label: `${o.label} — Bezeichnung`,
                    },
                    {
                      schluessel: `option.${o.id}.hinweis`,
                      standard: o.hint ?? '',
                      label: `${o.label} — Erklärtext`,
                      mehrzeilig: true,
                    },
                  ])}
                />
              </h2>
            </div>
            <div className={styles.options}>
              {category.options.map((option) => {
                const disabled = sondertiefe && !isEquipmentAvailableInSondertiefe(option.id)
                const checked = selected.has(option.id) && !disabled
                const hinweis = t(`option.${option.id}.hinweis`, option.hint ?? '')
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
                      <span className={styles.optionLabel}>
                        {t(`option.${option.id}.label`, option.label)}
                        <Inspector feld={`ausstattung.option.${option.id}`} />
                      </span>
                      {hinweis ? <span className={styles.optionHint}>{hinweis}</span> : null}
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        ))}

        <SchemaAbschnittFelder abschnittId="ausstattung" />

        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => navigate('/korpus')}>
            Zurück
          </Button>
          <Button onClick={() => navigate('/fronts')}>Weiter zu den Fronten</Button>
          <Beschriftung
            abschnittId="ausstattung"
            schluessel="fusshinweis"
            standard="Auswahl jederzeit änderbar – sie steuert nur, welche Ausstattung hinter den Fronten angeboten wird."
            as="span"
            className={styles.hint}
            mehrzeilig
          />
        </div>
      </div>
    </AppShell>
  )
}
