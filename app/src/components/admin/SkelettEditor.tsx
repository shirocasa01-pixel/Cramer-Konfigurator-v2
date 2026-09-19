import { useState, useSyncExternalStore } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { FeldEinstellungen, TYP_LABEL } from './FeldEinstellungen'
import {
  aktualisiereFeld,
  ergaenzeFeld,
  entferneFeld,
  getEntwurfSchema,
  hatOffenenEntwurf,
  setzeAufAuslieferungZurueck,
  subscribeSchema,
  veroeffentliche,
  verschiebeFeld,
  verwerfeEntwurf,
} from '../../lib/schemaStore'
import type { FeldTyp, SchemaFeld } from '../../types/schema'
import styles from './SkelettEditor.module.css'

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

/** Aus einer Beschriftung eine stabile, eindeutige Feld-ID machen. */
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
 * SKELETT-EDITOR — der Konfigurator als bearbeitbares Gerüst.
 *
 * Der Administrator sieht dieselbe Reihenfolge und dieselben Beschriftungen wie der
 * Berater, nur mit Griffen daran: umsortieren, bearbeiten, abschalten, ergänzen.
 * Änderungen laufen in einen Entwurf; erst „Veröffentlichen" macht sie für alle gültig.
 */
export function SkelettEditor() {
  const schema = useSyncExternalStore(subscribeSchema, getEntwurfSchema, getEntwurfSchema)
  const offenerEntwurf = useSyncExternalStore(subscribeSchema, hatOffenenEntwurf, hatOffenenEntwurf)

  const [katalogFuer, setKatalogFuer] = useState<string | null>(null)
  /** `frisch` ⇒ gerade erst angelegt; dann darf die Kennung noch der Beschriftung folgen. */
  const [bearbeitet, setBearbeitet] = useState<{ abschnitt: string; feld: SchemaFeld; frisch?: boolean } | null>(
    null,
  )

  function neuerBaustein(abschnittId: string, typ: FeldTyp) {
    const abschnitt = schema.abschnitte.find((a) => a.id === abschnittId)
    const vergeben = new Set(abschnitt?.felder.map((f) => f.id) ?? [])
    const vorschlag = BAUSTEINE.find((b) => b.typ === typ)?.titel ?? 'Neues Feld'
    const feld: SchemaFeld = {
      id: baueId(vorschlag, vergeben),
      typ,
      label: vorschlag,
      aktiv: true,
      sortierung: 0,
      zeigeIn: { maske: true, zusammenfassung: true, pdf: false },
    }
    setKatalogFuer(null)
    // Direkt in die Einstellungsmaske: Ein Feld namens „Textfeld" hilft niemandem.
    const angelegt = ergaenzeFeld(abschnittId, feld)
    if (angelegt) setBearbeitet({ abschnitt: abschnittId, feld: angelegt, frisch: true })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.statusZeile}>
        <span className={offenerEntwurf ? styles.statusEntwurf : styles.statusLive}>
          {offenerEntwurf ? 'Entwurf — noch nicht veröffentlicht' : `Veröffentlicht · Fassung ${schema.version}`}
        </span>
        <div className={styles.statusAktionen}>
          {offenerEntwurf ? (
            <>
              <Button variant="ghost" onClick={verwerfeEntwurf}>
                Entwurf verwerfen
              </Button>
              <Button onClick={veroeffentliche}>Veröffentlichen</Button>
            </>
          ) : (
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm('Alle Änderungen am Aufbau verwerfen und den Auslieferungsstand herstellen?')) {
                  setzeAufAuslieferungZurueck()
                }
              }}
            >
              Auf Auslieferungsstand zurücksetzen
            </Button>
          )}
        </div>
      </div>

      {schema.abschnitte.map((abschnitt) => {
        const sortiert = [...abschnitt.felder].sort((a, b) => a.sortierung - b.sortierung)
        return (
          <section key={abschnitt.id} className={styles.abschnitt}>
            <header className={styles.abschnittKopf}>
              <h3 className={styles.abschnittTitel}>{abschnitt.titel}</h3>
              <span className={styles.abschnittMeta}>
                {sortiert.length} Bausteine · Abschnitt <code>{abschnitt.id}</code>
              </span>
            </header>
            {abschnitt.beschreibung ? <p className={styles.abschnittText}>{abschnitt.beschreibung}</p> : null}

            <ul className={styles.felder}>
              {sortiert.map((feld, index) => (
                <li key={feld.id} className={feld.aktiv ? styles.feld : styles.feldAus}>
                  <div className={styles.feldText}>
                    <span className={styles.feldLabel}>
                      {feld.label}
                      {feld.pflicht ? <span className={styles.pflicht}> *</span> : null}
                    </span>
                    <span className={styles.feldMeta}>
                      {TYP_LABEL[feld.typ]}
                      {feld.quelle ? ' · automatisch' : ''}
                      {feld.dropdownCode ? ` · Dropdown ${feld.dropdownCode}` : ''}
                      {!feld.aktiv ? ' · abgeschaltet' : ''}
                    </span>
                  </div>

                  <div className={styles.marken}>
                    {feld.zeigeIn.maske ? <span className={styles.marke}>Maske</span> : null}
                    {feld.zeigeIn.zusammenfassung ? <span className={styles.marke}>Zusammenfassung</span> : null}
                    {feld.zeigeIn.pdf ? <span className={styles.markePdf}>PDF</span> : null}
                    {feld.regeln?.some((r) => r.art === 'nurSerien' && r.serien.length > 0) ? (
                      <span className={styles.markeRegel}>Regel</span>
                    ) : null}
                  </div>

                  <div className={styles.aktionen}>
                    <button
                      type="button"
                      className={styles.knopf}
                      title="Nach oben"
                      disabled={index === 0}
                      onClick={() => verschiebeFeld(abschnitt.id, feld.id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={styles.knopf}
                      title="Nach unten"
                      disabled={index === sortiert.length - 1}
                      onClick={() => verschiebeFeld(abschnitt.id, feld.id, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={styles.knopf}
                      title="Bearbeiten"
                      onClick={() => setBearbeitet({ abschnitt: abschnitt.id, feld })}
                    >
                      ✎
                    </button>
                    {feld.aktiv ? (
                      <button
                        type="button"
                        className={styles.knopfWeg}
                        title={feld.systemfeld ? 'Abschalten (Auslieferungsfeld)' : 'Entfernen'}
                        onClick={() => entferneFeld(abschnitt.id, feld.id)}
                      >
                        🗑
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.knopf}
                        title="Wieder einschalten"
                        onClick={() => aktualisiereFeld(abschnitt.id, { ...feld, aktiv: true })}
                      >
                        ⟲
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <button type="button" className={styles.plus} onClick={() => setKatalogFuer(abschnitt.id)}>
              + Baustein hinzufügen
            </button>
          </section>
        )
      })}

      <Modal open={katalogFuer != null} title="Baustein hinzufügen" onClose={() => setKatalogFuer(null)}>
        <div className={styles.katalog}>
          {BAUSTEINE.map((b) => (
            <button
              key={b.typ}
              type="button"
              className={styles.katalogKachel}
              onClick={() => katalogFuer && neuerBaustein(katalogFuer, b.typ)}
            >
              <span className={styles.katalogTitel}>{b.titel}</span>
              <span className={styles.katalogZweck}>{b.zweck}</span>
            </button>
          ))}
        </div>
      </Modal>

      <FeldEinstellungen
        offen={bearbeitet != null}
        feld={bearbeitet?.feld ?? null}
        onAbbrechen={() => setBearbeitet(null)}
        onSpeichern={(feld) => {
          if (bearbeitet) {
            const abschnitt = schema.abschnitte.find((a) => a.id === bearbeitet.abschnitt)
            const vergeben = new Set(
              (abschnitt?.felder ?? []).filter((f) => f.id !== bearbeitet.feld.id).map((f) => f.id),
            )
            // Frisch angelegte Felder bekommen ihre Kennung aus der Beschriftung, damit im
            // Entwurf „lieferadresse" steht und nicht „mehrzeiliges-textfeld".
            const id = bearbeitet.frisch && !feld.systemfeld ? baueId(feld.label, vergeben) : feld.id
            aktualisiereFeld(bearbeitet.abschnitt, { ...feld, id }, bearbeitet.feld.id)
          }
          setBearbeitet(null)
        }}
      />
    </div>
  )
}
