import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandMark } from '../../components/ui/BrandMark'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { useAuth } from '../../context/AuthContext'
import { beschreibeVersion } from '../../lib/version'
import styles from './Login.module.css'

/**
 * PHASE 1 + 10 – Authentifizierung.
 * Login per Berater-E-Mail ODER Admin-Benutzername. Ist noch kein Systemeigentümer
 * eingerichtet, bietet die Maske den simulierten Root-Aktivierungslink an.
 *
 * DIESE SEITE PRÜFT NIE AUF WARTUNGSMODUS (Phase 11.3) — bewusst, nach einer
 * Überarbeitung, in der genau diese Vermischung die Anmeldung blockiert hatte. Ob jemand
 * sich anmelden darf, entscheidet ausschließlich `login()`; WAS nach einer erfolgreichen
 * Anmeldung als Nächstes kommt (Konfigurator, Wartungsseite oder Admin-Dashboard),
 * entscheidet die zentrale Weiche in `App.tsx` (`RequireAuth` / `RequireWartung`) —
 * nicht diese Komponente. Ein „Notfall-Zugang" ist damit auch nicht mehr nötig: Diese
 * Seite ist der normale Zugang, immer.
 */
export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

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
    // Admin immer direkt ins Dashboard. Berater immer zum Dashboard-Pfad „/" — läuft
    // dort gerade eine Wartung, leitet `RequireAuth` in App.tsx von selbst zu
    // „/wartung" weiter. Diese Weiche steht bewusst nur an EINER Stelle im Code.
    navigate(result.isAdmin ? '/admin' : '/', { replace: true })
  }

  return (
    <div className={styles.screen}>
      <main className={styles.card}>
        <header className={styles.header}>
          <BrandMark size="lg" />
          <p className={styles.subtitle}>Vertriebs-Konfigurator · Interner Zugang</p>
        </header>

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

      {/*
        Der Versionsstand gehört sichtbar auf die Anmeldeseite: Fragt ein Berater „habe
        ich die aktuelle Fassung?", ist das die Stelle, an der er ohne Anmeldung
        nachsehen kann — und die Stelle, die im Support-Gespräch zuerst abgefragt wird.
      */}
      <p className={styles.version}>{beschreibeVersion()}</p>

      <p className={styles.copyright}>
        © {new Date().getFullYear()} Cramer · Nur zur internen Verwendung
      </p>
    </div>
  )
}
