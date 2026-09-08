import { MaterialSelect } from '../material/MaterialSelect'
import { TextField } from '../ui/TextField'
import { RUECKWAND_GROUPS, RUECKWAND_INNEN_SICHTBAR } from '../../config/korpus'
import type { KorpusInnen } from '../../types'
import styles from './KorpusInnenSection.module.css'

const EMPTY: KorpusInnen = {
  rueckwand: { enabled: false },
  lochreihe: { enabled: false },
  einlegeboeden: { enabled: false, kleiderstange: { enabled: false } },
}

interface Props {
  value: KorpusInnen | undefined
  onChange: (next: KorpusInnen) => void
}

/**
 * PHASE B – „Korpus Innen" (Innenausbau des Korpus). Vier optionale Elemente:
 *   A) Rückwand Innen  → Checkbox öffnet direkt Material-/Farbauswahl
 *   B) Lochreihe       → Checkbox öffnet Freitext-Notiz
 *   C) Einlegeböden    → Checkbox öffnet „Anzahl Einlegeböden" (Freitext)
 *   D) Kleiderstange   → nur unter C sichtbar; Checkbox öffnet „Menge & Art"
 *
 * Alles ist optional (kein Pflichtfeld) – Eingaben erscheinen erst bei Aktivierung.
 */
export function KorpusInnenSection({ value, onChange }: Props) {
  const v = value ?? EMPTY
  const patch = (next: Partial<KorpusInnen>) => onChange({ ...v, ...next })

  return (
    <section className={styles.root} aria-label="Korpus Innen">
      <div className={styles.head}>
        <h2 className={styles.title}>Korpus Innen (Innenausbau)</h2>
        <span className={styles.hint}>Rückwand, Lochreihe, Einlegeböden &amp; Kleiderstange – alles optional.</span>
      </div>

      <p className={styles.note}>
        Hinweis: Legen Sie hier die allgemeine Grundausstattung für den Innenraum fest. Die
        detailgenaue Aufteilung der einzelnen Segmente erfolgt im nächsten Schritt unter 'Fronten'.
      </p>

      {/* A) Rückwand Innen – eigener Schalter (Punkt 5), damit sie auch dann aus
          bleibt, wenn der Block insgesamt wieder eingeblendet wird. */}
      {RUECKWAND_INNEN_SICHTBAR ? (
      <div className={styles.item}>
        <label className={styles.check}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={v.rueckwand.enabled}
            onChange={(e) =>
              patch({ rueckwand: { enabled: e.target.checked, material: e.target.checked ? v.rueckwand.material : undefined } })
            }
          />
          Rückwand Innen
        </label>
        {v.rueckwand.enabled ? (
          <div className={styles.reveal}>
            <MaterialSelect
              groupIds={RUECKWAND_GROUPS}
              allowCustom
              value={v.rueckwand.material}
              onChange={(material) => patch({ rueckwand: { enabled: true, material } })}
            />
          </div>
        ) : null}
      </div>
      ) : null}

      {/* B) Lochreihe */}
      <div className={styles.item}>
        <label className={styles.check}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={v.lochreihe.enabled}
            onChange={(e) =>
              patch({ lochreihe: { enabled: e.target.checked, note: e.target.checked ? v.lochreihe.note : undefined } })
            }
          />
          Lochreihe
        </label>
        {v.lochreihe.enabled ? (
          <div className={styles.reveal}>
            <TextField
              label="Lochreihe – Notiz (Position / Anzahl)"
              placeholder="z. B. beidseitig, 32 mm Raster"
              value={v.lochreihe.note ?? ''}
              onChange={(e) => patch({ lochreihe: { enabled: true, note: e.target.value } })}
            />
          </div>
        ) : null}
      </div>

      {/* C) Einlegeböden + D) Kleiderstange (verschachtelt) */}
      <div className={styles.item}>
        <label className={styles.check}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={v.einlegeboeden.enabled}
            onChange={(e) =>
              patch({
                einlegeboeden: e.target.checked
                  ? { ...v.einlegeboeden, enabled: true }
                  : { ...v.einlegeboeden, enabled: false, kleiderstange: { enabled: false } },
              })
            }
          />
          Einlegeböden
        </label>
        {v.einlegeboeden.enabled ? (
          <div className={styles.reveal}>
            <TextField
              label="Anzahl Einlegeböden"
              inputMode="numeric"
              placeholder="z. B. 2, 3, 4"
              value={v.einlegeboeden.anzahl ?? ''}
              onChange={(e) => patch({ einlegeboeden: { ...v.einlegeboeden, anzahl: e.target.value } })}
            />

            {/* D) Kleiderstange – nur unter Einlegeböden */}
            <div className={styles.nested}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={v.einlegeboeden.kleiderstange.enabled}
                  onChange={(e) =>
                    patch({
                      einlegeboeden: {
                        ...v.einlegeboeden,
                        kleiderstange: {
                          enabled: e.target.checked,
                          note: e.target.checked ? v.einlegeboeden.kleiderstange.note : undefined,
                        },
                      },
                    })
                  }
                />
                Kleiderstange
              </label>
              {v.einlegeboeden.kleiderstange.enabled ? (
                <div className={styles.reveal}>
                  <TextField
                    label="Menge & Art der Kleiderstange"
                    placeholder={'z. B. "2 Stück, mit LED"'}
                    value={v.einlegeboeden.kleiderstange.note ?? ''}
                    onChange={(e) =>
                      patch({
                        einlegeboeden: {
                          ...v.einlegeboeden,
                          kleiderstange: { enabled: true, note: e.target.value },
                        },
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
