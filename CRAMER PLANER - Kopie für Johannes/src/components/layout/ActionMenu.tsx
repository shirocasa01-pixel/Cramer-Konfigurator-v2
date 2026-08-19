import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { StammdatenAdminModal } from '../admin/StammdatenAdminModal'
import { support } from '../../config/support'
import { useDraft } from '../../context/DraftContext'
import styles from './ActionMenu.module.css'

/**
 * Persistentes Aktions-Menü (Charter: „Drei-Balken-Menü“):
 * Entwurf speichern · Entwurf zurücksetzen · Stammdaten & Artikelverwaltung · Hilfe & Notfall.
 */
export function ActionMenu() {
  const { draft, saveDraft, startNewDraft } = useDraft()
  const [open, setOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [stammdatenOpen, setStammdatenOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  function handleSave() {
    setOpen(false)
    if (!draft) return
    saveDraft()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2400)
  }

  function handleReset() {
    setOpen(false)
    if (!draft) return
    const ok = window.confirm(
      'Aktuellen Entwurf zurücksetzen? Nicht gespeicherte Eingaben gehen verloren.',
    )
    if (ok) startNewDraft(draft.consultant)
  }

  return (
    <div className={styles.root} ref={rootRef}>
      {saved ? <span className={styles.savedNote}>Gespeichert ✓</span> : null}

      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Aktionen"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.bars} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>

      {open ? (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" className={styles.item} onClick={handleSave}>
            Entwurf speichern
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={handleReset}>
            Entwurf zurücksetzen
          </button>
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
