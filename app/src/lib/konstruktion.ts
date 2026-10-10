import type { Draft, FrontElement, SegmentEquipmentItem } from '../types/index.ts'
import { getEquipmentOption } from '../config/equipment.ts'
import { FUGE_MM } from './frontbreiten.ts'
import { ebenenDerSpalte, frontzoneMm, segmentGeometrie } from './frontGeometrie.ts'
import { ZWEILAEUFIG_TYPE_ID, hasZweilaeufigeSchiebetuer } from './frontsHelpers.ts'
import {
  abschlusssetStaerkeMm,
  aussenmassOptionen,
  beleuchtungsZugabeCm,
  resolveDepthCm,
  resolveHeightCm,
  resolveKorpusBreiteCm,
} from './korpusMass.ts'
import { RASTER_MM } from './raster.ts'
import { hoeheCmVon, varianteRaster } from './rasterBelegung.ts'
import { aufteilungenFuerEntwurf, gewaehlteAufteilung, vorgeschlageneAnzahl } from './schiebetuer.ts'

/**
 * 2D-KONSTRUKTIONSANSICHT — das Modell hinter der begleitenden Skizze der Schritte
 * „Maße", „Material", „Ausstattung" und „Fronten".
 *
 * Übersetzt Korpus-Grunddaten, Fronten und die Ausstattung hinter den Fronten in Rechtecke
 * und Linien in MILLIMETERN — so, wie die AV-Zeichnung von Cramer bemaßt (Grundriss oben,
 * Innenansicht mit Bodenhöhen). Die Darstellung (`components/konstruktion/Konstruktion2D.tsx`)
 * zeichnet nur, was hier steht; dadurch lässt sich das Modell ohne Browser prüfen
 * (`npm run ue10:test`) und bleibt deckungsgleich mit Außenmaß, Frontgeometrie,
 * Rasterbelegung und Türfeldern.
 *
 * Koordinaten: x von links (Außenkante), y vom Boden nach oben (Vorderansicht), z von der
 * Wand nach vorne (Draufsicht). Platten- und Frontstärken sind Zeichenwerte, keine
 * Fertigungsmaße; maßgeblich bleibt das Außenmaß aus `berechneAussenmass`.
 */

export type FrontArt = 'drehtuer' | 'schublade' | 'schiebetuer' | 'klappe' | 'offen'

export interface Front2D {
  art: FrontArt
  x: number
  y: number
  b: number
  h: number
  label?: string
  /** Bandseite der Drehtür (Anschlag); der Griff sitzt gegenüber. */
  anschlag?: 'links' | 'rechts'
  /** Laufebene der Schiebetür: 0 hinten, 1 vorne. */
  ebene?: 0 | 1
}

export type AusstattungArt =
  | 'boden'
  | 'glasboden'
  | 'kleiderstange'
  | 'container'
  | 'innenschublade'
  | 'rollboden'
  | 'rollkorb'
  | 'led-deckel'
  | 'led-seite'
  | 'hinweis'

export interface Ausstattung2D {
  art: AusstattungArt
  korpus: number
  x: number
  /** Unterkante über dem Boden (mm). */
  y: number
  b: number
  /** Bauhöhe (mm); 0 bei Linien (Boden, Stange). */
  h: number
  label: string
  /** Höhe über dem Fußboden als Maßtext (Boden, Stange) — wie in der AV-Zeichnung. */
  hoeheMm?: number
}

export interface Korpus2D {
  index: number
  x: number
  b: number
  /** Nennbreite in cm (Beschriftung „60er"). */
  nennCm: number
}

