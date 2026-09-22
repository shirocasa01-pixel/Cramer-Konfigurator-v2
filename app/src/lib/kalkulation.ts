/**
 * KALKULATIONS-ENGINE — aus einem Entwurf wird eine bepreiste Positionsliste.
 *
 * Ablauf (7 Stufen, bewusst in dieser Reihenfolge):
 *
 *   1. NORMALISIEREN   cm-Maße → Rasterstufen und Breiten-Brackets (aufgerundet)
 *   2. ABLEITEN        Mittelseiten und Außenset ergänzen – der Berater wählt sie nie,
 *                      sie folgen aus dem Aufbau
 *   3. PRÜFEN          Plausibilität, Sondermaße, fehlende Angaben
 *   4. BEPREISEN       je Position ein Lookup über die Artikelnummer, gerechnet nach der
 *                      Preisart des Artikels; kein Treffer ⇒ „auf Anfrage", niemals geraten
 *   5. MÖBELPREIS      Summe aller Bauteil-Positionen („Artikel und Ausstattung") plus die
 *                      ARTIKELBEZOGENEN Aufschläge (Raumteiler, Sichtrückwand) auf diesen
 *                      Betrag  ⇒  GESAMTMÖBELPREIS
 *   6. ZUSCHLÄGE       erst danach Montage und Lieferung, jede für sich auf den
 *                      Gesamtmöbelpreis — nie aufeinander, der Möbelpreis bleibt unberührt
 *   7. ERGEBNIS        Positionen + Summen + Meldungen + Vollständigkeitsstatus
 *
 * Drei Prinzipien sind durchgehalten:
 *
 *   • Nie raten. Fehlt eine Preiszeile, entsteht eine Position mit Status „auf Anfrage".
 *     Sie verschwindet nicht und wird nicht geschätzt; solange eine existiert, ist
 *     `vollstaendig === false`.
 *   • Ableitungen begründen. Jede automatisch ergänzte Position trägt einen Klartext-
 *     Hinweis („4 Segmente erfordern 3 Mittelseiten").
 *   • Jeder Preis ist rückverfolgbar — Artikelnummer, Achsenwerte und Seite der
 *     Preisliste hängen an der Position.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  In dieser Datei steht KEIN `if (serieId === 'refugium')`.               │
 * │  Alles Serienspezifische kommt aus `config/preisMapping.ts`.             │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import { equipmentAnzeigename, getEquipmentOption, type EquipmentOption } from '../config/equipment.ts'
import {
  anzahlMittelseiten,
  artikelAufschlaege,
  ausstattungLookups,
  containerLookups,
  containerRaster,
  rasterAusVariante,
  frontLookups,
  getSerienRegel,
  griffImFrontpreisEnthalten,
  grifflaengeCm,
  liniePgAchsenwert,
  schubHoeheCm,
  serviceZuschlaege,
  verblendungLookups,
  type BauteilLookup,
  type SerienRegel,
} from '../config/preisMapping.ts'
import { meta, type Artikel, type Preiszeile } from '../data/stammdaten.generated.ts'
import { pruefeSpalte, segmentGeometrie } from './frontGeometrie.ts'
import {
  formatLfm,
  resolveDepthCm,
  resolveHeightCm,
  resolveKorpusBreiteCm,
  verblendungLfm,
  verblendungRechenweg,
  verblendungSeitenText,
} from './korpusMass.ts'
import {
  artikelImDropdown,
  findePreis,
  findePreisIn,
  getArtikelNr,
  hoeheFuerRasterEtikett,
  preisartVon,
  verfuegbareRaster,
  verfuegbareTiefen,
  type AufgelloesteAchse,
  type MassRichtung,
} from './preisLookup.ts'
import { PREISARTEN, cmText, preisartEinheit, type Preisart } from './preisAchsen.ts'
import {
  AUFSCHLAG_BASIS_KATALOG,
  aufschlagText,
  aufschlagVon,
  type AufschlagBasis,
  type PreisartCode,
} from './preisarten.ts'
import { formatEuro } from './format.ts'
import { NENNMASS_TOLERANZ_MM, hoeheFuerRaster, korpusOffsetMm, loeseRasterAuf } from './raster.ts'
import type {
  Draft,
  FrontElement,
  MaterialSelection,
  PositionsHerkunft,
  PositionsStatus,
  PriceBucket,
  PriceGroup,
  SegmentEquipmentItem,
  ZuschlagArt,
  ZuschlagStufe,
} from '../types/index.ts'

// Die Aufzählungen liegen zentral in `types/index.ts`, weil der Preis-Snapshot
// (eingefrorene Aufträge) dieselben Werte trägt. Re-Export, damit bestehende
// Importe aus diesem Modul unverändert weiterlaufen.
export type { PositionsHerkunft, PositionsStatus, ZuschlagArt, ZuschlagStufe }

// ---------------------------------------------------------------------------
// Ergebnis-Typen
// ---------------------------------------------------------------------------

export interface KalkPosition {
  id: string
  herkunft: PositionsHerkunft
  bucket: PriceBucket
  /** 1-basierte Segmentnummer, falls die Position zu einem Segment gehört. */
  segment?: number
  /** Anzeigename (Artikelbezeichnung aus dem Stamm, ggf. mit Kennzeichnung). */
  label: string
  /** Artikelnummer — der Schlüssel, unter dem der Preis gefunden wurde. */
  artikelnummer?: string
  /** Kurzzeichen als Lesehilfe. */
  kurzzeichen?: string
  /** Teileart / Produktgruppe / Artikelgruppe im Klartext. */
  /** Hauptschritt im Konfigurator (Block 1 der Artikelnummer). */
  teileart?: string
  /** Auswahlfeld, aus dem der Artikel stammt (Block 2 der Artikelnummer). */
  dropdown?: string
  /** Die aufgelösten Achsen A1–A5 mit Bedeutung und Wert. */
  achsen: AufgelloesteAchse[]
  einheit?: string
  /** Seite der gedruckten Preisliste. */
  seite?: string
  menge: number
  einzelpreis: number | null
  gesamt: number | null
  status: PositionsStatus
  /** Begründung: warum abgeleitet, was aufgerundet, warum ohne Preis. */
  hinweis?: string
  /** Nur bei Zuschlägen: welcher Aufschlag — die Abschlussseite hängt ihre Checkboxen daran. */
  zuschlagArt?: ZuschlagArt
  /** Nur bei Zuschlägen: artikelbezogen (Stufe 1) oder nachgelagert (Stufe 2). */
  zuschlagStufe?: ZuschlagStufe
  /** Preisart des Artikels, nach der gerechnet wurde (FESTPREIS, MATRIX_STUFE, …). */
  preisart?: PreisartCode
  /** Artikelnummer der gedruckten Preisliste (z. B. 21033 Montage). */
  preislistenNr?: string
  /**
   * Teilpositionen, wenn der Betrag aus mehreren Bezugsgrößen entsteht (Grundpreis +
   * Preis je m² o. Ä.). Bei einer gewöhnlichen Stückposition enthält die Liste genau
   * einen Eintrag — die Anzeige blendet sie dann aus.
   */
  teile: KalkTeil[]
}

/** Eine Teilposition: Menge × Betrag einer Bezugsgröße. */
export interface KalkTeil {
  /** Name, wenn die Teilposition ein eigener Artikel ist („Einlegeboden", „Kleiderstange"). */
  bezeichnung?: string
  /** Artikelnummer der Teilposition, wenn sie NICHT aus dem Artikel der Position stammt. */
  artikelnummer?: string
  menge: number
  /** Die Menge lesbar, mit Einheit („123 cm", „1,48 m²", „2"). */
  mengeText: string
  preis: number
  /** Einheit des Betrags („€", „€/m²", „€/m", „€/cm"). */
  preisEinheit: string
  gesamt: number
}

export type Schwere = 'fehler' | 'warnung' | 'info'

export interface KalkMeldung {
  schwere: Schwere
  text: string
}

/** Ein nachgelagerter Zuschlag mit seinem Schalter — auch abgewählt, mit dem Betrag, den er kosten würde. */
export interface ServiceAuswahl {
  art: 'montage' | 'lieferung'
  option: 'montage' | 'lieferungRegional'
  aktiv: boolean
  position: KalkPosition
}

export interface KalkErgebnis {
  positionen: KalkPosition[]
  /** Stufe 1: artikelbezogene Aufschläge auf den Möbelpreis. */
  artikelAufschlaege: KalkPosition[]
  /** Stufe 2: nachgelagerte Zuschläge auf den Gesamtmöbelpreis — nur die angehakten. */
  serviceZuschlaege: KalkPosition[]
  /** Alle Stufe-2-Zuschläge mit Schalterstellung, für die Häkchen im Abschluss. */
  serviceAuswahl: ServiceAuswahl[]
  /** Beide Stufen zusammen — so steht es im Preis-Snapshot. */
  zuschlaege: KalkPosition[]
  /** Summe der Bauteil-Positionen („Artikel und Ausstattung"), ohne jeden Aufschlag. */
  moebelpreis: number
  /** Summe der artikelbezogenen Aufschläge. */
  summeArtikelAufschlaege: number
  /** Möbelpreis + artikelbezogene Aufschläge — die Basis von Montage und Lieferung. */
  gesamtmoebelpreis: number
  /** Gesamtmöbelpreis + Montage + Lieferung (soweit angehakt). */
  gesamt: number
  meldungen: KalkMeldung[]
  offenePositionen: number
  /** true = keine Fehler und keine offenen Positionen ⇒ Preis ist verbindlich. */
  vollstaendig: boolean
  gueltigkeit: string
  waehrung: string
}

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

