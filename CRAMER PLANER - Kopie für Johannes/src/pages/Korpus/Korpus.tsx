import { Navigate, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { StepIndicator } from '../../components/layout/StepIndicator'
import { Button } from '../../components/ui/Button'
import { MaterialSelect } from '../../components/material/MaterialSelect'
import { TextField } from '../../components/ui/TextField'
import { KorpusInnenSection } from '../../components/korpus/KorpusInnenSection'
import { useDraft } from '../../context/DraftContext'
import { getProductGroup, getSeries } from '../../config/productCatalog'
import { getVisibleKorpusAreas, rueckwandAussenArea, type KorpusMode } from '../../config/korpus'
import { RAUCHGLAS_OPTION_IDS } from '../../config/materialMatrix'
import { isKorpusComplete } from '../../lib/korpusValidation'
import { resolveKorpusBreiteCm } from '../../lib/korpusMass'
import type { KorpusInnen, MaterialSelection } from '../../types'
import styles from './Korpus.module.css'

/**
 * PHASE 4 – Korpus-Konfiguration.
 * Bereiche Innen (bedingt: Velare/Refugium) / Außen / Abdeckplatte. Alle Material-
 * Dropdowns stammen aus der zentralen Farbmatrix; die Preisgruppe wird automatisch
 * im Hintergrund zugewiesen. Erzwungene Progression: sichtbare Bereiche sind Pflicht.
 */
export default function KorpusPage() {
  const { draft, updateDraft } = useDraft()
  const navigate = useNavigate()

  if (!draft) return <Navigate to="/" replace />
  const group = getProductGroup(draft.productGroupId)
  const series = getSeries(draft.productGroupId, draft.seriesId)
  if (!group || !series) return <Navigate to="/products" replace />

  const korpus = draft.korpus
  const mode: KorpusMode = draft.korpusMode ?? 'komplett'
  const visibleAreas = getVisibleKorpusAreas(series, mode)
  const complete = isKorpusComplete(korpus, visibleAreas)
  // Punkt 5.3: Die Korpus-Liste stammt aus Schritt „Maße". Solange sie fehlt, gibt es
  // nur die einheitliche Auswahl – siehe Hinweis im Innen-Bereich.
  const korpusse = draft.korpusGrunddaten?.korpusse ?? []
  const innenJeKorpus = draft.korpusInnenJeKorpus != null && korpusse.length > 1

  function updateArea(areaId: string, selection: MaterialSelection) {
    updateDraft({ korpus: { ...korpus, [areaId]: selection } })
  }
  // Punkt 5.3 – Innenmaterial je Korpus.
  function updateInnenJeKorpus(korpusId: string, selection: MaterialSelection) {
    updateDraft({ korpusInnenJeKorpus: { ...draft?.korpusInnenJeKorpus, [korpusId]: selection } })
  }
  function setInnenModus(jeKorpus: boolean) {
    updateDraft({ korpusInnenJeKorpus: jeKorpus ? (draft?.korpusInnenJeKorpus ?? {}) : undefined })
  }
  function setMode(next: KorpusMode) {
    updateDraft({ korpusMode: next })
  }
  function updateKorpusInnen(next: KorpusInnen) {
    updateDraft({ korpusInnen: next })
  }

  function handleContinue() {
    if (complete) navigate('/dimensions')
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <StepIndicator activeKey="korpus" />

        <header className={styles.header}>
          <h1 className={styles.title}>Korpus-Konfiguration</h1>
          <p className={styles.subtitle}>
            Material und Ausführung des Korpus festlegen. Alle Auswahllisten stammen aus der
            zentralen Farbmatrix; die Preisgruppe wird automatisch im Hintergrund zugeordnet.
          </p>
          <p className={styles.context}>
            {group.name} · Serie {series.name}
          </p>
        </header>

        <section className={styles.modeToggle} aria-label="Außenkorpus-Modus">
          <span className={styles.modeLabel}>Außenkorpus</span>
          <div className={styles.modeChips} role="group">
            <button
              type="button"
              className={mode === 'komplett' ? styles.modeChipActive : styles.modeChip}
              onClick={() => setMode('komplett')}
              aria-pressed={mode === 'komplett'}
            >
              Komplett auswählen
            </button>
            <button
              type="button"
              className={mode === 'getrennt' ? styles.modeChipActive : styles.modeChip}
              onClick={() => setMode('getrennt')}
              aria-pressed={mode === 'getrennt'}
            >
              Getrennte Konfiguration
            </button>
          </div>
          <span className={styles.modeHint}>
            {mode === 'komplett'
              ? 'Ein Material für den gesamten Außenkorpus.'
              : 'Linke Seite, rechte Seite und Abdeckplatte unabhängig konfigurierbar.'}
          </span>
        </section>

        {visibleAreas.map((area) => {
          const selection = korpus?.[area.id]
          const isAbdeckplatte = area.id === 'abdeckplatte'
          return (
            <section key={area.id} className={styles.area} aria-label={area.label}>
              <div className={styles.areaHead}>
                <h2 className={styles.areaTitle}>{area.label}</h2>
                {area.hint ? <span className={styles.areaHint}>{area.hint}</span> : null}
                {area.id === 'innen' ? (
                  <span className={styles.variant}>Ausführung: {series.name}</span>
                ) : null}
              </div>
              {area.id === 'innen' && innenJeKorpus ? (
                <div className={styles.korpusListe}>
                  {korpusse.map((k, index) => (
                    <div key={k.id} className={styles.korpusEintrag}>
                      <span className={styles.korpusName}>
                        Korpus {index + 1}
                        {resolveKorpusBreiteCm(k) != null ? ` · ${resolveKorpusBreiteCm(k)}er` : ''}
                        {index === 0
                          ? ' · ganz links'
                          : index === korpusse.length - 1
                            ? ' · ganz rechts'
                            : ''}
                      </span>
                      <MaterialSelect
                        groupIds={area.materialGroupIds}
                        allowCustom={area.allowCustom}
                        value={draft.korpusInnenJeKorpus?.[k.id] ?? selection}
                        onChange={(next) => updateInnenJeKorpus(k.id, next)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <MaterialSelect
                  groupIds={area.materialGroupIds}
                  allowCustom={area.allowCustom}
                  noneLabel={area.noneLabel}
                  excludeOptionIds={isAbdeckplatte ? RAUCHGLAS_OPTION_IDS : undefined}
                  value={selection}
                  onChange={(next) => updateArea(area.id, next)}
                />
              )}
              {area.id === 'innen' ? (
                korpusse.length > 1 ? (
                  <label className={styles.check}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={innenJeKorpus}
                      onChange={(event) => setInnenModus(event.target.checked)}
                    />
                    Innenmaterial je Korpus getrennt wählen ({korpusse.length} Korpi)
                  </label>
                ) : (
                  <p className={styles.innenHint}>
                    Sobald im Schritt „Maße" mehrere Korpi angelegt sind, lässt sich das
                    Innenmaterial hier je Korpus getrennt wählen — etwa Decoboard hinter den
                    Drehtüren und Furnier im offenen Mittelteil.
                  </p>
                )
              ) : null}
              {isAbdeckplatte && selection && selection.materialGroupId === 'glas' ? (
                <TextField
                  label="Glas-Spezifikation (Freitext)"
                  placeholder="z. B. Klarglas 6 mm, satiniert, Bronze getönt"
                  value={selection.note ?? ''}
                  onChange={(event) => updateArea('abdeckplatte', { ...selection, note: event.target.value })}
                />
              ) : null}
            </section>
          )
        })}

        {/* Phase B – Rückwand Außen; Serien-Filtering: nur bei Serien mit Sichtrückwand (nicht Refugium). */}
        {series.hasSichtRueckwand !== false ? (
          <section className={styles.area} aria-label={rueckwandAussenArea.label}>
            <div className={styles.areaHead}>
              <h2 className={styles.areaTitle}>{rueckwandAussenArea.label}</h2>
              {rueckwandAussenArea.hint ? <span className={styles.areaHint}>{rueckwandAussenArea.hint}</span> : null}
            </div>
            <label className={styles.check}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={Boolean(draft.sichtRueckwandAussen)}
                onChange={(event) => updateDraft({ sichtRueckwandAussen: event.target.checked })}
              />
              Sicht-Rückwand? (sichtbare Außen-Rückwand konfigurieren)
            </label>
            {draft.sichtRueckwandAussen ? (
              <MaterialSelect
                groupIds={rueckwandAussenArea.materialGroupIds}
                allowCustom={rueckwandAussenArea.allowCustom}
                value={korpus?.rueckwandAussen}
                onChange={(next) => updateArea('rueckwandAussen', next)}
              />
            ) : null}
          </section>
        ) : null}

        {/* Phase B – Korpus Innen (Innenausbau) */}
        <KorpusInnenSection value={draft.korpusInnen} onChange={updateKorpusInnen} />

        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => navigate('/products')}>
            Zurück
          </Button>
          <Button onClick={handleContinue} disabled={!complete}>
            Weiter zu den Fronten
          </Button>
          {!complete ? (
            <span className={styles.hint}>Bitte alle Korpus-Bereiche vollständig ausfüllen.</span>
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}
