import { useState, type ReactNode } from 'react'
import { useDraft } from '../../context/DraftContext'
import { useBearbeitungsModus } from '../../lib/editorModus'
import {
  bericht as baueBericht,
  berichtFuerDropdownCode,
  berichteFuerFeld,
  type InspektorBericht,
} from '../../lib/inspektor'
import type { SchemaFeld } from '../../types/schema'
import styles from './Inspector.module.css'

/**
 * DER TRANSPARENZ-INSPECTOR AM EINZELNEN FELD.
 *
 * Im Bearbeitungsmodus hängt an jedem Auswahlfeld ein kleines Abzeichen — trägt das Feld
 * einen Dropdown-Code, zeigt es ihn direkt an („ℹ 001"), sonst nur das Zeichen. Hover
 * oder Klick öffnet die Auskunft über alle vier Ebenen.
 *
 * Für den Berater existiert nichts davon: Die Komponente gibt außerhalb des
 * Bearbeitungsmodus `null` zurück, noch bevor irgendetwas berechnet wird.
 */
export function Inspector({
  /** Schlüssel aus `config/module.ts`, z. B. `masse.hoehe`. */
  feld,
  /** Abweichende Beschriftung des Abzeichens (Standard: der Dropdown-Code). */
  titel,
}: {
  feld: string
  titel?: string
}) {
  const bearbeitung = useBearbeitungsModus()
  const { draft } = useDraft()
  if (!bearbeitung) return null
  return <Abzeichen bericht={berichteFuerFeld(feld, draft?.seriesId)} schluessel={feld} titel={titel} />
}

/**
 * Derselbe Inspector für ein Schemafeld aus dem Bausteinkatalog.
 *
 * Ein selbst angelegtes Dropdown-Modul trägt seine Ebene 3 in der Feld-Einstellung und
 * nicht in `config/module.ts` — deshalb der eigene Einstieg.
 */
export function FeldInspector({ feld, modulId }: { feld: SchemaFeld; modulId: string }) {
  const bearbeitung = useBearbeitungsModus()
  const { draft } = useDraft()
  if (!bearbeitung) return null

  const bericht: InspektorBericht = feld.dropdownCode
    ? berichtFuerDropdownCode(feld.dropdownCode, modulId, draft?.seriesId)
    : baueBericht(
        {
          modul: modulId,
          werte: feld.optionen === 'filialen'
            ? 'Blatt „41 Filialen" der Stammdaten-Mappe'
            : feld.bindung
              ? `Entwurfsfeld „${feld.bindung}"`
              : feld.quelle
                ? `automatisch berechnet („${feld.quelle}")`
                : `frei erfasster Wert, gespeichert unter „${feld.id}"`,
          regeln: feld.regeln
            ?.filter((r) => r.art === 'nurSerien' && r.serien.length > 0)
            .map((r) => `Erscheint nur bei den Serien: ${r.serien.join(', ')}.`),
        },
        draft?.seriesId,
      )

  return <Abzeichen bericht={bericht} schluessel={feld.id} />
}

function Abzeichen({
  bericht,
  schluessel,
  titel,
}: {
  bericht: InspektorBericht | undefined
  schluessel: string
  titel?: string
}) {
  const [offen, setOffen] = useState(false)
  const code = bericht?.dropdowns[0]?.nr

  return (
    <span
      className={styles.anker}
      onMouseEnter={() => setOffen(true)}
      onMouseLeave={() => setOffen(false)}
    >
      <button
        type="button"
        className={styles.badge}
        aria-expanded={offen}
        title="Herkunft dieses Feldes anzeigen"
        onClick={() => setOffen((v) => !v)}
      >
        <span aria-hidden="true">ℹ</span>
        {titel ?? (code ? <span className={styles.code}>{code}</span> : null)}
      </button>

      {offen ? (
        <span className={styles.karte} role="note">
          {bericht ? <Auskunft bericht={bericht} /> : (
            <span className={styles.leer}>
              Für „{schluessel}" ist keine Herkunft hinterlegt. Eintragen in
              <code> config/module.ts</code>.
            </span>
          )}
        </span>
      ) : null}
    </span>
  )
}

/** Die vier Ebenen, jede als eigener Block — in der Reihenfolge des Datenflusses. */
function Auskunft({ bericht }: { bericht: InspektorBericht }) {
  return (
    <>
      <Ebene nummer={2} name="Modul">
        {bericht.modul ? (
          <>
            <b>{bericht.modul.name}</b>
            <span className={styles.zweck}>{bericht.modul.zweck}</span>
          </>
        ) : (
          <span className={styles.zweck}>keinem Modul zugeordnet</span>
        )}
      </Ebene>

      <Ebene nummer={3} name="Dropdown">
        {bericht.dropdowns.length > 0 ? (
          bericht.dropdowns.map((d) => (
            <span key={d.nr} className={styles.zeile}>
              <b className={styles.code}>{d.nr}</b> {d.bezeichnung}
              <span className={styles.zweck}>
                {d.nummernkreis} · {d.artikelFuerSerie} von {d.artikelGesamt} Artikeln für diese
                Serie freigegeben
              </span>
            </span>
          ))
        ) : (
          <span className={styles.zweck}>
            kein Auswahlfeld der Artikelverwaltung — der Wert entsteht an anderer Stelle
          </span>
        )}
      </Ebene>

      <Ebene nummer={4} name="Artikel & Stammdaten">
        {bericht.werte ? <span className={styles.zweck}>{bericht.werte}</span> : null}
        {bericht.artikel.map((a) => (
          <span key={a.nummer} className={styles.zeile}>
            <b className={styles.code}>{a.nummer}</b> {a.bezeichnung}
            <span className={styles.zweck}>
              Achsen: {a.achsenText} · {a.freigabe}
              {a.status !== 'aktiv' ? ` · Status: ${a.status}` : ''}
            </span>
          </span>
        ))}
      </Ebene>

      {bericht.regeln.length > 0 ? (
        <span className={styles.block}>
          <span className={styles.blockTitel}>Regeln</span>
          {bericht.regeln.map((r, i) => (
            <span key={i} className={styles.zweck}>
              · {r}
            </span>
          ))}
        </span>
      ) : null}

      <span className={styles.block}>
        <span className={styles.blockTitel}>Preis</span>
        {bericht.preis.length > 0 ? (
          bericht.preis.map((p, i) => (
            <span key={i} className={styles.zweck}>
              · {p}
            </span>
          ))
        ) : (
          <span className={styles.zweck}>· ohne eigene Preisposition</span>
        )}
      </span>
    </>
  )
}

function Ebene({
  nummer,
  name,
  children,
}: {
  nummer: number
  name: string
  children: ReactNode
}) {
  return (
    <span className={styles.block}>
      <span className={styles.blockTitel}>
        <span className={styles.ebene}>Ebene {nummer}</span> {name}
      </span>
      {children}
    </span>
  )
}
