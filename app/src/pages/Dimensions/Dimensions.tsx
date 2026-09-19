import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { StepIndicator } from '../../components/layout/StepIndicator'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { KorpusMasseSection, makeDefaultGrunddaten } from '../../components/korpus/KorpusMasseSection'
import { useDraft } from '../../context/DraftContext'
import { getProductGroup, getSeries } from '../../config/productCatalog'
import {
  MAX_SEGMENTS,
  isDimensionsValid,
  validateDimensions,
  type DimensionsErrors,
} from '../../lib/dimensionsValidation'
import { syncColumns } from '../../lib/frontsHelpers'
import {
  computeKorpusMasse,
  deriveDimensions,
  formatKorpusMass,
  isKorpusGrunddatenComplete,
} from '../../lib/korpusMass'
import type { Draft, KorpusGrunddaten } from '../../types'
import { AbschnittKopf } from '../../components/schema/AbschnittKopf'
import { Beschriftung, fuelle, useTexte } from '../../components/schema/Beschriftung'
import { Inspector } from '../../components/schema/Inspector'
import { SchemaAbschnittFelder } from '../../components/schema/SchemaAbschnittFelder'
import styles from './Dimensions.module.css'

type DimensionsPatch = Partial<NonNullable<Draft['dimensions']>>

/**
 * SCHRITT 4 – Korpus-Maße & Grunddaten.
 * Refugium nutzt das strukturierte Korpus-Maß-Raster (`KorpusGrunddaten`,
 * koordinatenfähig für 2D/3D); alle übrigen Serien behalten die einfache
 * H/B/T-Eingabe mit Segment-Stepper. Die Legacy-`dimensions` werden bei Refugium
 * aus den Grunddaten abgeleitet, damit Fronten/Summary/PDF unverändert laufen.
 */
