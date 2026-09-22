import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  aendereBenutzer,
  inPapierkorbLegen,
  legeBenutzerAn,
  listeBenutzer,
  naechstePersonalnummer,
  beschreibeAnmeldung,
  raeumeUeberfaelligeBenutzer,
  setzeRolle,
  type Benutzer,
} from '../../lib/benutzerVerwaltung'
import { subscribeBenutzerPapierkorb } from '../../lib/benutzerPapierkorb'
import { getFilialenListe, subscribe as subscribeStammdaten } from '../../lib/stammdatenStore'
import { PASSWORT_MINDESTLAENGE, pruefePasswortRegeln } from '../../lib/passwort'
import { entferneZugang, setzeZugang, subscribeZugaenge } from '../../lib/zugangStore'
import styles from './BenutzerVerwaltung.module.css'

/** Leerer Bearbeitungsstand — auch für „neu anlegen". */
interface Entwurf {
  personalnr: string
  name: string
  email: string
  rolle: string
  filiale: string
  status: string
  bemerkung: string
  /** Neues Passwort; leer lassen heißt „unverändert". */
  passwort: string
  neu: boolean
}

function leererEntwurf(filiale: string): Entwurf {
  return {
    personalnr: naechstePersonalnummer(),
    name: '',
    email: '',
    rolle: 'berater',
    filiale,
    status: 'aktiv',
    bemerkung: '',
    passwort: '',
    neu: true,
  }
}

/**
 * BENUTZERVERWALTUNG — eine Liste für Berater UND Administratoren.
 *
 * Sie arbeitet direkt auf dem Blatt „40 Mitarbeiter" des Stammdaten-Stores. Damit ist die
 * Synchronisation mit der Stammdatenverwaltung keine Aufgabe, die jemand erledigen muss,
 * sondern eine Eigenschaft: Beide Oberflächen ändern denselben Datensatz, und wer hier
 * etwas ändert, sieht es dort sofort — und umgekehrt.
 *
 * DER GROSSE „ENTFERNEN"-KNOPF IST WEG. Er stand früher rechts an jeder Zeile, direkt
 * neben harmlosen Angaben, und löschte auf einen Klick. An seiner Stelle steht ein
 * Drei-Punkte-Menü: Wer löschen will, muss es aufklappen und auswählen — und selbst dann
 * wandert das Konto nur in den Papierkorb.
 */
