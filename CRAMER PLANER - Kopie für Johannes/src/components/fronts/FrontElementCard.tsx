import { useState } from 'react'
import { MaterialSelect } from '../material/MaterialSelect'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { getFrontType, getStyleLine, type FrontField } from '../../config/frontCatalog'
import { getAvailableHandles } from '../../config/handles'
import type { FrontElement, FrontFieldValue } from '../../types'
import styles from './FrontElementCard.module.css'

interface FrontElementCardProps {
  element: FrontElement
  onChange: (patch: Partial<FrontElement>) => void
  onRemove: () => void
  /** Phase A: „Werte übernehmen" – kopiert die Konfiguration der Referenzfront (gleicher Typ). */
  onCopyValues?: () => void
  /** Anzeigename der Quellfront für den Übernehmen-Button (z. B. „Front 1"). */
  copyFromLabel?: string
}

/**
 * Ein Front-Bauteil innerhalb einer Front-Typ-Spalte: Kennzeichnung (Pflicht),
 * Maße/Katalog-Code, Stil-Linie und die kaskadierenden Material-/Freitextfelder.
 * Griff-Optionen sind gegenseitig ausschließend (PTO ⇎ Griff); bei gleichem Front-Typ
 * wie die Referenzfront erscheint der „Werte übernehmen"-Button (Phase A).
 */
export function FrontElementCard({ element, onChange, onRemove, onCopyValues, copyFromLabel }: FrontElementCardProps) {
  const [labelTouched, setLabelTouched] = useState(false)
  const type = getFrontType(element.typeId)
  const styleLine = getStyleLine(element.typeId, element.styleLineId)
  const labelError = labelTouched && !element.label.trim() ? 'Kennzeichnung ist erforderlich.' : undefined
  const maxHeight = type?.maxHeightCm
  const heightNum = Number((element.heightCm ?? '').replace(',', '.'))
  const heightViolation = maxHeight != null && Number.isFinite(heightNum) && heightNum > maxHeight

  function setField(fieldId: string, value: FrontFieldValue) {
    onChange({ fieldValues: { ...element.fieldValues, [fieldId]: value } })
  }

  function pickStyleLine(styleLineId: string) {
    if (styleLineId === element.styleLineId) return
    // Stil-Wechsel setzt die (anders strukturierten) Felder zurück.
    const patch: Partial<FrontElement> = { styleLineId, fieldValues: {} }
    // Schritt 7: bei Wechsel zu Glossy/Less einen dort nicht mehr zulässigen Griff verwerfen.
    if (element.griffId && !getAvailableHandles(styleLineId).some((h) => h.id === element.griffId)) {
      patch.griffId = undefined
    }
    onChange(patch)
  }

  // Schritt 7: Felder mit `hideWhenSiblingGroupIn` ausblenden, wenn das Geschwister-
  // Materialfeld eine der genannten Gruppen (z. B. Decoboard/Xtreme Plus) gewählt hat.
  function isFieldHidden(field: FrontField): boolean {
    const rule = field.hideWhenSiblingGroupIn
    if (!rule) return false
    const siblingGroup = element.fieldValues?.[rule.fieldId]?.material?.materialGroupId
    return siblingGroup != null && rule.groups.includes(siblingGroup)
  }

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

      <div className={styles.sizeRow}>
        <TextField
          label="Breite (cm)"
          inputMode="decimal"
          placeholder="z. B. 50"
          value={element.widthCm ?? ''}
          onChange={(event) => onChange({ widthCm: event.target.value })}
        />
        <TextField
          label="Höhe (cm)"
          inputMode="decimal"
          placeholder="z. B. 200"
          value={element.heightCm ?? ''}
          onChange={(event) => onChange({ heightCm: event.target.value })}
        />
      </div>

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
          {styleLine.fields.filter((field) => !isFieldHidden(field)).map((field) => (
            <FieldRenderer
              key={field.id}
              field={field}
              value={element.fieldValues?.[field.id]}
              onChange={(value) => setField(field.id, value)}
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
              Bei Glossy/Less nicht möglich: Griff Nr. 103, 125, 126, 128.
            </p>
          ) : null}
          {element.griff && element.griffId ? (
            <TextField
              label="Farbe nach Griffwahl"
              placeholder="z. B. Edelstahl gebürstet, schwarz matt, RAL 9005"
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

      {type?.griffProfil ? (
        <div className={styles.styleBlock}>
          <span className={styles.blockLabel}>Griffprofil (zweiläufig)</span>
          <div className={styles.styleChips}>
            {(['edge', 'curve'] as const).map((profil) => (
              <button
                key={profil}
                type="button"
                className={[styles.chip, element.griffProfil === profil ? styles.chipActive : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onChange({ griffProfil: profil })}
                aria-pressed={element.griffProfil === profil}
              >
                {profil === 'edge' ? 'Edge' : 'Curve'}
              </button>
            ))}
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
  value,
  onChange,
}: {
  field: FrontField
  value: FrontFieldValue | undefined
  onChange: (value: FrontFieldValue) => void
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

  return (
    <div className={styles.matField}>
      <span className={styles.matLabel}>{field.label}</span>
      <MaterialSelect
        groupIds={field.materialGroupIds ?? []}
        allowCustom={field.allowCustom ?? false}
        value={value?.material}
        onChange={(material) => onChange({ ...value, material })}
      />
      {field.withNote ? (
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