export default function DimensionsPage() {
  const { draft, updateDraft } = useDraft()
  const navigate = useNavigate()
  const initRef = useRef(false)

  const group = getProductGroup(draft?.productGroupId)
  const series = getSeries(draft?.productGroupId, draft?.seriesId)
  const useRaster = Boolean(series?.korpusRaster)
  const dimensions = draft?.dimensions
  const grunddaten = draft?.korpusGrunddaten

  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const errors: DimensionsErrors = useMemo(() => validateDimensions(dimensions), [dimensions])

  // Refugium: strukturierte Korpus-Grunddaten einmalig initialisieren (Schritt 4).
  useEffect(() => {
    if (useRaster && draft && !draft.korpusGrunddaten && !initRef.current) {
      initRef.current = true
      const g = makeDefaultGrunddaten()
      updateDraft({ korpusGrunddaten: g, dimensions: deriveDimensions(g) })
    }
  }, [useRaster, draft, updateDraft])

  // Beide Masken sind editierbar, aber nicht über denselben Text: Die Raster-Maske
  // (Refugium) nimmt Überschrift und Einleitung des Abschnitts, die Freimaß-Variante
  // eigene Schlüssel — sie beschreibt eine andere Eingabelogik, und ein gemeinsamer Text
  // wäre für eine der beiden immer falsch.
  const t = useTexte('masse')

  if (!draft) return <Navigate to="/" replace />
  if (!group || !series) return <Navigate to="/products" replace />

  const currentFronts = draft.fronts
  const masse = computeKorpusMasse(draft)
  const valid = useRaster ? isKorpusGrunddatenComplete(grunddaten) : isDimensionsValid(dimensions)
  const segments = useRaster ? grunddaten?.korpusse.length ?? 0 : dimensions?.segments ?? 0

  function updateDim(patch: DimensionsPatch) {
    updateDraft({ dimensions: { ...dimensions, ...patch } })
  }
  function updateGrunddaten(next: KorpusGrunddaten) {
    updateDraft({ korpusGrunddaten: next, dimensions: deriveDimensions(next) })
  }
  function markTouched(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }
  function setSegments(next: number) {
    updateDim({ segments: Math.max(1, Math.min(MAX_SEGMENTS, next)) })
    markTouched('segments')
  }

  function handleContinue() {
    if (!useRaster) setTouched({ heightCm: true, widthCm: true, depthCm: true, segments: true })
    if (!valid || segments < 1) return
    updateDraft({ fronts: syncColumns(currentFronts, segments) })
    // Die Maße stehen jetzt VOR dem Korpus – erst dadurch ist bekannt, wie viele Korpi
    // es gibt, und das Material lässt sich je Korpus wählen.
    navigate('/korpus')
  }

  const legacySegments = dimensions?.segments ?? 0

  return (
    <AppShell>
      <div className={styles.page}>
        <StepIndicator activeKey="masse" />

        <header className={styles.header}>
          {useRaster ? (
            <AbschnittKopf
              abschnittId="masse"
              standardTitel="Korpus – Maße & Grunddaten"
              titelKlasse={styles.title}
              textKlasse={styles.subtitle}
            />
          ) : (
            <>
              <Beschriftung
                abschnittId="masse"
                schluessel="freimass.titel"
                standard="Maße & Segmente"
                as="h1"
                className={styles.title}
              />
              <Beschriftung
                abschnittId="masse"
                schluessel="freimass.einleitung"
                standard="Gesamtmaße der Möbelhülle erfassen und die Anzahl der Korpus-Segmente (Spalten) festlegen. Daraus werden die Front-Typ-Spalten initialisiert – von links nach rechts."
                as="p"
                className={styles.subtitle}
                mehrzeilig
              />
            </>
          )}
          <p className={styles.context}>
            {group.name} · Serie {series.name}
          </p>
        </header>

        {useRaster ? (
          grunddaten ? (
            <KorpusMasseSection value={grunddaten} onChange={updateGrunddaten} />
          ) : (
            <p className={styles.hint}>Maße werden vorbereitet …</p>
          )
        ) : (
          <>
            <section className={styles.grid} aria-label="Gesamtmaße">
              <TextField
                label={t('freimass.hoehe', 'Gesamthöhe (cm)')}
                required
                inputMode="decimal"
                placeholder="z. B. 220"
                value={dimensions?.heightCm ?? ''}
                onChange={(event) => updateDim({ heightCm: event.target.value })}
                onBlur={() => markTouched('heightCm')}
                error={touched.heightCm ? errors.heightCm : undefined}
              />
              <TextField
                label={t('freimass.breite', 'Gesamtbreite (cm)')}
                required
                inputMode="decimal"
                placeholder="z. B. 300"
                value={dimensions?.widthCm ?? ''}
                onChange={(event) => updateDim({ widthCm: event.target.value })}
                onBlur={() => markTouched('widthCm')}
                error={touched.widthCm ? errors.widthCm : undefined}
              />
              <TextField
                label={t('freimass.tiefe', 'Gesamttiefe (cm)')}
                required
                inputMode="decimal"
                placeholder="z. B. 60"
                value={dimensions?.depthCm ?? ''}
                onChange={(event) => updateDim({ depthCm: event.target.value })}
                onBlur={() => markTouched('depthCm')}
                error={touched.depthCm ? errors.depthCm : undefined}
              />
            </section>

            <section className={styles.segments} aria-label="Korpus-Segmente">
              <div className={styles.segmentsHead}>
                <span className={styles.segmentsLabel}>
                  <Beschriftung
                    abschnittId="masse"
                    schluessel="freimass.segmente.titel"
                    standard="Anzahl Korpus-Segmente (Spalten)"
                  />
                  <Inspector feld="masse.breite" />
                </span>
                <Beschriftung
                  abschnittId="masse"
                  schluessel="freimass.segmente.hinweis"
                  standard="Wie viele physische Korpus-Spalten hat das Möbel? (z. B. 3)"
                  as="span"
                  className={styles.segmentsHint}
                  mehrzeilig
                />
              </div>
              <div className={styles.stepper}>
                <button
                  type="button"
                  className={styles.stepBtn}
                  onClick={() => setSegments(legacySegments - 1)}
                  disabled={legacySegments <= 1}
                  aria-label="Segment entfernen"
                >
                  −
                </button>
                <span className={styles.stepValue}>{legacySegments >= 1 ? legacySegments : '–'}</span>
                <button
                  type="button"
                  className={styles.stepBtn}
                  onClick={() => setSegments(legacySegments + 1)}
                  disabled={legacySegments >= MAX_SEGMENTS}
                  aria-label="Segment hinzufügen"
                >
                  +
                </button>
              </div>
              {touched.segments && errors.segments ? (
                <span className={styles.error}>{errors.segments}</span>
              ) : null}
            </section>
          </>
        )}

        {/*
          ERGEBNISTEXT MIT PLATZHALTERN.

          Der Satz ist editierbar, die Zahlen darin nicht: Die Platzhalter für Höhe,
          Breite und Tiefe werden beim Anzeigen ersetzt. So kann der Administrator die
          Formulierung an den Verkaufston anpassen, ohne dass jemand Maße von Hand in
          einen Text schreibt — die einzige Fassung, die dauerhaft richtig bleibt.
        */}
        {useRaster ? null : (
          <section className={styles.aussenmass} aria-label="Erfasstes Außenmaß">
            <div className={styles.aussenmassHead}>
              <span className={styles.aussenmassLabel}>
                <Beschriftung
                  abschnittId="masse"
                  schluessel="freimass.aussenmass.titel"
                  standard="Erfasstes Außenmaß"
                />
                <Inspector feld="masse.aussenmass" />
              </span>
            </div>
            <Beschriftung
              abschnittId="masse"
              schluessel="freimass.aussenmass.satz"
              standard="Ihr Möbel hat ein Maß von {hoehe} (Gesamthöhe), {breite} (Gesamtbreite) und {tiefe} (Korpustiefe ohne Fronten)."
              as="p"
              className={styles.aussenmassSentence}
              mehrzeilig
              platzhalterHinweis="Platzhalter: {hoehe}, {breite}, {tiefe} — sie werden durch die errechneten Maße ersetzt."
              anzeige={fuelle(
                t(
                  'freimass.aussenmass.satz',
                  'Ihr Möbel hat ein Maß von {hoehe} (Gesamthöhe), {breite} (Gesamtbreite) und {tiefe} (Korpustiefe ohne Fronten).',
                ),
                {
                  hoehe: formatKorpusMass(masse.gesamthoeheCm),
                  breite: formatKorpusMass(masse.gesamtbreiteCm),
                  tiefe: formatKorpusMass(masse.korpustiefeCm),
                },
              )}
            />
            <Beschriftung
              abschnittId="masse"
              schluessel="freimass.aussenmass.hinweis"
              standard="Für diese Serie werden die eingegebenen Gesamtmaße unverändert übernommen. Die Ableitung über die Frontbreiten (Fugen, Abschlusssets) greift bislang nur beim Kleiderschrank."
              as="p"
              className={styles.aussenmassHint}
              mehrzeilig
            />
          </section>
        )}

        <SchemaAbschnittFelder abschnittId="masse" />

        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => navigate('/products')}>
            Zurück
          </Button>
          <Button onClick={handleContinue}>Weiter zum Material</Button>
          {!valid ? (
            <span className={styles.hint}>
              {useRaster
                ? 'Bitte Höhe, Tiefe und alle Korpus-Breiten vollständig angeben.'
                : 'Bitte Maße und Segmentanzahl vollständig angeben.'}
            </span>
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}
