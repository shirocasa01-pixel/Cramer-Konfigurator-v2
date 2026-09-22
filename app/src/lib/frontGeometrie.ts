/**
 * FRONT-GEOMETRIE — die Modulregel „Welche Breite ist frei, welche Höhe erlaubt?"
 *
 * Überarbeitung 9, S. 1: „Hier muss man Zusammenhänge herstellen und das ganze System
 * nochmal prüfen." Bis hierher kannte jede Front nur sich selbst: Eine 70-cm-Tür passte
 * in einen 50er Korpus, eine 21-Raster-Tür in einen 18-Raster-Korpus, und nach einer
 * Änderung der Korpusbreite blieben die alten Türbreiten unbemerkt stehen.
 *
 * Diese Datei ist die EINE Stelle, an der die Fronten eines Segments zueinander und zum
 * Korpus in Beziehung gesetzt werden. Oberfläche, Validierung und Kalkulation lesen alle
 * von hier — keine Komponente rechnet eine eigene Fassung.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DAS MODELL
 *
 *   Frontbereich   Die Breite, die die Fronten EINER Ebene zusammen füllen:
 *                  Korpusbreite minus Restmaß (`frontAufteilung().summeMm`, Punkt 4.13).
 *                  100er Korpus → 98 cm, 60er → 59 cm, 50er → 49 cm.
 *
 *   Ebene          Fronten, die NEBENEINANDER sitzen. Die Liste eines Segments ist von
 *                  unten nach oben geordnet; aufeinanderfolgende Fronten gehören zu
 *                  derselben Ebene, solange ihre Breiten zusammen in den Frontbereich
 *                  passen. 100er mit D1 49 + D2 49 → eine Ebene, zwei Flügel.
 *                  50er mit D1 49 + D2 49 → zwei Ebenen übereinander.
 *
 *   Frontzone      Die Höhe, die die Ebenen zusammen füllen, in „Raster-Millimetern":
 *                  Korpushöhe minus Korpus-Offset der Serie. 18 Raster → 18 × 128 mm.
 *                  Eine Front mit n Rastern belegt n × 128 mm (Fronthöhe + 3 mm Fuge).
 *
 * Gerechnet wird in ganzen Millimetern, aus demselben Grund wie in `raster.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Bewusst ohne Import aus dem Front-Katalog: Die Kalkulation (auch in den Node-Prüfskripten)
 * nutzt diese Regeln, und die beiden Front-Typen, um die es geht, sind feste Begriffe.
 */

import type { Draft, FrontColumn, FrontElement, FrontsData, KorpusGrunddaten } from '../types/index.ts'
import { formatMassZahl } from './format.ts'
import { FUGE_MM, frontAufteilung } from './frontbreiten.ts'
import { resolveHeightCm, resolveKorpusBreiteCm } from './korpusMass.ts'
import { RASTER_MM, cmToMm, korpusOffsetMm, mmToCm } from './raster.ts'

/** Front-Typen, die diese Regeln kennen müssen. */
const DREHTUER = 'drehtuer'
const SCHIEBETUER_ZWEI = 'schiebetuer-zwei'

/** Zulässige Raster einer Drehtür (Eingabebereich der Vorlage). */
export const DREHTUER_RASTER_MIN = 3
export const DREHTUER_RASTER_MAX = 21

/** Rundungsluft beim Vergleich von Millimetern (eingegebene cm haben eine Nachkommastelle). */
const TOLERANZ_MM = 1

/** Schmalste Front, die beim automatischen Angleichen noch eingetragen wird (15 cm). */
const MIN_FRONT_MM = 150

// ---------------------------------------------------------------------------
// Segment
// ---------------------------------------------------------------------------

export interface SegmentGeometrie {
  /** Korpus-Nennbreite in cm. */
  korpusBreiteCm: number
  /** Verfügbare Frontbreite einer Ebene in mm (100er → 980). */
  frontbereichMm: number
  /** Breite eines Standard-Türflügels in mm (100er → 490). */
  fluegelMm: number
  /** Türflügel nebeneinander im Standardfall (bis 60 cm eine, ab 61 cm zwei). */
  fluegelJeEbene: number
  /** Frontzone in mm (R × 128); `undefined`, solange Höhe oder Serien-Offset fehlen. */
  frontzoneMm?: number
  /** Ganze Raster, die in die Frontzone passen — Obergrenze jeder Rasterauswahl. */
  korpusRaster?: number
}