export interface Konstruktion2D {
  breiteMm: number
  hoeheMm: number
  /** Korpustiefe (Nennmaß). */
  tiefeMm: number
  /** Abstand Rückwand–Wand für die Kabelführung der Beleuchtung (0 ohne). */
  wandabstandMm: number
  /** Unterkante der Frontzone (Sockel / Bodenplatte). */
  sockelMm: number
  /** Innenkante des Korpusbodens. */
  innenBodenMm: number
  plattenMm: number
  frontMm: number
  korpusse: Korpus2D[]
  abschluss: { links?: number; rechts?: number }
  /** Verblendung je Seite (Zeichenbreite) und Art. */
  verblendung?: { art: 'korpusbuendig' | 'frontbuendig'; links: boolean; oben: boolean; rechts: boolean; mm: number }
  /** Fußleistenausschnitt (Höhe × Tiefe, mm) an der Wandseite. */
  fussleiste?: { hoeheMm: number; tiefeMm: number }
  fronten: Front2D[]
  ausstattung: Ausstattung2D[]
  /** Zweiläufige Schiebetür geplant: zwei Laufebenen vor dem Korpus. */
  schiebetueren: number
}

/** Zeichenwerte (mm). */
export const PLATTE_MM = 19
export const FRONT_MM = 19
export const SCHIEBE_EBENE_MM = 25
export const VERBLENDUNG_MM = 30
/** Kleiderstange: ca. 6 cm unter dem tragenden Boden. */
const STANGE_UNTER_BODEN_MM = 60

function mmVon(text: string | undefined): number | undefined {
  if (!text || !text.trim()) return undefined
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) : undefined
}

function frontArt(el: FrontElement): FrontArt {
  switch (el.typeId) {
    case 'drehtuer':
      return 'drehtuer'
    case 'schuebe':
      return 'schublade'
    case 'schiebetuer':
    case ZWEILAEUFIG_TYPE_ID:
      return 'schiebetuer'
    case 'offen':
      return 'offen'
    default:
      return 'klappe'
  }
}

/** Einbauhöhe eines Stücks über der Bodenplatte (mm) — dieselbe Regel wie die Rasterbelegung. */
function einbauMm(item: SegmentEquipmentItem, stueck: number): number | undefined {
  const h = item.hoehen?.[stueck]
  const cm = hoeheCmVon(h)
  return cm != null ? Math.round(cm * 10) : undefined
}

/**
 * Die Ausstattung eines Segments als Zeichnungsteile. Was keine Bodenposition hat
 * (Krawattenspange, Kleiderlift, Spiegel …), erscheint als Hinweis im Korpus.
 */
