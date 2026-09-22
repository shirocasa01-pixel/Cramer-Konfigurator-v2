import { useState } from 'react'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { makeEquipmentItem } from '../../lib/frontsHelpers'
import {
  equipmentMaxRaster,
  equipmentSperrgrund,
  getEquipmentOption,
  isEquipmentAvailableInSondertiefe,
  type EquipmentChoice,
  type EquipmentOption,
  type SegmentMasse,
} from '../../config/equipment'
import { EQUIPMENT_FIELD_LABEL, beschreibeHoehe } from '../../lib/ausstattungFormat'
import { belegteRaster, benoetigteRaster, rasterKollisionen } from '../../lib/rasterBelegung'
import type { EquipmentHoehe, SegmentEquipmentItem } from '../../types'
import styles from './AusstattungHinterFrontSection.module.css'

interface Props {
  /** Front-Typen dieses Segments, hinter denen Ausstattung möglich ist (Drehtür/2läufig/Offen). */
  eligibleFrontTypes: string[]
  /** In Schritt 6 vorausgewählte Options-IDs. */
  selectedOptionIds: string[]
  /** Sondertiefe (< 60 cm) ⇒ nur die dafür freigegebenen Optionen (Überarbeitung 8, S. 1). */
  sondertiefe: boolean
  /** Korpus- und Frontmaße dieses Segments – Grundlage der Katalog-Regeln. */
  masse: SegmentMasse
  equipment: SegmentEquipmentItem[] | undefined
  onChange: (items: SegmentEquipmentItem[]) => void
}

/**
 * SCHRITT 8 – „Ausstattung hinter Fronten" je Segment (Refugium).
 *
 * Angeboten werden ausschließlich die in Schritt 6 vorausgewählten Optionen, gefiltert
 * nach den Front-Typen des Segments und – bei Sondertiefe – auf die dafür freigegebenen
 * Optionen (`availableInSondertiefe`, Überarbeitung 8).
 *
 * Überarbeitung 8, S. 5: Keine zwei Teile auf derselben Rasterposition — belegte Raster sind
 * im Dropdown gesperrt (mit dem Teil, das sie belegt), und eine Überschneidung, die durch ein
 * später hinzugefügtes Teil entsteht (Container unter bestehenden Böden), wird gemeldet.
 *
 * Überarbeitung 2_2: Die Einbauhöhe wird vorrangig in RASTERN erfasst (cm nur als
 * Ausnahme, „am Korpusboden" wo der Katalog es vorsieht), Einlegeböden bekommen je Stück
 * eine eigene Höhe, und Regeln wie „Rollkorb nur 50/60/100er" oder „kein Kleiderlift unter
 * 45er" kommen aus dem Katalog statt aus Sonderfällen in dieser Komponente. Diese Datei
 * rendert nur, was `config/equipment.ts` beschreibt.
 */
