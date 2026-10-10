import type { jsPDF } from 'jspdf'
import { brand } from '../config/brand'
import type { Feld, LookbookDaten } from './lookbookDaten'

/**
 * SEITE 1 DES AV-PDFs IM LOOKBOOK-STIL (A4 quer).
 *
 *   ┌ Titel · Nummer ───────────────────────────── CRAMER PLANER ┐
 *   │ Kunde │ Auftragsnummer │ Berater │ Datum │ Filiale │ Serie  │
 *   ├ Vorderansicht ──── Innenansicht ──── Draufsicht ───────────┤
 *   │   (Skizzen mit Maßketten in mm)                            │
 *   ├ Schriftfeld wie in der Cramer-AV-Zeichnung ────────────────┤
 *   │ Abmessungen · Ausführung │ X-Checkliste │ Material │ Sonder │
 *   └────────────────────────────────────────────────────────────┘
 *
 * Die Skizzen kommen als Bild (`components/konstruktion/skizzenBild.tsx`); ohne sie — etwa
 * in einer Prüfung ohne Browser — steht an ihrer Stelle ein Hinweis.
 */

export interface LookbookBild {
  dataUrl: string
  breite: number
  hoehe: number
}

export interface LookbookBilder {
  vorne?: LookbookBild
  innen?: LookbookBild
  oben?: LookbookBild
}

const TINTE: [number, number, number] = [20, 22, 26]
const GRAU: [number, number, number] = [120, 120, 125]
const LINIE: [number, number, number] = [205, 203, 198]

