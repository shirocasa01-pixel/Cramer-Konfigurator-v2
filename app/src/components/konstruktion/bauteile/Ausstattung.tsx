import type { ReactNode } from 'react'
import { KONSTRUKTION as K } from '../../../config/konstruktionsParameter'
import { mmText, type Ausstattung2D, type AusstattungArt } from '../../../lib/konstruktion'
import styles from '../Konstruktion2D.module.css'
import { LINIE, type Zeichenkontext } from './kontext'

/**
 * AUSSTATTUNGS-BIBLIOTHEK — je Bauteilart ein Zeichenmodul für die Innenansicht und, wo es
 * im Grundriss sichtbar ist, für die Draufsicht. Neue Artikel bekommen hier einen Eintrag;
 * die Ansichten setzen nur zusammen, was das Modell liefert.
 */

type Zeichner = (a: Ausstattung2D, k: Zeichenkontext, extra: { vorne: number; wand: number; index: number }) => ReactNode

interface Modul {
  innen: Zeichner
  oben?: Zeichner
}

/** Höhenangabe wie in der AV-Zeichnung: Oberkante über dem Fußboden. */
function Hoehe({ a, k, oberkante }: { a: Ausstattung2D; k: Zeichenkontext; oberkante: number }) {
  return (
    <text className={styles.hoehe} x={k.X(a.x, a.b) + a.b - k.fs * 0.2} y={k.Y(oberkante) - k.fs * 0.2} fontSize={k.fs * 0.55} textAnchor="end">
      {mmText(oberkante)}
    </text>
  )
}

function Verschoben({ a, k }: { a: Ausstattung2D; k: Zeichenkontext }) {
  if (!a.verschoben) return null
  return (
    <text className={styles.verschoben} x={k.X(a.x, a.b) + k.fs * 0.3} y={k.Y(a.y) - k.fs * 0.25} fontSize={k.fs * 0.5}>
      ↑ verschoben
    </text>
  )
}

const boden: Zeichner = (a, k) => (
  <g>
    <rect className={a.art === 'glasboden' ? styles.glas : a.art === 'trennboden' ? styles.konstruktionsboden : styles.fachboden} x={k.X(a.x, a.b)} y={k.Y(a.y + a.h)} width={a.b} height={a.h} {...LINIE} />
    {a.art !== 'trennboden' ? <Hoehe a={a} k={k} oberkante={a.y + a.h} /> : null}
    <Verschoben a={a} k={k} />
  </g>
)

/** Block mit Beschriftung — Grundform für Container, Körbe, Einsätze. */
function block(klasse: string, mitTeilung = false): Zeichner {
  return (a, k) => {
    const x = k.X(a.x, a.b) + 6
    const b = a.b - 12
    const teilungen: number[] = []
    if (mitTeilung && a.teilungen && a.teilungen.length > 1) {
      let y = a.y
      for (const t of a.teilungen.slice(0, -1)) {
        y += t
        teilungen.push(y)
      }
    }
    return (
      <g className={klasse}>
        <rect x={x} y={k.Y(a.y + a.h)} width={b} height={a.h} {...LINIE} />
        {teilungen.map((y) => (
          <line key={y} className={styles.teilung} x1={x} y1={k.Y(y)} x2={x + b} y2={k.Y(y)} {...LINIE} />
        ))}
        {a.rauchglas ? <rect className={styles.rauchglas} x={x} y={k.Y(a.y + a.h)} width={b} height={14} {...LINIE} /> : null}
        <text x={x + b / 2} y={k.Y(a.y + a.h / 2) + k.fs * 0.25} fontSize={k.fs * 0.6} textAnchor="middle">
          {a.label}
        </text>
        <Hoehe a={a} k={k} oberkante={a.y + a.h} />
        <Verschoben a={a} k={k} />
      </g>
    )
  }
}

/** Grundfläche (gestrichelt) im Grundriss — Container sitzen vorne, 50 cm tief. */
const flaecheOben: Zeichner = (a, k, { vorne }) => {
  const t = Math.min(a.t ?? K.containerTiefeMm, k.m.tiefeMm - 20)
  return <rect className={styles.verdeckt} x={k.X(a.x, a.b) + 6} y={vorne - t - 10} width={a.b - 12} height={t} {...LINIE} />
}

