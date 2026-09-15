/**
 * KALKULATIONS-ENGINE — aus einem Entwurf wird eine bepreiste Positionsliste.
 *
 * Ablauf (7 Stufen, bewusst in dieser Reihenfolge):
 *
 *   1. NORMALISIEREN   cm-Maße → Rasterstufen und Breiten-Brackets (aufgerundet)
 *   2. ABLEITEN        Mittelseiten und Außenset ergänzen – der Berater wählt sie nie,
 *                      sie folgen aus dem Aufbau
 *   3. PRÜFEN          Plausibilität, Sondermaße, fehlende Angaben
 *   4. BEPREISEN       je Position ein Lookup über die Artikelnummer; kein Treffer ⇒
 *                      „auf Anfrage", niemals geraten
 *   5. MÖBELPREIS      Summe aller Bauteil-Positionen
 *   6. ZUSCHLÄGE       gestuft: erst % auf den Möbelpreis, dann % auf die Auftragssumme
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
  ausstattungLookups,
  ausstattungOhnePreis,
  containerLookups,
  CONTAINER_RAUCHGLAS_ARTIKEL,
  containerRaster,
  rauchglasAufpreisIndex,
  rasterAusVariante,
  frontLookups,
  getSerienRegel,
  griffImFrontpreisEnthalten,
  liniePgAchsenwert,
  prozentZuschlaege,
  schubRasterFuerHoehe,
  verblendungLookups,
  type BauteilLookup,
  type SerienRegel,
} from '../config/preisMapping.ts'
import { meta } from '../data/stammdaten.generated.ts'
import { resolveDepthCm, resolveHeightCm, resolveKorpusBreiteCm } from './korpusMass.ts'
import {
  findePreis,
  getArtikelNr,
  verfuegbareRaster,
  verfuegbareTiefen,
  type AufgelloesteAchse,
} from './preisLookup.ts'
import { getPreisListe } from './stammdatenStore.ts'
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
} from '../types/index.ts'

// Beide Aufzählungen liegen zentral in `types/index.ts`, weil der Preis-Snapshot
// (eingefrorene Aufträge) dieselben Werte trägt. Re-Export, damit bestehende
// Importe aus diesem Modul unverändert weiterlaufen.
export type { PositionsHerkunft, PositionsStatus }

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
}

export type Schwere = 'fehler' | 'warnung' | 'info'

export interface KalkMeldung {
  schwere: Schwere
  text: string
}

export interface KalkErgebnis {
  positionen: KalkPosition[]
  zuschlaege: KalkPosition[]
  /** Summe der Bauteil-Positionen (ohne Zuschläge). */
  moebelpreis: number
  /** Möbelpreis + alle Zuschläge. */
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

/** Preiszeilen eines Artikels aus dem Arbeitsstand — in der Reihenfolge der Mappe. */
function preiseFuerArtikel(artikelnummer: string) {
  return getPreisListe().filter((z) => z.artikel === artikelnummer)
}

/** Erwartete Zeilenzahl des Rauchglas-Aufpreises (50er · 60er · 100er). */
const RAUCHGLAS_ZEILEN = 3

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
  menge: number
  bucket: PriceBucket
  herkunft: PositionsHerkunft
  /** Überschreibt die Artikelbezeichnung (z. B. „Korpus 1"). */
  label?: string
  /** Zusatz hinter der Bezeichnung, z. B. die Kennzeichnung „D1". */
  zusatz?: string
  segment?: number
  breiteCm?: number
  tiefeCm?: number
  raster?: number
  liniePg?: string
  pg?: PriceGroup
  variante?: string
  hinweis?: string
}

