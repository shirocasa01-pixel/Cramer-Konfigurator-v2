import { Navigate, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { StepIndicator } from '../../components/layout/StepIndicator'
import { Button } from '../../components/ui/Button'
import { MaterialSelect } from '../../components/material/MaterialSelect'
import { TextField } from '../../components/ui/TextField'
import { KorpusInnenSection } from '../../components/korpus/KorpusInnenSection'
import { useDraft } from '../../context/DraftContext'
import { getProductGroup, getSeries } from '../../config/productCatalog'
import {
  ABSCHLUSSSET_GROUPS,
  KORPUS_INNEN_SICHTBAR,
  getVisibleKorpusAreas,
  rueckwandAussenArea,
  type KorpusMode,
} from '../../config/korpus'
import { getRauchglasOptionIds } from '../../config/materialMatrix'
import { isKorpusComplete } from '../../lib/korpusValidation'
import { isDimensionsValid } from '../../lib/dimensionsValidation'
import { isKorpusGrunddatenComplete, resolveKorpusBreiteCm } from '../../lib/korpusMass'
import type { KorpusInnen, MaterialSelection } from '../../types'
import { abschnittTexte } from '../../lib/schemaStore'
import { SchemaAbschnittFelder } from '../../components/schema/SchemaAbschnittFelder'
import styles from './Korpus.module.css'

/**
 * SCHRITT 4 – Material.
 *
 * Der Schritt hieß bis zur Rückmeldung „Überarbeitung 2" (S. 4) „Korpus". Seit die
 * Maße davor abgefragt werden und der Innenausbau-Block entfallen ist, liegen hier
 * ausschließlich Materialauswahlen — der Name folgt jetzt dem Inhalt.
 *
 * Bereiche: Innen (bedingt: Velare/Refugium) · Außen · Abdeckplatte · Rückwand außen ·
 * Abschlussset. Alle Dropdowns stammen aus der zentralen Farbmatrix; die Preisgruppe
 * wird automatisch im Hintergrund zugewiesen. Erzwungene Progression: sichtbare
 * Bereiche sind Pflicht.
 */
export default function KorpusPage() {
  const { draft, updateDraft } = useDraft()
  const navigate = useNavigate()

  const texte = abschnittTexte('material', { titel: 'Material' })

  if (!draft) return <Navigate to="/" replace />
  const group = getProductGroup(draft.productGroupId)
  const series = getSeries(draft.productGroupId, draft.seriesId)
  if (!group || !series) return <Navigate to="/products" replace />
  // Die Maße kommen jetzt vorher – ohne sie ist nicht bekannt, wie viele Korpi es gibt.
  const masseVollstaendig = series.korpusRaster
    ? isKorpusGrunddatenComplete(draft.korpusGrunddaten)
    : isDimensionsValid(draft.dimensions)
  if (!masseVollstaendig) return <Navigate to="/dimensions" replace />

  const korpus = draft.korpus
  // Punkt 4c: Bei Serien ohne Außenkorpus-Modus gilt immer „komplett" – auch wenn ein
  // älterer Entwurf noch „getrennt" gespeichert hat.
  const zeigeModusUmschalter = series.hasAussenkorpusModus !== false
  const mode: KorpusMode = zeigeModusUmschalter ? draft.korpusMode ?? 'komplett' : 'komplett'
  const visibleAreas = getVisibleKorpusAreas(series, mode)
  const complete = isKorpusComplete(korpus, visibleAreas)
  // Punkt 5.3: Die Korpus-Liste stammt aus dem Schritt „Maße", der jetzt davor liegt.
  const korpusse = draft.korpusGrunddaten?.korpusse ?? []
  const innenJeKorpus = draft.korpusInnenJeKorpus != null && korpusse.length > 1
  const abschlussSet = draft.korpusGrunddaten?.abschlussSet
  const abschlussAktiv = abschlussSet != null && abschlussSet.position !== 'keine'
  const abschlussBeidseitig = abschlussSet?.position === 'beide'

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
  // Abschlussset-Material („Überarbeitung 2", S. 3/4): Die Position steht in den
  // Grunddaten aus dem Schritt „Maße", das Material gehört hierher zu den übrigen
  // Materialien.
  function patchAbschlussSet(patch: Partial<NonNullable<typeof abschlussSet>>) {
    if (!draft?.korpusGrunddaten || !abschlussSet) return
    updateDraft({
      korpusGrunddaten: {
        ...draft.korpusGrunddaten,
        abschlussSet: { ...abschlussSet, ...patch },
      },
    })
  }

  function handleContinue() {
    // Nach dem Tausch der Schritte folgt auf den Korpus die Ausstattung (Refugium)
    // bzw. direkt die Fronten.
    if (complete) navigate(series?.korpusRaster ? '/ausstattung' : '/fronts')
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <StepIndicator activeKey="korpus" />

        <header className={styles.header}>
          <h1 className={styles.title}>{texte.titel}</h1>
          {texte.beschreibung ? <p className={styles.subtitle}>{texte.beschreibung}</p> : null}
          <p className={styles.context}>
            {group.name} · Serie {series.name}
          </p>
        </header>

        {zeigeModusUmschalter ? (
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
        ) : null}

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
                  excludeOptionIds={isAbdeckplatte ? getRauchglasOptionIds() : undefined}
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

        {/* Abschlussset-Material – Position kommt aus dem Schritt „Maße". */}
        {abschlussAktiv ? (
          <section className={styles.area} aria-label="Abschlussset">
            <div className={styles.areaHead}>
              <h2 className={styles.areaTitle}>Abschlussset (Außenabschluss links/rechts)</h2>
              <span className={styles.areaHint}>
                {abschlussSet?.position === 'beide'
                  ? 'links & rechts'
                  : abschlussSet?.position === 'links'
                    ? 'nur links'
                    : 'nur rechts'}{' '}
                · 10 mm · Glas ist hier nicht möglich
              </span>
            </div>

            {abschlussBeidseitig && abschlussSet?.materialGetrennt ? (
              <div className={styles.korpusListe}>
                <div className={styles.korpusEintrag}>
                  <span className={styles.korpusName}>Abschlussset links</span>
                  <MaterialSelect
                    groupIds={ABSCHLUSSSET_GROUPS}
                    allowCustom
                    value={abschlussSet.materialLinks ?? abschlussSet.material}
                    onChange={(next) => patchAbschlussSet({ materialLinks: next })}
                  />
                </div>
                <div className={styles.korpusEintrag}>
                  <span className={styles.korpusName}>Abschlussset rechts</span>
                  <MaterialSelect
                    groupIds={ABSCHLUSSSET_GROUPS}
                    allowCustom
                    value={abschlussSet.materialRechts ?? abschlussSet.material}
                    onChange={(next) => patchAbschlussSet({ materialRechts: next })}
                  />
                </div>
              </div>
            ) : (
              <MaterialSelect
                groupIds={ABSCHLUSSSET_GROUPS}
                allowCustom
                value={abschlussSet?.material}
                onChange={(next) => patchAbschlussSet({ material: next })}
              />
            )}

            {abschlussBeidseitig ? (
              <label className={styles.check}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={Boolean(abschlussSet?.materialGetrennt)}
                  onChange={(event) => patchAbschlussSet({ materialGetrennt: event.target.checked })}
                />
                Material für Abschlussset links und rechts getrennt wählen
              </label>
            ) : null}
          </section>
        ) : null}

        {/* Punkt 5: Innenausbau-Block abgeschaltet – Begründung in `config/korpus.ts`.
            Komponente und Datenstruktur bleiben erhalten. */}
        {KORPUS_INNEN_SICHTBAR ? (
          <KorpusInnenSection value={draft.korpusInnen} onChange={updateKorpusInnen} />
        ) : null}

        <SchemaAbschnittFelder abschnittId="material" />

        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => navigate('/dimensions')}>
            Zurück
          </Button>
          <Button onClick={handleContinue} disabled={!complete}>
            {series?.korpusRaster ? 'Weiter zur Ausstattung' : 'Weiter zu den Fronten'}
          </Button>
          {!complete ? (
            <span className={styles.hint}>Bitte alle Korpus-Bereiche vollständig ausfüllen.</span>
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}
