import { mmText, type Konstruktion2D as Modell } from '../../lib/konstruktion'
import { ANSICHTEN, type Ansicht } from './ansichten'
import styles from './Konstruktion2D.module.css'

/** Tabs und Fußzeile der Skizze — gemeinsam für die Box neben dem Formular und das Vollbild. */
export function AnsichtsTabs({ ansicht, onWahl }: { ansicht: Ansicht; onWahl: (a: Ansicht) => void }) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Ansicht">
      {ANSICHTEN.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={ansicht === id}
          className={ansicht === id ? styles.tabAktiv : styles.tab}
          onClick={() => onWahl(id)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Maßzeile und Hinweise der Stapelregel unter der Skizze. */
export function SkizzenFuss({ m, ansicht }: { m: Modell; ansicht: Ansicht }) {
  return (
    <>
      <p className={styles.fuss}>
        Maßstäblich · Maße in mm · {m.korpusse.length} {m.korpusse.length === 1 ? 'Korpus' : 'Korpi'} · B {mmText(m.breiteMm)} × H{' '}
        {mmText(m.hoeheMm)} × T {mmText(m.tiefeMm)}
        {m.wandabstandMm > 0 ? ` · ${mmText(m.wandabstandMm)} mm Wandabstand (Kabelführung Beleuchtung)` : ''}
        {m.schiebetueren > 0 ? ` · ${m.schiebetueren} Schiebetüren, zwei Laufebenen` : ''}
        {ansicht === 'vorne' && m.fronten.length === 0 ? ' · noch keine Fronten geplant' : ''}
      </p>
      {m.hinweise.length > 0 && (ansicht === 'innen' || ansicht === 'vorne') ? (
        <ul className={styles.hinweisListe}>
          {m.hinweise.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : null}
    </>
  )
}
