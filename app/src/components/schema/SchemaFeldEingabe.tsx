import { DataField } from '../ui/DataField'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { TextField } from '../ui/TextField'
import styles from './SchemaFeldEingabe.module.css'
import { anzeigeWert, leseWert, optionenFuer } from '../../lib/schemaWerte'
import type { Draft } from '../../types'
import type { SchemaFeld } from '../../types/schema'

/**
 * Ein Eingabefeld, wie das Schema es beschreibt.
 *
 * Die Erfassungsmaske rendert nur noch diese Komponente in einer Schleife — welche Felder
 * es gibt, welchen Typ sie haben und wie sie heißen, steht im Schema und nicht mehr im JSX.
 */
export function SchemaFeldEingabe({
  feld,
  draft,
  onChange,
  onBlur,
  fehler,
}: {
  feld: SchemaFeld
  draft: Draft
  onChange: (wert: string) => void
  onBlur?: () => void
  fehler?: string
}) {
  // Abgeleitete Felder zeigen nur an (Berater, Datum, Entwurfsnummer).
  if (feld.quelle) {
    return (
      <DataField
        label={feld.label}
        value={anzeigeWert(draft, feld) || '—'}
        auto
        mono={feld.quelle === 'entwurfsnummer'}
      />
    )
  }

  const wert = leseWert(draft, feld)
  const label = feld.pflicht ? `${feld.label} *` : feld.label

  switch (feld.typ) {
    case 'ueberschrift':
      return <h2 className={styles.ueberschrift}>{feld.label}</h2>

    case 'hinweis':
      return <p className={styles.hinweis}>{feld.hinweis ?? feld.label}</p>

    case 'auswahl':
      return (
        <Select
          label={label}
          placeholder={feld.platzhalter ?? 'Bitte wählen'}
          options={optionenFuer(feld)}
          value={wert}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          error={fehler}
        />
      )

    case 'checkbox':
      return (
        <label className={styles.checkboxZeile}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={wert === 'true'}
            onChange={(event) => onChange(event.target.checked ? 'true' : 'false')}
          />
          <span>
            <span className={styles.checkboxLabel}>{label}</span>
            {feld.hinweis ? <span className={styles.checkboxHinweis}>{feld.hinweis}</span> : null}
          </span>
        </label>
      )

    case 'mehrzeilig':
      return (
        <Textarea
          label={label}
          placeholder={feld.platzhalter}
          hint={feld.hinweis}
          value={wert}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
      )

    case 'zahl':
    case 'datum':
    case 'text':
    default:
      return (
        <TextField
          label={label}
          type={feld.typ === 'datum' ? 'date' : feld.typ === 'zahl' ? 'number' : 'text'}
          required={feld.pflicht}
          placeholder={feld.platzhalter}
          hint={feld.hinweis}
          value={wert}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          error={fehler}
        />
      )
  }
}
