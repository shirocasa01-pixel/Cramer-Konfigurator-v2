import { useEffect, useRef, useState } from 'react'
import styles from './MehrfachFilter.module.css'

/**
 * Filter mit Mehrfach-Auswahl.
 *
 * Bewusst kein `<select multiple>`: das ist auf Touch-Geräten kaum bedienbar und
 * verrät im geschlossenen Zustand nicht, wonach gerade gefiltert wird. Hier steht die
 * Zahl der gewählten Werte am Knopf, und ein Klick auf „zurücksetzen" räumt sie weg.
 */

export interface FilterOption {
  wert: string
  titel: string
}

export interface MehrfachFilterProps {
  label: string
  optionen: FilterOption[]
  ausgewaehlt: string[]
  onChange: (werte: string[]) => void
}

export function MehrfachFilter({ label, optionen, ausgewaehlt, onChange }: MehrfachFilterProps) {
  const [offen, setOffen] = useState(false)
  const wurzel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!offen) return
    function beiKlick(e: MouseEvent) {
      if (wurzel.current && !wurzel.current.contains(e.target as Node)) setOffen(false)
    }
    function beiEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOffen(false)
      }
    }
    document.addEventListener('mousedown', beiKlick)
    document.addEventListener('keydown', beiEsc, true)
    return () => {
      document.removeEventListener('mousedown', beiKlick)
      document.removeEventListener('keydown', beiEsc, true)
    }
  }, [offen])

  const umschalten = (wert: string) => {
    onChange(ausgewaehlt.includes(wert) ? ausgewaehlt.filter((w) => w !== wert) : [...ausgewaehlt, wert])
  }

  return (
    <div className={styles.wurzel} ref={wurzel}>
      <button
        type="button"
        className={[styles.trigger, ausgewaehlt.length > 0 ? styles.triggerAktiv : ''].filter(Boolean).join(' ')}
        aria-expanded={offen}
        aria-haspopup="true"
        onClick={() => setOffen((v) => !v)}
      >
        {label}
        {ausgewaehlt.length > 0 ? <span className={styles.zaehler}>{ausgewaehlt.length}</span> : null}
        <span className={styles.pfeil} aria-hidden="true">
          ⌄
        </span>
      </button>

      {offen ? (
        <div className={styles.panel} role="menu">
          <div className={styles.kopf}>
            <span>{label}</span>
            {ausgewaehlt.length > 0 ? (
              <button type="button" className={styles.linkButton} onClick={() => onChange([])}>
                zurücksetzen
              </button>
            ) : null}
          </div>
          <div className={styles.liste}>
            {optionen.map((o) => (
              <label key={o.wert} className={styles.eintrag}>
                <input
                  type="checkbox"
                  checked={ausgewaehlt.includes(o.wert)}
                  onChange={() => umschalten(o.wert)}
                />
                <span>{o.titel}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
