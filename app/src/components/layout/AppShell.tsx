import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BrandMark } from '../ui/BrandMark'
import { Button } from '../ui/Button'
import { ActionMenu } from './ActionMenu'
import { EditorLeiste } from './EditorLeiste'
import { useAuth } from '../../context/AuthContext'
import { useDraft } from '../../context/DraftContext'
import { getBranch } from '../../config/branches'
import styles from './AppShell.module.css'

interface AppShellProps {
  children: ReactNode
  /** Optionaler Sticky-Footer (z. B. Fortschritt + Primäraktion ab späteren Phasen). */
  footer?: ReactNode
}

/**
 * Persistenter App-Rahmen für alle authentifizierten Arbeits-Screens:
 * Kopfzeile mit Wortmarke, Live-Entwurfskontext, Berater und Aktions-Menü.
 */
export function AppShell({ children, footer }: AppShellProps) {
  const { user, logout, isAdmin } = useAuth()
  const { draft, resetDraft, leaveDraft } = useDraft()
  const navigate = useNavigate()
  const location = useLocation()

  const [verlaesst, setVerlaesst] = useState(false)

  const branchName = getBranch(draft?.branchId)?.name
  const istDashboard = location.pathname === '/'
  // Globaler „Zurück“ überall außer auf dem Dashboard.
  const showBack = !istDashboard

  async function handleLeave() {
    setVerlaesst(true)
    try {
      // Auch wenn das Speichern scheitert, wird der Nutzer nicht festgehalten — die
      // Fehlermeldung kommt als Toast, der lokale Stand bleibt erhalten.
      await leaveDraft()
      navigate('/')
    } finally {
      setVerlaesst(false)
    }
  }

  function handleLogout() {
    resetDraft()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.leftGroup}>
          {showBack ? (
            <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
              ← Zurück
            </button>
          ) : null}
          <button
            type="button"
            className={styles.brand}
            onClick={() => navigate('/')}
            aria-label="Zum Dashboard"
          >
            <BrandMark />
          </button>
        </div>

        {/* Live-Kontext – aktualisiert sich mit jeder Eingabe des Beraters */}
        <div className={styles.context}>
          {draft?.orderNumber ? <ContextItem label="Auftragsnummer" value={draft.orderNumber} /> : null}
          {draft?.customerName ? <ContextItem label="Kunde" value={draft.customerName} /> : null}
          {branchName ? <ContextItem label="Filiale" value={branchName} /> : null}
        </div>

        <div className={styles.right}>
          {/*
            „Entwurf verlassen" — der eine sichtbare Ausgang aus dem Konfigurator,
            unabhängig vom Schritt. Gespeichert wird vorher, und zwar alles, was Inhalt
            hat: Wer nach einem einzigen Buchstaben im Kundennamen abbricht, findet den
            Entwurf im Dashboard wieder statt ihn zu verlieren.
          */}
          {draft && !istDashboard ? (
            <button
              type="button"
              className={styles.leaveBtn}
              onClick={() => void handleLeave()}
              disabled={verlaesst}
              title="Entwurf speichern und zur Übersicht zurückkehren"
            >
              <span aria-hidden="true">✕</span>
              {verlaesst ? 'Speichert …' : 'Entwurf verlassen'}
            </button>
          ) : null}
          {user ? (
            <div className={styles.account}>
              <span className={styles.accountLabel}>{user.role === 'admin' ? 'Administrator' : 'Berater'}</span>
              <span className={styles.accountName}>{user.name}</span>
            </div>
          ) : null}
          {isAdmin ? (
            <Button variant="ghost" onClick={() => navigate('/admin')}>
              Admin
            </Button>
          ) : null}
          <ActionMenu />
          <Button variant="ghost" onClick={handleLogout}>
            Abmelden
          </Button>
        </div>
      </header>

      <EditorLeiste />

      <main className={styles.main}>{children}</main>

      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </div>
  )
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <span className={styles.ctxItem}>
      <span className={styles.ctxLabel}>{label}</span>
      <span className={styles.ctxValue}>{value}</span>
    </span>
  )
}