export function BenutzerVerwaltung() {
  const { admins } = useAuth()
  const { showToast } = useToast()

  // Die Liste hängt an drei Speichern: Stammsatz, Zugang, Papierkorb.
  useSyncExternalStore(subscribeStammdaten, () => undefined, () => undefined)
  useSyncExternalStore(subscribeZugaenge, () => undefined, () => undefined)
  useSyncExternalStore(subscribeBenutzerPapierkorb, () => undefined, () => undefined)

  const [menuOffen, setMenuOffen] = useState<string | null>(null)
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [loeschKandidat, setLoeschKandidat] = useState<Benutzer | null>(null)
  const listeRef = useRef<HTMLUListElement>(null)

  // Abgelaufene Konten räumen, sobald die Verwaltung geöffnet wird.
  useEffect(() => {
    const geraeumt = raeumeUeberfaelligeBenutzer()
    if (geraeumt > 0) {
      showToast(`${geraeumt} Konto/Konten nach Ablauf der 30 Tage endgültig entfernt.`)
    }
  }, [showToast])

  useEffect(() => {
    if (!menuOffen) return
    function onDocMouseDown(event: MouseEvent) {
      if (listeRef.current && !listeRef.current.contains(event.target as Node)) setMenuOffen(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [menuOffen])

  const benutzer = listeBenutzer()
  const filialen = getFilialenListe()
  /** Alt-Bestand des früheren Admin-Dashboards — zählt bei der Eindeutigkeit mit. */
  const weitereKonten = admins.map((a) => ({ id: a.id, username: a.username, email: a.email }))

  function oeffneNeu() {
    setFehler(null)
    setEntwurf(leererEntwurf(filialen[0]?.filialnr ?? ''))
  }

  function oeffneBearbeiten(b: Benutzer) {
    setMenuOffen(null)
    setFehler(null)
    setEntwurf({
      personalnr: b.personalnr,
      name: b.name,
      email: b.email,
      rolle: b.rolle,
      filiale: b.filiale,
      status: b.status,
      bemerkung: b.bemerkung,
      passwort: '',
      neu: false,
    })
  }

  async function speichern() {
    if (!entwurf) return
    setFehler(null)

    if (!entwurf.name.trim()) return setFehler('Bitte einen Namen angeben.')
    if (!entwurf.email.trim()) return setFehler('Bitte eine E-Mail-Adresse angeben.')
    if (entwurf.passwort) {
      const regel = pruefePasswortRegeln(entwurf.passwort)
      if (regel) return setFehler(regel)
    }

    const stamm = {
      name: entwurf.name.trim(),
      email: entwurf.email.trim(),
      rolle: entwurf.rolle,
      filiale: entwurf.filiale,
      status: entwurf.status,
      bemerkung: entwurf.bemerkung,
    }

    if (entwurf.neu) {
      const ergebnis = legeBenutzerAn({ ...stamm, personalnr: entwurf.personalnr }, weitereKonten)
      if ('fehler' in ergebnis) return setFehler(ergebnis.fehler)
      if (entwurf.passwort && !(await passwortSetzen(ergebnis.personalnr, entwurf.passwort))) {
        setEntwurf({ ...entwurf, neu: false, personalnr: ergebnis.personalnr })
        return
      }
      showToast(`${stamm.name} angelegt (${ergebnis.personalnr}).`)
    } else {
      const problem = aendereBenutzer(entwurf.personalnr, stamm, weitereKonten)
      if (problem) return setFehler(problem)
      if (entwurf.passwort && !(await passwortSetzen(entwurf.personalnr, entwurf.passwort))) return
      showToast(`${stamm.name} gespeichert.`)
    }
    setEntwurf(null)
  }

  /** Passwort in Supabase setzen; ein Fehler bleibt im Dialog stehen, statt zu verpuffen. */
  async function passwortSetzen(personalnr: string, passwort: string): Promise<boolean> {
    try {
      await setzeZugang(personalnr, passwort)
      return true
    } catch (error) {
      setFehler(`Konto gespeichert, Passwort aber nicht — Supabase meldet: ${(error as Error).message}`)
      return false
    }
  }

  function rolleUmschalten(b: Benutzer) {
    setMenuOffen(null)
    const ziel = b.rolle === 'admin' ? 'berater' : 'admin'
    const problem = setzeRolle(b.personalnr, ziel)
    if (problem) {
      showToast(problem, 'error')
      return
    }
    showToast(
      ziel === 'admin'
        ? `${b.name} hat jetzt Administrator-Rechte.`
        : `${b.name} ist wieder Berater — die Administrator-Rechte sind entzogen.`,
    )
  }

  function inPapierkorb(b: Benutzer) {
    setLoeschKandidat(null)
    const problem = inPapierkorbLegen(b.personalnr)
    if (problem) {
      showToast(problem, 'error')
      return
    }
    showToast(`${b.name} in den Papierkorb verschoben — 30 Tage wiederherstellbar.`)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.kopf}>
        <p className={styles.erklaerung}>
          Dieselben Datensätze wie im Blatt „Berater" der Stammdatenverwaltung — was hier
          geändert wird, steht dort, und umgekehrt. Ein Konto mit dem Status{' '}
          <b>gesperrt</b> kann sich nicht anmelden; wie der Zugang zustande kommt, steht an
          jeder Zeile.
        </p>
        <Button onClick={oeffneNeu}>Benutzer anlegen</Button>
      </div>

      <ul className={styles.liste} ref={listeRef}>
        {benutzer.map((b) => (
          <li key={b.personalnr} className={styles.zeile}>
            <div className={styles.info}>
              <span className={styles.name}>
                {b.name}
                {b.rolle === 'admin' ? <span className={styles.rolleAdmin}>Administrator</span> : null}
                {b.hauptadmin ? <span className={styles.hauptadmin}>Hauptadmin</span> : null}
                {b.status !== 'aktiv' ? <span className={styles.gesperrt}>{b.status}</span> : null}
              </span>
              <span className={styles.meta}>
                {b.personalnr} · {b.email || 'ohne E-Mail'}
                {` · ${beschreibeAnmeldung(b)}`}
              </span>
            </div>

            <div className={styles.menuAnker}>
              <button
                type="button"
                className={styles.punkte}
                aria-haspopup="menu"
                aria-expanded={menuOffen === b.personalnr}
                aria-label={`Aktionen für ${b.name}`}
                onClick={() => setMenuOffen((offen) => (offen === b.personalnr ? null : b.personalnr))}
              >
                ⋮
              </button>

              {menuOffen === b.personalnr ? (
                <div className={styles.menu} role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.menuItem}
                    onClick={() => oeffneBearbeiten(b)}
                  >
                    Bearbeiten
                  </button>
                  {/*
                    Rechte auf Zuruf: Für einen Testlauf bekommt ein Berater kurz
                    Administrator-Rechte und danach wieder nicht. Das Hauptadmin-Konto ist
                    ausgenommen — sonst ließe sich der letzte Zugang zur Verwaltung
                    versehentlich wegklicken.
                  */}
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.menuItem}
                    disabled={b.hauptadmin}
                    title={b.hauptadmin ? 'Das Hauptadmin-Konto behält seine Rechte.' : undefined}
                    onClick={() => rolleUmschalten(b)}
                  >
                    {b.rolle === 'admin' ? 'Admin-Rechte entziehen' : 'Admin-Rechte vergeben'}
                  </button>
                  <div className={styles.trenner} />
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.menuItemWeg}
                    disabled={b.hauptadmin}
                    title={b.hauptadmin ? 'Das Hauptadmin-Konto lässt sich nicht löschen.' : undefined}
                    onClick={() => {
                      setMenuOffen(null)
                      setLoeschKandidat(b)
                    }}
                  >
                    Löschen
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {/* --- Anlegen / Bearbeiten --------------------------------------------- */}
      <Modal
        open={entwurf !== null}
        title={entwurf?.neu ? 'Benutzer anlegen' : `${entwurf?.name || 'Benutzer'} bearbeiten`}
        onClose={() => setEntwurf(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEntwurf(null)}>
              Abbrechen
            </Button>
            <Button onClick={() => void speichern()}>Übernehmen</Button>
          </>
        }
      >
        {entwurf ? (
          <div className={styles.maske}>
            <TextField
              label="Name"
              value={entwurf.name}
              onChange={(e) => setEntwurf({ ...entwurf, name: e.target.value })}
            />
            <TextField
              label="E-Mail"
              placeholder="vorname.nachname@cramer.de"
              value={entwurf.email}
              onChange={(e) => setEntwurf({ ...entwurf, email: e.target.value })}
            />
            <Select
              label="Rolle"
              options={[
                { value: 'berater', label: 'Berater' },
                { value: 'admin', label: 'Administrator' },
              ]}
              value={entwurf.rolle}
              onChange={(e) => setEntwurf({ ...entwurf, rolle: e.target.value })}
            />
            <Select
              label="Filiale"
              placeholder="Keine Zuordnung"
              options={filialen.map((f) => ({ value: f.filialnr, label: f.name }))}
              value={entwurf.filiale}
              onChange={(e) => setEntwurf({ ...entwurf, filiale: e.target.value })}
            />
            <Select
              label="Status"
              options={[
                { value: 'aktiv', label: 'aktiv — Anmeldung möglich' },
                { value: 'gesperrt', label: 'gesperrt — Anmeldung blockiert' },
              ]}
              value={entwurf.status}
              onChange={(e) => setEntwurf({ ...entwurf, status: e.target.value })}
            />
            {/*
              Ein bestehendes Passwort wird NIE angezeigt, auch dem Administrator nicht —
              es liegt nur als Hash vor. Es lässt sich ersetzen, nicht nachlesen.
            */}
            <TextField
              label={entwurf.neu ? 'Eigenes Passwort (optional)' : 'Neues Passwort (leer = unverändert)'}
              type="password"
              hint={`Mindestens ${PASSWORT_MINDESTLAENGE} Zeichen. Leer gelassen gilt das Standard-Passwort.`}
              value={entwurf.passwort}
              onChange={(e) => setEntwurf({ ...entwurf, passwort: e.target.value })}
            />
            <TextField
              label="Bemerkung"
              value={entwurf.bemerkung}
              onChange={(e) => setEntwurf({ ...entwurf, bemerkung: e.target.value })}
            />
            {!entwurf.neu ? (
              <button
                type="button"
                className={styles.zugangWeg}
                onClick={() => {
                  entferneZugang(entwurf.personalnr)
                  showToast('Eigenes Passwort gelöscht — es gilt wieder das Standard-Passwort.')
                }}
              >
                Eigenes Passwort löschen (zurück auf Standard-Passwort)
              </button>
            ) : null}
            {fehler ? (
              <p className={styles.fehler} role="alert">
                {fehler}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* --- Stufe 1 des Löschens -------------------------------------------- */}
      <Modal
        open={loeschKandidat !== null}
        title="In den Papierkorb verschieben?"
        onClose={() => setLoeschKandidat(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setLoeschKandidat(null)}>
              Abbrechen
            </Button>
            <Button onClick={() => loeschKandidat && inPapierkorb(loeschKandidat)}>
              In den Papierkorb
            </Button>
          </>
        }
      >
        <p className={styles.modalText}>
          <b>{loeschKandidat?.name}</b> kann sich ab sofort nicht mehr anmelden. Das Konto bleibt
          30 Tage im Papierkorb und lässt sich dort jederzeit zurückholen.
        </p>
        <p className={styles.modalText}>
          Endgültig gelöscht wird es erst dort — nach einer weiteren Rückfrage — oder
          automatisch nach Ablauf der 30 Tage.
        </p>
      </Modal>
    </div>
  )
}