/**
 * Frontzone eines Korpus in mm.
 *
 * Bei den Standardhöhen 18R/21R zählt das Raster selbst: „21 Raster (~274 cm)" ist ein
 * gerundeter Anzeigewert, rechnerisch 273,4 cm — mit 274 cm entstünden 6 mm Phantomhöhe.
 */
export function frontzoneMm(g: KorpusGrunddaten | undefined, serieId: string | undefined): number | undefined {
  if (!g) return undefined
  if (g.heightMode === '18R') return 18 * RASTER_MM
  if (g.heightMode === '21R') return 21 * RASTER_MM
  const hoehe = resolveHeightCm(g)
  const offset = korpusOffsetMm(serieId)
  if (hoehe == null || offset == null) return undefined
  const zone = cmToMm(hoehe) - offset
  return zone > 0 ? zone : undefined
}

/** Geometrie des Segments `index` (von links) — `undefined` ohne Korpus-Grunddaten. */
export function segmentGeometrie(
  g: KorpusGrunddaten | undefined,
  serieId: string | undefined,
  index: number,
): SegmentGeometrie | undefined {
  const korpus = g?.korpusse[index]
  if (!korpus) return undefined
  return geometrieFuerBreite(g, serieId, resolveKorpusBreiteCm(korpus))
}

/** Geometrie eines Korpus der Breite `korpusBreiteCm` bei der Höhe aus `g`. */
export function geometrieFuerBreite(
  g: KorpusGrunddaten | undefined,
  serieId: string | undefined,
  korpusBreiteCm: number | undefined,
): SegmentGeometrie | undefined {
  const aufteilung = frontAufteilung(korpusBreiteCm)
  if (korpusBreiteCm == null || !aufteilung) return undefined
  const zone = frontzoneMm(g, serieId)
  return {
    korpusBreiteCm,
    frontbereichMm: aufteilung.summeMm,
    fluegelMm: aufteilung.frontMm,
    fluegelJeEbene: aufteilung.anzahl,
    frontzoneMm: zone,
    korpusRaster: zone != null ? Math.floor(zone / RASTER_MM) : undefined,
  }
}

/** Alle Segment-Geometrien eines Entwurfs, in Spaltenreihenfolge. */
export function entwurfsGeometrie(draft: Pick<Draft, 'korpusGrunddaten' | 'seriesId' | 'fronts'>): Array<SegmentGeometrie | undefined> {
  const spalten = draft.fronts?.columns.length ?? 0
  return Array.from({ length: spalten }, (_, i) => segmentGeometrie(draft.korpusGrunddaten, draft.seriesId, i))
}

// ---------------------------------------------------------------------------
// Maße eines Elements
// ---------------------------------------------------------------------------

function zahlMm(text: string | undefined): number | undefined {
  if (!text || !text.trim()) return undefined
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? cmToMm(n) : undefined
}

/** Frontbreite in mm, `undefined` ohne gültige Eingabe. */
export function breiteMm(el: FrontElement): number | undefined {
  return zahlMm(el.widthCm)
}

/** Fronthöhe in mm, `undefined` ohne gültige Eingabe. */
export function hoeheMm(el: FrontElement): number | undefined {
  return zahlMm(el.heightCm)
}

/** Millimeter als cm-Text in deutscher Schreibweise („39", „230,1"). */
export function mmText(mm: number): string {
  return formatMassZahl(mmToCm(mm))
}

/**
 * Rasterzahl einer Fronthöhe — nur wenn sie EXAKT auf einem Raster liegt.
 *
 * Überarbeitung 9, S. 2: „Schön wäre es, wenn hier automatisch die Rasterhöhe erkannt und
 * eingetragen wird (also wenn es volle Raster sind). Sonst sollte nichts drinnen stehen."
 */
export function exaktesFrontRaster(hoeheMmWert: number | undefined): number | undefined {
  if (hoeheMmWert == null) return undefined
  const belegt = hoeheMmWert + FUGE_MM
  return belegt > 0 && belegt % RASTER_MM === 0 ? belegt / RASTER_MM : undefined
}

