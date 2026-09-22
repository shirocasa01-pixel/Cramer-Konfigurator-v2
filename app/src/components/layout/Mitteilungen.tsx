import { useEffect, useRef, useSyncExternalStore } from 'react'
import { Modal } from '../ui/Modal'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  beschreibeZeitpunkt,
  getAktuelleVersion,
  getVersionen,
  markiereVersionenAlsGelesen,
  subscribeVersionen,
  ungeleseneVersionen,
} from '../../lib/version'
import styles from './Mitteilungen.module.css'

/** Abonniert die Versions-Historie — eine Stelle, damit die Anbindung nicht dreimal steht. */
export function useVersionen() {
  return useSyncExternalStore(subscribeVersionen, getVersionen, getVersionen)
}

export function useUngelesene(): number {
  return useSyncExternalStore(subscribeVersionen, ungeleseneVersionen, ungeleseneVersionen)
}

/**
 * DER VERSIONS-WÄCHTER.
 *
 * Hängt einmal im App-Rahmen und meldet sich, wenn eine Version dazukommt, die beim
 * Betreten der Seite noch nicht da war. Der Vergleich läuft über die zuletzt GESEHENE
 * Versionsnummer in einer Referenz, nicht über den Gelesen-Stand: Sonst bekäme jeder
 * Berater die Meldung erneut, sobald er die Mitteilungen einmal schließt, ohne sie zu
 * lesen — und beim ersten Laden gleich eine für jede je veröffentlichte Version.
 *
 * Für den Administrator, der gerade selbst veröffentlicht hat, wäre die Meldung eine
 * Rückmeldung auf den eigenen Klick — die bekommt er schon von der Bearbeitungsleiste.
 * Deshalb bleibt sie den Beratern vorbehalten.
 */
export function VersionsWaechter() {
  const versionen = useVersionen()
  const { showToast } = useToast()
  const { isAdmin, isAuthenticated } = useAuth()
  const gesehenRef = useRef<string | null>(null)

  useEffect(() => {
    const aktuell = getAktuelleVersion().version
    // Erster Durchlauf: nur merken, nicht melden. Was beim Anmelden schon galt, ist
    // keine Neuigkeit.
    if (gesehenRef.current === null) {
      gesehenRef.current = aktuell
      return
    }
    if (gesehenRef.current === aktuell) return
    gesehenRef.current = aktuell
    if (!isAuthenticated || isAdmin) return
    showToast(`🔔 Neue Version v${aktuell} verfügbar. Bitte Profil aktualisieren.`, 'info')
  }, [versionen, showToast, isAdmin, isAuthenticated])

  return null
}

/**
 * Die Liste der veröffentlichten Versionen — Datum, Uhrzeit, Nummer, Notiz.
 *
 * Öffnen zählt als Lesen: Der Punkt am Menü ist danach weg. Eine zusätzliche
 * „als gelesen markieren"-Schaltfläche wäre eine Handlung, die niemand bewusst ausführen
 * will — man hat ja gerade hingesehen.
 */
export function MitteilungenModal({ offen, onSchliessen }: { offen: boolean; onSchliessen: () => void }) {
  const versionen = useVersionen()

  useEffect(() => {
    if (offen) markiereVersionenAlsGelesen()
  }, [offen, versionen.length])

  if (!offen) return null

  return (
    <Modal open title="Mitteilungen" onClose={onSchliessen}>
      {versionen.length === 0 ? (
        <p className={styles.leer}>
          Noch keine Veröffentlichung. Sobald ein Administrator eine neue Fassung des
          Konfigurators freigibt, steht sie hier mit Datum und Versionsnummer.
        </p>
      ) : (
        <ul className={styles.liste}>
          {versionen.map((eintrag, index) => (
            <li key={`${eintrag.version}-${eintrag.veroeffentlichtAm}`} className={styles.eintrag}>
              <span className={styles.kopf}>
                <span className={styles.nummer}>v{eintrag.version}</span>
                {index === 0 ? <span className={styles.aktuell}>aktuell</span> : null}
              </span>
              <span className={styles.zeit}>{beschreibeZeitpunkt(eintrag.veroeffentlichtAm)}</span>
              {eintrag.notiz ? <span className={styles.notiz}>{eintrag.notiz}</span> : null}
              {eintrag.von ? <span className={styles.von}>veröffentlicht von {eintrag.von}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
