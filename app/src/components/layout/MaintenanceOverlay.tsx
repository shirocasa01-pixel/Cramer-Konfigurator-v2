import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BrandMark } from '../ui/BrandMark'
import { appConfig } from '../../config/appConfig'
import { useAuth } from '../../context/AuthContext'
import styles from './MaintenanceOverlay.module.css'

/**
 * PHASE 11 – Wartungs-Overlay. Deckt bei aktivem Wartungsmodus den gesamten Bildschirm
 * ab (fängt das Routing ab).
 *
 * ZWEI WEGE, DIE VERHINDERN, DASS SICH EIN ADMINISTRATOR SELBST AUSSPERRT:
 *
 *   1. „🔒 Administrator-Anmeldung" führt IMMER zu `/login` — diese Route ist in
 *      `App.tsx` unabhängig vom Wartungsmodus von der Sperre ausgenommen, genau wie
 *      jede Route unter `/admin`. Der Link funktioniert deshalb auch dann, wenn der
 *      Administrator gerade abgemeldet ist oder sein Gerät neu lädt.
 *   2. „Status aktualisieren" liest den Wartungsmodus-Schalter direkt aus dem Speicher
 *      neu (siehe `refreshMaintenanceStatus` in `AuthContext`), statt auf ein Neuladen
 *      der Seite zu warten. Wurde er zwischenzeitlich aufgehoben — etwa von einem
 *      zweiten Tab desselben Geräts —, verschwindet dieses Overlay sofort und die
 *      angeforderte Seite erscheint, ganz ohne `window.location.reload()`.
 */
export function MaintenanceOverlay() {
  const { refreshMaintenanceStatus } = useAuth()
  const [status, setStatus] = useState<'idle' | 'pruefend' | 'weiterhinAktiv'>('idle')

  function statusAktualisieren() {
    setStatus('pruefend')
    // Ein Tick Verzögerung macht die Prüfung sichtbar — ohne sie wäre der Klick bei
    // gleichbleibendem Status (der häufigste Fall) nicht von einem toten Knopf zu
    // unterscheiden.
    window.setTimeout(() => {
      const nochAktiv = refreshMaintenanceStatus()
      // Ist der Wartungsmodus aufgehoben, meldet sich dieser Aufruf gar nicht mehr zurück:
      // App.tsx hat das Overlay dann bereits durch die angeforderte Seite ersetzt.
      if (nochAktiv) setStatus('weiterhinAktiv')
    }, 250)
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

        <div className={styles.refreshRow}>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={statusAktualisieren}
            disabled={status === 'pruefend'}
          >
            {status === 'pruefend' ? 'Prüft …' : 'Status aktualisieren 🔄'}
          </button>
          {status === 'weiterhinAktiv' ? (
            <span className={styles.refreshHint} role="status">
              Weiterhin aktiv.
            </span>
          ) : null}
        </div>

        <Link to="/login?grund=wartung" className={styles.adminLink}>
          🔒 Administrator-Anmeldung
        </Link>
      </main>
      <p className={styles.copyright}>© {new Date().getFullYear()} Cramer · Cramer Möbel</p>
    </div>
  )
}