function ausstattungDesKorpus(items: SegmentEquipmentItem[], k: Korpus2D, innenBoden: number, innenOben: number): Ausstattung2D[] {
  const teile: Ausstattung2D[] = []
  const xi = k.x + PLATTE_MM
  const bi = k.b - 2 * PLATTE_MM
  for (const item of items) {
    const option = getEquipmentOption(item.optionId)
    if (!option) continue
    const label = option.label
    const anzahl = option.heightPerPiece ? Math.max(1, item.qty ?? 1) : 1
    const punkt = (art: AusstattungArt, stueck: number, h = 0) => {
      const ue = einbauMm(item, stueck)
      if (ue == null) return
      const y = innenBoden + ue
      teile.push({ art, korpus: k.index, x: xi, y, b: bi, h, label, hoeheMm: y })
      if (item.optionId === 'einlegeboden-kleiderstange') {
        const ys = y - STANGE_UNTER_BODEN_MM
        teile.push({ art: 'kleiderstange', korpus: k.index, x: xi + 20, y: ys, b: bi - 40, h: 0, label: 'Kleiderstange', hoeheMm: ys })
      }
    }
    switch (item.optionId) {
      case 'einlegeboden':
      case 'einlegeboden-kleiderstange':
        for (let s = 0; s < anzahl; s++) punkt('boden', s)
        break
      case 'glasboden':
        for (let s = 0; s < anzahl; s++) punkt('glasboden', s)
        break
      case 'rollboden':
      case 'rollboden-schuhablage-craft':
        for (let s = 0; s < anzahl; s++) punkt('rollboden', s, 90)
        break
      case 'rollkorb':
        for (let s = 0; s < anzahl; s++) punkt('rollkorb', s, 180)
        break
      case 'container':
      case 'innenschublade': {
        const raster = varianteRaster(item.variant)
        const h = raster != null ? Math.round(raster * RASTER_MM) : 4.5 * RASTER_MM
        // Container steht immer am Korpusboden; die Innenschublade ab ihrer Einbauhöhe.
        const ue = item.optionId === 'container' ? 0 : einbauMm(item, 0) ?? 0
        const n = item.optionId === 'container' ? Math.max(1, item.qty ?? 1) : 1
        for (let s = 0; s < n; s++) {
          teile.push({
            art: item.optionId === 'container' ? 'container' : 'innenschublade',
            korpus: k.index,
            x: xi,
            y: innenBoden + ue + s * h,
            b: bi,
            h,
            label: `${label}${item.variant ? ` ${item.variant.replace('R', ' R')}` : ''}${item.rauchglas ? ' · Rauchglas' : ''}`,
          })
        }
        break
      }
      case 'container-craft':
      case 'container-conero':
        // Bauhöhe laut Preisliste je Modell — als Block am Boden mit Modellname.
        teile.push({ art: 'container', korpus: k.index, x: xi, y: innenBoden, b: bi, h: 4.5 * RASTER_MM, label: `${label}${item.variant ? ` ${item.variant}` : ''}` })
        break
      case 'led-syncro':
        teile.push({ art: 'led-deckel', korpus: k.index, x: xi, y: innenOben - 15, b: bi, h: 0, label: 'LED-Syncro' })
        break
      case 'led-band-aluprofil': {
        const seiten = item.seiten ?? { links: true }
        if (seiten.links) teile.push({ art: 'led-seite', korpus: k.index, x: xi + 8, y: innenBoden, b: 0, h: innenOben - innenBoden, label: 'LED' })
        if (seiten.rechts) teile.push({ art: 'led-seite', korpus: k.index, x: xi + bi - 8, y: innenBoden, b: 0, h: innenOben - innenBoden, label: 'LED' })
        break
      }
      default:
        teile.push({ art: 'hinweis', korpus: k.index, x: xi, y: innenBoden, b: bi, h: 0, label })
    }
  }
  return teile
}

/**
 * Das Modell eines Entwurfs — `null`, solange Höhe, Tiefe oder eine Korpusbreite fehlen.
 */
