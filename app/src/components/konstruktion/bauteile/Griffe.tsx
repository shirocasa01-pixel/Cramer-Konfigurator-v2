import { KONSTRUKTION as K } from '../../../config/konstruktionsParameter'
import type { Front2D, GriffForm } from '../../../lib/konstruktion'
import styles from '../Konstruktion2D.module.css'
import { LINIE, type Zeichenkontext } from './kontext'

/**
 * GRIFFE als vereinfachte 2D-Silhouetten (Preisliste S. 3, Griffe/Schlösser):
 *
 *   Bügelgriff  Nr. 90/91, 103, 105, 120–124   Stange mit zwei Füßen, Länge laut Liste
 *   Knopf       Nr. 19                         Kreis
 *   Kantengriff Nr. 125/126                    Profil an der Kante (Tür: Schließkante, Schub: oben)
 *   Griffleiste Nr. 127                        schmale Leiste 200 mm (nur Glastüren)
 *   Muschel     Nr. 128                        abgerundete Schale 105,5 × 37 mm
 *   Edge                                       Stahlprofil an der Schließkante, volle Höhe oder gekürzt
 *   Line / 107 / Curve                         Griffleiste der Stil-Linie entlang der Kante
 *   PTO                                        Push-to-open, kein Griff (Kennzeichnung)
 *
 * Türen und einläufige Schiebetüren: Griff an der Schließkante, Höhe nach
 * `KONSTRUKTION.griffhoeheTuer`. Schübe und Klappen: oben mittig.
 */
export function Griff({ k, f }: { k: Zeichenkontext; f: Front2D }) {
  const form = f.griff
  if (!form) return null
  const { Y, X, fs } = k
  const fx = X(f.x, f.b)
  const oben = Y(f.y + f.h)
  const unten = Y(f.y)
  const horizontal = f.art === 'schublade' || f.art === 'klappe'
  // Schließkante: gegenüber dem Band. In der gespiegelten Ansicht stimmt X bereits.
  const rechts = f.anschlag !== 'rechts'
  const kanteX = rechts ? fx + f.b : fx
  const innenX = (abstand: number) => (rechts ? kanteX - abstand : kanteX + abstand)
  const cy = Y(f.griffY ?? f.y + f.h / 2)
  const cx = horizontal ? fx + f.b / 2 : innenX(K.griffKantenabstandMm)

  const stange = (laenge: number, staerke = 12) =>
    horizontal ? (
      <g className={styles.griffKoerper}>
        <rect x={cx - laenge / 2} y={oben + K.griffSchubVonObenMm - staerke / 2} width={laenge} height={staerke} rx={staerke / 2} {...LINIE} />
      </g>
    ) : (
      <g className={styles.griffKoerper}>
        <rect x={cx - staerke / 2} y={cy - laenge / 2} width={staerke} height={laenge} rx={staerke / 2} {...LINIE} />
      </g>
    )

  return <g aria-hidden="true">{zeichne(form)}</g>

  function zeichne(g: GriffForm) {
    switch (g.art) {
      case 'buegel':
        return stange(g.laengeMm)
      case 'leiste':
        return stange(g.laengeMm, 10)
      case 'knopf':
        return <circle className={styles.griffKoerper} cx={cx} cy={horizontal ? oben + K.griffSchubVonObenMm : cy} r={15} {...LINIE} />
      case 'muschel':
        return horizontal ? (
          <rect className={styles.griffKoerper} x={cx - 53} y={oben + K.griffSchubVonObenMm - 18} width={105} height={37} rx={18} {...LINIE} />
        ) : (
          <rect className={styles.griffKoerper} x={cx - 18} y={cy - 53} width={37} height={105} rx={18} {...LINIE} />
        )
      case 'kante':
        return horizontal ? (
          <rect className={styles.griffKoerper} x={cx - g.laengeMm / 2} y={oben} width={g.laengeMm} height={14} {...LINIE} />
        ) : (
          <rect className={styles.griffKoerper} x={rechts ? kanteX - 14 : kanteX} y={cy - g.laengeMm / 2} width={14} height={g.laengeMm} {...LINIE} />
        )
      case 'edge': {
        const laenge = g.laengeMm != null ? Math.min(g.laengeMm, f.h) : f.h
        const y0 = g.laengeMm != null ? cy - laenge / 2 : oben
        return <rect className={styles.griffKoerper} x={rechts ? kanteX - K.edgeBreiteMm : kanteX} y={Math.max(oben, y0)} width={K.edgeBreiteMm} height={laenge} {...LINIE} />
      }
      case 'profil':
        if (g.stil === 'curve') {
          // Gebogene Griffkante: flacher Bogen entlang der Schließkante.
          const d = rechts
            ? `M ${kanteX} ${oben} Q ${kanteX - 45} ${(oben + unten) / 2} ${kanteX} ${unten}`
            : `M ${kanteX} ${oben} Q ${kanteX + 45} ${(oben + unten) / 2} ${kanteX} ${unten}`
          return horizontal ? <path className={styles.griffProfil} d={`M ${fx} ${oben} Q ${fx + f.b / 2} ${oben + 45} ${fx + f.b} ${oben}`} {...LINIE} /> : <path className={styles.griffProfil} d={d} {...LINIE} />
        }
        // Line: Aufkantung (Glasleiste); 107: gepulverte Griffleiste.
        return horizontal ? (
          <rect className={g.stil === 'line' ? styles.griffGlas : styles.griffKoerper} x={fx} y={oben} width={f.b} height={g.stil === 'line' ? 30 : 22} {...LINIE} />
        ) : (
          <rect className={g.stil === 'line' ? styles.griffGlas : styles.griffKoerper} x={rechts ? kanteX - (g.stil === 'line' ? 30 : 22) : kanteX} y={oben} width={g.stil === 'line' ? 30 : 22} height={f.h} {...LINIE} />
        )
      case 'sonder':
        return (
          <g className={styles.griffSonder}>
            <circle cx={cx} cy={horizontal ? oben + K.griffSchubVonObenMm : cy} r={28} {...LINIE} />
            <text x={cx} y={(horizontal ? oben + K.griffSchubVonObenMm : cy) + fs * 0.22} fontSize={fs * 0.6} textAnchor="middle">
              ?
            </text>
          </g>
        )
      case 'pto':
        return (
          <text className={styles.pto} x={horizontal ? cx : innenX(70)} y={horizontal ? oben + fs * 0.9 : cy} fontSize={fs * 0.5} textAnchor="middle">
            PTO
          </text>
        )
    }
  }
}
