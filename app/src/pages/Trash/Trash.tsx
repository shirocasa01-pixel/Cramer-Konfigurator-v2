import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { useDraft } from '../../context/DraftContext'
import { getBranch } from '../../config/branches'
import styles from './Trash.module.css'

const datumFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

function formatiere(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : datumFmt.format(d)
}

/**
 * PAPIERKORB — verworfene Entwürfe, wiederherstellbar bis zum endgültigen Leeren.
 *
 * „Löschen" im Dashboard entfernt nichts aus der Datenbank, sondern setzt `deletedAt`.
 * Erst „Papierkorb leeren" löscht wirklich — und fragt davor ein zweites Mal nach.
 * Ein versehentlicher Klick im Dashboard kostet damit keinen Entwurf mehr.
 */
export default function TrashPage() {
  const { trashedDrafts, restoreDraft, emptyTrash, draftsLoading } = useDraft()
  const navigate = useNavigate()
  const [leerenOffen, setLeerenOffen] = useState(false)
  const [laeuft, setLaeuft] = useState<string | null>(null)

  async function handleRestore(id: string) {
    setLaeuft(id)
    try {
      await restoreDraft(id)
    } finally {
      setLaeuft(null)
    }
  }

  async function handleEmpty() {
    setLaeuft('__alle__')
    try {
      await emptyTrash()
      setLeerenOffen(false)
    } finally {
      setLaeuft(null)
    }
  }

  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Papierkorb</h1>
            <p className={styles.subtitle}>
              Hier liegen verworfene Entwürfe. Sie bleiben in der Datenbank, bis der Papierkorb geleert
              wird — bis dahin lassen sie sich jederzeit zurückholen.
            </p>
          </div>
          <div className={styles.headActions}>
            <Button variant="ghost" onClick={() => navigate('/')}>
              Zur Übersicht
            </Button>
            {trashedDrafts.length > 0 ? (
              <button type="button" className={styles.emptyBtn} onClick={() => setLeerenOffen(true)}>
                Papierkorb leeren ({trashedDrafts.length})
              </button>
            ) : null}
          </div>
        </header>

        {draftsLoading ? (
          <p className={styles.leer}>Wird geladen …</p>
        ) : trashedDrafts.length === 0 ? (
          <p className={styles.leer}>
            Der Papierkorb ist leer. Über „Löschen" im Dashboard verworfene Entwürfe erscheinen hier.
          </p>
        ) : (
          <ul className={styles.liste}>
            {trashedDrafts.map((entwurf) => (
              <li key={entwurf.id} className={styles.eintrag}>
                <div className={styles.info}>
                  <span className={styles.nummer}>{entwurf.id}</span>
                  <span className={styles.kunde}>{entwurf.customerName || 'ohne Kundenname'}</span>
                  <span className={styles.meta}>
                    {entwurf.consultant?.name ?? 'unbekannt'}
                    {getBranch(entwurf.branchId) ? ` · ${getBranch(entwurf.branchId)?.name}` : ''}
                    {' · angelegt '}
                    {formatiere(entwurf.createdAt)}
                    {' · verworfen '}
                    {formatiere(entwurf.deletedAt)}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.restore}
                  onClick={() => void handleRestore(entwurf.id)}
                  disabled={laeuft !== null}
                >
                  {laeuft === entwurf.id ? 'Stellt wieder her …' : '↩ Wiederherstellen'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={leerenOffen}
        title="Papierkorb endgültig leeren?"
        onClose={() => setLeerenOffen(false)}
      >
        <p className={styles.modalText}>
          {trashedDrafts.length} Entwurf/Entwürfe werden unwiderruflich aus der Datenbank entfernt.
          Das lässt sich nicht rückgängig machen.
        </p>
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={() => setLeerenOffen(false)} disabled={laeuft !== null}>
            Abbrechen
          </Button>
          <button
            type="button"
            className={styles.emptyBtn}
            onClick={() => void handleEmpty()}
            disabled={laeuft !== null}
          >
            {laeuft === '__alle__' ? 'Löscht …' : 'Endgültig löschen'}
          </button>
        </div>
      </Modal>
    </AppShell>
  )
}
