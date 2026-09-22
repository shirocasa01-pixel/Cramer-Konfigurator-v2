import { useState } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { useDraft } from '../../context/DraftContext'
import { useToast } from '../../context/ToastContext'
import { deleteProject, getAllProjects, isSupabaseConfigured } from '../../lib/supabaseProjects'
import { leerePapierkorb } from '../../lib/benutzerPapierkorb'
import { setzeVersionenZurueck, STARTVERSION } from '../../lib/version'
import { setzeAufAuslieferungZurueck } from '../../lib/schemaStore'
import styles from './BenutzerVerwaltung.module.css'

/** Was die Bereinigung anfasst — und was ausdrücklich nicht. */
interface Bilanz {
  entwuerfe: number
  fehler: string[]
}

/**
 * VORFÜHR-BEREINIGUNG.
 *
 * Nach Wochen Testbetrieb liegen in Supabase Dutzende Entwürfe mit Namen wie „aaa",
 * „Test 3" und „Pruefkunde". Vor dem Termin bei Cramer sollen sie weg, und zwar alle auf
 * einmal — von Hand wären das Dutzende Klicks im Papierkorb.
 *
 * WAS DIE BEREINIGUNG ANFASST:
 *   · alle Entwürfe und Aufträge in Supabase
 *   · den Papierkorb der Benutzerkonten
 *   · die Versionshistorie (zurück auf v1.00)
 *   · den Konfigurator auf den Auslieferungsstand
 *
 * WAS SIE NICHT ANFASST, und das ist Absicht:
 *   · Benutzerkonten und Zugänge — wer sich morgen anmelden können soll, soll es können
 *   · die Stammdaten (Artikel, Preise, Oberflächen) — daran hängt die Vorführung selbst
 *
 * Die Aufzählung steht im Bestätigungsdialog, nicht nur hier: Wer diesen Knopf drückt,
 * soll vorher lesen, was gleich passiert — es ist nicht rückgängig zu machen.
 */
export function TestdatenBereinigung() {
  const { refreshDrafts } = useDraft()
  const { showToast } = useToast()
  const [offen, setOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [bilanz, setBilanz] = useState<Bilanz | null>(null)

  async function bereinigen() {
    setLaeuft(true)
    const fehler: string[] = []
    let entwuerfe = 0

    try {
      if (!isSupabaseConfigured) {
        showToast('Supabase ist nicht konfiguriert — es gibt nichts zu bereinigen.', 'error')
        return
      }

      // Erst lesen, dann löschen: Die Liste im Dashboard kann gefiltert sein, hier muss
      // wirklich alles erfasst werden, was in der Tabelle steht.
      const alle = await getAllProjects()
      for (const entwurf of alle) {
        try {
          await deleteProject(entwurf.id)
          entwuerfe++
        } catch (error) {
          fehler.push(`${entwurf.id}: ${(error as Error).message}`)
        }
      }

      leerePapierkorb()
      setzeVersionenZurueck()
      setzeAufAuslieferungZurueck()
      await refreshDrafts()

      setBilanz({ entwuerfe, fehler })
      showToast(
        `Bereinigt — ${entwuerfe} Entwurf/Entwürfe entfernt, Konfigurator auf v${STARTVERSION} zurückgesetzt.`,
      )
    } catch (error) {
      showToast(`Bereinigung fehlgeschlagen: ${(error as Error).message}`, 'error')
    } finally {
      setLaeuft(false)
      setOffen(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.erklaerung}>
        Entfernt <b>alle</b> Entwürfe und Aufträge aus Supabase, leert den Konten-Papierkorb und
        setzt den Konfigurator auf den Auslieferungsstand und Version <b>v{STARTVERSION}</b>{' '}
        zurück. Benutzerkonten, Zugänge und Stammdaten bleiben unangetastet.
      </p>

      <Button variant="ghost" onClick={() => setOffen(true)}>
        Test-Entwürfe zurücksetzen
      </Button>

      {bilanz ? (
        <p className={styles.erklaerung}>
          Zuletzt bereinigt: <b>{bilanz.entwuerfe}</b> Entwurf/Entwürfe entfernt.
          {bilanz.fehler.length > 0 ? ` ${bilanz.fehler.length} Fehler — siehe Meldungen.` : ''}
        </p>
      ) : null}

      <Modal
        open={offen}
        title="Wirklich alle Test-Daten zurücksetzen?"
        onClose={() => setOffen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOffen(false)} disabled={laeuft}>
              Abbrechen
            </Button>
            <Button onClick={() => void bereinigen()} disabled={laeuft}>
              {laeuft ? 'Bereinigt …' : 'Ja, jungfräulich starten'}
            </Button>
          </>
        }
      >
        <p className={styles.modalText}>
          <b>Das wird entfernt — unwiderruflich:</b>
        </p>
        <ul className={styles.modalListe}>
          <li>sämtliche Entwürfe und abgeschlossenen Aufträge in Supabase</li>
          <li>der Papierkorb der Benutzerkonten</li>
          <li>die Versionshistorie — zurück auf v{STARTVERSION}</li>
          <li>alle Änderungen am Konfigurator — zurück auf den Auslieferungsstand</li>
        </ul>
        <p className={styles.modalText}>
          <b>Das bleibt:</b> Benutzerkonten mit ihren Zugängen sowie die Stammdaten mit Artikeln,
          Preisen und Oberflächen.
        </p>
      </Modal>
    </div>
  )
}
