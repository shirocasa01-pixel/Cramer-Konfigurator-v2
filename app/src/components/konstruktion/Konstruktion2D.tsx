import { useMemo, useState, type ReactNode } from 'react'
import { KONSTRUKTION as K } from '../../config/konstruktionsParameter'
import type { Draft } from '../../types'
import { konstruktion, mmText, type Konstruktion2D as Modell } from '../../lib/konstruktion'
import { AUSSTATTUNG } from './bauteile/Ausstattung'
import { FrontGeist, FrontGeschlossen, FrontenOben } from './bauteile/Fronten'
import { Abschlusssets, Fussleiste, KorpusHinten, KorpusOben, KorpusVorne, Verblendung } from './bauteile/Korpus'
import { BreitenKette, Mass, Rasterleiste } from './bauteile/Masse'
import { LINIE, gespiegelterKontext, normalerKontext, type Zeichenkontext } from './bauteile/kontext'
import styles from './Konstruktion2D.module.css'

/**
 * BEGLEITENDE 2D-KONSTRUKTIONSANSICHT (links neben dem Formular).
 *
 * Vier Ansichten wie in der AV-Zeichnung von Cramer, alle maßstäblich in Millimetern:
 *   Vorderansicht  geschlossen — Korpi, Fronten mit Fugen, Griffe, Sockel
 *   Innenansicht   Fronten als Kontur, Ausstattung mit Höhen, Rasterleiste, Außenschübe
 *   Draufsicht     Tiefe, Korpustrennungen, Wandabstand, Verblendung, Fußleiste, Türbögen
 *   Rückansicht    Rückwand je Korpus, Lochreihe, Bodenträger, Ausschnitte (von hinten gesehen)
 *
 * Das Modell kommt aus `lib/konstruktion.ts`, jedes Bauteil aus `bauteile/`.
 */

type Ansicht = 'vorne' | 'innen' | 'oben' | 'hinten'

const ANSICHTEN: Array<[Ansicht, string]> = [
  ['vorne', 'Vorderansicht'],
  ['innen', 'Innenansicht'],
  ['oben', 'Draufsicht'],
  ['hinten', 'Rückansicht'],
]

