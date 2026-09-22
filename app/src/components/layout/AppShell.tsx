import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BrandMark } from '../ui/BrandMark'
import { Button } from '../ui/Button'
import { ActionMenu } from './ActionMenu'
import { EditorLeiste } from './EditorLeiste'
import { VersionsWaechter } from './Mitteilungen'
import { useAuth } from '../../context/AuthContext'
import { useDraft } from '../../context/DraftContext'
import { setzeEditorModus, useEditorModus } from '../../lib/editorModus'
import styles from './AppShell.module.css'

interface AppShellProps {
  children: ReactNode
  /** Optionaler Sticky-Footer (z. B. Fortschritt + Primäraktion ab späteren Phasen). */
  footer?: ReactNode
}

/** Die sieben Schritte des Konfigurators — dort, und nur dort, gibt es etwas vorzuschauen. */
const KONFIGURATOR_ROUTEN = [
  '/new',
  '/products',
  '/dimensions',
  '/korpus',
  '/ausstattung',
  '/fronts',
  '/summary',
]

/**
 * Persistenter App-Rahmen für alle authentifizierten Arbeits-Screens.
 *
 * DER „ZURÜCK"-KNOPF IST WEG, und das war kein Schönheitsfehler: Er rief
 * `navigate(-1)` auf, also den Browser-Verlauf. Der Verlauf kennt aber keine
 * Konfigurations-Schritte, sondern nur Adressen — nach einem Sprung über den
 * Schritt-Indikator, einem Rücksprung aus dem Papierkorb oder einer Weiterleitung
 * landete man irgendwo, nur nicht „einen Schritt zurück". An seiner Stelle stehen jetzt
 * Rückgängig und Wiederherstellen, die sich auf den ENTWURF beziehen statt auf den
 * Verlauf — dieselbe Erwartung wie in Word oder Excel.
 */
export function AppShell({ children, footer }: AppShellProps) {
  const { user, logout, isAdmin } = useAuth()
  const {
    draft,
    resetDraft,
    leaveDraft,
    kannRueckgaengig,
    kannWiederherstellen,
    rueckgaengig,
    wiederherstellen,
  } = useDraft()
  const navigate = useNavigate()
  const location = useLocation()
  const bearbeitung = useEditorModus()

  const [verlaesst, setVerlaesst] = useState(false)

  const istDashboard = location.pathname === '/'
  /**
   * Der Umschalter gehört ausschließlich in die Konfigurator-Schritte.
   *
   * Aufgezählt statt ausgeschlossen: Eine Regel wie „überall außer Dashboard und
   * Verwaltung" ließ ihn auch im Papierkorb erscheinen, wo es nichts vorzuschauen gibt.
   * Eine neue Seite soll ihn nicht aus Versehen erben.
   */
  const imKonfigurator = KONFIGURATOR_ROUTEN.includes(location.pathname)

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
      {/*
        Horcht auf neue Veröffentlichungen und meldet sie als Toast. Sitzt im Rahmen, weil
        der auf jedem angemeldeten Bildschirm steht — die Mitteilung soll den Berater
        erreichen, egal in welchem Schritt er gerade ist.
      */}
      <VersionsWaechter />

      <header className={styles.topbar}>
        <div className={styles.leftGroup}>
          {/*
            Rückgängig / Wiederherstellen. Der Vorwärts-Pfeil erscheint erst, nachdem
            einmal zurückgenommen wurde — solange es nichts wiederherzustellen gibt, wäre
            er ein toter Knopf, der bei jedem Blick die Frage aufwirft, warum er nicht geht.
          */}
          {draft ? (
            <div className={styles.historie}>
              <button
                type="button"
                className={styles.histBtn}
                onClick={rueckgaengig}
                disabled={!kannRueckgaengig}
                title="Rückgängig — springt zu der Stelle, an der die Änderung war"
                aria-label="Rückgängig"
              >
                ↶
              </button>
              {kannWiederherstellen ? (
                <button
                  type="button"
                  className={styles.histBtn}
                  onClick={wiederherstellen}
                  title="Wiederherstellen"
                  aria-label="Wiederherstellen"
                >
                  ↷
                </button>
              ) : null}
            </div>
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

        {/*
          Live-Kontext — Kunde und Auftragsnummer, mehr nicht. Die Filiale stand hier
          ebenfalls und kostete den Platz, den bei langen Kundennamen beide brauchen; sie
          steht ohnehin im Auftragskopf und auf dem AV-PDF.
        */}
        <div className={styles.context}>
          {draft?.orderNumber ? <ContextItem label="Auftragsnummer" value={draft.orderNumber} /> : null}
          {draft?.customerName ? <ContextItem label="Kunde" value={draft.customerName} /> : null}
        </div>

        <div className={styles.right}>
          {draft && !istDashboard ? (
            <button
              type="button"
              className={styles.leaveBtn}
              onClick={() => void handleLeave()}
              disabled={verlaesst}
              title="Entwurf speichern und zur Übersicht zurückkehren"
            >
              {verlaesst ? 'Speichert …' : 'Entwurf speichern'}
            </button>
          ) : null}

          {/*
            VORSCHAU ⇄ ADMIN. Ein Knopf mit zwei Beschriftungen statt zweier Knöpfe: Er
            sagt immer, wohin er führt, nicht wo man ist. In der Bearbeitung heißt er
            „Vorschau" (so sieht es der Berater), in der Vorschau „Admin" (zurück an die
            Werkbank). Der Entwurf des Administrators bleibt dabei unangetastet — die
            Schicht wird nur aus- und wieder eingeblendet.
          */}
          {isAdmin && imKonfigurator ? (
            <button
              type="button"
              className={bearbeitung ? styles.modusBtn : styles.modusBtnAktiv}
              onClick={() => setzeEditorModus(!bearbeitung)}
              title={
                bearbeitung
                  ? 'Bearbeitungsschicht ausblenden und den Konfigurator wie ein Berater sehen'
                  : 'Zurück in die Bearbeitung'
              }
            >
              {bearbeitung ? '👁 Vorschau' : '✏️ Admin'}
            </button>
          ) : null}

          {user ? (
            <div className={styles.account}>
              <span className={styles.accountLabel}>{user.role === 'admin' ? 'Administrator' : 'Berater'}</span>
              <span className={styles.accountName}>{user.name}</span>
            </div>
          ) : null}
          {/*
            Führt in die Verwaltung und heißt deshalb so. „Admin" wäre jetzt zweideutig:
            Der Umschalter oben trägt dieselbe Beschriftung, meint aber die
            Bearbeitungsschicht im laufenden Konfigurator.
          */}
          {isAdmin ? (
            <Button variant="ghost" onClick={() => navigate('/admin')}>
              Verwaltung
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
