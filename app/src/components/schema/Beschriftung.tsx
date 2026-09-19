import { useEffect, useState, useSyncExternalStore, type ElementType, type ReactNode } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Textarea } from '../ui/Textarea'
import { TextField } from '../ui/TextField'
import {
  abschnittTexteMap,
  aktualisiereTexte,
  getEntwurfSchema,
  getSchema,
  subscribeSchema,
} from '../../lib/schemaStore'
import { useBearbeitungsModus } from '../../lib/editorModus'
import styles from './Editierbar.module.css'

/**
 * BESCHRIFTUNGEN DER FEST PROGRAMMIERTEN MODULE (Ebene 2).
 *
 * Die Schemafelder aus dem Bausteinkatalog bringen ihre Beschriftung selbst mit. Der
 * größere Teil der Oberfläche besteht aber aus Modulen, deren Ablauf im Code steht —
 * Rasterstufen, Bereichsüberschriften, Ergebnissätze. Auch die muss der Administrator
 * benennen können, ohne dass jemand die Rechenlogik anfasst.
 *
 * Das ist die Trennlinie, die dieses Modul zieht: TEXT ist Daten und liegt im Schema,
 * ABLAUF ist Code und bleibt, wo er ist.
 */

/**
 * Liest die Texte eines Schritts — im Bearbeitungsmodus den Entwurf, sonst den
 * veröffentlichten Stand. Der Administrator sieht damit sofort seine eigene Änderung,
 * der Berater erst nach dem Veröffentlichen.
 */
export function useTexte(abschnittId: string): (schluessel: string, standard: string) => string {
  const roh = useSyncExternalStore(subscribeSchema, getEntwurfSchema, getEntwurfSchema)
  const bearbeitung = useBearbeitungsModus()
  const texte = abschnittTexteMap(abschnittId, bearbeitung ? roh : getSchema())
  return (schluessel, standard) => texte[schluessel]?.trim() || standard
}

/**
 * Setzt Platzhalter in einen Text ein: `Ihr Möbel ist {breite} breit` → der echte Wert.
 *
 * Damit bleiben auch ERGEBNISSÄTZE editierbar, ohne dass der Administrator Zahlen
 * abtippen müsste. Ein Platzhalter, den er löscht, fehlt anschließend schlicht — das ist
 * gewollt: Wer die Breite nicht nennen will, nennt sie nicht.
 */
export function fuelle(vorlage: string, werte: Record<string, string>): string {
  return vorlage.replace(/\{(\w+)\}/g, (treffer, name: string) => werte[name] ?? treffer)
}

/**
 * Ein beschrifteter Text mit Stift.
 *
 * Außerhalb des Bearbeitungsmodus rendert die Komponente genau das Element, das ohne sie
 * dort stünde — gleiche Klasse, gleicher Inhalt, kein zusätzliches Markup. Der Berater
 * sieht dadurch dieselbe Seite wie vorher.
 */
export function Beschriftung({
  abschnittId,
  schluessel,
  standard,
  as: Element = 'span',
  className,
  mehrzeilig,
  /** Ersetzt den Text vollständig (z. B. wenn ein Platzhalter eingesetzt wurde). */
  anzeige,
  /** Erklärt im Bearbeitungsdialog, welche Platzhalter erlaubt sind. */
  platzhalterHinweis,
}: {
  abschnittId: string
  schluessel: string
  standard: string
  as?: ElementType
  className?: string
  mehrzeilig?: boolean
  anzeige?: ReactNode
  platzhalterHinweis?: string
}) {
  const t = useTexte(abschnittId)
  const bearbeitung = useBearbeitungsModus()
  const [offen, setOffen] = useState(false)
  const text = t(schluessel, standard)

  return (
    <Element className={className}>
      {anzeige ?? text}
      {bearbeitung ? (
        <>
          <button
            type="button"
            className={styles.kopfWerkzeug}
            title={`„${text}" bearbeiten`}
            onClick={() => setOffen(true)}
          >
            ✏️
          </button>
          <TexteModal
            abschnittId={abschnittId}
            offen={offen}
            onSchliessen={() => setOffen(false)}
            titel="Beschriftung bearbeiten"
            eintraege={[
              { schluessel, standard, label: 'Text', mehrzeilig, hinweis: platzhalterHinweis },
            ]}
          />
        </>
      ) : null}
    </Element>
  )
}

