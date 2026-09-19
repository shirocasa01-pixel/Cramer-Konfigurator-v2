import { useEffect, useState } from 'react'
import { serien } from '../../data/stammdaten.generated'
import { dropdowns } from '../../data/stammdaten.generated'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import type { FeldTyp, SchemaFeld } from '../../types/schema'
import styles from '../schema/Editierbar.module.css'

const TYP_LABEL: Record<FeldTyp, string> = {
  text: 'Textfeld',
  mehrzeilig: 'Mehrzeiliges Textfeld',
  zahl: 'Zahlenfeld',
  auswahl: 'Auswahl (Dropdown)',
  material: 'Oberflächen-Modul',
  checkbox: 'Ja/Nein-Auswahl',
  datum: 'Datum',
  hinweis: 'Hinweistext',
  ueberschrift: 'Überschrift',
}

/**
 * Einstellungsmaske eines Bausteins.
 *
 * Gezeigt wird nur, was für den jeweiligen Typ auch gilt: Eine Überschrift hat keine
 * Pflicht-Angabe, ein Hinweistext keinen Platzhalter. Systemfelder behalten ihre Bindung
 * an das Entwurfsfeld — sie steht als Hinweis da, ist aber nicht änderbar.
 */
export function FeldEinstellungen({
  offen,
  feld,
  onSpeichern,
  onAbbrechen,
}: {
  offen: boolean
  feld: SchemaFeld | null
  onSpeichern: (feld: SchemaFeld) => void
  onAbbrechen: () => void
}) {
  const [entwurf, setEntwurf] = useState<SchemaFeld | null>(feld)

  useEffect(() => setEntwurf(feld), [feld])

  if (!offen || !entwurf) return null

  const aendere = (patch: Partial<SchemaFeld>) => setEntwurf({ ...entwurf, ...patch })
  const istText = entwurf.typ !== 'ueberschrift' && entwurf.typ !== 'hinweis'
  const serienRegel = entwurf.regeln?.find((r) => r.art === 'nurSerien')

  return (
    <Modal
      open={offen}
      title={`Baustein bearbeiten · ${TYP_LABEL[entwurf.typ]}`}
      onClose={onAbbrechen}
      footer={
        <>
          <Button variant="ghost" onClick={onAbbrechen}>
            Abbrechen
          </Button>
          <Button onClick={() => onSpeichern(entwurf)}>Übernehmen</Button>
        </>
      }
    >
      <div className={styles.maske}>
        <TextField
          label="Überschrift / Beschriftung"
          value={entwurf.label}
          onChange={(event) => aendere({ label: event.target.value })}
        />

        <TextField
          label="Hinweistext"
          hint="Erscheint klein unter dem Feld. Leer lassen, wenn nicht nötig."
          value={entwurf.hinweis ?? ''}
          onChange={(event) => aendere({ hinweis: event.target.value })}
        />

        {istText ? (
          <TextField
            label="Platzhalter"
            hint="Beispieltext im leeren Feld."
            value={entwurf.platzhalter ?? ''}
            onChange={(event) => aendere({ platzhalter: event.target.value })}
          />
        ) : null}

        {entwurf.typ === 'auswahl' ? (
          <Select
            label="Datenquelle der Auswahl"
            placeholder="Artikelverwaltung (Dropdown-Code)"
            options={[
              { value: 'filialen', label: 'Filialen aus den Stammdaten' },
              ...dropdowns.map((d) => ({
                value: `dd:${d.nr}`,
                label: `${d.nummernkreis}  ${d.bezeichnung} (${d.anzahlArtikel ?? 0} Artikel)`,
              })),
            ]}
            value={entwurf.optionen === 'filialen' ? 'filialen' : entwurf.dropdownCode ? `dd:${entwurf.dropdownCode}` : ''}
            onChange={(event) => {
              const wert = event.target.value
              if (wert === 'filialen') aendere({ optionen: 'filialen', dropdownCode: undefined })
              else if (wert.startsWith('dd:')) aendere({ optionen: undefined, dropdownCode: wert.slice(3) })
              else aendere({ optionen: undefined, dropdownCode: undefined })
            }}
          />
        ) : null}

        {istText ? (
          <label className={styles.schalter}>
            <input
              type="checkbox"
              checked={Boolean(entwurf.pflicht)}
              onChange={(event) => aendere({ pflicht: event.target.checked })}
            />
            <span>Pflichtfeld — ohne Eingabe geht es nicht weiter</span>
          </label>
        ) : null}

        <fieldset className={styles.gruppe}>
          <legend className={styles.gruppeTitel}>Wo erscheint der Baustein?</legend>
          {(
            [
              ['maske', 'Erfassungsmaske'],
              ['zusammenfassung', 'Zusammenfassung'],
              ['pdf', 'AV-PDF'],
            ] as const
          ).map(([flaeche, label]) => (
            <label key={flaeche} className={styles.schalter}>
              <input
                type="checkbox"
                checked={entwurf.zeigeIn[flaeche]}
                onChange={(event) =>
                  aendere({ zeigeIn: { ...entwurf.zeigeIn, [flaeche]: event.target.checked } })
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className={styles.gruppe}>
          <legend className={styles.gruppeTitel}>Sichtbarkeitsregel</legend>
          <p className={styles.gruppeHinweis}>
            Ohne Auswahl erscheint der Baustein bei jeder Serie. Sonst gilt: WENN Möbelserie eine
            der gewählten ist, DANN anzeigen.
          </p>
          <div className={styles.serienGitter}>
            {serien.map((s) => {
              const gewaehlt = serienRegel?.serien.includes(s.id) ?? false
              return (
                <label key={s.id} className={styles.schalter}>
                  <input
                    type="checkbox"
                    checked={gewaehlt}
                    onChange={(event) => {
                      const bisher = serienRegel?.serien ?? []
                      const naechste = event.target.checked
                        ? [...bisher, s.id]
                        : bisher.filter((id) => id !== s.id)
                      aendere({
                        regeln: naechste.length ? [{ art: 'nurSerien', serien: naechste }] : undefined,
                      })
                    }}
                  />
                  <span>{s.name}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {entwurf.systemfeld ? (
          <p className={styles.systemhinweis}>
            Auslieferungsfeld{entwurf.bindung ? ` · gebunden an „${entwurf.bindung}"` : ''}
            {entwurf.quelle ? ` · abgeleiteter Wert („${entwurf.quelle}")` : ''}. Beschriftung,
            Reihenfolge und Sichtbarkeit sind frei; die Bindung bleibt, weil Kalkulation und
            Auswertungen daran hängen.
          </p>
        ) : (
          <p className={styles.systemhinweis}>
            Selbst angelegtes Feld · Wert wird unter <code>{entwurf.id}</code> im Entwurf gespeichert.
          </p>
        )}

      </div>
    </Modal>
  )
}

export { TYP_LABEL }
