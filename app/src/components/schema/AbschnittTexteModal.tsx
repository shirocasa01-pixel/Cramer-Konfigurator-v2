import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import { TextField } from '../ui/TextField'
import { aktualisiereAbschnitt, getEntwurfSchema } from '../../lib/schemaStore'
import styles from './Editierbar.module.css'

/**
 * Überschrift und Einleitung eines Schritts ändern.
 *
 * Beide stehen auf jeder Konfigurator-Seite ganz oben; sie zu ändern ist der häufigste
 * Wunsch und bekommt deshalb den kürzesten Weg — Stift an der Überschrift, dieser Dialog,
 * fertig.
 */
export function AbschnittTexteModal({
  abschnittId,
  offen,
  onSchliessen,
}: {
  abschnittId: string
  offen: boolean
  onSchliessen: () => void
}) {
  const abschnitt = getEntwurfSchema().abschnitte.find((a) => a.id === abschnittId)
  const [titel, setTitel] = useState('')
  const [beschreibung, setBeschreibung] = useState('')

  useEffect(() => {
    if (!offen) return
    setTitel(abschnitt?.titel ?? '')
    setBeschreibung(abschnitt?.beschreibung ?? '')
  }, [offen, abschnitt?.titel, abschnitt?.beschreibung])

  if (!offen || !abschnitt) return null

  return (
    <Modal
      open
      title="Überschrift und Einleitung"
      onClose={onSchliessen}
      footer={
        <>
          <Button variant="ghost" onClick={onSchliessen}>
            Abbrechen
          </Button>
          <Button
            onClick={() => {
              aktualisiereAbschnitt(abschnittId, { titel, beschreibung })
              onSchliessen()
            }}
          >
            Übernehmen
          </Button>
        </>
      }
    >
      <div className={styles.maske}>
        <TextField label="Überschrift" value={titel} onChange={(e) => setTitel(e.target.value)} />
        <Textarea
          label="Einleitung"
          hint="Der erklärende Absatz unter der Überschrift. Leer lassen, wenn keiner erscheinen soll."
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
        />
      </div>
    </Modal>
  )
}
