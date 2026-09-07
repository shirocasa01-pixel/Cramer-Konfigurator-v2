import { TextField } from '../ui/TextField'
import { Textarea } from '../ui/Textarea'
import { makeId } from '../../lib/frontsHelpers'
import {
  berechneAussenmass,
  formatKorpusMass,
  resolveDepthCm,
  resolveHeightCm,
  resolveKorpusBreiteCm,
} from '../../lib/korpusMass'
import { breitenWarnung, hoehenWarnung, tiefenWarnung } from '../../lib/dimensionsValidation'
import { frontAufteilung, mmZuCm } from '../../lib/frontbreiten'
import { formatMassZahl } from '../../lib/format'
import type { KorpusEinheit, KorpusGrunddaten } from '../../types'
import styles from './KorpusMasseSection.module.css'

const HEIGHT_MODES: Array<{ key: KorpusGrunddaten['heightMode']; label: string }> = [
  { key: '18R', label: '18 Raster (ca. 235 cm)' },
  { key: '21R', label: '21 Raster (ca. 274 cm)' },
  { key: 'custom', label: 'anders (50–274 cm)' },
]
const BREITE_MODES: Array<{ key: KorpusEinheit['breiteMode']; label: string }> = [
  { key: '50', label: '50er' },
  { key: '60', label: '60er' },
  { key: '100', label: '100er' },
  { key: 'custom', label: 'anders' },
]
const ABSCHLUSS_POSITIONS: Array<{ key: NonNullable<KorpusGrunddaten['abschlussSet']>['position']; label: string }> = [
  { key: 'keine', label: 'kein Abschlussset' },
  { key: 'links', label: 'nur links' },
  { key: 'rechts', label: 'nur rechts' },
  { key: 'beide', label: 'links & rechts' },
]

/** Neue Korpus-Einheit (Standard: 60er, Lochreihe an). */
export function makeKorpusEinheit(breiteMode: KorpusEinheit['breiteMode'] = '60'): KorpusEinheit {
  return { id: makeId('korpus'), breiteMode, lochreihe: true }
}
/** Sinnvoller Startzustand (Schritt 4): 18 Raster, 60 cm tief, 1 × 60er-Korpus. */
export function makeDefaultGrunddaten(): KorpusGrunddaten {
  return { heightMode: '18R', depthMode: '60', korpusse: [makeKorpusEinheit()] }
}

interface Props {
  value: KorpusGrunddaten
  onChange: (next: KorpusGrunddaten) => void
}

/**
 * SCHRITT 4 (Refugium) – Korpus-Maß-Raster. Höhe & Tiefe als Modi (Standard/anders),
 * Breite je Korpus, Lochreihe je Korpus, Abschlussset, Fußleistenausschnitt,
 * Sonderformen und das Freitextfeld für Fixmaße/Sondermaße.
 *
 * Punkt 4.2: Maße außerhalb der Standardbereiche werden NICHT blockiert, sondern
 * mit einem Hinweis versehen – Sonderformate sind in der Produktion möglich.
 * Punkt 4.7/4.11: Die Fixmaß-Häkchen je Dimension sind entfallen; was einzuhalten
 * ist, steht im Freitextfeld am Ende.
 * Punkt 4.13: Zu jeder Korpusbreite wird die abgeleitete Frontbreite angezeigt –
 * der Berater sieht sofort, was aus seiner Auswahl folgt.
 */
