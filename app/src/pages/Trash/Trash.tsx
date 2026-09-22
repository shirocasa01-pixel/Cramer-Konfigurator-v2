import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/layout/AppShell'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { useAuth } from '../../context/AuthContext'
import { useDraft, ENTWURF_AUFBEWAHRUNG_TAGE } from '../../context/DraftContext'
import { getBranch } from '../../config/branches'
import {
  ausPapierkorbWiederherstellen,
  endgueltigLoeschen,
  listeGeloeschteBenutzer,
  raeumeUeberfaelligeBenutzer,
} from '../../lib/benutzerVerwaltung'
import { AUFBEWAHRUNG_TAGE, subscribeBenutzerPapierkorb, verbleibendeTage } from '../../lib/benutzerPapierkorb'
import { subscribe as subscribeStammdaten } from '../../lib/stammdatenStore'
import styles from './Trash.module.css'

const datumFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

function formatiere(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : datumFmt.format(d)
}

/** Verbleibende Tage eines verworfenen Entwurfs bis zur automatischen Löschung. */
function restTage(deletedAt: string | undefined): number {
  if (!deletedAt) return ENTWURF_AUFBEWAHRUNG_TAGE
  const zeitpunkt = new Date(deletedAt).getTime()
  if (Number.isNaN(zeitpunkt)) return ENTWURF_AUFBEWAHRUNG_TAGE
  const vergangen = (Date.now() - zeitpunkt) / (24 * 60 * 60 * 1000)
  return Math.max(0, Math.ceil(ENTWURF_AUFBEWAHRUNG_TAGE - vergangen))
}

function Frist({ tage }: { tage: number }) {
  return (
    <span className={tage <= 3 ? styles.fristKnapp : styles.frist}>
      {tage === 0 ? 'wird demnächst gelöscht' : `noch ${tage} Tag${tage === 1 ? '' : 'e'}`}
    </span>
  )
}

type Reiter = 'entwuerfe' | 'berater'

/**
 * PAPIERKORB — zwei Reiter, aber nur für den, der beide braucht.
 *
 * Für den Berater ist der Papierkorb genau eine Liste: seine eigenen verworfenen
 * Entwürfe. Er sieht bewusst nicht die der Kollegen — im Dashboard sind Entwürfe
 * gemeinsam sichtbar, beim Wiederherstellen und Löschen ist das eine andere Frage.
 *
 * Der Administrator bekommt einen zweiten Reiter mit den Konten, die er gelöscht hat.
 * Beides landet im selben Menüpunkt, weil beides dieselbe Zusage trägt: 30 Tage lang ist
 * nichts endgültig.
 */