function bauePosition(eingabe: PositionsEingabe): KalkPosition {
  const { lookup } = eingabe
  const stamm = getArtikelNr(lookup.artikel)

  const ergebnis = findePreis({
    artikelnummer: lookup.artikel,
    // Bei Mittelseite/Außenset steht die Rasterstufe in der Breitenspalte.
    breiteCm: lookup.rasterInBreite ? eingabe.raster : eingabe.breiteCm,
    raster: lookup.nutztRaster ? eingabe.raster : undefined,
    liniePg: lookup.nutztLiniePg ? eingabe.liniePg : undefined,
    pg: lookup.nutztPg ? eingabe.pg : undefined,
    tiefeCm: lookup.nutztTiefe ? eingabe.tiefeCm : undefined,
    variante: eingabe.variante,
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
    menge: eingabe.menge,
  }

  if (ergebnis.status === 'auf-anfrage') {
    return {
      ...gemeinsam,
      achsen: [],
      einzelpreis: null,
      gesamt: null,
      status: 'auf-anfrage',
      hinweis: [eingabe.hinweis, ergebnis.grund].filter(Boolean).join(' — ') || undefined,
    }
  }

  const hinweise = [eingabe.hinweis]
  if (ergebnis.aufgerundet && ergebnis.gewaehlteBreite) {
    hinweise.push(`Sondermaß: bepreist mit dem nächstgrößeren Maß ${ergebnis.gewaehlteBreite}.`)
  }

  return {
    ...gemeinsam,
    achsen: ergebnis.achsen,
    seite: ergebnis.zeile.seite,
    einzelpreis: ergebnis.preis,
    gesamt: runde2(ergebnis.preis * eingabe.menge),
    status: 'berechnet',
    hinweis: hinweise.filter(Boolean).join(' ') || undefined,
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
  bepreistesRaster?: number
  rasterHinweis?: string
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
  const bepreisteTiefe =
    kontext.tiefeCm != null && tiefenStufen.length > 0
      ? tiefenStufen.find((t) => t >= kontext.tiefeCm! - 0.001)
      : undefined
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
        raster: kontext.bepreistesRaster,
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
      const lfm = verblendung.lfm?.trim()
      const teile = [
        `Verblendung ${verblendung.art === 'korpusbuendig' ? 'korpusbündig' : 'frontbündig'} — einmal je Möbel.`,
        verblendung.positionNote?.trim() ? `Position: ${verblendung.positionNote.trim()}.` : null,
        // Der Artikel ist nach laufendem Meter bepreist, die Menge steht aber weiterhin
        // auf 1: Ob die Laufmeter den Preis vervielfachen, ist mit Cramer noch nicht
        // geklärt. Solange das offen ist, wird der erfasste Wert AUSGEWIESEN statt still
        // eingerechnet — ein stillschweigend multiplizierter Preis wäre nicht prüfbar.
        lfm
          ? `Erfasst: ${lfm} lfm. Der Betrag ist der Preis je laufendem Meter und wird derzeit NICHT mit den Laufmetern multipliziert – bitte in der AV prüfen.`
          : 'Ohne Laufmeter-Angabe – der Betrag ist der Preis je laufendem Meter.',
      ].filter(Boolean)
      positionen.push(
        bauePosition({
          lookup,
          menge: 1,
          bucket: 'korpus',
          herkunft: 'gewaehlt',
          hinweis: teile.join(' '),
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
    positionen.push(
      bauePosition({
        lookup: regel.mittelseite,
        menge: mittelseiten,
        bucket: 'korpus',
        herkunft: 'abgeleitet',
        raster: kontext.bepreistesRaster,
        hinweis:
          regel.mittelseitenRegel === 'abschluss'
            ? `Automatisch ergänzt: Jeder der ${segmente} Korpi bringt seine linke Seite mit — nötig ist nur die Wand, die den Block rechts abschließt.`
            : `Automatisch ergänzt: ${segmente} Segmente erfordern ${mittelseiten} Mittelseite(n).`,
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
      const aussenPg =
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
          raster: kontext.bepreistesRaster,
          pg: aussenPg,
          hinweis:
            'Automatisch ergänzt: schließt den Möbelblock seitlich ab. Trägt die Oberfläche des Möbels nach außen — der Korpus selbst ist nur in Decoboard lieferbar.',
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

      // Rasterstufe nur dort ermitteln, wo die Preistabelle eine Rasterachse führt.
      let raster: number | undefined
      let rasterHinweis: string | undefined
      if (lookup.nutztRaster) {
        if (el.typeId === 'schuebe') {
          // Schübe sind nach Schubhöhe geschlüsselt, nicht nach Fronthöhen-Raster.
          raster = schubRasterFuerHoehe(hoeheCm)
        } else if (hoeheCm == null) {
          meldungen.push({
            schwere: 'fehler',
            text: `Segment ${segment}, „${el.label || bezeichnung}": keine Höhe erfasst – Rasterstufe nicht bestimmbar.`,
          })
          return
        } else {
          const verfuegbar = verfuegbareRaster(lookup.artikel)
          const aufloesung = loeseRasterAuf(hoeheCm, meta.frontOffsetMm, verfuegbar)
          if (aufloesung.bepreistesRaster == null) {
            meldungen.push({
              schwere: 'warnung',
              text: `Segment ${segment}, „${el.label || bezeichnung}": Höhe ${hoeheCm} cm liegt über der größten bepreisten Stufe – AV-Prüfung.`,
            })
          } else {
            raster = aufloesung.bepreistesRaster
            if (aufloesung.angehoben || aufloesung.istSondermass) {
              rasterHinweis = `Höhe ${hoeheCm} cm (rechnerisch ${aufloesung.raster} R) → bepreist mit ${aufloesung.bepreistesRaster} R.`
            }
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
          tiefeCm: kontext.tiefeCm,
          raster,
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
          positionen.push(
            bauePosition({
              lookup: { artikel: griffArtikel },
              menge: 1,
              bucket: 'upgrade',
              herkunft: 'gewaehlt',
              segment,
              hinweis: el.label ? `zu „${el.label}"` : undefined,
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
 * Artikel der Gruppe GRIFF. Die Zuordnung läuft über die Nummer im Namen, damit ein
 * neuer Griff in der Mappe ohne Code-Änderung gefunden wird.
 */
function griffArtikelnummer(griffId: string): string | undefined {
  const nummer = /^nr(\d+)$/i.exec(griffId)?.[1]
  const stamm = griffArtikel()
  if (nummer) {
    const treffer = stamm.find((a) => new RegExp(`\\bNr\\.\\s*${nummer}\\b`, 'i').test(a.bezeichnung))
    if (treffer) return treffer.artikelnummer
  }
  if (griffId === 'edge') return stamm.find((a) => /edge/i.test(a.bezeichnung))?.artikelnummer
  return undefined
}

let griffCache: ReturnType<typeof getArtikelNr>[] | null = null
function griffArtikel() {
  if (!griffCache) {
    // Lazy, damit der Stamm nur einmal durchlaufen wird.
    const alle: NonNullable<ReturnType<typeof getArtikelNr>>[] = []
    for (let i = 1; i <= 99; i++) {
      const nr = `30-30-05-${String(i).padStart(4, '0')}`
      const a = getArtikelNr(nr)
      if (a) alle.push(a)
    }
    griffCache = alle
  }
  return griffCache.filter((a): a is NonNullable<typeof a> => a != null)
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

      if (ausstattungOhnePreis.has(item.optionId)) {
        positionen.push({
          id: naechsteId(),
          herkunft: 'gewaehlt',
          bucket: 'innen',
          segment,
          label,
          achsen: [],
          menge,
          einzelpreis: null,
          gesamt: null,
          status: 'auf-anfrage',
          hinweis: 'Für diese Position ist im Preisblatt keine Zeile hinterlegt – AV-Prüfung.',
        })
        return
      }

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

      const breiteCm = lookup.breiteAusKorpushoehe ? kontext.hoeheCm : segmentBreite
      // Die Rasterstufe ist die BAUHÖHE des Teils (Container-/Schubladenhöhe), nicht seine
      // Einbauhöhe im Schrank — sie steht deshalb in der Variante. Nur wo keine Variante
      // gewählt ist, bleibt der Rückfall auf die alte Freitext-Höhe (Altbestand).
      const raster = lookup.nutztRaster
        ? (containerRaster[item.variant ?? ''] ??
            rasterAusVariante(item.variant) ??
            schubRasterFuerHoehe(zahl(item.heightNote)))
        : undefined

      // Die Preisgruppe kommt aus der Innenausführung — der Berater wählt sie nie.
      // Fehlt sie (z. B. Innenmaterial „anders" ohne erkennbare Preisgruppe), wird das
      // gemeldet statt still auf PG 1 zurückzufallen: ein zu billig ausgewiesenes
      // Möbel fällt erst in der Auftragsprüfung auf, und dann ist es verkauft.
      if (lookup.nutztPg && innenPg == null) ohnePg.add(label)

      const hinweise = [
        lookup.breiteAusKorpushoehe ? 'Bepreist nach Korpushöhenklasse, je Schrankseite.' : null,
        lookup.nutztPg && innenPg
          ? `Preisgruppe ${innenPg.replace('PG', 'PG ')} aus der Innenausführung des Korpus.`
          : null,
      ].filter(Boolean)

      positionen.push(
        bauePosition({
          lookup,
          menge,
          bucket: 'innen',
          herkunft: 'gewaehlt',
          label,
          segment,
          breiteCm,
          raster,
          pg: innenPg,
          variante: varianten && !lookup.nutztRaster ? undefined : undefined,
          hinweis: hinweise.length ? hinweise.join(' ') : undefined,
        }),
      )

      // Aufpreis Deckplatte in Rauchglas — eigene Position, sobald das Häkchen sitzt.
      if (item.rauchglas) {
        const index = rauchglasAufpreisIndex(breiteCm)
        const zeilen = preiseFuerArtikel(CONTAINER_RAUCHGLAS_ARTIKEL)
        const zeile = index != null && zeilen.length === RAUCHGLAS_ZEILEN ? zeilen[index] : undefined
        const stamm = getArtikelNr(CONTAINER_RAUCHGLAS_ARTIKEL)
        positionen.push({
          id: naechsteId(),
          herkunft: 'gewaehlt',
          bucket: 'innen',
          segment,
          label: `Aufpreis Deckplatte Rauchglas (${label})`,
          artikelnummer: CONTAINER_RAUCHGLAS_ARTIKEL,
          kurzzeichen: stamm?.kurzzeichen,
          teileart: stamm?.teileart,
          dropdown: stamm?.dropdown,
          einheit: stamm?.einheit,
          seite: zeile?.seite,
          achsen: [],
          menge,
          einzelpreis: zeile?.preis ?? null,
          gesamt: zeile?.preis == null ? null : runde2(zeile.preis * menge),
          status: zeile?.preis == null ? 'auf-anfrage' : 'berechnet',
          hinweis:
            zeile?.preis == null
              ? `Der Artikel ${CONTAINER_RAUCHGLAS_ARTIKEL} führt ${zeilen.length} Preiszeile(n) ohne Breiten-Achse — für ${breiteCm ?? '?'} cm ist keine eindeutige Stufe bestimmbar. AV-Prüfung.`
              : `Übergangslösung: Der Betrag folgt der Reihenfolge der Preiszeilen (50er · 60er · 100er), weil ${CONTAINER_RAUCHGLAS_ARTIKEL} in den Stammdaten noch keine BREITE-Achse trägt.`,
        })
      }
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
// Stufe 6: Zuschläge
// ---------------------------------------------------------------------------

/** Prozentsatz eines Zuschlag-Artikels aus dem Preisblatt (z. B. 10 ⇒ 10 %). */
function zuschlagsProzent(artikelnummer: string): number | null {
  const ergebnis = findePreis({ artikelnummer })
  return ergebnis.status === 'gefunden' ? ergebnis.preis : null
}

function baueZuschlaege(draft: Draft, moebelpreis: number, meldungen: KalkMeldung[]): KalkPosition[] {
  const zuschlaege: KalkPosition[] = []

  // --- Stufe B: Prozent auf den Möbelpreis (Sätze stehen im Preisblatt) -------------
  let nachStufeB = moebelpreis
  if (draft.sichtRueckwandAussen) {
    const regel = prozentZuschlaege.sichtrueckwand
    const prozent = zuschlagsProzent(regel.artikel)
    const stamm = getArtikelNr(regel.artikel)
    if (prozent == null) {
      meldungen.push({ schwere: 'warnung', text: `Zuschlagssatz für ${stamm?.bezeichnung ?? regel.artikel} nicht gefunden.` })
    } else {
      const betrag = runde2(moebelpreis * (prozent / 100))
      nachStufeB += betrag
      zuschlaege.push({
        id: naechsteId(),
        herkunft: 'zuschlag',
        bucket: 'upgrade',
        label: `${stamm?.bezeichnung ?? 'Sichtrückwand'} (+${prozent} %)`,
        artikelnummer: regel.artikel,
        kurzzeichen: stamm?.kurzzeichen,
        teileart: stamm?.teileart,
        dropdown: stamm?.dropdown,
        einheit: stamm?.einheit,
        achsen: [],
        menge: 1,
        einzelpreis: betrag,
        gesamt: betrag,
        status: 'berechnet',
        hinweis: 'Basis: Möbelpreis',
      })
    }
  }

  // --- Stufe C: Prozent auf die Auftragssumme --------------------------------------
  const opts = draft.pricingOptions
  if (opts?.montage) {
    const betrag = runde2(nachStufeB * meta.montageZuschlagPct)
    zuschlaege.push(pauschalZuschlag(`Montage (+${Math.round(meta.montageZuschlagPct * 100)} %)`, betrag))
  }
  if (opts?.lieferungRegional) {
    const betrag = runde2(nachStufeB * meta.lieferungRegionalPct)
    zuschlaege.push(pauschalZuschlag(`Lieferung regional (+${Math.round(meta.lieferungRegionalPct * 100)} %)`, betrag))
  }

  return zuschlaege
}

function pauschalZuschlag(label: string, betrag: number): KalkPosition {
  return {
    id: naechsteId(),
    herkunft: 'zuschlag',
    bucket: 'upgrade',
    label,
    achsen: [],
    menge: 1,
    einzelpreis: betrag,
    gesamt: betrag,
    status: 'berechnet',
    hinweis: 'Basis: Auftragssumme',
  }
}

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
    zuschlaege: [],
    moebelpreis: 0,
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

  const moebelpreis = runde2(positionen.reduce((summe, p) => summe + (p.gesamt ?? 0), 0))
  const zuschlaege = baueZuschlaege(draft, moebelpreis, meldungen)
  const gesamt = runde2(moebelpreis + zuschlaege.reduce((summe, p) => summe + (p.gesamt ?? 0), 0))

  const offenePositionen = positionen.filter((p) => p.status !== 'berechnet').length
  const hatFehler = meldungen.some((m) => m.schwere === 'fehler')

  if (positionen.length === 0) {
    meldungen.push({
      schwere: 'warnung',
      text: 'Noch keine kalkulierbaren Positionen – Korpus-Grunddaten und Fronten erfassen.',
    })
  }
  if (offenePositionen > 0) {
    meldungen.push({
      schwere: 'warnung',
      text: `${offenePositionen} Position(en) ohne Preis – Angebot nur unter Vorbehalt, AV-Prüfung erforderlich.`,
    })
  }

  return {
    positionen,
    zuschlaege,
    moebelpreis,
    gesamt,
    meldungen,
    offenePositionen,
    vollstaendig: !hatFehler && offenePositionen === 0 && positionen.length > 0,
    gueltigkeit: meta.gueltigkeit,
    waehrung: meta.waehrung,
  }
}
