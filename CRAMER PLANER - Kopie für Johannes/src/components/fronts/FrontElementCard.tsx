import { useEffect, useState } from 'react'
import { MaterialSelect } from '../material/MaterialSelect'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import {
  getFrontType,
  getStyleLine,
  type FrontField,
  type FrontStyleLine,
} from '../../config/frontCatalog'
import { getAvailableHandles } from '../../config/handles'
import { MATERIAL_CUSTOM_ID, aktuelleOptionId, getMaterialGroup } from '../../config/materialMatrix'
import { formatMassZahl } from '../../lib/format'
import { resolvePriceGroup } from '../../lib/materialRules'
import {
  DREHTUER_RASTER_MAX,
  DREHTUER_RASTER_MIN,
  aufkantungGroupIds,
  aufkantungOptions,
  decodeAufkantungValue,
  encodeAufkantungValue,
  frontHoeheAusRaster,
  frontMaterialGroupId,
  isFrontFieldVisible,
  parseRasterEingabe,
} from '../../lib/frontsHelpers'
import { useStammdaten } from '../../lib/useStammdaten'
import type { FrontElement, FrontFieldValue, MaterialSelection } from '../../types'
import styles from './FrontElementCard.module.css'

interface FrontElementCardProps {
  element: FrontElement
  onChange: (patch: Partial<FrontElement>) => void
  onRemove: () => void
  /** Phase A: „Werte übernehmen" – kopiert die Konfiguration der Referenzfront (gleicher Typ). */
  onCopyValues?: () => void
  /** Anzeigename der Quellfront für den Übernehmen-Button (z. B. „Front 1"). */
  copyFromLabel?: string
  /**
   * Überarbeitung 3 („Höhe bis Korpusoberkante"): aus dem Korpusraster minus den übrigen
   * Fronten der Spalte abgeleitete Resthöhe. `undefined`, wenn sie sich nicht eindeutig
   * ergibt – dann bleibt die Höhe offen (AV).
   */
  restRasterBisOberkante?: number
}

/**
 * Ein Front-Bauteil innerhalb einer Front-Typ-Spalte: Kennzeichnung (Pflicht),
 * Maße/Katalog-Code, Stil-Linie und die kaskadierenden Material-/Freitextfelder.
 * Griff-Optionen sind gegenseitig ausschließend (PTO ⇎ Griff); bei gleichem Front-Typ
 * wie die Referenzfront erscheint der „Werte übernehmen"-Button (Phase A).
 *
 * Überarbeitung 3 ergänzt: Türhöhe der Drehtür über drei exklusive Optionen inkl.
 * Raster→cm-Umrechnung, Türanschlag rechts/links, „Line"-Aufteilung in Frontscheibe und
 * Aufkantung sowie das Griffprofil ausschließlich in „Edge".
 */
