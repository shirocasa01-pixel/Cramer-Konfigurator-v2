import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandMark } from '../../components/ui/BrandMark'
import { appConfig } from '../../config/appConfig'
import { useAuth } from '../../context/AuthContext'
import styles from './Wartung.module.css'

/**
 * WARTUNGSSEITE — Phase 11.3.
 *
 * Frühere Fassung: ein Overlay, das VOR dem Routing lag und je nach Pfad das gesamte
 * Routing abfing (`App.tsx`, vor dieser Umstellung). Das brachte die Login-Maske und die
 * Wartungssperre in dieselbe Bedingung und war fehleranfällig — genau die Verwechslung,
 * die zu dem gemeldeten „Login blockiert" führte.
 *
 * Jetzt ist die Wartung eine GEWÖHNLICHE ROUTE (`/wartung`), und die Regel ist denkbar
 * einfach, weil sie an genau einer Stelle steht (`RequireWartung` in `App.tsx`):
 *
 *   - `/login` prüft NIE auf Wartung — die Anmeldemaske ist immer die Anmeldemaske.
 *   - Administratoren sehen diese Seite nie — `RequireWartung` schickt sie sofort
 *     nach `/admin` weiter, der Wartungsmodus ist für sie vollständig wirkungslos.
 *   - Berater landen hier, solange der Wartungsmodus aktiv ist — ob direkt nach dem
 *     Login oder mitten in der Sitzung, wenn ein Administrator ihn währenddessen
 *     einschaltet: `RequireWartung` wertet `maintenanceActive` bei jedem Render neu aus.
 *
 * Zwei Handlungen, mehr nicht: Status neu prüfen (kommt sofort zurück in den
 * Konfigurator, sobald ein Administrator die Wartung beendet hat) oder abmelden.
 */
export default function WartungPage() {
  const { logout, refreshMaintenanceStatus } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'idle' | 'pruefend' | 'weiterhinAktiv'>('idle')

  function statusAktualisieren() {
    setStatus('pruefend')
    // Ein Tick Verzögerung macht die Prüfung sichtbar — ohne sie wäre der Klick bei
    // gleichbleibendem Status (der häufigste Fall) nicht von einem toten Knopf zu
    // unterscheiden.
    window.setTimeout(() => {
      const nochAktiv = refreshMaintenanceStatus()
      // Ist der Wartungsmodus aufgehoben, übernimmt `RequireWartung` in App.tsx: der
      // nächste Render verlässt diese Seite automatisch Richtung „/" — kein
      // `window.location.reload()` nötig, und ein `setStatus` danach wäre ohnehin ein
      // Update an einer gerade unmontierten Komponente.
      if (nochAktiv) setStatus('weiterhinAktiv')
    }, 250)
  }

  function abmelden() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.screen}>
      <main className={styles.card}>
        <BrandMark size="lg" />
        <div className={styles.pulse} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h1 className={styles.title}>Wartungsarbeiten</h1>
        <p className={styles.message}>{appConfig.maintenanceMessage}</p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={statusAktualisieren}
            disabled={status === 'pruefend'}
          >
            {status === 'pruefend' ? 'Prüft …' : 'Status aktualisieren 🔄'}
          </button>
          <button type="button" className={styles.logoutBtn} onClick={abmelden}>
            Abmelden 🚪
          </button>
        </div>
        {status === 'weiterhinAktiv' ? (
          <span className={styles.hint} role="status">
            Weiterhin aktiv.
          </span>
        ) : null}
      </main>
      <p className={styles.copyright}>© {new Date().getFullYear()} Cramer · Cramer Möbel</p>
    </div>
  )
}