export function KorpusMasseSection({ value, onChange }: Props) {
  const patch = (next: Partial<KorpusGrunddaten>) => onChange({ ...value, ...next })
  const patchKorpus = (id: string, next: Partial<KorpusEinheit>) =>
    patch({ korpusse: value.korpusse.map((k) => (k.id === id ? { ...k, ...next } : k)) })
  const addKorpus = () => patch({ korpusse: [...value.korpusse, makeKorpusEinheit()] })
  const removeLastKorpus = () => patch({ korpusse: value.korpusse.slice(0, -1) })

  const depthCm = resolveDepthCm(value)
  const isSondertiefe = value.depthMode === 'custom' && depthCm != null && depthCm < 60
  const abschluss = value.abschlussSet ?? { position: 'keine' as const }
  const fussleiste = value.fussleiste ?? { enabled: false }

  const warnHoehe = hoehenWarnung(resolveHeightCm(value))
  const warnTiefe = tiefenWarnung(depthCm)
  const masse = berechneAussenmass(value)

  return (
    <div className={styles.root}>
      {/* Höhe */}
      <section className={styles.block} aria-label="Schrankhöhe">
        <h2 className={styles.blockTitle}>Schrankhöhe (Gesamthöhe)</h2>
        <div className={styles.chips}>
          {HEIGHT_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={value.heightMode === m.key ? styles.chipActive : styles.chip}
              onClick={() => patch({ heightMode: m.key })}
              aria-pressed={value.heightMode === m.key}
            >
              {m.label}
            </button>
          ))}
        </div>
        {value.heightMode === 'custom' ? (
          <div className={styles.customRow}>
            <TextField
              label="Höhe in cm (50–274)"
              inputMode="decimal"
              placeholder="z. B. 250"
              value={value.heightCm ?? ''}
              onChange={(e) => patch({ heightCm: e.target.value })}
            />
          </div>
        ) : null}
        {warnHoehe ? <p className={styles.warn} role="status">{warnHoehe}</p> : null}
      </section>

      {/* Tiefe */}
      <section className={styles.block} aria-label="Schranktiefe">
        <h2 className={styles.blockTitle}>Schranktiefe (Innenkorpus ohne Front)</h2>
        <div className={styles.chips}>
          <button
            type="button"
            className={value.depthMode === '60' ? styles.chipActive : styles.chip}
            onClick={() => patch({ depthMode: '60' })}
            aria-pressed={value.depthMode === '60'}
          >
            60 cm
          </button>
          <button
            type="button"
            className={value.depthMode === 'custom' ? styles.chipActive : styles.chip}
            onClick={() => patch({ depthMode: 'custom' })}
            aria-pressed={value.depthMode === 'custom'}
          >
            anders (31–60 cm)
          </button>
        </div>
        {value.depthMode === 'custom' ? (
          <div className={styles.customRow}>
            <TextField
              label="Tiefe in cm (31–60)"
              inputMode="decimal"
              placeholder="z. B. 45"
              value={value.depthCm ?? ''}
              onChange={(e) => patch({ depthCm: e.target.value })}
            />
          </div>
        ) : null}
        {warnTiefe ? <p className={styles.warn} role="status">{warnTiefe}</p> : null}
        {isSondertiefe ? (
          <p className={styles.note}>Hinweis: Bei Sondertiefe sind als Innenausstattung nur Einlegeböden möglich.</p>
        ) : null}
      </section>

      {/* Korpusse */}
      <section className={styles.block} aria-label="Korpus-Breiten">
        <div className={styles.korpiHead}>
          <h2 className={styles.blockTitle}>Korpusse (Breite je Korpus, von links nach rechts)</h2>
          <div className={styles.stepper}>
            <button
              type="button"
              className={styles.stepBtn}
              onClick={removeLastKorpus}
              disabled={value.korpusse.length <= 1}
              aria-label="Korpus entfernen"
            >
              −
            </button>
            <span className={styles.stepValue}>{value.korpusse.length}</span>
            <button type="button" className={styles.stepBtn} onClick={addKorpus} aria-label="Korpus hinzufügen">
              +
            </button>
          </div>
        </div>
        {value.korpusse.map((k, index) => {
          const breiteCm = resolveKorpusBreiteCm(k)
          const aufteilung = frontAufteilung(breiteCm)
          const warnBreite = breitenWarnung(breiteCm)
          return (
          <div key={k.id} className={styles.korpus}>
            <span className={styles.korpusLabel}>
              Korpus {index + 1}
              {index === 0
                ? ' · ganz links'
                : index === value.korpusse.length - 1
                  ? ' · ganz rechts'
                  : ''}
            </span>
            <div className={styles.chips}>
              {BREITE_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={k.breiteMode === m.key ? styles.chipActive : styles.chip}
                  onClick={() => patchKorpus(k.id, { breiteMode: m.key })}
                  aria-pressed={k.breiteMode === m.key}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {k.breiteMode === 'custom' ? (
              <div className={styles.customRow}>
                <TextField
                  label="Breite in cm (15–100)"
                  inputMode="decimal"
                  placeholder="z. B. 80"
                  value={k.breiteCm ?? ''}
                  onChange={(e) => patchKorpus(k.id, { breiteCm: e.target.value })}
                />
              </div>
            ) : null}
            <label className={styles.check}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={k.lochreihe}
                onChange={(e) => patchKorpus(k.id, { lochreihe: e.target.checked })}
              />
              Korpus mit Lochreihe
            </label>
            {aufteilung ? (
              <p className={styles.derived}>
                Daraus folgt:{' '}
                <strong>
                  z. B. {aufteilung.anzahl}{' '}
                  {aufteilung.anzahl === 1 ? 'Drehtür' : 'Drehtüren'} à{' '}
                  {formatMassZahl(mmZuCm(aufteilung.frontMm))} cm
                </strong>
                {aufteilung.bestaetigt ? null : ' · Wert noch nicht bestätigt'}
              </p>
            ) : null}
            {warnBreite ? <p className={styles.warn} role="status">{warnBreite}</p> : null}
            {aufteilung?.hinweis ? <p className={styles.warn} role="status">{aufteilung.hinweis}</p> : null}
          </div>
          )
        })}
      </section>

      {/* Abschlussset */}
      <section className={styles.block} aria-label="Abschlussset">
        <h2 className={styles.blockTitle}>Abschlussset (Außenabschluss links/rechts)</h2>
        <div className={styles.chips}>
          {ABSCHLUSS_POSITIONS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={abschluss.position === p.key ? styles.chipActive : styles.chip}
              onClick={() => patch({ abschlussSet: { ...abschluss, position: p.key } })}
              aria-pressed={abschluss.position === p.key}
            >
              {p.label}
            </button>
          ))}
        </div>
        {abschluss.position !== 'keine' ? (
          <p className={styles.note}>
            Das Abschlussset trägt 10 mm je Seite und liegt jeweils hinter einer 3-mm-Fuge – beides
            ist im Außenmaß unten berücksichtigt. Das Material wird im nächsten Schritt
            „Material" zusammen mit den übrigen Materialien festgelegt.
          </p>
        ) : null}
      </section>

      {/* Fußleistenausschnitt */}
      <section className={styles.block} aria-label="Fußleistenausschnitt">
        <label className={styles.check}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={fussleiste.enabled}
            onChange={(e) => patch({ fussleiste: { ...fussleiste, enabled: e.target.checked } })}
          />
          Fußleistenausschnitt gewünscht
        </label>
        {fussleiste.enabled ? (
          <div className={styles.customRow}>
            <TextField
              label="Höhe in cm"
              inputMode="decimal"
              placeholder="z. B. 8"
              value={fussleiste.hoeheCm ?? ''}
              onChange={(e) => patch({ fussleiste: { ...fussleiste, hoeheCm: e.target.value } })}
            />
            <TextField
              label="Tiefe in cm"
              inputMode="decimal"
              placeholder="z. B. 5"
              value={fussleiste.tiefeCm ?? ''}
              onChange={(e) => patch({ fussleiste: { ...fussleiste, tiefeCm: e.target.value } })}
            />
          </div>
        ) : null}
      </section>

      {/* Sonderformen – Punkt 4.12: bleibt bewusst ein Freitextfeld */}
      <section className={styles.block} aria-label="Sonderformen">
        <h2 className={styles.blockTitle}>Sonderformen</h2>
        <TextField
          label="Ecklösungen / Abschrägungen (Freitext)"
          placeholder="z. B. offene Ecklösung links, hintere Abschrägung …"
          value={value.sonderformen ?? ''}
          onChange={(e) => patch({ sonderformen: e.target.value })}
        />
        <p className={styles.note}>
          Wird unverändert an die AV übergeben und weder in der Kalkulation noch in der
          Maßberechnung berücksichtigt.
        </p>
      </section>

      {/* Fixmaße / Sondermaße – Punkt 4.11 (ersetzt die Fixmaß-Häkchen aus 4.7) */}
      <section className={styles.block} aria-label="Fixmaße und Sondermaße">
        <h2 className={styles.blockTitle}>Fixmaße / Sondermaße</h2>
        <Textarea
          label="Was muss genau eingehalten werden? (Freitext)"
          placeholder="z. B. Gesamtbreite 2.980 mm ist Fixmaß (Nische), Höhe darf 250 cm nicht überschreiten …"
          value={value.sondermasse ?? ''}
          onChange={(e) => patch({ sondermasse: e.target.value })}
        />
        <p className={styles.note}>
          Geht unverändert an die Arbeitsvorbereitung. Alle übrigen Maße werden als
          „ca."-Maße geführt.
        </p>
      </section>

      {/* Außenmaß – Punkt 4.10, gerechnet nach der Regel aus 4.13 */}
      <section className={styles.block} aria-label="Außenmaß">
        <h2 className={styles.blockTitle}>Außenmaß</h2>
        {masse.berechnet ? (
          <>
            <p className={styles.masse}>
              Ihr Kleiderschrank hat ein Maß von{' '}
              <strong>{formatKorpusMass(masse.gesamthoeheCm)}</strong> (Gesamthöhe),{' '}
              <strong>{formatKorpusMass(masse.gesamtbreiteCm)}</strong> (Gesamtbreite) und{' '}
              <strong>{formatKorpusMass(masse.gesamttiefeCm ?? masse.korpustiefeCm)}</strong>{' '}
              {masse.gesamttiefeCm != null
                ? '(Korpustiefe ohne Fronten, inkl. Fußleistenausschnitt).'
                : '(Korpustiefe ohne Fronten).'}
            </p>
            <p className={styles.rechenweg}>{masse.rechenweg}</p>
            <p className={styles.note}>
              Die Breite ergibt sich aus den Frontbreiten und Fugen (3 mm), und Abschlusssets
              (10 mm) sind berücksichtigt. Verblendungen und die Frontstärke sind es nicht.
            </p>
            {masse.hinweise.map((h, i) => (
              <p key={i} className={styles.warn} role="status">
                {h}
              </p>
            ))}
          </>
        ) : (
          <p className={styles.note}>
            Sobald jeder Korpus eine gültige Breite hat, wird das Außenmaß hier berechnet.
          </p>
        )}
      </section>
    </div>
  )
}
