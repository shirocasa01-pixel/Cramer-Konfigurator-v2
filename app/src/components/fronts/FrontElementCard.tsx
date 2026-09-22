import { useState } from 'react'
import { MaterialSelect } from '../material/MaterialSelect'
import { Select } from '../ui/Select'
import { TextField } from '../ui/TextField'
import {
  ausgeschlosseneOptionIds,
  getFrontType,
  getStyleLine,
  type FrontField,
  type FrontStyleLine,
} from '../../config/frontCatalog'
import { EDGE_HANDLE_ID, EDGE_KUERZBAR_FRONT_TYPE_IDS, getAvailableHandles } from '../../config/handles'
import { grifflaenge } from '../../config/preisMapping'
import { MATERIAL_CUSTOM_ID, aktuelleOptionId, getMaterialGroup } from '../../config/materialMatrix'
import { formatMassZahl } from '../../lib/format'
import { resolvePriceGroup } from '../../lib/materialRules'
import type { Resthoehe } from '../../lib/frontGeometrie'
import {
  DREHTUER_RASTER_MIN,
  aufkantungGroupIds,
  aufkantungOptions,
  decodeAufkantungValue,
  encodeAufkantungValue,
  frontHoeheAusRaster,
  frontMaterialGroupId,
  isFrontFieldVisible,
  parseRasterEingabe,
} from '../../lib/frontsHelpers'
import { useStammdaten } from '../../lib/useStammdaten'
import { Beschriftung, BeschriftungsGruppe, useTexte } from '../schema/Beschriftung'
import { Inspector } from '../schema/Inspector'
import type { FrontElement, FrontFieldValue, MaterialSelection } from '../../types'
import styles from './FrontElementCard.module.css'

/**
 * Die Türanschlag-Seiten in der Reihenfolge, in der sie am Möbel liegen: links links,
 * rechts rechts. Eine Liste statt zweier Literale im JSX, damit Reihenfolge und Wert
 * nicht getrennt voneinander geändert werden können — genau das war der Fehler.
 */
const ANSCHLAG_SEITEN: Array<{ key: 'links' | 'rechts'; label: string }> = [
  { key: 'links', label: 'links' },
  { key: 'rechts', label: 'rechts' },
]

/**
 * Was die Front-Geometrie (`lib/frontGeometrie.ts`) über DIESE Front weiß — Überarbeitung 9.
 * Die Karte rechnet nichts davon selbst; sie zeigt es an und begrenzt die Auswahl.
 */
export interface FrontKartenGeometrie {
  /** „Höhe bis Korpusoberkante": abgeleitete Höhe, `undefined` wenn nicht ableitbar. */
  resthoehe?: Resthoehe
  /** Größte zulässige Rasterzahl — Obergrenze der Raster-Auswahl. */
  maxRaster: number
  /** Größte zulässige Höhe in cm für die freie Eingabe. */
  maxHoeheCm?: number
  /** Rasterstufe des Korpus für die Hinweise. */
  korpusRaster?: number
  /** Vorgegebener Anschlag bei einem Türpaar — dann gibt es keine Auswahl. */
  anschlagVorgabe?: 'links' | 'rechts'
  /** Hinweis unter dem Breitenfeld (Frontbereich, Nachbarflügel). */
  breitenHinweis?: string
}

interface FrontElementCardProps {
  element: FrontElement
  onChange: (patch: Partial<FrontElement>) => void
  onRemove: () => void
  /** Phase A: „Werte übernehmen" – kopiert die Konfiguration der Referenzfront (gleicher Typ). */
  onCopyValues?: () => void
  /** Anzeigename der Quellfront für den Übernehmen-Button (z. B. „Front 1"). */
  copyFromLabel?: string
  /** Überarbeitung 9: Geometrie dieser Front im Segment (Höhe, Raster, Anschlag, Breite). */
  geometrie?: FrontKartenGeometrie
}

/**
 * Ein Front-Bauteil innerhalb einer Front-Typ-Spalte: Kennzeichnung (Pflicht),
 * Maße/Katalog-Code, Stil-Linie und die kaskadierenden Material-/Freitextfelder.
 * Griff-Optionen sind gegenseitig ausschließend (PTO ⇎ Griff); bei gleichem Front-Typ
 * wie die Referenzfront erscheint der „Werte übernehmen"-Button (Phase A).
 *
 * Überarbeitung 3 ergänzt: Türhöhe der Drehtür über drei exklusive Optionen inkl.
 * Raster→cm-Umrechnung, Türanschlag rechts/links, „Line"-Aufteilung in Frontscheibe und
 * Aufkantung sowie das Griffprofil ausschließlich in „Edge".
 */
