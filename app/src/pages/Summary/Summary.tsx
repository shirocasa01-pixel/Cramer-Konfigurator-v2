import { useCallback, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { StepIndicator } from '../../components/layout/StepIndicator'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { ScanBridgeModal } from '../../components/scan/ScanBridgeModal'
import { KalkulationsPanel } from '../../components/pricing/KalkulationsPanel'
import { useDraft } from '../../context/DraftContext'
import { felderFuer } from '../../lib/schemaStore'
import { anzeigeWert, zeigeFeld } from '../../lib/schemaWerte'
import { getProductGroup, getSeries } from '../../config/productCatalog'
import { getVisibleKorpusAreas } from '../../config/korpus'
import { getFrontType, getStyleLine } from '../../config/frontCatalog'
import { support } from '../../config/support'
import { isKorpusComplete } from '../../lib/korpusValidation'
import { isFrontsComplete } from '../../lib/frontsValidation'
import { PRICE_GROUP_LABEL, describeMaterialSelection } from '../../lib/materialFormat'
import {
  ABSCHLUSS_UNTEN_LABEL,
  describeFrontExtras,
  describeFrontField,
  describeHandleConfig,
  describeOben,
} from '../../lib/frontsFormat'
import { isFrontFieldVisible } from '../../lib/frontsHelpers'
import { describeAusstattungAuswahl, describeColumnEquipment } from '../../lib/ausstattungFormat'
import { downloadPdf } from '../../lib/generatePdf'
import { formatVkPreis } from '../../lib/pricing'
import { formatDezimal } from '../../lib/format'
import { caPrefix, formatDimensions } from '../../lib/massFormat'
import { describeKorpusGrunddatenZeilen } from '../../lib/korpusMass'
import type { FrontElement, KorpusGrunddaten, KorpusInnen, PriceGroup } from '../../types'
import { abschnittTexte } from '../../lib/schemaStore'
import styles from './Summary.module.css'

/**
 * PHASE 6 – Abschluss / Zusammenfassung.
 * Vollständige Übersicht + Smartphone-Scan der Handzeichnung + AV-PDF + Speichern.
 */
export default function SummaryPage() {
  const { draft, updateDraft, finalizeDraft, cloudSaving } = useDraft()
  const navigate = useNavigate()
  const [scanOpen, setScanOpen] = useState(false)

  const onScanReceived = useCallback(
    (image: string) => updateDraft({ scanImage: image }),
    [updateDraft],
  )
  const closeScan = useCallback(() => setScanOpen(false), [])

  if (!draft) return <Navigate to="/" replace />
  const group = getProductGroup(draft.productGroupId)
  const series = getSeries(draft.productGroupId, draft.seriesId)
  if (!group || !series) return <Navigate to="/products" replace />
  const visibleAreas = getVisibleKorpusAreas(series, draft.korpusMode)
  // Referenz-/Verifizierungs-Entwürfe umgehen die Vollständigkeits-Weichen (Positions-basiert).
  const isReference = Boolean(draft.isVerification)
  if (!isReference && !isKorpusComplete(draft.korpus, visibleAreas)) return <Navigate to="/korpus" replace />
  if (!isReference && !isFrontsComplete(draft.fronts)) return <Navigate to="/fronts" replace />
  const fronts = draft.fronts ?? { columns: [] }

  const dim = draft.dimensions
  const abschlussTexte = abschnittTexte('abschluss', { titel: 'Zusammenfassung & Abschluss' })

  /**
   * Auftrags- und Artikelnummer sind bei der Anlage bewusst optional — der Auftrag
   * entsteht erst am Ende des Verkaufsprozesses. Spätestens bei der Übergabe an die
   * Arbeitsvorbereitung müssen sie aber stehen: ohne sie kann die AV den Vorgang nicht
   * zuordnen. Hier, und nur hier, werden sie zu Pflichtfeldern.
   */
  const avFehlend = [
    draft?.orderNumber?.trim() ? null : 'Auftragsnummer',
    draft?.artikelnummer?.trim() ? null : 'Artikelnummer',
  ].filter((f): f is string => f !== null)

  function handleSendToAv() {
    if (!draft) return
    if (avFehlend.length > 0) return
    downloadPdf(draft)
    const to = support.contacts[0]?.value ?? 'av@cramer.de'
    const subject = encodeURIComponent(`AV-Übergabe ${draft.id} · ${draft.orderNumber}`)
    const body = encodeURIComponent(
      `Anbei die AV-Übergabe für Entwurf ${draft.id} (Auftrag ${draft.orderNumber}, Kunde ${draft.customerName}).\n\nBitte die soeben heruntergeladene PDF-Datei anhängen.`,
    )
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
  }

  async function handleFinalize() {
    await finalizeDraft()
    navigate('/', { replace: true })
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <StepIndicator activeKey="summary" />
        <h1 className={styles.title}>{abschlussTexte.titel}</h1>
        {abschlussTexte.beschreibung ? <p className={styles.lead}>{abschlussTexte.beschreibung}</p> : null}

        {/* Scan-Bereich */}
        <section className={styles.scan} aria-label="Handzeichnung scannen">
          <div className={styles.scanText}>
            <h2 className={styles.scanTitle}>Handzeichnung (Skizze)</h2>
            <p className={styles.scanHint}>
              Per Smartphone scannen – das Bild wird automatisch als kontrastreiches Dokument
              optimiert und erscheint hier sowie auf Seite 2 des PDFs.
            </p>
            <Button variant="ghost" onClick={() => setScanOpen(true)}>
              {draft.scanImage ? 'Skizze neu scannen' : 'Skizze via Smartphone scannen'}
            </Button>
          </div>
          {draft.scanImage ? (
            <img src={draft.scanImage} alt="Gescannte Skizze" className={styles.scanImage} />
          ) : (
            <div className={styles.scanEmpty}>Noch keine Skizze</div>
          )}
        </section>

        {/* Auftragskopf aus dem Konfigurator-Schema — dieselbe Definition wie Maske und PDF. */}
        <Block title="Auftrag">
          {felderFuer('auftragskopf', 'zusammenfassung', { serieId: draft.seriesId })
            .filter((feld) => zeigeFeld(draft, feld))
            .map((feld) => (
              <Row
                key={feld.id}
                k={feld.label}
                v={anzeigeWert(draft, feld) || '—'}
                mono={feld.quelle === 'entwurfsnummer'}
              />
            ))}
        </Block>

        <Block title="Produkt & Maße">
          <Row k="Produktgruppe" v={group.name} />
          <Row k="Serie" v={series.name} />
          <Row k="Maße (B×H×T)" v={formatDimensions(dim)} />
          <Row k="Segmente" v={String(fronts.columns.length)} />
        </Block>

        <KorpusGrunddatenRecap grunddaten={draft.korpusGrunddaten} />

        <Block title="Material">
          {visibleAreas.map((area) => {
            const selection = draft.korpus?.[area.id]
            return (
              <Row
                key={area.id}
                k={area.label}
                v={describeMaterialSelection(selection, area.noneLabel)}
                pg={selection?.priceGroup}
              />
            )
          })}
          {draft.sichtRueckwandAussen ? (
            <Row
              k="d. Rückwand Außen (Sicht)"
              v={describeMaterialSelection(draft.korpus?.rueckwandAussen)}
              pg={draft.korpus?.rueckwandAussen?.priceGroup}
            />
          ) : null}
        </Block>

        <KorpusInnenRecap korpusInnen={draft.korpusInnen} />

        <AusstattungRecap selected={draft.ausstattung?.selected} />

        <Block title="Fronten">
          {fronts.schiebetuerAnzahl ? (
            <Row k="Anzahl Schiebetüren" v={`${fronts.schiebetuerAnzahl} Stück (ganzer Schrank)`} />
          ) : null}
          {fronts.columns.map((column, index) => {
            const equip = describeColumnEquipment(column)
            return (
              <div key={column.id} className={styles.colGroup}>
                <div className={styles.colHead}>Front-Typ {index + 1}</div>
                {column.elements.map((element) => (
                  <ElementRecap key={element.id} element={element} />
                ))}
                {equip.length ? (
                  <div className={styles.elem}>
                    <div className={styles.elemHead}>
                      <div className={styles.elemHeadLeft}>
                        <span className={styles.elemType}>Ausstattung hinter Front</span>
                      </div>
                    </div>
                    <ul className={styles.fieldList}>
                      {equip.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )
          })}
        </Block>

        <Block title="Abschlüsse">
          <Row k="Grifffarbe" v={fronts.grifffarbe?.trim() || '—'} />
          <Row k="Abschluss oben" v={describeOben(fronts.abschlussOben)} />
          <Row
            k="Abschluss unten"
            v={
              fronts.abschlussUnten
                ? ABSCHLUSS_UNTEN_LABEL[fronts.abschlussUnten.type] +
                  (fronts.abschlussUnten.footNote ? ` (${fronts.abschlussUnten.footNote})` : '')
                : '—'
            }
          />
        </Block>

        {fronts.sonderausstattung?.trim() ? (
          <Block title="Sonderausstattung">
            <p className={styles.notes}>{fronts.sonderausstattung}</p>
          </Block>
        ) : null}

        <KalkulationsPanel
          draft={draft}
          onSummeUebernehmen={(gesamt) =>
            // Über `formatDezimal` statt `toLocaleString`: eine Stelle im Code entscheidet,
            // wie eine Zahl in Deutschland aussieht — und normalisiert das schmale
            // Leerzeichen, das sonst im AV-PDF als Kästchen landet.
            updateDraft({ vkPreis: formatDezimal(gesamt) })
          }
        />

        <section className={styles.vkBox} aria-label="Verkaufspreis">
          <div className={styles.vkHead}>
            <h2 className={styles.vkTitle}>Verkaufspreis (VK)</h2>
            <span className={styles.vatNote}>verbindlicher Endpreis · inkl. 19% MwSt.</span>
          </div>
          <p className={styles.vkHint}>
            Verbindlicher Endpreis für Angebot und AV-PDF. Über „Berechneten Preis übernehmen" wird
            das Ergebnis der Kalkulation eingesetzt; ein abweichender Wert ist möglich, sollte aber
            begründet werden. Eingabe in deutscher Schreibweise: Komma trennt die Cent, Punkt die
            Tausender — <b>9.009,00</b> sind neuntausendneun Euro.
          </p>
          <div className={styles.vkRow}>
            <div className={styles.vkField}>
              <TextField
                label="VK-Preis"
                inputMode="decimal"
                placeholder="z. B. 9.009,00"
                value={draft.vkPreis ?? ''}
                onChange={(event) => updateDraft({ vkPreis: event.target.value })}
              />
            </div>
            <div className={styles.vkPreview}>
              <span className={styles.vkPreviewLabel}>Vorschau</span>
              <span className={styles.vkPreviewValue}>{formatVkPreis(draft.vkPreis)}</span>
            </div>
          </div>
        </section>

        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => navigate('/fronts')}>
            Zurück
          </Button>
          <Button variant="ghost" onClick={() => downloadPdf(draft)}>
            PDF herunterladen
          </Button>
          <Button
            variant="ghost"
            onClick={handleSendToAv}
            disabled={avFehlend.length > 0}
            title={
              avFehlend.length > 0
                ? `Für die AV-Übergabe fehlt noch: ${avFehlend.join(' und ')}.`
                : undefined
            }
          >
            An AV senden
          </Button>
          <Button onClick={() => void handleFinalize()} disabled={cloudSaving}>
            {cloudSaving ? 'Speichert …' : 'Speichern & abschließen'}
          </Button>
        </div>

        {avFehlend.length > 0 ? (
          <p className={styles.avHinweis} role="status">
            Für die Übergabe an die Arbeitsvorbereitung fehlt noch{' '}
            <b>{avFehlend.join(' und ')}</b> — in Schritt 1 „Entwurf" nachtragen. Für PDF und
            „Speichern &amp; abschließen" ist das nicht nötig.
          </p>
        ) : null}
      </div>

      <ScanBridgeModal
        open={scanOpen}
        draftId={draft.id}
        onClose={closeScan}
        onReceived={onScanReceived}
      />
    </AppShell>
  )
}

function KorpusGrunddatenRecap({ grunddaten }: { grunddaten?: KorpusGrunddaten }) {
  if (!grunddaten) return null
  const zeilen = describeKorpusGrunddatenZeilen(grunddaten)
  if (zeilen.length === 0) return null
  return (
    <Block title="Korpus-Grunddaten">
      {zeilen.map((z, index) => (
        <Row key={index} k={z.label} v={z.value} />
      ))}
    </Block>
  )
}

function KorpusInnenRecap({ korpusInnen }: { korpusInnen?: KorpusInnen }) {
  if (!korpusInnen) return null
  const { rueckwand, lochreihe, einlegeboeden } = korpusInnen
  if (!rueckwand.enabled && !lochreihe.enabled && !einlegeboeden.enabled) return null
  return (
    <Block title="Korpus Innen">
      {rueckwand.enabled ? (
        <Row k="Rückwand Innen" v={describeMaterialSelection(rueckwand.material)} pg={rueckwand.material?.priceGroup} />
      ) : null}
      {lochreihe.enabled ? <Row k="Lochreihe" v={lochreihe.note?.trim() || 'ja'} /> : null}
      {einlegeboeden.enabled ? <Row k="Einlegeböden" v={`${einlegeboeden.anzahl?.trim() || '—'} Stück`} /> : null}
      {einlegeboeden.enabled && einlegeboeden.kleiderstange.enabled ? (
        <Row k="Kleiderstange" v={einlegeboeden.kleiderstange.note?.trim() || 'ja'} />
      ) : null}
    </Block>
  )
}

function AusstattungRecap({ selected }: { selected?: string[] }) {
  const groups = describeAusstattungAuswahl(selected)
  if (groups.length === 0) return null
  return (
    <Block title="Ausstattung-Vorauswahl">
      {groups.map((g) => (
        <Row key={g.category} k={g.category} v={g.labels.join(', ')} />
      ))}
    </Block>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.block}>
      <h2 className={styles.blockTitle}>{title}</h2>
      <div className={styles.blockBody}>{children}</div>
    </section>
  )
}

function Row({ k, v, mono, pg }: { k: string; v: string; mono?: boolean; pg?: PriceGroup }) {
  return (
    <div className={styles.row}>
      <span className={styles.k}>{k}</span>
      <span className={[styles.v, mono ? styles.mono : ''].filter(Boolean).join(' ')}>
        {v}
        {pg ? <span className={styles.pg}>{PRICE_GROUP_LABEL[pg]}</span> : null}
      </span>
    </div>
  )
}

function ElementRecap({ element }: { element: FrontElement }) {
  const styleLine = getStyleLine(element.typeId, element.styleLineId)
  const fieldLines = styleLine
    ? styleLine.fields
        .filter((field) => isFrontFieldVisible(field, element))
        .map((field) => describeFrontField(field, element.fieldValues?.[field.id]))
        .filter(Boolean)
    : []
  const handleLine = describeHandleConfig(element)
  if (handleLine) fieldLines.push(handleLine)
  const meta: string[] = []
  if (element.widthCm || element.heightCm) {
    meta.push(`Maße: ${caPrefix()}${element.widthCm ?? '?'}×${element.heightCm ?? '?'} cm`)
  }
  const extras = describeFrontExtras(element)
  if (extras) meta.push(extras)

  return (
    <div className={styles.elem}>
      <div className={styles.elemHead}>
        <div className={styles.elemHeadLeft}>
          <span className={styles.elemType}>{getFrontType(element.typeId)?.label}</span>
          <span className={styles.elemLabel}>{element.label}</span>
          {styleLine ? <span className={styles.elemStyle}>{styleLine.label}</span> : null}
        </div>
      </div>
      {meta.length ? <div className={styles.elemMeta}>{meta.join('  ·  ')}</div> : null}
      {fieldLines.length ? (
        <ul className={styles.fieldList}>
          {fieldLines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