export interface TextEintrag {
  schluessel: string
  standard: string
  /** Beschriftung des Eingabefeldes im Dialog. */
  label: string
  mehrzeilig?: boolean
  hinweis?: string
}

/**
 * EIN Stift für eine ganze Gruppe von Beschriftungen.
 *
 * Für Optionsreihen — Rasterstufen, Korpusbreiten, Abschlussset-Positionen — wäre ein
 * Stift je Knopf unbrauchbar: Die Reihe zerfiele optisch, und der Administrator müsste
 * fünf Dialoge nacheinander öffnen. Stattdessen hängt ein Stift an der Überschrift der
 * Gruppe und öffnet alle Beschriftungen gemeinsam.
 */
export function BeschriftungsGruppe({
  abschnittId,
  titel,
  eintraege,
}: {
  abschnittId: string
  titel: string
  eintraege: TextEintrag[]
}) {
  const bearbeitung = useBearbeitungsModus()
  const [offen, setOffen] = useState(false)
  if (!bearbeitung) return null

  return (
    <>
      <button
        type="button"
        className={styles.kopfWerkzeug}
        title={`${titel} bearbeiten`}
        onClick={() => setOffen(true)}
      >
        ✏️
      </button>
      <TexteModal
        abschnittId={abschnittId}
        offen={offen}
        onSchliessen={() => setOffen(false)}
        titel={titel}
        eintraege={eintraege}
      />
    </>
  )
}

/**
 * Der gemeinsame Dialog.
 *
 * Ein leeres Feld setzt auf den Standard aus dem Code zurück (siehe `aktualisiereTexte`);
 * der Platzhalter im Eingabefeld zeigt deshalb immer diesen Standard an. Der
 * Administrator sieht damit ohne Erklärung, was passiert, wenn er löscht.
 */
function TexteModal({
  abschnittId,
  offen,
  onSchliessen,
  titel,
  eintraege,
}: {
  abschnittId: string
  offen: boolean
  onSchliessen: () => void
  titel: string
  eintraege: TextEintrag[]
}) {
  const roh = useSyncExternalStore(subscribeSchema, getEntwurfSchema, getEntwurfSchema)
  const [werte, setWerte] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!offen) return
    const texte = abschnittTexteMap(abschnittId, roh)
    setWerte(Object.fromEntries(eintraege.map((e) => [e.schluessel, texte[e.schluessel] ?? ''])))
    // Absichtlich nur beim Öffnen: Während der Eingabe darf der Store die Felder nicht
    // überschreiben — sonst springt der Cursor bei jedem Tastendruck.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen, abschnittId])

  if (!offen) return null

  return (
    <Modal
      open
      title={titel}
      onClose={onSchliessen}
      footer={
        <>
          <Button variant="ghost" onClick={onSchliessen}>
            Abbrechen
          </Button>
          <Button
            onClick={() => {
              aktualisiereTexte(abschnittId, werte)
              onSchliessen()
            }}
          >
            Übernehmen
          </Button>
        </>
      }
    >
      <div className={styles.maske}>
        <p className={styles.gruppeHinweis}>
          Leeres Feld = der im Programm hinterlegte Text (steht als Beispiel im Feld).
        </p>
        {eintraege.map((e) =>
          e.mehrzeilig ? (
            <Textarea
              key={e.schluessel}
              label={e.label}
              hint={e.hinweis}
              placeholder={e.standard}
              value={werte[e.schluessel] ?? ''}
              onChange={(event) =>
                setWerte((v) => ({ ...v, [e.schluessel]: event.target.value }))
              }
            />
          ) : (
            <TextField
              key={e.schluessel}
              label={e.label}
              hint={e.hinweis}
              placeholder={e.standard}
              value={werte[e.schluessel] ?? ''}
              onChange={(event) =>
                setWerte((v) => ({ ...v, [e.schluessel]: event.target.value }))
              }
            />
          ),
        )}
      </div>
    </Modal>
  )
}
