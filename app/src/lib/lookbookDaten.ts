import type { Draft, FrontElement } from '../types'
import { getBranch } from '../config/branches'
import { getEquipmentOption } from '../config/equipment'
import { getStyleLine } from '../config/frontCatalog'
import { getVisibleKorpusAreas } from '../config/korpus'
import { getProductGroup, getSeries } from '../config/productCatalog'
import { describeHandleConfig } from './frontsFormat'
import { ZWEILAEUFIG_TYPE_ID, allElements } from './frontsHelpers'
import { konstruktion, mmText } from './konstruktion'
import { computeKorpusMasse, formatLfm, verblendungLfm, verblendungSeitenText } from './korpusMass'
import { describeMaterialSelection } from './materialFormat'

/**
 * DATEN DER LOOKBOOK-SEITE — Seite 1 des AV-PDFs, angelehnt an das Schriftfeld der
 * Cramer-AV-Zeichnung (Lookbook Refugium): Titel, Kopfdaten, Abmessungen, Ausführung,
 * X-Checkliste, Ausführung & Material, Sonder-Ausstattung.
 *
 * Reine Daten, kein jsPDF — das Zeichnen übernimmt `pdfLookbook.ts`. Alles kommt aus dem
 * Entwurf und den Stammdaten; nichts wird hier neu festgelegt.
 */

export interface Feld {
  label: string
  wert: string
}

export interface Haken {
  label: string
  an: boolean
}

export interface LookbookDaten {
  /** „KLEIDERSCHRANK REFUGIUM" */
  titel: string
  /** „Refugium 18 Raster · 3 Korpi" — wie die Kopfzeile des Cramer-Schriftfelds. */
  untertitel: string
  /** „#2026-TEST-01" — Auftragsnummer, sonst Entwurfsnummer. */
  nummer: string
  kopf: Feld[]
  masse: Feld[]
  /** „3 Schübe, 4 Drehtüren, 5 Böden mit Kleiderstange …" — wie „Ausführung:" im Lookbook. */
  ausfuehrung: string
  checkliste: Array<{ gruppe: string; haken: Haken[] }>
  material: Feld[]
  sonder: Feld[]
}

