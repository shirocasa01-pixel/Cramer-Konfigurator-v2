import { useMemo } from 'react'
import { SERVICE_SAETZE, preisOptionen, prozentText, type Schwere } from '../../lib/kalkulation'
import { aufgeloestePreise } from '../../lib/pricingSnapshot'
import { formatEuro } from '../../lib/pricing'
import { useStammdaten } from '../../lib/useStammdaten'
import { Button } from '../ui/Button'
import type { Draft, PricingSnapshotPosition } from '../../types'
import styles from './KalkulationsPanel.module.css'

/**
 * KALKULATIONS-PANEL — die aus dem Entwurf berechnete Positionsliste.
 *
 * Grundsatz für die Anzeige: **keine isolierten IDs.** Jede Position zeigt die volle
 * Artikelbezeichnung, ihre Artikelnummer mit Kurzzeichen, Teileart und Produktgruppe
 * sowie die aufgelösten Achsen A1–A5 mit ihrer Bedeutung im Klartext:
 *
 *     Drehtür „D1"                                        348,00 €
 *     20-20-05-0001 · DRT-001 · FRONT · FRONT
 *     [A1 Breite  T60-230] [A2 Höhenraster  18] [A3 Stil-Linie + PG  Glatt2]
 *
 * Damit ist jeder Betrag ohne Rückfrage prüfbar: der Bearbeiter sieht, welcher Artikel
 * gezogen wurde und über welche Achsenwerte — nicht nur, dass „irgendwas 348 €" kostet.
 * Abgeleitete Positionen tragen zusätzlich ihre Begründung. Das ist der Unterschied
 * zwischen einem Werkzeug, dem der Berater vertraut, und einer Blackbox.
 */

const HERKUNFT_LABEL: Record<PricingSnapshotPosition['herkunft'], string> = {
  gewaehlt: 'gewählt',
  abgeleitet: 'abgeleitet',
  zuschlag: 'Zuschlag',
}

const SCHWERE_LABEL: Record<Schwere, string> = {
  fehler: 'Fehler',
  warnung: 'Hinweis',
  info: 'Info',
}

export interface KalkulationsPanelProps {
  draft: Draft
  /** Übernimmt die berechnete Summe in das manuelle VK-Feld. */
  onSummeUebernehmen?: (gesamt: number) => void
  /**
   * Schaltet Montage / Lieferung regional. Ohne diesen Callback (oder bei einem
   * abgeschlossenen Auftrag) sind die Checkboxen nur Anzeige.
   */
  onPreisOptionenAendern?: (optionen: { montage: boolean; lieferungRegional: boolean }) => void
}

type ServiceSchluessel = 'montage' | 'lieferungRegional'

const SERVICE_ZEILEN: { schluessel: ServiceSchluessel; art: 'montage' | 'lieferung'; name: string }[] = [
  { schluessel: 'montage', art: 'montage', name: 'Montagekosten' },
  { schluessel: 'lieferungRegional', art: 'lieferung', name: 'Lieferung regional' },
]

/** Artikel-Kontext einer Position: Nummer, Kurzzeichen, Teileart, Produktgruppe. */
function ArtikelKontext({ position }: { position: PricingSnapshotPosition }) {
  if (!position.artikelnummer) return null
  const klassifikation = [position.teileart, position.dropdown]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className={styles.artikelZeile}>
      <span className={styles.artikelnummer}>{position.artikelnummer}</span>
      {position.kurzzeichen ? <span>{position.kurzzeichen}</span> : null}
      {klassifikation ? <span className={styles.klassifikation}>{klassifikation}</span> : null}
      {position.einheit ? <span className={styles.klassifikation}>{position.einheit}</span> : null}
      {position.seite ? <span className={styles.klassifikation}>Preisliste S. {position.seite}</span> : null}
    </div>
  )
}

