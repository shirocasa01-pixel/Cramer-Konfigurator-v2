import { Navigate, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { StepIndicator } from '../../components/layout/StepIndicator'
import { Button } from '../../components/ui/Button'
import { useDraft } from '../../context/DraftContext'
import {
  getProductGroup,
  getSeries,
  productGroups,
  type ProductGroup,
} from '../../config/productCatalog'
import { artikelFuerSerie, dropdownsFuerSchritt, getSerie, schritte } from '../../lib/stammdaten'
import { useStammdaten } from '../../lib/useStammdaten'
import { abschnittTexte } from '../../lib/schemaStore'
import { SchemaAbschnittFelder } from '../../components/schema/SchemaAbschnittFelder'
import styles from './ProductSelection.module.css'

/**
 * Zeigt an, was die gewählte Serie in den Stammdaten freischaltet — der sichtbare
 * Beleg dafür, dass die Modus-Filterung greift. Die Zahlen entstehen live aus dem
 * Feld `Modus` der Excel; nichts davon ist im Code hinterlegt.
 */
function StammdatenHinweis({ seriesId }: { seriesId: string }) {
  const serie = getSerie(seriesId)
  if (!serie) return null

  const artikel = artikelFuerSerie(seriesId)
  const schritteMitAuswahl = schritte
    .map((schritt) => ({
      schritt,
      dropdowns: dropdownsFuerSchritt(schritt.code, seriesId),
    }))
    .filter((eintrag) => eintrag.dropdowns.length > 0)

  return (
    <p className={styles.stammdatenNote}>
      Serien-Kürzel <strong>{serie.code}</strong> · <strong>{artikel.length}</strong> von 190
      Artikeln freigegeben, verteilt auf <strong>{schritteMitAuswahl.length}</strong> Schritte:{' '}
      {schritteMitAuswahl
        .map(({ schritt, dropdowns }) => `${schritt.bezeichnung} (${dropdowns.length})`)
        .join(' · ')}
    </p>
  )
}

/**
 * PHASE 3 – Produktgruppen- & Serien-Auswahl.
 * Regelbasiert & kaskadierend: Eine Produktgruppe schaltet ihre Serien frei;
 * beide müssen gewählt sein, bevor es weitergeht. Inaktive Gruppen (Sitzen,
 * Schlafen) sind sichtbar, aber nicht auswählbar.
 */
export default function ProductSelectionPage() {
  const { draft, updateDraft } = useDraft()
  const navigate = useNavigate()
  // Die Artikelzahlen je Serie kommen aus dem Stammdaten-Stand — mitzeichnen, damit eine
  // Änderung in der Verwaltung (neuer Artikel, geänderter Modus) sofort sichtbar wird.
  useStammdaten()
  const texte = abschnittTexte('produkt', { titel: 'Produktgruppe & Serie' })

  if (!draft) return <Navigate to="/" replace />

  const selectedGroup = getProductGroup(draft.productGroupId)
  const currentGroupId = draft.productGroupId
  // Regel: Nur zulässig, wenn die Serie zur gewählten Gruppe gehört.
  const canContinue = Boolean(getSeries(draft.productGroupId, draft.seriesId))

  function selectGroup(group: ProductGroup) {
    if (!group.active || currentGroupId === group.id) return
    // Bei Gruppenwechsel die Serie zurücksetzen (keine gruppenfremde Serie).
    updateDraft({ productGroupId: group.id, seriesId: undefined })
  }

  function selectSeries(seriesId: string) {
    updateDraft({ seriesId })
  }

  function handleContinue() {
    if (canContinue) navigate('/dimensions')
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <StepIndicator activeKey="product" />

        <header className={styles.header}>
          <h1 className={styles.title}>{texte.titel}</h1>
          {texte.beschreibung ? <p className={styles.subtitle}>{texte.beschreibung}</p> : null}
        </header>

        <section aria-label="Produktgruppe">
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNo}>1</span> Produktgruppe
          </h2>
          <div className={styles.tiles}>
            {productGroups.map((group) => {
              const selected = draft.productGroupId === group.id
              return (
                <button
                  key={group.id}
                  type="button"
                  className={[
                    styles.tile,
                    selected ? styles.tileSelected : '',
                    !group.active ? styles.tileInactive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => selectGroup(group)}
                  disabled={!group.active}
                  aria-pressed={selected}
                >
                  <span className={styles.tileName}>{group.name}</span>
                  <span className={styles.tileDesc}>{group.description}</span>
                  {!group.active ? <span className={styles.tileFlag}>bald verfügbar</span> : null}
                  {selected ? (
                    <span className={styles.tileCheck} aria-hidden="true">
                      ✓
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </section>

        {selectedGroup && selectedGroup.series.length > 0 ? (
          <section aria-label="Serie">
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionNo}>2</span> Serie
              <span className={styles.sectionHint}>· {selectedGroup.name}</span>
            </h2>
            <div className={styles.series}>
              {selectedGroup.series.map((series) => {
                const selected = draft.seriesId === series.id
                return (
                  <button
                    key={series.id}
                    type="button"
                    className={[styles.serie, selected ? styles.serieSelected : '']
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => selectSeries(series.id)}
                    aria-pressed={selected}
                  >
                    {series.name}
                    <span className={styles.serieCount}>
                      {artikelFuerSerie(series.id).length}&nbsp;Artikel
                    </span>
                  </button>
                )
              })}
            </div>
            {draft.seriesId ? <StammdatenHinweis seriesId={draft.seriesId} /> : null}
          </section>
        ) : null}

        <SchemaAbschnittFelder abschnittId="produkt" />

        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => navigate('/new')}>
            Zurück
          </Button>
          <Button onClick={handleContinue} disabled={!canContinue}>
            Weiter zu den Maßen
          </Button>
          {!canContinue ? (
            <span className={styles.actionHint}>Bitte Produktgruppe und Serie wählen.</span>
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}