export function FrontElementCard({
  element,
  onChange,
  onRemove,
  onCopyValues,
  copyFromLabel,
  geometrie,
}: FrontElementCardProps) {
  const [labelTouched, setLabelTouched] = useState(false)
  // Die Aufkantungs-Liste und die Gruppen-Labels kommen aus den Oberflächen-Stammdaten;
  // ohne dieses Abonnement bliebe die Karte nach einer Änderung in der Verwaltung stehen.
  useStammdaten()
  // Beschriftungen des Fronten-Moduls: im Code der Standard, im Schema die Fassung des
  // Administrators. Eingabefelder bekommen ihren Text über `t`, weil ein `label` eine
  // Zeichenkette sein muss und keine Komponente mit Stift sein kann.
  const t = useTexte('fronten')
  const type = getFrontType(element.typeId)
  const styleLine = getStyleLine(element.typeId, element.styleLineId)
  const labelError = labelTouched && !element.label.trim() ? 'Kennzeichnung ist erforderlich.' : undefined
  const maxHeight = type?.maxHeightCm
  const heightNum = Number((element.heightCm ?? '').replace(',', '.'))
  const heightViolation = maxHeight != null && Number.isFinite(heightNum) && heightNum > maxHeight
  // Edge-Griff: dieselbe Längenregel wie in der Kalkulation (`grifflaenge`).
  const istEdge = Boolean(element.griff) && element.griffId === EDGE_HANDLE_ID
  const griffLaengeNum = Number((element.griffLaengeCm ?? '').replace(',', '.'))
  const griffLaengeFehler =
    istEdge && element.griffLaengeCm?.trim()
      ? !Number.isFinite(griffLaengeNum)
        ? 'Bitte eine Zahl in cm eingeben.'
        : grifflaenge(element.typeId, Number.isFinite(heightNum) && heightNum > 0 ? heightNum : undefined, griffLaengeNum).problem
      : undefined

  const hoeheModus = element.hoeheModus
  // „Höhe bis Korpusoberkante" und die Rastererkennung schreibt die Fronten-Seite über
  // `normalisiereSpalte` in den Entwurf — hier wird nur angezeigt.
  const resthoehe = geometrie?.resthoehe
  const maxRaster = geometrie?.maxRaster ?? 21

  function setField(fieldId: string, value: FrontFieldValue) {
    onChange({ fieldValues: { ...element.fieldValues, [fieldId]: value } })
  }

  /** Feldwerte ohne die angegebenen IDs (statt `undefined` einzutragen). */
  function fieldValuesOhne(...ids: string[]): Record<string, FrontFieldValue> {
    const rest: Record<string, FrontFieldValue> = {}
    for (const [key, val] of Object.entries(element.fieldValues ?? {})) {
      if (!ids.includes(key)) rest[key] = val
    }
    return rest
  }

  /**
   * Material eines Stil-Linien-Feldes setzen. Wechselt bei „Line" die Materialgruppe, werden
   * die davon abhängigen Angaben (Ja/Nein, Aufkantung, Alulisene) verworfen – sie gehören
   * zur alten Gruppe und wären sonst still falsch.
   */
  function setMaterial(field: FrontField, value: FrontFieldValue | undefined, material: MaterialSelection) {
    const gruppeVorher = value?.material?.materialGroupId
    const gruppeWechselt =
      Boolean(styleLine?.frontscheibeAufkantung) &&
      field.id === 'material' &&
      material.materialGroupId !== gruppeVorher
    if (!gruppeWechselt) {
      setField(field.id, { ...value, material })
      return
    }
    onChange({
      lineAufkantungGleich: undefined,
      fieldValues: { ...fieldValuesOhne('aufkantung', 'alulisene'), [field.id]: { ...value, material } },
    })
  }

  /** Antwort auf „(Glas der) Frontscheibe und der Aufkantung gleich?". */
  function setLineGleich(gleich: boolean) {
    if (gleich) {
      onChange({ lineAufkantungGleich: true, fieldValues: fieldValuesOhne('aufkantung', 'alulisene') })
    } else {
      onChange({ lineAufkantungGleich: false })
    }
  }

  function pickStyleLine(styleLineId: string) {
    if (styleLineId === element.styleLineId) return
    // Stil-Wechsel setzt die (anders strukturierten) Felder zurück.
    const patch: Partial<FrontElement> = {
      styleLineId,
      fieldValues: {},
      lineAufkantungGleich: undefined,
    }
    // Schritt 7: bei Wechsel zu Glossy/Less einen dort nicht mehr zulässigen Griff verwerfen.
    if (element.griffId && !getAvailableHandles(styleLineId, element.typeId).some((h) => h.id === element.griffId)) {
      patch.griffId = undefined
      patch.griffLaengeCm = undefined
    }
    onChange(patch)
  }

  // --- Türhöhe (Überarbeitung 3) -------------------------------------------------
  function setModusOberkante(checked: boolean) {
    onChange(
      checked
        ? { hoeheModus: 'korpusoberkante', hoeheRaster: undefined, heightCm: '' }
        : { hoeheModus: undefined, heightCm: '' },
    )
  }
  function setRaster(text: string) {
    const raster = parseRasterEingabe(text)
    if (!text.trim()) {
      onChange({ hoeheModus: undefined, hoeheRaster: '', heightCm: '' })
      return
    }
    // Einbahnstraße: Raster → cm.
    onChange({
      hoeheModus: 'raster',
      hoeheRaster: text,
      heightCm: raster != null ? formatMassZahl(frontHoeheAusRaster(raster)) : '',
    })
  }
  function setHoeheCm(text: string) {
    // Die Rasterzahl einer freien cm-Höhe trägt die Normalisierung nach — nur bei vollen
    // Rastern, sonst bleibt das Feld leer (Überarbeitung 9, S. 2).
    onChange({ hoeheModus: text.trim() ? 'cm' : undefined, hoeheRaster: '', heightCm: text })
  }

  /*
    Überarbeitung 9, S. 1: „Trotz Korpushöhe mit 18 Raster kann ich Türen mit 21 Rasterhöhe
    konfigurieren." Die Auswahl endet deshalb an der freien Korpushöhe (`maxRaster`) — eine
    Eingabe darüber ist gar nicht erst möglich. Nur ein Altwert, der schon zu hoch
    gespeichert ist, bleibt sichtbar und wird als Fehler gemeldet.
  */
  const rasterEingabe = parseRasterEingabe(element.hoeheRaster)
  const rasterOptionen = Array.from(
    { length: Math.max(0, maxRaster - DREHTUER_RASTER_MIN + 1) },
    (_, i) => String(DREHTUER_RASTER_MIN + i),
  )
  const aktuellerRaster = element.hoeheRaster?.trim() ?? ''
  if (aktuellerRaster && !rasterOptionen.includes(aktuellerRaster)) rasterOptionen.push(aktuellerRaster)
  const korpusText = geometrie?.korpusRaster != null ? `Korpus ${geometrie.korpusRaster} Raster` : 'Korpus'
  const rasterFehler =
    hoeheModus === 'raster' && rasterEingabe != null && rasterEingabe > maxRaster
      ? `Höchstens ${maxRaster} Raster (${korpusText} abzüglich der übrigen Fronten).`
      : undefined
  const cmWert = Number((element.heightCm ?? '').replace(',', '.'))
  const cmFehler =
    hoeheModus === 'cm' && geometrie?.maxHoeheCm != null && Number.isFinite(cmWert) && cmWert > geometrie.maxHoeheCm
      ? `Höher als der freie Korpusbereich (max. ${formatMassZahl(geometrie.maxHoeheCm)} cm).`
      : undefined

  // Überarbeitung 3: Curve mit Mattlack oder „anders" hat gar kein Griffprofil.
  const materialGruppe = frontMaterialGroupId(element)
  const griffProfilEntfaellt =
    element.styleLineId === 'curve' && (materialGruppe === 'mattlack' || materialGruppe === MATERIAL_CUSTOM_ID)

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.typeBadge}>{type?.label ?? element.typeId}</span>
        <button type="button" className={styles.remove} onClick={onRemove}>
          Entfernen
        </button>
      </div>

      {onCopyValues ? (
        <button type="button" className={styles.copyBtn} onClick={onCopyValues}>
          ⧉ Werte von {copyFromLabel ?? 'Front 1'} übernehmen
        </button>
      ) : null}

      <TextField
        label={t('feld.kennzeichnung', 'Kennzeichnung / Position')}
        required
        placeholder="z. B. D1, S1, oben links"
        value={element.label}
        onChange={(event) => onChange({ label: event.target.value })}
        onBlur={() => setLabelTouched(true)}
        error={labelError}
      />

      <div
        className={[styles.sizeRow, type?.ohneHoehe || type?.hoeheModi ? styles.sizeRowSingle : '']
          .filter(Boolean)
          .join(' ')}
      >
        <TextField
          label={t('feld.breite', 'Breite (cm)')}
          inputMode="decimal"
          placeholder="z. B. 50"
          value={element.widthCm ?? ''}
          onChange={(event) => onChange({ widthCm: event.target.value })}
          hint={geometrie?.breitenHinweis}
        />
        {/* Zweiläufige Schiebetür: kein Höhenfeld – sie geht immer über die volle Höhe. */}
        {type?.ohneHoehe || type?.hoeheModi ? null : (
          <TextField
            label={t('feld.hoehe', 'Höhe (cm)')}
            inputMode="decimal"
            placeholder="z. B. 200"
            value={element.heightCm ?? ''}
            onChange={(event) => onChange({ heightCm: event.target.value })}
          />
        )}
      </div>

      {type?.ohneHoehe ? (
        <Beschriftung
          abschnittId="fronten"
          schluessel="feld.volleHoehe"
          standard="Höhe immer über die volle Korpushöhe – technisch nicht anders möglich."
          as="p"
          className={styles.handleHint}
          mehrzeilig
        />
      ) : null}

      {type?.hoeheModi ? (
        <div className={styles.handleBlock}>
          <span className={styles.blockLabel}>
            <Beschriftung
              abschnittId="fronten"
              schluessel="feld.tuerhoehe.titel"
              standard="Türhöhe – genau eine der drei Angaben"
            />
            <Inspector feld="fronten.hoehe" />
            <BeschriftungsGruppe
              abschnittId="fronten"
              titel="Beschriftungen der Front-Karte"
              eintraege={[
                { schluessel: 'feld.kennzeichnung', standard: 'Kennzeichnung / Position', label: 'Kennzeichnung' },
                { schluessel: 'feld.breite', standard: 'Breite (cm)', label: 'Breitenfeld' },
                { schluessel: 'feld.hoehe', standard: 'Höhe (cm)', label: 'Höhenfeld (cm)' },
                { schluessel: 'feld.hoeheRaster', standard: 'Höhe (Raster)', label: 'Höhenfeld (Raster)' },
                {
                  schluessel: 'feld.oberkante',
                  standard: 'Höhe bis Korpusoberkante',
                  label: 'Häkchen „bis Korpusoberkante"',
                },
                { schluessel: 'stillinie.titel', standard: 'Stil-Linie', label: 'Überschrift Stil-Linie' },
                { schluessel: 'anschlag.titel', standard: 'Türanschlag', label: 'Überschrift Türanschlag' },
                { schluessel: 'anschlag.links', standard: 'links', label: 'Türanschlag links' },
                { schluessel: 'anschlag.rechts', standard: 'rechts', label: 'Türanschlag rechts' },
              ]}
            />
          </span>
          <label
            className={[
              styles.check,
              hoeheModus && hoeheModus !== 'korpusoberkante' ? styles.checkDisabled : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={hoeheModus === 'korpusoberkante'}
              disabled={Boolean(hoeheModus) && hoeheModus !== 'korpusoberkante'}
              onChange={(event) => setModusOberkante(event.target.checked)}
            />
            {t('feld.oberkante', 'Höhe bis Korpusoberkante')}
          </label>
          {hoeheModus === 'korpusoberkante' ? (
            <p className={styles.handleHint}>
              {resthoehe
                ? resthoehe.raster != null
                  ? `Ergibt ${resthoehe.raster} Raster ≙ ${formatMassZahl(resthoehe.hoeheCm)} cm (${korpusText} abzüglich der Fronten darunter und darüber; die Tür daneben zählt nicht).`
                  : `Ergibt ${formatMassZahl(resthoehe.hoeheCm)} cm — kein volles Raster (Sondermaß, bepreist mit der nächsten Rasterstufe).`
                : 'Resthöhe noch nicht ableitbar – erst die übrigen Fronten dieses Segments bemaßen.'}
            </p>
          ) : null}
          <div className={styles.hoeheRow}>
            {/*
              Die Rasterzahl ist eine AUSWAHL bis zur freien Korpushöhe. In den beiden anderen
              Modi zeigt sie die erkannte Rasterzahl — nur bei vollen Rastern, sonst bleibt sie
              leer (Überarbeitung 9, S. 2).
            */}
            <Select
              label={t('feld.hoeheRaster', 'Höhe (Raster)')}
              // Im Raster-Modus gibt es statt des Platzhalters einen wählbaren Leer-Eintrag —
              // nur so kommt der Berater wieder zu „bis Korpusoberkante" oder zur cm-Angabe.
              placeholder={
                hoeheModus === 'raster'
                  ? undefined
                  : hoeheModus
                    ? '—'
                    : maxRaster >= DREHTUER_RASTER_MIN
                      ? `${DREHTUER_RASTER_MIN}–${maxRaster}`
                      : 'kein Platz'
              }
              options={[
                ...(hoeheModus === 'raster' ? [{ value: '', label: '– keine Rasterangabe –' }] : []),
                ...rasterOptionen.map((r) => ({ value: r, label: `${r} Raster` })),
              ]}
              value={aktuellerRaster}
              disabled={Boolean(hoeheModus) && hoeheModus !== 'raster'}
              onChange={(event) => setRaster(event.target.value)}
              error={rasterFehler}
            />
            <TextField
              label="Höhe (cm)"
              inputMode="decimal"
              placeholder="z. B. 178,9"
              // In den beiden anderen Modi zeigt das Feld die errechnete Höhe – gesperrt,
              // damit die Umrechnung eine Einbahnstraße bleibt.
              value={element.heightCm ?? ''}
              disabled={Boolean(hoeheModus) && hoeheModus !== 'cm'}
              onChange={(event) => setHoeheCm(event.target.value)}
              error={cmFehler}
              hint={
                hoeheModus && hoeheModus !== 'cm'
                  ? '1 Raster = 12,5 cm, dazwischen je 0,3 cm Fuge – errechnet, nicht editierbar.'
                  : hoeheModus === 'cm' && !element.hoeheRaster
                    ? 'Kein volles Raster – Sondermaß, bepreist mit der nächsten Rasterstufe.'
                    : undefined
              }
            />
          </div>
          {hoeheModus === 'raster' && rasterEingabe != null && !rasterFehler ? (
            <p className={styles.handleHint}>= {formatMassZahl(frontHoeheAusRaster(rasterEingabe))} cm Fronthöhe</p>
          ) : null}
        </div>
      ) : null}

      {/*
        TÜRANSCHLAG — die Reihenfolge ist hier Teil der Bedeutung.

        Die Optionen standen als „rechts, links" in der Reihe: Der LINKE Knopf war mit
        „rechts" beschriftet und umgekehrt. Beim Klicken schaut niemand auf die Schrift,
        sondern auf die Seite — die Türen kamen dadurch spiegelverkehrt in der
        Arbeitsvorbereitung an. „Links" steht deshalb links und steuert die linke Türseite,
        „rechts" steht rechts und steuert die rechte.
      */}
      {type?.tuerAnschlag ? (
        <div className={styles.styleBlock}>
          <span className={styles.blockLabel}>
            <Beschriftung
              abschnittId="fronten"
              schluessel="anschlag.titel"
              standard="Türanschlag"
            />
            <Inspector feld="fronten.anschlag" />
          </span>
          {/*
            Überarbeitung 9, S. 2: „Die Position des Türanschlag soll nur bei Einzeltüren
            abgefragt werden." Beim Türpaar ist sie vorgegeben — links links, rechts rechts —
            und wird nur angezeigt.
          */}
          {geometrie?.anschlagVorgabe ? (
            <p className={styles.vorgabe}>
              {t(`anschlag.${geometrie.anschlagVorgabe}`, geometrie.anschlagVorgabe)}{' '}
              <span className={styles.vorgabeHinweis}>
                — vorgegeben ({geometrie.anschlagVorgabe === 'links' ? 'linke' : 'rechte'} Tür des Türpaars)
              </span>
            </p>
          ) : (
            <div className={styles.handleChecks} role="radiogroup" aria-label="Türanschlag">
              {ANSCHLAG_SEITEN.map((seite) => (
                <label key={seite.key} className={styles.check}>
                  <input
                    type="radio"
                    className={styles.checkbox}
                    name={`anschlag-${element.id}`}
                    checked={element.tuerAnschlag === seite.key}
                    onChange={() => onChange({ tuerAnschlag: seite.key })}
                  />
                  {t(`anschlag.${seite.key}`, seite.label)}
                </label>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {type && type.styleLines.length > 0 ? (
        <div className={styles.styleBlock}>
          <span className={styles.blockLabel}>
            <Beschriftung
              abschnittId="fronten"
              schluessel="stillinie.titel"
              standard="Stil-Linie"
            />
            <Inspector feld="fronten.stilLinie" />
          </span>
          <div className={styles.styleChips}>
            {type.styleLines.map((line) => (
              <button
                key={line.id}
                type="button"
                className={[styles.chip, element.styleLineId === line.id ? styles.chipActive : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => pickStyleLine(line.id)}
                aria-pressed={element.styleLineId === line.id}
              >
                {line.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className={styles.openNote}>Offenes Fach – keine Frontauswahl erforderlich.</p>
      )}

      {styleLine ? (
        <div className={styles.fields}>
          {styleLine.fields
            .filter((field) => isFrontFieldVisible(field, element))
            .map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                styleLine={styleLine}
                element={element}
                value={element.fieldValues?.[field.id]}
                onChange={(value) => setField(field.id, value)}
                onMaterialChange={(material) => setMaterial(field, element.fieldValues?.[field.id], material)}
                onLineGleich={setLineGleich}
              />
            ))}
        </div>
      ) : null}

      {styleLine?.handleOptions ? (
        <div className={styles.handleBlock}>
          <span className={styles.blockLabel}>Griff-Optionen</span>
          <div className={styles.handleChecks}>
            <label className={[styles.check, element.griff ? styles.checkDisabled : ''].filter(Boolean).join(' ')}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={Boolean(element.pto)}
                disabled={Boolean(element.griff)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? { pto: true, griff: false, griffId: undefined, griffFarbe: undefined }
                      : { pto: false },
                  )
                }
              />
              PTO (Push-to-Open)
            </label>
            <label className={[styles.check, element.pto ? styles.checkDisabled : ''].filter(Boolean).join(' ')}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={Boolean(element.griff)}
                disabled={Boolean(element.pto)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? { griff: true, pto: false }
                      : { griff: false, griffId: undefined, griffFarbe: undefined, griffLaengeCm: undefined },
                  )
                }
              />
              Griff
            </label>
          </div>
          <p className={styles.handleHint}>PTO und Griff schließen sich gegenseitig aus.</p>
          {element.griff ? (
            <Select
              label="Griff-Auswahl"
              placeholder="Bitte Griff wählen"
              options={getAvailableHandles(element.styleLineId, element.typeId).map((handle) => ({
                value: handle.id,
                label: handle.label,
              }))}
              value={element.griffId ?? ''}
              onChange={(event) =>
                onChange({
                  griffId: event.target.value,
                  ...(event.target.value !== EDGE_HANDLE_ID ? { griffLaengeCm: undefined } : {}),
                })
              }
            />
          ) : null}
          {istEdge ? (
            <p className={styles.handleHint}>
              Edge: Stahl, nur vertikal. Berechnet nach laufendem Meter über die Türhöhe
              {EDGE_KUERZBAR_FRONT_TYPE_IDS.includes(element.typeId)
                ? ' — bei Drehtüren auch gekürzt möglich.'
                : ' — bei Schiebetüren immer über die volle Türhöhe (Stabilität).'}
            </p>
          ) : null}
          {istEdge && EDGE_KUERZBAR_FRONT_TYPE_IDS.includes(element.typeId) ? (
            <TextField
              label="Grifflänge (cm)"
              inputMode="decimal"
              placeholder={element.heightCm ? `volle Türhöhe (${element.heightCm} cm)` : 'volle Türhöhe'}
              value={element.griffLaengeCm ?? ''}
              onChange={(event) => onChange({ griffLaengeCm: event.target.value || undefined })}
              hint="Leer lassen = volle Türhöhe. Kürzer möglich, länger nicht."
              error={griffLaengeFehler}
            />
          ) : null}
          {styleLine?.id === 'glossy' || styleLine?.id === 'less' ? (
            <p className={styles.handleHint}>
              Bei Glossy/Less nicht möglich: Griff Nr. 103, 125, 126, 128 und Edge. Nr. 127 ist
              ausschließlich hier möglich (wird auf das Glas geklebt).
            </p>
          ) : null}
          {element.griff && element.griffId ? (
            <TextField
              label={istEdge ? 'RAL-Ton (Stahl)' : 'Griffdetails'}
              placeholder={istEdge ? 'z. B. RAL 9005 Tiefschwarz' : 'z. B. Farbe / Sondergriff / spezielle Position'}
              value={element.griffFarbe ?? ''}
              onChange={(event) => onChange({ griffFarbe: event.target.value })}
            />
          ) : null}
        </div>
      ) : null}

      {type?.laufschiene ? (
        <TextField
          label="Laufschienenfarbe (einläufig)"
          placeholder="z. B. RAL 9005, alu eloxiert"
          value={element.laufschienenfarbe ?? ''}
          onChange={(event) => onChange({ laufschienenfarbe: event.target.value })}
        />
      ) : null}

      {/* Überarbeitung 3: nur noch „Edge"; bei Curve mit Mattlack/anders entfällt das Profil ganz. */}
      {type?.griffProfil && !griffProfilEntfaellt ? (
        <div className={styles.styleBlock}>
          <span className={styles.blockLabel}>Griffprofil</span>
          <div className={styles.styleChips}>
            <button
              type="button"
              className={[styles.chip, element.griffProfil === 'edge' ? styles.chipActive : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => onChange({ griffProfil: 'edge' })}
              aria-pressed={element.griffProfil === 'edge'}
            >
              Edge
            </button>
          </div>
          {/* Punkt 7.13 – keine feste Liste: alle RAL-Classic-Farben sind möglich. */}
          {element.griffProfil ? (
            <TextField
              label="Pulverfarbe Griffprofil"
              placeholder="z. B. RAL 9005 – alle RAL-Classic-Farben möglich"
              value={element.griffProfilFarbe ?? ''}
              onChange={(event) => onChange({ griffProfilFarbe: event.target.value })}
            />
          ) : null}
        </div>
      ) : null}

      {heightViolation ? (
        <p className={styles.warning} role="alert">
          ⚠ {type?.label} maximal bis {maxHeight} cm Höhe zulässig! (aktuell {element.heightCm} cm)
        </p>
      ) : null}
    </div>
  )
}

function FieldRenderer({
  field,
  styleLine,
  element,
  value,
  onChange,
  onMaterialChange,
  onLineGleich,
}: {
  field: FrontField
  styleLine: FrontStyleLine
  element: FrontElement
  value: FrontFieldValue | undefined
  onChange: (value: FrontFieldValue) => void
  onMaterialChange: (material: MaterialSelection) => void
  onLineGleich: (gleich: boolean) => void
}) {
  if (field.kind === 'freetext') {
    return (
      <TextField
        label={field.label}
        placeholder={field.placeholder}
        value={value?.text ?? ''}
        onChange={(event) => onChange({ text: event.target.value })}
      />
    )
  }

  // „Line"-Aufkantung: ein einzelnes Dropdown über eine oder drei Materialgruppen.
  if (field.groupsFromFrontscheibe) {
    return <AufkantungField field={field} element={element} value={value} onChange={onChange} />
  }

  const material = value?.material
  const gruppeId = material?.materialGroupId
  const istAnders = gruppeId === MATERIAL_CUSTOM_ID
  const gruppeLabel = getMaterialGroup(gruppeId)?.label
  const istLineMaterial = Boolean(styleLine.frontscheibeAufkantung) && field.id === 'material'
  const getrennt = istLineMaterial && element.lineAufkantungGleich === false && gruppeId != null && !istAnders
  const hatAuswahl = Boolean(material?.optionId) || Boolean(material?.customText?.trim())
  /**
   * Bei „Line" folgt die Ja/Nein-Frage DIREKT auf die Materialwahl und steht OBERHALB der
   * Ausführung (Überarbeitung 9, S. 8: „Soll oberhalb der Glasausführung stehen bleiben."):
   *   Material → „… gleich?" → Ausführung (bei „Ja") bzw. Frontscheibe + Aufkantung (bei „Nein").
   * `MaterialSelect` zeigt deshalb bei Line nur die Material-Chips; das Ausführungs-
   * Dropdown baut diese Komponente selbst unter die Frage.
   */
  const lineAusfuehrungHier = istLineMaterial && !istAnders && gruppeId != null
  const gleich = istLineMaterial && element.lineAufkantungGleich === true && gruppeId != null && !istAnders
  const ausgeschlossen = ausgeschlosseneOptionIds(styleLine, gruppeId)
  const ausfuehrungsOptionen = (getMaterialGroup(gruppeId)?.options ?? [])
    .filter((option) => !ausgeschlossen.includes(option.id))
    .map((option) => ({ value: option.id, label: option.label }))
  const waehleAusfuehrung = (optionId: string) =>
    onMaterialChange({
      ...(material as MaterialSelection),
      optionId,
      priceGroup: resolvePriceGroup(gruppeId, optionId),
    })
  const legacyNotiz = !field.withNote && value?.note?.trim()

  return (
    <div className={styles.matField}>
      <span className={styles.matLabel}>{field.label}</span>
      <MaterialSelect
        groupIds={field.materialGroupIds ?? []}
        allowCustom={field.allowCustom ?? false}
        value={material}
        onChange={onMaterialChange}
        customPlaceholder={field.customPlaceholder}
        hideOptionSelect={lineAusfuehrungHier}
        excludeOptionIds={ausgeschlossen}
        // Eigene Preisspalte (Line/107/Curve/Glossy·Less) statt PG 1–4.
        hideCustomPriceGroup={Boolean(styleLine.eigenePreisspalte)}
        priceColumnLabel={hatAuswahl ? styleLine.eigenePreisspalte : undefined}
      />

      {/* Überarbeitung 3 („Line"): Ja/Nein direkt nach der Materialwahl. */}
      {istLineMaterial && gruppeId != null && !istAnders ? (
        <div className={styles.styleBlock}>
          <span className={styles.blockLabel}>
            {gruppeId === 'glas'
              ? 'Glas der Frontscheibe und der Aufkantung gleich?'
              : 'Frontscheibe und der Aufkantung gleich?'}
          </span>
          <div className={styles.styleChips}>
            {[
              { gleich: true, label: 'Ja' },
              { gleich: false, label: 'Nein' },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                className={[
                  styles.chip,
                  element.lineAufkantungGleich === option.gleich ? styles.chipActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onLineGleich(option.gleich)}
                aria-pressed={element.lineAufkantungGleich === option.gleich}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* „Ja": eine Ausführung für Frontscheibe und Aufkantung; „Nein": die Frontscheibe
          hier, die Aufkantung als eigenes Feld darunter. */}
      {gleich || getrennt ? (
        <Select
          label={`${gruppeLabel ?? 'Material'} – ${getrennt ? 'Ausführung Frontscheibe' : 'Ausführung'}`}
          placeholder="Bitte wählen"
          options={ausfuehrungsOptionen}
          value={aktuelleOptionId(gruppeId, material?.optionId) ?? ''}
          onChange={(event) => waehleAusfuehrung(event.target.value)}
        />
      ) : null}

      {/*
        Überarbeitung 9: Das allgemeine Freitextfeld „Sonderwünsche" ist bei katalogisierten
        Materialien entfallen. Ein Altentwurf, der dort schon etwas stehen hat, zeigt es
        weiter an — sonst stünde im AV-PDF ein Text, den niemand mehr sieht oder ändern kann.
      */}
      {(field.withNote && !istAnders) || legacyNotiz ? (
        <TextField
          label={field.withNote ? 'Freitext' : 'Freitext (bisherige Angabe)'}
          placeholder={field.notePlaceholder}
          value={value?.note ?? ''}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
        />
      ) : null}
    </div>
  )
}

/**
 * Aufkantung der Stil-Linie „Line": ein Dropdown, dessen Auswahl die Materialgruppe
 * mitführt – bei Furnier stehen alle Furniere, Gläser und Mattlacke zur Wahl.
 */
function AufkantungField({
  field,
  element,
  value,
  onChange,
}: {
  field: FrontField
  element: FrontElement
  value: FrontFieldValue | undefined
  onChange: (value: FrontFieldValue) => void
}) {
  const groupIds = aufkantungGroupIds(element)
  const styleLine = getStyleLine(element.typeId, element.styleLineId)
  const frontGruppe = getMaterialGroup(frontMaterialGroupId(element))
  const material = value?.material
  const aktuell =
    material?.materialGroupId && material.optionId
      ? encodeAufkantungValue(
          material.materialGroupId,
          aktuelleOptionId(material.materialGroupId, material.optionId) ?? material.optionId,
        )
      : ''

  return (
    <div className={styles.matField}>
      <Select
        label={`${frontGruppe?.label ?? 'Material'} – ${field.label}`}
        placeholder="Bitte wählen"
        options={aufkantungOptions(groupIds, (groupId) => ausgeschlosseneOptionIds(styleLine, groupId))}
        value={aktuell}
        onChange={(event) => {
          const gewaehlt = decodeAufkantungValue(event.target.value)
          if (!gewaehlt) return
          onChange({
            ...value,
            material: {
              materialGroupId: gewaehlt.groupId,
              optionId: gewaehlt.optionId,
              priceGroup: resolvePriceGroup(gewaehlt.groupId, gewaehlt.optionId),
            },
          })
        }}
      />
    </div>
  )
}
