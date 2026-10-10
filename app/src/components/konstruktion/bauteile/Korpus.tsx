import { KONSTRUKTION as K } from '../../../config/konstruktionsParameter'
import type { Korpus2D } from '../../../lib/konstruktion'
import styles from '../Konstruktion2D.module.css'
import { LINIE, type Zeichenkontext } from './kontext'

/**
 * KORPUS & ZUBEHÖR — Seiten/Mittelseiten, Bodenplatte, Abschlussboden, Sockel, Rückwand mit
 * Lochreihe und Bodenträger, Abschlusssets, Verblendung, Fußleistenausschnitt.
 * Je Ansicht eine Funktion; alle lesen dieselben Modellwerte.
 */

/** Ansicht von vorne: Außenkontur, Seiten, Sockelzone. `innen` zeichnet zusätzlich die Böden. */
export function KorpusVorne({ k, korpus, innen }: { k: Zeichenkontext; korpus: Korpus2D; innen: boolean }) {
  const { m, Y, X } = k
  const x = X(korpus.x, korpus.b)
  return (
    <g className={styles.korpus}>
      <rect x={x} y={Y(m.hoeheMm)} width={korpus.b} height={m.hoeheMm} {...LINIE} />
      {/* Seite links (Außen- oder Mittelseite) und rechts */}
      <rect className={styles.seite} x={x} y={Y(m.hoeheMm)} width={K.seiteMm} height={m.hoeheMm} {...LINIE} />
      <rect className={styles.seite} x={x + korpus.b - K.seiteMm} y={Y(m.hoeheMm)} width={K.seiteMm} height={m.hoeheMm} {...LINIE} />
      {innen ? (
        <>
          <rect className={styles.innen} x={x + K.seiteMm} y={Y(m.innenObenMm)} width={korpus.b - 2 * K.seiteMm} height={m.innenObenMm - m.innenBodenMm} {...LINIE} />
          {/* Abschlussboden (oberer Konstruktionsboden) und Bodenplatte */}
          <rect className={styles.konstruktionsboden} x={x + K.seiteMm} y={Y(m.innenObenMm + K.abschlussbodenMm)} width={korpus.b - 2 * K.seiteMm} height={K.abschlussbodenMm} {...LINIE} />
          <rect className={styles.konstruktionsboden} x={x + K.seiteMm} y={Y(m.innenBodenMm)} width={korpus.b - 2 * K.seiteMm} height={Math.min(K.einlegebodenMm, m.innenBodenMm)} {...LINIE} />
          {/* Sockel */}
          <rect className={styles.sockel} x={x + K.seiteMm} y={Y(m.innenBodenMm - K.einlegebodenMm)} width={korpus.b - 2 * K.seiteMm} height={Math.max(0, m.innenBodenMm - K.einlegebodenMm)} {...LINIE} />
        </>
      ) : null}
    </g>
  )
}

/** Grundriss: Korpusfläche, Seiten, Rückwand, Beschriftung. */
export function KorpusOben({ k, korpus, wand, tiefe }: { k: Zeichenkontext; korpus: Korpus2D; wand: number; tiefe: number }) {
  const { X, fs } = k
  const x = X(korpus.x, korpus.b)
  return (
    <g className={styles.korpus}>
      <rect x={x} y={wand} width={korpus.b} height={tiefe} {...LINIE} />
      <rect className={styles.seite} x={x} y={wand} width={K.seiteMm} height={tiefe} {...LINIE} />
      <rect className={styles.seite} x={x + korpus.b - K.seiteMm} y={wand} width={K.seiteMm} height={tiefe} {...LINIE} />
      <rect className={styles.rueckwandSchnitt} x={x + K.seiteMm} y={wand} width={korpus.b - 2 * K.seiteMm} height={K.rueckwandMm} {...LINIE} />
      <text className={styles.korpusLabel} x={x + korpus.b / 2} y={wand + tiefe * 0.3} fontSize={fs * 0.8} textAnchor="middle">
        {String(korpus.nennCm).replace('.', ',')}er
      </text>
    </g>
  )
}

/**
 * Rückansicht: Rückwand je Korpus, Lochreihe (System 32, gezeichnet je 64 mm), zusätzlicher
 * Bodenträger bei breiten Korpi, Ausschnitte (Rückwandausschnitt, Revisionsklappe).
 */
