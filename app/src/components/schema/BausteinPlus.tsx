import { useState } from 'react'
import { FeldEinstellungen } from '../admin/FeldEinstellungen'
import { Modal } from '../ui/Modal'
import { aktualisiereFeld, ergaenzeFeld } from '../../lib/schemaStore'
import { useEditorModus } from '../../lib/editorModus'
import type { FeldTyp, SchemaFeld } from '../../types/schema'
import styles from './Editierbar.module.css'

/** Der Bausteinkatalog hinter dem Plus. */
const BAUSTEINE: Array<{ typ: FeldTyp; titel: string; zweck: string }> = [
  { typ: 'auswahl', titel: 'Dropdown-Modul', zweck: 'Artikel oder Werte auswählen' },
  { typ: 'text', titel: 'Textfeld', zweck: 'Freie Eingabe, einzeilig' },
  { typ: 'mehrzeilig', titel: 'Mehrzeiliges Textfeld', zweck: 'Adressen, längere Angaben' },
  { typ: 'zahl', titel: 'Zahlenfeld', zweck: 'Mengen und Maße' },
  { typ: 'checkbox', titel: 'Ja/Nein-Auswahl', zweck: 'Häkchen setzen' },
  { typ: 'datum', titel: 'Datum', zweck: 'Datum erfassen' },
  { typ: 'ueberschrift', titel: 'Überschrift', zweck: 'Abschnitt benennen' },
  { typ: 'hinweis', titel: 'Hinweis', zweck: 'Erklärung anzeigen' },
]

/** Aus einer Beschriftung eine stabile, eindeutige Feld-Kennung machen. */
function baueId(label: string, vergeben: Set<string>): string {
  const basis =
    label
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'feld'
  if (!vergeben.has(basis)) return basis
  let n = 2
  while (vergeben.has(`${basis}-${n}`)) n++
  return `${basis}-${n}`
}

/**
 * Das Plus am Ende eines Abschnitts — nur im Bearbeitungsmodus sichtbar.
 *
 * Nach der Auswahl im Katalog öffnet sich direkt die Einstellungsmaske: Ein Feld namens
 * „Textfeld" hilft niemandem, die Beschriftung ist der eigentliche Punkt. Beim ersten
 * Speichern folgt die technische Kennung der Beschriftung („Lieferadresse" statt
 * „mehrzeiliges-textfeld").
 */
export function BausteinPlus({
  abschnittId,
  vorhandeneIds,
}: {
  abschnittId: string
  vorhandeneIds: string[]
}) {
  const bearbeitung = useEditorModus()
  const [katalogOffen, setKatalogOffen] = useState(false)
  const [neu, setNeu] = useState<SchemaFeld | null>(null)

  if (!bearbeitung) return null

  function anlegen(typ: FeldTyp) {
    const vorschlag = BAUSTEINE.find((b) => b.typ === typ)?.titel ?? 'Neues Feld'
    const feld: SchemaFeld = {
      id: baueId(vorschlag, new Set(vorhandeneIds)),
      typ,
      label: vorschlag,
      aktiv: true,
      sortierung: 0,
      zeigeIn: { maske: true, zusammenfassung: true, pdf: false },
    }
    setKatalogOffen(false)
    const angelegt = ergaenzeFeld(abschnittId, feld)
    if (angelegt) setNeu(angelegt)
  }

  return (
    <>
      <button type="button" className={styles.plus} onClick={() => setKatalogOffen(true)}>
        + Baustein hinzufügen
      </button>

      <Modal open={katalogOffen} title="Baustein hinzufügen" onClose={() => setKatalogOffen(false)}>
        <div className={styles.katalog}>
          {BAUSTEINE.map((b) => (
            <button key={b.typ} type="button" className={styles.katalogKachel} onClick={() => anlegen(b.typ)}>
              <span className={styles.katalogTitel}>{b.titel}</span>
              <span className={styles.katalogZweck}>{b.zweck}</span>
            </button>
          ))}
        </div>
      </Modal>

      <FeldEinstellungen
        offen={neu != null}
        feld={neu}
        onAbbrechen={() => setNeu(null)}
        onSpeichern={(feld) => {
          if (!neu) return
          const vergeben = new Set(vorhandeneIds.filter((id) => id !== neu.id))
          aktualisiereFeld(abschnittId, { ...feld, id: baueId(feld.label, vergeben) }, neu.id)
          setNeu(null)
        }}
      />
    </>
  )
}
