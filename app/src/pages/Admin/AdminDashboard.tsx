import { useState, type FormEvent } from 'react'
import { KonfiguratorStruktur } from '../../components/admin/KonfiguratorStruktur'
import { KonfiguratorEinstieg } from '../../components/admin/KonfiguratorEinstieg'
import { StammdatenAdminModal } from '../../components/admin/StammdatenAdminModal'
import { AppShell } from '../../components/layout/AppShell'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
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
 */
export default function AdminDashboardPage() {
  const [bereich, setBereich] = useState<Bereich>('konfigurator')
  const [stammdatenOffen, setStammdatenOffen] = useState(false)
  const {
    user,
    consultants,
    admins,
    addConsultant,
    deleteConsultant,
    addAdmin,
    settings,
    setEnforceCramerEmail,
    maintenanceActive,
    setMaintenanceMode,
  } = useAuth()

  // Mitarbeiter-Formular
  const [cName, setCName] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [cPassword, setCPassword] = useState('')
  const [cError, setCError] = useState<string | null>(null)
  const [cOk, setCOk] = useState(false)

  function submitConsultant(event: FormEvent) {
    event.preventDefault()
    setCError(null)
    setCOk(false)
    const err = addConsultant({ name: cName, email: cEmail, password: cPassword })
    if (err) {
      setCError(err)
      return
    }
    setCName('')
    setCEmail('')
    setCPassword('')
    setCOk(true)
  }

  // Admin-Formular
  const [aUser, setAUser] = useState('')
  const [aEmail, setAEmail] = useState('')
  const [aPassword, setAPassword] = useState('')
  const [aError, setAError] = useState<string | null>(null)
  const [aOk, setAOk] = useState(false)

  function submitAdmin(event: FormEvent) {
    event.preventDefault()
    setAError(null)
    setAOk(false)
    const err = addAdmin({ username: aUser, email: aEmail, password: aPassword })
    if (err) {
      setAError(err)
      return
    }
    setAUser('')
    setAEmail('')
    setAPassword('')
    setAOk(true)
  }

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

        <section className={styles.block} aria-label="Mitarbeiter">
          <h2 className={styles.blockTitle}>Mitarbeiter (Verkäufer) · {consultants.length}</h2>
          <form className={styles.form} onSubmit={submitConsultant} noValidate>
            <div className={styles.formGrid}>
              <TextField label="Name" placeholder="Vor- und Nachname" value={cName} onChange={(e) => setCName(e.target.value)} />
              <TextField label="E-Mail" placeholder="name@cramer.de" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
              <TextField label="Passwort (min. 6)" type="password" value={cPassword} onChange={(e) => setCPassword(e.target.value)} />
            </div>
            {cError ? <p className={styles.error} role="alert">{cError}</p> : null}
            {cOk ? <p className={styles.ok}>Mitarbeiter-Konto angelegt ✓</p> : null}
            <Button type="submit">Mitarbeiter anlegen</Button>
          </form>
          <ul className={styles.list}>
            {consultants.map((consultant) => (
              <li key={consultant.id} className={styles.row}>
                <div className={styles.rowInfo}>
                  <span className={styles.rowName}>{consultant.name}</span>
                  <span className={styles.rowMeta}>{consultant.email}</span>
                </div>
                <button
                  type="button"
                  className={styles.delete}
                  onClick={() => {
                    if (window.confirm(`Konto ${consultant.email} entfernen?`)) deleteConsultant(consultant.id)
                  }}
                >
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.block} aria-label="Administratoren">
          <h2 className={styles.blockTitle}>Administratoren · {admins.length}</h2>
          <form className={styles.form} onSubmit={submitAdmin} noValidate>
            <div className={styles.formGrid}>
              <TextField label="Benutzername" value={aUser} onChange={(e) => setAUser(e.target.value)} />
              <TextField label="E-Mail" placeholder="admin@cramer.de" value={aEmail} onChange={(e) => setAEmail(e.target.value)} />
              <TextField label="Passwort (min. 6)" type="password" value={aPassword} onChange={(e) => setAPassword(e.target.value)} />
            </div>
            {aError ? <p className={styles.error} role="alert">{aError}</p> : null}
            {aOk ? <p className={styles.ok}>Administrator angelegt ✓</p> : null}
            <Button type="submit">Administrator hinzufügen</Button>
          </form>
          <ul className={styles.list}>
            {admins.map((admin) => (
              <li key={admin.id} className={styles.row}>
                <div className={styles.rowInfo}>
                  <span className={styles.rowName}>
                    {admin.username}
                    {admin.isRoot ? <span className={styles.rootBadge}>Root</span> : null}
                  </span>
                  <span className={styles.rowMeta}>{admin.email}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
          </>
        )}
      </div>
      <StammdatenAdminModal open={stammdatenOffen} onClose={() => setStammdatenOffen(false)} />
    </AppShell>
  )
}
