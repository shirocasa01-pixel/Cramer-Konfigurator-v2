import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BrandMark } from '../../components/ui/BrandMark'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { useAuth } from '../../context/AuthContext'
import styles from './Login.module.css'

/**
 * PHASE 1 + 10 – Authentifizierung.
 * Login per Berater-E-Mail ODER Admin-Benutzername. Ist noch kein Systemeigentümer
 * eingerichtet, bietet die Maske den simulierten Root-Aktivierungslink an.
 *
 * Diese Route bleibt IMMER erreichbar, auch bei aktivem Wartungsmodus (siehe die
 * `maintenanceExempt`-Prüfung in `App.tsx`) — der Notfall-Zugang auf der Wartungsseite
 * führt genau hierher, mit `?grund=wartung` in der URL für den Hinweis unten.
 */
export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const ausWartungsmodus = searchParams.get('grund') === 'wartung'

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError(null)

    const nextErrors: { identifier?: string; password?: string } = {}
    if (!identifier.trim()) nextErrors.identifier = 'Bitte E-Mail oder Benutzername eingeben.'
    if (!password) nextErrors.password = 'Bitte Passwort eingeben.'
    setErrors(nextErrors)
    if (nextErrors.identifier || nextErrors.password) return

    setSubmitting(true)
    const result = await login(identifier, password)
    if (!result.ok) {
      setFormError(result.error ?? 'Anmeldung fehlgeschlagen.')
      setSubmitting(false)
      return
    }
    navigate(result.isAdmin ? '/admin' : '/', { replace: true })
  }

  return (
    <div className={styles.screen}>
      <main className={styles.card}>
        <header className={styles.header}>
          <BrandMark size="lg" />
          <p className={styles.subtitle}>Vertriebs-Konfigurator · Interner Zugang</p>
        </header>

        {ausWartungsmodus ? (
          <p className={styles.notice} role="status">
            🔒 Notfall-Zugang während der Wartung — mit dem Administrator-Konto anmelden,
            um den Wartungsmodus zu beenden.
          </p>
        ) : null}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <TextField
            label="E-Mail oder Admin-Benutzername"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            placeholder="vorname.nachname@cramer.de"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            error={errors.identifier}
          />
          <TextField
            label="Passwort"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={errors.password}
          />

          {formError ? (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          ) : null}

          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? 'Anmelden …' : 'Anmelden'}
          </Button>
        </form>

        <footer className={styles.demo}>
          <span className={styles.demoTag}>Demo</span>
          <span>anna.berger@cramer.de · Passwort: cramer2026</span>
        </footer>
      </main>

      <p className={styles.copyright}>
        © {new Date().getFullYear()} Cramer · Nur zur internen Verwendung
      </p>
    </div>
  )
}
