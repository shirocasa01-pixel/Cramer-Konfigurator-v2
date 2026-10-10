import type { jsPDF } from 'jspdf'
import { brand } from '../config/brand'
import { KONSTRUKTION as K } from '../config/konstruktionsParameter'
import { mmText, type Front2D, type Konstruktion2D } from './konstruktion'
import type { LookbookDaten } from './lookbookDaten'

/**
 * SEITE 1 DES AV-PDFs — 1:1 nach der Cramer-AV-Konstruktionszeichnung (A4 quer).
 *
 *   ┌──────────────────────────┬─────────────────────────────────┐
 *   │                          │  -- Refugium innen … --          │
 *   │  Isometrie (Vektor,      │  Grundriss mit Maßketten         │
 *   │  Material auf den        ├─────────────────────────────────┤
 *   │  Fronten senkrecht)      │  Innenansicht (offener Schrank)  │
 *   ├──────────────┐           │  mit Höhen und ‹LED›             │
 *   │ Refugium …   ├──────────┬┴────────────┬──────────┬─────────┤
 *   │ Maße · X-Felder │ GRIFF … RW │ Daten · CRAMER PLANER │ Kunde … │
 *   └──────────────┴──────────┴─────────────┴──────────┴─────────┘
 *
 * Alle Positionen stehen im Raster der Vorlage (1000 × 708 px, Zeichenrahmen 18…992 ×
 * 18…697) und werden auf die Seite umgerechnet — so bleibt die Aufteilung identisch.
 * Isometrie und Grundriss zeichnet jsPDF als Vektoren aus dem 2D-Modell; die Innenansicht
 * kommt als Bild (`components/konstruktion/skizzenBild.tsx`), damit sie genau der Skizze am
 * Bildschirm entspricht. Ohne Bild (Prüfung ohne Browser) steht dort ein Hinweis.
 */

export interface LookbookBild {
  dataUrl: string
  breite: number
  hoehe: number
}

export interface LookbookBilder {
  innen?: LookbookBild
}

type Punkt = [number, number]
interface Feld4 {
  l: number
  t: number
  r: number
  b: number
}

const C30 = Math.cos(Math.PI / 6)
const S30 = 0.5

