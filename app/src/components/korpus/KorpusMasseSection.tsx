import { TextField } from '../ui/TextField'
import { Textarea } from '../ui/Textarea'
import { Beschriftung, BeschriftungsGruppe, fuelle, useTexte } from '../schema/Beschriftung'
import { Inspector } from '../schema/Inspector'
import { makeId } from '../../lib/frontsHelpers'
import {
  VERBLENDUNG_SEITEN,
  berechneAussenmass,
  formatKorpusMass,
  formatLfm,
  resolveDepthCm,
  resolveHeightCm,
  resolveKorpusBreiteCm,
  verblendungAutoLfm,
  verblendungBezugsmasse,
  verblendungRechenweg,
  type VerblendungSeite,
} from '../../lib/korpusMass'
import { sondertiefeOptionenText } from '../../config/equipment'
import { breitenWarnung, hoehenWarnung, tiefenWarnung } from '../../lib/dimensionsValidation'
import { frontAufteilung, mmZuCm } from '../../lib/frontbreiten'
import { formatMassZahl } from '../../lib/format'
import type { KorpusEinheit, KorpusGrunddaten, Verblendung, VerblendungArt } from '../../types'
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
/**
 * Verblendung (Überarbeitung 6, S. 7): eine Reihe sich ausschließender Auswahlen statt
 * zweier Häkchen — „Es kann nur die Verblendung korpusbündig oder Verblendung frontbündig
 * ausgewählt werden. Beides ist nicht möglich."
 */
const VERBLENDUNG_ARTEN: Array<{ key: VerblendungArt; label: string }> = [
  { key: 'keine', label: 'keine Verblendung' },
  { key: 'korpusbuendig', label: 'korpusbündig' },
  { key: 'frontbuendig', label: 'frontbündig' },
]

/*
  Die drei Außenmaß-Texte stehen als Konstanten und nicht im JSX: Sie werden an zwei
  Stellen gebraucht — beim Anzeigen und als Standard im Bearbeitungsdialog. Zwei Kopien
  desselben Satzes wären genau die Art Abweichung, die niemand bemerkt.
*/
const AUSSENMASS_SATZ =
  'Ihr Kleiderschrank hat ein Maß von {hoehe} (Gesamthöhe), {breite} (Gesamtbreite) und {tiefe} ({tiefeZusatz}).'
const AUSSENMASS_HINWEIS =
  'Die Breite ergibt sich aus den Frontbreiten und Fugen (3 mm), und Abschlusssets (10 mm) sind berücksichtigt. Verblendungen und die Frontstärke sind es nicht.'
const AUSSENMASS_OFFEN = 'Sobald jeder Korpus eine gültige Breite hat, wird das Außenmaß hier berechnet.'

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
  /**
   * Überarbeitung 8, S. 1: In der Ausstattung ist eine Beleuchtung (LED-Band/Syncro) gewählt —
   * die Korpustiefe ohne Front wächst im Außenmaß um die Kabelführung.
   */
  beleuchtung?: boolean
  /** Zweiläufige Schiebetür geplant: Verblendung nur seitlich (kein „Oben"). */
  nurSeitlicheVerblendung?: boolean
}

/**
 * Überarbeitung 8, S. 1: Diese Innenausstattungen sind auch bei Sondertiefe möglich. Der Text
 * kommt aus dem Katalog (`availableInSondertiefe`), damit Hinweis und Regel nicht auseinanderlaufen.
 */
