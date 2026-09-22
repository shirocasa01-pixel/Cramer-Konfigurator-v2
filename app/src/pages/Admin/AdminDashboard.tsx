import { useState } from 'react'
import { BenutzerVerwaltung } from '../../components/admin/BenutzerVerwaltung'
import { KonfiguratorStruktur } from '../../components/admin/KonfiguratorStruktur'
import { KonfiguratorEinstieg } from '../../components/admin/KonfiguratorEinstieg'
import { StammdatenAdminModal } from '../../components/admin/StammdatenAdminModal'
import { TestdatenBereinigung } from '../../components/admin/TestdatenBereinigung'
import { AppShell } from '../../components/layout/AppShell'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'
import { appConfig } from '../../config/appConfig'
import styles from './Admin.module.css'

/** Die Arbeitsbereiche der Administration. */
type Bereich = 'konfigurator' | 'stammdaten' | 'konten'

const BEREICHE: Array<{ id: Bereich; titel: string; zweck: string }> = [
  { id: 'konfigurator', titel: 'Konfigurator', zweck: 'Aufbau aus Schritten und Auswahlfeldern' },
  { id: 'stammdaten', titel: 'Stammdaten & Artikel', zweck: 'Artikel, Preiszeilen, Oberflächen' },
  { id: 'konten', titel: 'Konten & Betrieb', zweck: 'Zugänge, Registrierung, Wartung' },
]

/**
 * ADMINISTRATION — eine Anlaufstelle für alles, was ohne Code gepflegt wird.
 *
 * Vorher lag hier ausschließlich die Kontenverwaltung, während die Stammdaten- und
 * Artikelverwaltung im Aktionsmenü der Berateransicht hing: Der Administrator meldete
 * sich an und fand das schwächere Werkzeug. Beides steht jetzt hier zusammen, ergänzt um
 * die Übersicht, wie der Konfigurator aus den Stammdaten aufgebaut ist.
 *
 * SELBST-AUSSPERRUNG VERHINDERN (Phase 11.2): Ist der Wartungsmodus aktiv, zeigt die
 * Kopfzeile das unabhängig vom gewählten Bereich sofort mit einem Ausschalt-Knopf — der
 * Administrator, der gerade über den Notfall-Zugang der Wartungsseite hierher fand, muss
 * dafür nicht erst in „Konten & Betrieb" navigieren.
 */
