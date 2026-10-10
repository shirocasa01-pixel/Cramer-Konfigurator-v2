import { useMemo, useState, type ReactNode } from 'react'
import type { Draft } from '../../types'
import { konstruktion, mmText, SCHIEBE_EBENE_MM, type Front2D, type Konstruktion2D as Modell } from '../../lib/konstruktion'
import styles from './Konstruktion2D.module.css'

/**
 * BEGLEITENDE 2D-KONSTRUKTIONSANSICHT (links neben dem Formular).
 *
 * Zwei Ansichten wie in der AV-Zeichnung von Cramer: Vorderansicht (Aufriss) mit Korpus-
 * Aufteilung, Fronten, Griffen und der Ausstattung hinter den Fronten samt Bodenhöhen, und
 * Draufsicht (Grundriss) mit Tiefe, Korpustrennungen, Wandabstand, Abschlusssets und
 * Verblendungen. Maßstäblich: Das SVG rechnet in Millimetern; nur Linien und Schrift haben
 * eine feste Bildschirmstärke.
 *
 * Die Geometrie kommt vollständig aus `lib/konstruktion.ts`.
 */

type Ansicht = 'vorne' | 'oben'

const LINIE = { vectorEffect: 'non-scaling-stroke' as const }

export function Konstruktion2D({ draft }: { draft: Draft }) {
  const [ansicht, setAnsicht] = useState<Ansicht>('vorne')
  const [frontenZeigen, setFrontenZeigen] = useState(true)
  const { korpusGrunddaten, fronts, seriesId, ausstattung } = draft
  const modell = useMemo(
    () => konstruktion({ korpusGrunddaten, fronts, seriesId, ausstattung }),
    [korpusGrunddaten, fronts, seriesId, ausstattung],
  )
  const hatFronten = Boolean(modell && modell.fronten.length > 0)

  return (
    <section className={styles.wrap} aria-label="2D-Konstruktionsansicht">
      <div className={styles.kopf}>
        <div className={styles.tabs} role="tablist" aria-label="Ansicht">
          {(
            [
              ['vorne', 'Vorderansicht'],
              ['oben', 'Draufsicht'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ansicht === id}
              className={ansicht === id ? styles.tabAktiv : styles.tab}
              onClick={() => setAnsicht(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {ansicht === 'vorne' && hatFronten ? (
          <label className={styles.schalter}>
            <input type="checkbox" checked={frontenZeigen} onChange={(e) => setFrontenZeigen(e.target.checked)} />
            Fronten
          </label>
        ) : null}
      </div>
      {modell ? (
        <>
          <div className={styles.buehne}>
            {ansicht === 'vorne' ? <Vorderansicht m={modell} fronten={frontenZeigen} /> : <Draufsicht m={modell} />}
          </div>
          <p className={styles.fuss}>
            Maßstäblich · Maße in mm · {modell.korpusse.length} {modell.korpusse.length === 1 ? 'Korpus' : 'Korpi'} ·
            B {mmText(modell.breiteMm)} × H {mmText(modell.hoeheMm)} × T {mmText(modell.tiefeMm)}
            {modell.wandabstandMm > 0 ? ` · ${mmText(modell.wandabstandMm)} mm Wandabstand (Kabelführung Beleuchtung)` : ''}
            {modell.schiebetueren > 0 ? ` · ${modell.schiebetueren} Schiebetüren, zwei Laufebenen` : ''}
          </p>
        </>
      ) : (
        <p className={styles.leer}>Sobald Höhe, Tiefe und jede Korpusbreite feststehen, erscheint hier die Skizze.</p>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------

/** Maßlinie mit Endstrichen und Text (horizontal oder vertikal). */
function Mass({ x1, y1, x2, y2, text, fs, seite = 1 }: { x1: number; y1: number; x2: number; y2: number; text: string; fs: number; seite?: 1 | -1 }) {
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
          <text x={mx} y={my - fs * 0.35 * seite + (seite < 0 ? fs * 0.7 : 0)} fontSize={fs} textAnchor="middle">
            {text}
          </text>
        </>
      ) : (
        <>
          <line x1={x1 - t} y1={y1} x2={x1 + t} y2={y1} {...LINIE} />
          <line x1={x2 - t} y1={y2} x2={x2 + t} y2={y2} {...LINIE} />
          <text x={mx - fs * 0.45 * seite} y={my} fontSize={fs} textAnchor="middle" transform={`rotate(-90 ${mx - fs * 0.45 * seite} ${my})`}>
            {text}
          </text>
        </>
      )}
    </g>
  )
}

function Zeichnung({ minX, minY, b, h, children, label }: { minX: number; minY: number; b: number; h: number; children: ReactNode; label: string }) {
  return (
    <svg className={styles.svg} viewBox={`${minX} ${minY} ${b} ${h}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {children}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Vorderansicht (Aufriss)
// ---------------------------------------------------------------------------

function Vorderansicht({ m, fronten }: { m: Modell; fronten: boolean }) {
  const H = m.hoeheMm
  const Y = (y: number) => H - y
  const gross = Math.max(m.breiteMm, m.hoeheMm)
  const fs = gross / 34
  const rand = fs * 5
  const vb = m.verblendung
  const vbL = vb?.links ? vb.mm : 0
  const vbR = vb?.rechts ? vb.mm : 0
  const vbO = vb?.oben ? vb.mm : 0

  return (
    <Zeichnung minX={-rand - vbL} minY={-rand - vbO} b={m.breiteMm + 2 * rand + vbL + vbR} h={H + 2 * rand + vbO} label="Vorderansicht">
      {/* Fußboden */}
      <line className={styles.boden} x1={-rand * 0.6 - vbL} y1={Y(0)} x2={m.breiteMm + rand * 0.6 + vbR} y2={Y(0)} {...LINIE} />

      {/* Verblendung */}
      {vb ? (
        <g className={styles.verblendung}>
          {vb.links ? <rect x={-vb.mm} y={Y(H + vbO)} width={vb.mm} height={H + vbO} {...LINIE} /> : null}
          {vb.rechts ? <rect x={m.breiteMm} y={Y(H + vbO)} width={vb.mm} height={H + vbO} {...LINIE} /> : null}
          {vb.oben ? <rect x={-vbL} y={Y(H + vb.mm)} width={m.breiteMm + vbL + vbR} height={vb.mm} {...LINIE} /> : null}
        </g>
      ) : null}

      {/* Abschlusssets */}
      {m.abschluss.links ? <rect className={styles.abschluss} x={0} y={Y(H)} width={m.abschluss.links} height={H} {...LINIE} /> : null}
      {m.abschluss.rechts ? (
        <rect className={styles.abschluss} x={m.breiteMm - m.abschluss.rechts} y={Y(H)} width={m.abschluss.rechts} height={H} {...LINIE} />
      ) : null}

      {/* Korpi mit Seiten, Boden, Deckel, Sockel */}
      {m.korpusse.map((k) => (
        <g key={k.index} className={styles.korpus}>
          <rect x={k.x} y={Y(H)} width={k.b} height={H} {...LINIE} />
          <rect className={styles.innen} x={k.x + m.plattenMm} y={Y(H - m.plattenMm)} width={k.b - 2 * m.plattenMm} height={H - m.plattenMm - m.innenBodenMm} {...LINIE} />
          {m.sockelMm > 0 ? <line x1={k.x} y1={Y(m.sockelMm)} x2={k.x + k.b} y2={Y(m.sockelMm)} {...LINIE} /> : null}
        </g>
      ))}

      {/* Ausstattung */}
      {m.ausstattung.map((a, i) => {
        const hinweise = m.ausstattung.filter((x) => x.korpus === a.korpus && x.art === 'hinweis')
        switch (a.art) {
          case 'boden':
          case 'glasboden':
            return (
              <g key={i}>
                <rect className={a.art === 'glasboden' ? styles.glas : styles.fachboden} x={a.x} y={Y(a.y + m.plattenMm)} width={a.b} height={m.plattenMm} {...LINIE} />
                <text className={styles.hoehe} x={a.x + fs * 0.3} y={Y(a.y + m.plattenMm) - fs * 0.25} fontSize={fs * 0.72}>
                  {mmText(a.hoeheMm ?? a.y)}
                </text>
              </g>
            )
          case 'kleiderstange':
            return <line key={i} className={styles.stange} x1={a.x} y1={Y(a.y)} x2={a.x + a.b} y2={Y(a.y)} {...LINIE} />
          case 'container':
          case 'innenschublade':
          case 'rollkorb':
          case 'rollboden':
            return (
              <g key={i} className={styles.einbau}>
                <rect x={a.x + 6} y={Y(a.y + Math.max(a.h, 40))} width={a.b - 12} height={Math.max(a.h, 40)} {...LINIE} />
                <text x={a.x + a.b / 2} y={Y(a.y + Math.max(a.h, 40) / 2) + fs * 0.3} fontSize={fs * 0.7} textAnchor="middle">
                  {a.label}
                </text>
              </g>
            )
          case 'led-deckel':
            return (
              <g key={i} className={styles.led}>
                <line x1={a.x + 10} y1={Y(a.y)} x2={a.x + a.b - 10} y2={Y(a.y)} {...LINIE} />
                <text x={a.x + a.b / 2} y={Y(a.y) + fs * 0.9} fontSize={fs * 0.7} textAnchor="middle">
                  ‹— LED —›
                </text>
              </g>
            )
          case 'led-seite':
            return <line key={i} className={styles.led} x1={a.x} y1={Y(a.y)} x2={a.x} y2={Y(a.y + a.h)} {...LINIE} />
          case 'hinweis': {
            const n = hinweise.indexOf(a)
            return (
              <text key={i} className={styles.hinweis} x={a.x + a.b / 2} y={Y(m.innenBodenMm) - fs * (0.6 + n * 1.1)} fontSize={fs * 0.68} textAnchor="middle">
                {a.label}
              </text>
            )
          }
          default:
            return null
        }
      })}

      {/* Fronten (halbtransparent, damit die Ausstattung sichtbar bleibt) */}
      {fronten ? m.fronten.map((f, i) => <FrontVorne key={i} f={f} Y={Y} fs={fs} />) : null}

      {/* Korpus-Nennbreiten unter dem Schrank */}
      {m.korpusse.map((k) => (
        <text key={k.index} className={styles.korpusLabel} x={k.x + k.b / 2} y={Y(0) + fs * 1.3} fontSize={fs * 0.85} textAnchor="middle">
          {String(k.nennCm).replace('.', ',')}er
        </text>
      ))}

      {/* Maßketten: Korpusbreiten, Gesamtbreite, Höhe */}
      {m.korpusse.map((k) => (
        <Mass key={k.index} x1={k.x} y1={Y(H) - rand * 0.35 - vbO} x2={k.x + k.b} y2={Y(H) - rand * 0.35 - vbO} text={mmText(k.b)} fs={fs * 0.8} />
      ))}
      <Mass x1={0} y1={Y(H) - rand * 0.78 - vbO} x2={m.breiteMm} y2={Y(H) - rand * 0.78 - vbO} text={mmText(m.breiteMm)} fs={fs * 0.9} />
      <Mass x1={m.breiteMm + vbR + rand * 0.45} y1={Y(0)} x2={m.breiteMm + vbR + rand * 0.45} y2={Y(H)} text={mmText(H)} fs={fs * 0.9} seite={1} />
    </Zeichnung>
  )
}

function FrontVorne({ f, Y, fs }: { f: Front2D; Y: (y: number) => number; fs: number }) {
  const oben = Y(f.y + f.h)
  const unten = Y(f.y)
  const klasse =
    f.art === 'schiebetuer' ? (f.ebene === 1 ? styles.schiebeVorne : styles.schiebeHinten) : f.art === 'offen' ? styles.offen : styles.front
  const griffLaenge = Math.min(400, f.h / 3)
  return (
    <g>
      <rect className={klasse} x={f.x} y={oben} width={f.b} height={f.h} {...LINIE} />
      {f.art === 'drehtuer' ? (
        <>
          {/* Öffnungslinien: Spitze an der Bandseite */}
          <polyline
            className={styles.oeffnung}
            points={
              f.anschlag === 'rechts'
                ? `${f.x},${oben} ${f.x + f.b},${(oben + unten) / 2} ${f.x},${unten}`
                : `${f.x + f.b},${oben} ${f.x},${(oben + unten) / 2} ${f.x + f.b},${unten}`
            }
            {...LINIE}
          />
          <line
            className={styles.griff}
            x1={f.anschlag === 'rechts' ? f.x + 35 : f.x + f.b - 35}
            y1={(oben + unten) / 2 - griffLaenge / 2}
            x2={f.anschlag === 'rechts' ? f.x + 35 : f.x + f.b - 35}
            y2={(oben + unten) / 2 + griffLaenge / 2}
            {...LINIE}
          />
        </>
      ) : null}
      {f.art === 'schublade' || f.art === 'klappe' ? (
        <line className={styles.griff} x1={f.x + f.b / 2 - Math.min(150, f.b / 4)} y1={oben + Math.min(40, f.h / 4)} x2={f.x + f.b / 2 + Math.min(150, f.b / 4)} y2={oben + Math.min(40, f.h / 4)} {...LINIE} />
      ) : null}
      {f.art === 'schiebetuer' ? (
        <text className={styles.frontLabel} x={f.x + f.b / 2} y={(oben + unten) / 2} fontSize={fs * 0.9} textAnchor="middle">
          ⇆
        </text>
      ) : null}
      {f.label ? (
        <text className={styles.frontLabel} x={f.x + f.b / 2} y={unten - fs * 0.5} fontSize={fs * 0.75} textAnchor="middle">
          {f.label}
        </text>
      ) : null}
    </g>
  )
}

// ---------------------------------------------------------------------------
// Draufsicht (Grundriss)
// ---------------------------------------------------------------------------

function Draufsicht({ m }: { m: Modell }) {
  const gross = Math.max(m.breiteMm, m.tiefeMm * 2)
  const fs = gross / 34
  const rand = fs * 5
  const wand = m.wandabstandMm
  const vorne = wand + m.tiefeMm
  const schiebe = m.schiebetueren > 0
  const frontTiefe = schiebe ? 2 * SCHIEBE_EBENE_MM : m.frontMm
  const tueren = m.fronten.filter((f) => f.art === 'drehtuer')
  // Eine Tür je x-Bereich genügt (übereinanderliegende Fronten fallen im Grundriss zusammen).
  const breitesteJeX = [...new Map(m.fronten.map((f) => [`${f.x}|${f.b}`, f])).values()]
  const maxBogen = tueren.reduce((s, t) => Math.max(s, t.b), 0)
  const vb = m.verblendung
  const vbL = vb?.links ? vb.mm : 0
  const vbR = vb?.rechts ? vb.mm : 0
  const vbTiefe = vb?.art === 'frontbuendig' ? m.tiefeMm + frontTiefe : m.tiefeMm
  const stangen = new Set(m.ausstattung.filter((a) => a.art === 'kleiderstange').map((a) => a.korpus))
  const container = m.ausstattung.filter((a) => a.art === 'container' || a.art === 'innenschublade')
  const ledSeiten = m.ausstattung.filter((a) => a.art === 'led-seite')
  const hoeheGesamt = vorne + frontTiefe + Math.max(maxBogen * 0.75, rand)

  return (
    <Zeichnung minX={-rand - vbL} minY={-rand} b={m.breiteMm + 2 * rand + vbL + vbR} h={hoeheGesamt + 2 * rand} label="Draufsicht">
      {/* Wand */}
      <rect className={styles.wand} x={-rand * 0.6 - vbL} y={-fs * 0.8} width={m.breiteMm + rand * 1.2 + vbL + vbR} height={fs * 0.8} />
      <line className={styles.boden} x1={-rand * 0.6 - vbL} y1={0} x2={m.breiteMm + rand * 0.6 + vbR} y2={0} {...LINIE} />

      {/* Verblendung */}
      {vb ? (
        <g className={styles.verblendung}>
          {vb.links ? <rect x={-vb.mm} y={wand} width={vb.mm} height={vbTiefe} {...LINIE} /> : null}
          {vb.rechts ? <rect x={m.breiteMm} y={wand} width={vb.mm} height={vbTiefe} {...LINIE} /> : null}
        </g>
      ) : null}

      {/* Abschlusssets */}
      {m.abschluss.links ? <rect className={styles.abschluss} x={0} y={wand} width={m.abschluss.links} height={m.tiefeMm} {...LINIE} /> : null}
      {m.abschluss.rechts ? (
        <rect className={styles.abschluss} x={m.breiteMm - m.abschluss.rechts} y={wand} width={m.abschluss.rechts} height={m.tiefeMm} {...LINIE} />
      ) : null}

      {/* Korpi: Seiten, Rückwand */}
      {m.korpusse.map((k) => (
        <g key={k.index} className={styles.korpus}>
          <rect x={k.x} y={wand} width={k.b} height={m.tiefeMm} {...LINIE} />
          <rect className={styles.innen} x={k.x + m.plattenMm} y={wand + 8} width={k.b - 2 * m.plattenMm} height={m.tiefeMm - 8} {...LINIE} />
          {stangen.has(k.index) ? (
            <line className={styles.stange} x1={k.x + m.plattenMm + 20} y1={wand + m.tiefeMm / 2} x2={k.x + k.b - m.plattenMm - 20} y2={wand + m.tiefeMm / 2} {...LINIE} />
          ) : null}
          <text className={styles.korpusLabel} x={k.x + k.b / 2} y={wand + m.tiefeMm / 2 - fs * 0.5} fontSize={fs * 0.85} textAnchor="middle">
            {String(k.nennCm).replace('.', ',')}er
          </text>
        </g>
      ))}

      {/* Container / Innenschubladen als Grundfläche (gestrichelt) */}
      {container.map((c, i) => (
        <rect key={i} className={styles.verdeckt} x={c.x + 6} y={wand + 30} width={c.b - 12} height={m.tiefeMm - 60} {...LINIE} />
      ))}
      {ledSeiten.map((l, i) => (
        <circle key={i} className={styles.ledPunkt} cx={l.x} cy={vorne - 25} r={fs * 0.25} />
      ))}

      {/* Fußleistenausschnitt (an der Wand, unten) */}
      {m.fussleiste ? (
        <g className={styles.verdeckt}>
          <line x1={0} y1={wand + m.fussleiste.tiefeMm} x2={m.breiteMm} y2={wand + m.fussleiste.tiefeMm} {...LINIE} />
          <text x={m.breiteMm / 2} y={wand + m.fussleiste.tiefeMm + fs * 0.9} fontSize={fs * 0.65} textAnchor="middle">
            Fußleistenausschnitt
          </text>
        </g>
      ) : null}

      {/* Fronten */}
      {schiebe
        ? m.fronten.map((f, i) => (
            <rect
              key={i}
              className={f.ebene === 1 ? styles.schiebeVorne : styles.schiebeHinten}
              x={f.x}
              y={vorne + (f.ebene === 1 ? SCHIEBE_EBENE_MM : 0)}
              width={f.b}
              height={m.frontMm}
              {...LINIE}
            />
          ))
        : breitesteJeX
            .filter((f) => f.art !== 'offen')
            .map((f, i) => <rect key={i} className={styles.front} x={f.x} y={vorne} width={f.b} height={m.frontMm} {...LINIE} />)}
      {/* Öffnungsbögen der Drehtüren (nur die unterste Tür je Feld) */}
      {[...new Map(tueren.map((t) => [`${t.x}|${t.b}`, t])).values()].map((t, i) => {
        const bandX = t.anschlag === 'rechts' ? t.x + t.b : t.x
        const ende = t.anschlag === 'rechts' ? t.x : t.x + t.b
        const y0 = vorne + m.frontMm
        return (
          <g key={i}>
            <path className={styles.bogen} d={`M ${ende} ${y0} A ${t.b} ${t.b} 0 0 ${t.anschlag === 'rechts' ? 0 : 1} ${bandX} ${y0 + t.b}`} {...LINIE} />
            {/* geöffnetes Türblatt */}
            <line className={styles.bogen} x1={bandX} y1={y0} x2={bandX} y2={y0 + t.b} {...LINIE} />
          </g>
        )
      })}

      {/* Maße: Korpusbreiten, Gesamtbreite, Tiefe, Wandabstand */}
      {m.korpusse.map((k) => (
        <Mass key={k.index} x1={k.x} y1={-rand * 0.35} x2={k.x + k.b} y2={-rand * 0.35} text={mmText(k.b)} fs={fs * 0.8} />
      ))}
      <Mass x1={0} y1={-rand * 0.78} x2={m.breiteMm} y2={-rand * 0.78} text={mmText(m.breiteMm)} fs={fs * 0.9} />
      <Mass x1={m.breiteMm + vbR + rand * 0.45} y1={wand} x2={m.breiteMm + vbR + rand * 0.45} y2={vorne} text={mmText(m.tiefeMm)} fs={fs * 0.85} />
      <Mass
        x1={m.breiteMm + vbR + rand * 0.8}
        y1={0}
        x2={m.breiteMm + vbR + rand * 0.8}
        y2={vorne + frontTiefe}
        text={mmText(vorne + frontTiefe)}
        fs={fs * 0.85}
      />
    </Zeichnung>
  )
}