export function AusstattungHinterFrontSection({
  eligibleFrontTypes,
  selectedOptionIds,
  sondertiefe,
  masse,
  equipment,
  onChange,
}: Props) {
  const items = equipment ?? []
  const [open, setOpen] = useState(items.length > 0)
  const maxRaster = equipmentMaxRaster(masse.korpusRaster)

  // Verfügbare Optionen: vorausgewählt ∧ (kein Front-Typ-Filter ODER Schnittmenge) ∧ Sondertiefe-Regel.
  const options: EquipmentOption[] = selectedOptionIds
    .map(getEquipmentOption)
    .filter((o): o is EquipmentOption => o !== undefined)
    .filter((o) => !o.frontTypes || o.frontTypes.some((t) => eligibleFrontTypes.includes(t)))
    .filter((o) => !sondertiefe || isEquipmentAvailableInSondertiefe(o.id))

  const itemFor = (optionId: string) => items.find((i) => i.optionId === optionId)
  const kollisionen = rasterKollisionen(items, masse.korpusRaster)

  /** Im Segment konfigurierte Teile, auf die sich ein Bezug richten darf. */
  function bezugsZiele(option: EquipmentOption): SegmentEquipmentItem[] {
    const erlaubt = new Set(option.bezug?.optionIds ?? [])
    return items.filter((i) => erlaubt.has(i.optionId))
  }

  function toggleOption(option: EquipmentOption) {
    const existing = itemFor(option.id)
    if (existing) {
      // Ein entferntes Teil darf kein Bezugsziel bleiben – sonst zeigt die Unterteilung
      // auf eine Schublade, die es nicht mehr gibt.
      onChange(
        items
          .filter((i) => i.optionId !== option.id)
          .map((i) => (i.bezugId === existing.id ? { ...i, bezugId: undefined } : i)),
      )
    } else {
      onChange([...items, makeEquipmentItem(option.id)])
    }
  }
  function patchItem(id: string, patch: Partial<SegmentEquipmentItem>) {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  /** Höhenliste auf die Stückzahl bringen (je Stück eine Höhe). */
  function hoehenFuer(item: SegmentEquipmentItem, option: EquipmentOption): EquipmentHoehe[] {
    const anzahl = option.heightPerPiece ? Math.max(1, item.qty ?? 1) : 1
    const vorhanden = item.hoehen ?? []
    return Array.from({ length: anzahl }, (_, i) => vorhanden[i] ?? { modus: 'raster' })
  }
  function setHoehe(item: SegmentEquipmentItem, option: EquipmentOption, index: number, hoehe: EquipmentHoehe) {
    const liste = hoehenFuer(item, option)
    liste[index] = hoehe
    patchItem(item.id, { hoehen: liste })
  }

  function setChoice(item: SegmentEquipmentItem, choice: EquipmentChoice, wert: string) {
    patchItem(item.id, { choices: { ...item.choices, [choice.id]: wert } })
  }
  function setChoiceText(item: SegmentEquipmentItem, choice: EquipmentChoice, text: string) {
    patchItem(item.id, { choiceTexte: { ...item.choiceTexte, [choice.id]: text } })
  }

  function setSeite(item: SegmentEquipmentItem, links: boolean, rechts: boolean) {
    patchItem(item.id, { seiten: { links, rechts } })
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
          {kollisionen.length > 0 ? (
            <ul className={styles.kollisionen} role="alert">
              {kollisionen.map((k, i) => (
                <li key={i}>{k.text}</li>
              ))}
            </ul>
          ) : null}
          {options.length === 0 ? (
            <p className={styles.empty}>
              {selectedOptionIds.length === 0
                ? 'Keine Ausstattung vorausgewählt. In Schritt „Ausstattung" auswählen.'
                : 'Für diesen Front-Typ ist keine der vorausgewählten Optionen vorgesehen.'}
            </p>
          ) : (
            options.map((option) => {
              const item = itemFor(option.id)
              const sperrgrund = equipmentSperrgrund(option, masse)
              const ziele = bezugsZiele(option)
              // Pflicht-Bezug ohne Ziel: die Option ist fachlich nicht montierbar.
              const fehlenderBezug =
                option.bezug?.pflicht && ziele.length === 0
                  ? `Erst möglich, wenn ${option.bezug.optionIds
                      .map((id) => getEquipmentOption(id)?.label ?? id)
                      .join(' oder ')} im Segment geplant ist.`
                  : null
              const gesperrt = sperrgrund ?? fehlenderBezug

              return (
                <div key={option.id} className={styles.option}>
                  <label
                    className={[styles.optionHead, gesperrt && !item ? styles.optionGesperrt : '']
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={Boolean(item)}
                      disabled={Boolean(gesperrt) && !item}
                      onChange={() => toggleOption(option)}
                    />
                    <span className={styles.optionText}>
                      <span className={styles.optionLabel}>{option.label}</span>
                      {gesperrt ? (
                        <span className={styles.optionSperre}>{gesperrt}</span>
                      ) : option.hint ? (
                        <span className={styles.optionHint}>{option.hint}</span>
                      ) : null}
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
                            <span className={styles.fieldLabel}>
                              {EQUIPMENT_FIELD_LABEL.qty}
                              {option.maxAnzahl ? ` (max. ${option.maxAnzahl})` : ''}
                            </span>
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
                                disabled={option.maxAnzahl != null && (item.qty ?? 1) >= option.maxAnzahl}
                                aria-label="Menge erhöhen"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {option.detailFields?.includes('format') ? (
                          <TextField
                            label={EQUIPMENT_FIELD_LABEL.format}
                            placeholder={option.formatPlaceholder ?? 'z. B. 40 × 120 cm'}
                            value={item.formatNote ?? ''}
                            onChange={(e) => patchItem(item.id, { formatNote: e.target.value })}
                          />
                        ) : null}
                        {option.detailFields?.includes('position') ? (
                          <TextField
                            label={EQUIPMENT_FIELD_LABEL.position}
                            placeholder={option.positionPlaceholder ?? 'z. B. links, oben'}
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
                            placeholder={option.notePlaceholder ?? 'z. B. Sonderausstattung, Griff …'}
                            value={item.note ?? ''}
                            onChange={(e) => patchItem(item.id, { note: e.target.value })}
                          />
                        ) : null}
                      </div>

                      {/* Einbauhöhe – Raster als Regelfall (Überarbeitung 2_2). */}
                      {option.heightMode && option.heightMode !== 'keine' ? (
                        <div className={styles.hoehenBlock}>
                          <span className={styles.fieldLabel}>
                            {option.heightPerPiece ? 'Einbauhöhe je Stück' : 'Einbauhöhe'}
                          </span>
                          {hoehenFuer(item, option).map((hoehe, index) => (
                            <HoehenZeile
                              key={index}
                              nummer={option.heightPerPiece ? index + 1 : undefined}
                              hoehe={hoehe}
                              maxRaster={maxRaster}
                              mitBoden={option.heightMode === 'raster-oder-boden'}
                              belegt={belegteRaster(items, { itemId: item.id, stueck: index })}
                              benoetigt={(start) => benoetigteRaster(item, start)}
                              onChange={(neu) => setHoehe(item, option, index, neu)}
                            />
                          ))}
                          <span className={styles.hoehenHinweis}>
                            Raster 1–{maxRaster}
                            {masse.korpusRaster
                              ? ` (Korpus ${masse.korpusRaster} Raster – der oberste ist der Korpusdeckel)`
                              : ''}
                            . Zentimeter nur als Sonderhöhe.
                          </span>
                          {/*
                            Überarbeitung 6, S. 3 & 4: „Hier müssen wir definieren, was es
                            bedeutet, eine Schublade auf einer Höhe von 2 Raster einzubauen.
                            Die Unterkante der Innenschublade befindet sich also auf einer
                            Höhe von 2 Raster." Dieselbe Lesart gilt für jedes eingebaute
                            Teil — sie gehört deshalb an den Höhenblock, nicht an eine Option.
                          */}
                          <span className={styles.hoehenHinweis}>
                            Die Rasterhöhe bezeichnet die <strong>Unterkante</strong> des Teils: „2 Raster"
                            heißt, das Teil sitzt mit seiner Unterkante auf Raster 2.
                          </span>
                        </div>
                      ) : null}

                      {/* Zusatz-Auswahlen aus dem Katalog (Kleiderstange, Glasart, Seite, Breite). */}
                      {option.choices?.map((choice) => {
                        const wert = item.choices?.[choice.id] ?? choice.standard ?? ''
                        return (
                          <div key={choice.id} className={styles.fields}>
                            <Select
                              label={choice.label}
                              placeholder={choice.standard ? undefined : 'Bitte wählen'}
                              options={choice.options.map((o) => ({ value: o.value, label: o.label }))}
                              value={wert}
                              onChange={(e) => setChoice(item, choice, e.target.value)}
                            />
                            {choice.freitextBei && wert === choice.freitextBei.wert ? (
                              <TextField
                                label={choice.freitextBei.label}
                                placeholder={choice.freitextBei.platzhalter}
                                value={item.choiceTexte?.[choice.id] ?? ''}
                                onChange={(e) => setChoiceText(item, choice, e.target.value)}
                              />
                            ) : null}
                          </div>
                        )
                      })}

                      {/* Bezug auf ein anderes Teil des Segments. */}
                      {option.bezug ? (
                        <div className={styles.fields}>
                          <Select
                            label={option.bezug.label}
                            placeholder="Bitte wählen"
                            options={ziele.map((z, i) => ({
                              value: z.id,
                              label: `${getEquipmentOption(z.optionId)?.label ?? z.optionId}${
                                ziele.filter((x) => x.optionId === z.optionId).length > 1 ? ` (${i + 1})` : ''
                              }`,
                            }))}
                            value={item.bezugId ?? ''}
                            onChange={(e) => patchItem(item.id, { bezugId: e.target.value })}
                          />
                        </div>
                      ) : null}

                      {/* Position als Kästchen statt Freitext. */}
                      {option.positionSeiten ? (
                        <div className={styles.hoehenBlock}>
                          <span className={styles.fieldLabel}>{EQUIPMENT_FIELD_LABEL.position}</span>
                          {/*
                            Radio-Gruppe statt Kästchen: Die drei Angaben schließen einander
                            aus — „links & rechts" und „nur links" gleichzeitig gibt es nicht.
                            Als Checkboxen ließe sich genau das anklicken.
                          */}
                          <div
                            className={styles.seiten}
                            role="radiogroup"
                            aria-label={EQUIPMENT_FIELD_LABEL.position}
                          >
                            {[
                              { label: 'Nur links', links: true, rechts: false },
                              { label: 'Nur rechts', links: false, rechts: true },
                              { label: 'Links & rechts', links: true, rechts: true },
                            ].map((w) => {
                              const aktiv =
                                Boolean(item.seiten?.links) === w.links && Boolean(item.seiten?.rechts) === w.rechts
                              return (
                                <label key={w.label} className={styles.seiteOption}>
                                  <input
                                    type="radio"
                                    className={styles.radio}
                                    name={`seiten-${item.id}`}
                                    checked={aktiv}
                                    onChange={() => setSeite(item, w.links, w.rechts)}
                                  />
                                  <span>{w.label}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      ) : null}

                      {option.preisAusKorpusbreite ? (
                        <p className={styles.hoehenHinweis}>
                          Preis ergibt sich automatisch aus der Korpusbreite
                          {masse.korpusBreiteCm ? ` (${masse.korpusBreiteCm}er Korpus)` : ''} — keine Auswahl nötig.
                        </p>
                      ) : null}

                      {/* Altbestand: vor der Umstellung erfasste Freitext-Höhe sichtbar halten. */}
                      {item.heightNote?.trim() ? (
                        <p className={styles.hoehenHinweis}>
                          Frühere Höhenangabe (Freitext): ca. {item.heightNote.trim()}
                        </p>
                      ) : null}

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

/**
 * Eine Einbauhöhe: Modus-Chips (Raster · Sonderhöhe cm · am Korpusboden) und das dazu
 * passende Eingabefeld. „Raster" ist vorausgewählt, weil die AV in Rastern plant.
 */
function HoehenZeile({
  nummer,
  hoehe,
  maxRaster,
  mitBoden,
  belegt,
  benoetigt,
  onChange,
}: {
  nummer?: number
  hoehe: EquipmentHoehe
  maxRaster: number
  mitBoden: boolean
  /** Raster, die andere Teile schon belegen (Raster → Klartext des belegenden Teils). */
  belegt: Map<number, string>
  /** Raster, die dieses Teil ab einer Starthöhe belegen würde (Schublade 2R → zwei). */
  benoetigt: (start: number) => number[]
  onChange: (hoehe: EquipmentHoehe) => void
}) {
  /** Warum eine Rasterstufe nicht wählbar ist — oder `null`. */
  const sperre = (r: number): string | null => {
    for (const x of benoetigt(r)) {
      if (x > maxRaster) return 'reicht über den Korpus'
      const durch = belegt.get(x)
      if (durch) return `belegt: ${durch}`
    }
    return null
  }
  const modi: { wert: EquipmentHoehe['modus']; label: string }[] = [
    { wert: 'raster', label: 'Rasterhöhe' },
    { wert: 'cm', label: 'Sonderhöhe (cm)' },
    ...(mitBoden ? [{ wert: 'boden' as const, label: 'am Korpusboden' }] : []),
  ]

  return (
    <div className={styles.hoehenZeile}>
      {nummer ? <span className={styles.hoehenNummer}>{nummer}.</span> : null}
      <div className={styles.chips}>
        {modi.map((m) => (
          <button
            key={m.wert}
            type="button"
            className={hoehe.modus === m.wert ? styles.chipActive : styles.chip}
            onClick={() => onChange({ modus: m.wert })}
            aria-pressed={hoehe.modus === m.wert}
          >
            {m.label}
          </button>
        ))}
      </div>
      {hoehe.modus === 'raster' ? (
        <select
          className={styles.rasterSelect}
          aria-label={`Rasterhöhe${nummer ? ` ${nummer}` : ''}`}
          value={hoehe.raster ?? ''}
          onChange={(e) => onChange({ modus: 'raster', raster: Number(e.target.value) })}
        >
          <option value="" disabled>
            Raster wählen
          </option>
          {Array.from({ length: maxRaster }, (_, i) => i + 1).map((r) => {
            const grund = sperre(r)
            // Die aktuelle Auswahl bleibt wählbar, damit ein Konflikt sichtbar bleibt (Meldung oben).
            return (
              <option key={r} value={r} disabled={Boolean(grund) && hoehe.raster !== r}>
                {r} Raster{grund ? ` – ${grund}` : ''}
              </option>
            )
          })}
        </select>
      ) : hoehe.modus === 'cm' ? (
        <input
          className={styles.cmInput}
          inputMode="decimal"
          aria-label={`Sonderhöhe in cm${nummer ? ` ${nummer}` : ''}`}
          placeholder="ca. cm"
          value={hoehe.cm ?? ''}
          onChange={(e) => onChange({ modus: 'cm', cm: e.target.value })}
        />
      ) : (
        <span className={styles.hoehenFest}>{beschreibeHoehe(hoehe)}</span>
      )}
    </div>
  )
}
