import { useEffect, useState, type ReactNode } from 'react'
import styles from './ArtikelDetailModal.module.css'
import { OHNE_AUTOFILL } from './ZellenFeld.tsx'

/**
 * DATENSATZ-EDITOR — feldgesteuertes Fenster für Berater und Filialen.
 *
 * Dieselbe Bedienung wie beim Artikel: Entwurf im Formular-State, „Speichern" schreibt,
 * „Abbrechen" verwirft restlos. Statt einer eigenen Komponente je Bereich beschreibt
 * ein Feld-Array die Maske — Berater und Filialen unterscheiden sich nur in ihren Feldern,
 * nicht im Verhalten.
 */

export interface FeldDef<T> {
  /** Schlüssel im Datensatz. */
  feld: keyof T & string
  label: string
  hinweis?: string
  /** Auswahlliste statt Freitext. */
  optionen?: { wert: string; titel: string }[]
  /** Nur beim Anlegen beschreibbar (Identität). */
  schluessel?: boolean
  mono?: boolean
  breit?: boolean
}

export interface DatensatzModalProps<T extends object> {
  titel: string
  /** `null` ⇒ Anlegemodus. */
  datensatz: T | null
  leerwert: () => T
  felder: FeldDef<T>[]
  /** Untertitel unter der Überschrift, z. B. die Nummer. */
  untertitel?: (entwurf: T) => string
  /**
   * Zusätzlicher Abschnitt unter der Feldmaske — für alles, was nicht ein Feld des
   * Datensatzes ist. Der Berater-Zugang etwa gehört nicht in den Stammsatz, wird aber
   * im selben Fenster verwaltet. Bekommt den laufenden Entwurf, damit er auf Änderungen
   * in der Maske darüber reagieren kann (Status auf „gesperrt" ⇒ Zugang wirkungslos).
   */
  zusatz?: (entwurf: T) => ReactNode
  /**
   * Darf asynchron sein: das Vergeben eines Passworts hasht über die Web-Crypto-API,
   * und die liefert ein Promise.
   */
  onSpeichern: (entwurf: T, anlegen: boolean) => string | null | Promise<string | null>
  onClose: () => void
}

export function DatensatzModal<T extends object>({
  titel,
  datensatz,
  leerwert,
  felder,
  untertitel,
  zusatz,
  onSpeichern,
  onClose,
}: DatensatzModalProps<T>) {
  const anlegen = datensatz === null
  const [entwurf, setEntwurf] = useState<T>(() => ({ ...(datensatz ?? leerwert()) }))
  const [fehler, setFehler] = useState<string | null>(null)
  const [speichert, setSpeichert] = useState(false)
  function aendere(feld: keyof T & string, wert: string) {
    setEntwurf((v) => ({ ...v, [feld]: wert }))
  }

  useEffect(() => {
    const beiEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', beiEsc)
    return () => document.removeEventListener('keydown', beiEsc)
  }, [onClose])

  async function speichern() {
    if (speichert) return
    setSpeichert(true)
    try {
      const problem = await onSpeichern(entwurf, anlegen)
      if (problem) setFehler(problem)
      else onClose()
    } catch (err) {
      setFehler(`Speichern fehlgeschlagen: ${(err as Error).message}`)
    } finally {
      setSpeichert(false)
    }
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={titel}>
      <div className={styles.dialog} style={{ width: 'min(720px, 100%)' }}>
        <header className={styles.kopf}>
          <div>
            <h2 className={styles.titel}>{anlegen ? `Neu: ${titel}` : titel}</h2>
            {untertitel ? <p className={styles.untertitel}>{untertitel(entwurf)}</p> : null}
          </div>
          <button type="button" className={styles.schliessen} onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </header>

        {fehler ? <div className={styles.fehler}>{fehler}</div> : null}

        <div className={styles.koerper}>
          {/* Auch hier ein horizontaler Schieber: lange Anschriften und Bemerkungen
              sollen nicht das Fenster sprengen. */}
          <div style={{ overflowX: 'auto' }}>
            <div className={styles.felder}>
              {felder.map((f) => (
                <div
                  key={f.feld}
                  className={[styles.feld, f.breit ? styles.feldVoll : ''].filter(Boolean).join(' ')}
                >
                  <span className={styles.feldLabel}>{f.label}</span>
                  {f.optionen ? (
                    <select
                      {...OHNE_AUTOFILL}
                      className={styles.input}
                      value={String((entwurf as Record<string, unknown>)[f.feld] ?? '')}
                      // Schlüsselfelder sind auch als Auswahlliste nur beim Anlegen
                      // beschreibbar — sonst ließe sich eine Identität ändern, die der
                      // Store beim Speichern ohnehin verwirft (stille Wirkungslosigkeit).
                      disabled={f.schluessel && !anlegen}
                      onChange={(e) => aendere(f.feld, e.target.value)}
                    >
                      {f.optionen.map((o) => (
                        <option key={o.wert} value={o.wert}>
                          {o.titel}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      {...OHNE_AUTOFILL}
                      className={[styles.input, f.mono ? styles.mono : ''].filter(Boolean).join(' ')}
                      value={String((entwurf as Record<string, unknown>)[f.feld] ?? '')}
                      readOnly={f.schluessel && !anlegen}
                      onChange={(e) => aendere(f.feld, e.target.value)}
                    />
                  )}
                  {f.hinweis ? <span className={styles.feldHinweis}>{f.hinweis}</span> : null}
                </div>
              ))}
            </div>
          </div>

          {zusatz?.(entwurf)}
        </div>

        <footer className={styles.fuss}>
          <span className={styles.fussHinweis}>
            Übernimmt die Änderung in den Bearbeitungsstand. Verbindlich wird sie mit
            „Speichern" oben im Kopf.
          </span>
          <button type="button" className={styles.abbrechen} onClick={onClose} disabled={speichert}>
            Abbrechen
          </button>
          <button
            type="button"
            className={styles.speichern}
            onClick={() => void speichern()}
            disabled={speichert}
          >
            {speichert ? 'Speichert …' : anlegen ? 'Anlegen' : 'Speichern'}
          </button>
        </footer>
      </div>
    </div>
  )
}