export default function AdminDashboardPage() {
  const [bereich, setBereich] = useState<Bereich>('konfigurator')
  const [stammdatenOffen, setStammdatenOffen] = useState(false)
  const { user, settings, setEnforceCramerEmail, maintenanceActive, setMaintenanceMode } = useAuth()

  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Administration</h1>
          <p className={styles.subtitle}>
            Angemeldet als Administrator <strong>{user?.name}</strong>. Hier laufen die Bereiche
            zusammen, die sich ohne Programmänderung pflegen lassen.
          </p>
        </header>

        {maintenanceActive ? (
          <section className={styles.wartungsBanner} role="status" aria-label="Wartungsmodus aktiv">
            <span className={styles.wartungsText}>
              <strong>⚠ Wartungsmodus ist aktiv</strong> — Berater sehen aktuell die
              Wartungsseite statt des Konfigurators.
            </span>
            {appConfig.isMaintenanceMode ? (
              <span className={styles.wartungsHinweis}>
                Global über die Umgebungsvariable erzwungen — hier nicht deaktivierbar,
                nur per Redeploy.
              </span>
            ) : (
              <Button variant="ghost" onClick={() => setMaintenanceMode(false)}>
                Jetzt deaktivieren
              </Button>
            )}
          </section>
        ) : null}

        <nav className={styles.bereiche} aria-label="Arbeitsbereiche">
          {BEREICHE.map((b) => (
            <button
              key={b.id}
              type="button"
              className={b.id === bereich ? styles.bereichAktiv : styles.bereich}
              onClick={() => setBereich(b.id)}
              aria-current={b.id === bereich}
            >
              <span className={styles.bereichTitel}>{b.titel}</span>
              <span className={styles.bereichZweck}>{b.zweck}</span>
            </button>
          ))}
        </nav>

        {bereich === 'konfigurator' ? (
          <section className={styles.block} aria-label="Konfigurator bearbeiten">
            <h2 className={styles.blockTitle}>Oberfläche bearbeiten</h2>
            <KonfiguratorEinstieg />
          </section>
        ) : null}

        {bereich === 'stammdaten' ? (
          <section className={styles.block} aria-label="Stammdaten">
            <h2 className={styles.blockTitle}>Stammdaten &amp; Artikelverwaltung</h2>
            <p className={styles.subtitle}>
              Artikel, Preiszeilen und Achsen, Oberflächen, Berater und Filialen — dieselbe
              Verwaltung, die auch im Aktionsmenü erreichbar ist. Das Handbuch darin erklärt
              Schritt für Schritt, wie ein neuer Artikel in ein Auswahlfeld kommt.
            </p>
            <Button onClick={() => setStammdatenOffen(true)}>Stammdatenverwaltung öffnen</Button>
            <h3 className={styles.blockTitle}>Welches Auswahlfeld hat welche Artikel?</h3>
            <KonfiguratorStruktur />
          </section>
        ) : null}

        {bereich !== 'konten' ? null : (
          <>
        <section className={styles.block} aria-label="Einstellungen">
          <h2 className={styles.blockTitle}>Registrierungs-Regeln</h2>
          <label className={styles.toggleRow}>
            <span className={styles.toggleText}>
              <span className={styles.toggleLabel}>E-Mail-Domain erzwingen (@cramer.de)</span>
              <span className={styles.toggleHint}>
                {settings.enforceCramerEmail
                  ? 'Produktions-Regel aktiv: Mitarbeiter-E-Mails müssen auf @cramer.de enden.'
                  : 'Testphase: beliebige E-Mail-Domain erlaubt (für interne Freigabe).'}
              </span>
            </span>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={settings.enforceCramerEmail}
              onChange={(event) => setEnforceCramerEmail(event.target.checked)}
            />
          </label>
        </section>

        <section className={styles.block} aria-label="Betrieb">
          <h2 className={styles.blockTitle}>Betrieb &amp; Wartung</h2>
          <label className={styles.toggleRow}>
            <span className={styles.toggleText}>
              <span className={styles.toggleLabel}>
                Wartungsmodus {maintenanceActive ? '· AKTIV' : ''}
              </span>
              <span className={styles.toggleHint}>
                Blendet bei allen Nutzern ein Wartungs-Overlay ein. Schnellschalter (gerätelokal);
                global über die Env-Variable <code>VITE_MAINTENANCE_MODE</code> + Redeploy.
                {appConfig.isMaintenanceMode
                  ? ' Aktuell global per Env erzwungen – hier nicht deaktivierbar.'
                  : ''}
              </span>
            </span>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={settings.maintenanceMode}
              disabled={appConfig.isMaintenanceMode}
              onChange={(event) => setMaintenanceMode(event.target.checked)}
            />
          </label>
        </section>

        {/*
          EINE Liste für Berater UND Administratoren.

          Hier standen zwei getrennte Abschnitte („Mitarbeiter (Verkäufer)" und
          „Administratoren") mit eigenen Anlege-Formularen und einem großen
          „Entfernen"-Knopf an jeder Zeile — während die Stammdatenverwaltung parallel
          dieselben Personen im Blatt „40 Mitarbeiter" führte. Drei Orte für einen
          Menschen; genau daraus entstanden die doppelten Konten.
        */}
        <section className={styles.block} aria-label="Benutzer">
          <h2 className={styles.blockTitle}>Benutzer &amp; Rechte</h2>
          <BenutzerVerwaltung />
        </section>

        <section className={styles.block} aria-label="Test-Daten">
          <h2 className={styles.blockTitle}>Vorführung vorbereiten</h2>
          <TestdatenBereinigung />
        </section>

          </>
        )}
      </div>
      <StammdatenAdminModal open={stammdatenOffen} onClose={() => setStammdatenOffen(false)} />
    </AppShell>
  )
}
