import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BrandMark } from '../../components/ui/BrandMark'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/TextField'
import { useAuth } from '../../context/AuthContext'
import styles from './AdminAuth.module.css'

/**
 * PHASE 10 – Sichere Root-Einrichtung.
 * Der Systemeigentümer legt (über den Aktivierungslink) einmalig Benutzername,
 * E-Mail und Passwort fest. Danach ist er angemeldet und landet im Admin-Dashboard.
 */
export default function RootSetupPage() {
  const { setupRootAdmin, rootInitialized } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Die Passwörter stimmen nicht überein.')
      return
    }
    const err = setupRootAdmin(token, { username, email, password })
    if (err) {
      setError(err)
      return
    }
    navigate('/admin', { replace: true })
  }

  return (
    <div className={styles.screen}>
      <main className={styles.card}>
        <BrandMark size="lg" />
        <h1 className={styles.title}>Root-Administrator einrichten</h1>

        {rootInitialized ? (
          <>
            <p className={styles.text}>Es ist bereits ein Root-Administrator eingerichtet.</p>
            <Button onClick={() => navigate('/admin')}>Zum Admin-Dashboard</Button>
          </>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <p className={styles.text}>Legen Sie dauerhaft Benutzername und Passwort fest.</p>
            <TextField
              label="Benutzername"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              placeholder="z. B. owner"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <TextField
              label="E-Mail"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="eigentuemer@cramer.de"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <TextField
              label="Passwort (min. 6 Zeichen)"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <TextField
              label="Passwort bestätigen"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" fullWidth>
              Root-Admin anlegen &amp; anmelden
            </Button>
          </form>
        )}
      </main>
    </div>
  )
}
