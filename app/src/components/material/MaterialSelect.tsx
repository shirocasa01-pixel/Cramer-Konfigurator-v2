import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import {
  aktuelleOptionId,
  aufloeseMaterialGroupIds,
  getMaterialGroup,
  getMaterialOption,
  MATERIAL_CUSTOM_ID,
  MATERIAL_NONE_ID,
} from '../../config/materialMatrix'
import { PRICE_GROUP_LABEL } from '../../lib/materialFormat'
import { resolvePriceGroup } from '../../lib/materialRules'
import { useStammdaten } from '../../lib/useStammdaten'
import type { MaterialGroup, MaterialSelection, PriceGroup } from '../../types'
import styles from './MaterialSelect.module.css'

interface MaterialSelectProps {
  /** Zulässige Materialgruppen-IDs (aus der Bereichs-/Feld-Konfiguration). */
  groupIds: string[]
  /** „anders“ (Freitext) anbieten. */
  allowCustom: boolean
  /** Optionaler „Keine …“-Chip (z. B. „Keine Abdeckplatte“); erfüllt die Auswahl ohne Material. */
  noneLabel?: string
  value: MaterialSelection | undefined
  onChange: (selection: MaterialSelection) => void
  /** Kontextabhängiger Freitext-Platzhalter. */
  customPlaceholder?: string
  /** Anzeige-Label je Gruppen-ID überschreiben – Erweiterungspunkt für serien-/kontextspezifische Bezeichnungen. */
  groupLabels?: Record<string, string>
  /** Phase B: Options-IDs aus dem Ausführungs-Dropdown ausschließen (z. B. Abdeckplatte: Rauchglas). */
  excludeOptionIds?: string[]
  /**
   * Überarbeitung 3 („Line" mit getrennter Frontscheibe/Aufkantung): nur die Gruppen-Chips
   * rendern – das Ausführungs-Dropdown baut der Aufrufer selbst (zwei statt eines Feldes).
   */
  hideOptionSelect?: boolean
  /** Abweichendes Label des Ausführungs-Dropdowns (z. B. „Gläser – Ausführung Frontscheibe"). */
  optionSelectLabel?: string
  /**
   * Überarbeitung 3: Stil-Linien mit eigener Preisspalte (Line, 107, Curve, Glossy/Less)
   * sind nicht aus PG 1–4 wählbar – die manuelle Preisgruppen-Auswahl bei „anders" entfällt.
   */
  hideCustomPriceGroup?: boolean
  /**
   * Überarbeitung 3: Anzeige-Label der eigenen Preisspalte (z. B. „Line"). Ersetzt die
   * numerische PG-Anzeige, weil „Preisgruppe 3" bei diesen Linien schlicht falsch ist.
   */
  priceColumnLabel?: string
}

/**
 * Wiederverwendbare Material-Auswahl: Materialgruppe (Chips) → konkrete Option
 * (Dropdown aus zentraler Farbmatrix) bzw. „anders“ (Freitext) bzw. „Keine …“.
 * Die Preisgruppe wird automatisch im Hintergrund zugewiesen. Genutzt in Phase 4
 * (Korpus) und Phase 5 (Fronten).
 */