// ---------------------------------------------------------------------------
// Ebenen
// ---------------------------------------------------------------------------

export interface FrontEbene {
  elemente: FrontElement[]
  /** Summe der Frontbreiten in mm. */
  belegtMm: number
  /** Höchste Front der Ebene in mm; `undefined`, sobald eine Front keine Höhe hat. */
  hoeheMm?: number
  /** Enthält eine Front mit „Höhe bis Korpusoberkante". */
  bisOberkante: boolean
}

/**
 * Teilt die Fronten eines Segments in Ebenen (nebeneinander) auf.
 *
 * Ohne Geometrie oder bei der zweiläufigen Schiebetür steht jede Front für sich — so wie
 * das System bisher gerechnet hat.
 */
export function ebenenDerSpalte(column: FrontColumn, geo: SegmentGeometrie | undefined): FrontEbene[] {
  const ebenen: FrontEbene[] = []
  let aktuell: FrontEbene | null = null
  for (const el of column.elements) {
    const breite = breiteMm(el) ?? geo?.frontbereichMm ?? Number.POSITIVE_INFINITY
    const passt =
      aktuell != null &&
      geo != null &&
      el.typeId !== SCHIEBETUER_ZWEI &&
      aktuell.elemente.every((e) => e.typeId !== SCHIEBETUER_ZWEI) &&
      aktuell.belegtMm + breite <= geo.frontbereichMm + TOLERANZ_MM
    if (!passt) {
      aktuell = { elemente: [], belegtMm: 0, hoeheMm: 0, bisOberkante: false }
      ebenen.push(aktuell)
    }
    const ebene = aktuell as FrontEbene
    ebene.elemente.push(el)
    ebene.belegtMm += Number.isFinite(breite) ? breite : 0
    if (el.hoeheModus === 'korpusoberkante') ebene.bisOberkante = true
    const h = hoeheMm(el)
    ebene.hoeheMm = h == null || ebene.hoeheMm == null ? undefined : Math.max(ebene.hoeheMm, h)
  }
  return ebenen
}

function ebeneVon(ebenen: FrontEbene[], elementId: string): FrontEbene | undefined {
  return ebenen.find((e) => e.elemente.some((el) => el.id === elementId))
}

// ---------------------------------------------------------------------------
// Höhe
// ---------------------------------------------------------------------------

export interface Resthoehe {
  hoeheMm: number
  hoeheCm: number
  /** Nur gesetzt, wenn die Höhe exakt einem Raster entspricht. */
  raster?: number
}

/**
 * Wie viel Frontzone die ÜBRIGEN Ebenen belegen (mm, inkl. ihrer Fugen) — `undefined`,
 * wenn eine davon keine Höhe hat oder selbst „bis Korpusoberkante" läuft.
 */
function belegtDurchAndere(column: FrontColumn, elementId: string, geo: SegmentGeometrie): number | undefined {
  const ebenen = ebenenDerSpalte(column, geo)
  const eigene = ebeneVon(ebenen, elementId)
  let summe = 0
  for (const ebene of ebenen) {
    if (ebene === eigene) continue
    if (ebene.bisOberkante || ebene.hoeheMm == null) return undefined
    summe += ebene.hoeheMm + FUGE_MM
  }
  return summe
}

/**
 * „Höhe bis Korpusoberkante": Frontzone minus die Ebenen darunter/darüber.
 *
 * Seitliche Nachbarn derselben Ebene zählen NICHT — sie teilen sich die Höhe. Genau das
 * lief vorher falsch: Beim 100er Korpus wurde die linke Tür von der rechten abgezogen
 * („Bei Höhe bis Korpusoberkante wird die Höhe nicht erkannt und kein Preis berechnet").
 */
export function resthoeheBisOberkante(
  column: FrontColumn,
  elementId: string,
  geo: SegmentGeometrie | undefined,
): Resthoehe | undefined {
  if (!geo?.frontzoneMm) return undefined
  const andere = belegtDurchAndere(column, elementId, geo)
  if (andere == null) return undefined
  const hoehe = geo.frontzoneMm - andere - FUGE_MM
  if (hoehe < RASTER_MM - FUGE_MM) return undefined
  return { hoeheMm: hoehe, hoeheCm: mmToCm(hoehe), raster: exaktesFrontRaster(hoehe) }
}

