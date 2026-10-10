import type { Draft, FrontElement, SegmentEquipmentItem } from '../types/index.ts'
import { getEquipmentOption } from '../config/equipment.ts'
import { KONSTRUKTION as K, naechstesRasterAb, rasterHoeheMm } from '../config/konstruktionsParameter.ts'
import { ebenenDerSpalte, frontzoneMm, segmentGeometrie } from './frontGeometrie.ts'
import { ZWEILAEUFIG_TYPE_ID, griffProfilAnwendbar, hasZweilaeufigeSchiebetuer } from './frontsHelpers.ts'
import {
  abschlusssetStaerkeMm,
  aussenmassOptionen,
  beleuchtungsZugabeCm,
  resolveDepthCm,
  resolveHeightCm,
  resolveKorpusBreiteCm,
} from './korpusMass.ts'
import { varianteRaster } from './rasterBelegung.ts'
import { aufteilungenFuerEntwurf, gewaehlteAufteilung, vorgeschlageneAnzahl } from './schiebetuer.ts'

/**
 * 2D-KONSTRUKTIONSMODELL (Refugium) — die Daten hinter der begleitenden Skizze.
 *
 * Aus Korpus-Grunddaten, Fronten und der Ausstattung hinter den Fronten entsteht eine Liste
 * BAUTEILE in Millimetern: Korpi, Fronten mit Griffform, Ausstattung mit Einbauhöhe, Rückwand-
 * Details. Wie jedes Bauteil aussieht, entscheidet die Bauteil-Bibliothek
 * (`components/konstruktion/bauteile/`); hier steht nur, WAS WO sitzt.
 *
 * Koordinaten: x von links (Außenkante), y vom Fußboden nach oben, z von der Wand nach vorne.
 * Maße und Platzierungsregeln kommen aus `config/konstruktionsParameter.ts`.
 *
 * STAPELREGEL: Teile hinter einer Front dürfen sich vertikal nicht überlappen. Außenschübe
 * belegen den Korpus bis zu ihrer Oberkante plus Trennboden; ein Container, der „am
 * Korpusboden" stehen soll, rückt dann auf das nächste freie Raster darüber. Jede solche
 * Verschiebung steht als Hinweis im Modell — die Zeichnung verschweigt sie nicht.
 */

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export type FrontArt = 'drehtuer' | 'schublade' | 'schiebetuer' | 'klappe' | 'offen'

/** Griff als 2D-Silhouette — abgeleitet aus Griff-Nr., Stil-Linie, PTO und Griffprofil. */
export type GriffForm =
  | { art: 'buegel'; laengeMm: number }
  | { art: 'knopf' }
  | { art: 'kante'; laengeMm: number }
  | { art: 'leiste'; laengeMm: number }
  | { art: 'muschel' }
  | { art: 'edge'; laengeMm?: number }
  | { art: 'profil'; stil: 'line' | '107' | 'curve' }
  | { art: 'sonder' }
  | { art: 'pto' }

export interface Front2D {
  art: FrontArt
  typeId: string
  x: number
  y: number
  b: number
  h: number
  label?: string
  /** Bandseite der Drehtür (Anschlag); der Griff sitzt gegenüber. */
  anschlag?: 'links' | 'rechts'
  /** Laufebene der Schiebetür: 0 hinten, 1 vorne. */
  ebene?: 0 | 1
  griff?: GriffForm
  /** Griffmitte (Höhe über dem Fußboden) — Regel `griffhoeheTuer` bzw. `griffSchubVonObenMm`. */
  griffY?: number
}

export type AusstattungArt =
  | 'boden'
  | 'glasboden'
  | 'trennboden'
  | 'kleiderstange'
  | 'container'
  | 'innenschublade'
  | 'aussenschub'
  | 'rollboden'
  | 'rollkorb'
  | 'schuhablage'
  | 'hemdeinsatz'
  | 'kleiderlift'
  | 'seitenauszug'
  | 'led-deckel'
  | 'led-seite'
  | 'hinweis'

