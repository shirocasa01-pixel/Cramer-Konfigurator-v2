import type { Draft, KorpusEinheit, KorpusGrunddaten, Verblendung } from '../types/index.ts'
import { hatBeleuchtung } from '../config/equipment.ts'
import { meta } from '../data/stammdaten.generated.ts'
import { formatMassZahl } from './format.ts'
import { caPrefix } from './massFormat.ts'
import {
  ABSCHLUSSSET_MM,
  FUGE_MM,
  anzahlAbschlusssets,
  aussenbreiteMm,
  frontAufteilung,
  mmZuCm,
  type FrontAufteilung,
} from './frontbreiten.ts'

/**
 * KORPUS-MASSBERECHNUNG (Punkte 4.10 und 4.13).
 *
 * Die Ableitung läuft über die Fronten, nicht über die Korpus-Nennbreiten:
 *
 *     Korpus-Nennbreite  →  Frontbreite(n)  →  Außenmaß
 *          (Auswahl)         (Tabelle 4.13)     (Fugen + Abschlusssets)
 *
 * Die Regel und ihre Gegenprobe an Dietmars drei Maßskizzen stehen in
 * `lib/frontbreiten.ts`. Diese Datei bringt sie mit den erfassten Grunddaten
 * zusammen und liefert die Zeilen für Zusammenfassung und AV-PDF.
 *
 * Die Korpus-Nennbreite bleibt der Preisschlüssel (Achse BREITE der Preiszeilen);
 * das hier errechnete Außenmaß ist die Fertigungsangabe für die AV. Beides ist
 * bewusst getrennt — ein 50er Korpus heißt „50er" und misst 494 mm.
 */

export { FUGE_MM, ABSCHLUSSSET_MM }

/** Standard-Rasterhöhen (cm, „ca."). */
export const RASTER_HEIGHT_CM: Record<'18R' | '21R', number> = { '18R': 235, '21R': 274 }