/**
 * Die Achsen A1–A5, über die der Preis gefunden wurde.
 *
 * Angezeigt wird der Name der Achse, nicht ihre ganze Erläuterung: „HÖHE (cm + Raster)"
 * statt „HÖHE (cm + Raster) — Höhenstufe, wird aufgerundet". In einer Positionsliste mit
 * zwanzig Zeilen ist der Satz dahinter Rauschen; er steht weiterhin im Tooltip und
 * ausführlich im Handbuch.
 */
function Achsen({ position }: { position: PricingSnapshotPosition }) {
  const belegt = position.achsen.filter((a) => a.wert !== '')
  if (belegt.length === 0) return null
  return (
    <div className={styles.achsen}>
      {belegt.map((achse) => (
        <span key={achse.spalte} className={styles.achse} title={achse.bedeutung}>
          <span className={styles.achseSpalte}>{achse.spalte}</span>
          <span className={styles.achseName}>{achse.bedeutung.split('—')[0].trim()}</span>
          <span className={styles.achseWert}>{achse.wert}</span>
        </span>
      ))}
    </div>
  )
}

/**
 * MENGE · EINZELPREIS · BETRAG — bei mehreren Bezugsgrößen als Teilpositionen.
 *
 * Aus der Stammdaten-Reform: Ein Artikel kann seinen Preis aus mehreren Bezugsgrößen
 * zusammensetzen — einem Grundpreis und einem Preis je Quadratmeter etwa. Die Position
 * zeigt dann beide Zeilen und darunter die Summe:
 *
 *     Teilpos1   123 cm   ×   123 €/m²
 *     Teilpos2   1        ×   123 €        123 €
 *
 * Die Summe steht in der Zeile des UNTEREN Betrags, der in sie einfließt, und ist nur
 * dann fett, wenn sie aus zwei oder mehr Zeilen entsteht. Bei einer einzigen Bezugsgröße
 * — dem Normalfall — sieht die Zeile aus wie eh und je.
 */
function Betragsspalten({ position }: { position: PricingSnapshotPosition }) {
  const teile = position.teile ?? []

  if (teile.length < 2) {
    return (
      <>
        <td className={styles.tdNum}>{position.menge}×</td>
        <td className={styles.tdNum}>
          {position.einzelpreis == null ? '—' : formatEuro(position.einzelpreis)}
        </td>
        <td className={styles.tdNum}>
          {position.gesamt == null ? (
            <span className={styles.onRequest}>auf Anfrage</span>
          ) : (
            formatEuro(position.gesamt)
          )}
        </td>
      </>
    )
  }

  return (
    <>
      <td className={styles.tdNum}>
        <span className={styles.teilStapel}>
          {teile.map((t, i) => (
            <span key={i}>{t.mengeText}</span>
          ))}
        </span>
      </td>
      <td className={styles.tdNum}>
        <span className={styles.teilStapel}>
          {teile.map((t, i) => (
            <span key={i}>
              × {formatEuro(t.preis)}
              {t.preisEinheit === '€' ? '' : `/${t.preisEinheit.replace('€/', '')}`}
            </span>
          ))}
        </span>
      </td>
      <td className={styles.tdNum}>
        <span className={styles.teilStapel}>
          {teile.map((_, i) =>
            i === teile.length - 1 ? (
              <strong key={i}>{position.gesamt == null ? '—' : formatEuro(position.gesamt)}</strong>
            ) : (
              <span key={i} aria-hidden="true">
                &nbsp;
              </span>
            ),
          )}
        </span>
      </td>
    </>
  )
}