export function konstruktion(
  draft: Pick<Draft, 'korpusGrunddaten' | 'fronts' | 'seriesId' | 'ausstattung'>,
): Konstruktion2D | null {
  const g = draft.korpusGrunddaten
  if (!g || g.korpusse.length === 0) return null
  const hoeheCm = resolveHeightCm(g)
  const tiefeCm = resolveDepthCm(g)
  const breiten = g.korpusse.map((k) => resolveKorpusBreiteCm(k))
  if (hoeheCm == null || tiefeCm == null || breiten.some((b) => b == null)) return null

  const optionen = aussenmassOptionen(draft)
  const hoehe = Math.round(hoeheCm * 10)
  const tiefe = Math.round(tiefeCm * 10)
  const setMm = abschlusssetStaerkeMm(optionen)
  const links = g.abschlussSet?.position === 'links' || g.abschlussSet?.position === 'beide'
  const rechts = g.abschlussSet?.position === 'rechts' || g.abschlussSet?.position === 'beide'

  const zone = frontzoneMm(g, draft.seriesId)
  const sockel = zone != null ? Math.max(0, hoehe - zone) : 0
  const innenBoden = sockel + PLATTE_MM
  const innenOben = hoehe - PLATTE_MM

  const korpusse: Korpus2D[] = []
  let x = links ? setMm : 0
  breiten.forEach((b, index) => {
    const mm = Math.round((b as number) * 10)
    korpusse.push({ index, x, b: mm, nennCm: b as number })
    x += mm
  })
  const breite = x + (rechts ? setMm : 0)

  // Ausstattung hinter den Fronten (Spalte i gehört zu Korpus i).
  const ausstattung = korpusse.flatMap((k) =>
    ausstattungDesKorpus(draft.fronts?.columns[k.index]?.equipment ?? [], k, innenBoden, innenOben),
  )

  // Fronten.
  const fronten: Front2D[] = []
  let schiebetueren = 0
  if (hasZweilaeufigeSchiebetuer(draft.fronts)) {
    const aufteilung = gewaehlteAufteilung(draft)
    const anzahl =
      aufteilung && aufteilung.felder.length > 0
        ? aufteilung.anzahl
        : draft.fronts?.schiebetuerAnzahl ?? vorgeschlageneAnzahl(aufteilungenFuerEntwurf(draft))
    schiebetueren = anzahl
    // Die Türen decken Abschlusssets und Innenkorpus ab (Überarbeitung 10, S. 1).
    const anteil = breite / anzahl
    for (let i = 0; i < anzahl; i++) {
      fronten.push({ art: 'schiebetuer', x: Math.round(i * anteil), y: sockel, b: Math.round(anteil), h: hoehe - sockel, label: `ST${i + 1}`, ebene: i % 2 === 1 ? 1 : 0 })
    }
  } else {
    ;(draft.fronts?.columns ?? []).forEach((column, i) => {
      const k = korpusse[i]
      if (!k) return
      const geo = segmentGeometrie(g, draft.seriesId, i)
      let y = sockel
      for (const ebene of ebenenDerSpalte(column, geo)) {
        const rest = hoehe - y - FUGE_MM
        const h = Math.min(ebene.hoeheMm != null && ebene.hoeheMm > 0 ? ebene.hoeheMm : rest, rest)
        if (h <= 0) break
        const belegt = ebene.belegtMm + (ebene.elemente.length - 1) * FUGE_MM
        let xs = k.x + Math.max(0, Math.round((k.b - belegt) / 2))
        ebene.elemente.forEach((el, j) => {
          const b = mmVon(el.widthCm) ?? k.b - 2 * FUGE_MM
          const anschlag = el.tuerAnschlag ?? (ebene.elemente.length === 2 ? (j === 0 ? 'links' : 'rechts') : 'links')
          fronten.push({ art: frontArt(el), x: xs, y, b, h: Math.min(mmVon(el.heightCm) ?? h, h), label: el.label || undefined, anschlag })
          xs += b + FUGE_MM
        })
        y += h + FUGE_MM
      }
    })
  }

  const v = g.verblendung
  const fl = g.fussleiste
  const flH = fl?.enabled ? mmVon(fl.hoeheCm) : undefined
  const flT = fl?.enabled ? mmVon(fl.tiefeCm) : undefined

  return {
    breiteMm: breite,
    hoeheMm: hoehe,
    tiefeMm: tiefe,
    wandabstandMm: Math.round(beleuchtungsZugabeCm(g, optionen) * 10),
    sockelMm: sockel,
    innenBodenMm: innenBoden,
    plattenMm: PLATTE_MM,
    frontMm: FRONT_MM,
    korpusse,
    abschluss: { links: links ? setMm : undefined, rechts: rechts ? setMm : undefined },
    verblendung:
      v && v.art !== 'keine' && (v.seiten?.links || v.seiten?.oben || v.seiten?.rechts)
        ? { art: v.art, links: Boolean(v.seiten?.links), oben: Boolean(v.seiten?.oben), rechts: Boolean(v.seiten?.rechts), mm: VERBLENDUNG_MM }
        : undefined,
    fussleiste: flH && flT ? { hoeheMm: flH, tiefeMm: flT } : undefined,
    fronten,
    ausstattung,
    schiebetueren,
  }
}

/** Maßtext in mm mit Komma („1870,5" / „2921"). */
export function mmText(mm: number): string {
  return String(Math.round(mm * 10) / 10).replace('.', ',')
}
