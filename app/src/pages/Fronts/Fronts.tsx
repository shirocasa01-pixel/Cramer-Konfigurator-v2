import { useEffect } from 'react'
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
  aussenmassOptionen,
  deriveDimensions,
  isSondertiefeDepth,
  resolveHeightCm,
  resolveKorpusBreiteCm,
} from '../../lib/korpusMass'
import {
  aufteilungenFuerEntwurf,
  korpusBreitenCm,
  schiebetuerAufteilungen,
  schiebetuerHoeheProblem,
  tuerfelderText,
  vorgeschlageneAnzahl,
} from '../../lib/schiebetuer'
import { korpusOffsetMm, rasterFuerHoehe } from '../../lib/raster'
import { formatDimensions } from '../../lib/massFormat'
import { KLEIDERSCHRANK_GROUP_ID, getAvailableFrontTypes } from '../../config/frontCatalog'
import type { SegmentMasse } from '../../config/equipment'
import { getFrontsIssuesFuerEntwurf, isFrontsCompleteFuerEntwurf } from '../../lib/frontsValidation'
import {
  ebenenDerSpalte,
  entwurfsGeometrie,
  maxFronthoeheMm,
  maxFrontRaster,
  mmText,
  normalisiereFrontenFuerEntwurf,
  resthoeheBisOberkante,
  setzeFrontbreite,
  standardbreiteNeuerFront,
  vorgegebenerTuerAnschlag,
  type SegmentGeometrie,
} from '../../lib/frontGeometrie'
import type { FrontKartenGeometrie } from '../../components/fronts/FrontElementCard'
import {
  canAddFrontType,
  copyableFrontValues,
  eligibleEquipmentFrontTypes,
  hasZweilaeufigeSchiebetuer,
  isColumnEquipmentEligible,
  makeElement,
  SCHIEBETUER_MAX_CM,
  SCHIEBETUER_MAX_DECOBOARD_XP_CM,
  SCHIEBETUER_MIN_CM,
  ZWEILAEUFIG_TYPE_ID,
} from '../../lib/frontsHelpers'
import type { FrontColumn, FrontElement, FrontsData, SegmentEquipmentItem } from '../../types'
import { AbschnittKopf } from '../../components/schema/AbschnittKopf'
import { Beschriftung, BeschriftungsGruppe, fuelle, useTexte } from '../../components/schema/Beschriftung'
import { Inspector } from '../../components/schema/Inspector'
import { SchemaAbschnittFelder } from '../../components/schema/SchemaAbschnittFelder'
import styles from './Fronts.module.css'