export function zeichneLookbookSeite(doc: jsPDF, d: LookbookDaten, bilder: LookbookBilder = {}): void {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const R = { x: 16, y: 16, w: W - 32, h: H - 32 }
  const X = (px: number) => R.x + ((px - 18) / 974) * R.w
  const Y = (py: number) => R.y + ((py - 18) / 679) * R.h
  const schrift = (pt: number, stil: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', stil)
    doc.setFontSize(pt)
  }
  /** Text in eine Breite zwingen: erst kleiner (bis `min`), dann gekürzt. */
  const passend = (text: string, breite: number, pt: number, min = 5.5): string => {
    let g = pt
    doc.setFontSize(g)
    while (g > min && doc.getTextWidth(text) > breite) doc.setFontSize((g -= 0.5))
    return doc.getTextWidth(text) > breite ? (doc.splitTextToSize(text, breite)[0] ?? '') : text
  }
  const linie = (x1: number, y1: number, x2: number, y2: number) => doc.line(X(x1), Y(y1), X(x2), Y(y2))
  doc.setTextColor(0, 0, 0)
  doc.setDrawColor(0, 0, 0)
  doc.setFillColor(255, 255, 255)

  // --- Rahmen mit Feldteilung --------------------------------------------------------------
  doc.setLineWidth(0.4)
  doc.rect(8, 8, W - 16, H - 16)
  for (const px of [237, 465, 760]) {
    doc.line(X(px), 8, X(px), R.y)
    doc.line(X(px), H - 8, X(px), R.y + R.h)
  }
  for (const py of [180, 360, 540]) {
    doc.line(8, Y(py), R.x, Y(py))
    doc.line(W - 8, Y(py), R.x + R.w, Y(py))
  }
  doc.setLineWidth(0.8)
  doc.rect(R.x, R.y, R.w, R.h)
  doc.setLineWidth(0.6)
  linie(465, 18, 465, 607)
  linie(465, 215, 992, 215)

  // --- A) Isometrie (links) -----------------------------------------------------------------
  schrift(7.5)
  if (d.modell) isometrie(doc, d, d.modell, { l: X(18) + 12, t: Y(18) + 8, r: X(465) - 12, b: Y(607) - 6 }, [X(298), Y(548) - 6])

  // --- B) Grundriss (oben rechts) -------------------------------------------------------------
  schrift(10.5)
  doc.text(passend(d.innenTitel, X(980) - X(478), 10.5), X(728), Y(38), { align: 'center' })
  if (d.modell) grundriss(doc, d.modell, { l: X(478), t: Y(50), r: X(980), b: Y(208) })

  // --- C) Innenansicht (unten rechts) -----------------------------------------------------------
  const ib = { l: X(474), t: Y(221), r: X(984), b: Y(602) }
  const bild = bilder.innen
  if (bild) {
    const s = Math.min((ib.r - ib.l) / bild.breite, (ib.b - ib.t) / bild.hoehe)
    const bw = bild.breite * s
    const bh = bild.hoehe * s
    doc.addImage(bild.dataUrl, 'PNG', ib.l + (ib.r - ib.l - bw) / 2, ib.t + (ib.b - ib.t - bh) / 2, bw, bh, undefined, 'FAST')
  } else {
    schrift(8)
    doc.text('Skizze nicht verfügbar', (ib.l + ib.r) / 2, (ib.t + ib.b) / 2, { align: 'center' })
  }

  // --- Schriftfeld links: Bezeichnung, Maße, X-Felder ---------------------------------------------
  doc.setLineWidth(0.8)
  doc.setFillColor(255, 255, 255)
  doc.rect(X(18), Y(548), X(298) - X(18), Y(697) - Y(548), 'FD')
  doc.rect(X(298), Y(607), X(992) - X(298), Y(697) - Y(607), 'FD')
  doc.setLineWidth(0.4)
  schrift(10)
  doc.text(passend(d.bezeichnung, X(294) - X(22), 10), X(22), Y(563))
  linie(18, 567, 298, 567)
  schrift(7)
  doc.text(passend(d.filiale, X(156) - X(22), 7), X(22), Y(577))
  d.masse.forEach((f, i) => {
    const y = 589 + i * 10
    schrift(7.5)
    doc.text(`${f.label}:`, X(22), Y(y))
    doc.text(passend(f.wert, X(140) - X(70), 7.5), X(140), Y(y), { align: 'right' })
    if (f.label !== 'Fuß\\Rolle') {
      schrift(6)
      doc.text('mm', X(142), Y(y))
    }
    linie(18, y + 2, 160, y + 2)
  })
  linie(160, 567, 160, 627)
  schrift(7)
  doc.text('Liefertermin:', X(178), Y(578))
  doc.text('Auftragsdatum:', X(178), Y(604))
  schrift(8)
  doc.text(d.liefertermin, X(229), Y(591), { align: 'center' })
  doc.text(d.auftragsdatum, X(229), Y(617), { align: 'center' })
  linie(176, 593, 282, 593)
  linie(176, 619, 282, 619)
  linie(18, 627, 298, 627)
  const zeileH = (697 - 627) / 5
  for (let i = 0; i < 5; i++) {
    const y0 = 627 + i * zeileH
    if (i > 0) linie(18, y0, 298, y0)
    for (const [spalte, x0, box] of [
      [0, 22, 140],
      [1, 156, 285],
    ] as const) {
      const h = d.haken[i * 2 + spalte]
      if (!h) continue
      schrift(7.5)
      doc.text(h.label, X(x0), Y(y0 + zeileH - 4))
      if (h.an) doc.text('X', X(box + 6.5), Y(y0 + zeileH - 4), { align: 'center' })
    }
  }
  for (const px of [140, 152, 285]) linie(px, 627, px, 697)

  // --- Schriftfeld Mitte: GRIFF, Front, Korpus, Platte, RW -------------------------------------------
  for (const px of [420, 567, 775]) linie(px, 607, px, 697)
  d.ausfuehrung.forEach((f, i) => {
    const y0 = 607 + i * 18
    if (i > 0) linie(298, y0, 567, y0)
    schrift(9)
    doc.text(`${f.label}:`, X(302), Y(y0 + 13.5))
    const breite = X(564) - X(423)
    const wert = passend(f.wert, breite, 9, 7)
    if (wert === f.wert) doc.text(wert, X(493.5), Y(y0 + 13), { align: 'center' })
    else {
      // Lange Angaben (Griff mit Details) zweizeilig statt unleserlich klein.
      doc.setFontSize(6)
      const zeilen: string[] = doc.splitTextToSize(f.wert, breite)
      if (zeilen.length > 2) zeilen[1] = zeilen[1].replace(/\s*\S*$/, ' …')
      zeilen.slice(0, 2).forEach((z, j) => doc.text(z, X(493.5), Y(y0 + 8 + j * 7), { align: 'center' }))
    }
  })

  // --- Daten, Logo, Serie ---------------------------------------------------------------------------
  for (const [i, oben, unten, wert] of [
    [0, 'Auftrags-', 'erfassung', d.auftragserfassung],
    [1, 'letzte', 'Änderung', d.letzteAenderung],
  ] as const) {
    const y0 = 607 + i * 18
    schrift(4.8)
    doc.text(oben, X(569), Y(y0 + 7.5))
    doc.text(unten, X(569), Y(y0 + 14))
    schrift(9.5)
    doc.text(wert, X(689), Y(y0 + 13.5), { align: 'center' })
    linie(567, y0 + 18, 775, y0 + 18)
  }
  linie(603, 607, 603, 643)
  linie(700, 643, 700, 697)
  // Wortmarke CRAMER PLANER (wie `<BrandMark />`): CRAMER fett über PLANER leicht, gesperrt.
  const sperrung = 2
  const mittig = (text: string, y: number) =>
    doc.text(text, X(633.5) - (doc.getTextWidth(text) + sperrung * (text.length - 1)) / 2, Y(y), { charSpace: sperrung })
  schrift(13, 'bold')
  mittig(brand.wordmark.primary, 665)
  schrift(13)
  doc.setTextColor(110, 110, 115)
  mittig(brand.wordmark.secondary, 688)
  doc.setTextColor(0, 0, 0)
  schrift(10)
  doc.text('Serie:', X(706), Y(659))
  doc.text(passend(d.serie, X(772) - X(703), 11), X(737.5), Y(686), { align: 'center' })

  // --- Schriftfeld rechts: Kunde, Auftragsnummer, Möbelsoftnummer ------------------------------------
  linie(775, 643, 992, 643)
  linie(775, 670, 992, 670)
  linie(838, 643, 838, 697)
  schrift(5)
  doc.text('Kunde', X(778), Y(614))
  doc.text('Auftragsnummer', X(778), Y(659))
  doc.text('Möbelsoftnummer', X(778), Y(686))
  schrift(11)
  doc.text(passend(d.kunde || '—', X(988) - X(780), 11), X(883.5), Y(633), { align: 'center' })
  doc.text(passend(d.auftragsnummer || '— — — — —', X(988) - X(842), 13), X(915), Y(665), { align: 'center' })
  doc.text(passend(d.moebelsoftnummer, X(988) - X(842), 13), X(915), Y(692), { align: 'center' })
}

