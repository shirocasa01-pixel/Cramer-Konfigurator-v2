import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BrandMark } from '../../components/ui/BrandMark'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'
import styles from './AdminAuth.module.css'

/**
 * PHASE 10 – Simulierter Root-Aktivierungslink.
 * Stellt den einmaligen Aktivierungslink dar (in Produktion per E-Mail an den
 * Systemeigentümer). Der Klick führt zur sicheren Einrichtungs-Maske.
 */
export default function RootActivatePage() {
  const { rootInitialized, activationToken, requestRootActivation } = useAuth()
  const navigate = useNavigate()

  // Bei Direktaufruf ohne Token einen erzeugen.
  useEffect(() => {
    if (!rootInitialized && !activationToken) requestRootActivation()
  }, [rootInitialized, activationToken, requestRootActivation])

  const token = activationToken ?? ''
  const link = `${window.location.origin}/admin/setup?token=${token}`

  return (
    <div className={styles.screen}>
      <main className={styles.card}>
        <BrandMark size="lg" />
        <h1 className={styles.title}>Systemeigentümer aktivieren</h1>

        {rootInitialized ? (
          <>
            <p className={styles.text}>Der Systemeigentümer ist bereits eingerichtet.</p>
            <Button onClick={() => navigate('/login')}>Zum Login</Button>
          </>
        ) : (
          <>
            <p className={styles.text}>
              Simulierter Aktivierungslink (in Produktion per E-Mail an den Eigentümer):
            </p>
            <div className={styles.linkBox}>{link}</div>
            <Button
              fullWidth
              onClick={() => navigate(`/admin/setup?token=${encodeURIComponent(token)}`)}
            >
              Aktivierung &amp; Einrichtung starten →
            </Button>
            <button type="button" className={styles.back} onClick={() => navigate('/login')}>
              Zurück zum Login
            </button>
          </>
        )}
      </main>
    </div>
  )
}
