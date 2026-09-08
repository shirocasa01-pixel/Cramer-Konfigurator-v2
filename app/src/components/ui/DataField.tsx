import styles from './DataField.module.css'

interface DataFieldProps {
  label: string
  value: string
  /** Zeigt ein „Automatisch“-Badge: systemseitig gesetzt, nicht editierbar. */
  auto?: boolean
  /** Monospace-Darstellung (z. B. für die Entwurfsnummer). */
  mono?: boolean
}

/** Schreibgeschützte, klar als „automatisch“ erkennbare Datenanzeige. */
export function DataField({ label, value, auto = false, mono = false }: DataFieldProps) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>
        {label}
        {auto ? <span className={styles.badge}>Automatisch</span> : null}
      </span>
      <span className={[styles.value, mono ? styles.mono : ''].filter(Boolean).join(' ')}>
        {value}
      </span>
    </div>
  )
}
