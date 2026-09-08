import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import type { AbschlussOben, AbschlussUnten, AbschlussUntenType, FrontsData } from '../../types'
import styles from './FinishesSection.module.css'

const UNTEN_OPTIONS: { type: AbschlussUntenType; label: string }[] = [
  { type: 'SO', label: 'SO – Sockel' },
  { type: 'SSP', label: 'SSP – Schwebende Sockelplatte' },
  { type: 'KS', label: 'KS – Kommodensockel' },
  { type: 'UK', label: 'UK – Umlaufkorpus' },
  { type: 'KG', label: 'KG / UK mit Fuß' },
]

const OBEN_VARIANTS: { id: NonNullable<AbschlussOben['variant']>; label: string; fixed?: string }[] = [
  { id: 'DP', label: 'DP' },
  { id: 'Glas', label: 'Glas', fixed: 'fix 4 mm' },
  { id: 'UK', label: 'UK', fixed: 'fix 2 cm' },
]

interface FinishesSectionProps {
  grifffarbe: string | undefined
  abschlussOben: AbschlussOben | undefined
  abschlussUnten: AbschlussUnten | undefined
  onChange: (
    patch: Partial<Pick<FrontsData, 'grifffarbe' | 'abschlussOben' | 'abschlussUnten'>>,
  ) => void
}

/** Ergänzende Komponenten (gelten für das gesamte Möbel): Grifffarbe & Abschlüsse. */
export function FinishesSection({
  grifffarbe,
  abschlussOben,
  abschlussUnten,
  onChange,
}: FinishesSectionProps) {
  function setObenMode(mode: AbschlussOben['mode']) {
    if (mode === 'wieKorpus') onChange({ abschlussOben: { mode: 'wieKorpus' } })
    else
      onChange({
        abschlussOben: {
          mode: 'anders',
          variant: abschlussOben?.variant,
          dpStaerke: abschlussOben?.dpStaerke,
        },
      })
  }
  function setObenVariant(variant: NonNullable<AbschlussOben['variant']>) {
    onChange({
      abschlussOben: {
        mode: 'anders',
        variant,
        dpStaerke: variant === 'DP' ? abschlussOben?.dpStaerke : undefined,
      },
    })
  }
  function setDpStaerke(dpStaerke: string) {
    onChange({
      abschlussOben: { mode: 'anders', variant: 'DP', dpStaerke: dpStaerke as AbschlussOben['dpStaerke'] },
    })
  }
  function setUnten(type: AbschlussUntenType) {
    onChange({ abschlussUnten: { type, footNote: type === 'KG' ? abschlussUnten?.footNote : undefined } })
  }
  function setFootNote(footNote: string) {
    onChange({ abschlussUnten: { type: 'KG', footNote } })
  }

  const chip = (active: boolean) => [styles.chip, active ? styles.chipActive : ''].filter(Boolean).join(' ')

  return (
    <div className={styles.root}>
      <div className={styles.block}>
        <TextField
          label="Grifffarbe (falls abweichend)"
          placeholder="z. B. RAL 9005"
          value={grifffarbe ?? ''}
          onChange={(event) => onChange({ grifffarbe: event.target.value })}
        />
      </div>

      <div className={styles.block}>
        <span className={styles.blockLabel}>Abschluss oben (Abschlussplatte)</span>
        <div className={styles.chips}>
          <button
            type="button"
            className={chip(abschlussOben?.mode === 'wieKorpus')}
            onClick={() => setObenMode('wieKorpus')}
            aria-pressed={abschlussOben?.mode === 'wieKorpus'}
          >
            wie Korpus
          </button>
          <button
            type="button"
            className={chip(abschlussOben?.mode === 'anders')}
            onClick={() => setObenMode('anders')}
            aria-pressed={abschlussOben?.mode === 'anders'}
          >
            anders
          </button>
        </div>
        {abschlussOben?.mode === 'anders' ? (
          <div className={styles.sub}>
            <div className={styles.chips}>
              {OBEN_VARIANTS.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  className={chip(abschlussOben.variant === variant.id)}
                  onClick={() => setObenVariant(variant.id)}
                  aria-pressed={abschlussOben.variant === variant.id}
                >
                  {variant.label}
                  {variant.fixed ? <span className={styles.fixed}>{variant.fixed}</span> : null}
                </button>
              ))}
            </div>
            {abschlussOben.variant === 'DP' ? (
              <div className={styles.detail}>
                <Select
                  label="DP – Stärke"
                  placeholder="Bitte wählen"
                  options={[
                    { value: '1cm', label: '1 cm' },
                    { value: '2cm', label: '2 cm' },
                    { value: '3cm', label: '3 cm' },
                  ]}
                  value={abschlussOben.dpStaerke ?? ''}
                  onChange={(event) => setDpStaerke(event.target.value)}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.block}>
        <span className={styles.blockLabel}>Abschluss unten (Sockel / Bodenabschluss)</span>
        <div className={styles.chips}>
          {UNTEN_OPTIONS.map((option) => (
            <button
              key={option.type}
              type="button"
              className={chip(abschlussUnten?.type === option.type)}
              onClick={() => setUnten(option.type)}
              aria-pressed={abschlussUnten?.type === option.type}
            >
              {option.label}
            </button>
          ))}
        </div>
        {abschlussUnten?.type === 'KG' ? (
          <div className={styles.detail}>
            <TextField
              label="Fuß-Typ / Höhe"
              placeholder="z. B. Rundfuß Alu, H 15 cm"
              value={abschlussUnten.footNote ?? ''}
              onChange={(event) => setFootNote(event.target.value)}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