function runde2(n: number): number {
  return Math.round(n * 100) / 100
}

function zahl(v: string | undefined | null): number | undefined {
  if (v == null) return undefined
  const s = String(v).trim()
  if (!s) return undefined
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

function pgVon(sel: MaterialSelection | undefined): PriceGroup | undefined {
  return sel?.priceGroup
}

/**
 * PREISGRUPPE DER INNENAUSSTATTUNG EINES SEGMENTS.
 *
 * Dietmar Cramer, Überarbeitung 6, S. 2: „Das Material der Ausstattung orientiert sich
 * immer am Material des Innenkorpus. Es muss also nicht extra gewählt werden. Ist der
 * Innenkorpus Decoboard, ist auch die Ausstattung in Decoboard."
 *
 * Die Kette lautet damit:
 *   Innenausführung → Oberfläche → Preisgruppe (aus den Stammdaten) → Preiszeile
 *
 * Wo das Innenmaterial je Korpus getrennt gewählt wurde, gilt das des Korpus, hinter
 * dem das Teil sitzt — sonst die einheitliche Auswahl. Der Berater wählt nie eine
 * Preisgruppe; sie ist eine kaufmännische Eigenschaft der Oberfläche.
 */
function innenPgFuerKorpus(draft: Draft, index: number): PriceGroup | undefined {
  const korpusId = draft.korpusGrunddaten?.korpusse?.[index]?.id
  const jeKorpus = korpusId ? draft.korpusInnenJeKorpus?.[korpusId] : undefined
  return pgVon(jeKorpus) ?? pgVon(draft.korpus?.innen)
}

/** Rangfolge der Preisgruppen — PG 4 ist die teuerste. */
const PG_RANG: Record<PriceGroup, number> = { PG1: 1, PG2: 2, PG3: 3, PG4: 4 }

/**
 * DIE TEUERSTE PREISGRUPPE einer Liste.
 *
 * Überarbeitung 8, S. 4 — ein Schrank aus 50er PG 1, 60er PG 2 und 100er PG 3: „Die
 * Mittelseite soll dann immer in der teuersten Preisgruppe gerechnet werden. In dem Fall
 * also in PG3." Ebenso das Abschlussset bei links PG 3 / rechts PG 2 → PG 3.
 */
export function hoechstePreisgruppe(pgs: ReadonlyArray<PriceGroup | undefined>): PriceGroup | undefined {
  return pgs.reduce<PriceGroup | undefined>(
    (max, pg) => (pg && (!max || PG_RANG[pg] > PG_RANG[max]) ? pg : max),
    undefined,
  )
}

function pgText(pg: PriceGroup): string {
  return pg.replace('PG', 'PG ')
}

let lfd = 0
function naechsteId(): string {
  lfd += 1
  return `kalk-${lfd}`
}

// ---------------------------------------------------------------------------
// Kern: eine Position bepreisen
// ---------------------------------------------------------------------------

interface PositionsEingabe {
  lookup: BauteilLookup
  /** Stückzahl der Position — bei Mengenachsen der Faktor ÜBER die Mengenachse hinaus. */
  menge: number
  bucket: PriceBucket
  herkunft: PositionsHerkunft
  /** Überschreibt die Artikelbezeichnung (z. B. „Korpus 1"). */
  label?: string
  /** Zusatz hinter der Bezeichnung, z. B. die Kennzeichnung „D1". */
  zusatz?: string
  segment?: number
  breiteCm?: number
  /** Höhe des Bauteils in cm; bei `hoeheAusKorpus` die Korpushöhe. */
  hoeheCm?: number
  tiefeCm?: number
  /** Laufende Länge in cm (Verblendung, Aufkantung, LED-Band). */
  laengeCm?: number
  liniePg?: string
  pg?: PriceGroup
  hinweis?: string
  /**
   * Begründung, wenn das Maß einer Bezugsgröße fehlt — ersetzt „bitte im Entwurf
   * erfassen" dort, wo es im Entwurf nichts zu erfassen gibt.
   */
  grundOhneMass?: string
}

/**
 * MENGE EINER TEILPOSITION.
 *
 * Bis zur Achsen-Reform war die Menge immer eine Stückzahl, und ob ein Betrag „je
 * laufendem Meter" oder „je Quadratmeter" galt, stand nur im Einheitentext — gerechnet
 * wurde es nie. Jetzt sagt die Achse PREISART, worauf sich der Betrag bezieht, und die
 * Maßachsen des Artikels sagen, welche Maße die Menge liefern.
 *
 * Fehlt das nötige Maß, kommt `null` zurück: Die Position bleibt dann offen, statt
 * stillschweigend mit Menge 1 gerechnet zu werden.
 */
function mengeFuerPreisart(
  preisart: Preisart,
  eingabe: PositionsEingabe,
  mengenachsen: readonly MassRichtung[],
): { menge: number; text: string } | null {
  if (preisart === PREISARTEN.FIX) {
    return { menge: eingabe.menge, text: String(eingabe.menge) }
  }

  if (preisart === PREISARTEN.QM) {
    // Welche zwei Maße die Fläche bilden, steht in den Maßachsen des Artikels.
    const werte: Record<MassRichtung, number | undefined> = {
      breite: eingabe.breiteCm,
      hoehe: eingabe.hoeheCm,
      tiefe: eingabe.tiefeCm,
      laenge: eingabe.laengeCm,
    }
    const seiten = mengenachsen.map((r) => werte[r]).filter((n): n is number => n != null)
    if (seiten.length < 2) return null
    const qm = (seiten[0] * seiten[1]) / 10000
    return { menge: runde2(qm * eingabe.menge), text: `${cmText(runde2(qm))} m²` }
  }

  const laenge = eingabe.laengeCm
  if (laenge == null) return null
  if (preisart === PREISARTEN.CM) {
    return { menge: runde2(laenge * eingabe.menge), text: `${cmText(laenge)} cm` }
  }
  // Meter mit zwei Nachkommastellen: „3,35 m" — auf eine Stelle gerundet stünde neben
  // 251,25 € ein „3,4 m", das sich nicht nachrechnen lässt.
  const meter = runde2(laenge / 100)
  return { menge: runde2(meter * eingabe.menge), text: `${String(meter).replace('.', ',')} m` }
}

function bauePosition(eingabe: PositionsEingabe): KalkPosition {
  const { lookup } = eingabe
  const stamm = getArtikelNr(lookup.artikel)

  const ergebnis = findePreis({
    artikelnummer: lookup.artikel,
    breiteCm: eingabe.breiteCm,
    hoeheCm: lookup.nutztHoehe ? eingabe.hoeheCm : undefined,
    tiefeCm: lookup.nutztTiefe ? eingabe.tiefeCm : undefined,
    laengeCm: eingabe.laengeCm,
    liniePg: lookup.nutztLiniePg ? eingabe.liniePg : undefined,
    pg: lookup.nutztPg ? eingabe.pg : undefined,
  })

  const basisLabel = eingabe.label ?? lookup.label ?? stamm?.bezeichnung ?? lookup.artikel
  const label = eingabe.zusatz ? `${basisLabel} „${eingabe.zusatz}"` : basisLabel

  const gemeinsam = {
    id: naechsteId(),
    herkunft: eingabe.herkunft,
    bucket: eingabe.bucket,
    segment: eingabe.segment,
    label,
    artikelnummer: lookup.artikel,
    kurzzeichen: stamm?.kurzzeichen,
    teileart: stamm?.teileart,
    dropdown: stamm?.dropdown,
    einheit: stamm?.einheit,
    preisart: stamm ? preisartVon(stamm) : undefined,
    menge: eingabe.menge,
  }

  const offen = (grund: string): KalkPosition => ({
    ...gemeinsam,
    achsen: ergebnis.status === 'gefunden' ? ergebnis.achsen : [],
    teile: [],
    einzelpreis: null,
    gesamt: null,
    status: 'auf-anfrage',
    hinweis: [eingabe.hinweis, grund].filter(Boolean).join(' — ') || undefined,
  })

  if (ergebnis.status === 'auf-anfrage') return offen(ergebnis.grund)

  const hinweise = [eingabe.hinweis]
  if (ergebnis.aufgerundet && ergebnis.gewaehlteStufen.length > 0) {
    hinweise.push(`Sondermaß: bepreist mit der nächstgrößeren Stufe ${ergebnis.gewaehlteStufen.join(' · ')}.`)
  }

  // „Festpreis + Matrix": beide Teile tragen ihren Namen, damit die Position zeigt, wie
  // Grundpreis und variabler Preis zusammenkommen (75 € + 1,5 m × 180 €/m = 345 €).
  const kombiniert = ergebnis.preisart === 'FEST_PLUS_MATRIX'
  const teile: KalkTeil[] = []
  for (const teil of ergebnis.teile) {
    const menge = mengeFuerPreisart(teil.preisart, eingabe, ergebnis.mengenachsen)
    if (!menge) {
      return offen(
        eingabe.grundOhneMass ??
          `Für die Bezugsgröße ${teil.preisart} fehlt das zugehörige Maß — bitte im Entwurf erfassen.`,
      )
    }
    teile.push({
      ...(kombiniert ? { bezeichnung: teil.preisart === PREISARTEN.FIX ? 'Grundpreis' : 'variabler Preis' } : {}),
      menge: menge.menge,
      mengeText: menge.text,
      preis: teil.preis,
      preisEinheit: preisartEinheit(teil.preisart),
      gesamt: runde2(teil.preis * menge.menge),
    })
  }

  const gesamt = runde2(teile.reduce((summe, t) => summe + t.gesamt, 0))

  return {
    ...gemeinsam,
    preisart: ergebnis.preisart,
    achsen: ergebnis.achsen,
    seite: ergebnis.teile[0].seite,
    // Einzelpreis bleibt der Betrag der ERSTEN Teilposition; bei mehreren Bezugsgrößen
    // trägt die Anzeige die Aufschlüsselung, nicht diese eine Zahl.
    einzelpreis: ergebnis.teile[0].preis,
    gesamt,
    status: 'berechnet',
    hinweis: hinweise.filter(Boolean).join(' ') || undefined,
    teile,
  }
}

/** Eingaben der Preisprobe: Maße in cm, Merkmale als Achsenwert. */
export interface ProbeEingabe {
  breiteCm?: number
  hoeheCm?: number
  tiefeCm?: number
  laengeCm?: number
  pg?: string
  liniePg?: string
  menge?: number
}

export type ProbeErgebnis =
  | { status: 'berechnet'; preisart: PreisartCode; teile: KalkTeil[]; gesamt: number; hinweis?: string }
  | { status: 'auf-anfrage'; grund: string }

/**
 * PREISPROBE — ein Artikel samt Preiszeilen, durchgerechnet wie in der Kalkulation.
 *
 * Die Artikelverwaltung rechnet damit den ungespeicherten Formularstand: gleicher Lookup
 * (`findePreisIn`), gleiche Mengenrechnung (`mengeFuerPreisart`), gleiche Rundung. Was die
 * Probe zeigt, zeigt deshalb auch die Kalkulation — sobald gespeichert ist.
 */
export function bepreiseProbe(
  artikel: Artikel,
  zeilen: readonly Preiszeile[],
  probe: ProbeEingabe,
): ProbeErgebnis {
  const ergebnis = findePreisIn(artikel, zeilen, probe)
  if (ergebnis.status === 'auf-anfrage') return { status: 'auf-anfrage', grund: ergebnis.grund }
  const eingabe: PositionsEingabe = {
    lookup: { artikel: artikel.artikelnummer },
    menge: probe.menge ?? 1,
    bucket: 'innen',
    herkunft: 'gewaehlt',
    breiteCm: probe.breiteCm,
    hoeheCm: probe.hoeheCm,
    tiefeCm: probe.tiefeCm,
    laengeCm: probe.laengeCm,
  }
  const teile: KalkTeil[] = []
  for (const teil of ergebnis.teile) {
    const menge = mengeFuerPreisart(teil.preisart, eingabe, ergebnis.mengenachsen)
    if (!menge) return { status: 'auf-anfrage', grund: `Für die Bezugsgröße ${teil.preisart} fehlt das zugehörige Maß.` }
    teile.push({
      ...(ergebnis.preisart === 'FEST_PLUS_MATRIX'
        ? { bezeichnung: teil.preisart === PREISARTEN.FIX ? 'Grundpreis' : 'variabler Preis' }
        : {}),
      menge: menge.menge,
      mengeText: menge.text,
      preis: teil.preis,
      preisEinheit: preisartEinheit(teil.preisart),
      gesamt: runde2(teil.preis * menge.menge),
    })
  }
  return {
    status: 'berechnet',
    preisart: ergebnis.preisart,
    teile,
    gesamt: runde2(teile.reduce((s, t) => s + t.gesamt, 0)),
    hinweis:
      ergebnis.aufgerundet && ergebnis.gewaehlteStufen.length
        ? `Auf die hinterlegte Stufe ${ergebnis.gewaehlteStufen.join(' · ')} gehoben.`
        : ergebnis.gewaehlteStufen.length
          ? `Stufe ${ergebnis.gewaehlteStufen.join(' · ')}.`
          : undefined,
  }
}

/**
 * EINE POSITION AUS MEHREREN ARTIKELN (`BauteilLookup.komponenten`).
 *
 * Überarbeitung 8, S. 5: „Einlegeboden inkl. Kleiderstange" = Einlegebodenpreis + 15 €.
 * Beide Beträge stehen als eigene Stammdaten — der Boden mit Breite × Tiefe × Preisgruppe,
 * die Kleiderstange als Aufpreis. Die Position zeigt sie als zwei benannte Teilpositionen:
 *
 *     Einlegeboden    1 × 55 €
 *     Kleiderstange   1 × 15 €        70 €
 *
 * Fehlt für eine Komponente der Preis, ist die ganze Position „auf Anfrage" — ein halber
 * Preis wäre schlimmer als keiner.
 */
function baueMitKomponenten(eingabe: PositionsEingabe): KalkPosition {
  const haupt = bauePosition(eingabe)
  const komponenten = eingabe.lookup.komponenten ?? []
  if (komponenten.length === 0 || haupt.status !== 'berechnet') return haupt

  const teile: KalkTeil[] = haupt.teile.map((t) => ({ ...t, bezeichnung: eingabe.lookup.teilLabel ?? t.bezeichnung }))
  let einzelpreis = haupt.einzelpreis ?? 0
  const erklaerung = [`${eingabe.lookup.teilLabel ?? 'Hauptteil'} ${runde2(haupt.einzelpreis ?? 0)} €`]
  for (const komponente of komponenten) {
    const teil = bauePosition({
      ...eingabe,
      lookup: { artikel: komponente.artikel, nutztPg: true, nutztTiefe: true },
      hinweis: undefined,
    })
    if (teil.status !== 'berechnet') {
      return {
        ...haupt,
        teile: [],
        einzelpreis: null,
        gesamt: null,
        status: 'auf-anfrage',
        hinweis: [haupt.hinweis, `${komponente.label}: ${teil.hinweis ?? 'kein Preis hinterlegt'}`].filter(Boolean).join(' — '),
      }
    }
    teile.push(...teil.teile.map((t) => ({ ...t, bezeichnung: komponente.label, artikelnummer: komponente.artikel })))
    einzelpreis += teil.einzelpreis ?? 0
    erklaerung.push(`${komponente.label} ${runde2(teil.einzelpreis ?? 0)} € (${komponente.artikel})`)
  }
  return {
    ...haupt,
    teile,
    einzelpreis: runde2(einzelpreis),
    gesamt: runde2(teile.reduce((summe, t) => summe + t.gesamt, 0)),
    hinweis: [haupt.hinweis, `Je Stück: ${erklaerung.join(' + ')} = ${runde2(einzelpreis)} €.`].filter(Boolean).join(' '),
  }
}

// ---------------------------------------------------------------------------
// Stufe 1–3: Korpus-Kontext
// ---------------------------------------------------------------------------

interface KorpusKontext {
  hoeheCm?: number
  tiefeCm?: number
  /** Breiten der Segmente von links nach rechts. */
  breiten: number[]
  /** Die bepreiste Rasterstufe — nur noch für die Klartext-Begründung. */
  bepreistesRaster?: number
  /**
   * Die KORPUSHÖHE der bepreisten Stufe in Zentimetern. Das ist seit der Achsen-Reform
   * der Preisschlüssel: Korpus, Mittelseite, Außenset und LED-Band führen eine Höhenachse
   * in cm, nicht mehr eine Rasterzahl, die je Artikel etwas anderes bedeutet.
   */
  korpusHoeheCm?: number
  rasterHinweis?: string
  /**
   * Die bepreiste TIEFENSTUFE (31 · 41 · 60 cm) — nächstgrößere Stufe zur Korpustiefe.
   * Gilt für Korpus, Mittelseite und Einlegeboden gleichermaßen (Atrium S. 13 / 14 / 15).
   * Eine Beleuchtungs-Tiefenzugabe ist ein Planungsmaß und verschiebt diese Stufe nicht.
   */
  bepreisteTiefeCm?: number
}

function leseKorpusKontext(draft: Draft, regel: SerienRegel, meldungen: KalkMeldung[]): KorpusKontext {
  const g = draft.korpusGrunddaten
  const hoeheCm = g ? resolveHeightCm(g) : zahl(draft.dimensions?.heightCm)
  const tiefeCm = g ? resolveDepthCm(g) : zahl(draft.dimensions?.depthCm)

  let breiten: number[] = []
  if (g && g.korpusse.length > 0) {
    breiten = g.korpusse.map((k) => resolveKorpusBreiteCm(k)).filter((w): w is number => w != null)
    if (breiten.length !== g.korpusse.length) {
      meldungen.push({ schwere: 'fehler', text: 'Mindestens ein Korpus hat keine gültige Breite.' })
    }
  } else {
    const gesamt = zahl(draft.dimensions?.widthCm)
    const segmente = draft.dimensions?.segments ?? 0
    if (gesamt != null && segmente > 0) {
      breiten = Array.from({ length: segmente }, () => runde2(gesamt / segmente))
      meldungen.push({
        schwere: 'info',
        text: `Keine Korpus-Grunddaten hinterlegt – die Gesamtbreite ${gesamt} cm wurde gleichmäßig auf ${segmente} Segmente verteilt.`,
      })
    }
  }

  const kontext: KorpusKontext = { hoeheCm, tiefeCm, breiten }

  // Tiefenstufe nach „Preis des nächstgrößeren Maßes" (Preisliste S. 13/14/15, „Sondermaße").
  const tiefenStufen = regel.korpus?.nutztTiefe ? verfuegbareTiefen(regel.korpus.artikel) : []
  if (tiefeCm != null && tiefenStufen.length > 0) {
    kontext.bepreisteTiefeCm = tiefenStufen.find((t) => t >= tiefeCm - 0.001)
  }

  if (hoeheCm != null && regel.korpus) {
    const offset = korpusOffsetMm(regel.id)
    if (offset == null) {
      meldungen.push({
        schwere: 'fehler',
        text: `Für die Serie ${regel.id} ist in „50 Meta" kein Korpushöhen-Offset hinterlegt.`,
      })
    } else {
      const verfuegbar = verfuegbareRaster(regel.korpus.artikel)
      // Nennmaß-Toleranz nur fuer die KORPUS-Hoehe: „21 Raster (~274 cm)" ist ein
      // gerundeter Anzeigewert (rechnerisch 273,4 cm) und darf nicht auf die
      // unbepreiste Stufe 22 kippen. Die Frontberechnung weiter unten bleibt ohne
      // Toleranz — dort gibt es keine gerundeten Nennmasse.
      const aufloesung = loeseRasterAuf(hoeheCm, offset, verfuegbar, NENNMASS_TOLERANZ_MM)
      kontext.bepreistesRaster = aufloesung.bepreistesRaster ?? undefined
      // Der Lookup fragt in Zentimetern. Maßgeblich ist die Höhe der BEPREISTEN Stufe,
      // wie sie in der Preiszeile steht — nicht die eingegebene: Sonst würde ein
      // Zwischenmaß eine Stufe zu hoch greifen, obwohl es bereits angehoben wurde.
      kontext.korpusHoeheCm =
        aufloesung.bepreistesRaster != null
          ? hoeheFuerRasterEtikett(regel.korpus.artikel, aufloesung.bepreistesRaster) ??
            aufloesung.bepreisteHoeheCm ??
            undefined
          : undefined
      if (aufloesung.bepreistesRaster == null) {
        meldungen.push({
          schwere: 'fehler',
          text: `Höhe ${hoeheCm} cm liegt über der größten bepreisten Korpus-Stufe (${verfuegbar[verfuegbar.length - 1]} R ≈ ${hoeheFuerRaster(verfuegbar[verfuegbar.length - 1], offset)} cm) – Sondermaß, AV-Prüfung.`,
        })
      } else if (aufloesung.istSondermass || aufloesung.angehoben) {
        kontext.rasterHinweis = `Höhe ${hoeheCm} cm ist kein Rastermaß (rechnerisch ${aufloesung.raster} R). Bepreist mit ${aufloesung.bepreistesRaster} R ≈ ${aufloesung.bepreisteHoeheCm} cm.`
        meldungen.push({ schwere: 'info', text: kontext.rasterHinweis })
      }
    }
  }

  // Plausibilitätsprüfung nur im Legacy-Pfad: Liegen Korpus-Grunddaten vor, ist
  // `dimensions.widthCm` seit Punkt 4.13 das ERRECHNETE Außenmaß (Fronten + Fugen +
  // Abschlusssets) und damit bewusst ungleich der Summe der Korpus-Nennbreiten —
  // ein Vergleich der beiden würde bei jedem Möbel eine falsche Warnung erzeugen.
  if (!draft.korpusGrunddaten) {
    const erfasst = zahl(draft.dimensions?.widthCm)
    const summe = breiten.reduce((a, b) => a + b, 0)
    if (erfasst != null && breiten.length > 0 && Math.abs(erfasst - summe) > 0.5) {
      meldungen.push({
        schwere: 'warnung',
        text: `Die Segmentbreiten ergeben ${runde2(summe)} cm, erfasst sind ${erfasst} cm Gesamtbreite (Differenz ${runde2(Math.abs(erfasst - summe))} cm).`,
      })
    }
  }

  return kontext
}

// ---------------------------------------------------------------------------
// Stufe 4a: Korpus & abgeleitete Bauteile
// ---------------------------------------------------------------------------

function baueKorpusPositionen(
  draft: Draft,
  regel: SerienRegel,
  kontext: KorpusKontext,
  meldungen: KalkMeldung[],
): KalkPosition[] {
  const positionen: KalkPosition[] = []
  const korpiOhnePg: number[] = []
  if (!regel.korpus || kontext.bepreistesRaster == null) return positionen

  // Punkt 5.13.3: Sondertiefe ⇒ der Standard-Korpuspreis gilt nicht. Begründung und
  // Grenzwert stehen in `config/preisMapping.ts`, nicht hier.
  const nurStandard = regel.korpusNurStandardtiefe
  const sondertiefe =
    nurStandard != null && kontext.tiefeCm != null && kontext.tiefeCm !== nurStandard.standardTiefeCm

  /*
   * TIEFE ALS PREISACHSE.
   *
   * Die Preisliste führt drei Tiefenstufen (31 · 41 · 60 cm), der Berater gibt ein
   * Zentimetermaß ein. Es gilt dieselbe Regel wie bei Breite und Raster: „Preis des
   * nächstgrößeren Maßes" (Preisliste S. 13/14/15, Kopfzeile „Sondermaße").
   *
   * Aufgerundet wird HIER und nicht im Lookup, weil TIEFE dort ein harter Filter ist —
   * 45 cm fände sonst keine Zeile und würde als „auf Anfrage" ausgewiesen, obwohl die
   * Preisliste für diesen Fall ausdrücklich die 60er-Stufe vorsieht.
   */
  const tiefenStufen = regel.korpus.nutztTiefe ? verfuegbareTiefen(regel.korpus.artikel) : []
  const bepreisteTiefe = kontext.bepreisteTiefeCm
  if (regel.korpus.nutztTiefe && kontext.tiefeCm != null && bepreisteTiefe == null && tiefenStufen.length > 0) {
    meldungen.push({
      schwere: 'fehler',
      text: `Korpustiefe ${kontext.tiefeCm} cm liegt über der größten bepreisten Stufe (${tiefenStufen[tiefenStufen.length - 1]} cm) – Sondermaß, AV-Prüfung.`,
    })
  }

  kontext.breiten.forEach((breite, i) => {
    if (sondertiefe && nurStandard) {
      const stamm = getArtikelNr(regel.korpus!.artikel)
      positionen.push({
        id: naechsteId(),
        herkunft: 'gewaehlt',
        bucket: 'korpus',
        segment: i + 1,
        label: `Korpus ${i + 1}`,
        artikelnummer: regel.korpus!.artikel,
        kurzzeichen: stamm?.kurzzeichen,
        teileart: stamm?.teileart,
        dropdown: stamm?.dropdown,
        einheit: stamm?.einheit,
        achsen: [],
        teile: [],
        menge: 1,
        einzelpreis: null,
        gesamt: null,
        status: 'auf-anfrage',
        hinweis: `Sondertiefe ${kontext.tiefeCm} cm statt ${nurStandard.standardTiefeCm} cm. ${nurStandard.grund}`,
      })
      return
    }
    // Innenausführung je Korpus, sonst die einheitliche Auswahl — dieselbe Kette wie
    // bei der Innenausstattung: Oberfläche → Preisgruppe → Preiszeile.
    const innenPg = innenPgFuerKorpus(draft, i)
    if (regel.korpus!.nutztPg && innenPg == null) korpiOhnePg.push(i + 1)

    const hinweise = [
      kontext.rasterHinweis,
      regel.korpus!.nutztTiefe && bepreisteTiefe != null && kontext.tiefeCm != null
        ? kontext.tiefeCm === bepreisteTiefe
          ? `Tiefenstufe ${bepreisteTiefe} cm.`
          : `Tiefe ${kontext.tiefeCm} cm ist keine Preisstufe – bepreist mit der nächstgrößeren Stufe ${bepreisteTiefe} cm.`
        : null,
      regel.korpus!.nutztPg && innenPg
        ? `Preisgruppe ${innenPg.replace('PG', 'PG ')} aus der Innenausführung des Korpus.`
        : null,
    ].filter(Boolean)

    positionen.push(
      bauePosition({
        lookup: regel.korpus as BauteilLookup,
        menge: 1,
        bucket: 'korpus',
        herkunft: 'gewaehlt',
        label: `Korpus ${i + 1}`,
        segment: i + 1,
        breiteCm: breite,
        hoeheCm: kontext.korpusHoeheCm,
        tiefeCm: bepreisteTiefe,
        pg: innenPg,
        hinweis: hinweise.length ? hinweise.join(' ') : undefined,
      }),
    )
  })

  if (korpiOhnePg.length > 0) {
    meldungen.push({
      schwere: 'warnung',
      text: `Für die Innenausführung ist keine Preisgruppe hinterlegt – Korpus ${korpiOhnePg.join(', ')} ist damit nicht bepreisbar. Bitte das Innenmaterial im Schritt „Material" festlegen.`,
    })
  }

  if (sondertiefe && nurStandard) {
    meldungen.push({
      schwere: 'warnung',
      text: `Sondertiefe ${kontext.tiefeCm} cm: Die Korpuspreise sind nicht automatisch ermittelbar – bitte über die AV klären.`,
    })
  }

  // Verblendung — seit Überarbeitung 6 (S. 7) eine Angabe je MÖBEL im Schritt „Maße"
  // statt einer Ausstattungs-Option je Segment. Korpusbündig und frontbündig schließen
  // einander aus; der Datentyp lässt deshalb nur eines von beidem zu.
  const verblendung = draft.korpusGrunddaten?.verblendung
  if (verblendung && verblendung.art !== 'keine') {
    const lookup = verblendungLookups[verblendung.art]
    if (lookup) {
      /*
       * LAUFENDE METER — seit der Positionswahl per Haken errechnet.
       *
       * Die Preiszeile trägt „€/m" (Achse PREISART, 75 €/m korpusbündig, 150 €/m
       * frontbündig); die Menge sind die Laufmeter. Sie ergeben sich aus den Haken:
       * links/rechts je einmal die Schrankhöhe, oben einmal die Schrankbreite (Summe der
       * Korpusbreiten) — überschreibbar für Sonderanforderungen (`verblendungLfm`).
       * Die Position nennt Art, Seiten und Laufmeter im Titel:
       *     „Verblendung korpusbündig (Links, Oben) · 5,35 lfm"
       */
      const g = draft.korpusGrunddaten
      const lfm = verblendungLfm(g)
      const art = verblendung.art === 'korpusbuendig' ? 'korpusbündig' : 'frontbündig'
      const seiten = verblendungSeitenText(verblendung)
      const rechenweg = verblendungRechenweg(g)
      const hinweise = [
        'Einmal je Möbel.',
        rechenweg && !verblendung.lfmManuell ? `Laufmeter: ${rechenweg}${lfm != null ? ` = ${formatLfm(lfm)} lfm` : ''}.` : null,
        verblendung.lfmManuell ? 'Laufmeter vom Berater manuell eingetragen.' : null,
        verblendung.positionNote?.trim() ? `Position (Freitext): ${verblendung.positionNote.trim()}.` : null,
        lfm == null
          ? 'Ohne Laufmeter-Angabe – der Betrag ist der Preis je laufendem Meter und kann nicht mit der Länge multipliziert werden.'
          : null,
      ].filter(Boolean)
      positionen.push(
        bauePosition({
          lookup,
          menge: 1,
          bucket: 'korpus',
          herkunft: 'gewaehlt',
          label: `Verblendung ${art}${seiten ? ` (${seiten})` : ''}${lfm != null ? ` · ${formatLfm(lfm)} lfm` : ''}`,
          laengeCm: lfm != null ? runde2(lfm * 100) : undefined,
          hinweis: hinweise.join(' '),
        }),
      )
    }
  }

  // Fußleistenausschnitt — einmal je Möbel, nicht je Korpus: Die Preiszeile trägt die
  // Einheit „EUR/für 2 Seiten" und meint damit das ganze Möbel.
  if (draft.korpusGrunddaten?.fussleiste?.enabled && regel.fussleistenausschnitt) {
    const masse = [
      draft.korpusGrunddaten.fussleiste.hoeheCm?.trim()
        ? `Höhe ${draft.korpusGrunddaten.fussleiste.hoeheCm} cm`
        : null,
      draft.korpusGrunddaten.fussleiste.tiefeCm?.trim()
        ? `Tiefe ${draft.korpusGrunddaten.fussleiste.tiefeCm} cm`
        : null,
    ].filter(Boolean)
    positionen.push(
      bauePosition({
        lookup: regel.fussleistenausschnitt,
        menge: 1,
        bucket: 'korpus',
        herkunft: 'abgeleitet',
        label: 'Fußleistenausschnitt',
        hinweis: masse.length
          ? `Aus dem Fußleistenausschnitt (${masse.join(' · ')}) — einmal je Möbel.`
          : 'Aus dem Fußleistenausschnitt — einmal je Möbel.',
      }),
    )
  }

  // Punkt 5.3: Führt der Korpus-Artikel keine Preisgruppen-Achse, ist eine von
  // Decoboard abweichende Innenausführung nicht bepreisbar. Das gehört gesagt.
  if (!regel.korpus.nutztPg) {
    const innenGruppen = new Set(
      [
        draft.korpus?.innen?.materialGroupId,
        ...Object.values(draft.korpusInnenJeKorpus ?? {}).map((m) => m.materialGroupId),
      ].filter((g): g is string => g != null && g !== 'decoboard'),
    )
    if (innenGruppen.size > 0) {
      meldungen.push({
        schwere: 'warnung',
        text: `Innenausführung ${[...innenGruppen].join(', ')} gewählt: Der Korpus-Artikel ${regel.korpus.artikel} führt im Preisblatt keine Preisgruppen-Achse – der Aufpreis ist nicht automatisch ermittelbar und von der AV zu ergänzen.`,
      })
    }
  }

  // Die Anzahl folgt der Konstruktionsregel der Serie (config/preisMapping.ts) — hier
  // steht bewusst keine fest verdrahtete Formel.
  const segmente = kontext.breiten.length
  const mittelseiten = anzahlMittelseiten(regel.mittelseitenRegel, segmente)
  if (regel.mittelseite && mittelseiten > 0) {
    /*
     * PREISGRUPPE UND TIEFE DER MITTELSEITE (Überarbeitung 8, S. 2 und 4).
     *
     * Die Mittelseite folgt dem Material der Korpi — und bei unterschiedlichen Materialien
     * der TEUERSTEN Preisgruppe: 50er PG 1 + 60er PG 2 + 100er PG 3 ⇒ PG 3. Den Betrag
     * liefert allein die Preiszeile (Mittelseite × Höhe × Tiefe × PG); in PG 2–4 steht dort
     * der Atrium-Preis der „Seite", in PG 1 der Refugium-Preis.
     */
    const korpusPgs = kontext.breiten.map((_, i) => innenPgFuerKorpus(draft, i))
    const pg = regel.mittelseite.nutztPg ? hoechstePreisgruppe(korpusPgs) : undefined
    const verschieden = new Set(korpusPgs.filter(Boolean)).size > 1
    const hinweise = [
      regel.mittelseitenRegel === 'abschluss'
        ? `Automatisch ergänzt: Jeder der ${segmente} Korpi bringt seine linke Seite mit — nötig ist nur die Wand, die den Block rechts abschließt.`
        : `Automatisch ergänzt: ${segmente} Segmente erfordern ${mittelseiten} Mittelseite(n).`,
      pg
        ? verschieden
          ? `Preisgruppe ${pgText(pg)} = teuerste Preisgruppe der Korpi (${korpusPgs.map((p) => (p ? pgText(p) : '—')).join(' · ')}).`
          : `Preisgruppe ${pgText(pg)} aus der Innenausführung der Korpi.`
        : null,
      regel.mittelseite.nutztTiefe && kontext.bepreisteTiefeCm != null ? `Tiefenstufe ${kontext.bepreisteTiefeCm} cm.` : null,
    ].filter(Boolean)
    positionen.push(
      bauePosition({
        lookup: regel.mittelseite,
        menge: mittelseiten,
        bucket: 'korpus',
        herkunft: 'abgeleitet',
        hoeheCm: kontext.korpusHoeheCm,
        tiefeCm: kontext.bepreisteTiefeCm,
        pg,
        hinweis: hinweise.join(' '),
      }),
    )
  }

  if (regel.aussenset) {
    // Ohne ausdrückliches „keine" gilt: der Möbelblock wird seitlich abgeschlossen.
    const abschluss = draft.korpusGrunddaten?.abschlussSet
    const position = abschluss?.position
    if (position !== 'keine') {
      /*
       * PREISGRUPPE DES AUSSENSETS.
       *
       * Das Außenset IST die sichtbare Außenseite; sein Material wird im Schritt
       * „Material" unter „Abschlussset" gewählt — bei Bedarf links und rechts getrennt.
       * Deshalb steht diese Auswahl jetzt an erster Stelle.
       *
       * Bis zur Abschaffung des Bereichs „Korpus außen" wurde die Preisgruppe von dort
       * gelesen. Diese Kette bleibt als RÜCKFALL erhalten: Serien, die den Außenkorpus
       * weiterhin führen (Atrium, Velare, Publicum), und Refugium-Entwürfe, die vor der
       * Umstellung gespeichert wurden, behalten damit exakt ihren bisherigen Preis.
       */
      /*
       * Getrennt gewählt (links/rechts)? Dann gilt die TEUERSTE der beteiligten Seiten —
       * Überarbeitung 8, S. 4: „Abschlussset links in PG3, rechts in PG2 >> Das Abschlussset
       * soll dann immer in der teuersten Preisgruppe gerechnet werden." Beteiligt ist nur,
       * was die Position auch hat: bei „nur links" zählt die rechte Auswahl nicht.
       */
      const getrenntePgs = abschluss?.materialGetrennt
        ? [
            position !== 'rechts' ? pgVon(abschluss.materialLinks) : undefined,
            position !== 'links' ? pgVon(abschluss.materialRechts) : undefined,
          ]
        : []
      const getrenntPg = hoechstePreisgruppe(getrenntePgs)
      const aussenPg =
        getrenntPg ??
        pgVon(abschluss?.material) ??
        pgVon(abschluss?.materialLinks) ??
        pgVon(abschluss?.materialRechts) ??
        pgVon(draft.korpus?.aussen) ??
        pgVon(draft.korpus?.aussenLinks) ??
        pgVon(draft.korpus?.aussenRechts)
      if (!aussenPg) {
        meldungen.push({
          schwere: 'fehler',
          text: 'Für das Außenset fehlt die Preisgruppe – bitte im Schritt „Material" das Material des Abschlusssets festlegen.',
        })
      }
      positionen.push(
        bauePosition({
          lookup: regel.aussenset,
          menge: 1,
          bucket: 'aussenset',
          herkunft: 'abgeleitet',
          hoeheCm: kontext.korpusHoeheCm,
          pg: aussenPg,
          hinweis: [
            'Automatisch ergänzt: schließt den Möbelblock seitlich ab. Trägt die Oberfläche des Möbels nach außen — der Korpus selbst ist nur in Decoboard lieferbar.',
            getrenntPg && new Set(getrenntePgs.filter(Boolean)).size > 1
              ? `Links und rechts in verschiedenen Materialien: gerechnet in der teuersten Preisgruppe ${pgText(getrenntPg)} (${getrenntePgs.map((p) => (p ? pgText(p) : '—')).join(' / ')}).`
              : null,
          ]
            .filter(Boolean)
            .join(' '),
        }),
      )
    }
  }

  return positionen
}

// ---------------------------------------------------------------------------
// Stufe 4b: Fronten
// ---------------------------------------------------------------------------

function frontMaterialPg(el: FrontElement): PriceGroup | undefined {
  const werte = el.fieldValues ?? {}
  for (const key of ['material', 'glas']) {
    const pg = werte[key]?.material?.priceGroup
    if (pg) return pg
  }
  for (const wert of Object.values(werte)) {
    if (wert?.material?.priceGroup) return wert.material.priceGroup
  }
  return undefined
}

function baueFrontPositionen(
  draft: Draft,
  kontext: KorpusKontext,
  meldungen: KalkMeldung[],
): KalkPosition[] {
  const positionen: KalkPosition[] = []

  ;(draft.fronts?.columns ?? []).forEach((spalte, spaltenIndex) => {
    const segment = spaltenIndex + 1
    const segmentBreite = kontext.breiten[spaltenIndex]

    /*
     * Überarbeitung 9: Passen die Fronten noch zum Korpus? Eine 70-cm-Tür im 50er Korpus,
     * eine 21-Raster-Tür im 18-Raster-Korpus oder ein Türpaar, das nach einer Änderung der
     * Korpusbreite nicht mehr passt, wird nicht stillschweigend weiter bepreist — der
     * Befund ist ein FEHLER und nimmt der Kalkulation die Verbindlichkeit. Die Regeln stehen
     * in `lib/frontGeometrie.ts`, dieselben wie im Fronten-Schritt.
     */
    const geo = segmentGeometrie(draft.korpusGrunddaten, draft.seriesId, spaltenIndex)
    for (const befund of pruefeSpalte(spalte, geo)) {
      meldungen.push({ schwere: 'fehler', text: `Segment ${segment}: ${befund}` })
    }

    spalte.elements.forEach((el) => {
      const lookup = frontLookups[el.typeId]
      if (!lookup) return // „Offen (Regal)" u. Ä. – bewusst keine Preisposition.

      const breiteCm = zahl(el.widthCm) ?? segmentBreite
      const hoeheCm = zahl(el.heightCm)
      const pg = frontMaterialPg(el)
      const liniePg = liniePgAchsenwert(el.styleLineId, pg)
      const bezeichnung = getArtikelNr(lookup.artikel)?.bezeichnung ?? lookup.artikel

      if (breiteCm == null) {
        meldungen.push({
          schwere: 'fehler',
          text: `Segment ${segment}, „${el.label || bezeichnung}": keine Breite erfasst – nicht kalkulierbar.`,
        })
        return
      }

      /*
       * HÖHE DER FRONT.
       *
       * Vor der Achsen-Reform musste hier aus der Zentimeterhöhe eine Rasterstufe
       * gerechnet werden, weil die Preiszeilen nach Rastern geschlüsselt waren. Heute
       * trägt die Höhenachse ihre Zentimeter selbst und rundet auf — die erfasste Höhe
       * geht unverändert in den Lookup.
       *
       * Die Rasterrechnung bleibt trotzdem stehen, aber nur noch für den HINWEIS: Der
       * Berater soll sehen, dass seine 173 cm mit der Stufe 15 R bepreist wurden.
       */
      let hoeheFuerLookup: number | undefined
      let rasterHinweis: string | undefined
      if (lookup.nutztHoehe) {
        if (el.typeId === 'schuebe') {
          // Schübe sind nach Schubhöhe geschlüsselt, nicht nach Fronthöhe.
          hoeheFuerLookup = schubHoeheCm(hoeheCm)
        } else if (hoeheCm == null) {
          meldungen.push({
            schwere: 'fehler',
            text: `Segment ${segment}, „${el.label || bezeichnung}": keine Höhe erfasst – nicht kalkulierbar.`,
          })
          return
        } else {
          hoeheFuerLookup = hoeheCm
          const aufloesung = loeseRasterAuf(hoeheCm, meta.frontOffsetMm, verfuegbareRaster(lookup.artikel))
          if (aufloesung.bepreistesRaster != null && (aufloesung.angehoben || aufloesung.istSondermass)) {
            rasterHinweis = `Höhe ${hoeheCm} cm (rechnerisch ${aufloesung.raster} R) → bepreist mit ${aufloesung.bepreistesRaster} R.`
          }
        }
      }

      positionen.push(
        bauePosition({
          lookup,
          menge: 1,
          bucket: 'fronten',
          herkunft: 'gewaehlt',
          zusatz: el.label || undefined,
          segment,
          breiteCm,
          hoeheCm: hoeheFuerLookup,
          tiefeCm: kontext.tiefeCm,
          liniePg,
          pg,
          hinweis: rasterHinweis,
        }),
      )

      // Griff als eigene Position — aber NUR, wenn er nicht ohnehin im Frontpreis steckt.
      // Ein Stückgriff gehört laut Preisliste zur Tür; ihn zusätzlich zu berechnen, hieße
      // ihn doppelt zu verkaufen. Die Entscheidung trifft `griffImFrontpreisEnthalten`
      // anhand der Preislogik des Artikels, nicht anhand seiner Nummer.
      if (el.griff && el.griffId) {
        const griffArtikel = griffArtikelnummer(el.griffId)
        const stamm = griffArtikel ? getArtikelNr(griffArtikel) : undefined
        if (griffArtikel && !griffImFrontpreisEnthalten(stamm)) {
          // Edge (€ je laufendem Meter): Länge = Türhöhe, Vorgabe Cramer vom 23.09.2026
          // (`grifflaengeCm`). Ein Stückpreis-Griff braucht keine Länge und ignoriert sie.
          const laengeCm = grifflaengeCm(el.typeId, hoeheCm)
          positionen.push(
            bauePosition({
              lookup: { artikel: griffArtikel },
              menge: 1,
              bucket: 'upgrade',
              herkunft: 'gewaehlt',
              segment,
              laengeCm,
              hinweis:
                [
                  el.label ? `zu „${el.label}"` : null,
                  laengeCm != null ? `Grifflänge = Türhöhe ${cmText(laengeCm)} cm.` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined,
              grundOhneMass:
                'Grifflänge nur für Dreh- und Schiebetüren festgelegt (= Türhöhe) — an Schüben und Klappen auf Anfrage.',
            }),
          )
        }
      }
    })
  })

  return positionen
}

/**
 * Griff-ID des Konfigurators → Artikelnummer.
 *
 * Der Katalog in `config/handles.ts` führt IDs wie `nr127`; der Stamm führt sie als
 * Artikel des Dropdowns GRIFF. Die Zuordnung läuft über die Nummer im Namen, damit ein
 * neuer Griff in der Mappe ohne Code-Änderung gefunden wird.
 *
 * Bis 09/2026 suchte diese Funktion noch im alten Vier-Block-Schema (`30-30-05-…`) und
 * fand deshalb keinen einzigen Griff — der Edge-Griff (40 €/lfm) blieb unbemerkt ohne
 * Preis. Seitdem über das Dropdown, unabhängig vom Nummernschema.
 */
function griffArtikelnummer(griffId: string): string | undefined {
  const nummer = /^nr(\d+)$/i.exec(griffId)?.[1]
  const stamm = artikelImDropdown('GRIFF')
  if (nummer) {
    const treffer = stamm.find((a) => new RegExp(`\\bNr\\.\\s*${nummer}\\b`, 'i').test(a.bezeichnung))
    if (treffer) return treffer.artikelnummer
  }
  if (griffId === 'edge') return stamm.find((a) => /edge/i.test(a.bezeichnung))?.artikelnummer
  return undefined
}

// ---------------------------------------------------------------------------
// Stufe 4c: Innenausstattung
// ---------------------------------------------------------------------------

/**
 * ZÄHLT EIN ERFASSTES AUSSTATTUNGSTEIL NOCH?
 *
 * Überarbeitung 6, S. 1: „Wenn ich Ausstattungselemente aus der Planung wieder entferne,
 * werden sie nicht in der Kalkulation gelöscht … Der Preis passt sich also nicht an."
 *
 * Ursache: Die Vorauswahl (Schritt 6) und die Erfassung je Segment (Schritt 8) sind zwei
 * getrennte Stellen im Entwurf. Wird eine Option in Schritt 6 abgewählt, verschwindet sie
 * aus der Oberfläche von Schritt 8 — das bereits erfasste Teil blieb aber im Entwurf
 * stehen und wurde weiter bepreist. Sichtbar war es nirgends mehr, bezahlt schon.
 *
 * Zwei Bedingungen, beide notwendig:
 *   1. Die Option gibt es im Katalog noch (z. B. NICHT mehr die Verblendung, die mit
 *      Überarbeitung 6 in den Schritt „Maße" gewandert ist).
 *   2. Sie steht in der Vorauswahl. Fehlt die Vorauswahl ganz (Altbestand, andere
 *      Serien), wird NICHT gefiltert — eine Regel ohne Datengrundlage darf nichts
 *      wegrechnen.
 */
function istAusstattungAktiv(draft: Draft, optionId: string): boolean {
  if (!getEquipmentOption(optionId)) return false
  const vorauswahl = draft.ausstattung?.selected
  if (!Array.isArray(vorauswahl)) return true
  return vorauswahl.includes(optionId)
}

/**
 * Menge eines Ausstattungsteils.
 *
 * Bei Optionen, deren Position über die Schrankseiten erfasst wird (LED-Band), ist die
 * Seitenwahl zugleich die Stückzahl. Überarbeitung 6, S. 8: „Wenn links + rechts
 * ausgewählt wird, muss VK mal 2 gerechnet werden. Da links und rechts ein LED-Band
 * verbaut wird. Bei 18 Raster also mit 1000 € statt 500 €." Der Artikel ist mit der
 * Einheit „EUR/Schrankseite" genau so geschlüsselt.
 *
 * Ohne Seitenangabe (Altbestand) bleibt die erfasste Menge maßgeblich — ein Entwurf,
 * in dem jemand die 2 von Hand eingetragen hat, darf sich nicht still halbieren.
 */
function mengeFuerAusstattung(item: SegmentEquipmentItem, option: EquipmentOption | undefined): number {
  if (option?.positionSeiten && item.seiten) {
    return item.seiten.links && item.seiten.rechts ? 2 : 1
  }
  return item.qty ?? 1
}

function baueAusstattungsPositionen(
  draft: Draft,
  kontext: KorpusKontext,
  meldungen: KalkMeldung[],
): KalkPosition[] {
  const positionen: KalkPosition[] = []
  const entfernt = new Set<string>()
  const ohnePg = new Set<string>()

  ;(draft.fronts?.columns ?? []).forEach((spalte, spaltenIndex) => {
    const segment = spaltenIndex + 1
    const segmentBreite = kontext.breiten[spaltenIndex]
    const innenPg = innenPgFuerKorpus(draft, spaltenIndex)

    ;(spalte.equipment ?? []).forEach((item) => {
      const option = getEquipmentOption(item.optionId)
      const label = option?.label ?? item.optionId

      // Aus der Planung entfernt ⇒ auch aus der Kalkulation.
      if (!istAusstattungAktiv(draft, item.optionId)) {
        entfernt.add(equipmentAnzeigename(item.optionId))
        return
      }

      const menge = mengeFuerAusstattung(item, option)

      // Container: die Variante bestimmt Artikel bzw. Rasterstufe.
      const varianten = containerLookups[item.optionId]
      const lookup = varianten
        ? item.variant
          ? varianten[item.variant]
          : undefined
        : ausstattungLookups[item.optionId]

      if (!lookup) {
        positionen.push({
          id: naechsteId(),
          herkunft: 'gewaehlt',
          bucket: 'innen',
          segment,
          label,
          achsen: [],
          teile: [],
          menge,
          einzelpreis: null,
          gesamt: null,
          status: 'auf-anfrage',
          hinweis: varianten
            ? `Für die Variante „${item.variant ?? '—'}" ist keine Zuordnung hinterlegt (config/preisMapping.ts).`
            : 'Keine Preiszuordnung hinterlegt (config/preisMapping.ts) – AV-Prüfung.',
        })
        return
      }

      /*
       * DECKPLATTE DES CONTAINERS.
       *
       * Seit der Varianten-Migration ist die Ausführung (Decoboard/Rauchglas) kein
       * Achsenwert mehr, sondern ein eigener Artikel — jeder trägt seinen vollständigen
       * Preis. `artikelBeiAuswahl` nennt den Artikel für die angehakte Rauchglas-Option;
       * ohne Häkchen bleibt es beim Decoboard-Artikel aus `lookup.artikel`.
       */
      const aufgeloesterLookup: BauteilLookup =
        item.rauchglas && lookup.artikelBeiAuswahl
          ? { ...lookup, artikel: lookup.artikelBeiAuswahl }
          : lookup

      /*
       * HÖHE DES AUSSTATTUNGSTEILS.
       *
       * Zwei verschiedene Höhen kommen hier zusammen, und sie zu verwechseln kostet Geld:
       *
       *   • Teile, die nach KORPUSHÖHENKLASSE bepreist sind (LED-Band je Schrankseite) —
       *     ihre Höhe ist die des Korpus, nicht ihre eigene.
       *   • Teile mit eigener BAUHÖHE (Container, Innenschublade) — sie steht in der
       *     gewählten Variante („4,5R", „1,5R"), NICHT in der Einbauhöhe im Schrank.
       *     Vor Überarbeitung 2_2 wurde sie aus dem Freitext der Einbauhöhe geraten;
       *     „auf 120 cm" ergab damit die teuerste Stufe.
       *
       * Die Zentimeter zu einem Raster-Etikett stehen in den Preiszeilen des Artikels —
       * genau deshalb, weil 4,5 Raster beim Container und beim Korpus verschiedene Maße
       * sind (`hoeheFuerRasterEtikett`).
       */
      const rasterDesTeils =
        containerRaster[item.variant ?? ''] ?? rasterAusVariante(item.variant) ?? undefined
      const hoeheCmFuerTeil = aufgeloesterLookup.hoeheAusKorpus
        ? kontext.korpusHoeheCm ?? kontext.hoeheCm
        : rasterDesTeils != null
          ? hoeheFuerRasterEtikett(aufgeloesterLookup.artikel, rasterDesTeils)
          : schubHoeheCm(zahl(item.heightNote))

      // Die Preisgruppe kommt aus der Innenausführung — der Berater wählt sie nie.
      // Fehlt sie (z. B. Innenmaterial „anders" ohne erkennbare Preisgruppe), wird das
      // gemeldet statt still auf PG 1 zurückzufallen: ein zu billig ausgewiesenes
      // Möbel fällt erst in der Auftragsprüfung auf, und dann ist es verkauft.
      if (aufgeloesterLookup.nutztPg && innenPg == null) ohnePg.add(label)

      const hinweise = [
        aufgeloesterLookup.hoeheAusKorpus ? 'Bepreist nach Korpushöhenklasse, je Schrankseite.' : null,
        aufgeloesterLookup.nutztPg && innenPg
          ? `Preisgruppe ${innenPg.replace('PG', 'PG ')} aus der Innenausführung des Korpus.`
          : null,
        // Überarbeitung 8, S. 5: Die Tiefe wählt die Atrium-Bodenpreise (S. 13 / 14 / 15).
        aufgeloesterLookup.nutztTiefe && kontext.bepreisteTiefeCm != null
          ? `Tiefenstufe ${kontext.bepreisteTiefeCm} cm.`
          : null,
      ].filter(Boolean)

      positionen.push(
        baueMitKomponenten({
          lookup: aufgeloesterLookup,
          menge,
          bucket: 'innen',
          herkunft: 'gewaehlt',
          label,
          segment,
          breiteCm: segmentBreite,
          hoeheCm: hoeheCmFuerTeil,
          tiefeCm: kontext.bepreisteTiefeCm,
          pg: innenPg,
          hinweis: hinweise.length ? hinweise.join(' ') : undefined,
        }),
      )

    })
  })

  // Korpusweite Innenausstattung ohne Segmentbezug.
  const innen = draft.korpusInnen
  if (innen?.einlegeboeden?.enabled) {
    const anzahl = zahl(innen.einlegeboeden.anzahl)
    if (anzahl && anzahl > 0) {
      positionen.push(
        bauePosition({
          lookup: ausstattungLookups.einlegeboden,
          menge: anzahl,
          bucket: 'innen',
          herkunft: 'gewaehlt',
          label: 'Einlegeboden (Korpus Innen)',
          breiteCm: kontext.breiten[0],
          // Seit Überarbeitung 8 führt der Boden Tiefe und Preisgruppe als Achsen.
          tiefeCm: kontext.bepreisteTiefeCm,
          pg: innenPgFuerKorpus(draft, 0),
          hinweis:
            kontext.breiten.length > 1
              ? 'Korpusweite Angabe ohne Segmentbezug – bepreist mit der Breite von Segment 1. Für eine exakte Kalkulation je Segment erfassen.'
              : undefined,
        }),
      )
    }
    if (innen.einlegeboeden.kleiderstange?.enabled) {
      meldungen.push({
        schwere: 'info',
        text: 'Kleiderstange ist im Korpus-Innenausbau aktiv, aber ohne Menge – bitte je Segment erfassen, damit sie kalkuliert werden kann.',
      })
    }
  }

  if (ohnePg.size > 0) {
    meldungen.push({
      schwere: 'warnung',
      text: `Für die Innenausführung ist keine Preisgruppe hinterlegt – bei ${[...ohnePg].join(', ')} ist der Aufpreis damit nicht ermittelbar. Bitte das Innenmaterial im Schritt „Material" festlegen oder die Preisgruppe der Oberfläche in der Verwaltung ergänzen.`,
    })
  }

  // Sichtbar machen, was nicht mehr mitgerechnet wird: Ein Preis, der ohne erkennbaren
  // Grund sinkt, ist im Kundengespräch so unangenehm wie einer, der zu hoch steht.
  if (entfernt.size > 0) {
    meldungen.push({
      schwere: 'info',
      text: `Nicht mehr bepreist, weil in der Ausstattungs-Vorauswahl abgewählt oder nicht mehr im Katalog: ${[...entfernt].join(', ')}.`,
    })
  }

  return positionen
}

// ---------------------------------------------------------------------------
// Stufe 5 + 6: Aufschläge und nachgelagerte Zuschläge
// ---------------------------------------------------------------------------

/**
 * ZWEI STUFEN — in genau dieser Reihenfolge.
 *
 *   Artikel und Ausstattung        Σ aller Positionen                    = Möbelpreis
 *   + artikelbezogene Aufschläge   Raumteiler, Sichtrückwand — je auf den Möbelpreis
 *   = GESAMTMÖBELPREIS
 *   + Montage                      % auf den Gesamtmöbelpreis   ┐ unabhängig voneinander,
 *   + Lieferung regional           % auf den Gesamtmöbelpreis   ┘ nie aufeinander
 *   = Gesamtpreis inkl. Montage und Lieferung
 *
 * Satz (bzw. Betrag), Einheit und Preisbasis stehen im jeweiligen ARTIKEL (Preisart
 * „Aufschlag") und sind in der Artikelverwaltung pflegbar; `config/preisMapping.ts` sagt
 * nur, welches Häkchen welchen Artikel auslöst. Jeder Aufschlag rechnet auf GENAU EINE
 * Basis und kommt genau einmal vor — nichts wird doppelt oder verzinst gerechnet.
 *
 * Ein gesperrter, als Entwurf markierter oder unvollständig gepflegter Aufschlag-Artikel
 * wird nicht geschätzt: Die Zeile steht „auf Anfrage" und nimmt der Kalkulation die
 * Verbindlichkeit — wie jede andere Position ohne Preis.
 */
function baueAufschlag(
  artikelnummer: string,
  art: ZuschlagArt,
  stufe: ZuschlagStufe,
  basisBetrag: number,
  erwarteteBasis: AufschlagBasis,
): KalkPosition {
  const a = getArtikelNr(artikelnummer)
  const basisTitel = AUFSCHLAG_BASIS_KATALOG[erwarteteBasis].titel
  const gemeinsam = {
    id: naechsteId(),
    herkunft: 'zuschlag' as const,
    bucket: 'upgrade' as const,
    zuschlagArt: art,
    zuschlagStufe: stufe,
    artikelnummer,
    kurzzeichen: a?.kurzzeichen,
    teileart: a?.teileart,
    dropdown: a?.dropdown,
    einheit: a?.einheit,
    preisart: a ? preisartVon(a) : undefined,
    preislistenNr: a?.preislistenNr || undefined,
    achsen: [],
    menge: 1,
  }
  const offen = (label: string, grund: string): KalkPosition => ({
    ...gemeinsam,
    label,
    teile: [],
    einzelpreis: null,
    gesamt: null,
    status: 'auf-anfrage',
    hinweis: grund,
  })

  if (!a) return offen(artikelnummer, `Aufschlag-Artikel ${artikelnummer} steht nicht im Stamm.`)
  if (a.status !== 'aktiv') return offen(a.bezeichnung, `Artikel ${a.artikelnummer} ist ${a.status} — kein Aufschlag berechnet.`)
  if (gemeinsam.preisart !== 'AUFSCHLAG') {
    return offen(a.bezeichnung, `Artikel ${a.artikelnummer} trägt nicht die Preisart „Aufschlag".`)
  }
  const def = aufschlagVon(a)
  if (!def) return offen(a.bezeichnung, `Für ${a.artikelnummer} sind Satz, Einheit oder Preisbasis nicht vollständig gepflegt.`)
  if (def.basis !== erwarteteBasis) {
    return offen(
      a.bezeichnung,
      `Preisbasis „${AUFSCHLAG_BASIS_KATALOG[def.basis].titel}" passt nicht — dieser Aufschlag rechnet auf den ${basisTitel}.`,
    )
  }

  const betrag = def.einheit === '%' ? runde2((basisBetrag * def.wert) / 100) : runde2(def.wert)
  const satz = aufschlagText(def)
  return {
    ...gemeinsam,
    // „Montage (10 %)" · „Raumteiler (5 %)" · „Beispiel (25,00 €)"
    label: `${a.bezeichnung} (${satz})`,
    teile: [{ menge: 1, mengeText: '1', preis: betrag, preisEinheit: '€', gesamt: betrag }],
    einzelpreis: betrag,
    gesamt: betrag,
    status: 'berechnet',
    hinweis:
      def.einheit === '%'
        ? `${satz} auf den ${basisTitel} ${formatEuro(basisBetrag)}`
        : `Betrag ${satz}, einmal je Möbel (zum ${basisTitel})`,
  }
}

/**
 * Montage und Lieferung sind STANDARDMÄSSIG AN. Nur ein ausdrückliches `false` im Entwurf
 * schaltet sie ab — ein Entwurf ohne `pricingOptions` (jeder neue, und alle älteren, die
 * die Checkboxen nie gesehen haben) rechnet beide mit.
 */
export function preisOptionen(draft: Draft): { montage: boolean; lieferungRegional: boolean } {
  return {
    montage: draft.pricingOptions?.montage ?? true,
    lieferungRegional: draft.pricingOptions?.lieferungRegional ?? true,
  }
}

/** Prozent lesbar: 0.1 → „10", 0.035 → „3,5". */
export function prozentText(pct: number): string {
  return String(runde2(pct * 100)).replace('.', ',')
}

const summe = (liste: KalkPosition[]) => runde2(liste.reduce((s, p) => s + (p.gesamt ?? 0), 0))

// ---------------------------------------------------------------------------
// Einstiegspunkt
// ---------------------------------------------------------------------------

/**
 * Berechnet einen Entwurf vollständig.
 *
 * Fehlt eine Preiszeile, wird die Position mit Status „auf Anfrage" ausgewiesen —
 * niemals geraten und niemals stillschweigend weggelassen. Solange eine solche Position
 * existiert, ist `vollstaendig === false` und der Preis nicht verbindlich.
 */
export function berechneEntwurf(draft: Draft): KalkErgebnis {
  lfd = 0
  const meldungen: KalkMeldung[] = []
  const regel = getSerienRegel(draft.seriesId)

  const leer = (text: string): KalkErgebnis => ({
    positionen: [],
    artikelAufschlaege: [],
    serviceZuschlaege: [],
    serviceAuswahl: [],
    zuschlaege: [],
    moebelpreis: 0,
    summeArtikelAufschlaege: 0,
    gesamtmoebelpreis: 0,
    gesamt: 0,
    meldungen: [{ schwere: 'fehler', text }],
    offenePositionen: 0,
    vollstaendig: false,
    gueltigkeit: meta.gueltigkeit,
    waehrung: meta.waehrung,
  })

  if (!regel) return leer('Keine Serie gewählt – Kalkulation nicht möglich.')

  if (!regel.korpus) {
    meldungen.push({
      schwere: 'warnung',
      text: `Für die Serie ${draft.seriesId} sind noch keine Bauteil-Zuordnungen hinterlegt (config/preisMapping.ts). Die Kalkulation bleibt unvollständig.`,
    })
  }
  regel.hinweise?.forEach((text) => meldungen.push({ schwere: 'info', text }))

  const kontext = leseKorpusKontext(draft, regel, meldungen)
  const positionen = [
    ...baueKorpusPositionen(draft, regel, kontext, meldungen),
    ...baueFrontPositionen(draft, kontext, meldungen),
    ...baueAusstattungsPositionen(draft, kontext, meldungen),
  ]

  // --- Stufe 1: Möbelpreis und artikelbezogene Aufschläge --------------------------
  const moebelpreis = summe(positionen)
  const artikelAufschlaegeListe = artikelAufschlaege
    .filter((eintrag) => Boolean(draft[eintrag.ausloeser]))
    .map((eintrag) => baueAufschlag(eintrag.artikel, eintrag.art, 'artikel', moebelpreis, 'MOEBELPREIS'))
  const summeArtikelAufschlaege = summe(artikelAufschlaegeListe)
  const gesamtmoebelpreis = runde2(moebelpreis + summeArtikelAufschlaege)

  // --- Stufe 2: Montage und Lieferung auf den Gesamtmöbelpreis ---------------------
  const optionen = preisOptionen(draft)
  const serviceAuswahl: ServiceAuswahl[] = serviceZuschlaege.map((eintrag) => ({
    art: eintrag.art,
    option: eintrag.option,
    aktiv: optionen[eintrag.option],
    position: baueAufschlag(eintrag.artikel, eintrag.art, 'service', gesamtmoebelpreis, 'GESAMTMOEBELPREIS'),
  }))
  const serviceListe = serviceAuswahl.filter((s) => s.aktiv).map((s) => s.position)
  const gesamt = runde2(gesamtmoebelpreis + summe(serviceListe))

  const zuschlaege = [...artikelAufschlaegeListe, ...serviceListe]
  const offenePositionen =
    positionen.filter((p) => p.status !== 'berechnet').length +
    zuschlaege.filter((p) => p.status !== 'berechnet').length
  const hatFehler = meldungen.some((m) => m.schwere === 'fehler')

  if (positionen.length === 0) {
    meldungen.push({
      schwere: 'warnung',
      text: 'Noch keine kalkulierbaren Positionen – Korpus-Grunddaten und Fronten erfassen.',
    })
  }
  const offeneZuschlaege = zuschlaege.filter((p) => p.status !== 'berechnet')
  for (const z of offeneZuschlaege) {
    meldungen.push({ schwere: 'warnung', text: `${z.label}: ${z.hinweis ?? 'kein Aufschlag berechnet'}` })
  }
  if (offenePositionen > 0) {
    meldungen.push({
      schwere: 'warnung',
      text: `${offenePositionen} Position(en) ohne Preis – Angebot nur unter Vorbehalt, AV-Prüfung erforderlich.`,
    })
  }

  return {
    positionen,
    artikelAufschlaege: artikelAufschlaegeListe,
    serviceZuschlaege: serviceListe,
    serviceAuswahl,
    zuschlaege,
    moebelpreis,
    summeArtikelAufschlaege,
    gesamtmoebelpreis,
    gesamt,
    meldungen,
    offenePositionen,
    vollstaendig: !hatFehler && offenePositionen === 0 && positionen.length > 0,
    gueltigkeit: meta.gueltigkeit,
    waehrung: meta.waehrung,
  }
}