export const AUSSTATTUNG: Record<AusstattungArt, Modul> = {
  boden: { innen: boden },
  glasboden: { innen: boden },
  trennboden: { innen: boden },
  kleiderstange: {
    innen: (a, k) => <line className={styles.stange} x1={k.X(a.x, a.b)} y1={k.Y(a.y)} x2={k.X(a.x, a.b) + a.b} y2={k.Y(a.y)} {...LINIE} />,
    oben: (a, k, { wand }) => (
      <line className={styles.stange} x1={k.X(a.x, a.b)} y1={wand + k.m.tiefeMm / 2} x2={k.X(a.x, a.b) + a.b} y2={wand + k.m.tiefeMm / 2} {...LINIE} />
    ),
  },
  container: { innen: block(styles.einbau, true), oben: flaecheOben },
  innenschublade: { innen: block(styles.einbau, true), oben: flaecheOben },
  aussenschub: { innen: block(styles.aussenschub) },
  rollboden: { innen: block(styles.einbau) },
  rollkorb: { innen: block(styles.korb) },
  schuhablage: { innen: block(styles.korb) },
  hemdeinsatz: { innen: block(styles.einbau) },
  kleiderlift: {
    innen: (a, k) => {
      const x = k.X(a.x, a.b)
      const y = k.Y(a.y + a.h)
      return (
        <g className={styles.kleiderlift}>
          {/* Schwenkarme und Stange */}
          <line x1={x + 30} y1={y} x2={x + 90} y2={y + a.h} {...LINIE} />
          <line x1={x + a.b - 30} y1={y} x2={x + a.b - 90} y2={y + a.h} {...LINIE} />
          <line className={styles.stange} x1={x + 90} y1={y + a.h} x2={x + a.b - 90} y2={y + a.h} {...LINIE} />
          <text x={x + a.b / 2} y={y + a.h + k.fs * 0.8} fontSize={k.fs * 0.55} textAnchor="middle">
            {a.label}
          </text>
        </g>
      )
    },
  },
  seitenauszug: {
    innen: (a, k) => (
      <g className={styles.einbau}>
        <rect x={k.X(a.x, a.b) + a.b - 70} y={k.Y(a.y + a.h)} width={50} height={a.h} {...LINIE} />
        <text x={k.X(a.x, a.b) + a.b - 80} y={k.Y(a.y + a.h / 2)} fontSize={k.fs * 0.5} textAnchor="end">
          {a.label}
        </text>
      </g>
    ),
  },
  'led-deckel': {
    innen: (a, k) => (
      <g className={styles.led}>
        <line x1={k.X(a.x, a.b) + 10} y1={k.Y(a.y)} x2={k.X(a.x, a.b) + a.b - 10} y2={k.Y(a.y)} {...LINIE} />
        <text x={k.X(a.x, a.b) + a.b / 2} y={k.Y(a.y) + k.fs * 0.85} fontSize={k.fs * 0.6} textAnchor="middle">
          ‹— LED —›
        </text>
      </g>
    ),
  },
  'led-seite': {
    innen: (a, k) => <line className={styles.led} x1={k.X(a.x)} y1={k.Y(a.y)} x2={k.X(a.x)} y2={k.Y(a.y + a.h)} {...LINIE} />,
    oben: (a, k, { vorne }) => <circle className={styles.ledPunkt} cx={k.X(a.x)} cy={vorne - 25} r={k.fs * 0.25} />,
  },
  // Teile ohne eigene Zeichnung: als Text in der Sockelzone (die Ansicht fasst sie je Korpus zusammen).
  hinweis: {
    innen: (a, k) => (
      <text className={styles.hinweis} x={k.X(a.x, a.b) + a.b / 2} y={k.Y(k.m.innenBodenMm / 2) + k.fs * 0.2} fontSize={k.fs * 0.45} textAnchor="middle">
        {a.label}
      </text>
    ),
  },
}
