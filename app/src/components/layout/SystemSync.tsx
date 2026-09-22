import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { getSyncStatus, setzeSyncStatus, subscribeSyncStatus } from '../../lib/supabaseSystem'
import { aktualisiereSystem } from '../../lib/systemSync'
import { useToast } from '../../context/ToastContext'
import { BrandMark } from '../ui/BrandMark'
import styles from './SystemSync.module.css'

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus)
}

const uhrzeit = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/**
 * „System aktualisieren 🔄" — lädt Stammdaten, Konten und Einstellungen frisch aus
 * Supabase. Der Punkt davor zeigt, ob Realtime verbunden ist: grün heißt, Änderungen
 * anderer Administratoren kommen ohnehin von selbst an; der Knopf ist dann nur die
 * Rückversicherung.
 */
export function SystemAktualisierenKnopf() {
  const status = useSyncStatus()
  const { showToast } = useToast()
  if (!status.konfiguriert) return null

  const titel = [
    status.live ? 'Live mit Supabase verbunden — Änderungen anderer Geräte kommen automatisch.' : 'Kein Live-Kanal — Abgleich beim Klick, beim Zurückkehren ins Fenster und minütlich.',
    status.letzterAbgleich ? `Letzter Abgleich: ${uhrzeit.format(new Date(status.letzterAbgleich))} Uhr` : 'Noch kein erfolgreicher Abgleich.',
  ].join('\n')

  return (
    <button
      type="button"
      className={styles.knopf}
      disabled={status.laeuft}
      title={titel}
      onClick={async () => {
        await aktualisiereSystem()
        const nachher = getSyncStatus()
        if (nachher.fehler) showToast(nachher.fehler, 'error')
        else showToast('Systemstand aus Supabase geladen — Stammdaten, Konten und Einstellungen sind aktuell.')
      }}
    >
      <span className={status.fehler ? styles.punktFehler : status.live ? styles.punktLive : styles.punkt} aria-hidden="true" />
      {status.laeuft ? 'Aktualisiert …' : 'System aktualisieren 🔄'}
    </button>
  )
}

/** Sichtbarer Hinweis, wenn der Abgleich oder ein Schreibvorgang fehlschlägt. */
export function SyncFehlerLeiste() {
  const status = useSyncStatus()
  if (!status.fehler) return null
  return (
    <div className={styles.leiste} role="alert">
      <span>{status.fehler}</span>
      <button type="button" className={styles.leisteZu} onClick={() => setzeSyncStatus({ fehler: null })} aria-label="Hinweis schließen">
        ✕
      </button>
    </div>
  )
}

/**
 * Hält die Anwendung an, bis der erste Abgleich mit Supabase durch ist — damit weder
 * Anmeldung noch Kalkulation mit einem veralteten Stand beginnen. Nach spätestens acht
 * Sekunden geht es trotzdem weiter (mit dem zuletzt geladenen Stand dieses Geräts); der
 * Kopf meldet dann den Fehler.
 */
export function SystemLadeSchirm({ children }: { children: ReactNode }) {
  const status = useSyncStatus()
  const [zuLange, setZuLange] = useState(false)

  useEffect(() => {
    if (status.ersterAbgleichFertig) return
    const t = window.setTimeout(() => setZuLange(true), 8000)
    return () => window.clearTimeout(t)
  }, [status.ersterAbgleichFertig])

  if (status.ersterAbgleichFertig || zuLange) return <>{children}</>
  return (
    <div className={styles.ladeSchirm} aria-busy="true">
      <BrandMark size="lg" />
      <p className={styles.ladeText}>Systemdaten werden aus Supabase geladen …</p>
    </div>
  )
}
