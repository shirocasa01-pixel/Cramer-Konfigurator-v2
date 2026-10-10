import type { Draft, FrontElement } from '../types'
import { getBranch } from '../config/branches'
import { getStyleLine } from '../config/frontCatalog'
import { getProductGroup, getSeries } from '../config/productCatalog'
import { describeHandleConfig } from './frontsFormat'
import { ZWEILAEUFIG_TYPE_ID, allElements } from './frontsHelpers'
import { konstruktion, mmText, type Konstruktion2D } from './konstruktion'
import { computeKorpusMasse } from './korpusMass'
import { describeMaterialSelection } from './materialFormat'

/**
 * DATEN DER SEITE 1 DES AV-PDFs — die Felder der Cramer-AV-Konstruktionszeichnung
 * (Vorlage „Refugium 18Raster in 052/9010": Schriftfeld unten).
 *
 * Reine Daten, kein jsPDF — das Zeichnen übernimmt `pdfLookbook.ts`. Alles kommt aus dem
 * Entwurf und den Stammdaten; nichts wird hier neu festgelegt. Felder ohne Gegenstück im
 * Entwurf (Liefertermin) bleiben zum Ausfüllen leer.
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
  /** „Refugium 18Raster in Mattlack – RAL 9010" — Kopfzeile des Schriftfelds. */
  bezeichnung: string
  /** Zeile darunter (Vorlage: „Cramer M + D") — die Filiale. */
  filiale: string
  /** Fuß\Rolle, Höhe, Breite, Tiefe — Maße in mm ohne Einheit. */
  masse: Feld[]
  liefertermin: string
  auftragsdatum: string
  /** Zwei Spalten à fünf Zeilen, zeilenweise: Softschübe | mit Lochreihe, Metallzarge | … */
  haken: Haken[]
  /** GRIFF, Front, Korpus, Platte, RW. */
  ausfuehrung: Feld[]
  auftragserfassung: string
  letzteAenderung: string
  serie: string
  kunde: string
  auftragsnummer: string
  moebelsoftnummer: string
  /** „-- Refugium innen Dekor anthrazit --" über dem Grundriss. */
  innenTitel: string
  /** Material je Front-Element (ID) für die Beschriftung auf den Fronten. */
  frontMaterial: Record<string, string>
  modell: Konstruktion2D | null
}

function datum(iso?: string): string {
  const d = iso ? new Date(iso) : new Date()
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
  const mat = (id: string) => (draft.korpus?.[id] ? describeMaterialSelection(draft.korpus[id]) : '')

  // --- Kopfzeile „Refugium 18Raster in <Korpus>" -----------------------------------------
  const raster = g?.heightMode === '18R' ? '18Raster' : g?.heightMode === '21R' ? '21Raster' : g ? 'Sonderhöhe' : ''
  const korpus = mat('aussen') || eindeutig([mat('aussenLinks'), mat('aussenRechts')]).join(' / ')
  const bezeichnung = [series?.name ?? group?.name ?? '', raster, korpus ? `in ${korpus}` : ''].filter(Boolean).join(' ')

  const mm = (cm: number | undefined) => (cm != null ? mmText(Math.round(cm * 10)) : '')
  const fl = g?.fussleiste
  const masseFelder: Feld[] = [
    { label: 'Fuß\\Rolle', wert: fl?.enabled ? `Fußleiste ${fl.hoeheCm?.trim() || '?'} cm` : '/' },
    { label: 'Höhe', wert: mm(masse.gesamthoeheCm) },
    { label: 'Breite', wert: mm(masse.gesamtbreiteCm) },
    { label: 'Tiefe', wert: mm(masse.korpustiefeCm) },
  ]

  // --- Fronten und Container gezählt (X-Felder) ------------------------------------------------------
  const zaehle = (typ: string) => elemente.filter((e) => e.typeId === typ).length
  const drehtueren = zaehle('drehtuer')
  const schuebe = zaehle('schuebe')
  const schiebeEin = zaehle('schiebetuer')
  const schiebeZwei = elemente.some((e) => e.typeId === ZWEILAEUFIG_TYPE_ID) ? draft.fronts?.schiebetuerAnzahl ?? 2 : 0
  const a = m?.ausstattung ?? []
  const container = eindeutig(a.filter((x) => x.art === 'container' || x.art === 'innenschublade').map((x) => x.label))

  // --- X-Felder wie im Cramer-Schriftfeld ------------------------------------------------------
  const korpusse = g?.korpusse ?? []
  const v = g?.verblendung
  const umlauf = draft.fronts?.abschlussOben?.variant === 'UK' || draft.fronts?.abschlussUnten?.type === 'UK'
  const haken: Haken[] = [
    // Schübe im Planer sind Softschübe; Metallzarge und Umlaufkorpus 30 mm kennt der Entwurf nicht.
    { label: 'Softschübe', an: schuebe > 0 || container.length > 0 },
    { label: 'mit Lochreihe', an: korpusse.some((k) => k.lochreihe) },
    { label: 'Metallzarge', an: false },
    { label: 'ohne Lochreihe', an: korpusse.some((k) => !k.lochreihe) },
    { label: 'Drehtüren', an: drehtueren > 0 },
    { label: 'Front korpusbündig', an: v?.art === 'korpusbuendig' },
    { label: 'Schiebetüren', an: schiebeZwei + schiebeEin > 0 },
    { label: 'Front Standard', an: v?.art !== 'korpusbuendig' },
    { label: 'Umlaufkorpus 20mm', an: umlauf },
    { label: 'Umlaufkorpus 30mm', an: false },
  ]

  // --- GRIFF, Front, Korpus, Platte, RW ------------------------------------------------------
  const griffe = eindeutig(elemente.map(describeHandleConfig))
  const fronten = eindeutig(elemente.filter((e) => e.typeId !== 'offen').map(frontText))
  const innen = mat('innen')
  const ausfuehrung: Feld[] = [
    { label: 'GRIFF', wert: griffe.join(' / ') || '/' },
    { label: 'Front', wert: fronten.join(' / ') || '/' },
    { label: 'Korpus', wert: korpus || '/' },
    { label: 'Platte', wert: mat('abdeckplatte') || '/' },
    { label: 'RW', wert: (draft.sichtRueckwandAussen ? mat('rueckwandAussen') : innen) || '/' },
  ]

  const frontMaterial: Record<string, string> = {}
  for (const el of elemente) {
    const sel = el.fieldValues?.material?.material
    if (sel) frontMaterial[el.id] = describeMaterialSelection(sel)
  }

  return {
    bezeichnung,
    filiale: getBranch(draft.branchId)?.name ?? '',
    masse: masseFelder,
    liefertermin: '',
    auftragsdatum: datum(draft.createdAt),
    haken,
    ausfuehrung,
    auftragserfassung: draft.finalizedAt ? datum(draft.finalizedAt) : '',
    letzteAenderung: datum(),
    serie: series?.name ?? '',
    kunde: draft.customerName?.trim() ?? '',
    auftragsnummer: draft.orderNumber?.trim() ?? '',
    moebelsoftnummer: draft.id,
    innenTitel: `-- ${[series?.name, 'innen', innen].filter(Boolean).join(' ')} --`,
    frontMaterial,
    modell: m,
  }
}