function parseNum(v: string | undefined): number | undefined {
  if (!v || !v.trim()) return undefined
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Numerische Höhe (cm) aus den Korpus-Grunddaten. */
export function resolveHeightCm(g: KorpusGrunddaten | undefined): number | undefined {
  if (!g) return undefined
  return g.heightMode === 'custom' ? parseNum(g.heightCm) : RASTER_HEIGHT_CM[g.heightMode]
}

/** Numerische Tiefe (cm) aus den Korpus-Grunddaten. */
export function resolveDepthCm(g: KorpusGrunddaten | undefined): number | undefined {
  if (!g) return undefined
  return g.depthMode === 'custom' ? parseNum(g.depthCm) : 60
}

/** Numerische Nennbreite (cm) einer Korpus-Einheit (50/60/100 oder Sondermaß). */
export function resolveKorpusBreiteCm(k: KorpusEinheit): number | undefined {
  return k.breiteMode === 'custom' ? parseNum(k.breiteCm) : Number(k.breiteMode)
}

/** Koordinate je Korpus – linke Kante (xPos) als laufende Summe der Breiten (Basis für 2D/3D). */
export interface KorpusKoordinate {
  id: string
  breiteCm?: number
  /** Linke Kante ab 0 (cm), gerechnet über die Fronten inklusive Fugen und Abschlussset links. */
  xPosCm: number
  lochreihe: boolean
}

/**
 * Koordinaten aller Korpusse (von links nach rechts).
 *
 * Gerechnet wird über die tatsächlichen Bauteilbreiten: links beginnt es beim
 * Abschlussset, jede Front schiebt die Kante um ihre Breite plus eine Fuge weiter.
 * Damit stimmen die Koordinaten mit dem Außenmaß überein — Voraussetzung für die
 * spätere 2D/3D-Darstellung.
 */
export function computeKorpusKoordinaten(g: KorpusGrunddaten | undefined): KorpusKoordinate[] {
  if (!g) return []
  const links = g.abschlussSet?.position === 'links' || g.abschlussSet?.position === 'beide'
  let xMm = links ? ABSCHLUSSSET_MM + FUGE_MM : 0

  return g.korpusse.map((k) => {
    const breiteCm = resolveKorpusBreiteCm(k)
    const coord: KorpusKoordinate = {
      id: k.id,
      breiteCm,
      xPosCm: mmZuCm(xMm),
      lochreihe: k.lochreihe,
    }
    const aufteilung = frontAufteilung(breiteCm)
    // Fronten des Korpus plus die Fugen zwischen ihnen und eine Fuge zum nächsten Bauteil.
    xMm += aufteilung ? aufteilung.summeMm + aufteilung.anzahl * FUGE_MM : 0
    return coord
  })
}

/** Frontaufteilung je Korpus, von links nach rechts. */
export function korpusFrontAufteilungen(g: KorpusGrunddaten | undefined): FrontAufteilung[] {
  if (!g) return []
  return g.korpusse
    .map((k) => frontAufteilung(resolveKorpusBreiteCm(k)))
    .filter((a): a is FrontAufteilung => a != null)
}

/** Summe der Korpus-NENNbreiten (cm) – Preisschlüssel, nicht das Fertigungsmaß. */
export function totalKorpusBreiteCm(g: KorpusGrunddaten | undefined): number | undefined {
  if (!g || g.korpusse.length === 0) return undefined
  let sum = 0
  for (const k of g.korpusse) {
    const w = resolveKorpusBreiteCm(k)
    if (w == null) return undefined
    sum += w
  }
  return sum
}

/**
 * Leitet die Legacy-`dimensions` (H/B/T + Segmente) aus den Grunddaten ab, damit alle
 * bestehenden Downstream-Konsumenten (Fronten-Spalten, Summary, PDF, Guards) unverändert
 * weiterlaufen. Die Breite ist ab Punkt 4.13 das ERRECHNETE Außenmaß, nicht mehr die
 * Summe der Nennbreiten.
 */
export function deriveDimensions(g: KorpusGrunddaten): NonNullable<Draft['dimensions']> {
  const h = resolveHeightCm(g)
  const masse = berechneAussenmass(g)
  const t = resolveDepthCm(g)
  return {
    heightCm: h != null ? String(h) : '',
    widthCm: masse.gesamtbreiteCm != null ? String(masse.gesamtbreiteCm) : '',
    depthCm: t != null ? String(t) : '',
    segments: g.korpusse.length,
  }
}

/**
 * Sondertiefe (Korpustiefe < 60 cm)? Regel S. 5: „Bei Sondertiefen sollen als
 * Ausstattung nur Einlegeböden möglich sein!" Bevorzugt die Grunddaten (Refugium),
 * sonst die Legacy-`dimensions`.
 */
export function isSondertiefeDepth(draft: Draft): boolean {
  const g = draft.korpusGrunddaten
  if (g) {
    const t = resolveDepthCm(g)
    return t != null && t < 60
  }
  const t = parseNum(draft.dimensions?.depthCm)
  return t != null && t < 60
}

/** Vollständig, wenn Höhe & Tiefe auflösbar sind und jeder Korpus eine gültige Breite hat. */
export function isKorpusGrunddatenComplete(g: KorpusGrunddaten | undefined): boolean {
  if (!g || g.korpusse.length === 0) return false
  if (resolveHeightCm(g) == null || resolveDepthCm(g) == null) return false
  return g.korpusse.every((k) => resolveKorpusBreiteCm(k) != null)
}

// ---------------------------------------------------------------------------
// Außenmaß
// ---------------------------------------------------------------------------

/**
 * Tiefenzugabe für die Kabelführung bei Beleuchtung, in cm — Satz aus „50 Meta".
 *
 * Überarbeitung 8, S. 1: „Sobald bei der Ausstattung eine Beleuchtung (LED-Band oder
 * Syncro-Licht) gewählt wird, erhöht sich die Tiefe um + 1 cm. (Diesen größeren Abstand
 * zwischen Möbelrückwand und Mauer nutzen wir zur Kabelführung)."
 *
 * Das ist ein PLANUNGSMASS: Der Korpus selbst bleibt ein 60er und wird mit der 60er-Preiszeile
 * bepreist — die Kalkulation liest die Tiefe über `resolveDepthCm`, nicht von hier.
 */
export const BELEUCHTUNG_TIEFENZUGABE_CM = meta.beleuchtungTiefenzugabeMm / 10

/** Wovon das Außenmaß außer den Grunddaten abhängt. */
export interface AussenmassOptionen {
  /** In der Ausstattungs-Vorauswahl ist eine Beleuchtung mit Kabelführung gewählt. */
  beleuchtung?: boolean
}

/** Optionen des Außenmaßes aus einem Entwurf. */
export function aussenmassOptionen(draft: Pick<Draft, 'ausstattung'>): AussenmassOptionen {
  return { beleuchtung: hatBeleuchtung(draft.ausstattung?.selected) }
}

export interface KorpusMasse {
  /** Gesamthöhe (cm). */
  gesamthoeheCm?: number
  /** Außenbreite (cm) – aus den Frontbreiten, inkl. Fugen und Abschlusssets. */
  gesamtbreiteCm?: number
  /**
   * Korpustiefe ohne Fronten (cm) als PLANUNGSMASS — bei Beleuchtung inklusive der
   * Tiefenzugabe für die Kabelführung (Überarbeitung 8).
   */
  korpustiefeCm?: number
  /** Die gewählte Korpustiefe ohne Zugabe (cm) — zugleich die Preisachse. */
  korpustiefeNennCm?: number
  /** Tiefenzugabe für die Kabelführung (cm); nur gesetzt, wenn eine Beleuchtung gewählt ist. */
  beleuchtungZugabeCm?: number
  /** Gesamttiefe inkl. Fußleistenausschnitt (cm) – nur gesetzt, wenn ein Ausschnitt konfiguriert ist. */
  gesamttiefeCm?: number
  /** Rechenweg der Breite im Klartext. */
  rechenweg?: string
  /** Anzahl Fronten über das ganze Möbel. */
  anzahlFronten: number
  /** Anzahl Fugen laut Regel. */
  anzahlFugen: number
  /** Anzahl Abschlusssets. */
  anzahlAbschlusssets: number
  /** true, sobald die Rechenregel greifen konnte (alle Breiten auflösbar). */
  berechnet: boolean
  /** Hinweise zu einzelnen Korpusbreiten (unbestätigte Tabellenwerte, Sondermaße). */
  hinweise: string[]
}

/** Außenmaß aus den Korpus-Grunddaten. */
export function berechneAussenmass(g: KorpusGrunddaten | undefined, optionen: AussenmassOptionen = {}): KorpusMasse {
  const leer: KorpusMasse = {
    anzahlFronten: 0,
    anzahlFugen: 0,
    anzahlAbschlusssets: 0,
    berechnet: false,
    hinweise: [],
  }
  if (!g || g.korpusse.length === 0) return leer

  const hinweise: string[] = []
  const frontenMm: number[] = []
  let vollstaendig = true

  for (const [index, k] of g.korpusse.entries()) {
    const breiteCm = resolveKorpusBreiteCm(k)
    const aufteilung = frontAufteilung(breiteCm)
    if (!aufteilung) {
      vollstaendig = false
      continue
    }
    for (let i = 0; i < aufteilung.anzahl; i++) frontenMm.push(aufteilung.frontMm)
    if (aufteilung.hinweis) hinweise.push(`Korpus ${index + 1}: ${aufteilung.hinweis}`)
  }

  const anzahlSets = anzahlAbschlusssets(g.abschlussSet?.position)
  const breite = aussenbreiteMm(frontenMm, anzahlSets)

  const hoehe = resolveHeightCm(g)
  const nennTiefe = resolveDepthCm(g)
  const zugabe = optionen.beleuchtung && BELEUCHTUNG_TIEFENZUGABE_CM > 0 ? BELEUCHTUNG_TIEFENZUGABE_CM : undefined
  const tiefe = nennTiefe != null ? Math.round((nennTiefe + (zugabe ?? 0)) * 10) / 10 : undefined
  const ausschnittTiefe = g.fussleiste?.enabled ? parseNum(g.fussleiste.tiefeCm) : undefined

  return {
    gesamthoeheCm: hoehe,
    gesamtbreiteCm: vollstaendig && frontenMm.length > 0 ? mmZuCm(breite.gesamtMm) : undefined,
    korpustiefeCm: tiefe,
    korpustiefeNennCm: nennTiefe,
    beleuchtungZugabeCm: zugabe,
    gesamttiefeCm:
      tiefe != null && ausschnittTiefe != null ? Math.round((tiefe + ausschnittTiefe) * 10) / 10 : undefined,
    rechenweg: frontenMm.length > 0 ? breite.rechenweg : undefined,
    anzahlFronten: breite.anzahlFronten,
    anzahlFugen: breite.anzahlFugen,
    anzahlAbschlusssets: anzahlSets,
    berechnet: vollstaendig && frontenMm.length > 0,
    hinweise,
  }
}

/**
 * Außenmaß eines Entwurfs. Bevorzugt die strukturierten Grunddaten (Refugium);
 * ohne sie bleiben nur die Direkteingaben, die dann unverändert durchgereicht werden.
 */
export function computeKorpusMasse(draft: Draft): KorpusMasse {
  const g = draft.korpusGrunddaten
  if (g) return berechneAussenmass(g, aussenmassOptionen(draft))

  const dim = draft.dimensions
  const zahl = (v: string | undefined) => parseNum(v)
  return {
    gesamthoeheCm: zahl(dim?.heightCm),
    gesamtbreiteCm: zahl(dim?.widthCm),
    korpustiefeCm: zahl(dim?.depthCm),
    anzahlFronten: 0,
    anzahlFugen: 0,
    anzahlAbschlusssets: 0,
    berechnet: false,
    hinweise: [],
  }
}

/** Anzeige-Text für ein einzelnes Maß („ca. 298,1 cm", sonst „—"). */
export function formatKorpusMass(value: number | string | undefined): string {
  if (value == null) return '—'
  if (typeof value === 'number') return `${caPrefix()}${formatMassZahl(value)} cm`
  const raw = value.trim()
  if (!raw) return '—'
  const zahl = Number(raw.replace(',', '.'))
  return `${caPrefix()}${Number.isFinite(zahl) ? formatMassZahl(zahl) : raw} cm`
}

export interface KorpusGrunddatenZeile {
  label: string
  value: string
}

/**
 * Klartext-Zeilen der Korpus-Grunddaten für Zusammenfassung & AV-PDF (identisch).
 * Höhe/Tiefe, Nennbreite und abgeleitete Frontbreiten je Korpus, Abschlussset,
 * Fußleistenausschnitt, Sonderformen und die Fixmaß-/Sondermaß-Notiz.
 */
export function describeKorpusGrunddatenZeilen(
  g: KorpusGrunddaten,
  optionen: AussenmassOptionen = {},
): KorpusGrunddatenZeile[] {
  const rows: KorpusGrunddatenZeile[] = []
  const h = resolveHeightCm(g)
  const heightLabel = g.heightMode === '18R' ? '18 Raster' : g.heightMode === '21R' ? '21 Raster' : 'Sondermaß'
  rows.push({ label: 'Höhe', value: `${heightLabel}${h != null ? ` (ca. ${formatMassZahl(h)} cm)` : ''}` })

  const t = resolveDepthCm(g)
  const zugabe = optionen.beleuchtung && BELEUCHTUNG_TIEFENZUGABE_CM > 0 ? BELEUCHTUNG_TIEFENZUGABE_CM : 0
  rows.push({
    label: 'Tiefe',
    value:
      `${g.depthMode === '60' ? 'Standard' : 'Sondermaß'}${t != null ? ` (ca. ${formatMassZahl(t)} cm)` : ''}` +
      (t != null && zugabe > 0
        ? ` · Planungstiefe ca. ${formatMassZahl(Math.round((t + zugabe) * 10) / 10)} cm inkl. ${formatMassZahl(zugabe)} cm Kabelführung (Beleuchtung)`
        : ''),
  })

  g.korpusse.forEach((k, i) => {
    const w = resolveKorpusBreiteCm(k)
    const aufteilung = frontAufteilung(w)
    const parts = [w != null ? `${formatMassZahl(w)}er Korpus` : '—']
    if (aufteilung) {
      const front = formatMassZahl(mmZuCm(aufteilung.frontMm))
      parts.push(aufteilung.anzahl === 1 ? `Front ${front} cm` : `${aufteilung.anzahl} × Front ${front} cm`)
    }
    if (k.lochreihe) parts.push('Lochreihe')
    rows.push({ label: `Korpus ${i + 1}`, value: parts.join(' · ') })
  })

  const a = g.abschlussSet
  if (a && a.position !== 'keine') {
    const posLabel = a.position === 'beide' ? 'links & rechts' : a.position === 'links' ? 'nur links' : 'nur rechts'
    rows.push({ label: 'Abschlussset', value: posLabel })
    // Das Material wird im Schritt „Korpus" gewählt und dort auch beschrieben;
    // hier stehen nur die Angaben aus den Grunddaten.
    if (a.materialGetrennt) {
      rows.push({ label: 'Abschlussset Material', value: 'links und rechts getrennt gewählt' })
    }
  }

  // Verblendung steht seit Überarbeitung 6 (S. 7) hier statt bei der Ausstattung — in
  // derselben Reihenfolge wie in der Maske: zwischen Abschlussset und Fußleistenausschnitt.
  const v = g.verblendung
  if (v && v.art !== 'keine') {
    const teile = [v.art === 'korpusbuendig' ? 'korpusbündig' : 'frontbündig']
    const seiten = verblendungSeitenText(v)
    if (seiten) teile.push(seiten)
    const lfm = verblendungLfm(g)
    if (lfm != null) teile.push(`${formatLfm(lfm)} lfm${v.lfmManuell ? ' (manuell)' : ''}`)
    if (v.positionNote?.trim()) teile.push(v.positionNote.trim())
    rows.push({ label: 'Verblendung', value: teile.join(' · ') })
  }

  if (g.fussleiste?.enabled) {
    rows.push({
      label: 'Fußleistenausschnitt',
      value: `H ${g.fussleiste.hoeheCm?.trim() || '?'} cm · T ${g.fussleiste.tiefeCm?.trim() || '?'} cm`,
    })
  }
  if (g.sonderformen?.trim()) rows.push({ label: 'Sonderformen', value: g.sonderformen.trim() })
  if (g.sondermasse?.trim()) rows.push({ label: 'Fixmaße / Sondermaße', value: g.sondermasse.trim() })
  return rows
}

// ---------------------------------------------------------------------------
// Verblendung — Laufmeter aus Position und Schrankmaßen
// ---------------------------------------------------------------------------

/**
 * Seiten der Verblendung in der Reihenfolge, in der sie im Möbel liegen.
 *
 * Überarbeitung 8, S. 1: „Man könnte natürlich auch überlegen, dass der Verkäufer nur einen
 * Haken bei links, rechts oder oben setzen kann. Daraus könnte sich das System selbst die lfm
 * errechnen und daraus den VK-Preis errechnen."
 */
export const VERBLENDUNG_SEITEN = [
  { key: 'links', label: 'Links', mass: 'hoehe' },
  { key: 'oben', label: 'Oben', mass: 'breite' },
  { key: 'rechts', label: 'Rechts', mass: 'hoehe' },
] as const

export type VerblendungSeite = (typeof VERBLENDUNG_SEITEN)[number]['key']

function runde2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Die beiden Bezugsmaße in Metern:
 *   Schrankhöhe  — aus den gewählten Rastern bzw. Zentimetern (18 R → 2,35 m),
 *   Schrankbreite — Summe aller Korpusbreiten (3 × 100er → 3,00 m).
 */
export function verblendungBezugsmasse(g: KorpusGrunddaten | undefined): { hoeheM?: number; breiteM?: number } {
  const h = resolveHeightCm(g)
  const b = totalKorpusBreiteCm(g)
  return {
    hoeheM: h != null ? runde2(h / 100) : undefined,
    breiteM: b != null ? runde2(b / 100) : undefined,
  }
}

/** Sind Seiten angehakt? (Sonst ist der Entwurf von vor den Haken und `lfm` ist Freitext.) */
function hatSeiten(v: Verblendung | undefined): boolean {
  return Boolean(v?.seiten && (v.seiten.links || v.seiten.oben || v.seiten.rechts))
}

/** Errechnete Laufmeter: links/rechts je Schrankhöhe, oben Schrankbreite. */
export function verblendungAutoLfm(g: KorpusGrunddaten | undefined): number | undefined {
  const v = g?.verblendung
  if (!v || !hatSeiten(v)) return undefined
  const { hoeheM, breiteM } = verblendungBezugsmasse(g)
  let summe = 0
  for (const seite of VERBLENDUNG_SEITEN) {
    if (!v.seiten?.[seite.key]) continue
    const mass = seite.mass === 'hoehe' ? hoeheM : breiteM
    if (mass == null) return undefined
    summe += mass
  }
  return runde2(summe)
}

function parseLfm(text: string | undefined): number | undefined {
  if (!text || !text.trim()) return undefined
  const n = Number(text.trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * Die Laufmeter, die gelten: manuell überschrieben → der eingetragene Wert; Seiten angehakt →
 * die errechneten; sonst (Altbestand) der Freitext.
 */
export function verblendungLfm(g: KorpusGrunddaten | undefined): number | undefined {
  const v = g?.verblendung
  if (!v || v.art === 'keine') return undefined
  if (v.lfmManuell) return parseLfm(v.lfm)
  return hatSeiten(v) ? verblendungAutoLfm(g) : parseLfm(v.lfm)
}

/** „Links, Oben" — oder `undefined` ohne Haken. */
export function verblendungSeitenText(v: Verblendung | undefined): string | undefined {
  if (!v?.seiten) return undefined
  const teile = VERBLENDUNG_SEITEN.filter((s) => v.seiten?.[s.key]).map((s) => s.label)
  return teile.length ? teile.join(', ') : undefined
}

/** Rechenweg der automatischen Laufmeter: „2,35 m (links) + 3,00 m (oben)". */
export function verblendungRechenweg(g: KorpusGrunddaten | undefined): string | undefined {
  const v = g?.verblendung
  if (!v || !hatSeiten(v)) return undefined
  const { hoeheM, breiteM } = verblendungBezugsmasse(g)
  const teile = VERBLENDUNG_SEITEN.filter((s) => v.seiten?.[s.key]).map((s) => {
    const mass = s.mass === 'hoehe' ? hoeheM : breiteM
    return `${mass != null ? formatLfm(mass) : '?'} m (${s.label.toLowerCase()})`
  })
  return teile.join(' + ')
}

/** Laufmeter in deutscher Schreibweise mit zwei Nachkommastellen („5,35"). */
export function formatLfm(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

/**
 * Hält den gespeicherten Laufmeter-Text an der Rechnung, solange er nicht manuell
 * überschrieben ist — ältere Leser (und Menschen, die das JSON ansehen) finden dort
 * denselben Wert wie die Kalkulation.
 */
export function normalisiereVerblendung(g: KorpusGrunddaten): KorpusGrunddaten {
  const v = g.verblendung
  if (!v || v.lfmManuell || !hatSeiten(v)) return g
  const auto = verblendungAutoLfm(g)
  const text = auto != null ? formatLfm(auto) : ''
  return (v.lfm ?? '') === text ? g : { ...g, verblendung: { ...v, lfm: text } }
}
