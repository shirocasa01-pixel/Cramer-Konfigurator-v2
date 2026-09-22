import { useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { TextField } from '../ui/TextField'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import {
  getEntwurfSchema,
  hatOffenenEntwurf,
  subscribeSchema,
  veroeffentliche as veroeffentlicheSchema,
  verwerfeEntwurf,
} from '../../lib/schemaStore'
import { setzeEditorModus, useBearbeitungsModus } from '../../lib/editorModus'
import { naechsteVersion, veroeffentliche as veroeffentlicheVersion } from '../../lib/version'
import { useVersionen } from './Mitteilungen'
import styles from './EditorLeiste.module.css'

/**
 * Die Leiste, die den Bearbeitungsmodus sichtbar hält.
 *
 * Sie beantwortet die drei Fragen, die beim Umbauen zählen: Sehe ich gerade einen Entwurf
 * oder den veröffentlichten Stand, wie mache ich ihn gültig, und wie komme ich hier raus.
 *
 * ZWEI STUFEN, und der Unterschied ist der Kern dieser Oberfläche:
 *
 *   SPEICHERN        passiert bei jedem Stift-Klick von selbst. Es landet im Entwurf des
 *                    Administrators — seine eigene Vorschau, für Berater unsichtbar.
 *   VERÖFFENTLICHEN  macht den Entwurf gültig und vergibt eine Versionsnummer. Erst
 *                    hier sehen die Berater die Änderung, und sie bekommen eine
 *                    Mitteilung darüber.
 */
export function EditorLeiste() {
  const bearbeitung = useBearbeitungsModus()
  const schema = useSyncExternalStore(subscribeSchema, getEntwurfSchema, getEntwurfSchema)
  const offen = useSyncExternalStore(subscribeSchema, hatOffenenEntwurf, hatOffenenEntwurf)
  const versionen = useVersionen()
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [dialogOffen, setDialogOffen] = useState(false)
  const [notiz, setNotiz] = useState('')
  const [major, setMajor] = useState(false)

  if (!bearbeitung) return null

  const aktuelle = versionen[0]?.version ?? '1.00'
  const naechste = naechsteVersion(major)

  function veroeffentlichen() {
    veroeffentlicheSchema()
    const stand = veroeffentlicheVersion({ von: user?.name, notiz, major })
    setDialogOffen(false)
    setNotiz('')
    setMajor(false)
    showToast(`Veröffentlicht als v${stand.version} — ab jetzt für alle Berater sichtbar.`)
  }

  return (
    <div className={styles.leiste} role="region" aria-label="Bearbeitungsmodus">
      <span className={styles.marke}>Bearbeitungsmodus</span>
      <span className={offen ? styles.statusEntwurf : styles.statusLive}>
        {offen
          ? 'Entwurf — gespeichert, für Berater noch nicht sichtbar'
          : `Veröffentlicht · v${aktuelle} · Fassung ${schema.version}`}
      </span>
      <span className={styles.hinweis}>
        Stift ✏️ ändert Texte · Plus fügt Bausteine hinzu · ℹ zeigt die Herkunft eines Feldes
      </span>
      <span className={styles.ebenen}>
        <b>1</b> Oberfläche → <b>2</b> Module → <b>3</b> Dropdowns (DDD) → <b>4</b> Artikel &amp;
        Stammdaten
      </span>
      <div className={styles.aktionen}>
        {offen ? (
          <>
            <Button variant="ghost" onClick={verwerfeEntwurf}>
              Entwurf verwerfen
            </Button>
            <Button onClick={() => setDialogOffen(true)}>Veröffentlichen</Button>
          </>
        ) : null}
        <Button
          variant="ghost"
          onClick={() => {
            setzeEditorModus(false)
            navigate('/admin')
          }}
        >
          Bearbeitung beenden
        </Button>
      </div>

      {/*
        Die Versionsnummer steht VOR dem Klick im Dialog, nicht erst danach in einer
        Erfolgsmeldung: Wer veröffentlicht, soll wissen, unter welcher Nummer die Änderung
        in der Mitteilung der Berater erscheint.
      */}
      <Modal
        open={dialogOffen}
        title="Für alle Berater veröffentlichen?"
        onClose={() => setDialogOffen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOffen(false)}>
              Abbrechen
            </Button>
            <Button onClick={veroeffentlichen}>Als v{naechste} veröffentlichen</Button>
          </>
        }
      >
        <div className={styles.dialog}>
          <p className={styles.dialogText}>
            Der gespeicherte Entwurf wird gültig und ersetzt die Fassung <b>v{aktuelle}</b>.
            Alle angemeldeten Berater bekommen eine Mitteilung über die neue Version.
          </p>
          <TextField
            label="Was hat sich geändert?"
            hint="Erscheint in den Mitteilungen der Berater. Leer lassen, wenn die Nummer genügt."
            placeholder="z. B. Preise Refugium aktualisiert, Hinweistext in Schritt 3 ergänzt"
            value={notiz}
            onChange={(event) => setNotiz(event.target.value)}
          />
          {/*
            Der Sprung auf eine neue Hauptversion ist eine bewusste Ansage („hier hat sich
            der Baukasten geändert"), keine Nebenwirkung der Zählung — deshalb ein Haken
            und kein Automatismus.
          */}
          <label className={styles.schalter}>
            <input type="checkbox" checked={major} onChange={(e) => setMajor(e.target.checked)} />
            <span>
              Große Änderung (Baukasten-Umbau) — veröffentlicht als Hauptversion{' '}
              <b>v{naechsteVersion(true)}</b> statt als laufendes Update
            </span>
          </label>
        </div>
      </Modal>
    </div>
  )
}