/**
 * Größte zulässige Fronthöhe in mm (ohne Fuge) — `undefined` ohne bekannte Frontzone.
 * Grundlage der Prüfung einer freien cm-Eingabe.
 */
export function maxFronthoeheMm(column: FrontColumn, elementId: string, geo: SegmentGeometrie | undefined): number | undefined {
  if (!geo?.frontzoneMm) return undefined
  const andere = belegtDurchAndere(column, elementId, geo) ?? 0
  return geo.frontzoneMm - andere - FUGE_MM
}

/**
 * Größte Rasterzahl, die für diese Front noch zulässig ist.
 *
 * Überarbeitung 9, S. 1: „Trotz Korpushöhe mit 18 Raster kann ich Türen mit 21 Rasterhöhe
 * konfigurieren." Die Auswahl endet deshalb an der Frontzone minus den übrigen Ebenen —
 * und nie über dem Rastermaximum der Drehtür.
 */
export function maxFrontRaster(column: FrontColumn, elementId: string, geo: SegmentGeometrie | undefined): number {
  if (!geo?.frontzoneMm) return DREHTUER_RASTER_MAX
  const andere = belegtDurchAndere(column, elementId, geo) ?? 0
  const frei = Math.floor((geo.frontzoneMm - andere) / RASTER_MM)
  return Math.max(0, Math.min(DREHTUER_RASTER_MAX, frei))
}

// ---------------------------------------------------------------------------
// Breite
// ---------------------------------------------------------------------------

/**
 * Standardbreite für eine NEUE Front in cm.
 *
 * Ist die oberste Ebene noch nicht voll, bekommt die neue Front genau den Rest — sie ist
 * dann der zweite Flügel. Sonst beginnt eine neue Ebene: eine Drehtür als Standard-Flügel,
 * alle übrigen Fronten (Schub, Offen …) über die ganze Breite.
 */
export function standardbreiteNeuerFront(
  column: FrontColumn,
  typeId: string,
  geo: SegmentGeometrie | undefined,
): number | undefined {
  if (!geo) return undefined
  const oberste = ebenenDerSpalte(column, geo).at(-1)
  if (oberste && oberste.elemente.every((e) => e.typeId !== SCHIEBETUER_ZWEI)) {
    const rest = geo.frontbereichMm - oberste.belegtMm
    if (rest >= MIN_FRONT_MM) return mmToCm(rest)
  }
  return mmToCm(typeId === DREHTUER ? geo.fluegelMm : geo.frontbereichMm)
}

/**
 * Setzt die Breite einer Front und gleicht den Nachbarn derselben Ebene an.
 *
 * Überarbeitung 9, S. 1: „Wenn ich die erste Drehtür z. B. auf Breite 59 konfiguriere,
 * müßte die zweite Drehtür sich automatisch auf 39 reduzieren." Eindeutig ist das nur bei
 * GENAU einem Nachbarn — bei mehreren bleibt es bei der Eingabe, die Prüfung meldet dann
 * die offene Differenz.
 *
 * Die Ebenen werden aus dem Stand VOR der Änderung gebildet: Mit der neuen, zu breiten
 * Zahl fiele der Nachbar sonst in eine eigene Ebene und würde gar nicht mehr angepasst.
 */
export function setzeFrontbreite(
  column: FrontColumn,
  elementId: string,
  text: string,
  geo: SegmentGeometrie | undefined,
): FrontColumn {
  const neu = zahlMm(text)
  const aenderungen = new Map<string, Partial<FrontElement>>([[elementId, { widthCm: text }]])
  if (geo && neu != null) {
    const ebene = ebeneVon(ebenenDerSpalte(column, geo), elementId)
    const nachbarn = ebene?.elemente.filter((e) => e.id !== elementId) ?? []
    if (nachbarn.length === 1) {
      const rest = geo.frontbereichMm - neu
      if (rest >= MIN_FRONT_MM) aenderungen.set(nachbarn[0].id, { widthCm: mmText(rest) })
    }
  }
  return {
    ...column,
    geometrieHinweis: undefined,
    elements: column.elements.map((el) => (aenderungen.has(el.id) ? { ...el, ...aenderungen.get(el.id) } : el)),
  }
}

