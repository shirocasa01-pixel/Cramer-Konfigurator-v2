import { useState } from 'react'
import { TextField } from '../ui/TextField'
import { makeEquipmentItem } from '../../lib/frontsHelpers'
import {
  getEquipmentOption,
  isEquipmentAvailableInSondertiefe,
  type EquipmentOption,
} from '../../config/equipment'
import { EQUIPMENT_FIELD_LABEL } from '../../lib/ausstattungFormat'
import type { SegmentEquipmentItem } from '../../types'
import styles from './AusstattungHinterFrontSection.module.css'

interface Props {
  /** Front-Typen dieses Segments, hinter denen Ausstattung möglich ist (Drehtür/2läufig/Offen). */
  eligibleFrontTypes: string[]
  /** In Schritt 6 vorausgewählte Options-IDs. */
  selectedOptionIds: string[]
  /** Sondertiefe (< 60 cm) ⇒ nur Einlegeböden. */
  sondertiefe: boolean
  equipment: SegmentEquipmentItem[] | undefined
  onChange: (items: SegmentEquipmentItem[]) => void
}

/**
 * SCHRITT 8 – „Ausstattung hinter Fronten" je Segment (Refugium). Angeboten werden
 * ausschließlich die in Schritt 6 vorausgewählten Optionen, gefiltert nach den
 * Front-Typen des Segments (z. B. Innenspiegel nur bei Drehtür) und – bei Sondertiefe –
 * auf Einlegeböden beschränkt. Detailfelder je Option datengetrieben aus `equipment.ts`.
 */
export function AusstattungHinterFrontSection({
  eligibleFrontTypes,
  selectedOptionIds,
  sondertiefe,
  equipment,
  onChange,
}: Props) {
  const items = equipment ?? []
  const [open, setOpen] = useState(items.length > 0)

  // Verfügbare Optionen: vorausgewählt ∧ (kein Front-Typ-Filter ODER Schnittmenge) ∧ Sondertiefe-Regel.
  const options: EquipmentOption[] = selectedOptionIds
    .map(getEquipmentOption)
    .filter((o): o is EquipmentOption => o !== undefined)
    .filter((o) => !o.frontTypes || o.frontTypes.some((t) => eligibleFrontTypes.includes(t)))
    .filter((o) => !sondertiefe || isEquipmentAvailableInSondertiefe(o.id))

  const itemFor = (optionId: string) => items.find((i) => i.optionId === optionId)

  function toggleOption(optionId: string) {
    const existing = itemFor(optionId)
    if (existing) onChange(items.filter((i) => i.optionId !== optionId))
    else onChange([...items, makeEquipmentItem(optionId)])
  }
  function patchItem(id: string, patch: Partial<SegmentEquipmentItem>) {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>
          Ausstattung hinter der Front
          {items.length > 0 ? <span className={styles.badge}>{items.length}</span> : null}
        </span>
        <span className={styles.chev} aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open ? (
        <div className={styles.body}>
          {options.length === 0 ? (
            <p className={styles.empty}>
              {selectedOptionIds.length === 0
                ? 'Keine Ausstattung vorausgewählt. In Schritt „Ausstattung" auswählen.'
                : 'Für diesen Front-Typ ist keine der vorausgewählten Optionen vorgesehen.'}
            </p>
          ) : (
            options.map((option) => {
              const item = itemFor(option.id)
              return (
                <div key={option.id} className={styles.option}>
                  <label className={styles.optionHead}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={Boolean(item)}
                      onChange={() => toggleOption(option.id)}
                    />
                    <span className={styles.optionText}>
                      <span className={styles.optionLabel}>{option.label}</span>
                      {option.hint ? <span className={styles.optionHint}>{option.hint}</span> : null}
                    </span>
                  </label>

                  {item ? (
                    <div className={styles.detail}>
                      {option.variants ? (
                        <div className={styles.variants}>
                          <span className={styles.variantLabel}>{option.variantLabel ?? 'Variante'}</span>
                          <div className={styles.chips}>
                            {option.variants.map((v) => (
                              <button
                                key={v.value}
                                type="button"
                                className={item.variant === v.value ? styles.chipActive : styles.chip}
                                onClick={() => patchItem(item.id, { variant: v.value })}
                                aria-pressed={item.variant === v.value}
                              >
                                {v.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className={styles.fields}>
                        {option.detailFields?.includes('qty') ? (
                          <div className={styles.stepperField}>
                            <span className={styles.fieldLabel}>{EQUIPMENT_FIELD_LABEL.qty}</span>
                            <div className={styles.stepper}>
                              <button
                                type="button"
                                className={styles.stepBtn}
                                onClick={() => patchItem(item.id, { qty: Math.max(1, (item.qty ?? 1) - 1) })}
                                disabled={(item.qty ?? 1) <= 1}
                                aria-label="Menge verringern"
                              >
                                −
                              </button>
                              <span className={styles.stepValue}>{item.qty ?? 1}</span>
                              <button
                                type="button"
                                className={styles.stepBtn}
                                onClick={() => patchItem(item.id, { qty: (item.qty ?? 1) + 1 })}
                                aria-label="Menge erhöhen"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {option.detailFields?.includes('height') ? (
                          <TextField
                            label={EQUIPMENT_FIELD_LABEL.height}
                            placeholder="z. B. auf 120 cm, verstellbar"
                            value={item.heightNote ?? ''}
                            onChange={(e) => patchItem(item.id, { heightNote: e.target.value })}
                          />
                        ) : null}
                        {option.detailFields?.includes('format') ? (
                          <TextField
                            label={EQUIPMENT_FIELD_LABEL.format}
                            placeholder="z. B. 40 × 120 cm"
                            value={item.formatNote ?? ''}
                            onChange={(e) => patchItem(item.id, { formatNote: e.target.value })}
                          />
                        ) : null}
                        {option.detailFields?.includes('position') ? (
                          <TextField
                            label={EQUIPMENT_FIELD_LABEL.position}
                            placeholder="z. B. links, oben"
                            value={item.positionNote ?? ''}
                            onChange={(e) => patchItem(item.id, { positionNote: e.target.value })}
                          />
                        ) : null}
                        {option.detailFields?.includes('lfm') ? (
                          <TextField
                            label={EQUIPMENT_FIELD_LABEL.lfm}
                            inputMode="decimal"
                            placeholder="z. B. 2,4"
                            value={item.lfm ?? ''}
                            onChange={(e) => patchItem(item.id, { lfm: e.target.value })}
                          />
                        ) : null}
                        {option.detailFields?.includes('note') ? (
                          <TextField
                            label={EQUIPMENT_FIELD_LABEL.note}
                            placeholder="Freitext"
                            value={item.note ?? ''}
                            onChange={(e) => patchItem(item.id, { note: e.target.value })}
                          />
                        ) : null}
                      </div>

                      {option.detailFields?.includes('rauchglas') ? (
                        <label className={styles.check}>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={Boolean(item.rauchglas)}
                            onChange={(e) => patchItem(item.id, { rauchglas: e.target.checked })}
                          />
                          Aufpreis: Deckplatte in Rauchglas (statt Dekor)
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
