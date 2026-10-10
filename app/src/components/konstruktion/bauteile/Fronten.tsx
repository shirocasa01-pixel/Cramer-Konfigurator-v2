import { KONSTRUKTION as K } from '../../../config/konstruktionsParameter'
import type { Front2D } from '../../../lib/konstruktion'
import styles from '../Konstruktion2D.module.css'
import { Griff } from './Griffe'
import { LINIE, type Zeichenkontext } from './kontext'

/**
 * FRONTEN — Drehtür, Schub, Klappe, Schiebetür (ein- und zweiläufig), offenes Fach.
 *
 * Geschlossen: Fläche mit Fugen, Öffnungslinien der Drehtür (Spitze zur Bandseite), Griff.
 * Geist (Innenansicht): nur die gestrichelte Kontur, damit die Ausstattung sichtbar ist.
 * Grundriss: Frontstärke vor dem Korpus, Öffnungsbogen der Drehtür, Laufebenen der
 * zweiläufigen Schiebetür.
 */
export function FrontGeschlossen({ k, f }: { k: Zeichenkontext; f: Front2D }) {
  const { Y, X, fs } = k
  const x = X(f.x, f.b)
  const oben = Y(f.y + f.h)
  const unten = Y(f.y)
  if (f.art === 'offen') {
    return (
      <g>
        <rect className={styles.offen} x={x} y={oben} width={f.b} height={f.h} {...LINIE} />
        {f.label ? <FrontLabel x={x + f.b / 2} y={unten - fs * 0.5} fs={fs} text={`${f.label} · offen`} /> : null}
      </g>
    )
  }
  const klasse = f.art === 'schiebetuer' ? (f.ebene === 1 ? styles.schiebeVorne : styles.schiebeHinten) : styles.frontVoll
  // Bandseite rechts → Spitze rechts. In der Ansicht von vorne gilt das wörtlich.
  const bandRechts = f.anschlag === 'rechts'
  return (
    <g>
      <rect className={klasse} x={x} y={oben} width={f.b} height={f.h} {...LINIE} />
      {f.art === 'drehtuer' ? (
        <polyline
          className={styles.oeffnung}
          points={bandRechts ? `${x},${oben} ${x + f.b},${(oben + unten) / 2} ${x},${unten}` : `${x + f.b},${oben} ${x},${(oben + unten) / 2} ${x + f.b},${unten}`}
          {...LINIE}
        />
      ) : null}
      {f.art === 'schiebetuer' ? (
        <text className={styles.frontLabel} x={x + f.b / 2} y={(oben + unten) / 2} fontSize={fs * 0.9} textAnchor="middle">
          ⇆
        </text>
      ) : null}
      <Griff k={k} f={f} />
      {f.label ? <FrontLabel x={x + f.b / 2} y={unten - fs * 0.5} fs={fs} text={f.label} /> : null}
    </g>
  )
}

export function FrontGeist({ k, f }: { k: Zeichenkontext; f: Front2D }) {
  const { Y, X, fs } = k
  const x = X(f.x, f.b)
  return (
    <g className={styles.geist}>
      <rect x={x} y={Y(f.y + f.h)} width={f.b} height={f.h} {...LINIE} />
      {f.label ? (
        <text x={x + f.b - fs * 0.3} y={Y(f.y + f.h) + fs * 0.75} fontSize={fs * 0.55} textAnchor="end">
          {f.label}
        </text>
      ) : null}
    </g>
  )
}

function FrontLabel({ x, y, fs, text }: { x: number; y: number; fs: number; text: string }) {
  return (
    <text className={styles.frontLabel} x={x} y={y} fontSize={fs * 0.7} textAnchor="middle">
      {text}
    </text>
  )
}

/** Grundriss: eine Front je x-Bereich, Drehtüren mit Öffnungsbogen und offenem Türblatt. */
export function FrontenOben({ k, vorne }: { k: Zeichenkontext; vorne: number }) {
  const { m, X } = k
  if (m.schiebetueren > 0) {
    return (
      <>
        {m.fronten.map((f, i) => (
          <rect key={i} className={f.ebene === 1 ? styles.schiebeVorne : styles.schiebeHinten} x={X(f.x, f.b)} y={vorne + (f.ebene === 1 ? K.schiebeEbeneMm : 0)} width={f.b} height={K.frontMm} {...LINIE} />
        ))}
      </>
    )
  }
  const jeFeld = [...new Map(m.fronten.filter((f) => f.art !== 'offen').map((f) => [`${f.x}|${f.b}`, f])).values()]
  return (
    <>
      {jeFeld.map((f, i) => (
        <rect key={`f${i}`} className={styles.frontVoll} x={X(f.x, f.b)} y={vorne} width={f.b} height={K.frontMm} {...LINIE} />
      ))}
      {jeFeld
        .filter((f) => f.art === 'drehtuer')
        .map((t, i) => {
          const x = X(t.x, t.b)
          const bandX = t.anschlag === 'rechts' ? x + t.b : x
          const ende = t.anschlag === 'rechts' ? x : x + t.b
          const y0 = vorne + K.frontMm
          return (
            <g key={`b${i}`}>
              <path className={styles.bogen} d={`M ${ende} ${y0} A ${t.b} ${t.b} 0 0 ${t.anschlag === 'rechts' ? 0 : 1} ${bandX} ${y0 + t.b}`} {...LINIE} />
              <line className={styles.bogen} x1={bandX} y1={y0} x2={bandX} y2={y0 + t.b} {...LINIE} />
            </g>
          )
        })}
    </>
  )
}
