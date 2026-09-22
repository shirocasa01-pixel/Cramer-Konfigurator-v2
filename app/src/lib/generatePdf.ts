import { jsPDF } from 'jspdf'
import type { Draft } from '../types'
import { brand } from '../config/brand'
import { getProductGroup, getSeries } from '../config/productCatalog'
import { getVisibleKorpusAreas } from '../config/korpus'
import { getFrontType, getStyleLine } from '../config/frontCatalog'
import { PRICE_GROUP_LABEL, describeMaterialSelection } from './materialFormat'
import {
  ABSCHLUSS_UNTEN_LABEL,
  describeFrontExtras,
  describeFrontField,
  describeHandleConfig,
  describeOben,
} from './frontsFormat'
import { isFrontFieldVisible } from './frontsHelpers'
import { describeAusstattungAuswahl, describeColumnEquipment } from './ausstattungFormat'
import { formatVkPreis } from './pricing'
import { caPrefix, formatDimensions } from './massFormat'
import { aussenmassOptionen, describeKorpusGrunddatenZeilen } from './korpusMass'
import { felderFuer, getAbschnitt } from './schemaStore'
import { anzeigeWert, zeigeFeld } from './schemaWerte'

/**
 * Erzeugt das kompakte AV-Übergabe-PDF (Seite 1: Daten, Seite 2: gescannte Skizze).
 * Alle Spalten-/Segment-Daten aus Phase 4.5 & 5 inkl. Preisgruppen-Metadaten; der
 * verbindliche Preis ist der manuell erfasste VK-Preis (Phase A).
 */