export function MaterialSelect({
  groupIds,
  allowCustom,
  noneLabel,
  value,
  onChange,
  customPlaceholder,
  groupLabels,
  excludeOptionIds,
  hideOptionSelect,
  optionSelectLabel,
  hideCustomPriceGroup,
  priceColumnLabel,
}: MaterialSelectProps) {
  // Am Store hängen, damit eine Änderung im Reiter „Oberflächen" sofort in dieser
  // Auswahl steht — ohne Neuladen und ohne dass der Aufrufer etwas davon wissen muss.
  useStammdaten()

  const groups = aufloeseMaterialGroupIds(groupIds)
    .map(getMaterialGroup)
    .filter((group): group is MaterialGroup => group !== undefined)
  const labelFor = (group: MaterialGroup) => groupLabels?.[group.id] ?? group.label

  const activeGroupId = value?.materialGroupId
  const isCustom = activeGroupId === MATERIAL_CUSTOM_ID
  const isNone = activeGroupId === MATERIAL_NONE_ID
  const activeGroup = isCustom || isNone ? undefined : getMaterialGroup(activeGroupId)
  const selectedOption = activeGroup ? getMaterialOption(activeGroupId, value?.optionId) : undefined
  const pg = value?.priceGroup

  function pickGroup(groupId: string) {
    if (groupId === activeGroupId) return
    if (groupId === MATERIAL_CUSTOM_ID) {
      onChange({ materialGroupId: MATERIAL_CUSTOM_ID, customText: '', priceGroup: undefined })
    } else if (groupId === MATERIAL_NONE_ID) {
      onChange({ materialGroupId: MATERIAL_NONE_ID, priceGroup: undefined })
    } else {
      onChange({ materialGroupId: groupId }) // konkrete Option folgt im nächsten Schritt
    }
  }

  function pickOption(optionId: string) {
    if (!activeGroupId) return
    // Kontext-Notiz (z. B. Abdeckplatte-Glas-Spezifikation) über den Options-Wechsel erhalten —
    // außer sie war der Farbcode einer Sonderfarbe: „NCS S 7010-B" gehört nicht zu RAL Design.
    const warFarbcode = Boolean(selectedOption?.requiresFreeText) && optionId !== selectedOption?.id
    onChange({
      materialGroupId: activeGroupId,
      optionId,
      priceGroup: resolvePriceGroup(activeGroupId, optionId),
      note: warFarbcode ? undefined : value?.note,
    })
  }

  function setCustomText(text: string) {
    // Schritt 5: Preisgruppe bei „anders" wird manuell gewählt (nicht mehr aus dem Text abgeleitet).
    onChange({ materialGroupId: MATERIAL_CUSTOM_ID, customText: text, priceGroup: value?.priceGroup })
  }
  function setCustomPg(next: PriceGroup) {
    onChange({ materialGroupId: MATERIAL_CUSTOM_ID, customText: value?.customText, priceGroup: next })
  }

  const showOpenPg = isCustom && Boolean(value?.customText?.trim()) && !pg

  function chipClass(active: boolean) {
    return [styles.chip, active ? styles.chipActive : ''].filter(Boolean).join(' ')
  }

  return (
    <div className={styles.root}>
      <div className={styles.chips} role="group" aria-label="Materialgruppe">
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            className={chipClass(activeGroupId === group.id)}
            onClick={() => pickGroup(group.id)}
            aria-pressed={activeGroupId === group.id}
          >
            {labelFor(group)}
          </button>
        ))}
        {allowCustom ? (
          <button
            type="button"
            className={chipClass(isCustom)}
            onClick={() => pickGroup(MATERIAL_CUSTOM_ID)}
            aria-pressed={isCustom}
          >
            anders
          </button>
        ) : null}
        {noneLabel ? (
          <button
            type="button"
            className={chipClass(isNone)}
            onClick={() => pickGroup(MATERIAL_NONE_ID)}
            aria-pressed={isNone}
          >
            {noneLabel}
          </button>
        ) : null}
      </div>

      {activeGroup && !hideOptionSelect ? (
        <div className={styles.detail}>
          <Select
            label={optionSelectLabel ?? `${labelFor(activeGroup)} – Ausführung`}
            placeholder="Bitte wählen"
            options={activeGroup.options
              .filter((option) => !excludeOptionIds?.includes(option.id))
              .map((option) => ({ value: option.id, label: option.label }))}
            // Alt-IDs auflösen, sonst zeigt das Dropdown bei Altentwürfen den ersten Eintrag.
            value={aktuelleOptionId(activeGroupId, value?.optionId) ?? ''}
            onChange={(event) => pickOption(event.target.value)}
          />
        </div>
      ) : null}

      {/*
        Überarbeitung 9, S. 4: Bei Sonderfarben (und hinterlackierten Gläsern) ist der
        Farbcode Pflicht — bei den Standardfarben erscheint das Feld gar nicht. Welche
        Oberfläche ihn verlangt, steht in den Stammdaten (Oberfläche → „Freitext").
      */}
      {activeGroup && value && selectedOption?.requiresFreeText ? (
        <div className={styles.detail}>
          <TextField
            label={`${selectedOption.freeTextLabel ?? 'Farbton / Farbnummer'} *`}
            placeholder="z. B. RAL 7016, NCS S 7010-B, Sikkens F6.28.66 …"
            required
            value={value.note ?? ''}
            onChange={(event) => onChange({ ...value, note: event.target.value })}
            error={value.note?.trim() ? undefined : 'Pflichtfeld – bitte den Farbton / die Farbnummer eintragen.'}
          />
        </div>
      ) : null}

      {isCustom ? (
        <>
          <div className={styles.detail}>
            <TextField
              label="Sonderausführung (anders)"
              placeholder={customPlaceholder ?? 'z. B. RAL 3020, Sikkens, NCS …'}
              value={value?.customText ?? ''}
              onChange={(event) => setCustomText(event.target.value)}
            />
          </div>
          {hideCustomPriceGroup ? null : (
            <div className={styles.detail}>
              <Select
                label="Preisgruppe (manuell wählen)"
                placeholder="Bitte Preisgruppe wählen"
                options={[
                  { value: 'PG1', label: 'Preisgruppe 1' },
                  { value: 'PG2', label: 'Preisgruppe 2' },
                  { value: 'PG3', label: 'Preisgruppe 3' },
                  { value: 'PG4', label: 'Preisgruppe 4' },
                ]}
                value={value?.priceGroup ?? ''}
                onChange={(event) => setCustomPg(event.target.value as PriceGroup)}
              />
            </div>
          )}
        </>
      ) : null}

      {priceColumnLabel ? (
        <span className={styles.pg} title="Eigene Spalte in der Preisliste – nicht PG 1–4">
          Preisgruppe {priceColumnLabel}
        </span>
      ) : pg ? (
        <span className={styles.pg} title="Automatisch zugewiesene Preisgruppe (Hintergrund)">
          Preisgruppe {PRICE_GROUP_LABEL[pg]}
        </span>
      ) : showOpenPg ? (
        <span className={styles.pgOpen} title="Kundenspezifisch – Preisgruppe offen">
          Preisgruppe offen
        </span>
      ) : null}
    </div>
  )
}
