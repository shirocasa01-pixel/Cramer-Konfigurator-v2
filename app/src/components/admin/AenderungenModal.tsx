import { useEffect, useMemo } from 'react'
import type { Aenderung, AenderungsBereich } from '../../lib/stammdatenStore.ts'
// Die Fensterhülle kommt aus dem Bearbeiten-Fenster einer Tabellenzeile — dieselben
// Klassen, damit sich beide Fenster identisch anfühlen und nicht zwei Dialog-Designs
// nebeneinander existieren.
import shell from './ArtikelDetailModal.module.css'
import styles from './AenderungenModal.module.css'

const ART_TITEL: Record<Aenderung['art'], string> = {
  neu: 'neu',
  geaendert: 'geändert',
  geloescht: 'gelöscht',
}

const ART_ERKLAERUNG: Record<Aenderung['art'], string> = {
  neu: 'Neuer Datensatz — im Grundstand nicht enthalten.',
  geaendert: '',
  geloescht: 'Datensatz ausgeblendet — im Grundstand weiterhin vorhanden.',
}

export interface AenderungenModalProps {
  offen: boolean
  /** Alle Abweichungen vom Grundstand, über alle Reiter hinweg. */
  aenderungen: Aenderung[]
  /** Klartext-Name je Reiter, für die Gruppen-Überschrift. */
  bereichTitel: Record<AenderungsBereich, string>
  onClose: () => void
  /** Schließt das Fenster, wechselt den Reiter und hebt die Zeile hervor. */
  onSpringeZu: (aenderung: Aenderung) => void
}

/**
 * VORSCHAU-FENSTER „ÄNDERUNGEN".
 *
 * Vorher stand diese Liste aufgeklappt über den Tabellen. Bei 1509 Preiszeilen war das
 * die schlechteste denkbare Stelle: Die Liste schob den Bestand nach unten und ging
 * beim Scrollen selbst verloren. Als eigenes Fenster liegt sie über allem, ist über
 * den Zähler im Kopf jederzeit erreichbar und lässt sich mit Escape wieder schließen.
 *
 * Gruppiert wird nach Reiter, weil das die erste Frage beim Prüfen ist: „Wo habe ich
 * überhaupt etwas angefasst?" Innerhalb einer Gruppe steht je Eintrag, was sich
 * feldweise geändert hat — der Store liefert das bereits als `Preis: 50,00 → 60,00`.
 */
export function AenderungenModal({
  offen,
  aenderungen,
  bereichTitel,
  onClose,
  onSpringeZu,
}: AenderungenModalProps) {
  // Escape schließt — wie im Bearbeiten-Fenster erwartet.
  useEffect(() => {
    if (!offen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [offen, onClose])

  // Reihenfolge der Gruppen folgt der Reiter-Reihenfolge, nicht dem Zufall der
  // Bearbeitung — die Liste soll sich lesen wie die Verwaltung selbst.
  const gruppen = useMemo(() => {
    const reihenfolge = Object.keys(bereichTitel) as AenderungsBereich[]
    return reihenfolge
      .map((bereich) => ({
        bereich,
        eintraege: aenderungen.filter((a) => a.bereich === bereich),
      }))
      .filter((g) => g.eintraege.length > 0)
  }, [aenderungen, bereichTitel])

  if (!offen) return null

  const ausstehend = aenderungen.filter((a) => a.ausstehend).length

  return (
    <div
      className={shell.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Änderungen im Detail"
      onClick={(event) => {
        // Klick auf den Hintergrund schließt; Klicks im Dialog nicht.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={shell.dialog} style={{ width: 'min(820px, 100%)' }}>
        <header className={shell.kopf}>
          <div>
            <h2 className={shell.titel}>
              {aenderungen.length === 1 ? '1 Änderung' : `${aenderungen.length} Änderungen`}
            </h2>
            <p className={shell.untertitel}>
              Abweichungen vom Grundstand <code>Cramer-Stammdaten.xlsx</code>
              {ausstehend > 0 ? ` · ${ausstehend} noch nicht gespeichert` : ' · alle gespeichert'}
            </p>
          </div>
          <button type="button" className={shell.schliessen} onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </header>

        <div className={shell.koerper} style={{ padding: 0 }}>
          {gruppen.length === 0 ? (
            <p className={styles.leer}>Keine Abweichungen vom Grundstand.</p>
          ) : (
            gruppen.map((gruppe) => (
              <section key={gruppe.bereich} className={styles.gruppe}>
                <h3 className={styles.gruppeKopf}>
                  {bereichTitel[gruppe.bereich]}
                  <span className={styles.gruppeAnzahl}>
                    {gruppe.eintraege.length === 1 ? '1 Eintrag' : `${gruppe.eintraege.length} Einträge`}
                  </span>
                </h3>
                <ul className={styles.liste}>
                  {gruppe.eintraege.map((a, index) => (
                    <li key={`${a.bereich}-${a.art}-${a.zeilenId}-${index}`}>
                      <button
                        type="button"
                        className={styles.eintrag}
                        onClick={() => onSpringeZu(a)}
                        title={`Zu diesem Eintrag im Reiter „${bereichTitel[a.bereich]}“ springen`}
                      >
                        <span className={styles.eintragKopf}>
                          <span className={`${styles.art} ${styles[`art_${a.art}`]}`}>
                            {ART_TITEL[a.art]}
                          </span>
                          <span className={styles.titel}>{a.titel}</span>
                          {a.ausstehend ? (
                            <span
                              className={styles.ausstehend}
                              title="Noch nicht über den Speichern-Knopf im Kopf bestätigt"
                            >
                              ausstehend
                            </span>
                          ) : null}
                          <span className={styles.sprung} aria-hidden="true">
                            → zur Zeile
                          </span>
                        </span>

                        {a.felder.length > 0 ? (
                          <ul className={styles.felder}>
                            {a.felder.map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        ) : ART_ERKLAERUNG[a.art] ? (
                          <span className={styles.ohneFelder}>{ART_ERKLAERUNG[a.art]}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        <footer className={shell.fuss}>
          <span className={shell.fussHinweis}>
            Ein Klick auf einen Eintrag wechselt in den Reiter und hebt die Zeile hervor.
          </span>
          <button type="button" className={shell.abbrechen} onClick={onClose}>
            Schließen
          </button>
        </footer>
      </div>
    </div>
  )
}
