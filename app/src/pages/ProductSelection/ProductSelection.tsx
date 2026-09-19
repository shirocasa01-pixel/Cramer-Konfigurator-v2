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
import { useBearbeitungsModus } from '../../lib/editorModus'
import { AbschnittKopf } from '../../components/schema/AbschnittKopf'
import { Beschriftung, BeschriftungsGruppe, useTexte } from '../../components/schema/Beschriftung'
import { Inspector } from '../../components/schema/Inspector'
import { SchemaAbschnittFelder } from '../../components/schema/SchemaAbschnittFelder'
import styles from './ProductSelection.module.css'

/**
 * WAS DIE GEWÄHLTE SERIE IN DEN STAMMDATEN FREISCHALTET — NUR FÜR DEN ADMINISTRATOR.
 *
 * Diese Zeile stand bisher in der Berateransicht: „Serien-Kürzel R · 117 von 190 Artikeln
 * freigegeben, verteilt auf 5 Schritte …". Im Verkaufsgespräch sitzt der Kunde daneben und
 * liest eine Zahl, die ihn nichts angeht und die niemand erklären kann. Der Berater wählt
 * eine Serie, keinen Artikelbestand.
 *
 * Für den Administrator ist dieselbe Zeile wertvoll — sie belegt, dass die Modus-Filterung
 * greift. Deshalb bleibt sie, aber hinter der Bearbeitungsschicht (Ebene 2 aufwärts).
 */
function StammdatenHinweis({ seriesId }: { seriesId: string }) {
  const bearbeitung = useBearbeitungsModus()
  const serie = getSerie(seriesId)
  if (!bearbeitung || !serie) return null

  const artikel = artikelFuerSerie(seriesId)
  const schritteMitAuswahl = schritte
    .map((schritt) => ({
      schritt,
      dropdowns: dropdownsFuerSchritt(schritt.code, seriesId),
    }))
    .filter((eintrag) => eintrag.dropdowns.length > 0)

  return (
    <p className={styles.stammdatenNote}>
      Serien-Kürzel <strong>{serie.code}</strong> · <strong>{artikel.length}</strong> Artikel
      freigegeben, verteilt auf <strong>{schritteMitAuswahl.length}</strong> Schritte:{' '}
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
  const bearbeitung = useBearbeitungsModus()
  const t = useTexte('produkt')

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
          <AbschnittKopf
            abschnittId="produkt"
            standardTitel="Produktgruppe & Serie"
            titelKlasse={styles.title}
            textKlasse={styles.subtitle}
          />
        </header>

        {/*
          Produktgruppen-Bezeichnungen sind Verkaufstexte, keine Stammdaten: Der
          Administrator benennt Kachel und Beschreibung im Bearbeitungsmodus, ohne dass
          der Katalog angefasst werden muss. Der Stift sitzt an der Abschnitts-Überschrift
          und öffnet alle Kacheln gemeinsam — ein Stift je Kachel würde die Reihe zerreißen.
        */}
        <section aria-label="Produktgruppe">
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNo}>1</span>{' '}
            <Beschriftung abschnittId="produkt" schluessel="gruppe.titel" standard="Produktgruppe" />
            <Inspector feld="produkt.gruppe" />
            <BeschriftungsGruppe
              abschnittId="produkt"
              titel="Produktgruppen benennen"
              eintraege={productGroups.flatMap((g) => [
                { schluessel: `gruppe.${g.id}.name`, standard: g.name, label: `${g.name} — Bezeichnung` },
                {
                  schluessel: `gruppe.${g.id}.beschreibung`,
                  standard: g.description,
                  label: `${g.name} — Beschreibung`,
                  mehrzeilig: true,
                },
              ])}
            />
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
                  <span className={styles.tileName}>{t(`gruppe.${group.id}.name`, group.name)}</span>
                  <span className={styles.tileDesc}>
                    {t(`gruppe.${group.id}.beschreibung`, group.description)}
                  </span>
                  {!group.active ? (
                    <span className={styles.tileFlag}>{t('gruppe.inaktiv', 'bald verfügbar')}</span>
                  ) : null}
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

        {/*
          Die Artikelzahl unter jeder Serie („117 Artikel") ist eine Kennzahl der
          Stammdatenpflege und stand hier im Verkaufsgespräch. Sie sagt nichts über das
          Möbel aus — eine Serie mit 117 Artikeln ist nicht besser als eine mit 40 — und
          lud zu genau dieser Fehldeutung ein. Für den Administrator bleibt sie im
          Bearbeitungsmodus stehen, weil er daran die Freigaben prüft.
        */}
        {selectedGroup && selectedGroup.series.length > 0 ? (
          <section aria-label="Serie">
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionNo}>2</span>{' '}
              <Beschriftung abschnittId="produkt" schluessel="serie.titel" standard="Serie" />
              <span className={styles.sectionHint}>
                · {t(`gruppe.${selectedGroup.id}.name`, selectedGroup.name)}
              </span>
              <Inspector feld="produkt.serie" />
              <BeschriftungsGruppe
                abschnittId="produkt"
                titel="Serien benennen"
                eintraege={selectedGroup.series.map((s) => ({
                  schluessel: `serie.${s.id}.name`,
                  standard: s.name,
                  label: `Serie ${s.name}`,
                }))}
              />
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
                    {t(`serie.${series.id}.name`, series.name)}
                    {bearbeitung ? (
                      <span className={styles.serieCount}>
                        {artikelFuerSerie(series.id).length}&nbsp;Artikel
                      </span>
                    ) : null}
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