export function zeichneLookbookSeite(doc: jsPDF, d: LookbookDaten, bilder: LookbookBilder = {}): void {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const rand = 28
  const breite = W - 2 * rand
  const schrift = (groesse: number, stil: 'normal' | 'bold' = 'normal', farbe = TINTE) => {
    doc.setFont('helvetica', stil)
    doc.setFontSize(groesse)
    doc.setTextColor(...farbe)
  }

  // --- Titel ------------------------------------------------------------------------------
  let y = rand + 14
  schrift(17, 'bold')
  doc.text(d.titel, rand, y)
  schrift(9, 'normal', GRAU)
  doc.text(`${d.nummer}   ·   ${d.untertitel}`, rand, y + 14)
  schrift(11, 'bold')
  doc.text(brand.productName, W - rand, y, { align: 'right' })
  schrift(8, 'normal', GRAU)
  doc.text('AV-Übergabe · Konstruktionszeichnung', W - rand, y + 12, { align: 'right' })

  // --- Kopfdaten ----------------------------------------------------------------------------
  y += 26
  doc.setDrawColor(...TINTE)
  doc.setLineWidth(0.8)
  doc.line(rand, y, W - rand, y)
  const zelle = breite / d.kopf.length
  d.kopf.forEach((f, i) => {
    const x = rand + i * zelle
    schrift(6.5, 'normal', GRAU)
    doc.text(f.label.toUpperCase(), x, y + 11)
    schrift(9, 'bold')
    doc.text(doc.splitTextToSize(f.wert, zelle - 8)[0] ?? '—', x, y + 23)
  })
  y += 31
  doc.setDrawColor(...LINIE)
  doc.setLineWidth(0.5)
  doc.line(rand, y, W - rand, y)

  // --- Skizzen ------------------------------------------------------------------------------
  const schriftfeldH = 128
  const skizzeOben = y + 8
  const skizzeUnten = H - rand - schriftfeldH - 10
  const felder: Array<[keyof LookbookBilder, string, number]> = [
    ['vorne', 'Vorderansicht', 0.36],
    ['innen', 'Innenansicht', 0.36],
    ['oben', 'Draufsicht (Grundriss)', 0.28],
  ]
  let x = rand
  for (const [schluessel, titel, anteil] of felder) {
    const fb = breite * anteil
    schrift(7, 'bold', GRAU)
    doc.text(titel.toUpperCase(), x + 2, skizzeOben + 7)
    const bild = bilder[schluessel]
    const platzB = fb - 10
    const platzH = skizzeUnten - skizzeOben - 14
    if (bild) {
      const s = Math.min(platzB / bild.breite, platzH / bild.hoehe)
      const bw = bild.breite * s
      const bh = bild.hoehe * s
      // Draufsicht oben bündig, die Ansichten von vorne unten bündig (gemeinsame Fußbodenlinie).
      const by = schluessel === 'oben' ? skizzeOben + 12 : skizzeUnten - bh
      doc.addImage(bild.dataUrl, 'PNG', x + (fb - bw) / 2, by, bw, bh, undefined, 'FAST')
    } else {
      schrift(8, 'normal', GRAU)
      doc.text('Skizze nicht verfügbar', x + fb / 2, (skizzeOben + skizzeUnten) / 2, { align: 'center' })
    }
    x += fb
  }

  // --- Schriftfeld ---------------------------------------------------------------------------
  const sy = H - rand - schriftfeldH
  doc.setDrawColor(...TINTE)
  doc.setLineWidth(0.8)
  doc.rect(rand, sy, breite, schriftfeldH)
  const spalten = [0.27, 0.21, 0.28, 0.24]
  const xs: number[] = []
  let sx = rand
  for (const anteil of spalten) {
    xs.push(sx)
    sx += breite * anteil
  }
  doc.setLineWidth(0.5)
  for (const x0 of xs.slice(1)) doc.line(x0, sy, x0, sy + schriftfeldH)

  const kopfzeile = (x0: number, text: string) => {
    schrift(7, 'bold', GRAU)
    doc.text(text.toUpperCase(), x0 + 6, sy + 11)
  }

  // Spalte 1: Bezeichnung, Abmessungen, Ausführung (wie „Refugium 21Raster in …", Höhe/Breite/Tiefe)
  const s1 = xs[0]
  const b1 = breite * spalten[0] - 12
  schrift(9.5, 'bold')
  doc.text(doc.splitTextToSize(d.untertitel, b1)[0] ?? '', s1 + 6, sy + 14)
  schrift(7.5, 'normal', GRAU)
  doc.text(doc.splitTextToSize(d.kopf.find((f) => f.label === 'Kunde')?.wert ?? '', b1)[0] ?? '', s1 + 6, sy + 24)
  let zy = sy + 38
  for (const f of d.masse) {
    schrift(8, 'normal', GRAU)
    doc.text(`${f.label}:`, s1 + 6, zy)
    schrift(8.5, 'bold')
    doc.text(f.wert, s1 + 6 + b1, zy, { align: 'right' })
    zy += 11
  }
  schrift(7, 'bold', GRAU)
  doc.text('AUSFÜHRUNG', s1 + 6, zy + 4)
  schrift(7.5, 'normal')
  doc.text(doc.splitTextToSize(d.ausfuehrung, b1).slice(0, 4), s1 + 6, zy + 14)

  // Spalte 2: X-Checkliste
  const s2 = xs[1]
  kopfzeile(s2, 'Checkliste')
  zy = sy + 23
  for (const gruppe of d.checkliste) {
    for (const h of gruppe.haken) {
      if (zy > sy + schriftfeldH - 6) break
      kaestchen(doc, s2 + 6, zy - 6, h.an)
      schrift(7.5, h.an ? 'bold' : 'normal', h.an ? TINTE : GRAU)
      doc.text(h.label, s2 + 17, zy)
      zy += 9.5
    }
    zy += 2
  }

  // Spalte 3: Ausführung & Material — Spalte 4: Sonder-Ausstattung
  feldliste(doc, xs[2], sy, breite * spalten[2], 'Ausführung & Material', d.material, schriftfeldH)
  feldliste(doc, xs[3], sy, breite * spalten[3], 'Sonder-Ausstattung', d.sonder, schriftfeldH)

  schrift(6.5, 'normal', GRAU)
  doc.text(`Maßstäbliche Skizze, Maße in mm · erstellt mit ${brand.productName} · maßgeblich sind Außenmaß und AV-Freigabe`, rand, H - rand + 12)
}

/** Kästchen der Checkliste — angekreuzt mit „X" wie im Cramer-Schriftfeld. */
function kaestchen(doc: jsPDF, x: number, y: number, an: boolean) {
  doc.setDrawColor(...TINTE)
  doc.setLineWidth(0.5)
  doc.rect(x, y, 7, 7)
  if (an) {
    doc.setLineWidth(0.9)
    doc.line(x + 1.3, y + 1.3, x + 5.7, y + 5.7)
    doc.line(x + 5.7, y + 1.3, x + 1.3, y + 5.7)
  }
}

/** Beschriftete Liste mit Umbruch, abgeschnitten an der Unterkante des Schriftfelds. */
function feldliste(doc: jsPDF, x: number, sy: number, spaltenB: number, titel: string, felder: Feld[], hoehe: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...GRAU)
  doc.text(titel.toUpperCase(), x + 6, sy + 11)
  const labelB = 66
  let y = sy + 23
  for (const f of felder) {
    if (y > sy + hoehe - 6) break
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    // Höchstens zwei Zeilen je Angabe — die vollständige Beschreibung steht ab Seite 2.
    const zeilen: string[] = doc.splitTextToSize(f.wert || '—', spaltenB - labelB - 12).slice(0, 2)
    doc.setTextColor(...GRAU)
    doc.text(`${f.label}:`, x + 6, y)
    doc.setTextColor(...TINTE)
    doc.text(zeilen, x + 6 + labelB, y)
    y += zeilen.length * 9 + 2
  }
}