export function KorpusHinten({ k, korpus, sicht }: { k: Zeichenkontext; korpus: Korpus2D; sicht: boolean }) {
  const { m, Y, X, fs } = k
  const x = X(korpus.x, korpus.b)
  const innenB = korpus.b - 2 * K.seiteMm
  const loecher: number[] = []
  if (korpus.lochreihe) for (let y = m.innenBodenMm + 64; y < m.innenObenMm - 32; y += 64) loecher.push(y)
  return (
    <g className={styles.korpus}>
      <rect x={x} y={Y(m.hoeheMm)} width={korpus.b} height={m.hoeheMm} {...LINIE} />
      <rect className={sicht ? styles.sichtrueckwand : styles.rueckwand} x={x + K.seiteMm} y={Y(m.innenObenMm)} width={innenB} height={m.innenObenMm - m.innenBodenMm} {...LINIE} />
      {loecher.map((y) => (
        <g key={y} className={styles.loch}>
          <circle cx={x + K.seiteMm + 37} cy={Y(y)} r={4} />
          <circle cx={x + korpus.b - K.seiteMm - 37} cy={Y(y)} r={4} />
        </g>
      ))}
      {korpus.bodentraeger ? (
        <line className={styles.bodentraeger} x1={x + korpus.b / 2} y1={Y(m.innenObenMm)} x2={x + korpus.b / 2} y2={Y(m.innenBodenMm)} {...LINIE} />
      ) : null}
      {korpus.rueckwandAusschnitte.map((name, i) => {
        const b = Math.min(300, innenB * 0.5)
        const h = 220
        const y = m.innenBodenMm + 150 + i * (h + 80)
        return (
          <g key={name} className={styles.ausschnitt}>
            <rect x={x + korpus.b / 2 - b / 2} y={Y(y + h)} width={b} height={h} {...LINIE} />
            <text x={x + korpus.b / 2} y={Y(y + h / 2) + fs * 0.25} fontSize={fs * 0.55} textAnchor="middle">
              {name}
            </text>
          </g>
        )
      })}
      <text className={styles.hinweis} x={x + korpus.b / 2} y={Y(0) + fs * 2.3} fontSize={fs * 0.6} textAnchor="middle">
        Korpus {korpus.index + 1}
      </text>
    </g>
  )
}

/** Abschlusssets links/rechts — vorne und hinten als Streifen über die volle Höhe. */
export function Abschlusssets({ k, ansicht, wand = 0 }: { k: Zeichenkontext; ansicht: 'vorne' | 'oben'; wand?: number }) {
  const { m, Y, X } = k
  const teile: Array<{ x: number; b: number }> = []
  if (m.abschluss.links) teile.push({ x: 0, b: m.abschluss.links })
  if (m.abschluss.rechts) teile.push({ x: m.breiteMm - m.abschluss.rechts, b: m.abschluss.rechts })
  return (
    <>
      {teile.map((t) =>
        ansicht === 'vorne' ? (
          <rect key={t.x} className={styles.abschluss} x={X(t.x, t.b)} y={Y(m.hoeheMm)} width={t.b} height={m.hoeheMm} {...LINIE} />
        ) : (
          <rect key={t.x} className={styles.abschluss} x={X(t.x, t.b)} y={wand} width={t.b} height={m.tiefeMm} {...LINIE} />
        ),
      )}
    </>
  )
}

/** Verblendung (gestrichelt) — seitlich und oben, korpus- oder frontbündig. */
export function Verblendung({ k, ansicht, wand = 0, frontTiefe = 0 }: { k: Zeichenkontext; ansicht: 'vorne' | 'oben'; wand?: number; frontTiefe?: number }) {
  const { m, Y, X } = k
  const v = m.verblendung
  if (!v) return null
  const oben = v.oben ? v.mm : 0
  if (ansicht === 'oben') {
    const tiefe = v.art === 'frontbuendig' ? m.tiefeMm + frontTiefe : m.tiefeMm
    return (
      <g className={styles.verblendung}>
        {v.links ? <rect x={X(-v.mm, v.mm)} y={wand} width={v.mm} height={tiefe} {...LINIE} /> : null}
        {v.rechts ? <rect x={X(m.breiteMm, v.mm)} y={wand} width={v.mm} height={tiefe} {...LINIE} /> : null}
      </g>
    )
  }
  return (
    <g className={styles.verblendung}>
      {v.links ? <rect x={X(-v.mm, v.mm)} y={Y(m.hoeheMm + oben)} width={v.mm} height={m.hoeheMm + oben} {...LINIE} /> : null}
      {v.rechts ? <rect x={X(m.breiteMm, v.mm)} y={Y(m.hoeheMm + oben)} width={v.mm} height={m.hoeheMm + oben} {...LINIE} /> : null}
      {v.oben ? (
        <rect x={X(v.links ? -v.mm : 0, m.breiteMm + (v.links ? v.mm : 0) + (v.rechts ? v.mm : 0))} y={Y(m.hoeheMm + v.mm)} width={m.breiteMm + (v.links ? v.mm : 0) + (v.rechts ? v.mm : 0)} height={v.mm} {...LINIE} />
      ) : null}
    </g>
  )
}

/** Fußleistenausschnitt: im Grundriss als verdeckte Kante, hinten als Ausschnitt unten. */
export function Fussleiste({ k, ansicht, wand = 0 }: { k: Zeichenkontext; ansicht: 'oben' | 'hinten'; wand?: number }) {
  const { m, Y, fs } = k
  const fl = m.fussleiste
  if (!fl) return null
  if (ansicht === 'oben') {
    return (
      <g className={styles.verdeckt}>
        <line x1={0} y1={wand + fl.tiefeMm} x2={m.breiteMm} y2={wand + fl.tiefeMm} {...LINIE} />
        <text x={m.breiteMm / 2} y={wand + fl.tiefeMm + fs * 0.9} fontSize={fs * 0.6} textAnchor="middle">
          Fußleistenausschnitt {fl.hoeheMm} × {fl.tiefeMm} mm
        </text>
      </g>
    )
  }
  return (
    <g className={styles.ausschnitt}>
      <rect x={0} y={Y(fl.hoeheMm)} width={m.breiteMm} height={fl.hoeheMm} {...LINIE} />
      <text x={m.breiteMm / 2} y={Y(fl.hoeheMm / 2) + fs * 0.25} fontSize={fs * 0.55} textAnchor="middle">
        Fußleistenausschnitt
      </text>
    </g>
  )
}