export function FrontElementCard({
  element,
  onChange,
  onRemove,
  onCopyValues,
  copyFromLabel,
  restRasterBisOberkante,
}: FrontElementCardProps) {
  const [labelTouched, setLabelTouched] = useState(false)
  // Die Aufkantungs-Liste und die Gruppen-Labels kommen aus den Oberflächen-Stammdaten;
  // ohne dieses Abonnement bliebe die Karte nach einer Änderung in der Verwaltung stehen.
  useStammdaten()
  const type = getFrontType(element.typeId)
  const styleLine = getStyleLine(element.typeId, element.styleLineId)
  const labelError = labelTouched && !element.label.trim() ? 'Kennzeichnung ist erforderlich.' : undefined
  const maxHeight = type?.maxHeightCm
  const heightNum = Number((element.heightCm ?? '').replace(',', '.'))
  const heightViolation = maxHeight != null && Number.isFinite(heightNum) && heightNum > maxHeight

  const hoeheModus = element.hoeheModus
  const oberkanteHoeheCm =
    restRasterBisOberkante != null ? frontHoeheAusRaster(restRasterBisOberkante) : undefined

  /**
   * „Höhe bis Korpusoberkante" hält `heightCm` an der abgeleiteten Resthöhe – sonst hätte
   * die Kalkulation für diese Front keine Rasterstufe. Ändern sich die übrigen Fronten der
   * Spalte, zieht die Türhöhe automatisch nach.
   */
  useEffect(() => {
    if (hoeheModus !== 'korpusoberkante') return
    const soll = oberkanteHoeheCm != null ? formatMassZahl(oberkanteHoeheCm) : ''
    if ((element.heightCm ?? '') !== soll) onChange({ heightCm: soll })
    // onChange ist ein Inline-Closure des Aufrufers und wechselt bei jedem Render – bewusst
    // nicht in der Abhängigkeitsliste, sonst liefe der Effekt endlos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoeheModus, oberkanteHoeheCm, element.heightCm])

  function setField(fieldId: string, value: FrontFieldValue) {
    onChange({ fieldValues: { ...element.fieldValues, [fieldId]: value } })
  }

  /** Feldwerte ohne die angegebenen IDs (statt `undefined` einzutragen). */
  function fieldValuesOhne(...ids: string[]): Record<string, FrontFieldValue> {
    const rest: Record<string, FrontFieldValue> = {}
    for (const [key, val] of Object.entries(element.fieldValues ?? {})) {
      if (!ids.includes(key)) rest[key] = val
    }
    return rest
  }

  /**
   * Material eines Stil-Linien-Feldes setzen. Wechselt bei „Line" die Materialgruppe, werden
   * die davon abhängigen Angaben (Ja/Nein, Aufkantung, Alulisene) verworfen – sie gehören
   * zur alten Gruppe und wären sonst still falsch.
   */
  function setMaterial(field: FrontField, value: FrontFieldValue | undefined, material: MaterialSelection) {
    const gruppeVorher = value?.material?.materialGroupId
    const gruppeWechselt =
      Boolean(styleLine?.frontscheibeAufkantung) &&
      field.id === 'material' &&
      material.materialGroupId !== gruppeVorher
    if (!gruppeWechselt) {
      setField(field.id, { ...value, material })
      return
    }
    onChange({
      lineAufkantungGleich: undefined,
      fieldValues: { ...fieldValuesOhne('aufkantung', 'alulisene'), [field.id]: { ...value, material } },
    })
  }

  /** Antwort auf „(Glas der) Frontscheibe und der Aufkantung gleich?". */
  function setLineGleich(gleich: boolean) {
    if (gleich) {
      onChange({ lineAufkantungGleich: true, fieldValues: fieldValuesOhne('aufkantung', 'alulisene') })
    } else {
      onChange({ lineAufkantungGleich: false })
    }
  }

  function pickStyleLine(styleLineId: string) {
    if (styleLineId === element.styleLineId) return
    // Stil-Wechsel setzt die (anders strukturierten) Felder zurück.
    const patch: Partial<FrontElement> = {
      styleLineId,
      fieldValues: {},
      lineAufkantungGleich: undefined,
    }
    // Schritt 7: bei Wechsel zu Glossy/Less einen dort nicht mehr zulässigen Griff verwerfen.
    if (element.griffId && !getAvailableHandles(styleLineId).some((h) => h.id === element.griffId)) {
      patch.griffId = undefined
    }
    onChange(patch)
  }

  // --- Türhöhe (Überarbeitung 3) -------------------------------------------------
  function setModusOberkante(checked: boolean) {
    onChange(
      checked
        ? { hoeheModus: 'korpusoberkante', hoeheRaster: undefined, heightCm: '' }
        : { hoeheModus: undefined, heightCm: '' },
    )
  }
  function setRaster(text: string) {
    const raster = parseRasterEingabe(text)
    if (!text.trim()) {
      onChange({ hoeheModus: undefined, hoeheRaster: '', heightCm: '' })
      return
    }
    // Einbahnstraße: Raster → cm. Eine Rückrechnung cm → Raster gibt es bewusst nicht.
    onChange({
      hoeheModus: 'raster',
      hoeheRaster: text,
      heightCm: raster != null ? formatMassZahl(frontHoeheAusRaster(raster)) : '',
    })
  }
  function setHoeheCm(text: string) {
    onChange({ hoeheModus: text.trim() ? 'cm' : undefined, hoeheRaster: undefined, heightCm: text })
  }

  const rasterEingabe = parseRasterEingabe(element.hoeheRaster)
  const rasterFehler =
    hoeheModus === 'raster' && element.hoeheRaster?.trim() && rasterEingabe == null
      ? 'Bitte eine Zahl eingeben.'
      : hoeheModus === 'raster' &&
          rasterEingabe != null &&
          (rasterEingabe < DREHTUER_RASTER_MIN || rasterEingabe > DREHTUER_RASTER_MAX)
        ? `Zulässig sind ${DREHTUER_RASTER_MIN} bis ${DREHTUER_RASTER_MAX} Raster.`
        : undefined

  // Überarbeitung 3: Curve mit Mattlack oder „anders" hat gar kein Griffprofil.
  const materialGruppe = frontMaterialGroupId(element)
  const griffProfilEntfaellt =
    element.styleLineId === 'curve' && (materialGruppe === 'mattlack' || materialGruppe === MATERIAL_CUSTOM_ID)

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.typeBadge}>{type?.label ?? element.typeId}</span>
        <button type="button" className={styles.remove} onClick={onRemove}>
          Entfernen
        </button>
      </div>

      {onCopyValues ? (
        <button type="button" className={styles.copyBtn} onClick={onCopyValues}>
          ⧉ Werte von {copyFromLabel ?? 'Front 1'} übernehmen
        </button>
      ) : null}

      <TextField
        label="Kennzeichnung / Position"
        required
        placeholder="z. B. D1, S1, oben links"
        value={element.label}
        onChange={(event) => onChange({ label: event.target.value })}
        onBlur={() => setLabelTouched(true)}
        error={labelError}
      />

      <div
        className={[styles.sizeRow, type?.ohneHoehe || type?.hoeheModi ? styles.sizeRowSingle : '']
          .filter(Boolean)
          .join(' ')}
      >
        <TextField
          label="Breite (cm)"
          inputMode="decimal"
          placeholder="z. B. 50"
          value={element.widthCm ?? ''}
          onChange={(event) => onChange({ widthCm: event.target.value })}
        />
        {/* Zweiläufige Schiebetür: kein Höhenfeld – sie geht immer über die volle Höhe. */}
        {type?.ohneHoehe || type?.hoeheModi ? null : (
          <TextField
            label="Höhe (cm)"
            inputMode="decimal"
            placeholder="z. B. 200"
            value={element.heightCm ?? ''}
            onChange={(event) => onChange({ heightCm: event.target.value })}
          />
        )}
      </div>

      {type?.ohneHoehe ? (
        <p className={styles.handleHint}>
          Höhe immer über die volle Korpushöhe – technisch nicht anders möglich.
        </p>
      ) : null}

      {type?.hoeheModi ? (
        <div className={styles.handleBlock}>
          <span className={styles.blockLabel}>Türhöhe – genau eine der drei Angaben</span>
          <label
            className={[
              styles.check,
              hoeheModus && hoeheModus !== 'korpusoberkante' ? styles.checkDisabled : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={hoeheModus === 'korpusoberkante'}
              disabled={Boolean(hoeheModus) && hoeheModus !== 'korpusoberkante'}
              onChange={(event) => setModusOberkante(event.target.checked)}
            />
            Höhe bis Korpusoberkante
          </label>
          {hoeheModus === 'korpusoberkante' ? (
            <p className={styles.handleHint}>
              {restRasterBisOberkante != null && oberkanteHoeheCm != null
                ? `Ergibt ${formatMassZahl(restRasterBisOberkante)} Raster ≙ ${formatMassZahl(oberkanteHoeheCm)} cm (Korpusraster abzüglich der übrigen Fronten dieses Segments).`
                : 'Resthöhe noch nicht ableitbar – erst die übrigen Fronten dieses Segments bemaßen; sonst klärt die AV die Türhöhe.'}
            </p>
          ) : null}
          <div className={styles.hoeheRow}>
            <TextField
              label="Höhe (Raster)"
              inputMode="decimal"
              placeholder={`${DREHTUER_RASTER_MIN}–${DREHTUER_RASTER_MAX}`}
              value={element.hoeheRaster ?? ''}
              disabled={Boolean(hoeheModus) && hoeheModus !== 'raster'}
              onChange={(event) => setRaster(event.target.value)}
              error={rasterFehler}
              hint={
                hoeheModus === 'raster' && rasterEingabe != null && !rasterFehler
                  ? `= ${formatMassZahl(frontHoeheAusRaster(rasterEingabe))} cm Fronthöhe`
                  : undefined
              }
            />
            <TextField
              label="Höhe (cm)"
              inputMode="decimal"
              placeholder="z. B. 178,9"
              // In den beiden anderen Modi zeigt das Feld die errechnete Höhe – gesperrt,
              // damit die Umrechnung eine Einbahnstraße bleibt.
              value={element.heightCm ?? ''}
              disabled={Boolean(hoeheModus) && hoeheModus !== 'cm'}
              onChange={(event) => setHoeheCm(event.target.value)}
              hint={
                hoeheModus && hoeheModus !== 'cm'
                  ? '1 Raster = 12,5 cm, dazwischen je 0,3 cm Fuge – errechnet, nicht editierbar.'
                  : undefined
              }
            />
          </div>
        </div>
      ) : null}

      {type?.tuerAnschlag ? (
        <div className={styles.styleBlock}>
          <span className={styles.blockLabel}>Türanschlag</span>
          <div className={styles.handleChecks} role="radiogroup" aria-label="Türanschlag">
            {(['rechts', 'links'] as const).map((seite) => (
              <label key={seite} className={styles.check}>
                <input
                  type="radio"
                  className={styles.checkbox}
                  name={`anschlag-${element.id}`}
                  checked={element.tuerAnschlag === seite}
                  onChange={() => onChange({ tuerAnschlag: seite })}
                />
                {seite === 'rechts' ? 'rechts' : 'links'}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {type && type.styleLines.length > 0 ? (
        <div className={styles.styleBlock}>
          <span className={styles.blockLabel}>Stil-Linie</span>
          <div className={styles.styleChips}>
            {type.styleLines.map((line) => (
              <button
                key={line.id}
                type="button"
                className={[styles.chip, element.styleLineId === line.id ? styles.chipActive : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => pickStyleLine(line.id)}
                aria-pressed={element.styleLineId === line.id}
              >
                {line.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className={styles.openNote}>Offenes Fach – keine Frontauswahl erforderlich.</p>
      )}

      {styleLine ? (
        <div className={styles.fields}>
          {styleLine.fields
            .filter((field) => isFrontFieldVisible(field, element))
            .map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                styleLine={styleLine}
                element={element}
                value={element.fieldValues?.[field.id]}
                onChange={(value) => setField(field.id, value)}
                onMaterialChange={(material) => setMaterial(field, element.fieldValues?.[field.id], material)}
                onLineGleich={setLineGleich}
              />
            ))}
        </div>
      ) : null}

      {styleLine?.handleOptions ? (
        <div className={styles.handleBlock}>
          <span className={styles.blockLabel}>Griff-Optionen</span>
          <div className={styles.handleChecks}>
            <label className={[styles.check, element.griff ? styles.checkDisabled : ''].filter(Boolean).join(' ')}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={Boolean(element.pto)}
                disabled={Boolean(element.griff)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? { pto: true, griff: false, griffId: undefined, griffFarbe: undefined }
                      : { pto: false },
                  )
                }
              />
              PTO (Push-to-Open)
            </label>
            <label className={[styles.check, element.pto ? styles.checkDisabled : ''].filter(Boolean).join(' ')}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={Boolean(element.griff)}
                disabled={Boolean(element.pto)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? { griff: true, pto: false }
                      : { griff: false, griffId: undefined, griffFarbe: undefined },
                  )
                }
              />
              Griff
            </label>
          </div>
          <p className={styles.handleHint}>PTO und Griff schließen sich gegenseitig aus.</p>
          {element.griff ? (
            <Select
              label="Griff-Auswahl"
              placeholder="Bitte Griff wählen"
              options={getAvailableHandles(element.styleLineId).map((handle) => ({
                value: handle.id,
                label: handle.label,
              }))}
              value={element.griffId ?? ''}
              onChange={(event) => onChange({ griffId: event.target.value })}
            />
          ) : null}
          {styleLine?.id === 'glossy' || styleLine?.id === 'less' ? (
            <p className={styles.handleHint}>
              Bei Glossy/Less nicht möglich: Griff Nr. 103, 125, 126, 128 und Edge. Nr. 127 ist
              ausschließlich hier möglich (wird auf das Glas geklebt).
            </p>
          ) : null}
          {element.griff && element.griffId ? (
            <TextField
              label="Griffdetails"
              placeholder="z. B. Oberfläche od. Farbe / Sondergriff / spezielle Position"
              value={element.griffFarbe ?? ''}
              onChange={(event) => onChange({ griffFarbe: event.target.value })}
            />
          ) : null}
        </div>
      ) : null}

      {type?.laufschiene ? (
        <TextField
          label="Laufschienenfarbe (einläufig)"
          placeholder="z. B. RAL 9005, alu eloxiert"
          value={element.laufschienenfarbe ?? ''}
          onChange={(event) => onChange({ laufschienenfarbe: event.target.value })}
        />
      ) : null}

      {/* Überarbeitung 3: nur noch „Edge"; bei Curve mit Mattlack/anders entfällt das Profil ganz. */}
      {type?.griffProfil && !griffProfilEntfaellt ? (
        <div className={styles.styleBlock}>
          <span className={styles.blockLabel}>Griffprofil</span>
          <div className={styles.styleChips}>
            <button
              type="button"
              className={[styles.chip, element.griffProfil === 'edge' ? styles.chipActive : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => onChange({ griffProfil: 'edge' })}
              aria-pressed={element.griffProfil === 'edge'}
            >
              Edge
            </button>
          </div>
          {/* Punkt 7.13 – keine feste Liste: alle RAL-Classic-Farben sind möglich. */}
          {element.griffProfil ? (
            <TextField
              label="Pulverfarbe Griffprofil"
              placeholder="z. B. RAL 9005 – alle RAL-Classic-Farben möglich"
              value={element.griffProfilFarbe ?? ''}
              onChange={(event) => onChange({ griffProfilFarbe: event.target.value })}
            />
          ) : null}
        </div>
      ) : null}

      {heightViolation ? (
        <p className={styles.warning} role="alert">
          ⚠ {type?.label} maximal bis {maxHeight} cm Höhe zulässig! (aktuell {element.heightCm} cm)
        </p>
      ) : null}
    </div>
  )
}

function FieldRenderer({
  field,
  styleLine,
  element,
  value,
  onChange,
  onMaterialChange,
  onLineGleich,
}: {
  field: FrontField
  styleLine: FrontStyleLine
  element: FrontElement
  value: FrontFieldValue | undefined
  onChange: (value: FrontFieldValue) => void
  onMaterialChange: (material: MaterialSelection) => void
  onLineGleich: (gleich: boolean) => void
}) {
  if (field.kind === 'freetext') {
    return (
      <TextField
        label={field.label}
        placeholder={field.placeholder}
        value={value?.text ?? ''}
        onChange={(event) => onChange({ text: event.target.value })}
      />
    )
  }

  // „Line"-Aufkantung: ein einzelnes Dropdown über eine oder drei Materialgruppen.
  if (field.groupsFromFrontscheibe) {
    return <AufkantungField field={field} element={element} value={value} onChange={onChange} />
  }

  const material = value?.material
  const gruppeId = material?.materialGroupId
  const istAnders = gruppeId === MATERIAL_CUSTOM_ID
  const gruppeLabel = getMaterialGroup(gruppeId)?.label
  const istLineMaterial = Boolean(styleLine.frontscheibeAufkantung) && field.id === 'material'
  const getrennt = istLineMaterial && element.lineAufkantungGleich === false && gruppeId != null && !istAnders
  const hatAuswahl = Boolean(material?.optionId) || Boolean(material?.customText?.trim())
  /**
   * Bei „Line" folgt die Ja/Nein-Frage DIREKT auf die Materialwahl – die Ausführung kommt
   * erst danach: bei „Ja" das gewohnte Dropdown von `MaterialSelect`, bei „Nein" die beiden
   * getrennten Felder Frontscheibe und Aufkantung.
   */
  const lineFrageOffen = istLineMaterial && !istAnders && gruppeId != null && element.lineAufkantungGleich == null

  return (
    <div className={styles.matField}>
      <span className={styles.matLabel}>{field.label}</span>
      <MaterialSelect
        groupIds={field.materialGroupIds ?? []}
        allowCustom={field.allowCustom ?? false}
        value={material}
        onChange={onMaterialChange}
        customPlaceholder={field.customPlaceholder}
        hideOptionSelect={getrennt || lineFrageOffen}
        // Eigene Preisspalte (Line/107/Curve/Glossy·Less) statt PG 1–4.
        hideCustomPriceGroup={Boolean(styleLine.eigenePreisspalte)}
        priceColumnLabel={hatAuswahl ? styleLine.eigenePreisspalte : undefined}
      />

      {/* Überarbeitung 3 („Line"): Ja/Nein direkt nach der Materialwahl. */}
      {istLineMaterial && gruppeId != null && !istAnders ? (
        <div className={styles.styleBlock}>
          <span className={styles.blockLabel}>
            {gruppeId === 'glas'
              ? 'Glas der Frontscheibe und der Aufkantung gleich?'
              : 'Frontscheibe und der Aufkantung gleich?'}
          </span>
          <div className={styles.styleChips}>
            {[
              { gleich: true, label: 'Ja' },
              { gleich: false, label: 'Nein' },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                className={[
                  styles.chip,
                  element.lineAufkantungGleich === option.gleich ? styles.chipActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onLineGleich(option.gleich)}
                aria-pressed={element.lineAufkantungGleich === option.gleich}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Bei „Nein" ersetzt die Frontscheiben-Ausführung das normale Ausführungs-Dropdown. */}
      {getrennt ? (
        <Select
          label={`${gruppeLabel ?? 'Material'} – Ausführung Frontscheibe`}
          placeholder="Bitte wählen"
          options={(getMaterialGroup(gruppeId)?.options ?? []).map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          value={aktuelleOptionId(gruppeId, material?.optionId) ?? ''}
          onChange={(event) =>
            onMaterialChange({
              ...(material as MaterialSelection),
              optionId: event.target.value,
              priceGroup: resolvePriceGroup(gruppeId, event.target.value),
            })
          }
        />
      ) : null}

      {/* Überarbeitung 3: Bei „anders" steht alles im oberen Textfeld – der zweite
          Freitext unter der Preisgruppe entfällt. */}
      {field.withNote && !istAnders ? (
        <TextField
          label="Freitext"
          placeholder={field.notePlaceholder}
          value={value?.note ?? ''}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
        />
      ) : null}
    </div>
  )
}

/**
 * Aufkantung der Stil-Linie „Line": ein Dropdown, dessen Auswahl die Materialgruppe
 * mitführt – bei Furnier stehen alle Furniere, Gläser und Mattlacke zur Wahl.
 */
function AufkantungField({
  field,
  element,
  value,
  onChange,
}: {
  field: FrontField
  element: FrontElement
  value: FrontFieldValue | undefined
  onChange: (value: FrontFieldValue) => void
}) {
  const groupIds = aufkantungGroupIds(element)
  const frontGruppe = getMaterialGroup(frontMaterialGroupId(element))
  const material = value?.material
  const aktuell =
    material?.materialGroupId && material.optionId
      ? encodeAufkantungValue(
          material.materialGroupId,
          aktuelleOptionId(material.materialGroupId, material.optionId) ?? material.optionId,
        )
      : ''

  return (
    <div className={styles.matField}>
      <Select
        label={`${frontGruppe?.label ?? 'Material'} – ${field.label}`}
        placeholder="Bitte wählen"
        options={aufkantungOptions(groupIds)}
        value={aktuell}
        onChange={(event) => {
          const gewaehlt = decodeAufkantungValue(event.target.value)
          if (!gewaehlt) return
          onChange({
            ...value,
            material: {
              materialGroupId: gewaehlt.groupId,
              optionId: gewaehlt.optionId,
              priceGroup: resolvePriceGroup(gewaehlt.groupId, gewaehlt.optionId),
            },
          })
        }}
      />
    </div>
  )
}
