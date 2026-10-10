import { rasterHoeheMm } from '../../../config/konstruktionsParameter'
import { mmText, type Korpus2D } from '../../../lib/konstruktion'
import styles from '../Konstruktion2D.module.css'
import { LINIE, type Zeichenkontext } from './kontext'

/** Maßlinie mit Endstrichen und Text (horizontal oder vertikal), in SVG-Koordinaten. */
export function Mass({ x1, y1, x2, y2, text, fs }: { x1: number; y1: number; x2: number; y2: number; text: string; fs: number }) {
  const horizontal = Math.abs(y2 - y1) < Math.abs(x2 - x1)
  const t = fs * 0.5
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  return (
    <g className={styles.mass}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} {...LINIE} />
      {horizontal ? (
        <>
          <line x1={x1} y1={y1 - t} x2={x1} y2={y1 + t} {...LINIE} />
          <line x1={x2} y1={y2 - t} x2={x2} y2={y2 + t} {...LINIE} />
          <text x={mx} y={my - fs * 0.35} fontSize={fs} textAnchor="middle">
            {text}
          </text>
        </>
      ) : (
        <>
          <line x1={x1 - t} y1={y1} x2={x1 + t} y2={y1} {...LINIE} />
          <line x1={x2 - t} y1={y2} x2={x2 + t} y2={y2} {...LINIE} />
          <text x={mx - fs * 0.45} y={my} fontSize={fs} textAnchor="middle" transform={`rotate(-90 ${mx - fs * 0.45} ${my})`}>
            {text}
          </text>
        </>
      )}
    </g>
  )
}

/** Maßkette über der Zeichnung: jede Korpusbreite und die Gesamtbreite. */
export function BreitenKette({ k, abstand }: { k: Zeichenkontext; abstand: number }) {
  const { m, fs, X } = k
  return (
    <>
      {m.korpusse.map((korpus) => {
        const x = X(korpus.x, korpus.b)
        return <Mass key={korpus.index} x1={x} y1={-abstand * 0.35} x2={x + korpus.b} y2={-abstand * 0.35} text={mmText(korpus.b)} fs={fs * 0.8} />
      })}
      <Mass x1={0} y1={-abstand * 0.78} x2={m.breiteMm} y2={-abstand * 0.78} text={mmText(m.breiteMm)} fs={fs * 0.9} />
    </>
  )
}

/**
 * Rasterleiste an der linken Innenseite eines Korpus: ein Strich je Rasterposition, jede
 * dritte beziffert — die Positionen, auf die Böden und Auszüge gesetzt werden.
 */
export function Rasterleiste({ k, korpus }: { k: Zeichenkontext; korpus: Korpus2D }) {
  const { m, Y, X, fs } = k
  const striche: number[] = []
  for (let r = 1; rasterHoeheMm(r) < m.innenObenMm - 40; r++) striche.push(r)
  const x0 = X(korpus.x, korpus.b) + 20
  return (
    <g className={styles.rasterleiste}>
      {striche.map((r) => (
        <g key={r}>
          <line x1={x0} y1={Y(rasterHoeheMm(r))} x2={x0 + (r % 3 === 0 ? 40 : 22)} y2={Y(rasterHoeheMm(r))} {...LINIE} />
          {r % 3 === 0 ? (
            <text x={x0 + 46} y={Y(rasterHoeheMm(r)) + fs * 0.2} fontSize={fs * 0.5}>
              {r}
            </text>
          ) : null}
        </g>
      ))}
    </g>
  )
}
