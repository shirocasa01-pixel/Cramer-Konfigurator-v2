import { dropdowns, teilearten } from '../../data/stammdaten.generated.ts'
import styles from './NummernSchema.module.css'

/**
 * GRAFISCHE AUFSCHLÜSSELUNG EINER ARTIKELNUMMER  `XX-XXX-XXXX`.
 *
 * Drei Blöcke, drei Fragen: In welchem Schritt? In welchem Auswahlfeld? Der wievielte?
 * Genau das macht diese Darstellung sichtbar, statt es in einen Fließtext zu packen.
 *
 * Die Klartextwerte werden aus den Stammdaten aufgelöst, nicht im Text hinterlegt: Kommt
 * ein Dropdown dazu, stimmt die Erklärung weiterhin.
 */

export interface NummernSchemaProps {
  /** Artikelnummer im Muster `XX-XXX-XXXX`. */
  nummer: string
  /** Klartext des Artikels, falls bekannt — wird unter dem Schema aufgelöst. */
  bezeichnung?: string
  /** Ohne Erklärtexte und mit größeren Ziffern — für kompakte Einbettungen. */
  kompakt?: boolean
}

/** Je Block eine eigene Farbe, damit im Gespräch auf „den blauen" gezeigt werden kann. */
const FARBEN = ['#3d6b8f', '#3d7a5a', '#7a3d6b']

const ROLLEN = [
  {
    rolle: 'Teileart',
    erklaerung: 'Die oberste Kategorie — zugleich der Hauptschritt im Konfigurator.',
  },
  {
    rolle: 'Dropdown',
    erklaerung: 'Das konkrete Auswahlfeld. Diese Nummer gibt es im ganzen System nur einmal.',
  },
  {
    rolle: 'Laufende Nummer',
    erklaerung: 'Zählt innerhalb des Dropdowns hoch. Trägt keine Bedeutung.',
  },
]

/** Löst die beiden Klassifikationsblöcke gegen die Stammdaten auf. */
function loeseAuf(nummer: string): string[] {
  const teile = nummer.split('-')
  if (teile.length !== 3) return ['—', '—', '—']
  const [b1, b2, b3] = teile

  const teileart = teilearten.find((t) => t.nr === b1)
  const dropdown = dropdowns.find((d) => d.nr === b2)

  return [
    teileart?.schritt ?? b1,
    dropdown?.bezeichnung ?? b2,
    `Nr. ${Number(b3)}`,
  ]
}

export function NummernSchema({ nummer, bezeichnung, kompakt = false }: NummernSchemaProps) {
  const bloecke = nummer.split('-')
  const werte = loeseAuf(nummer)

  return (
    <div>
      <div className={[styles.wurzel, kompakt ? styles.kompakt : ''].filter(Boolean).join(' ')}>
        {bloecke.map((block, i) => (
          <div key={i} className={styles.block} style={{ ['--block-farbe' as string]: FARBEN[i] }}>
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
