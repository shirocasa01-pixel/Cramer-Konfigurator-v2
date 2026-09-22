import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { StammdatenAdminModal } from '../admin/StammdatenAdminModal'
import { MitteilungenModal, useUngelesene } from './Mitteilungen'
import { support } from '../../config/support'
import { useAuth } from '../../context/AuthContext'
import { useDraft } from '../../context/DraftContext'
import styles from './ActionMenu.module.css'

/**
 * Persistentes Aktions-Menü (Charter: „Drei-Balken-Menü“):
 * Entwurf zurücksetzen · Papierkorb · Mitteilungen · Stammdaten · Hilfe & Notfall.
 *
 * „Entwurf speichern" ist aus dem Menü VERSCHWUNDEN, nicht vergessen: Die Schaltfläche
 * steht jetzt sichtbar im Kopf. Zwei Einträge mit derselben Beschriftung und leicht
 * unterschiedlichem Verhalten (speichern ⇄ speichern und schließen) waren die häufigste
 * Rückfrage an diesem Menü.
 */
export function ActionMenu() {
  const { draft, setzeKonfigurationZurueck, trashedDrafts, cloudSaving } = useDraft()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [stammdatenOpen, setStammdatenOpen] = useState(false)
  const [mitteilungenOpen, setMitteilungenOpen] = useState(false)
  const [zuruecksetzenOpen, setZuruecksetzenOpen] = useState(false)
  const ungelesen = useUngelesene()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  return (
    <div className={styles.root} ref={rootRef}>
      {/* Beiläufige Rückmeldung des Auto-Speicherns — keine Handlung, nur ein Lebenszeichen. */}
      {cloudSaving ? <span className={styles.savedNote}>Speichert …</span> : null}

      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ungelesen > 0 ? `Aktionen — ${ungelesen} neue Mitteilungen` : 'Aktionen'}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.bars} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        {/* Der Punkt am Menü selbst — sonst müsste man es öffnen, um zu sehen, ob etwas anliegt. */}
        {ungelesen > 0 ? <span className={styles.punkt} aria-hidden="true" /> : null}
      </button>

      {open ? (
        <div className={styles.menu} role="menu">
          {draft ? (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => {
                setOpen(false)
                setZuruecksetzenOpen(true)
              }}
            >
              Entwurf zurücksetzen
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              setOpen(false)
              navigate('/papierkorb')
            }}
          >
            Papierkorb
            {trashedDrafts.length > 0 ? <span className={styles.zaehler}>{trashedDrafts.length}</span> : null}
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              setOpen(false)
              setMitteilungenOpen(true)
            }}
          >
            Mitteilungen 🔔
            {ungelesen > 0 ? <span className={styles.zaehlerNeu}>{ungelesen}</span> : null}
          </button>
          {/*
            Die Stammdatenverwaltung ändert Artikel, Preise und Zugänge — sie gehört
            hinter die Administrator-Rolle, nicht in jedes Berater-Menü.
          */}
          {isAdmin ? (
            <>
              <div className={styles.divider} />
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={() => {
                  setOpen(false)
                  setStammdatenOpen(true)
                }}
              >
                Stammdaten &amp; Artikelverwaltung
              </button>
            </>
          ) : null}
          <div className={styles.divider} />
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              setOpen(false)
              setHelpOpen(true)
            }}
          >
            Hilfe &amp; Notfall
          </button>
        </div>
      ) : null}

      <StammdatenAdminModal open={stammdatenOpen} onClose={() => setStammdatenOpen(false)} />
      <MitteilungenModal offen={mitteilungenOpen} onSchliessen={() => setMitteilungenOpen(false)} />

      {/*
        ZURÜCKSETZEN — mit Rückfrage, und der Auftragskopf überlebt.

        Vorher hing hier ein `window.confirm`, das „Nicht gespeicherte Eingaben gehen
        verloren" drohte und anschließend ALLES verwarf, inklusive Kundenname und
        Auftragsnummer. Wer nur die Konfiguration neu beginnen wollte, tippte den Kopf
        danach ein zweites Mal.
      */}
      <Modal
        open={zuruecksetzenOpen}
        title="Entwurf zurücksetzen?"
        onClose={() => setZuruecksetzenOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setZuruecksetzenOpen(false)}>
              Nein, abbrechen
            </Button>
            <Button
              onClick={() => {
                setZuruecksetzenOpen(false)
                setzeKonfigurationZurueck()
              }}
            >
              Ja, zurücksetzen
            </Button>
          </>
        }
      >
        <p className={styles.modalText}>
          Die Konfiguration wird verworfen und beginnt wieder bei Schritt 2 — Produktgruppe
          und Serie.
        </p>
        <p className={styles.modalText}>
          <strong>Der Auftragskopf bleibt erhalten:</strong> Kunde, Auftragsnummer, Filiale und
          die übrigen Angaben aus Schritt 1 müssen nicht erneut eingetragen werden.
        </p>
      </Modal>

      <Modal open={helpOpen} title={support.title} onClose={() => setHelpOpen(false)}>
        <p className={styles.helpIntro}>{support.intro}</p>
        <ul className={styles.contacts}>
          {support.contacts.map((c) => (
            <li key={c.label} className={styles.contact}>
              <span className={styles.contactLabel}>{c.label}</span>
              <span className={styles.contactValue}>{c.value}</span>
            </li>
          ))}
        </ul>
        <p className={styles.helpHint}>{support.hint}</p>
      </Modal>
    </div>
  )
}