const SONDERTIEFE_HINWEIS = `Hinweis: Bei Sondertiefe sind als Innenausstattung nur möglich: ${sondertiefeOptionenText()}.`

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
export function KorpusMasseSection({ value, onChange, beleuchtung, nurSeitlicheVerblendung }: Props) {
  // Alle Beschriftungen dieses Moduls liegen im Abschnitt „masse" des Schemas; im Code
  // steht der Standard, den der Administrator überschreiben kann.
  const t = useTexte('masse')
  const patch = (next: Partial<KorpusGrunddaten>) => onChange({ ...value, ...next })
  const patchKorpus = (id: string, next: Partial<KorpusEinheit>) =>
    patch({ korpusse: value.korpusse.map((k) => (k.id === id ? { ...k, ...next } : k)) })
  const addKorpus = () => patch({ korpusse: [...value.korpusse, makeKorpusEinheit()] })
  const removeLastKorpus = () => patch({ korpusse: value.korpusse.slice(0, -1) })

  const depthCm = resolveDepthCm(value)
  const isSondertiefe = value.depthMode === 'custom' && depthCm != null && depthCm < 60
  const abschluss = value.abschlussSet ?? { position: 'keine' as const }
  const verblendung = value.verblendung ?? { art: 'keine' as const }
  const fussleiste = value.fussleiste ?? { enabled: false }

  const warnHoehe = hoehenWarnung(resolveHeightCm(value))
  const warnTiefe = tiefenWarnung(depthCm)
  const masse = berechneAussenmass(value, { beleuchtung })

  // --- Verblendung: Haken → Laufmeter (Überarbeitung 8, Vorgabe Verblendungs-UI) --------
  const setzeVerblendung = (next: Partial<Verblendung>) => patch({ verblendung: { ...verblendung, ...next } })
  const bezug = verblendungBezugsmasse(value)
  const autoLfm = verblendungAutoLfm(value)
  const seitenGesetzt = Boolean(verblendung.seiten?.links || verblendung.seiten?.oben || verblendung.seiten?.rechts)
  const lfmAnzeige = verblendung.lfmManuell
    ? verblendung.lfm ?? ''
    : seitenGesetzt
      ? autoLfm != null
        ? formatLfm(autoLfm)
        : ''
      : verblendung.lfm ?? ''
  function toggleSeite(seite: VerblendungSeite, an: boolean) {
    const seiten = { ...verblendung.seiten, [seite]: an }
    const naechste: Verblendung = { ...verblendung, seiten }
    // Solange nicht überschrieben, folgt der gespeicherte Wert der Rechnung.
    if (!verblendung.lfmManuell) {
      const auto = verblendungAutoLfm({ ...value, verblendung: naechste })
      naechste.lfm = auto != null ? formatLfm(auto) : ''
    }
    patch({ verblendung: naechste })
  }

  return (
    <div className={styles.root}>
      {/*
        Höhe — die Rasterstufen sind Beschriftungen, keine Werte: `18R` bleibt `18R`, egal
        wie der Knopf heißt. Deshalb ist die Reihe über `t()` frei benennbar, ohne dass
        die Rasterrechnung davon berührt wird.
      */}
      <section className={styles.block} aria-label="Schrankhöhe">
        <h2 className={styles.blockTitle}>
          <Beschriftung
            abschnittId="masse"
            schluessel="hoehe.titel"
            standard="Schrankhöhe (Gesamthöhe)"
          />
          <Inspector feld="masse.hoehe" />
          <BeschriftungsGruppe
            abschnittId="masse"
            titel="Höhen-Optionen benennen"
            eintraege={HEIGHT_MODES.map((m) => ({
              schluessel: `hoehe.mode.${m.key}`,
              standard: m.label,
              label: `Option „${m.key}"`,
            }))}
          />
        </h2>
        <div className={styles.chips}>
          {HEIGHT_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={value.heightMode === m.key ? styles.chipActive : styles.chip}
              onClick={() => patch({ heightMode: m.key })}
              aria-pressed={value.heightMode === m.key}
            >
              {t(`hoehe.mode.${m.key}`, m.label)}
            </button>
          ))}
        </div>
        {value.heightMode === 'custom' ? (
          <div className={styles.customRow}>
            <TextField
              label={t('hoehe.custom.label', 'Höhe in cm (50–274)')}
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
        <h2 className={styles.blockTitle}>
          <Beschriftung
            abschnittId="masse"
            schluessel="tiefe.titel"
            standard="Schranktiefe (Innenkorpus ohne Front)"
          />
          <Inspector feld="masse.tiefe" />
          <BeschriftungsGruppe
            abschnittId="masse"
            titel="Tiefen-Optionen benennen"
            eintraege={[
              { schluessel: 'tiefe.mode.60', standard: '60 cm', label: 'Option „60"' },
              {
                schluessel: 'tiefe.mode.custom',
                standard: 'anders (31–60 cm)',
                label: 'Option „anders"',
              },
              {
                schluessel: 'tiefe.sondertiefe',
                standard: SONDERTIEFE_HINWEIS,
                label: 'Hinweis bei Sondertiefe',
                mehrzeilig: true,
              },
            ]}
          />
        </h2>
        <div className={styles.chips}>
          <button
            type="button"
            className={value.depthMode === '60' ? styles.chipActive : styles.chip}
            onClick={() => patch({ depthMode: '60' })}
            aria-pressed={value.depthMode === '60'}
          >
            {t('tiefe.mode.60', '60 cm')}
          </button>
          <button
            type="button"
            className={value.depthMode === 'custom' ? styles.chipActive : styles.chip}
            onClick={() => patch({ depthMode: 'custom' })}
            aria-pressed={value.depthMode === 'custom'}
          >
            {t('tiefe.mode.custom', 'anders (31–60 cm)')}
          </button>
        </div>
        {value.depthMode === 'custom' ? (
          <div className={styles.customRow}>
            <TextField
              label={t('tiefe.custom.label', 'Tiefe in cm (31–60)')}
              inputMode="decimal"
              placeholder="z. B. 45"
              value={value.depthCm ?? ''}
              onChange={(e) => patch({ depthCm: e.target.value })}
            />
          </div>
        ) : null}
        {warnTiefe ? <p className={styles.warn} role="status">{warnTiefe}</p> : null}
        {isSondertiefe ? (
          <p className={styles.note}>
            {t('tiefe.sondertiefe', SONDERTIEFE_HINWEIS)}
          </p>
        ) : null}
      </section>

      {/* Korpusse */}
      <section className={styles.block} aria-label="Korpus-Breiten">
        <div className={styles.korpiHead}>
          <h2 className={styles.blockTitle}>
            <Beschriftung
              abschnittId="masse"
              schluessel="breite.titel"
              standard="Korpusse (Breite je Korpus, von links nach rechts)"
            />
            <Inspector feld="masse.breite" />
            <BeschriftungsGruppe
              abschnittId="masse"
              titel="Korpus-Beschriftungen"
              eintraege={[
                ...BREITE_MODES.map((m) => ({
                  schluessel: `breite.mode.${m.key}`,
                  standard: m.label,
                  label: `Breite „${m.key}"`,
                })),
                { schluessel: 'breite.korpus', standard: 'Korpus {n}', label: 'Korpus-Überschrift' },
                { schluessel: 'breite.links', standard: 'ganz links', label: 'Zusatz erster Korpus' },
                { schluessel: 'breite.rechts', standard: 'ganz rechts', label: 'Zusatz letzter Korpus' },
                { schluessel: 'breite.lochreihe', standard: 'Korpus mit Lochreihe', label: 'Lochreihen-Häkchen' },
                {
                  schluessel: 'breite.folgt',
                  standard: 'Daraus folgt: z. B. {anzahl} {tuer} à {breite} cm',
                  label: 'Ergebnistext Frontaufteilung',
                  mehrzeilig: true,
                  hinweis: 'Platzhalter: {anzahl}, {tuer}, {breite}',
                },
              ]}
            />
          </h2>
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
              {fuelle(t('breite.korpus', 'Korpus {n}'), { n: String(index + 1) })}
              {index === 0
                ? ` · ${t('breite.links', 'ganz links')}`
                : index === value.korpusse.length - 1
                  ? ` · ${t('breite.rechts', 'ganz rechts')}`
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
                  {t(`breite.mode.${m.key}`, m.label)}
                </button>
              ))}
            </div>
            {k.breiteMode === 'custom' ? (
              <div className={styles.customRow}>
                <TextField
                  label={t('breite.custom.label', 'Breite in cm (15–100)')}
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
              {t('breite.lochreihe', 'Korpus mit Lochreihe')}
              <Inspector feld="masse.lochreihe" />
            </label>
            {aufteilung ? (
              <p className={styles.derived}>
                <strong>
                  {fuelle(t('breite.folgt', 'Daraus folgt: z. B. {anzahl} {tuer} à {breite} cm'), {
                    anzahl: String(aufteilung.anzahl),
                    tuer: aufteilung.anzahl === 1 ? 'Drehtür' : 'Drehtüren',
                    breite: formatMassZahl(mmZuCm(aufteilung.frontMm)),
                  })}
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
        <h2 className={styles.blockTitle}>
          <Beschriftung
            abschnittId="masse"
            schluessel="abschluss.titel"
            standard="Abschlussset (Außenabschluss links/rechts)"
          />
          <Inspector feld="masse.abschlussset" />
          <BeschriftungsGruppe
            abschnittId="masse"
            titel="Abschlussset-Beschriftungen"
            eintraege={[
              ...ABSCHLUSS_POSITIONS.map((p) => ({
                schluessel: `abschluss.pos.${p.key}`,
                standard: p.label,
                label: `Position „${p.key}"`,
              })),
              {
                schluessel: 'abschluss.hinweis',
                standard:
                  'Das Abschlussset trägt 10 mm je Seite und liegt jeweils hinter einer 3-mm-Fuge – beides ist im Außenmaß unten berücksichtigt. Das Material wird im nächsten Schritt „Material" zusammen mit den übrigen Materialien festgelegt.',
                label: 'Hinweis bei gewähltem Abschlussset',
                mehrzeilig: true,
              },
            ]}
          />
        </h2>
        <div className={styles.chips}>
          {ABSCHLUSS_POSITIONS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={abschluss.position === p.key ? styles.chipActive : styles.chip}
              onClick={() => patch({ abschlussSet: { ...abschluss, position: p.key } })}
              aria-pressed={abschluss.position === p.key}
            >
              {t(`abschluss.pos.${p.key}`, p.label)}
            </button>
          ))}
        </div>
        {abschluss.position !== 'keine' ? (
          <p className={styles.note}>
            {t(
              'abschluss.hinweis',
              'Das Abschlussset trägt 10 mm je Seite und liegt jeweils hinter einer 3-mm-Fuge – beides ist im Außenmaß unten berücksichtigt. Das Material wird im nächsten Schritt „Material" zusammen mit den übrigen Materialien festgelegt.',
            )}
          </p>
        ) : null}
      </section>

      {/*
        Verblendung — Überarbeitung 6, S. 7: aus der Ausstattung hinter der Front hierher
        verlegt, „unter ‚3. Maße' zwischen ‚Fußleistenausschnitt' und ‚Abschlusset'".
        Sie gilt für das ganze Möbel, nicht je Segment.
      */}
      <section className={styles.block} aria-label="Verblendung">
        <h2 className={styles.blockTitle}>
          <Beschriftung abschnittId="masse" schluessel="verblendung.titel" standard="Verblendung" />
          <Inspector feld="masse.verblendung" />
          <BeschriftungsGruppe
            abschnittId="masse"
            titel="Verblendungs-Beschriftungen"
            eintraege={[
              ...VERBLENDUNG_ARTEN.map((v) => ({
                schluessel: `verblendung.art.${v.key}`,
                standard: v.label,
                label: `Art „${v.key}"`,
              })),
              {
                schluessel: 'verblendung.hinweis',
                standard:
                  'Korpusbündig und frontbündig schließen einander aus. Bei Schiebetürschränken ist die Verblendung nur seitlich möglich.',
                label: 'Hinweis bei gewählter Verblendung',
                mehrzeilig: true,
              },
            ]}
          />
        </h2>
        <div className={styles.chips}>
          {VERBLENDUNG_ARTEN.map((v) => (
            <button
              key={v.key}
              type="button"
              className={verblendung.art === v.key ? styles.chipActive : styles.chip}
              onClick={() => patch({ verblendung: { ...verblendung, art: v.key } })}
              aria-pressed={verblendung.art === v.key}
            >
              {t(`verblendung.art.${v.key}`, v.label)}
            </button>
          ))}
        </div>
        {verblendung.art !== 'keine' ? (
          <>
            {/*
              LINKS die Position als Haken (frei kombinierbar), RECHTS die Laufmeter — schmal,
              weil dort nur kurze Zahlen stehen. Aus den Haken rechnet das System:
                links/rechts je 1 × Schrankhöhe, oben 1 × Schrankbreite (Summe der Korpusbreiten).
              Der Berater kann den Wert für Sonderfälle überschreiben; „automatisch" nimmt die
              Rechnung zurück.
            */}
            <div className={styles.verblendungRow}>
              <div className={styles.verblendungSeiten}>
                <span className={styles.fieldLabel}>{t('verblendung.position', 'Position')}</span>
                <div className={styles.seitenChecks} role="group" aria-label="Position der Verblendung">
                  {VERBLENDUNG_SEITEN.map((seite) => {
                    const gesperrt = seite.key === 'oben' && Boolean(nurSeitlicheVerblendung)
                    return (
                      <label
                        key={seite.key}
                        className={[styles.check, gesperrt ? styles.checkDisabled : ''].filter(Boolean).join(' ')}
                        title={gesperrt ? 'Bei Schiebetürschränken ist die Verblendung nur seitlich möglich.' : undefined}
                      >
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={Boolean(verblendung.seiten?.[seite.key]) && !gesperrt}
                          disabled={gesperrt}
                          onChange={(e) => toggleSeite(seite.key, e.target.checked)}
                        />
                        {t(`verblendung.seite.${seite.key}`, seite.label)}
                      </label>
                    )
                  })}
                </div>
              </div>
              <div className={styles.lfmFeld}>
                <TextField
                  label={t('verblendung.lfm', 'Laufmeter (lfm)')}
                  inputMode="decimal"
                  placeholder="z. B. 2,4"
                  value={lfmAnzeige}
                  onChange={(e) =>
                    setzeVerblendung(
                      e.target.value.trim()
                        ? { lfm: e.target.value, lfmManuell: true }
                        : { lfm: autoLfm != null ? formatLfm(autoLfm) : '', lfmManuell: false },
                    )
                  }
                />
                {verblendung.lfmManuell && seitenGesetzt ? (
                  <button
                    type="button"
                    className={styles.lfmReset}
                    onClick={() => setzeVerblendung({ lfm: autoLfm != null ? formatLfm(autoLfm) : '', lfmManuell: false })}
                  >
                    automatisch{autoLfm != null ? ` (${formatLfm(autoLfm)})` : ''}
                  </button>
                ) : null}
              </div>
            </div>
            {seitenGesetzt ? (
              <p className={styles.rechenweg}>
                {verblendung.lfmManuell
                  ? `Manuell überschrieben — errechnet wären ${verblendungRechenweg(value)}${autoLfm != null ? ` = ${formatLfm(autoLfm)} lfm` : ''}.`
                  : `${verblendungRechenweg(value)}${autoLfm != null ? ` = ${formatLfm(autoLfm)} lfm` : ''}`}
              </p>
            ) : (
              <p className={styles.rechenweg}>
                Haken setzen: links/rechts je Schrankhöhe
                {bezug.hoeheM != null ? ` (${formatLfm(bezug.hoeheM)} m)` : ''}, oben Schrankbreite
                {bezug.breiteM != null ? ` (${formatLfm(bezug.breiteM)} m, Summe der Korpusbreiten)` : ''}.
              </p>
            )}
            {/* Altbestand: Positionsangabe als Freitext aus der Zeit vor den Haken. */}
            {verblendung.positionNote?.trim() ? (
              <p className={styles.note}>Frühere Positionsangabe: {verblendung.positionNote.trim()}</p>
            ) : null}
            <p className={styles.note}>
              {t(
                'verblendung.hinweis',
                'Korpusbündig und frontbündig schließen einander aus. Bei Schiebetürschränken ist die Verblendung nur seitlich möglich.',
              )}
            </p>
          </>
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
          <Beschriftung
            abschnittId="masse"
            schluessel="fussleiste.titel"
            standard="Fußleistenausschnitt gewünscht"
          />
          <Inspector feld="masse.fussleiste" />
        </label>
        {fussleiste.enabled ? (
          <div className={styles.customRow}>
            <TextField
              label={t('fussleiste.hoehe', 'Höhe in cm')}
              inputMode="decimal"
              placeholder="z. B. 8"
              value={fussleiste.hoeheCm ?? ''}
              onChange={(e) => patch({ fussleiste: { ...fussleiste, hoeheCm: e.target.value } })}
            />
            <TextField
              label={t('fussleiste.tiefe', 'Tiefe in cm')}
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
        <h2 className={styles.blockTitle}>
          <Beschriftung abschnittId="masse" schluessel="sonderformen.titel" standard="Sonderformen" />
          <Inspector feld="masse.sonderformen" />
        </h2>
        <TextField
          label={t('sonderformen.label', 'Ecklösungen / Abschrägungen (Freitext)')}
          placeholder="z. B. offene Ecklösung links, hintere Abschrägung …"
          value={value.sonderformen ?? ''}
          onChange={(e) => patch({ sonderformen: e.target.value })}
        />
        <Beschriftung
          abschnittId="masse"
          schluessel="sonderformen.hinweis"
          standard="Wird unverändert an die AV übergeben und weder in der Kalkulation noch in der Maßberechnung berücksichtigt."
          as="p"
          className={styles.note}
          mehrzeilig
        />
      </section>

      {/* Fixmaße / Sondermaße – Punkt 4.11 (ersetzt die Fixmaß-Häkchen aus 4.7) */}
      <section className={styles.block} aria-label="Fixmaße und Sondermaße">
        <h2 className={styles.blockTitle}>
          <Beschriftung
            abschnittId="masse"
            schluessel="sondermasse.titel"
            standard="Fixmaße / Sondermaße"
          />
          <Inspector feld="masse.sondermasse" />
        </h2>
        <Textarea
          label={t('sondermasse.label', 'Was muss genau eingehalten werden? (Freitext)')}
          placeholder="z. B. Gesamtbreite 2.980 mm ist Fixmaß (Nische), Höhe darf 250 cm nicht überschreiten …"
          value={value.sondermasse ?? ''}
          onChange={(e) => patch({ sondermasse: e.target.value })}
        />
        <Beschriftung
          abschnittId="masse"
          schluessel="sondermasse.hinweis"
          standard={'Geht unverändert an die Arbeitsvorbereitung. Alle übrigen Maße werden als „ca."-Maße geführt.'}
          as="p"
          className={styles.note}
          mehrzeilig
        />
      </section>

      {/* Außenmaß – Punkt 4.10, gerechnet nach der Regel aus 4.13 */}
      {/*
        DER ERGEBNISSATZ — editierbar, ohne dass jemand Maße abtippt.

        Der Satz ist der, den der Berater dem Kunden vorliest; die Zahlen darin kommen aus
        der Rechnung. Beides zu trennen war der einzige Weg, ihn frei formulierbar zu
        machen: Die Platzhalter `{hoehe}`, `{breite}` und `{tiefe}` werden beim Anzeigen
        ersetzt, der Rest ist Text des Administrators.
      */}
      <section className={styles.block} aria-label="Außenmaß">
        <h2 className={styles.blockTitle}>
          <Beschriftung abschnittId="masse" schluessel="aussenmass.titel" standard="Außenmaß" />
          <Inspector feld="masse.aussenmass" />
          <BeschriftungsGruppe
            abschnittId="masse"
            titel="Außenmaß-Texte"
            eintraege={[
              {
                schluessel: 'aussenmass.satz',
                standard: AUSSENMASS_SATZ,
                label: 'Ergebnissatz',
                mehrzeilig: true,
                hinweis: 'Platzhalter: {hoehe}, {breite}, {tiefe}, {tiefeZusatz}',
              },
              {
                schluessel: 'aussenmass.hinweis',
                standard: AUSSENMASS_HINWEIS,
                label: 'Hinweis zur Rechnung',
                mehrzeilig: true,
              },
              {
                schluessel: 'aussenmass.offen',
                standard: AUSSENMASS_OFFEN,
                label: 'Text, solange noch nicht gerechnet werden kann',
                mehrzeilig: true,
              },
            ]}
          />
        </h2>
        {masse.berechnet ? (
          <>
            <p className={styles.masse}>
              {fuelle(t('aussenmass.satz', AUSSENMASS_SATZ), {
                hoehe: formatKorpusMass(masse.gesamthoeheCm),
                breite: formatKorpusMass(masse.gesamtbreiteCm),
                tiefe: formatKorpusMass(masse.gesamttiefeCm ?? masse.korpustiefeCm),
                tiefeZusatz: [
                  'Korpustiefe ohne Fronten',
                  masse.gesamttiefeCm != null ? 'inkl. Fußleistenausschnitt' : null,
                  masse.beleuchtungZugabeCm != null
                    ? `inkl. ${formatMassZahl(masse.beleuchtungZugabeCm)} cm Kabelführung für die Beleuchtung`
                    : null,
                ]
                  .filter(Boolean)
                  .join(', '),
              })}
            </p>
            <p className={styles.rechenweg}>{masse.rechenweg}</p>
            <p className={styles.note}>{t('aussenmass.hinweis', AUSSENMASS_HINWEIS)}</p>
            {masse.hinweise.map((h, i) => (
              <p key={i} className={styles.warn} role="status">
                {h}
              </p>
            ))}
          </>
        ) : (
          <p className={styles.note}>{t('aussenmass.offen', AUSSENMASS_OFFEN)}</p>
        )}
      </section>
    </div>
  )
}