/*
  Die Positionstexte einer Front-Spalte. Sie stehen als Konstanten, weil sie sowohl
  angezeigt als auch im Bearbeitungsdialog als Standard gebraucht werden — und weil
  „Front-Typ {n}" mit Platzhalter geschrieben ist, damit die Nummer nicht in den Text
  wandert und dort irgendwann falsch steht.
*/
const SPALTE_TITEL = 'Front-Typ {n}'
const SPALTE_LINKS = 'ganz links'
const SPALTE_RECHTS = 'ganz rechts'
const SPALTE_MITTE = 'Segment {n}'
const SPALTE_LEER = 'Noch keine Front-Bauteile – unten hinzufügen (von unten nach oben).'

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
  const t = useTexte('fronten')

  /*
    Überarbeitung 9: Was aus der Geometrie FOLGT — Höhe „bis Korpusoberkante", erkannte
    Rasterzahl, Anschlag eines Türpaars — steht nicht nur auf dem Bildschirm, sondern im
    Entwurf; Zusammenfassung, AV-PDF und Kalkulation lesen es von dort. Ändert sich ein
    Nachbar oder der Korpus, zieht dieser Effekt die abgeleiteten Werte nach.
  */
  useEffect(() => {
    if (!draft?.fronts) return
    const normal = normalisiereFrontenFuerEntwurf(draft)
    if (normal !== draft.fronts) {
      updateDraft({ fronts: normal })
      return
    }
    // Überarbeitung 10: Mit einer zweiläufigen Schiebetür sind die Abschlusssets 20 mm stark —
    // das Außenmaß im Entwurf folgt, sobald sie hinzukommt oder wieder entfällt.
    const g = draft.korpusGrunddaten
    if (g) {
      const breite = deriveDimensions(g, aussenmassOptionen(draft)).widthCm
      if (draft.dimensions && breite !== draft.dimensions.widthCm) {
        updateDraft({ dimensions: { ...draft.dimensions, widthCm: breite } })
      }
    }
  }, [draft, updateDraft])

  if (!draft) return <Navigate to="/" replace />
  const group = getProductGroup(draft.productGroupId)
  const series = getSeries(draft.productGroupId, draft.seriesId)
  if (!group || !series) return <Navigate to="/products" replace />
  if (!isDimensionsValid(draft.dimensions)) return <Navigate to="/dimensions" replace />
  if (!isKorpusComplete(draft.korpus, getVisibleKorpusAreas(series, draft.korpusMode))) return <Navigate to="/korpus" replace />
  if (!draft.fronts || draft.fronts.columns.length === 0) return <Navigate to="/dimensions" replace />

  const fronts: FrontsData = draft.fronts
  // Überarbeitung 9: Breite, Höhe und Anschlag hängen am Korpus des Segments.
  const geometrie: Array<SegmentGeometrie | undefined> = entwurfsGeometrie(draft)
  // Seit Überarbeitung 10 mit den Regeln der zweiläufigen Schiebetür (Höhe, Abschlusssets,
  // Türfelder) — dieselbe Prüfung wie in Zusammenfassung und Übersicht.
  const issues = getFrontsIssuesFuerEntwurf(draft)
  const complete = isFrontsCompleteFuerEntwurf(draft)
  const isRefugium = series.id === 'refugium'
  const sondertiefe = isSondertiefeDepth(draft)
  const hasZwei = hasZweilaeufigeSchiebetuer(fronts)
  const grunddaten = draft.korpusGrunddaten
  // Überarbeitung 10: Die Türanzahl folgt aus der Korpus-Einteilung (Türfelder aus einem oder
  // zwei Korpi gleicher Gesamtbreite), die Türbreite aus den Korpus-Nennbreiten.
  const anzahlPruefung = aufteilungenFuerEntwurf(draft)
  const schiebetuerHoehe = schiebetuerHoeheProblem(grunddaten)

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
      const spalte = stand.columns[spaltenIndex]
      const breite = standardbreiteNeuerFront(spalte, typeId, entwurfsGeometrie(aktuell)[spaltenIndex])
      const neu = makeElement(typeId, stand, breite)
      const columns = stand.columns.map((col) =>
        col.id === columnId ? { ...col, geometrieHinweis: undefined, elements: [...col.elements, neu] } : col,
      )
      const next: FrontsData = { ...stand, columns }
      if (typeId !== ZWEILAEUFIG_TYPE_ID) return { fronts: next }
      // Zweiläufige Schiebetür: Türanzahl vorbelegen (erste zulässige Einteilung) und —
      // Überarbeitung 10 — die Abschlusssets auf „links & rechts" stellen; das Material bleibt.
      if (!stand.schiebetuerAnzahl) {
        next.schiebetuerAnzahl = vorgeschlageneAnzahl(schiebetuerAufteilungen(korpusBreitenCm(aktuell.korpusGrunddaten)))
      }
      const g = aktuell.korpusGrunddaten
      if (!g || g.abschlussSet?.position === 'beide') return { fronts: next }
      return {
        fronts: next,
        korpusGrunddaten: { ...g, abschlussSet: { ...(g.abschlussSet ?? {}), position: 'beide' } },
      }
    })
  }
  function removeElement(columnId: string, elementId: string) {
    const columns = fronts.columns.map((col) =>
      col.id === columnId
        ? { ...col, geometrieHinweis: undefined, elements: col.elements.filter((el) => el.id !== elementId) }
        : col,
    )
    const stillHasZwei = columns.some((col) => col.elements.some((el) => el.typeId === ZWEILAEUFIG_TYPE_ID))
    updateFronts({ columns, schiebetuerAnzahl: stillHasZwei ? fronts.schiebetuerAnzahl : undefined })
  }
  function updateElement(columnId: string, elementId: string, patch: Partial<FrontElement>) {
    updateFronts({
      columns: fronts.columns.map((col, index) => {
        if (col.id !== columnId) return col
        // Überarbeitung 9: Eine neue Breite gleicht den Nachbarn derselben Ebene an
        // (100er Korpus: D1 59 → D2 39) — die Regel steht in `setzeFrontbreite`.
        const { widthCm, ...rest } = patch
        const basis = widthCm !== undefined ? setzeFrontbreite(col, elementId, widthCm, geometrie[index]) : col
        return {
          ...basis,
          geometrieHinweis: undefined,
          elements: basis.elements.map((el) => (el.id === elementId ? { ...el, ...rest } : el)),
        }
      }),
    })
  }

  /** Was die Karte einer Front aus der Geometrie ihres Segments wissen muss. */
  function kartenGeometrie(column: FrontColumn, element: FrontElement, index: number): FrontKartenGeometrie {
    const geo = geometrie[index]
    const maxHoehe = maxFronthoeheMm(column, element.id, geo)
    const ebene = geo ? ebenenDerSpalte(column, geo).find((e) => e.elemente.some((el) => el.id === element.id)) : undefined
    const nachbarn = (ebene?.elemente.length ?? 1) - 1
    return {
      resthoehe: element.hoeheModus === 'korpusoberkante' ? resthoeheBisOberkante(column, element.id, geo) : undefined,
      maxRaster: maxFrontRaster(column, element.id, geo),
      maxHoeheCm: maxHoehe != null ? Number(mmText(maxHoehe).replace(',', '.')) : undefined,
      korpusRaster: geo?.korpusRaster,
      anschlagVorgabe: vorgegebenerTuerAnschlag(column, element.id, geo),
      breitenHinweis: geo
        ? `Frontbereich ${mmText(geo.frontbereichMm)} cm${nachbarn === 1 ? ' — die Front daneben passt sich automatisch an' : ''}`
        : undefined,
    }
  }
  function updateColumnEquipment(columnId: string, items: SegmentEquipmentItem[]) {
    updateFronts({
      columns: fronts.columns.map((col) => (col.id === columnId ? { ...col, equipment: items } : col)),
    })
  }

  // Phase A – „Werte übernehmen": die erste konfigurierte Front (über alle Segmente) ist die Referenz.
  const firstElement = fronts.columns.flatMap((col) => col.elements)[0]
  function applyCopyFromFirst(columnId: string, elementId: string) {
    const ziel = fronts.columns.find((col) => col.id === columnId)?.elements.find((el) => el.id === elementId)
    if (firstElement) updateElement(columnId, elementId, copyableFrontValues(firstElement, ziel?.typeId))
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
          <AbschnittKopf
            abschnittId="fronten"
            standardTitel="Fronten & Abschlüsse"
            titelKlasse={styles.title}
            textKlasse={styles.subtitle}
          />
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
              volle Schrankhöhe und deckt Abschlusssets und Innenkorpus von vorne ab.
            </span>
          </section>
        ) : null}

        {/*
          Überarbeitung 10, S. 2–4: Die Korpus-Einteilung muss symmetrisch sein — je Tür ein
          Türfeld aus einem Korpus (Tür 80–100 cm) oder aus zwei Korpi gleicher Gesamtbreite
          (Tür bis 150 cm). Nur Anzahlen, für die es eine solche Einteilung gibt, sind wählbar.
        */}
        {hasZwei ? (
          <section className={styles.anzahl} aria-label="Anzahl Schiebetüren">
            <span className={styles.anzahlLabel}>Anzahl Schiebetüren (ganzer Schrank)</span>
            <div className={styles.chips} role="group">
              {anzahlPruefung.map((p) => {
                const aktiv = fronts.schiebetuerAnzahl === p.anzahl
                return (
                  <button
                    key={p.anzahl}
                    type="button"
                    className={aktiv ? styles.chipActive : styles.chip}
                    onClick={() => updateFronts({ schiebetuerAnzahl: p.anzahl })}
                    aria-pressed={aktiv}
                    disabled={p.felder.length === 0 && !aktiv}
                    title={p.gruende.join(' ') || undefined}
                  >
                    {p.anzahl} Schiebetüren
                    {p.tuerbreiteCm > 0 ? (
                      <span className={styles.chipSub}>
                        {String(p.tuerbreiteCm).replace('.', ',')}er · {p.zulaessig ? tuerfelderText(p.felder) : 'nicht zulässig'}
                      </span>
                    ) : (
                      <span className={styles.chipSub}>passt nicht zur Korpus-Einteilung</span>
                    )}
                  </button>
                )
              })}
            </div>
            <span className={styles.anzahlHint}>
              Je Schiebetür ein Türfeld: ein Korpus (Tür {SCHIEBETUER_MIN_CM}–100 cm) oder zwei Korpi, die zusammen so
              breit sind wie die übrigen Felder (Tür bis {SCHIEBETUER_MAX_CM} cm, in Decoboard und Xtreme Plus bis{' '}
              {SCHIEBETUER_MAX_DECOBOARD_XP_CM} cm). Ein Korpus ohne Mittelseite ist höchstens 100 cm breit.
            </span>
            {schiebetuerHoehe ? (
              <span className={styles.anzahlWarn} role="alert">
                {schiebetuerHoehe}
              </span>
            ) : null}
            {anzahlPruefung
              .filter((p) => p.anzahl === fronts.schiebetuerAnzahl && p.felder.length > 0 && !p.zulaessig)
              .map((p) => (
                <span key={p.anzahl} className={styles.anzahlWarn} role="alert">
                  {p.gruende.join(' ')}
                </span>
              ))}
            {anzahlPruefung.every((p) => p.felder.length === 0) ? (
              <span className={styles.anzahlWarn} role="alert">
                Die Korpi lassen sich in keine 2, 3 oder 4 gleich breiten Türfelder teilen. Bitte im Schritt
                „Maße" die Korpusbreiten symmetrisch planen (z. B. 2 × 100er für 2 Türen, 3 × 100er für 3 Türen).
              </span>
            ) : null}
          </section>
        ) : null}

        {fronts.columns.map((column, index) => (
          <section key={column.id} className={styles.column} aria-label={`Front-Typ ${index + 1}`}>
            <div className={styles.columnHead}>
              <h2 className={styles.columnTitle}>
                {fuelle(t('spalte.titel', SPALTE_TITEL), { n: String(index + 1) })}
                {index === 0 ? (
                  <BeschriftungsGruppe
                    abschnittId="fronten"
                    titel="Positionstexte der Front-Spalten"
                    eintraege={[
                      {
                        schluessel: 'spalte.titel',
                        standard: SPALTE_TITEL,
                        label: 'Überschrift je Spalte',
                        hinweis: 'Platzhalter: {n} — die Nummer der Spalte von links.',
                      },
                      { schluessel: 'spalte.links', standard: SPALTE_LINKS, label: 'Erste Spalte' },
                      { schluessel: 'spalte.rechts', standard: SPALTE_RECHTS, label: 'Letzte Spalte' },
                      {
                        schluessel: 'spalte.mitte',
                        standard: SPALTE_MITTE,
                        label: 'Spalten dazwischen',
                        hinweis: 'Platzhalter: {n}',
                      },
                      {
                        schluessel: 'spalte.leer',
                        standard: SPALTE_LEER,
                        label: 'Text ohne Front-Bauteile',
                        mehrzeilig: true,
                      },
                    ]}
                  />
                ) : null}
              </h2>
              <span className={styles.columnPos}>
                {index === 0
                  ? t('spalte.links', SPALTE_LINKS)
                  : index === fronts.columns.length - 1
                    ? t('spalte.rechts', SPALTE_RECHTS)
                    : fuelle(t('spalte.mitte', SPALTE_MITTE), { n: String(index + 1) })}
              </span>
            </div>

            {column.geometrieHinweis ? (
              <p className={styles.geometrieHinweis} role="alert">
                {column.geometrieHinweis}
              </p>
            ) : null}

            {column.elements.length === 0 ? (
              <p className={styles.empty}>{t('spalte.leer', SPALTE_LEER)}</p>
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
                      geometrie={kartenGeometrie(column, element, index)}
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
                  // Überarbeitung 10: zweiläufige Schiebetür nur bei 18 bis 21 Raster Korpushöhe.
                  const hoeheSperrt = type.id === ZWEILAEUFIG_TYPE_ID && Boolean(schiebetuerHoehe)
                  const disabled = !canAddFrontType(fronts, type.id) || hoeheSperrt
                  return (
                    <span key={type.id} className={styles.addSlot}>
                      <button
                        type="button"
                        className={styles.addBtn}
                        disabled={disabled}
                        title={
                          hoeheSperrt
                            ? schiebetuerHoehe
                            : disabled && type.id === ZWEILAEUFIG_TYPE_ID
                              ? 'Nur möglich, wenn noch keine andere Front geplant ist.'
                              : undefined
                        }
                        onClick={() => addElement(column.id, type.id)}
                      >
                        + {t(`typ.${type.id}`, type.label)}
                      </button>
                      {index === 0 ? <Inspector feld={`fronten.typ.${type.id}`} /> : null}
                    </span>
                  )
                })}
                {index === 0 ? (
                  <BeschriftungsGruppe
                    abschnittId="fronten"
                    titel="Front-Typen benennen"
                    eintraege={availableTypes.map((ty) => ({
                      schluessel: `typ.${ty.id}`,
                      standard: ty.label,
                      label: `Front-Typ „${ty.id}"`,
                    }))}
                  />
                ) : null}
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
            <Beschriftung
              abschnittId="fronten"
              schluessel="ergaenzend.titel"
              standard="Ergänzende Komponenten"
              as="h2"
              className={styles.sectionTitle}
            />
            <FinishesSection
              grifffarbe={fronts.grifffarbe}
              abschlussOben={fronts.abschlussOben}
              abschlussUnten={fronts.abschlussUnten}
              onChange={(patch) => updateFronts(patch)}
            />
          </section>
        )}

        <section className={styles.extra} aria-label="Sonderausstattung">
          <Beschriftung
            abschnittId="fronten"
            schluessel="sonderausstattung.titel"
            standard="Sonderausstattung"
            as="h2"
            className={styles.sectionTitle}
          />
          <Textarea
            label={t('sonderausstattung.label', 'Notizen / Sonderkonstruktionen')}
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