export interface Ausstattung2D {
  art: AusstattungArt
  optionId?: string
  korpus: number
  x: number
  /** Unterkante über dem Fußboden. */
  y: number
  b: number
  /** Bauhöhe; 0 bei Linien. */
  h: number
  /** Tiefe (Draufsicht); ohne Angabe die Korpustiefe. */
  t?: number
  label: string
  /** Teilungen von unten (Auszüge eines Containers), in mm Bauhöhe. */
  teilungen?: number[]
  /** Deckplatte in Rauchglas (Container). */
  rauchglas?: boolean
  /** Rasterposition der Unterkante (0 = Korpusboden), falls auf einem Raster. */
  raster?: number
  /** Gesetzt, wenn die Stapelregel das Teil verschoben hat — Klartext. */
  verschoben?: string
}

export interface Korpus2D {
  index: number
  x: number
  b: number
  nennCm: number
  lochreihe: boolean
  /** Zusätzlicher Bodenträger in der Rückwand (breite Korpi, S. 26). */
  bodentraeger: boolean
  /** Ausschnitte in der Rückwand (Rückwandausschnitt, Revisionsklappe). */
  rueckwandAusschnitte: string[]
}

export interface Konstruktion2D {
  breiteMm: number
  hoeheMm: number
  tiefeMm: number
  wandabstandMm: number
  /** Unterkante der Fronten über dem Fußboden. */
  frontUnterkanteMm: number
  /** Oberkante der Bodenplatte / Unterkante des Abschlussbodens. */
  innenBodenMm: number
  innenObenMm: number
  korpusse: Korpus2D[]
  abschluss: { links?: number; rechts?: number }
  verblendung?: { art: 'korpusbuendig' | 'frontbuendig'; links: boolean; oben: boolean; rechts: boolean; mm: number }
  fussleiste?: { hoeheMm: number; tiefeMm: number }
  fronten: Front2D[]
  ausstattung: Ausstattung2D[]
  schiebetueren: number
  /** Sichtrückwand außen gewählt (Material wird im Schritt „Material" festgelegt). */
  sichtrueckwand: boolean
  /** Hinweise der Stapelregel und nicht zeichenbare Teile. */
  hinweise: string[]
}

// ---------------------------------------------------------------------------
// Griffe
// ---------------------------------------------------------------------------

/** Silhouette je Griff-Nr. (Preisliste S. 3, Griffe/Schlösser). */
const GRIFF_FORMEN: Record<string, GriffForm> = {
  nr19: { art: 'knopf' },
  nr90: { art: 'buegel', laengeMm: 140 },
  nr91: { art: 'buegel', laengeMm: 300 },
  nr103: { art: 'buegel', laengeMm: 138 },
  nr105: { art: 'buegel', laengeMm: 140 },
  nr120: { art: 'buegel', laengeMm: 158 },
  nr121: { art: 'buegel', laengeMm: 222 },
  nr122: { art: 'buegel', laengeMm: 137 },
  nr123: { art: 'buegel', laengeMm: 329 },
  nr124: { art: 'buegel', laengeMm: 457 },
  nr125: { art: 'kante', laengeMm: 52 },
  nr126: { art: 'kante', laengeMm: 148 },
  nr127: { art: 'leiste', laengeMm: 200 },
  nr128: { art: 'muschel' },
  sondergriff: { art: 'sonder' },
}

function mmVon(text: string | undefined): number | undefined {
  if (!text || !text.trim()) return undefined
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) : undefined
}

/** Griffform einer Front — Stil-Linie mit eigener Griffleiste vor PTO vor Griff-Nr. */
export function griffFormVon(el: FrontElement): GriffForm | undefined {
  if (el.typeId === ZWEILAEUFIG_TYPE_ID) {
    if (el.styleLineId === 'curve') return { art: 'profil', stil: 'curve' }
    return griffProfilAnwendbar(el) && el.griffProfil ? { art: 'edge' } : undefined
  }
  if (el.styleLineId === 'line' || el.styleLineId === '107' || el.styleLineId === 'curve') {
    return { art: 'profil', stil: el.styleLineId }
  }
  if (el.griff && el.griffId) {
    if (el.griffId === 'edge') return { art: 'edge', laengeMm: mmVon(el.griffLaengeCm) }
    return GRIFF_FORMEN[el.griffId] ?? { art: 'sonder' }
  }
  if (el.pto) return { art: 'pto' }
  return undefined
}