// ---------------------------------------------------------------------------
// Türanschlag
// ---------------------------------------------------------------------------

/**
 * Vorgegebener Türanschlag — oder `undefined`, wenn der Berater wählen muss.
 *
 * Überarbeitung 9, S. 2: „Die Position des Türanschlag soll nur bei Einzeltüren abgefragt
 * werden. Sobald wie beim 100er Korpus links und rechts eine Tür angeschlagen werden muß,
 * ist es vorgegeben." Zwei Drehtüren in einer Ebene: die linke links, die rechte rechts.
 */
export function vorgegebenerTuerAnschlag(
  column: FrontColumn,
  elementId: string,
  geo: SegmentGeometrie | undefined,
): 'links' | 'rechts' | undefined {
  if (!geo) return undefined
  const ebene = ebeneVon(ebenenDerSpalte(column, geo), elementId)
  if (!ebene || ebene.elemente.length !== 2) return undefined
  if (!ebene.elemente.every((e) => e.typeId === DREHTUER)) return undefined
  return ebene.elemente[0].id === elementId ? 'links' : 'rechts'
}

// ---------------------------------------------------------------------------
// Normalisieren — abgeleitete Werte in den Entwurf schreiben
// ---------------------------------------------------------------------------

/**
 * Schreibt alles, was aus der Geometrie FOLGT, in die Fronten eines Segments:
 *   • „bis Korpusoberkante" → Höhe in cm und — nur bei vollen Rastern — die Rasterzahl,
 *   • freie cm-Höhe → erkannte Rasterzahl (sonst leer),
 *   • Türpaar → vorgegebener Anschlag.
 *
 * Gibt dieselbe Spalte zurück, wenn nichts zu ändern ist; Aufrufer in `useEffect` erkennen
 * daran, dass kein Schreibvorgang nötig ist.
 */
export function normalisiereSpalte(column: FrontColumn, geo: SegmentGeometrie | undefined): FrontColumn {
  let geaendert = false
  const elements = column.elements.map((el) => {
    const patch: Partial<FrontElement> = {}
    if (el.hoeheModus === 'korpusoberkante') {
      const rest = resthoeheBisOberkante(column, el.id, geo)
      const hoehe = rest ? mmText(rest.hoeheMm) : ''
      const raster = rest?.raster != null ? String(rest.raster) : ''
      if ((el.heightCm ?? '') !== hoehe) patch.heightCm = hoehe
      if ((el.hoeheRaster ?? '') !== raster) patch.hoeheRaster = raster
    } else if (el.hoeheModus === 'cm') {
      const raster = exaktesFrontRaster(hoeheMm(el))
      const text = raster != null ? String(raster) : ''
      if ((el.hoeheRaster ?? '') !== text) patch.hoeheRaster = text
    }
    if (el.typeId === DREHTUER) {
      const vorgabe = vorgegebenerTuerAnschlag(column, el.id, geo)
      if (vorgabe && el.tuerAnschlag !== vorgabe) patch.tuerAnschlag = vorgabe
    }
    if (Object.keys(patch).length === 0) return el
    geaendert = true
    return { ...el, ...patch }
  })
  return geaendert ? { ...column, elements } : column
}

// ---------------------------------------------------------------------------
// Korpus geändert — Fronten neu rechnen oder als ungültig markieren
// ---------------------------------------------------------------------------

/**
 * Passt die Fronten eines Segments an eine GEÄNDERTE Korpusbreite an.
 *
 * Überarbeitung 9, S. 1: „Wenn ich … den Korpus von 100 auf 50 reduziere, gibt es trotz der
 * weiterhin bestehenden 2 Türen mit der Breite für einen 100er Korpus keine Fehlermeldung."
 *
 * Neu gerechnet wird nur, was eindeutig ist:
 *   • eine Front über die ganze Breite (Schub, Offen; eine Tür nur, solange der neue Korpus
 *     einflügelig bleibt) → neue ganze Breite,
 *   • ein Türpaar in Standardbreite, und der neue Korpus ist wieder zweiflügelig → neue
 *     Standard-Flügelbreite.
 * Alles andere (50 ↔ 100, ungleiche Flügel 59/39 …) wird nicht geraten: Das Segment
 * bekommt einen Hinweis und ist ungültig, bis der Berater die Fronten neu einstellt.
 */
