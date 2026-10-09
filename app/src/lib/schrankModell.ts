import type { Draft, FrontElement } from '../types/index.ts'
import { FUGE_MM, frontAufteilung, mmZuCm } from './frontbreiten.ts'
import { ebenenDerSpalte, frontzoneMm, segmentGeometrie } from './frontGeometrie.ts'
import { ZWEILAEUFIG_TYPE_ID, hasZweilaeufigeSchiebetuer } from './frontsHelpers.ts'
import {
  abschlusssetStaerkeMm,
  aussenmassOptionen,
  berechneAussenmass,
  resolveDepthCm,
  resolveHeightCm,
  resolveKorpusBreiteCm,
} from './korpusMass.ts'
import {
  aufteilungenFuerEntwurf,
  gewaehlteAufteilung,
  schiebetuerAufteilungen,
  korpusBreitenCm,
  vorgeschlageneAnzahl,
} from './schiebetuer.ts'

/**
 * SCHRANK-MODELL FÜR DIE 3D-VORSCHAU (Überarbeitung 10).
 *
 * Übersetzt die Korpus-Grunddaten (Schritt „Maße") und — sobald geplant — die Fronten in eine
 * Liste einfacher Quader. Die Darstellung (`components/vorschau/Schrank3DVorschau.tsx`) zeichnet
 * nur noch, was hier steht; dadurch lässt sich das Modell ohne Browser prüfen
 * (`npm run ue10:test`) und bleibt mit Außenmaß, Frontgeometrie und Türfeldern deckungsgleich.
 *
 * Koordinaten in cm: x von links (Außenkante Abschlussset), y vom Boden, z von der Rückwand
 * nach vorne. Ein Quader steht mit seiner linken, unteren, hinteren Ecke auf (x, y, z).
 *
 * Bewusst eine VORSCHAU: Platten- und Frontstärken sind Anschauungswerte, keine
 * Fertigungsmaße. Maßgeblich bleibt das Außenmaß aus `berechneAussenmass`.
 */

export type BauteilArt =
  | 'korpus'
  | 'rueckwand'
  | 'abschlussset'
  | 'sockel'
  | 'drehtuer'
  | 'schublade'
  | 'schiebetuer'
  | 'klappe'
  | 'griff'
  | 'kleiderstange'

export interface Bauteil3D {
  art: BauteilArt
  x: number
  y: number
  z: number
  b: number
  h: number
  t: number
  /** Korpus, zu dem das Teil gehört (0-basiert). */
  korpus?: number
  /** Kurzlabel, z. B. „D1" oder „100er". */
  label?: string
}

/** Welche Fronten die Vorschau zeigt. */
export type FrontVorschau = 'geplant' | 'drehtueren' | 'schiebetueren' | 'ohne'

export interface SchrankModell {
  /** Außenmaße des Modells in cm. */
  breiteCm: number
  hoeheCm: number
  tiefeCm: number
  /** Außenmaß laut Rechenregel (Fronten, Fugen, Abschlusssets), falls berechenbar. */
  aussenbreiteCm?: number
  bauteile: Bauteil3D[]
  korpusse: Array<{ xCm: number; breiteCm: number }>
  /** Welche Fronten tatsächlich gezeichnet wurden. */
  fronten: FrontVorschau
  /** Fronten im Entwurf geplant? Dann ist „geplant" wählbar. */
  hatGeplanteFronten: boolean
  /** Anzahl der gezeichneten Schiebetüren (0 ohne). */
  schiebetueren: number
}

/** Anschauungswerte (cm). */
export const PLATTE_CM = 1.9
export const RUECKWAND_CM = 0.8
export const FRONT_CM = 1.9
/** Abstand der beiden Laufebenen der zweiläufigen Schiebetür und Überlappung der Türen. */
export const SCHIEBE_EBENEN_ABSTAND_CM = 2.4
export const SCHIEBE_UEBERLAPPUNG_CM = 2

const FUGE_CM = FUGE_MM / 10

/** Gibt es irgendeine Front im Entwurf? */
function hatFronten(draft: Pick<Draft, 'fronts'>): boolean {
  return (draft.fronts?.columns ?? []).some((c) => c.elements.length > 0)
}