/** Griffmitte über dem Fußboden für eine Front. */
function griffMitte(art: FrontArt, y: number, h: number): number {
  if (art === 'schublade' || art === 'klappe') return y + h - Math.min(K.griffSchubVonObenMm, h / 3)
  const regel = K.griffhoeheTuer
  if (regel.modus === 'festMm' && regel.mm > y + 150 && regel.mm < y + h - 150) return regel.mm
  return y + h / 2
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

// ---------------------------------------------------------------------------
// Ausstattung + Stapelregel
// ---------------------------------------------------------------------------

interface Belegung {
  von: number
  bis: number
  text: string
}

/** Wunschposition eines Stücks: Unterkante über dem Fußboden und Rasterzahl. */
function wunschposition(item: SegmentEquipmentItem, stueck: number): { y: number; raster?: number } | undefined {
  const h = item.hoehen?.[stueck]
  if (!h) return undefined
  if (h.modus === 'boden') return { y: rasterHoeheMm(0), raster: 0 }
  if (h.modus === 'raster' && h.raster != null && h.raster >= 1) return { y: rasterHoeheMm(h.raster), raster: h.raster }
  if (h.modus === 'cm') {
    const cm = Number(String(h.cm ?? '').replace(',', '.').replace(/[^\d.]/g, ''))
    if (Number.isFinite(cm) && cm > 0) return { y: K.bodenplatteOberkanteMm + Math.round(cm * 10) }
  }
  return undefined
}

function containerSchluessel(item: SegmentEquipmentItem): string | undefined {
  const serie = item.optionId === 'container-craft' ? 'craft' : item.optionId === 'container-conero' ? 'conero' : undefined
  return serie && item.variant ? `${serie}:${item.variant}` : undefined
}

/** Teilungen eines Containers, proportional auf seine Bauhöhe verteilt. */
function teilungenVon(schluessel: string | undefined, hoehe: number, schuebe?: number): number[] {
  const roh = schluessel ? K.containerAuszuege[schluessel] : undefined
  const anteile = roh ?? Array.from({ length: Math.max(1, schuebe ?? 1) }, () => 1)
  const summe = anteile.reduce((s, x) => s + x, 0)
  return anteile.map((x) => Math.round((x / summe) * hoehe))
}

/**
 * Setzt ein Teil auf die Wunschhöhe — oder, wenn dort schon etwas liegt, auf das nächste freie
 * Raster darüber. Gibt die Unterkante und ggf. den Verschiebe-Hinweis zurück.
 */
function platziere(belegt: Belegung[], y: number, h: number, name: string, obergrenze: number): { y: number; raster?: number; verschoben?: string } {
  let unten = y
  let raster: number | undefined
  let grund: Belegung | undefined
  for (let schutz = 0; schutz < 40; schutz++) {
    const konflikt = belegt.find((b) => unten < b.bis && unten + Math.max(h, 1) > b.von)
    if (!konflikt) break
    grund = konflikt
    raster = naechstesRasterAb(konflikt.bis)
    unten = rasterHoeheMm(raster)
  }
  if (unten + h > obergrenze) return { y: unten, verschoben: `${name} passt über ${grund?.text ?? 'der Belegung'} nicht mehr in den Korpus.` }
  return {
    y: unten,
    raster,
    verschoben: grund ? `${name}: über ${grund.text} gesetzt (${raster === 0 ? 'Korpusboden' : `Raster ${raster}`}).` : undefined,
  }
}

function ausstattungDesKorpus(
  items: SegmentEquipmentItem[],
  k: Korpus2D,
  aussenschuebe: Front2D[],
  innenOben: number,
  hinweise: string[],
): Ausstattung2D[] {
  const teile: Ausstattung2D[] = []
  const xi = k.x + K.seiteMm
  const bi = k.b - 2 * K.seiteMm
  const belegt: Belegung[] = []
  const korpusName = `Korpus ${k.index + 1}`

  // Außenschübe: Schubkästen hinter den Schubfronten, darüber ein Trennboden.
  if (aussenschuebe.length > 0) {
    for (const s of aussenschuebe) {
      teile.push({ art: 'aussenschub', korpus: k.index, x: xi, y: s.y, b: bi, h: s.h, label: s.label ? `Schub ${s.label}` : 'Schub' })
    }
    const oben = Math.max(...aussenschuebe.map((s) => s.y + s.h))
    teile.push({ art: 'trennboden', korpus: k.index, x: xi, y: oben, b: bi, h: K.trennbodenMm, label: 'Trennboden' })
    belegt.push({ von: 0, bis: oben + K.trennbodenMm, text: 'die Außenschübe' })
  }

  // Erst alles mit Höhe sammeln, dann von unten nach oben setzen.
  interface Kandidat {
    y: number
    h: number
    name: string
    bauen: (y: number, raster: number | undefined, verschoben: string | undefined) => Ausstattung2D[]
    belegtMm: number
  }
  const kandidaten: Kandidat[] = []
  const ohnePosition: string[] = []

  for (const item of items) {
    const option = getEquipmentOption(item.optionId)
    if (!option) continue
    const label = option.label
    const anzahl = option.heightPerPiece ? Math.max(1, item.qty ?? 1) : 1
    const punktweise = (art: AusstattungArt, h: number, mitStange = false) => {
      for (let s = 0; s < anzahl; s++) {
        const pos = wunschposition(item, s)
        if (!pos) {
          ohnePosition.push(label)
          continue
        }
        kandidaten.push({
          y: pos.y,
          h,
          name: anzahl > 1 ? `${label} ${s + 1}` : label,
          belegtMm: h,
          bauen: (y, raster, verschoben) => {
            const r = raster ?? pos.raster
            const liste: Ausstattung2D[] = [{ art, optionId: item.optionId, korpus: k.index, x: xi, y, b: bi, h, label, raster: r, verschoben }]
            if (mitStange) {
              liste.push({ art: 'kleiderstange', optionId: item.optionId, korpus: k.index, x: xi + 20, y: y - K.kleiderstangeUnterBodenMm, b: bi - 40, h: 0, label: 'Kleiderstange' })
            }
            return liste
          },
        })
      }
    }

    switch (item.optionId) {
      case 'einlegeboden':
        punktweise('boden', K.einlegebodenMm)
        break
      case 'einlegeboden-kleiderstange':
        punktweise('boden', K.einlegebodenMm, true)
        break
      case 'glasboden':
        punktweise('glasboden', K.glasbodenMm)
        break
      case 'rollboden':
        punktweise('rollboden', K.rollbodenMm)
        break
      case 'rollkorb':
        punktweise('rollkorb', K.rollkorbMm)
        break
      case 'rollboden-schuhablage-craft':
        punktweise('schuhablage', K.schuhablageCraftMm)
        break
      case 'guertel-krawattenauszug-conero':
        punktweise('seitenauszug', 400)
        break
      case 'container':
      case 'innenschublade':
      case 'container-craft':
      case 'container-conero': {
        const schluessel = containerSchluessel(item)
        const raster = varianteRaster(item.variant)
        const h =
          (schluessel ? K.containerHoeheMm[schluessel] : undefined) ??
          (raster != null ? Math.round(raster * K.rasterMm) : Math.round(4.5 * K.rasterMm))
        const amBoden = item.optionId !== 'innenschublade'
        const pos = amBoden ? { y: rasterHoeheMm(0), raster: 0 } : wunschposition(item, 0) ?? { y: rasterHoeheMm(0), raster: 0 }
        const n = item.optionId === 'container' ? Math.max(1, item.qty ?? 1) : 1
        const schuebe = raster != null ? Math.max(1, Math.round(raster / K.containerSchubRaster)) : 1
        const name = `${label}${item.variant ? ` ${item.variant.replace(/R$/, ' R')}` : ''}`
        for (let s = 0; s < n; s++) {
          kandidaten.push({
            y: pos.y + s * h,
            h,
            name,
            belegtMm: h,
            bauen: (y, r, verschoben) => [
              {
                art: item.optionId === 'innenschublade' ? 'innenschublade' : 'container',
                optionId: item.optionId,
                korpus: k.index,
                x: xi,
                y,
                b: bi,
                h,
                t: K.containerTiefeMm,
                label: name + (item.rauchglas ? ' · Rauchglas' : ''),
                teilungen: item.optionId === 'innenschublade' ? [h] : teilungenVon(schluessel, h, schuebe),
                rauchglas: Boolean(item.rauchglas),
                raster: r ?? pos.raster,
                verschoben,
              },
            ],
          })
        }
        break
      }
      case 'hemdeinsatz-craft':
        // Lose auf einen Boden gelegt — ohne Bezug auf den Korpusboden.
        kandidaten.push({
          y: rasterHoeheMm(0),
          h: K.hemdeinsatzMm,
          name: label,
          belegtMm: K.hemdeinsatzMm,
          bauen: (y, r, verschoben) => [{ art: 'hemdeinsatz', optionId: item.optionId, korpus: k.index, x: xi, y, b: bi, h: K.hemdeinsatzMm, label, raster: r, verschoben }],
        })
        break
      case 'kleiderlift':
      case 'kleiderlift-conero':
        teile.push({ art: 'kleiderlift', optionId: item.optionId, korpus: k.index, x: xi, y: innenOben - 140, b: bi, h: 140, label })
        break
      case 'led-syncro':
        teile.push({ art: 'led-deckel', optionId: item.optionId, korpus: k.index, x: xi, y: innenOben - 15, b: bi, h: 0, label: 'LED-Syncro' })
        break
      case 'led-band-aluprofil': {
        const seiten = item.seiten ?? { links: true }
        if (seiten.links) teile.push({ art: 'led-seite', optionId: item.optionId, korpus: k.index, x: xi + 8, y: K.bodenplatteOberkanteMm, b: 0, h: innenOben - K.bodenplatteOberkanteMm, label: 'LED' })
        if (seiten.rechts) teile.push({ art: 'led-seite', optionId: item.optionId, korpus: k.index, x: xi + bi - 8, y: K.bodenplatteOberkanteMm, b: 0, h: innenOben - K.bodenplatteOberkanteMm, label: 'LED' })
        break
      }
      case 'rueckwandausschnitt':
      case 'revisionsklappe':
        k.rueckwandAusschnitte.push(label)
        break
      default:
        teile.push({ art: 'hinweis', optionId: item.optionId, korpus: k.index, x: xi, y: K.bodenplatteOberkanteMm, b: bi, h: 0, label })
    }
  }

  kandidaten.sort((a, b) => a.y - b.y)
  for (const kand of kandidaten) {
    const platz = platziere(belegt, kand.y, kand.belegtMm, kand.name, innenOben)
    if (platz.verschoben) hinweise.push(`${korpusName} — ${platz.verschoben}`)
    teile.push(...kand.bauen(platz.y, platz.raster, platz.verschoben))
    belegt.push({ von: platz.y, bis: platz.y + kand.belegtMm, text: kand.name })
  }
  for (const name of new Set(ohnePosition)) hinweise.push(`${korpusName} — ${name}: ohne Einbauhöhe, nicht gezeichnet.`)
  return teile
}

// ---------------------------------------------------------------------------
// Modell
// ---------------------------------------------------------------------------

/** Das Modell eines Entwurfs — `null`, solange Höhe, Tiefe oder eine Korpusbreite fehlen. */
export function konstruktion(
  draft: Pick<Draft, 'korpusGrunddaten' | 'fronts' | 'seriesId' | 'ausstattung' | 'sichtRueckwandAussen'>,
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
  const frontUnterkante = zone != null ? Math.max(0, hoehe - zone) : 0
  const innenOben = hoehe - K.abschlussbodenUnterOberkanteMm - K.abschlussbodenMm

  const korpusse: Korpus2D[] = []
  let x = links ? setMm : 0
  g.korpusse.forEach((einheit, index) => {
    const nenn = breiten[index] as number
    const mm = Math.round(nenn * 10)
    korpusse.push({ index, x, b: mm, nennCm: nenn, lochreihe: einheit.lochreihe, bodentraeger: mm >= K.bodentraegerAbBreiteMm, rueckwandAusschnitte: [] })
    x += mm
  })
  const breite = x + (rechts ? setMm : 0)

  // Fronten.
  const fronten: Front2D[] = []
  let schiebetueren = 0
  if (hasZweilaeufigeSchiebetuer(draft.fronts)) {
    const tuer = (draft.fronts?.columns ?? []).flatMap((c) => c.elements).find((e) => e.typeId === ZWEILAEUFIG_TYPE_ID)
    const aufteilung = gewaehlteAufteilung(draft)
    const anzahl =
      aufteilung && aufteilung.felder.length > 0
        ? aufteilung.anzahl
        : draft.fronts?.schiebetuerAnzahl ?? vorgeschlageneAnzahl(aufteilungenFuerEntwurf(draft))
    schiebetueren = anzahl
    // Die Türen decken Abschlusssets und Innenkorpus ab (Überarbeitung 10, S. 1).
    const anteil = breite / anzahl
    for (let i = 0; i < anzahl; i++) {
      const griff = tuer ? griffFormVon(tuer) : undefined
      fronten.push({
        art: 'schiebetuer',
        typeId: ZWEILAEUFIG_TYPE_ID,
        x: Math.round(i * anteil),
        y: frontUnterkante,
        b: Math.round(anteil),
        h: hoehe - frontUnterkante,
        label: `ST${i + 1}`,
        ebene: i % 2 === 1 ? 1 : 0,
        // Griffprofile über die volle Türhöhe, an der zur Mitte zeigenden Kante.
        griff,
        anschlag: i < anzahl / 2 ? 'links' : 'rechts',
      })
    }
  } else {
    ;(draft.fronts?.columns ?? []).forEach((column, i) => {
      const k = korpusse[i]
      if (!k) return
      const geo = segmentGeometrie(g, draft.seriesId, i)
      let y = frontUnterkante
      for (const ebene of ebenenDerSpalte(column, geo)) {
        const rest = hoehe - y - K.fugeMm
        const h = Math.min(ebene.hoeheMm != null && ebene.hoeheMm > 0 ? ebene.hoeheMm : rest, rest)
        if (h <= 0) break
        const belegt = ebene.belegtMm + (ebene.elemente.length - 1) * K.fugeMm
        let xs = k.x + Math.max(0, Math.round((k.b - belegt) / 2))
        ebene.elemente.forEach((el, j) => {
          const b = mmVon(el.widthCm) ?? k.b - 2 * K.fugeMm
          const art = frontArt(el)
          const hEl = Math.min(mmVon(el.heightCm) ?? h, h)
          const anschlag = el.tuerAnschlag ?? (ebene.elemente.length === 2 ? (j === 0 ? 'links' : 'rechts') : 'links')
          fronten.push({ art, typeId: el.typeId, x: xs, y, b, h: hEl, label: el.label || undefined, anschlag, griff: griffFormVon(el), griffY: griffMitte(art, y, hEl) })
          xs += b + K.fugeMm
        })
        y += h + K.fugeMm
      }
    })
  }

  // Ausstattung (Spalte i gehört zu Korpus i) — mit Stapelregel gegen die Außenschübe.
  const hinweise: string[] = []
  const ausstattung = korpusse.flatMap((k) => {
    const schuebe = fronten.filter((f) => f.art === 'schublade' && f.x >= k.x - 1 && f.x < k.x + k.b)
    return ausstattungDesKorpus(draft.fronts?.columns[k.index]?.equipment ?? [], k, schuebe, innenOben, hinweise)
  })

  const v = g.verblendung
  const fl = g.fussleiste
  const flH = fl?.enabled ? mmVon(fl.hoeheCm) : undefined
  const flT = fl?.enabled ? mmVon(fl.tiefeCm) : undefined

  return {
    breiteMm: breite,
    hoeheMm: hoehe,
    tiefeMm: tiefe,
    wandabstandMm: Math.round(beleuchtungsZugabeCm(g, optionen) * 10),
    frontUnterkanteMm: frontUnterkante,
    innenBodenMm: K.bodenplatteOberkanteMm,
    innenObenMm: innenOben,
    korpusse,
    abschluss: { links: links ? setMm : undefined, rechts: rechts ? setMm : undefined },
    verblendung:
      v && v.art !== 'keine' && (v.seiten?.links || v.seiten?.oben || v.seiten?.rechts)
        ? { art: v.art, links: Boolean(v.seiten?.links), oben: Boolean(v.seiten?.oben), rechts: Boolean(v.seiten?.rechts), mm: K.verblendungMm }
        : undefined,
    fussleiste: flH && flT ? { hoeheMm: flH, tiefeMm: flT } : undefined,
    fronten,
    ausstattung,
    schiebetueren,
    sichtrueckwand: Boolean(draft.sichtRueckwandAussen),
    hinweise,
  }
}

/** Maßtext in mm mit Komma („1870,5" / „2921"). */
export function mmText(mm: number): string {
  return String(Math.round(mm * 10) / 10).replace('.', ',')
}