export default function TrashPage() {
  const { trashedDrafts, restoreDraft, emptyTrash, draftsLoading } = useDraft()
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [reiter, setReiter] = useState<Reiter>('entwuerfe')
  const [leerenOffen, setLeerenOffen] = useState(false)
  const [laeuft, setLaeuft] = useState<string | null>(null)
  /** Konto, für das die endgültige Löschung bestätigt werden muss. */
  const [loeschKandidat, setLoeschKandidat] = useState<{ personalnr: string; name: string } | null>(null)

  // Die Liste hängt an zwei Speichern: dem Papierkorb (Fristen) und den Stammdaten
  // (Namen, Status). Beide müssen die Ansicht auffrischen können.
  useSyncExternalStore(subscribeBenutzerPapierkorb, () => undefined, () => undefined)
  useSyncExternalStore(subscribeStammdaten, () => undefined, () => undefined)

  /*
    Abgelaufene Konten räumen, wenn jemand hinsieht — ohne Server gibt es keinen
    nächtlichen Lauf. Im Effekt, nicht im `useMemo`: Räumen ist eine Nebenwirkung, und
    `useMemo` darf keine haben (React ruft es im Entwicklungsmodus doppelt auf und darf es
    jederzeit verwerfen).
  */
  useEffect(() => {
    if (isAdmin) raeumeUeberfaelligeBenutzer()
  }, [isAdmin])

  const geloeschteBerater = isAdmin ? listeGeloeschteBenutzer() : []

  /**
   * Der Berater sieht nur seine eigenen Entwürfe, der Administrator alle — er ist der,
   * der nach einem Versehen gefragt wird, und der die Vorführ-Bereinigung macht.
   */
  const eigeneEntwuerfe = useMemo(
    () => (isAdmin ? trashedDrafts : trashedDrafts.filter((e) => e.consultant?.id === user?.id)),
    [trashedDrafts, isAdmin, user?.id],
  )

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
      await emptyTrash(eigeneEntwuerfe.map((e) => e.id))
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
              Verworfenes bleibt {ENTWURF_AUFBEWAHRUNG_TAGE} Tage liegen und lässt sich bis dahin
              jederzeit zurückholen. Danach wird es automatisch endgültig entfernt.
            </p>
          </div>
          <div className={styles.headActions}>
            <Button variant="ghost" onClick={() => navigate('/')}>
              Zur Übersicht
            </Button>
          </div>
        </header>

        {/* Die Reiter erscheinen nur, wenn es zwei gibt — ein einzelner Reiter ist keiner. */}
        {isAdmin ? (
          <nav className={styles.reiter} aria-label="Papierkorb-Bereiche">
            <button
              type="button"
              className={reiter === 'entwuerfe' ? styles.reiterAktiv : styles.reiterBtn}
              onClick={() => setReiter('entwuerfe')}
              aria-current={reiter === 'entwuerfe'}
            >
              Entwürfe
              {eigeneEntwuerfe.length > 0 ? <span className={styles.zaehler}>{eigeneEntwuerfe.length}</span> : null}
            </button>
            <button
              type="button"
              className={reiter === 'berater' ? styles.reiterAktiv : styles.reiterBtn}
              onClick={() => setReiter('berater')}
              aria-current={reiter === 'berater'}
            >
              Berater
              {geloeschteBerater.length > 0 ? (
                <span className={styles.zaehler}>{geloeschteBerater.length}</span>
              ) : null}
            </button>
          </nav>
        ) : null}

        {reiter === 'entwuerfe' ? (
          <>
            {eigeneEntwuerfe.length > 0 ? (
              <div className={styles.listenKopf}>
                <button type="button" className={styles.emptyBtn} onClick={() => setLeerenOffen(true)}>
                  Papierkorb leeren ({eigeneEntwuerfe.length})
                </button>
              </div>
            ) : null}

            {draftsLoading ? (
              <p className={styles.leer}>Wird geladen …</p>
            ) : eigeneEntwuerfe.length === 0 ? (
              <p className={styles.leer}>
                Keine verworfenen Entwürfe. Über „Löschen" im Dashboard verworfene Entwürfe
                erscheinen hier.
              </p>
            ) : (
              <ul className={styles.liste}>
                {eigeneEntwuerfe.map((entwurf) => (
                  <li key={entwurf.id} className={styles.eintrag}>
                    <div className={styles.info}>
                      <span className={styles.nummer}>
                        {entwurf.id}
                        <Frist tage={restTage(entwurf.deletedAt)} />
                      </span>
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
          </>
        ) : (
          <>
            {geloeschteBerater.length === 0 ? (
              <p className={styles.leer}>
                Keine gelöschten Berater-Konten. Über das Drei-Punkte-Menü in der
                Benutzerverwaltung gelöschte Konten liegen hier {AUFBEWAHRUNG_TAGE} Tage lang.
              </p>
            ) : (
              <ul className={styles.liste}>
                {geloeschteBerater.map((benutzer) => (
                  <li key={benutzer.personalnr} className={styles.eintrag}>
                    <div className={styles.info}>
                      <span className={styles.nummer}>
                        {benutzer.personalnr}
                        {benutzer.papierkorb ? <Frist tage={verbleibendeTage(benutzer.papierkorb)} /> : null}
                      </span>
                      <span className={styles.kunde}>{benutzer.name}</span>
                      <span className={styles.meta}>
                        {benutzer.email || 'ohne E-Mail'}
                        {' · gelöscht '}
                        {formatiere(benutzer.papierkorb?.geloeschtAm)}
                      </span>
                    </div>
                    <div className={styles.beraterAktionen}>
                      <button
                        type="button"
                        className={styles.restore}
                        onClick={() => ausPapierkorbWiederherstellen(benutzer.personalnr)}
                      >
                        ↩ Wiederherstellen
                      </button>
                      <button
                        type="button"
                        className={styles.emptyBtn}
                        onClick={() =>
                          setLoeschKandidat({ personalnr: benutzer.personalnr, name: benutzer.name })
                        }
                      >
                        Endgültig löschen
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <Modal
        open={leerenOffen}
        title="Papierkorb endgültig leeren?"
        onClose={() => setLeerenOffen(false)}
      >
        <p className={styles.modalText}>
          {eigeneEntwuerfe.length} Entwurf/Entwürfe werden unwiderruflich aus der Datenbank entfernt.
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

      {/*
        Der Wortlaut ist abgestimmt und steht bewusst so: Er sagt, was verschwindet (der
        Zugang) UND was bleibt (die Aufträge). Ohne den zweiten Teil würde niemand ein
        Konto löschen, aus Sorge, die Vorgänge mitzunehmen.
      */}
      <Modal
        open={loeschKandidat !== null}
        title="Berater endgültig löschen?"
        onClose={() => setLoeschKandidat(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setLoeschKandidat(null)}>
              Abbrechen
            </Button>
            <button
              type="button"
              className={styles.emptyBtn}
              onClick={() => {
                if (loeschKandidat) endgueltigLoeschen(loeschKandidat.personalnr)
                setLoeschKandidat(null)
              }}
            >
              Endgültig löschen
            </button>
          </>
        }
      >
        <p className={styles.modalText}>
          Möchten Sie diesen Berater wirklich endgültig löschen?
        </p>
        <p className={styles.modalText}>
          Bitte beachten Sie: Der Berater-Zugang wird unwiderruflich entfernt. Alle vom Berater
          angelegten Aufträge bleiben aus rechtlichen Gründen im Systemarchiv erhalten.
        </p>
        {loeschKandidat ? (
          <p className={styles.modalZiel}>
            {loeschKandidat.name} · {loeschKandidat.personalnr}
          </p>
        ) : null}
      </Modal>
    </AppShell>
  )
}
