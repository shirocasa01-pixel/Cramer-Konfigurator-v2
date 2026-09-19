import { DataField } from '../ui/DataField'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { TextField } from '../ui/TextField'
import { MaterialSelect } from '../material/MaterialSelect'
import styles from './SchemaFeldEingabe.module.css'
import { anzeigeWert, leseMaterial, leseWert, optionenFuer } from '../../lib/schemaWerte'
import { ALLE_MATERIALGRUPPEN } from '../../config/materialMatrix'
import type { Draft, MaterialSelection } from '../../types'
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
  onMaterial,
  onBlur,
  fehler,
}: {
  feld: SchemaFeld
  draft: Draft
  onChange: (wert: string) => void
  /** Nur für Material-Module: Die Auswahl ist ein Objekt, kein Text. */
  onMaterial?: (wahl: MaterialSelection) => void
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
          options={optionenFuer(feld, draft.seriesId)}
          value={wert}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          error={fehler}
        />
      )

    /*
      DAS MATERIAL-MODUL — Chips und gekoppeltes Ausführungs-Dropdown in einem Baustein.

      Genau die Interaktion aus dem Schritt „Material": Erst die Gruppe („Decoboard"),
      dann die daran hängende Ausführung, und die Preisgruppe wird im Hintergrund
      zugeordnet. Nachgebaut wird davon nichts — es ist dieselbe Komponente, die der
      Schritt selbst benutzt.
    */
    case 'material':
      return (
        <div className={styles.materialBlock}>
          <span className={styles.materialLabel}>{label}</span>
          {feld.hinweis ? <span className={styles.materialHinweis}>{feld.hinweis}</span> : null}
          <MaterialSelect
            groupIds={[ALLE_MATERIALGRUPPEN]}
            allowCustom
            value={leseMaterial(draft, feld)}
            onChange={(wahl) => onMaterial?.(wahl)}
          />
        </div>
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