export function buildPdf(draft: Draft): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 40
  const contentW = pageW - margin * 2
  let y = margin

  const ensure = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage()
      y = margin
    }
  }
  const font = (size: number, style: 'normal' | 'bold' = 'normal') => {
    doc.setFontSize(size)
    doc.setFont('helvetica', style)
  }

  function section(text: string) {
    y += 8
    ensure(22)
    font(11, 'bold')
    doc.setFillColor(238, 238, 235)
    doc.rect(margin, y - 11, contentW, 17, 'F')
    doc.setTextColor(20, 22, 26)
    doc.text(text, margin + 6, y + 1)
    y += 18
  }
  function kv(key: string, value: string) {
    font(9, 'normal')
    const lines = doc.splitTextToSize(value || '—', contentW - 170)
    const blockH = Math.max(13, lines.length * 12)
    ensure(blockH)
    doc.setTextColor(110, 110, 115)
    doc.text(key, margin + 6, y)
    doc.setTextColor(20, 22, 26)
    doc.text(lines, margin + 164, y)
    y += blockH
  }
  function bullet(text: string, indent = 20) {
    font(9, 'normal')
    doc.setTextColor(40, 40, 44)
    const lines = doc.splitTextToSize(`• ${text}`, contentW - indent - 6)
    ensure(lines.length * 12)
    doc.text(lines, margin + indent, y)
    y += lines.length * 12
  }
  // Betrags-Zeile mit rechtsbündigem Preis (Preis-Zusammenfassung).
  function priceRow(label: string, amount: string, opts: { bold?: boolean; rule?: boolean } = {}) {
    const bold = opts.bold ?? false
    font(bold ? 11 : 9, bold ? 'bold' : 'normal')
    ensure(bold ? 18 : 14)
    if (opts.rule) {
      doc.setDrawColor(bold ? 20 : 225, bold ? 22 : 225, bold ? 26 : 222)
      doc.setLineWidth(bold ? 1 : 0.5)
      doc.line(margin + 6, y - 8, margin + contentW, y - 8)
    }
    doc.setTextColor(bold ? 20 : 110, bold ? 22 : 110, bold ? 26 : 115)
    doc.text(label, margin + 6, y)
    doc.setTextColor(20, 22, 26)
    doc.text(amount, margin + contentW, y, { align: 'right' })
    y += bold ? 18 : 14
  }


  const group = getProductGroup(draft.productGroupId)
  const series = getSeries(draft.productGroupId, draft.seriesId)
  const dim = draft.dimensions

  // --- Kopf ---
  font(16, 'bold')
  doc.setTextColor(20, 22, 26)
  doc.text(`${brand.productName} · AV-Übergabe`, margin, y)
  y += 18
  font(9, 'normal')
  doc.setTextColor(120, 120, 125)
  doc.text(`Entwurfsnummer ${draft.id}`, margin, y)
  y += 6
  doc.setTextColor(20, 22, 26)

  /*
   * AUFTRAGSKOPF — aus dem Konfigurator-Schema, nicht mehr Zeile für Zeile programmiert.
   *
   * Gedruckt wird, was der Administrator im Schema für das PDF freigegeben hat, in seiner
   * Sortierung. Ein neues Feld erscheint damit hier, ohne dass diese Datei angefasst wird.
   */
  const kopfAbschnitt = getAbschnitt('auftragskopf')
  section(kopfAbschnitt?.titel && kopfAbschnitt.id !== 'auftragskopf' ? kopfAbschnitt.titel : 'Auftrag')
  for (const feld of felderFuer('auftragskopf', 'pdf', { serieId: draft.seriesId })) {
    if (!zeigeFeld(draft, feld, { lang: true })) continue
    kv(feld.label, anzeigeWert(draft, feld, { lang: true }) || '—')
  }

  section('Produkt & Maße')
  kv('Produktgruppe', group?.name ?? '—')
  kv('Serie', series?.name ?? '—')
  kv('Maße (B×H×T)', formatDimensions(dim))
  kv('Segmente', String(draft.fronts?.columns.length ?? 0))

  if (draft.korpusGrunddaten) {
    section('Korpus-Grunddaten')
    describeKorpusGrunddatenZeilen(draft.korpusGrunddaten, aussenmassOptionen(draft)).forEach((z) => kv(z.label, z.value))
  }

  section('Material')
  if (series) {
    for (const area of getVisibleKorpusAreas(series, draft.korpusMode)) {
      const selection = draft.korpus?.[area.id]
      const pg = selection?.priceGroup ? ` [${PRICE_GROUP_LABEL[selection.priceGroup]}]` : ''
      kv(area.label, describeMaterialSelection(selection, area.noneLabel) + pg)
    }
  }
  if (draft.sichtRueckwandAussen) {
    const sel = draft.korpus?.rueckwandAussen
    const pg = sel?.priceGroup ? ` [${PRICE_GROUP_LABEL[sel.priceGroup]}]` : ''
    kv('d. Rückwand Außen (Sicht)', describeMaterialSelection(sel) + pg)
  }
  if (draft.raumteiler) kv('Raumteiler', 'ja — Möbel steht frei im Raum')

  // --- Korpus Innen (Phase B): Rückwand innen / Lochreihe / Einlegeböden / Kleiderstange ---
  const ki = draft.korpusInnen
  if (ki && (ki.rueckwand.enabled || ki.lochreihe.enabled || ki.einlegeboeden.enabled)) {
    section('Korpus Innen')
    if (ki.rueckwand.enabled) {
      const sel = ki.rueckwand.material
      const pg = sel?.priceGroup ? ` [${PRICE_GROUP_LABEL[sel.priceGroup]}]` : ''
      kv('Rückwand Innen', describeMaterialSelection(sel) + pg)
    }
    if (ki.lochreihe.enabled) kv('Lochreihe', ki.lochreihe.note?.trim() || 'ja')
    if (ki.einlegeboeden.enabled) kv('Einlegeböden', `${ki.einlegeboeden.anzahl?.trim() || '—'} Stück`)
    if (ki.einlegeboeden.enabled && ki.einlegeboeden.kleiderstange.enabled) {
      kv('Kleiderstange', ki.einlegeboeden.kleiderstange.note?.trim() || 'ja')
    }
  }

  // --- Schritt 6: Ausstattung-Vorauswahl (kategorisiert) ---
  const ausstattungGroups = describeAusstattungAuswahl(draft.ausstattung?.selected)
  if (ausstattungGroups.length > 0) {
    section('Ausstattung-Vorauswahl')
    ausstattungGroups.forEach((g) => kv(g.category, g.labels.join(', ')))
  }

  section('Fronten')
  if (draft.fronts?.schiebetuerAnzahl) {
    kv('Anzahl Schiebetüren', `${draft.fronts.schiebetuerAnzahl} Stück (ganzer Schrank)`)
  }
  draft.fronts?.columns.forEach((column, index) => {
    font(10, 'bold')
    ensure(14)
    doc.setTextColor(20, 22, 26)
    doc.text(`Front-Typ ${index + 1}`, margin + 6, y)
    y += 13
    column.elements.forEach((element) => {
      const type = getFrontType(element.typeId)
      const styleLine = getStyleLine(element.typeId, element.styleLineId)
      font(9, 'bold')
      ensure(13)
      doc.setTextColor(20, 22, 26)
      doc.text(
        `${type?.label ?? element.typeId} · ${element.label}${styleLine ? ' · ' + styleLine.label : ''}`,
        margin + 12,
        y,
      )
      y += 12
      const meta: string[] = []
      if (element.widthCm || element.heightCm) {
        meta.push(`Maße ${caPrefix()}${element.widthCm ?? '?'}×${element.heightCm ?? '?'} cm`)
      }
      const extras = describeFrontExtras(element)
      if (extras) meta.push(extras)
      if (meta.length) bullet(meta.join(' · '))
      if (styleLine) {
        styleLine.fields
          .filter((field) => isFrontFieldVisible(field, element))
          .forEach((field) => {
            const line = describeFrontField(field, element.fieldValues?.[field.id])
            if (line) bullet(line)
          })
      }
      const handleLine = describeHandleConfig(element)
      if (handleLine) bullet(handleLine)
      y += 3
    })
    // Schritt 8: Ausstattung hinter der Front (je Segment)
    const equip = describeColumnEquipment(column)
    if (equip.length) {
      font(9, 'bold')
      ensure(12)
      doc.setTextColor(20, 22, 26)
      doc.text('Ausstattung hinter Front', margin + 12, y)
      y += 12
      equip.forEach((line) => bullet(line))
      y += 3
    }
  })

  section('Abschlüsse')
  kv('Grifffarbe', draft.fronts?.grifffarbe?.trim() || '—')
  kv('Abschluss oben', describeOben(draft.fronts?.abschlussOben))
  const unten = draft.fronts?.abschlussUnten
  kv(
    'Abschluss unten',
    unten ? ABSCHLUSS_UNTEN_LABEL[unten.type] + (unten.footNote ? ` (${unten.footNote})` : '') : '—',
  )

  if (draft.fronts?.sonderausstattung?.trim()) {
    section('Sonderausstattung')
    font(9, 'normal')
    doc.setTextColor(20, 22, 26)
    const lines = doc.splitTextToSize(draft.fronts.sonderausstattung.trim(), contentW - 12)
    ensure(lines.length * 12)
    doc.text(lines, margin + 6, y)
    y += lines.length * 12
  }

  // --- Verkaufspreis (Phase A: manuell kalkuliert, verbindlicher Endpreis) ---
  section('Verkaufspreis')
  priceRow('Verkaufspreis (VK, inkl. 19% MwSt.)', formatVkPreis(draft.vkPreis), { bold: true, rule: true })

  // --- Seite 2: gescannte Handzeichnung ---
  if (draft.scanImage) {
    doc.addPage()
    y = margin
    font(12, 'bold')
    doc.setTextColor(20, 22, 26)
    doc.text('Handzeichnung (Scan)', margin, y)
    y += 18
    try {
      const props = doc.getImageProperties(draft.scanImage)
      const maxW = contentW
      const maxH = pageH - margin - y
      const scale = Math.min(maxW / props.width, maxH / props.height)
      doc.addImage(draft.scanImage, 'JPEG', margin, y, props.width * scale, props.height * scale)
    } catch {
      font(9, 'normal')
      doc.text('Scan konnte nicht eingebettet werden.', margin, y)
    }
  }

  return doc
}

/** Lädt das PDF lokal herunter. */
export function downloadPdf(draft: Draft): void {
  buildPdf(draft).save(`${draft.id}.pdf`)
}