export function Konstruktion2D({ draft }: { draft: Draft }) {
  const [ansicht, setAnsicht] = useState<Ansicht>('vorne')
  const { korpusGrunddaten, fronts, seriesId, ausstattung, sichtRueckwandAussen } = draft
  const modell = useMemo(
    () => konstruktion({ korpusGrunddaten, fronts, seriesId, ausstattung, sichtRueckwandAussen }),
    [korpusGrunddaten, fronts, seriesId, ausstattung, sichtRueckwandAussen],
  )

  return (
    <section className={styles.wrap} aria-label="2D-Konstruktionsansicht">
      <div className={styles.tabs} role="tablist" aria-label="Ansicht">
        {ANSICHTEN.map(([id, label]) => (
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
      {modell ? (
        <>
          <div className={styles.buehne}>
            {ansicht === 'vorne' ? <Vorderansicht m={modell} /> : null}
            {ansicht === 'innen' ? <Innenansicht m={modell} /> : null}
            {ansicht === 'oben' ? <Draufsicht m={modell} /> : null}
            {ansicht === 'hinten' ? <Rueckansicht m={modell} /> : null}
          </div>
          <p className={styles.fuss}>
            Maßstäblich · Maße in mm · {modell.korpusse.length} {modell.korpusse.length === 1 ? 'Korpus' : 'Korpi'} · B{' '}
            {mmText(modell.breiteMm)} × H {mmText(modell.hoeheMm)} × T {mmText(modell.tiefeMm)}
            {modell.wandabstandMm > 0 ? ` · ${mmText(modell.wandabstandMm)} mm Wandabstand (Kabelführung Beleuchtung)` : ''}
            {modell.schiebetueren > 0 ? ` · ${modell.schiebetueren} Schiebetüren, zwei Laufebenen` : ''}
            {ansicht === 'vorne' && modell.fronten.length === 0 ? ' · noch keine Fronten geplant' : ''}
          </p>
          {modell.hinweise.length > 0 && (ansicht === 'innen' || ansicht === 'vorne') ? (
            <ul className={styles.hinweisListe}>
              {modell.hinweise.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className={styles.leer}>Sobald Höhe, Tiefe und jede Korpusbreite feststehen, erscheint hier die Skizze.</p>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------

function Zeichnung({ minX, minY, b, h, children, label }: { minX: number; minY: number; b: number; h: number; children: ReactNode; label: string }) {
  return (
    <svg className={styles.svg} viewBox={`${minX} ${minY} ${b} ${h}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      {children}
    </svg>
  )
}

function rahmenVorne(m: Modell) {
  const fs = Math.max(m.breiteMm, m.hoeheMm) / 34
  const rand = fs * 5
  const v = m.verblendung
  return { fs, rand, vbL: v?.links ? v.mm : 0, vbR: v?.rechts ? v.mm : 0, vbO: v?.oben ? v.mm : 0 }
}

/** Gemeinsamer Rahmen der Ansichten von vorne/hinten: Fußboden, Maßketten, Nennbreiten. */
function Rahmen({ k, rand, vbL, vbR, vbO, children }: { k: Zeichenkontext; rand: number; vbL: number; vbR: number; vbO: number; children: ReactNode }) {
  const { m, Y, X, fs } = k
  return (
    <>
      <line className={styles.boden} x1={-rand * 0.6 - vbL} y1={Y(0)} x2={m.breiteMm + rand * 0.6 + vbR} y2={Y(0)} {...LINIE} />
      {children}
      {m.korpusse.map((korpus) => (
        <text key={korpus.index} className={styles.korpusLabel} x={X(korpus.x, korpus.b) + korpus.b / 2} y={Y(0) + fs * 1.3} fontSize={fs * 0.85} textAnchor="middle">
          {String(korpus.nennCm).replace('.', ',')}er
        </text>
      ))}
      <g transform={`translate(0 ${Y(m.hoeheMm) - vbO})`}>
        <BreitenKette k={k} abstand={rand} />
      </g>
      <Mass x1={m.breiteMm + vbR + rand * 0.45} y1={Y(0)} x2={m.breiteMm + vbR + rand * 0.45} y2={Y(m.hoeheMm)} text={mmText(m.hoeheMm)} fs={fs * 0.9} />
    </>
  )
}

function Vorderansicht({ m }: { m: Modell }) {
  const { fs, rand, vbL, vbR, vbO } = rahmenVorne(m)
  const k = normalerKontext(m, fs)
  return (
    <Zeichnung minX={-rand - vbL} minY={-rand - vbO} b={m.breiteMm + 2 * rand + vbL + vbR} h={m.hoeheMm + 2 * rand + vbO} label="Vorderansicht">
      <Rahmen k={k} rand={rand} vbL={vbL} vbR={vbR} vbO={vbO}>
        <Verblendung k={k} ansicht="vorne" />
        <Abschlusssets k={k} ansicht="vorne" />
        {m.korpusse.map((korpus) => (
          <KorpusVorne key={korpus.index} k={k} korpus={korpus} innen={m.fronten.length === 0} />
        ))}
        {m.fronten.map((f, i) => (
          <FrontGeschlossen key={i} k={k} f={f} />
        ))}
      </Rahmen>
    </Zeichnung>
  )
}

function Innenansicht({ m }: { m: Modell }) {
  const { fs, rand, vbL, vbR, vbO } = rahmenVorne(m)
  const k = normalerKontext(m, fs)
  return (
    <Zeichnung minX={-rand - vbL} minY={-rand - vbO} b={m.breiteMm + 2 * rand + vbL + vbR} h={m.hoeheMm + 2 * rand + vbO} label="Innenansicht">
      <Rahmen k={k} rand={rand} vbL={vbL} vbR={vbR} vbO={vbO}>
        <Abschlusssets k={k} ansicht="vorne" />
        {m.korpusse.map((korpus) => (
          <g key={korpus.index}>
            <KorpusVorne k={k} korpus={korpus} innen />
            <Rasterleiste k={k} korpus={korpus} />
          </g>
        ))}
        {m.ausstattung
          .filter((a) => a.art !== 'hinweis')
          .map((a, i) => (
            <g key={i}>{AUSSTATTUNG[a.art].innen(a, k, { vorne: 0, wand: 0, index: 0 })}</g>
          ))}
        {/* Teile ohne eigene Zeichnung (Krawattenspange, Spiegel …): gesammelt in der Sockelzone. */}
        {m.korpusse.map((korpus) => {
          const namen = m.ausstattung.filter((a) => a.art === 'hinweis' && a.korpus === korpus.index).map((a) => a.label)
          if (namen.length === 0) return null
          const erster = m.ausstattung.find((a) => a.art === 'hinweis' && a.korpus === korpus.index)!
          return <g key={`h${korpus.index}`}>{AUSSTATTUNG.hinweis.innen({ ...erster, label: `+ ${namen.join(' · ')}` }, k, { vorne: 0, wand: 0, index: 0 })}</g>
        })}
        {m.fronten.map((f, i) => (
          <FrontGeist key={i} k={k} f={f} />
        ))}
      </Rahmen>
    </Zeichnung>
  )
}

function Draufsicht({ m }: { m: Modell }) {
  const fs = Math.max(m.breiteMm, m.tiefeMm * 2) / 34
  const rand = fs * 5
  const k = normalerKontext(m, fs)
  const wand = m.wandabstandMm
  const vorne = wand + m.tiefeMm
  const frontTiefe = m.schiebetueren > 0 ? K.schiebeEbeneMm + K.frontMm : K.frontMm
  const maxBogen = m.fronten.filter((f) => f.art === 'drehtuer').reduce((s, t) => Math.max(s, t.b), 0)
  const vbL = m.verblendung?.links ? m.verblendung.mm : 0
  const vbR = m.verblendung?.rechts ? m.verblendung.mm : 0
  const hoehe = vorne + frontTiefe + Math.max(maxBogen * 0.75, rand)
  return (
    <Zeichnung minX={-rand - vbL} minY={-rand} b={m.breiteMm + 2 * rand + vbL + vbR} h={hoehe + 2 * rand} label="Draufsicht">
      <rect className={styles.wand} x={-rand * 0.6 - vbL} y={-fs * 0.8} width={m.breiteMm + rand * 1.2 + vbL + vbR} height={fs * 0.8} />
      <line className={styles.boden} x1={-rand * 0.6 - vbL} y1={0} x2={m.breiteMm + rand * 0.6 + vbR} y2={0} {...LINIE} />
      <Verblendung k={k} ansicht="oben" wand={wand} frontTiefe={frontTiefe} />
      <Abschlusssets k={k} ansicht="oben" wand={wand} />
      {m.korpusse.map((korpus) => (
        <KorpusOben key={korpus.index} k={k} korpus={korpus} wand={wand} tiefe={m.tiefeMm} />
      ))}
      {m.ausstattung.map((a, i) => {
        const oben = AUSSTATTUNG[a.art].oben
        return oben ? <g key={i}>{oben(a, k, { vorne, wand, index: 0 })}</g> : null
      })}
      <Fussleiste k={k} ansicht="oben" wand={wand} />
      <FrontenOben k={k} vorne={vorne} />
      <BreitenKette k={k} abstand={rand} />
      <Mass x1={m.breiteMm + vbR + rand * 0.45} y1={wand} x2={m.breiteMm + vbR + rand * 0.45} y2={vorne} text={mmText(m.tiefeMm)} fs={fs * 0.85} />
      <Mass x1={m.breiteMm + vbR + rand * 0.8} y1={0} x2={m.breiteMm + vbR + rand * 0.8} y2={vorne + frontTiefe} text={mmText(vorne + frontTiefe)} fs={fs * 0.85} />
    </Zeichnung>
  )
}

function Rueckansicht({ m }: { m: Modell }) {
  const fs = Math.max(m.breiteMm, m.hoeheMm) / 34
  const rand = fs * 5
  const k = gespiegelterKontext(m, fs)
  return (
    <Zeichnung minX={-rand} minY={-rand} b={m.breiteMm + 2 * rand} h={m.hoeheMm + 2 * rand} label="Rückansicht">
      <Rahmen k={k} rand={rand} vbL={0} vbR={0} vbO={0}>
        <Abschlusssets k={k} ansicht="vorne" />
        {m.korpusse.map((korpus) => (
          <KorpusHinten key={korpus.index} k={k} korpus={korpus} sicht={m.sichtrueckwand} />
        ))}
        <Fussleiste k={k} ansicht="hinten" />
        <text className={styles.hinweis} x={m.breiteMm / 2} y={k.Y(0) + fs * 3.4} fontSize={fs * 0.55} textAnchor="middle">
          von hinten gesehen{m.sichtrueckwand ? ' · Sichtrückwand' : ''}
          {m.korpusse.some((x) => x.lochreihe) ? ' · ● Lochreihe' : ''}
          {m.korpusse.some((x) => x.bodentraeger) ? ' · ┊ Bodenträger' : ''}
        </text>
      </Rahmen>
    </Zeichnung>
  )
}
