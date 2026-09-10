import { artikelgruppen, produktgruppen, teilearten } from '../../data/stammdaten.generated.ts'
import styles from './NummernSchema.module.css'

/**
 * GRAFISCHE AUFSCHLÜSSELUNG EINER ARTIKELNUMMER.
 *
 * Die vier Blöcke einer Nummer sind keine Formalie, sondern vier verschiedene Sichten
 * auf denselben Artikel — Einkauf, Konfigurator-Schritt, Auswahlfeld, Zählnummer. Genau
 * das macht diese Darstellung sichtbar, statt es in einen Fließtext zu packen.
 *
 * Die Klartextwerte werden aus den Stammdaten aufgelöst, nicht im Text hinterlegt: Kommt
 * eine Produktgruppe dazu, stimmt die Erklärung weiterhin.
 */

export interface NummernSchemaProps {
  /** Artikelnummer im Muster `00-00-00-0000`. */
  nummer: string
  /** Klartext des Artikels, falls bekannt — wird unter dem Schema aufgelöst. */
  bezeichnung?: string
  /** Ohne Erklärtexte und mit größeren Ziffern — für Folien. */
  kompakt?: boolean
}

/** Je Block eine eigene Farbe, damit im Gespräch auf „den blauen" gezeigt werden kann. */
const FARBEN = ['#3d6b8f', '#8f6b3d', '#3d7a5a', '#7a3d6b']

const ROLLEN = [
  { rolle: 'Teileart', erklaerung: 'Sicht von Einkauf und Fertigung — was für ein Bauteil ist das?' },
  { rolle: 'Produktgruppe', erklaerung: 'Der Schritt im Konfigurator, in dem der Artikel vorkommt.' },
  { rolle: 'Artikelgruppe', erklaerung: 'Das konkrete Dropdown bzw. Auswahlfeld in diesem Schritt.' },
  { rolle: 'Laufende Nummer', erklaerung: 'Zählt innerhalb der Artikelgruppe hoch. Trägt keine Bedeutung.' },
]

/** Löst die drei Klassifikationsblöcke gegen die Stammdaten auf. */
function loeseAuf(nummer: string): string[] {
  const teile = nummer.split('-')
  if (teile.length !== 4) return ['—', '—', '—', '—']
  const [b1, b2, b3, b4] = teile

  const teileart = teilearten.find((t) => t.nr === b1)
  const produktgruppe = produktgruppen.find((p) => p.nr === b2)
  const artikelgruppe = artikelgruppen.find(
    (a) => a.nr === b3 && a.produktgruppe === produktgruppe?.code,
  )

  return [
    teileart?.bezeichnung ?? b1,
    produktgruppe?.schritt ?? b2,
    artikelgruppe?.bezeichnung ?? b3,
    `Nr. ${Number(b4)}`,
  ]
}

export function NummernSchema({ nummer, bezeichnung, kompakt = false }: NummernSchemaProps) {
  const bloecke = nummer.split('-')
  const werte = loeseAuf(nummer)

  return (
    <div>
      <div className={[styles.wurzel, kompakt ? styles.kompakt : ''].filter(Boolean).join(' ')}>
        {bloecke.map((block, i) => (
          <div
            key={i}
            className={styles.block}
            style={{ ['--block-farbe' as string]: FARBEN[i] }}
          >
            <div className={styles.ziffern}>{block}</div>
            <div className={styles.stiel} aria-hidden="true" />
            <div className={styles.rolle}>{ROLLEN[i]?.rolle}</div>
            <div className={styles.wert}>{werte[i]}</div>
            {!kompakt ? <p className={styles.erklaerung}>{ROLLEN[i]?.erklaerung}</p> : null}
          </div>
        ))}
      </div>

      {bezeichnung ? (
        <p className={styles.aufloesung}>
          <span className={styles.aufloesungLabel}>ergibt</span>
          {bezeichnung}
        </p>
      ) : null}
    </div>
  )
}