export function KalkulationsPanel({ draft, onSummeUebernehmen, onPreisOptionenAendern }: KalkulationsPanelProps) {
  // Zwei Eingänge: der Entwurf UND der Stammdaten-Stand. Ohne die Version im
  // Abhängigkeits-Array bliebe eine Preisänderung aus der Verwaltung so lange
  // unsichtbar, bis der Entwurf zufällig neu gesetzt wird.
  //
  // Für einen ABGESCHLOSSENEN Auftrag ist genau das umgekehrt gewollt: `aufgeloestePreise`
  // liefert dann den eingefrorenen Stand, und die Stammdaten-Version läuft ins Leere —
  // eine Preispflege verändert den Auftrag nicht mehr.
  const stand = useStammdaten()
  const ergebnis = useMemo(() => aufgeloestePreise(draft), [draft, stand.version])
  const eingefroren = ergebnis.herkunft === 'snapshot'
  const optionen = preisOptionen(draft)

  /*
    MONTAGE UND LIEFERUNG ALS CHECKBOXEN direkt unter dem Möbelpreis. Eine abgewählte
    Zeile bleibt stehen — durchgestrichen, mit dem Betrag, den sie kosten würde —, damit
    der Berater sieht, was er gerade herausgenommen hat.

    Ein eingefrorener Auftrag zeigt seine Zuschläge so, wie sie gespeichert wurden; ältere
    Snapshots kennen `zuschlagArt` noch nicht und laufen deshalb durch die schlichte Liste.
  */
  const serviceZeilen = eingefroren
    ? []
    : SERVICE_ZEILEN.map((z) => {
        const position = ergebnis.zuschlaege.find((p) => p.zuschlagArt === z.art)
        const satz = SERVICE_SAETZE[z.schluessel]
        return {
          ...z,
          aktiv: optionen[z.schluessel],
          label: `${z.name} (+${prozentText(satz)} % auf den Möbelpreis)`,
          betrag: position?.gesamt ?? Math.round(ergebnis.moebelpreis * satz * 100) / 100,
        }
      })
  const weitereZuschlaege = eingefroren
    ? ergebnis.zuschlaege
    : ergebnis.zuschlaege.filter((z) => z.zuschlagArt !== 'montage' && z.zuschlagArt !== 'lieferung')

  const gruppiert = useMemo(() => {
    const map = new Map<string, PricingSnapshotPosition[]>()
    for (const p of ergebnis.positionen) {
      const key = p.segment ? `Segment ${p.segment}` : 'Möbelübergreifend'
      const liste = map.get(key) ?? []
      liste.push(p)
      map.set(key, liste)
    }
    // „Möbelübergreifend" (die abgeleiteten Teile) zuerst.
    return [...map.entries()].sort(([a], [b]) =>
      a === 'Möbelübergreifend' ? -1 : b === 'Möbelübergreifend' ? 1 : a.localeCompare(b, 'de'),
    )
  }, [ergebnis.positionen])

  return (
    <section className={styles.panel} aria-label="Kalkulation">
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>Kalkulation</h2>
          <p className={styles.sub}>
            {eingefroren
              ? `Eingefrorener Preisstand vom ${new Date(ergebnis.frozenAt as string).toLocaleDateString('de-DE')}`
              : `Berechnet aus dem Preisblatt ${ergebnis.gueltigkeit}`}{' '}
            · VK inkl. 19 % MwSt. · jede Position mit Artikelnummer und Achsen belegt
          </p>
        </div>
        <div className={styles.headRight}>
          {eingefroren ? <span className={styles.badgeFrozen}>Auftrag · Preise eingefroren</span> : null}
          <span className={ergebnis.vollstaendig ? styles.badgeOk : styles.badgeOpen}>
            {ergebnis.vollstaendig
              ? 'vollständig kalkuliert'
              : `${ergebnis.offenePositionen} Position(en) offen`}
          </span>
        </div>
      </header>

      {ergebnis.positionen.length === 0 ? (
        <p className={styles.empty}>
          Noch keine kalkulierbaren Positionen. Korpus-Grunddaten und Fronten erfassen.
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thPos}>Position</th>
                <th className={styles.thNum}>Menge</th>
                <th className={styles.thNum}>Einzel</th>
                <th className={styles.thNum}>Betrag</th>
              </tr>
            </thead>
            {gruppiert.map(([gruppe, positionen]) => (
              <tbody key={gruppe}>
                <tr>
                  <th colSpan={4} className={styles.groupRow}>
                    {gruppe}
                  </th>
                </tr>
                {positionen.map((p) => (
                  <tr key={p.id} className={p.status !== 'berechnet' ? styles.rowOpen : undefined}>
                    <td className={styles.tdPos}>
                      <div className={styles.posHead}>
                        <span className={styles.posLabel}>{p.label}</span>
                        {p.herkunft !== 'gewaehlt' ? (
                          <span className={styles.tagDerived}>{HERKUNFT_LABEL[p.herkunft]}</span>
                        ) : null}
                      </div>
                      <ArtikelKontext position={p} />
                      <Achsen position={p} />
                      {p.hinweis ? <div className={styles.posNote}>{p.hinweis}</div> : null}
                    </td>
                    <Betragsspalten position={p} />
                  </tr>
                ))}
              </tbody>
            ))}
            <tfoot>
              <tr className={styles.subtotalRow}>
                <td colSpan={3}>Möbelpreis</td>
                <td className={styles.tdNum}>{formatEuro(ergebnis.moebelpreis)}</td>
              </tr>
              {serviceZeilen.map((z) => (
                <tr key={z.art} className={z.aktiv ? undefined : styles.zuschlagAus}>
                  <td colSpan={3}>
                    <label className={styles.zuschlagCheck}>
                      <input
                        type="checkbox"
                        checked={z.aktiv}
                        disabled={!onPreisOptionenAendern}
                        onChange={(event) =>
                          onPreisOptionenAendern?.({ ...optionen, [z.schluessel]: event.target.checked })
                        }
                      />
                      <span>{z.label}</span>
                      {z.aktiv ? null : <span className={styles.posDetail}> · nicht berechnet</span>}
                    </label>
                  </td>
                  <td className={styles.tdNum}>{formatEuro(z.betrag)}</td>
                </tr>
              ))}
              {weitereZuschlaege.map((z) => (
                <tr key={z.id}>
                  <td colSpan={3}>
                    {z.label}
                    {z.hinweis ? <span className={styles.posDetail}> · {z.hinweis}</span> : null}
                  </td>
                  <td className={styles.tdNum}>{formatEuro(z.gesamt ?? 0)}</td>
                </tr>
              ))}
              <tr className={styles.totalRow}>
                <td colSpan={3}>Gesamt</td>
                <td className={styles.tdNum}>{formatEuro(ergebnis.gesamt)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {eingefroren ? (
        <p className={styles.frozenNote}>
          Dieser Auftrag ist abgeschlossen. Die Beträge stammen aus dem beim Abschluss
          eingefrorenen Preisstand — spätere Änderungen in der Artikelverwaltung wirken
          sich nicht mehr auf ihn aus.
        </p>
      ) : null}

      {ergebnis.snapshotFehlt ? (
        <p className={styles.frozenWarn}>
          Dieser Auftrag ist abgeschlossen, trägt aber keinen eingefrorenen Preisstand
          (angelegt vor Einführung des Snapshots). Die Beträge sind daher LIVE gerechnet
          und können vom tatsächlichen Auftragspreis abweichen.
        </p>
      ) : null}

      {ergebnis.meldungen.length > 0 ? (
        <ul className={styles.messages}>
          {ergebnis.meldungen.map((m, i) => (
            <li key={i} className={styles[`msg_${m.schwere}`]}>
              <span className={styles.msgTag}>{SCHWERE_LABEL[m.schwere]}</span>
              <span>{m.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {onSummeUebernehmen && !eingefroren && ergebnis.positionen.length > 0 ? (
        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => onSummeUebernehmen(ergebnis.gesamt)}>
            Berechneten Preis übernehmen
          </Button>
          {!ergebnis.vollstaendig ? (
            <span className={styles.actionHint}>
              Solange Positionen offen sind, ist der berechnete Preis nicht verbindlich.
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