export function passeSpalteAnKorpusAn(
  column: FrontColumn,
  alt: SegmentGeometrie | undefined,
  neu: SegmentGeometrie | undefined,
  korpusNr: number,
): FrontColumn {
  if (!alt || !neu || alt.frontbereichMm === neu.frontbereichMm || column.elements.length === 0) return column
  if (column.elements.some((e) => e.typeId === SCHIEBETUER_ZWEI)) return column

  const breiten = new Map<string, string>()
  const offen: string[] = []
  let offeneFronten = 0
  for (const ebene of ebenenDerSpalte(column, alt)) {
    const voll = Math.abs(ebene.belegtMm - alt.frontbereichMm) <= TOLERANZ_MM
    const n = ebene.elemente.length
    const einzelneTuer = n === 1 && ebene.elemente[0].typeId === DREHTUER
    if (voll && n === 1 && (!einzelneTuer || neu.fluegelJeEbene === 1)) {
      breiten.set(ebene.elemente[0].id, mmText(neu.frontbereichMm))
    } else if (
      voll &&
      n > 1 &&
      n === alt.fluegelJeEbene &&
      n === neu.fluegelJeEbene &&
      ebene.elemente.every((e) => Math.abs((breiteMm(e) ?? 0) - alt.fluegelMm) <= TOLERANZ_MM)
    ) {
      for (const e of ebene.elemente) breiten.set(e.id, mmText(neu.fluegelMm))
    } else {
      offen.push(ebene.elemente.map((e) => `${e.label || '—'} (${e.widthCm || '?'} cm)`).join(' + '))
      offeneFronten += ebene.elemente.length
    }
  }

  const elements = column.elements.map((el) => (breiten.has(el.id) ? { ...el, widthCm: breiten.get(el.id) } : el))
  const geometrieHinweis =
    offen.length > 0
      ? `Korpus ${korpusNr} wurde von ${formatMassZahl(alt.korpusBreiteCm)} auf ${formatMassZahl(neu.korpusBreiteCm)} cm geändert — ` +
        `${offen.join(', ')} ${offeneFronten === 1 ? 'passt' : 'passen'} nicht mehr eindeutig in den Frontbereich von ` +
        `${mmText(neu.frontbereichMm)} cm. Bitte die Fronten dieses Segments neu einstellen.`
      : undefined
  return { ...column, elements, geometrieHinweis }
}

/**
 * Normalisiert alle Segmente eines Entwurfs — die eine Stelle, an der abgeleitete Werte in
 * den Entwurf geschrieben werden (Fronten-Seite, bei jeder Änderung):
 *
 *   1. Korpus seit der Frontplanung geändert (`column.korpusBreiteCm` ≠ aktuelle Breite)?
 *      → `passeSpalteAnKorpusAn`: eindeutig neu rechnen oder das Segment markieren.
 *      Verglichen wird mit der Breite, für die die Fronten EINGESTELLT wurden — nicht mit
 *      dem Stand vor dem letzten Tastendruck. Sonst hinterließe schon das Tippen von „80"
 *      (erst „8", dann „80") einen Hinweis „von 8 auf 80 cm geändert".
 *   2. `normalisiereSpalte`: Höhe „bis Korpusoberkante", erkannte Raster, Türpaar-Anschlag.
 *
 * Gibt `draft.fronts` unverändert zurück, wenn nichts zu schreiben ist.
 */
export function normalisiereFrontenFuerEntwurf(
  draft: Pick<Draft, 'korpusGrunddaten' | 'seriesId' | 'fronts'>,
): FrontsData | undefined {
  const fronts = draft.fronts
  if (!fronts) return fronts
  const g = draft.korpusGrunddaten
  let geaendert = false
  const columns = fronts.columns.map((col, i) => {
    const geo = segmentGeometrie(g, draft.seriesId, i)
    let neu = col
    if (geo && col.elements.length > 0) {
      if (col.korpusBreiteCm != null && col.korpusBreiteCm !== geo.korpusBreiteCm) {
        neu = passeSpalteAnKorpusAn(neu, geometrieFuerBreite(g, draft.seriesId, col.korpusBreiteCm), geo, i + 1)
      }
      if (neu.korpusBreiteCm !== geo.korpusBreiteCm) neu = { ...neu, korpusBreiteCm: geo.korpusBreiteCm }
    }
    neu = normalisiereSpalte(neu, geo)
    if (neu !== col) geaendert = true
    return neu
  })
  return geaendert ? { ...fronts, columns } : fronts
}

