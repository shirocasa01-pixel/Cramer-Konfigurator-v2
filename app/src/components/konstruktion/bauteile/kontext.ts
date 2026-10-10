import type { Konstruktion2D } from '../../../lib/konstruktion'

/**
 * Was jedes Bauteil zum Zeichnen braucht. Die Bauteile rechnen in Millimetern des Modells;
 * `Y` dreht die Höhe (SVG zählt von oben), `X` spiegelt in der Rückansicht.
 */
export interface Zeichenkontext {
  m: Konstruktion2D
  /** Höhe über dem Fußboden → SVG-y. */
  Y: (y: number) => number
  /** Linke Kante eines Bauteils der Breite `b` → SVG-x (Rückansicht: gespiegelt). */
  X: (x: number, b?: number) => number
  /** Schriftgröße in Modell-mm. */
  fs: number
}

/** Linien behalten ihre Bildschirmstärke, egal wie groß die Zeichnung ist. */
export const LINIE = { vectorEffect: 'non-scaling-stroke' as const }

export function normalerKontext(m: Konstruktion2D, fs: number): Zeichenkontext {
  return { m, fs, Y: (y) => m.hoeheMm - y, X: (x) => x }
}

export function gespiegelterKontext(m: Konstruktion2D, fs: number): Zeichenkontext {
  return { m, fs, Y: (y) => m.hoeheMm - y, X: (x, b = 0) => m.breiteMm - x - b }
}