function cmVon(text: string | undefined): number | undefined {
  if (!text || !text.trim()) return undefined
  const n = Number(text.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function frontArt(el: FrontElement): BauteilArt | null {
  switch (el.typeId) {
    case 'drehtuer':
      return 'drehtuer'
    case 'schuebe':
      return 'schublade'
    case 'schiebetuer':
    case ZWEILAEUFIG_TYPE_ID:
      return 'schiebetuer'
    case 'offen':
      return null
    default:
      return 'klappe'
  }
}

/**
 * Das Modell eines Entwurfs — `null`, solange Höhe, Tiefe oder eine Korpusbreite fehlen.
 *
 * @param vorschau Welche Fronten gezeigt werden. „geplant" ohne geplante Fronten zeigt die
 *   Standard-Drehtüren je Korpus (so, wie der Fronten-Schritt sie vorschlagen würde).
 */
export function schrankModell(
  draft: Pick<Draft, 'korpusGrunddaten' | 'fronts' | 'seriesId' | 'ausstattung'>,
  vorschau: FrontVorschau = 'geplant',
): SchrankModell | null {
  const g = draft.korpusGrunddaten
  if (!g || g.korpusse.length === 0) return null
  const hoehe = resolveHeightCm(g)
  const tiefe = resolveDepthCm(g)
  const breiten = g.korpusse.map((k) => resolveKorpusBreiteCm(k))
  if (hoehe == null || tiefe == null || breiten.some((b) => b == null)) return null

  const optionen = aussenmassOptionen(draft)
  const setCm = abschlusssetStaerkeMm(optionen) / 10
  const links = g.abschlussSet?.position === 'links' || g.abschlussSet?.position === 'beide'
  const rechts = g.abschlussSet?.position === 'rechts' || g.abschlussSet?.position === 'beide'

  // Frontzone: Die Fronten beginnen über dem Sockelbereich (Höhe − Frontzone).
  const zoneMm = frontzoneMm(g, draft.seriesId)
  const frontY0 = zoneMm != null ? Math.max(0, Math.round((hoehe - zoneMm / 10) * 10) / 10) : 0
  const frontHoehe = hoehe - frontY0

  const bauteile: Bauteil3D[] = []
  const korpusse: SchrankModell['korpusse'] = []

  let x = 0
  if (links) {
    bauteile.push({ art: 'abschlussset', x, y: 0, z: 0, b: setCm, h: hoehe, t: tiefe, label: 'Abschlussset links' })
    x += setCm
  }
  breiten.forEach((b, i) => {
    const breite = b as number
    korpusse.push({ xCm: x, breiteCm: breite })
    // Seiten, Boden, Deckel als ein „Korpus"-Rahmen aus vier Platten.
    bauteile.push({ art: 'korpus', x, y: 0, z: 0, b: PLATTE_CM, h: hoehe, t: tiefe, korpus: i })
    bauteile.push({ art: 'korpus', x: x + breite - PLATTE_CM, y: 0, z: 0, b: PLATTE_CM, h: hoehe, t: tiefe, korpus: i })
    bauteile.push({ art: 'korpus', x: x + PLATTE_CM, y: frontY0, z: 0, b: breite - 2 * PLATTE_CM, h: PLATTE_CM, t: tiefe, korpus: i })
    bauteile.push({ art: 'korpus', x: x + PLATTE_CM, y: hoehe - PLATTE_CM, z: 0, b: breite - 2 * PLATTE_CM, h: PLATTE_CM, t: tiefe, korpus: i })
    bauteile.push({ art: 'rueckwand', x: x + PLATTE_CM, y: frontY0, z: 0, b: breite - 2 * PLATTE_CM, h: hoehe - frontY0, t: RUECKWAND_CM, korpus: i })
    if (frontY0 > 0) {
      bauteile.push({ art: 'sockel', x: x + PLATTE_CM, y: 0, z: tiefe - 5, b: breite - 2 * PLATTE_CM, h: frontY0, t: 2, korpus: i })
    }
    // Kleiderstange als Anschauung des Innenraums (nur sichtbar ohne Fronten).
    bauteile.push({
      art: 'kleiderstange',
      x: x + PLATTE_CM,
      y: hoehe - 12,
      z: tiefe / 2 - 1,
      b: breite - 2 * PLATTE_CM,
      h: 2,
      t: 2,
      korpus: i,
    })
    x += breite
  })
  if (rechts) {
    bauteile.push({ art: 'abschlussset', x, y: 0, z: 0, b: setCm, h: hoehe, t: tiefe, label: 'Abschlussset rechts' })
    x += setCm
  }
  const gesamtBreite = x

  const geplant = hatFronten(draft)
  let fronten: FrontVorschau = vorschau
  if (fronten === 'geplant' && !geplant) fronten = 'drehtueren'

  let schiebetueren = 0
  const zFront = tiefe

  /** Zweiläufige Schiebetüren über die ganze Breite: abwechselnd vordere und hintere Ebene. */
  const zeichneSchiebetueren = (anzahl: number) => {
    schiebetueren = anzahl
    // Die Türen decken Abschlusssets und Innenkorpus ab (Überarbeitung 10, S. 1).
    const anteil = gesamtBreite / anzahl
    for (let i = 0; i < anzahl; i++) {
      const vorne = i % 2 === 1
      const b = anteil + (i === 0 || i === anzahl - 1 ? SCHIEBE_UEBERLAPPUNG_CM / 2 : SCHIEBE_UEBERLAPPUNG_CM)
      const xs = Math.max(0, i * anteil - (i === 0 ? 0 : SCHIEBE_UEBERLAPPUNG_CM / 2))
      const z = zFront + (vorne ? SCHIEBE_EBENEN_ABSTAND_CM : 0)
      bauteile.push({ art: 'schiebetuer', x: xs, y: frontY0, z, b: Math.min(b, gesamtBreite - xs), h: frontHoehe, t: FRONT_CM, label: `ST${i + 1}` })
      // Griffprofil an der Kante, die zur Mitte zeigt.
      const griffX = i < anzahl / 2 ? xs + Math.min(b, gesamtBreite - xs) - 1.2 : xs + 0.2
      bauteile.push({ art: 'griff', x: griffX, y: frontY0 + frontHoehe * 0.15, z: z + FRONT_CM, b: 1, h: frontHoehe * 0.7, t: 0.8 })
    }
  }

  /** Drehtür mit Griff an der Schließkante. */
  const zeichneTuer = (art: BauteilArt, xs: number, y: number, b: number, h: number, label: string | undefined, griffRechts: boolean) => {
    bauteile.push({ art, x: xs, y, z: zFront, b, h, t: FRONT_CM, label })
    if (art === 'drehtuer') {
      const gx = griffRechts ? xs + b - 3 : xs + 2
      bauteile.push({ art: 'griff', x: gx, y: y + h / 2 - Math.min(20, h / 4), z: zFront + FRONT_CM, b: 1, h: Math.min(40, h / 2), t: 1.2 })
    } else if (art === 'schublade' || art === 'klappe') {
      bauteile.push({ art: 'griff', x: xs + b / 2 - Math.min(15, b / 4), y: y + h - Math.min(6, h / 3), z: zFront + FRONT_CM, b: Math.min(30, b / 2), h: 1, t: 1.2 })
    }
  }

  if (fronten === 'schiebetueren') {
    zeichneSchiebetueren(vorgeschlageneAnzahl(schiebetuerAufteilungen(korpusBreitenCm(g))))
  } else if (fronten === 'drehtueren') {
    // Standardvorschlag je Korpus: bis 60 cm eine Tür, darüber zwei (Punkt 4.13).
    korpusse.forEach((k, i) => {
      const auf = frontAufteilung(k.breiteCm)
      if (!auf) return
      const fb = mmZuCm(auf.frontMm)
      const start = k.xCm + (k.breiteCm - (auf.anzahl * fb + (auf.anzahl - 1) * FUGE_CM)) / 2
      for (let t = 0; t < auf.anzahl; t++) {
        const rechtsAnschlag = auf.anzahl === 2 ? t === 1 : i % 2 === 1
        zeichneTuer('drehtuer', start + t * (fb + FUGE_CM), frontY0, fb, frontHoehe - FUGE_CM, undefined, !rechtsAnschlag)
      }
    })
  } else if (fronten === 'geplant') {
    if (hasZweilaeufigeSchiebetuer(draft.fronts)) {
      const aufteilung = gewaehlteAufteilung(draft)
      zeichneSchiebetueren(
        aufteilung && aufteilung.felder.length > 0
          ? aufteilung.anzahl
          : draft.fronts?.schiebetuerAnzahl ?? vorgeschlageneAnzahl(aufteilungenFuerEntwurf(draft)),
      )
    } else {
      ;(draft.fronts?.columns ?? []).forEach((column, i) => {
        const k = korpusse[i]
        if (!k) return
        const geo = segmentGeometrie(g, draft.seriesId, i)
        let y = frontY0
        for (const ebene of ebenenDerSpalte(column, geo)) {
          const hoeheEbene = ebene.hoeheMm != null && ebene.hoeheMm > 0 ? ebene.hoeheMm / 10 : undefined
          // Ohne Höhe (z. B. einläufige Schiebetür ohne Angabe): der Rest bis oben.
          const h = Math.min(hoeheEbene ?? hoehe - y - FUGE_CM, hoehe - y - FUGE_CM)
          if (h <= 0) break
          const belegt = ebene.belegtMm / 10 + (ebene.elemente.length - 1) * FUGE_CM
          let xs = k.xCm + Math.max(0, (k.breiteCm - belegt) / 2)
          ebene.elemente.forEach((el, j) => {
            const b = cmVon(el.widthCm) ?? k.breiteCm - 2 * FUGE_CM
            const art = frontArt(el)
            const hEl = cmVon(el.heightCm) ?? h
            if (art) {
              const anschlag = el.tuerAnschlag ?? (ebene.elemente.length === 2 ? (j === 0 ? 'links' : 'rechts') : 'links')
              zeichneTuer(art, xs, y, b, Math.min(hEl, h), el.label || undefined, anschlag === 'links')
            }
            xs += b + FUGE_CM
          })
          y += h + FUGE_CM
        }
      })
    }
  }

  const masse = berechneAussenmass(g, optionen)
  return {
    breiteCm: Math.round(gesamtBreite * 10) / 10,
    hoeheCm: hoehe,
    tiefeCm: tiefe,
    aussenbreiteCm: masse.gesamtbreiteCm,
    bauteile,
    korpusse,
    fronten,
    hatGeplanteFronten: geplant,
    schiebetueren,
  }
}
