import { Navigate, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { StepIndicator } from '../../components/layout/StepIndicator'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Textarea'
import { FrontElementCard } from '../../components/fronts/FrontElementCard'
import { FinishesSection } from '../../components/fronts/FinishesSection'
import { AusstattungHinterFrontSection } from '../../components/fronts/AusstattungHinterFrontSection'
import { useDraft } from '../../context/DraftContext'
import { getProductGroup, getSeries } from '../../config/productCatalog'
import { getVisibleKorpusAreas } from '../../config/korpus'
import { isKorpusComplete } from '../../lib/korpusValidation'
import { isDimensionsValid } from '../../lib/dimensionsValidation'
import {
  berechneAussenmass,
  isSondertiefeDepth,
  resolveHeightCm,
  resolveKorpusBreiteCm,
} from '../../lib/korpusMass'
import { frontAufteilung, mmZuCm } from '../../lib/frontbreiten'
import { korpusOffsetMm, rasterFuerHoehe } from '../../lib/raster'
import { formatDimensions } from '../../lib/massFormat'
import { KLEIDERSCHRANK_GROUP_ID, getAvailableFrontTypes } from '../../config/frontCatalog'
import type { SegmentMasse } from '../../config/equipment'
import { getFrontsIssues, isFrontsComplete } from '../../lib/frontsValidation'
import {
  canAddFrontType,
  copyableFrontValues,
  eligibleEquipmentFrontTypes,
  hasZweilaeufigeSchiebetuer,
  isColumnEquipmentEligible,
  makeElement,
  restRasterBisKorpusoberkante,
  pruefeSchiebetuerAnzahl,
  schiebetuerAnzahlOptions,
  SCHIEBETUER_MAX_CM,
  SCHIEBETUER_MAX_DECOBOARD_XP_CM,
  SCHIEBETUER_MIN_CM,
  ZWEILAEUFIG_TYPE_ID,
} from '../../lib/frontsHelpers'
import type { FrontColumn, FrontElement, FrontsData, SegmentEquipmentItem } from '../../types'
import { abschnittTexte } from '../../lib/schemaStore'
import { SchemaAbschnittFelder } from '../../components/schema/SchemaAbschnittFelder'
import styles from './Fronts.module.css'

/**
 * SCHRITT 7 – Fronten & Abschlüsse (Spalten-/Segment-Architektur).
 * Je Korpus-Segment eine Front-Typ-Spalte (von links nach rechts); Front-Bauteile
 * werden je Segment von unten nach oben angegeben. Regeln: zweiläufige Schiebetür ist
 * exklusiv (keine weiteren Fronten), Curve/Glossy/Less/Line-Materialregeln & Griff-
 * Ausschlüsse greifen in der Element-Card. SCHRITT 8: „Ausstattung hinter Fronten"
 * je eligiblem Segment – nur die in Schritt 6 vorausgewählten Optionen.
 */
export default function FrontsPage() {
  const { draft, updateDraft, updateDraftFrom } = useDraft()
  const navigate = useNavigate()

  const texte = abschnittTexte('fronten', { titel: 'Fronten & Abschlüsse' })

  if (!draft) return <Navigate to="/" replace />
  const group = getProductGroup(draft.productGroupId)
  const series = getSeries(draft.productGroupId, draft.seriesId)
  if (!group || !series) return <Navigate to="/products" replace />
  if (!isDimensionsValid(draft.dimensions)) return <Navigate to="/dimensions" replace />
  if (!isKorpusComplete(draft.korpus, getVisibleKorpusAreas(series, draft.korpusMode))) return <Navigate to="/korpus" replace />
  if (!draft.fronts || draft.fronts.columns.length === 0) return <Navigate to="/dimensions" replace />

  const fronts: FrontsData = draft.fronts
  const issues = getFrontsIssues(fronts)
  const complete = isFrontsComplete(fronts)
  const isRefugium = series.id === 'refugium'
  const sondertiefe = isSondertiefeDepth(draft)
  const hasZwei = hasZweilaeufigeSchiebetuer(fronts)
  const anzahlOptions = schiebetuerAnzahlOptions(fronts.columns.length)
  // Punkt 7.5: Die Frontbreite wird aus der Korpusbreite abgeleitet, damit der
  // Verkäufer sie nicht schätzen muss. Punkt 7.7 prüft die Schiebetür-Anzahl
  // gegen die zulässige Türbreite.
  const grunddaten = draft.korpusGrunddaten
  const frontbreiteFuerSpalte = (index: number): number | undefined => {
    const korpus = grunddaten?.korpusse[index]
    if (!korpus) return undefined
    const aufteilung = frontAufteilung(resolveKorpusBreiteCm(korpus))
    return aufteilung ? mmZuCm(aufteilung.frontMm) : undefined
  }
  const aussenbreiteCm = grunddaten ? berechneAussenmass(grunddaten).gesamtbreiteCm : undefined
  const anzahlPruefung = pruefeSchiebetuerAnzahl(aussenbreiteCm, anzahlOptions)

  /**
   * Überarbeitung 3 („Höhe bis Korpusoberkante"): Rasterstufe des Korpus. Sie ist die
   * Obergrenze, von der die übrigen Fronten des Segments abgezogen werden — und seit
   * Überarbeitung 2_2 auch die Obergrenze der Einbauhöhen in der Ausstattung.
   */
  const korpusRaster: number | undefined = (() => {
    if (!grunddaten) return undefined
    if (grunddaten.heightMode === '18R') return 18
    if (grunddaten.heightMode === '21R') return 21
    const hoehe = resolveHeightCm(grunddaten)
    const offset = korpusOffsetMm(series.id)
    return hoehe != null && offset != null ? rasterFuerHoehe(hoehe, offset) : undefined
  })()

  /**
   * Maße eines Segments für die Ausstattungs-Regeln (Überarbeitung 2_2): Die
   * Korpus-Nennbreite entscheidet über Rollkorb und Kleiderlift, die schmalste Front über
   * den Innenspiegel, das Korpusraster über die wählbaren Einbauhöhen.
   */
  function segmentMasse(index: number, column: FrontColumn): SegmentMasse {
    const korpus = grunddaten?.korpusse[index]
    const frontBreiten = column.elements
      .map((el) => Number((el.widthCm ?? '').replace(',', '.')))
      .filter((n) => Number.isFinite(n) && n > 0)
    return {
      korpusBreiteCm: korpus ? resolveKorpusBreiteCm(korpus) : undefined,
      frontBreiteCm: frontBreiten.length ? Math.min(...frontBreiten) : undefined,
      korpusRaster,
    }
  }

  function updateFronts(patch: Partial<FrontsData>) {
    updateDraft({ fronts: { ...fronts, ...patch } })
  }
  function addElement(columnId: string, typeId: string) {
    // Aus dem aktuellen Entwurf gerechnet, damit zwei schnelle Klicks nicht beide
    // dieselbe Kennzeichnung vergeben (Punkt 7.4: eindeutig über das ganze Möbel).
    updateDraftFrom((aktuell) => {
      const stand = aktuell.fronts ?? { columns: [] }
      if (!canAddFrontType(stand, typeId)) return {}
      const spaltenIndex = stand.columns.findIndex((col) => col.id === columnId)
      if (spaltenIndex < 0) return {}
      const neu = makeElement(typeId, stand, frontbreiteFuerSpalte(spaltenIndex))
      const columns = stand.columns.map((col) =>
        col.id === columnId ? { ...col, elements: [...col.elements, neu] } : col,
      )
      const next: FrontsData = { ...stand, columns }
      // Zweiläufige Schiebetür: Anzahl-Schiebetüren vorbelegen (erste zulässige Option).
      if (typeId === ZWEILAEUFIG_TYPE_ID && !stand.schiebetuerAnzahl) {
        next.schiebetuerAnzahl = schiebetuerAnzahlOptions(stand.columns.length)[0]
      }
      return { fronts: next }
    })
  }
  function removeElement(columnId: string, elementId: string) {
    const columns = fronts.columns.map((col) =>
      col.id === columnId ? { ...col, elements: col.elements.filter((el) => el.id !== elementId) } : col,
    )
    const stillHasZwei = columns.some((col) => col.elements.some((el) => el.typeId === ZWEILAEUFIG_TYPE_ID))
    updateFronts({ columns, schiebetuerAnzahl: stillHasZwei ? fronts.schiebetuerAnzahl : undefined })
  }
  function updateElement(columnId: string, elementId: string, patch: Partial<FrontElement>) {
    updateFronts({
      columns: fronts.columns.map((col) =>
        col.id === columnId
          ? { ...col, elements: col.elements.map((el) => (el.id === elementId ? { ...el, ...patch } : el)) }
          : col,
      ),
    })
  }
  function updateColumnEquipment(columnId: string, items: SegmentEquipmentItem[]) {
    updateFronts({
      columns: fronts.columns.map((col) => (col.id === columnId ? { ...col, equipment: items } : col)),
    })
  }

  // Phase A – „Werte übernehmen": die erste konfigurierte Front (über alle Segmente) ist die Referenz.
  const firstElement = fronts.columns.flatMap((col) => col.elements)[0]
  function applyCopyFromFirst(columnId: string, elementId: string) {
    if (firstElement) updateElement(columnId, elementId, copyableFrontValues(firstElement))
  }

  function handleContinue() {
    if (complete) navigate('/summary')
  }

  const dim = draft.dimensions
  const istKleiderschrank = group.id === KLEIDERSCHRANK_GROUP_ID
  const availableTypes = getAvailableFrontTypes(series.id, group.id)
  const selectedEquipment = draft.ausstattung?.selected ?? []

  return (
    <AppShell>
      <div className={styles.page}>
        <StepIndicator activeKey="fronten" />

        <header className={styles.header}>
          <h1 className={styles.title}>{texte.titel}</h1>
          <p className={styles.subtitle}>
            {texte.beschreibung}
          </p>
          <p className={styles.context}>
            {group.name} · Serie {series.name} · {formatDimensions(dim)} ·{' '}
            {fronts.columns.length} Segmente
          </p>
        </header>

        {hasZwei ? (
          <section className={styles.exclusiveBanner} aria-label="Zweiläufige Schiebetür">
            <span className={styles.exclusiveTitle}>Zweiläufige Schiebetür geplant (exklusiv)</span>
            <span>
              Für diesen Schrank sind keine weiteren Fronten möglich. Die Schiebetür geht immer über die
              volle Schrankhöhe; die genaue Türbreite ergibt sich aus der technischen Umsetzung in der AV.
            </span>
          </section>
        ) : null}

        {hasZwei ? (
          <section className={styles.anzahl} aria-label="Anzahl Schiebetüren">
            <span className={styles.anzahlLabel}>Anzahl Schiebetüren (ganzer Schrank)</span>
            <div className={styles.chips} role="group">
              {anzahlPruefung.map((p) => (
                <button
                  key={p.anzahl}
                  type="button"
                  className={fronts.schiebetuerAnzahl === p.anzahl ? styles.chipActive : styles.chip}
                  onClick={() => updateFronts({ schiebetuerAnzahl: p.anzahl as 2 | 3 | 4 })}
                  aria-pressed={fronts.schiebetuerAnzahl === p.anzahl}
                >
                  {p.anzahl} Schiebetüren
                  {p.tuerbreiteCm > 0 ? <span className={styles.chipSub}>≈ {p.tuerbreiteCm} cm je Tür</span> : null}
                </button>
              ))}
            </div>
            <span className={styles.anzahlHint}>
              {fronts.columns.length} Korpi →{' '}
              {anzahlOptions.length === 1
                ? `immer ${anzahlOptions[0]} Schiebetüren notwendig.`
                : `${anzahlOptions.join(' oder ')} Schiebetüren – je nach Schranklänge.`}{' '}
              Eine Schiebetür muss zwischen {SCHIEBETUER_MIN_CM} und {SCHIEBETUER_MAX_CM} cm breit sein
              (Decoboard und Xtreme Plus bis {SCHIEBETUER_MAX_DECOBOARD_XP_CM} cm).
            </span>
            {anzahlPruefung.some((p) => !p.zulaessig && p.tuerbreiteCm > 0) ? (
              <span className={styles.anzahlWarn} role="status">
                {anzahlPruefung
                  .filter((p) => !p.zulaessig && p.tuerbreiteCm > 0)
                  .map((p) => `${p.anzahl} Türen ergäben ≈ ${p.tuerbreiteCm} cm je Tür`)
                  .join(' · ')}{' '}
                — außerhalb der zulässigen Türbreite. Bitte mit der AV abstimmen.
              </span>
            ) : null}
          </section>
        ) : null}

        {fronts.columns.map((column, index) => (
          <section key={column.id} className={styles.column} aria-label={`Front-Typ ${index + 1}`}>
            <div className={styles.columnHead}>
              <h2 className={styles.columnTitle}>Front-Typ {index + 1}</h2>
              <span className={styles.columnPos}>
                {index === 0
                  ? 'ganz links'
                  : index === fronts.columns.length - 1
                    ? 'ganz rechts'
                    : `Segment ${index + 1}`}
              </span>
            </div>

            {column.elements.length === 0 ? (
              <p className={styles.empty}>Noch keine Front-Bauteile – unten hinzufügen (von unten nach oben).</p>
            ) : (
              <div className={styles.elements}>
                {column.elements.map((element) => {
                  const canCopy =
                    firstElement != null &&
                    firstElement.id !== element.id &&
                    firstElement.typeId === element.typeId
                  return (
                    <FrontElementCard
                      key={element.id}
                      element={element}
                      onChange={(patch) => updateElement(column.id, element.id, patch)}
                      onRemove={() => removeElement(column.id, element.id)}
                      onCopyValues={canCopy ? () => applyCopyFromFirst(column.id, element.id) : undefined}
                      copyFromLabel="Front 1"
                      restRasterBisOberkante={
                        element.hoeheModus === 'korpusoberkante'
                          ? restRasterBisKorpusoberkante(column, element.id, korpusRaster)
                          : undefined
                      }
                    />
                  )
                })}
              </div>
            )}

            {hasZwei ? (
              <p className={styles.columnHint}>Zweiläufige Schiebetür ist exklusiv – keine weiteren Fronten möglich.</p>
            ) : (
              <div className={styles.addRow}>
                {availableTypes.map((type) => {
                  const disabled = !canAddFrontType(fronts, type.id)
                  return (
                    <button
                      key={type.id}
                      type="button"
                      className={styles.addBtn}
                      disabled={disabled}
                      title={
                        disabled && type.id === ZWEILAEUFIG_TYPE_ID
                          ? 'Nur möglich, wenn noch keine andere Front geplant ist.'
                          : undefined
                      }
                      onClick={() => addElement(column.id, type.id)}
                    >
                      + {type.label}
                    </button>
                  )
                })}
              </div>
            )}

            {isRefugium && isColumnEquipmentEligible(column) ? (
              <AusstattungHinterFrontSection
                eligibleFrontTypes={eligibleEquipmentFrontTypes(column)}
                selectedOptionIds={selectedEquipment}
                sondertiefe={sondertiefe}
                masse={segmentMasse(index, column)}
                equipment={column.equipment}
                onChange={(items) => updateColumnEquipment(column.id, items)}
              />
            ) : null}
          </section>
        ))}

        {/* Überarbeitung 3: „Abfrage ergänzende Komponenten wird bei Kleiderschränken nicht
            benötigt." Die Sonderausstattung (Notizen) darunter bleibt erhalten. */}
        {istKleiderschrank ? null : (
          <section className={styles.extra} aria-label="Ergänzende Komponenten">
            <h2 className={styles.sectionTitle}>Ergänzende Komponenten</h2>
            <FinishesSection
              grifffarbe={fronts.grifffarbe}
              abschlussOben={fronts.abschlussOben}
              abschlussUnten={fronts.abschlussUnten}
              onChange={(patch) => updateFronts(patch)}
            />
          </section>
        )}

        <section className={styles.extra} aria-label="Sonderausstattung">
          <h2 className={styles.sectionTitle}>Sonderausstattung</h2>
          <Textarea
            label="Notizen / Sonderkonstruktionen"
            placeholder="Freie Notizen, Sonderkonstruktionen oder logistische Hinweise – werden unverändert an die AV übergeben."
            value={fronts.sonderausstattung ?? ''}
            onChange={(event) => updateFronts({ sonderausstattung: event.target.value })}
          />
        </section>

        <SchemaAbschnittFelder abschnittId="fronten" />

        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => navigate(isRefugium ? '/ausstattung' : '/korpus')}>
            Zurück
          </Button>
          <Button onClick={handleContinue} disabled={!complete}>
            Weiter zur Zusammenfassung
          </Button>
        </div>
        {!complete ? (
          <ul className={styles.issues}>
            {issues.slice(0, 8).map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </AppShell>
  )
}