function datumHeute(): string {
  return new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** „2 Drehtüren", „1 Schub" — Einzahl/Mehrzahl ohne Rechenfehler bei 0. */
function anzahl(n: number, eins: string, mehr: string): string {
  return `${n} ${n === 1 ? eins : mehr}`
}

function eindeutig(werte: string[]): string[] {
  return [...new Set(werte.map((w) => w.trim()).filter(Boolean))]
}

/** Front-Ausführung als Klartext: „Glatt · Mattlack RAL 9016". */
function frontText(el: FrontElement): string {
  const linie = getStyleLine(el.typeId, el.styleLineId)?.label
  const material = el.fieldValues?.material?.material
  return [linie, material ? describeMaterialSelection(material) : ''].filter(Boolean).join(' · ')
}

export function lookbookDaten(draft: Draft): LookbookDaten {
  const group = getProductGroup(draft.productGroupId)
  const series = getSeries(draft.productGroupId, draft.seriesId)
  const g = draft.korpusGrunddaten
  const m = konstruktion(draft)
  const masse = computeKorpusMasse(draft)
  const elemente = allElements(draft.fronts)

  // --- Titel & Kopf ---------------------------------------------------------------------
  const hoeheText = g?.heightMode === '18R' ? '18 Raster' : g?.heightMode === '21R' ? '21 Raster' : g ? 'Sonderhöhe' : ''
  // Wie im Lookbook in der Einzahl: „KLEIDERSCHRANK REFUGIUM".
  const gruppe = group?.id === 'kleiderschraenke' ? 'Kleiderschrank' : group?.name ?? 'Möbel'
  const titel = `${gruppe} ${series?.name ?? ''}`.trim().toUpperCase()
  const untertitel = [series?.name, hoeheText, m ? anzahl(m.korpusse.length, 'Korpus', 'Korpi') : ''].filter(Boolean).join(' · ')
  const kopf: Feld[] = [
    { label: 'Kunde', wert: draft.customerName?.trim() || '—' },
    { label: 'Auftragsnummer', wert: draft.orderNumber?.trim() || '—' },
    { label: 'Berater', wert: draft.consultant?.name || '—' },
    { label: 'Datum', wert: datumHeute() },
    { label: 'Filiale', wert: getBranch(draft.branchId)?.name ?? '—' },
    { label: 'Serie / Modell', wert: [group?.name, series?.name].filter(Boolean).join(' · ') || '—' },
  ]

  // --- Abmessungen (Außenmaß wie in Zusammenfassung und AV-PDF) ----------------------------
  const mm = (cm: number | undefined) => (cm != null ? `${mmText(Math.round(cm * 10))} mm` : '—')
  const masseFelder: Feld[] = [
    { label: 'Höhe', wert: mm(masse.gesamthoeheCm) },
    { label: 'Breite', wert: mm(masse.gesamtbreiteCm) },
    { label: 'Tiefe', wert: mm(masse.korpustiefeCm) },
  ]

  // --- Ausführung: Fronten und Ausstattung gezählt -------------------------------------------
  const zaehle = (typ: string) => elemente.filter((e) => e.typeId === typ).length
  const drehtueren = zaehle('drehtuer')
  const schuebe = zaehle('schuebe')
  const schiebeEin = zaehle('schiebetuer')
  const schiebeZwei = elemente.some((e) => e.typeId === ZWEILAEUFIG_TYPE_ID) ? draft.fronts?.schiebetuerAnzahl ?? 2 : 0
  const klappen = elemente.filter((e) => ['stauraumklappe', 'hochstellklappe', 'schreibklappe'].includes(e.typeId)).length
  const offen = zaehle('offen')
  const a = m?.ausstattung ?? []
  const stangenBoeden = a.filter((x) => x.art === 'boden' && x.optionId === 'einlegeboden-kleiderstange').length
  const fachboeden = a.filter((x) => (x.art === 'boden' && x.optionId !== 'einlegeboden-kleiderstange') || x.art === 'glasboden').length
  const container = eindeutig(a.filter((x) => x.art === 'container' || x.art === 'innenschublade').map((x) => x.label))
  const beleuchtung = eindeutig(
    (draft.fronts?.columns ?? []).flatMap((c) => c.equipment ?? []).filter((e) => getEquipmentOption(e.optionId)?.beleuchtung).map((e) => getEquipmentOption(e.optionId)?.label ?? ''),
  )
  const ausfuehrung = [
    schuebe ? anzahl(schuebe, 'Schub', 'Schübe') : '',
    drehtueren ? anzahl(drehtueren, 'Drehtür', 'Drehtüren') : '',
    schiebeZwei ? `${anzahl(schiebeZwei, 'Schiebetür', 'Schiebetüren')} zweiläufig` : '',
    schiebeEin ? `${anzahl(schiebeEin, 'Schiebetür', 'Schiebetüren')} einläufig` : '',
    klappen ? anzahl(klappen, 'Klappe', 'Klappen') : '',
    offen ? anzahl(offen, 'offenes Fach', 'offene Fächer') : '',
    stangenBoeden ? `${anzahl(stangenBoeden, 'Boden', 'Böden')} mit Kleiderstange` : '',
    fachboeden ? anzahl(fachboeden, 'Fachboden', 'Fachböden') : '',
    ...container,
    beleuchtung.length ? 'LED-Beleuchtung' : '',
  ]
    .filter(Boolean)
    .join(', ')

  // --- X-Checkliste (wie im Cramer-Schriftfeld) --------------------------------------------
  const korpusse = g?.korpusse ?? []
  const v = g?.verblendung
  const ab = g?.abschlussSet?.position
  const checkliste: LookbookDaten['checkliste'] = [
    {
      gruppe: 'Fronten',
      haken: [
        { label: drehtueren ? `Drehtüren (${drehtueren})` : 'Drehtüren', an: drehtueren > 0 },
        { label: schiebeZwei || schiebeEin ? `Schiebetüren (${schiebeZwei || schiebeEin})` : 'Schiebetüren', an: schiebeZwei + schiebeEin > 0 },
        { label: schuebe ? `Außenschübe (${schuebe})` : 'Außenschübe', an: schuebe > 0 },
        { label: 'Klappen', an: klappen > 0 },
        { label: 'Offene Fächer', an: offen > 0 },
      ],
    },
    {
      gruppe: 'Korpus',
      haken: [
        { label: 'mit Lochreihe', an: korpusse.some((k) => k.lochreihe) },
        { label: 'ohne Lochreihe', an: korpusse.some((k) => !k.lochreihe) },
        { label: 'Abschlussset links', an: ab === 'links' || ab === 'beide' },
        { label: 'Abschlussset rechts', an: ab === 'rechts' || ab === 'beide' },
        { label: 'Verblendung korpusbündig', an: v?.art === 'korpusbuendig' },
        { label: 'Verblendung frontbündig', an: v?.art === 'frontbuendig' },
      ],
    },
  ]

  // --- Ausführung & Material (Schritt „Material" + Fronten) -------------------------------
  const material: Feld[] = []
  for (const area of series ? getVisibleKorpusAreas(series, draft.korpusMode) : []) {
    const sel = draft.korpus?.[area.id]
    if (sel) material.push({ label: area.label.replace(/^[a-z]\.\s*/, ''), wert: describeMaterialSelection(sel, area.noneLabel) })
  }
  const absch = g?.abschlussSet
  if (absch && absch.position !== 'keine') {
    const wert = absch.materialGetrennt
      ? `links: ${describeMaterialSelection(absch.materialLinks ?? absch.material)} · rechts: ${describeMaterialSelection(absch.materialRechts ?? absch.material)}`
      : describeMaterialSelection(absch.material)
    material.push({ label: 'Abschlussset', wert })
  }
  const fronten = eindeutig(elemente.filter((e) => e.typeId !== 'offen').map(frontText))
  if (fronten.length) material.push({ label: 'Front', wert: fronten.join(' / ') })
  const griffe = eindeutig(elemente.map(describeHandleConfig))
  material.push({ label: 'Griff', wert: griffe.length ? griffe.join(' / ') : '—' })
  if (draft.sichtRueckwandAussen) material.push({ label: 'Sichtrückwand', wert: describeMaterialSelection(draft.korpus?.rueckwandAussen) })

  // --- Sonder-Ausstattung --------------------------------------------------------------------
  const lfm = verblendungLfm(g)
  const line = elemente.filter((e) => e.styleLineId === 'line')
  const aufkantung = line.length
    ? line.some((e) => e.lineAufkantungGleich === false)
      ? eindeutig(line.map((e) => (e.fieldValues?.aufkantung?.material ? describeMaterialSelection(e.fieldValues.aufkantung.material) : ''))).join(' / ') || 'abweichend (Material offen)'
      : 'Line — wie Frontscheibe'
    : '—'
  const sonder: Feld[] = [
    {
      label: 'Verblendung',
      wert:
        v && v.art !== 'keine'
          ? [v.art === 'korpusbuendig' ? 'korpusbündig' : 'frontbündig', verblendungSeitenText(v), lfm != null ? `${formatLfm(lfm)} lfm` : ''].filter(Boolean).join(' · ')
          : '—',
    },
    { label: 'Aufkantung', wert: aufkantung },
    { label: 'Beleuchtung', wert: beleuchtung.length ? beleuchtung.join(', ') : '—' },
    {
      label: 'Fußleiste',
      wert: g?.fussleiste?.enabled ? `H ${g.fussleiste.hoeheCm?.trim() || '?'} × T ${g.fussleiste.tiefeCm?.trim() || '?'} cm` : '—',
    },
  ]
  if (g?.sondermasse?.trim()) sonder.push({ label: 'Sondermaße', wert: g.sondermasse.trim() })

  return {
    titel,
    untertitel,
    nummer: `#${draft.orderNumber?.trim() || draft.id}`,
    kopf,
    masse: masseFelder,
    ausfuehrung: ausfuehrung || '—',
    checkliste,
    material,
    sonder,
  }
}
