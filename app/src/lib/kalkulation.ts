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

import { getEquipmentOption } from '../config/equipment.ts'
import {
  ausstattungLookups,
  ausstattungOhnePreis,
  containerLookups,
  containerRaster,
  rasterAusVariante,
  frontLookups,
  getSerienRegel,
  liniePgAchsenwert,
  prozentZuschlaege,
  schubRasterFuerHoehe,
  type BauteilLookup,
  type SerienRegel,
} from '../config/preisMapping.ts'
import { meta } from '../data/stammdaten.generated.ts'
import { resolveDepthCm, resolveHeightCm, resolveKorpusBreiteCm } from './korpusMass.ts'
import { findePreis, getArtikelNr, verfuegbareRaster, type AufgelloesteAchse } from './preisLookup.ts'
import { korpusOffsetMm, loeseRasterAuf } from './raster.ts'
import type {
  Draft,
  FrontElement,
  MaterialSelection,
  PositionsHerkunft,
  PositionsStatus,
  PriceBucket,
  PriceGroup,
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
  teileart?: string
  produktgruppe?: string
  artikelgruppe?: string
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
    produktgruppe: stamm?.produktgruppe,
    artikelgruppe: stamm?.artikelgruppe,
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
      const aufloesung = loeseRasterAuf(hoeheCm, offset, verfuegbar)
      kontext.bepreistesRaster = aufloesung.bepreistesRaster ?? undefined
      if (aufloesung.bepreistesRaster == null) {
        meldungen.push({
          schwere: 'fehler',
          text: `Höhe ${hoeheCm} cm liegt über der größten bepreisten Korpus-Stufe (${verfuegbar[verfuegbar.length - 1]} R) – Sondermaß, AV-Prüfung.`,
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
  if (!regel.korpus || kontext.bepreistesRaster == null) return positionen

  // Punkt 5.13.3: Sondertiefe ⇒ der Standard-Korpuspreis gilt nicht. Begründung und
  // Grenzwert stehen in `config/preisMapping.ts`, nicht hier.
  const nurStandard = regel.korpusNurStandardtiefe
  const sondertiefe =
    nurStandard != null && kontext.tiefeCm != null && kontext.tiefeCm !== nurStandard.standardTiefeCm

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
        produktgruppe: stamm?.produktgruppe,
        artikelgruppe: stamm?.artikelgruppe,
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
        hinweis: kontext.rasterHinweis,
      }),
    )
  })

  if (sondertiefe && nurStandard) {
    meldungen.push({
      schwere: 'warnung',
      text: `Sondertiefe ${kontext.tiefeCm} cm: Die Korpuspreise sind nicht automatisch ermittelbar – bitte über die AV klären.`,
    })
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

  const anzahlMittelseiten = Math.max(0, kontext.breiten.length - 1)
  if (regel.mittelseite && anzahlMittelseiten > 0) {
    positionen.push(
      bauePosition({
        lookup: regel.mittelseite,
        menge: anzahlMittelseiten,
        bucket: 'korpus',
        herkunft: 'abgeleitet',
        raster: kontext.bepreistesRaster,
        hinweis: `Automatisch ergänzt: ${kontext.breiten.length} Segmente erfordern ${anzahlMittelseiten} Mittelseite(n).`,
      }),
    )
  }

  if (regel.aussenset) {
    // Ohne ausdrückliches „keine" gilt: der Möbelblock wird seitlich abgeschlossen.
    const position = draft.korpusGrunddaten?.abschlussSet?.position
    if (position !== 'keine') {
      const aussenPg =
        pgVon(draft.korpus?.aussen) ?? pgVon(draft.korpus?.aussenLinks) ?? pgVon(draft.korpus?.aussenRechts)
      if (!aussenPg) {
        meldungen.push({
          schwere: 'fehler',
          text: 'Für das Außenset fehlt die Preisgruppe – bitte Material des Außenkorpus festlegen.',
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

      // Griff als eigene Position — jetzt aus dem Artikelstamm statt aus `handles.ts`.
      if (el.griff && el.griffId) {
        const griffArtikel = griffArtikelnummer(el.griffId)
        if (griffArtikel) {
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

function baueAusstattungsPositionen(
  draft: Draft,
  kontext: KorpusKontext,
  meldungen: KalkMeldung[],
): KalkPosition[] {
  const positionen: KalkPosition[] = []

  ;(draft.fronts?.columns ?? []).forEach((spalte, spaltenIndex) => {
    const segment = spaltenIndex + 1
    const segmentBreite = kontext.breiten[spaltenIndex]

    ;(spalte.equipment ?? []).forEach((item) => {
      const option = getEquipmentOption(item.optionId)
      const label = option?.label ?? item.optionId
      const menge = item.qty ?? 1

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
          variante: varianten && !lookup.nutztRaster ? undefined : undefined,
          hinweis: lookup.breiteAusKorpushoehe
            ? 'Bepreist nach Korpushöhenklasse, je Schrankseite.'
            : undefined,
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
        produktgruppe: stamm?.produktgruppe,
        artikelgruppe: stamm?.artikelgruppe,
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