// ---------------------------------------------------------------------------
// Prüfen
// ---------------------------------------------------------------------------

/**
 * Alle Geometrie-Verstöße eines Segments als Klartext.
 *
 * Harte Regeln — ein Segment mit Befund ist nicht abschließbar und wird nicht
 * verbindlich kalkuliert:
 *   1. keine Front breiter als der Frontbereich (70-cm-Tür im 50er Korpus),
 *   2. jede Ebene füllt den Frontbereich (59 + 49 im 100er ergibt keine Ebene),
 *   3. keine Front höher als die Frontzone (21-Raster-Tür im 18-Raster-Korpus),
 *   4. alle Ebenen zusammen nicht höher als die Frontzone,
 *   5. „bis Korpusoberkante" muss sich ableiten lassen,
 *   6. ein Hinweis aus einer Korpusänderung ist offen.
 */
export function pruefeSpalte(column: FrontColumn, geo: SegmentGeometrie | undefined): string[] {
  const befunde: string[] = []
  if (column.geometrieHinweis) befunde.push(column.geometrieHinweis)
  if (!geo || column.elements.length === 0) return befunde
  if (column.elements.some((e) => e.typeId === SCHIEBETUER_ZWEI)) return befunde

  const name = (el: FrontElement) => el.label.trim() || '(ohne Kennzeichnung)'
  const bereich = mmText(geo.frontbereichMm)

  for (const el of column.elements) {
    const b = breiteMm(el)
    if (b != null && b > geo.frontbereichMm + TOLERANZ_MM) {
      befunde.push(
        `${name(el)}: ${mmText(b)} cm ist breiter als der Frontbereich des ${formatMassZahl(geo.korpusBreiteCm)}er Korpus (${bereich} cm).`,
      )
    }
  }

  const ebenen = ebenenDerSpalte(column, geo)
  for (const ebene of ebenen) {
    const alleBemasst = ebene.elemente.every((e) => breiteMm(e) != null)
    const fehlt = geo.frontbereichMm - ebene.belegtMm
    if (alleBemasst && fehlt > TOLERANZ_MM) {
      befunde.push(
        `${ebene.elemente.map(name).join(' + ')}: ${mmText(ebene.belegtMm)} von ${bereich} cm Frontbreite belegt — ` +
          `es fehlen ${mmText(fehlt)} cm. Breiten anpassen oder eine weitere Front daneben setzen.`,
      )
    }
  }

  const zone = geo.frontzoneMm
  if (zone != null) {
    const rasterText = geo.korpusRaster != null ? ` (${geo.korpusRaster} Raster)` : ''
    for (const el of column.elements) {
      const h = hoeheMm(el)
      if (h != null && h + FUGE_MM > zone + TOLERANZ_MM) {
        const r = exaktesFrontRaster(h)
        befunde.push(
          `${name(el)}: ${mmText(h)} cm${r != null ? ` (${r} Raster)` : ''} ist höher als der Korpus${rasterText} zulässt.`,
        )
      }
      if (el.hoeheModus === 'korpusoberkante' && !resthoeheBisOberkante(column, el.id, geo)) {
        befunde.push(
          `${name(el)}: „Höhe bis Korpusoberkante" lässt sich nicht ableiten — erst die übrigen Fronten dieses Segments bemaßen (höchstens eine Ebene „bis Korpusoberkante").`,
        )
      }
    }
    if (ebenen.every((e) => e.hoeheMm != null)) {
      const summe = ebenen.reduce((s, e) => s + (e.hoeheMm ?? 0) + FUGE_MM, 0)
      if (ebenen.length > 1 && summe > zone + TOLERANZ_MM) {
        befunde.push(
          `Die Fronten übereinander ergeben ${mmText(summe - FUGE_MM)} cm — der Korpus${rasterText} bietet ${mmText(zone - FUGE_MM)} cm Fronthöhe.`,
        )
      }
    }
  }
  return befunde
}
