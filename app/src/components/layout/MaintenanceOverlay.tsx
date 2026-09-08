import { Link } from 'react-router-dom'
import { BrandMark } from '../ui/BrandMark'
import { appConfig } from '../../config/appConfig'
import styles from './MaintenanceOverlay.module.css'

/**
 * PHASE 11 – Wartungs-Overlay. Deckt bei aktivem Wartungsmodus den gesamten Bildschirm
 * ab (fängt das Routing ab). Ein dezenter Verwaltungs-Zugang bleibt erreichbar, damit
 * Administratoren den Modus wieder deaktivieren können.
 */
export function MaintenanceOverlay() {
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
        <Link to="/login" className={styles.adminLink}>
          Verwaltungs-Zugang →
        </Link>
      </main>
      <p className={styles.copyright}>© {new Date().getFullYear()} Cramer · Cramer Möbel</p>
    </div>
  )
}
