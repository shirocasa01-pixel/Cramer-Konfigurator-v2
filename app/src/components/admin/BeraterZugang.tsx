import { useId } from 'react'
import { pruefePasswortRegeln } from '../../lib/passwort.ts'
import styles from './BeraterZugang.module.css'

/**
 * ZUGANG EINES BERATERS — eigenes Passwort vergeben, ersetzen oder löschen.
 *
 * Sitzt als Zusatzabschnitt im Berater-Editor, den nur der Administrator öffnet. Das
 * Passwort ist bewusst KEIN Feld des Stammsatzes: es wird nur geschrieben, nie gelesen.
 * Auch der Administrator bekommt ein bestehendes Passwort nicht zu sehen — er kann es
 * ersetzen oder entziehen, mehr nicht. Ein Feld, das den alten Wert anzeigt, wäre die
 * bequemste Art, ein Passwort weiterzugeben.
 *
 * Freigeschaltet für den Konfigurator ist ein Berater mit Status „aktiv" und einer
 * E-Mail. Ohne eigenes Passwort meldet er sich mit dem einheitlichen Standard-Passwort
 * an. Fehlt etwas, sagt der Abschnitt es hier — nicht erst der Berater am
 * Anmeldebildschirm.
 */

export interface ZugangEntwurf {
  neuesPasswort: string
  wiederholung: string
  /** true ⇒ beim Speichern wird das eigene Passwort gelöscht (zurück auf Standard). */
  entziehen: boolean
}

export const LEERER_ZUGANG: ZugangEntwurf = { neuesPasswort: '', wiederholung: '', entziehen: false }

/** Beanstandung im Klartext oder `null`. Wird vor dem Speichern aufgerufen. */
export function pruefeZugangEntwurf(z: ZugangEntwurf, vorhanden: boolean): string | null {
  if (z.entziehen) return null
  if (!z.neuesPasswort && !z.wiederholung) return null
  if (!vorhanden && !z.neuesPasswort) return null
  const regel = pruefePasswortRegeln(z.neuesPasswort)
  if (regel) return regel
  if (z.neuesPasswort !== z.wiederholung) return 'Die beiden Passwort-Eingaben stimmen nicht überein.'
  return null
}

export interface BeraterZugangProps {
  /** true ⇒ es ist bereits ein Passwort hinterlegt. */
  vorhanden: boolean
  gesetztAm: string | null
  /** Status des Stammsatzes — „gesperrt" hebelt jeden Zugang aus. */
  status: string
  email: string
  wert: ZugangEntwurf
  onChange: (z: ZugangEntwurf) => void
}

export function BeraterZugang({ vorhanden, gesetztAm, status, email, wert, onChange }: BeraterZugangProps) {
  const id = useId()
  const aktiv = status === 'aktiv'
  const freigeschaltet = aktiv && Boolean(email.trim())
  const eigenesPasswort = (vorhanden && !wert.entziehen) || Boolean(wert.neuesPasswort)

  const huerden: string[] = []
  if (!aktiv) huerden.push('Status steht auf „' + (status || 'unbekannt') + '"')
  if (!email.trim()) huerden.push('keine E-Mail hinterlegt')

  return (
    <section className={styles.wurzel}>
      <header className={styles.kopf}>
        <h3 className={styles.titel}>Zugang zum Konfigurator</h3>
        <span className={freigeschaltet ? styles.badgeAn : styles.badgeAus}>
          {freigeschaltet ? '✓ freigeschaltet' : 'nicht freigeschaltet'}
        </span>
      </header>

      <p className={styles.status}>
        {huerden.length === 0 ? (
          <>
            Anmeldung mit <b>{email.trim()}</b> und{' '}
            {eigenesPasswort ? (
              <>
                dem eigenen Passwort
                {gesetztAm && !wert.neuesPasswort ? <> · vergeben am {gesetztAm}</> : null}
              </>
            ) : (
              'dem Standard-Passwort'
            )}
            .
          </>
        ) : (
          <>Noch offen: {huerden.join(' · ')}.</>
        )}
      </p>

      <div className={styles.felder}>
        <label className={styles.feld} htmlFor={`${id}-neu`}>
          <span className={styles.label}>{vorhanden ? 'Neues Passwort' : 'Passwort'}</span>
          <input
            id={`${id}-neu`}
            type="password"
            className={styles.input}
            autoComplete="new-password"
            placeholder={vorhanden ? 'leer lassen = unverändert' : 'leer lassen = Standard-Passwort'}
            value={wert.neuesPasswort}
            disabled={wert.entziehen}
            onChange={(e) => onChange({ ...wert, neuesPasswort: e.target.value })}
          />
        </label>

        <label className={styles.feld} htmlFor={`${id}-wdh`}>
          <span className={styles.label}>Wiederholen</span>
          <input
            id={`${id}-wdh`}
            type="password"
            className={styles.input}
            autoComplete="new-password"
            value={wert.wiederholung}
            disabled={wert.entziehen}
            onChange={(e) => onChange({ ...wert, wiederholung: e.target.value })}
          />
        </label>
      </div>

      {vorhanden ? (
        <label className={styles.entziehen}>
          <input
            type="checkbox"
            checked={wert.entziehen}
            onChange={(e) => onChange({ ...wert, entziehen: e.target.checked, neuesPasswort: '', wiederholung: '' })}
          />
          <span>
            Eigenes Passwort löschen — danach gilt wieder das Standard-Passwort. Sperren
            lässt sich das Konto über den Status „gesperrt".
          </span>
        </label>
      ) : null}

      <p className={styles.hinweis}>
        Das Passwort wird als SHA-256-Hash gespeichert und ist danach auch für den
        Administrator nicht mehr lesbar. Es steht weder in der Stammdatenmappe noch im
        Excel-Export — es gehört zum Konto, nicht zum Stammsatz.
      </p>
    </section>
  )
}