// ---------------------------------------------------------------------------
// Zeichenhilfen
// ---------------------------------------------------------------------------

/** Geschlossenes Vieleck — weiß gefüllt, damit Dahinterliegendes verdeckt wird; `null`: nur der Pfad (Beschnitt). */
function vieleck(doc: jsPDF, p: Punkt[], stil: 'FD' | null = 'FD') {
  // Text setzt in jsPDF dieselbe Füllfarbe — deshalb vor jeder Fläche neu.
  doc.setFillColor(255, 255, 255)
  doc.lines(
    p.slice(1).map((q, i) => [q[0] - p[i][0], q[1] - p[i][1]]),
    p[0][0],
    p[0][1],
    [1, 1],
    stil,
    true,
  )
}

/**
 * Maßkette wie in der Cramer-Zeichnung: durchgehende Linie, Schrägstrich und kurze Hilfslinie
 * an jeder Grenze, das Maß über der Linie (senkrecht: links davon, gedreht).
 */
function kette(doc: jsPDF, segmente: Array<[number, number, string]>, q: number, senkrecht = false) {
  if (segmente.length === 0) return
  const p = (a: number, b: number): Punkt => (senkrecht ? [b, a] : [a, b])
  const strich = (a: Punkt, b: Punkt) => doc.line(a[0], a[1], b[0], b[1])
  const enden = segmente.flatMap(([a, b]) => [a, b])
  doc.setLineWidth(0.35)
  strich(p(Math.min(...enden) - 4, q), p(Math.max(...enden) + 4, q))
  for (const e of enden) {
    strich(p(e, q - 3.5), p(e, q + 3.5))
    strich(p(e - 2, q + 2), p(e + 2, q - 2))
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  segmente.forEach(([a, b, text], i) => {
    const tw = doc.getTextWidth(text)
    if (senkrecht) doc.text(text, q - 1.8, (a + b) / 2 + tw / 2, { angle: 90 })
    // Zu schmale Abschnitte (Abschlussset): Maß außen neben die Kette.
    else if (b - a < tw + 3) doc.text(text, i === 0 ? a - 3 : b + 3, q - 1.8, { align: i === 0 ? 'right' : 'left' })
    else doc.text(text, (a + b) / 2, q - 1.8, { align: 'center' })
  })
}

/** Fronten ohne Überlappung von links nach rechts — für die Kette unter dem Grundriss. */
function frontReihe(m: Konstruktion2D): Front2D[] {
  const reihe: Front2D[] = []
  for (const f of [...m.fronten].filter((f) => f.art !== 'offen').sort((a, b) => a.x - b.x || b.h - a.h)) {
    const letzte = reihe[reihe.length - 1]
    if (!letzte || f.x >= letzte.x + letzte.b - 5) reihe.push(f)
  }
  return reihe
}

// ---------------------------------------------------------------------------
// A) Isometrie
// ---------------------------------------------------------------------------

/**
 * Schrank in Isometrie (30°): Breite nach rechts unten, Tiefe nach rechts oben. Sichtbar sind
 * Fronten, Deckflächen, die rechte Seite und in offenen Fächern das Innenleben. Die Zeichnung
 * steht mittig und so groß wie möglich, ohne das Schriftfeld links unten zu berühren.
 */
function isometrie(doc: jsPDF, d: LookbookDaten, m: Konstruktion2D, box: Feld4, block: Punkt) {
  const { breiteMm: B, tiefeMm: T, hoeheMm: Hm } = m
  const tan = S30 / C30

  const breit = (B + T) * C30
  const hoch = (B + T) * S30 + Hm
  /** Passt der Schrank mit Maßstab k, linker Kante L und Oberkante t, ohne das Schriftfeld zu berühren? */
  const frei = (k: number, L: number, t: number) => {
    if (L < box.l - 0.01 || L + breit * k > box.r + 0.01 || t + hoch * k > box.b) return false
    // Die Unterkante fällt nach rechts — gegen das Schriftfeld links unten.
    const xu = Math.min(block[0], L + B * C30 * k)
    return xu <= L || t + (xu - L) * tan + (T * S30 + Hm) * k <= block[1]
  }
  /** Größter Wert in [lo, hi], für den `ok` noch gilt (ok fällt von wahr auf falsch). */
  const suche = (lo: number, hi: number, ok: (v: number) => boolean) => {
    for (let i = 0; i < 30; i++) {
      const v = (lo + hi) / 2
      if (ok(v)) lo = v
      else hi = v
    }
    return lo
  }
  // Immer waagerecht mittig mit dem größten Maßstab …
  const mitte = (k: number) => box.l + (box.r - box.l - breit * k) / 2
  const k = suche(0, Math.min((box.r - box.l) / breit, (box.b - box.t) / hoch), (v) => frei(v, mitte(v), box.t))
  // … und senkrecht mittig im Spielraum, der dann noch frei ist.
  const L = mitte(k)
  const oben = (box.t + suche(box.t, box.b, (t) => frei(k, L, t))) / 2
  const P = (x: number, z: number, t = 0): Punkt => [L + (x + t) * C30 * k, oben + ((x - t) * S30 + T * S30 + Hm - z) * k]

  doc.setFillColor(255, 255, 255)
  doc.setLineWidth(0.5)
  const teile: Punkt[] = [
    ...(m.abschluss.links ? [[0, m.abschluss.links] as Punkt] : []),
    ...m.korpusse.map((korpus): Punkt => [korpus.x, korpus.x + korpus.b]),
    ...(m.abschluss.rechts ? [[B - m.abschluss.rechts, B] as Punkt] : []),
  ]
  for (const [a, b] of teile) {
    vieleck(doc, [P(a, 0), P(b, 0), P(b, Hm), P(a, Hm)])
    vieleck(doc, [P(a, Hm), P(b, Hm), P(b, Hm, T), P(a, Hm, T)])
  }
  const re = teile[teile.length - 1]?.[1] ?? B
  vieleck(doc, [P(re, 0), P(re, 0, T), P(re, Hm, T), P(re, Hm)])

  // Innenleben jedes Korpus — zu sehen überall, wo keine Front davor sitzt (offene Fächer).
  for (const korpus of m.korpusse) innenleben(doc, m, korpus, P)

  // Fronten (vordere Schiebetür-Ebene zuletzt) mit Griffen
  const fronten = [...m.fronten].filter((f) => f.art !== 'offen').sort((a, b) => (a.ebene ?? 0) - (b.ebene ?? 0))
  const materialVon = (f: Front2D) => (f.elementId ? d.frontMaterial[f.elementId] ?? '' : '')
  // Beschriftet wird nur, wenn die Fronten verschiedene Materialien/Oberflächen haben.
  const beschriften = new Set(fronten.map(materialVon)).size > 1
  for (const f of fronten) {
    doc.setLineWidth(0.5)
    vieleck(doc, [P(f.x, f.y), P(f.x + f.b, f.y), P(f.x + f.b, f.y + f.h), P(f.x, f.y + f.h)])
    const g = griffStrecke(f)
    if (g) {
      doc.setLineWidth(1.1)
      const [a, b] = [P(g[0], g[1]), P(g[2], g[3])]
      doc.line(a[0], a[1], b[0], b[1])
    }
    const material = materialVon(f)
    if (!beschriften || !material) continue
    // Hohe Fronten senkrecht, flache (Schübe, Klappen) entlang der Unterkante (−30°).
    const senkrecht = f.h >= f.b
    const platz = (senkrecht ? f.h : f.b) * k * 0.8
    doc.setFontSize(6.5)
    let text = `-- ${material} --`
    if (doc.getTextWidth(text) > platz) text = doc.splitTextToSize(material, platz)[0] ?? ''
    const tw = doc.getTextWidth(text)
    const [cx, cy] = P(f.x + f.b / 2, f.y + f.h / 2)
    if (senkrecht) doc.text(text, cx + 2.3, cy + tw / 2, { angle: 90 })
    else if (f.h * k > 8) doc.text(text, cx - (tw / 2) * C30 - 1.1, cy - (tw / 2) * S30 + 2, { angle: -30 })
  }
}

/**
 * Blick in einen Korpus: linke Innenseite, Boden, Rückwand und die Ausstattung von unten
 * nach oben (weiß gefüllt, so verdeckt Höheres das Dahinterliegende). Beschnitten auf die
 * Öffnung — die Fronten werden danach darübergezeichnet, sichtbar bleibt also nur, was offen ist.
 */
function innenleben(doc: jsPDF, m: Konstruktion2D, korpus: Konstruktion2D['korpusse'][number], P: (x: number, z: number, t?: number) => Punkt) {
  const a = korpus.x + K.seiteMm
  const b = korpus.x + korpus.b - K.seiteMm
  const zu = m.innenBodenMm
  const zo = m.innenObenMm
  const T = m.tiefeMm - K.rueckwandMm
  if (b <= a || zo <= zu) return
  doc.saveGraphicsState()
  vieleck(doc, [P(a, zu), P(b, zu), P(b, zo), P(a, zo)], null)
  doc.clip()
  doc.discardPath()
  doc.setLineWidth(0.35)
  vieleck(doc, [P(a, zu, T), P(b, zu, T), P(b, zo, T), P(a, zo, T)])
  vieleck(doc, [P(a, zu), P(a, zu, T), P(a, zo, T), P(a, zo)])
  vieleck(doc, [P(a, zu), P(b, zu), P(b, zu, T), P(a, zu, T)])

  const kiste = (x0: number, x1: number, z0: number, z1: number, t0: number, t1: number) => {
    vieleck(doc, [P(x0, z0, t0), P(x1, z0, t0), P(x1, z1, t0), P(x0, z1, t0)])
    vieleck(doc, [P(x0, z1, t0), P(x1, z1, t0), P(x1, z1, t1), P(x0, z1, t1)])
  }
  for (const e of m.ausstattung.filter((e) => e.korpus === korpus.index).sort((p, q) => p.y - q.y)) {
    const x0 = Math.max(a, e.x)
    const x1 = Math.min(b, e.x + e.b)
    if (e.art === 'boden' || e.art === 'glasboden' || e.art === 'trennboden') {
      kiste(x0, x1, e.y, e.y + (e.h || K.einlegebodenMm), 0, T)
    } else if (e.art === 'kleiderstange' || e.art === 'led-deckel') {
      doc.setLineWidth(e.art === 'kleiderstange' ? 1.1 : 0.35)
      const t = e.art === 'kleiderstange' ? T / 2 : 30
      const [p, q] = [P(x0, e.y, t), P(x1, e.y, t)]
      doc.line(p[0], p[1], q[0], q[1])
      doc.setLineWidth(0.35)
    } else if (e.h > 0 && e.art !== 'aussenschub' && e.art !== 'led-seite' && e.art !== 'hinweis') {
      // Container, Schubladen, Körbe, Auszüge: Kasten vorne (wie in der Draufsicht) mit Auszugsfugen.
      kiste(x0, x1, e.y, e.y + e.h, 10, Math.min(10 + (e.t ?? K.containerTiefeMm), T))
      let z = e.y
      for (const hoehe of (e.teilungen ?? []).slice(0, -1)) {
        z += hoehe
        const [p, q] = [P(x0, z, 10), P(x1, z, 10)]
        doc.line(p[0], p[1], q[0], q[1])
      }
    }
  }
  doc.restoreGraphicsState()
  doc.setLineWidth(0.5)
}

/** Griff als Strecke [x1, z1, x2, z2] auf der Frontebene — Lage wie in `bauteile/Griffe.tsx`. */
function griffStrecke(f: Front2D): [number, number, number, number] | null {
  const g = f.griff
  if (!g || g.art === 'pto' || g.art === 'sonder') return null
  const laenge = 'laengeMm' in g && g.laengeMm ? g.laengeMm : g.art === 'muschel' ? 105 : g.art === 'knopf' ? 30 : f.h
  if (f.art === 'schublade' || f.art === 'klappe') {
    const z = f.y + f.h - K.griffSchubVonObenMm
    const cx = f.x + f.b / 2
    return [cx - laenge / 2, z, cx + laenge / 2, z]
  }
  const rechts = f.anschlag !== 'rechts'
  const x = rechts ? f.x + f.b - K.griffKantenabstandMm : f.x + K.griffKantenabstandMm
  if (laenge >= f.h) return [x, f.y, x, f.y + f.h]
  const cz = f.griffY ?? f.y + f.h / 2
  return [x, cz - laenge / 2, x, cz + laenge / 2]
}

// ---------------------------------------------------------------------------
// B) Grundriss
// ---------------------------------------------------------------------------

/**
 * Draufsicht wie in der Vorlage: Korpi mit Einteilung, Fronten davor; oben Gesamtmaß und
 * Korpusbreiten, unten die Frontbreiten, links Korpustiefe und Tiefe mit Front.
 */
function grundriss(doc: jsPDF, m: Konstruktion2D, box: Feld4) {
  const B = m.breiteMm
  const T = m.tiefeMm
  const F = m.schiebetueren > 0 ? K.schiebeEbeneMm + K.frontMm : K.frontMm
  const ab = 12
  const links = box.l + 2 * ab + 6
  const k = Math.min((box.r - links) / B, (box.b - box.t - 3 * ab) / (T + F))
  const x0 = links + (box.r - links - B * k) / 2
  const y0 = box.t + 2 * ab
  const X = (mm: number) => x0 + mm * k

  doc.setFillColor(255, 255, 255)
  doc.setLineWidth(0.5)
  const teile: Punkt[] = [
    ...(m.abschluss.links ? [[0, m.abschluss.links] as Punkt] : []),
    ...m.korpusse.map((korpus): Punkt => [korpus.x, korpus.x + korpus.b]),
    ...(m.abschluss.rechts ? [[B - m.abschluss.rechts, B] as Punkt] : []),
  ]
  for (const [a, b] of teile) doc.rect(X(a), y0, (b - a) * k, T * k, 'FD')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  for (const korpus of m.korpusse) doc.text(`${String(korpus.nennCm).replace('.', ',')}er`, X(korpus.x) + 3, y0 + 9)
  doc.setFillColor(255, 255, 255)
  for (const f of m.fronten.filter((f) => f.art !== 'offen')) {
    doc.rect(X(f.x), y0 + (T + (f.ebene === 1 ? K.schiebeEbeneMm : 0)) * k, f.b * k, K.frontMm * k, 'FD')
  }

  // Oben: Gesamtmaß, darunter die Korpuseinteilung (Fugen zur Mitte zusammengefasst)
  kette(doc, [[X(0), X(B), mmText(B)]], y0 - 2 * ab + 2)
  const grenzen: number[] = []
  for (const p of [0, ...m.korpusse.flatMap((korpus) => [korpus.x, korpus.x + korpus.b]), B].sort((a, b) => a - b)) {
    const letzte = grenzen[grenzen.length - 1]
    if (letzte == null || p - letzte >= 5) grenzen.push(p)
    else if (p === B) grenzen[grenzen.length - 1] = B
    else if (letzte !== 0) grenzen[grenzen.length - 1] = (letzte + p) / 2
  }
  kette(doc, grenzen.slice(1).map((g, i): [number, number, string] => [X(grenzen[i]), X(g), mmText(g - grenzen[i])]), y0 - ab + 2)

  // Unten: Frontbreiten — links: Korpustiefe und Tiefe mit Front
  kette(doc, frontReihe(m).map((f): [number, number, string] => [X(f.x), X(f.x + f.b), mmText(f.b)]), y0 + (T + F) * k + ab - 2)
  kette(doc, [[y0, y0 + T * k, mmText(T)]], x0 - ab + 4, true)
  kette(doc, [[y0, y0 + (T + F) * k, mmText(T + F)]], x0 - 2 * ab + 4, true)
}
