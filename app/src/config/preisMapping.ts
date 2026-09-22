/**
 * PREIS-MAPPING — die Lookup-Schicht zwischen Konfigurator und Preisblatt.
 *
 * Enthält KEINE Logik, ausschließlich Zuordnungen: welcher Konfigurator-Begriff
 * (Serie, Front-Typ, Ausstattungs-Option) welchen Artikel adressiert.
 *
 * Gegenüber der Vorgänger-Fassung ist die Adressierung eine andere: statt Kategorie-
 * und Unterkategorie-Klartext steht hier die **Artikelnummer**. Damit hängt die
 * Kalkulation nicht mehr an Zeichenketten aus einer PDF-Extraktion —
 * `'Refugium Ausstattung' / 'Korpus 18 Raster (235cm hoch)'` wird zu `10-001-0003`,
 * und die Rasterstufe ist eine Achse statt Teil eines Textes.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  In `lib/kalkulation.ts` steht KEIN `if (serieId === 'refugium')`.        │
 * │  Alles Serienspezifische gehört hierher.                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import { EDGE_FRONT_TYPE_IDS, EDGE_KUERZBAR_FRONT_TYPE_IDS } from './handles.ts'
import { resolvePriceGroup } from '../lib/materialRules.ts'
import type { PriceGroup } from '../types/index.ts'

// ---------------------------------------------------------------------------
// Bauteil-Zuordnung
// ---------------------------------------------------------------------------

/**
 * Beschreibt, wie ein Bauteil im Preisblatt gefunden wird.
 *
 * Seit der Achsen-Reform sagen die Schalter nur noch, WOHER ein Wert kommt — nicht mehr,
 * ob der Artikel eine bestimmte Achse führt. Das steht im Artikel selbst; ein Wert für
 * eine Achse, die es nicht gibt, filtert schlicht nicht. Verschwunden sind damit die
 * beiden Notbehelfe `rasterInBreite` (Rasterstufe stand in der Breitenspalte) und
 * `breiteAusKorpushoehe` (Korpushöhe stand in der Breitenspalte) — beide Artikel führen
 * jetzt eine echte Höhenachse in Zentimetern.
 */
export interface BauteilLookup {
  /** Artikelnummer im Stamm — der Schlüssel. */
  artikel: string
  /** Preisgruppe als eigene Achse mitgeben (Außenset PG1–PG4). */
  nutztPg?: boolean
  /** Stil-Linie + PG als kombinierten Achsenwert mitgeben (Fronten). */
  nutztLiniePg?: boolean
  /** Tiefe als Achse mitgeben (Schubladen, Korpus). */
  nutztTiefe?: boolean
  /** Höhe als Achse mitgeben. */
  nutztHoehe?: boolean
  /**
   * Nicht die Bauteilhöhe, sondern die KORPUSHÖHE ist der Höhenwert. Betrifft die
   * abgeleiteten Teile des Möbelblocks (Mittelseite, Außenset) und das LED-Band, das
   * nach Korpushöhenklasse bepreist ist.
   */
  hoeheAusKorpus?: boolean
  /**
   * Zweiter Artikel für dieselbe Position, wenn eine Ausführung angehakt ist (Container
   * mit Rauchglas-Deckplatte statt Decoboard). Jede Ausführung ist seit der Varianten-
   * Migration ein eigener Artikel im Stamm — dieses Feld sagt nur, WELCHER der beiden
   * gilt, wenn der Berater die Option ankreuzt. Ohne Häkchen bleibt es bei `artikel`.
   */
  artikelBeiAuswahl?: string
  /** Abweichende Anzeige-Bezeichnung; sonst kommt sie aus dem Artikelstamm. */
  label?: string
  /**
   * Weitere Artikel, die zur SELBEN Position gehören und als eigene Teilposition sichtbar
   * bleiben. Überarbeitung 8, S. 5: „Einlegeboden inkl. Kleiderstange" = Bodenpreis +
   * 15 € Kleiderstange — beides steht als eigener Artikel in den Stammdaten und erscheint
   * in der Kalkulation als „Einlegeboden … + Kleiderstange 15 €", statt als unsichtbarer
   * Aufschlag in einer Summe zu verschwinden. Jede Komponente wird mit Breite, Tiefe und
   * Preisgruppe der Position nachgeschlagen (Achsen, die sie nicht führt, filtern nicht).
   */
  komponenten?: Array<{ artikel: string; label: string }>
  /** Name der Teilposition des Hauptartikels, wenn `komponenten` gesetzt sind. */
  teilLabel?: string
}

// ---------------------------------------------------------------------------
// Serien
// ---------------------------------------------------------------------------

/**
 * Wie eine Serie konfiguriert wird:
 *   BAUTEIL  — aus Korpus, Fronten und Ausstattung zusammengesetzt
 *   MODELL   — Fertigmöbel zum Festpreis (Porticus, Supersonus)
 *   FLAECHE  — über Plattenmaße (Tavolo, Arcum)
 */
export type Konfigurationsart = 'BAUTEIL' | 'MODELL' | 'FLAECHE'

/**
 * KONSTRUKTIONSREGEL FÜR MITTELSEITEN.
 *
 * Wie viele senkrechte Wände ein Möbelblock zusätzlich braucht, hängt davon ab, ob die
 * Korpi ihre Seitenwände selbst mitbringen:
 *
 *   'proTrennung'  Der Korpus ist ein reiner Boden-Deckel-Rahmen; jede Grenze zwischen
 *                  zwei Segmenten braucht eine eigene Wand ⇒ n − 1.
 *
 *   'abschluss'    Jeder Korpus bringt seine LINKE Seite mit. Die Wand zwischen Segment 1
 *                  und 2 ist damit schon die linke Seite von Korpus 2, die zwischen 2 und 3
 *                  die linke Seite von Korpus 3 — es fehlt allein die Wand, die den letzten
 *                  Korpus rechts schließt ⇒ genau 1, unabhängig von der Segmentzahl.
 *
 * Refugium baut nach dem zweiten Muster. Fachberater zur Preisprobe: „nur 1 Mittelseite.
 * Weil sich der Schrank aus 3 Korpi + 1 Mittelseite zusammensetzt. (die linke Außenwand
 * des 2 & 3 Korpi ersetzt eine Mittelwand & die Mittelwand ist quasi die Abschlußwand.)"
 * Seine Skizze zeigt drei nach rechts offene U-Korpi und ein einzelnes stehendes Brett.
 */
export type MittelseitenRegel = 'proTrennung' | 'abschluss'

/**
 * Anzahl der Mittelseiten für einen Block aus `segmente` Korpi.
 *
 * Bewusst ohne Sonderfall für eine bestimmte Segmentzahl: Beide Regeln sind allgemein
 * und liefern für 1, 2, 5 oder 12 Korpi dasselbe Konstruktionsprinzip. Ein Block ohne
 * Segmente braucht auch keine Wand.
 */
export function anzahlMittelseiten(regel: MittelseitenRegel | undefined, segmente: number): number {
  if (segmente <= 0) return 0
  return regel === 'abschluss' ? 1 : Math.max(0, segmente - 1)
}

export interface SerienRegel {
  id: string
  konfigurationsart: Konfigurationsart
  /** Korpus-Bauteil (Pflicht bei BAUTEIL-Serien). */
  korpus?: BauteilLookup
  /** Abgeleitet: die senkrechte Trennwand/Abschlusswand des Möbelblocks. */
  mittelseite?: BauteilLookup
  /**
   * Wie sich die ANZAHL der Mittelseiten aus der Segmentzahl ergibt. Konstruktive Regel,
   * deshalb hier und nicht im Rechenkern — sie hängt am Korpusbau der Serie.
   */
  mittelseitenRegel?: MittelseitenRegel
  /** Abgeleitet: seitlicher Abschluss des Möbelblocks. */
  aussenset?: BauteilLookup
  /**
   * Aufpreis für den Fußleistenausschnitt. Wird EINMAL je Möbel berechnet, nicht je
   * Korpus — die Preiszeile trägt die Einheit „EUR/für 2 Seiten".
   */
  fussleistenausschnitt?: BauteilLookup
  /** Serienweite Hinweise, die als INFO-Meldung erscheinen. */
  hinweise?: string[]
  /**
   * Serien, bei denen NUR die Standardtiefe bepreisbar ist: Jede abweichende Tiefe
   * wird als „auf Anfrage" ausgewiesen, mit `grund` als Begründung.
   *
   * Für Refugium gilt das ausdrücklich NICHT — Sondertiefen von 31–60 cm werden mit
   * den normalen Korpuspreisen gerechnet (Preisblatt S. 26). Das Feld bleibt für
   * Serien erhalten, deren Tiefenpreise nicht im Stamm liegen.
   */
  korpusNurStandardtiefe?: { standardTiefeCm: number; grund: string }
}

/**
 * Serien-Registry. Refugium ist vollständig hinterlegt; die übrigen Serien tragen ihre
 * Konfigurationsart, aber noch keine Bauteil-Zuordnung — die Engine meldet das als
 * Warnung, statt still 0 € zu liefern.
 *
 * Die Rasteroffsets stehen NICHT hier, sondern in „50 Meta" (`meta.korpusOffsetMm`).
 */
export const serienRegeln: Record<string, SerienRegel> = {
  refugium: {
    id: 'refugium',
    konfigurationsart: 'BAUTEIL',
    korpus: {
      artikel: '10-001-0003', // Korpus (Refugium) — BREITE × HÖHE × TIEFE × PG
      nutztHoehe: true,
      nutztTiefe: true,
      nutztPg: true,
      // Die Preisgruppe kommt aus der Innenausführung, die Tiefe aus den Maßen. Beide
      // Achsen stehen seit der Korpus-Migration im Preisblatt (scripts/lib/refugium-korpus.js):
      // PG 1 ist der gedruckte Decoboard-Preis, PG 2–4 die Atrium-Preise derselben
      // Breite und Tiefe (Preisliste S. 13 / 14 / 15).
    },
    mittelseite: {
      // Mittelseite (2 cm) — HÖHE × TIEFE × PG. Überarbeitung 8, S. 2: In PG 2–4 gilt der
      // Atrium-Preis der „Seite" (227 € bei PG 2 · 60 cm · 18 R), in PG 1 der Refugium-Preis.
      // Die Preisgruppe ist die HÖCHSTE der Korpi (S. 4) — gewählt in lib/kalkulation.ts.
      artikel: '10-002-0001',
      nutztHoehe: true,
      hoeheAusKorpus: true,
      nutztTiefe: true,
      nutztPg: true,
    },
    // Refugium-Korpi bringen ihre linke Seite mit — es fehlt nur die Abschlusswand rechts.
    mittelseitenRegel: 'abschluss',
    aussenset: {
      artikel: '10-003-0001', // Aussenset — BREITE(=Raster) × PG
      nutztHoehe: true,
      hoeheAusKorpus: true,
      nutztPg: true,
    },
    fussleistenausschnitt: {
      // „Vertiefte Aussenseiten fuer Fussleistenausschnitt/Verkabelung" — Festpreis,
      // Einheit „EUR/für 2 Seiten", also einmal je Möbel und nicht je Korpus.
      artikel: '50-027-0007',
      label: 'Fußleistenausschnitt',
    },
    hinweise: [
      'Refugium hat serienmäßig keine Abdeckplatte (Programmvergleich S. 6).',
      'Die 32er Lochreihe ist Serienstandard und damit keine Preisposition.',
      'Die Korpustiefe ist eine eigene Preisachse (31 · 41 · 60 cm); Zwischenmaße werden auf die nächstgrößere Stufe bepreist.',
      'In Decoboard (PG 1) ist der Korpuspreis für alle drei Tiefen gleich (Preisblatt S. 26). Bei abweichender Innenausführung gelten die Atrium-Korpuspreise (S. 13 / 14 / 15).',
      'Der 21-Raster-Preis enthält den 20-%-Aufschlag gegenüber 18 Raster bereits (Preisblatt S. 26) – er wird deshalb nicht zusätzlich aufgeschlagen.',
    ],
  },
  atrium: { id: 'atrium', konfigurationsart: 'BAUTEIL' },
  velare: { id: 'velare', konfigurationsart: 'BAUTEIL' },
  publicum: { id: 'publicum', konfigurationsart: 'BAUTEIL' },
  porticus: { id: 'porticus', konfigurationsart: 'MODELL' },
  cavum: { id: 'cavum', konfigurationsart: 'BAUTEIL' },
  supersonus: { id: 'supersonus', konfigurationsart: 'BAUTEIL' },
  tavolo: { id: 'tavolo', konfigurationsart: 'FLAECHE' },
  arcum: { id: 'arcum', konfigurationsart: 'FLAECHE' },
}

export function getSerienRegel(serieId: string | undefined): SerienRegel | undefined {
  return serieId ? serienRegeln[serieId] : undefined
}

// ---------------------------------------------------------------------------
// Fronten
// ---------------------------------------------------------------------------

/** Front-Typ (`config/frontCatalog.ts`) → Artikel im Preisblatt. */
export const frontLookups: Record<string, BauteilLookup> = {
  drehtuer: { artikel: '20-006-0001', nutztLiniePg: true, nutztHoehe: true },
  schiebetuer: { artikel: '20-007-0001', nutztLiniePg: true, nutztHoehe: true },
  'schiebetuer-zwei': { artikel: '20-008-0001', nutztLiniePg: true },
  schuebe: { artikel: '20-009-0001', nutztLiniePg: true, nutztHoehe: true, nutztTiefe: true },
  stauraumklappe: { artikel: '20-010-0004', nutztLiniePg: true },
  hochstellklappe: { artikel: '20-010-0001', nutztLiniePg: true },
  // 20-010-0002 hieß ebenfalls „Schreibklappe", trug aber nur eine einzige Preiszelle
  // (den Aufpreis für die Ledereinlage). Die Achsen-Reform hat ihn aufgelöst: Die
  // Grundtabelle -0003 führt die Ledereinlage jetzt als AUSFÜHRUNG mit vollem Preis.
  schreibklappe: { artikel: '20-010-0003', nutztLiniePg: true },
  // „Offen (Regal)" ist kein Bauteil und erzeugt bewusst keine Preisposition.
}

/**
 * Stil-Linie des Front-Katalogs → Achsenwert `LINIE_PG` im Preisblatt.
 *
 * Die Achse führt Linie und Preisgruppe zusammen: `Glatt1`…`Glatt4` folgen der Regel
 * „Glatt N = PG N", `Curve` und `107` unterscheiden nur PG1 gegen PG2-4, `Line` und
 * `GlossyLess` sind preisgruppen-unabhängig.
 */
export function liniePgAchsenwert(styleLineId: string | undefined, pg: PriceGroup | undefined): string | undefined {
  if (!styleLineId) return undefined
  switch (styleLineId) {
    case 'glatt':
      return pg ? `Glatt${pg.replace('PG', '')}` : undefined
    case 'curve':
      return pg === 'PG1' ? 'CurvePG1' : 'CurvePG2-4'
    case '107':
      return pg === 'PG1' ? '107PG1' : '107PG2-4'
    case 'line':
      return 'Line'
    case 'glossy':
    case 'less':
    case 'glossy-less':
      return 'GlossyLess'
    // Einläufige Schiebetüren: „Schiene", „Classic" und „Edge" haben keine eigene
    // Preiszeile – sie werden wie „Glatt" bepreist.
    case 'schiene':
    case 'classic':
    case 'edge':
      return pg ? `Glatt${pg.replace('PG', '')}` : undefined
    default:
      return undefined
  }
}

/**
 * IST DER GRIFF IM FRONTPREIS ENTHALTEN?
 *
 * Preisliste S. 7: Der Türpreis (z. B. Glatt 1, 18 R = 260 €) enthält den Griff bereits.
 * Fachberater zur Preisprobe, sechsmal notiert: „Preis für Griff ist im Türpreis
 * enthalten." Eine zusätzliche Griffposition wäre also doppelt berechnet.
 *
 * Die Unterscheidung läuft über die PREISLOGIK des Artikels, nicht über eine Liste von
 * Griffnummern:
 *
 *   FESTPREIS / Stück   Ein Stückgriff, wie ihn die Griff-Auswahl einer Front anbietet.
 *                       Er gehört zur Tür und wird nicht noch einmal berechnet.
 *   MATRIX mit PREISART Nach laufendem Meter oder je m² bepreist — das ist kein
 *                       Standardgriff, sondern ein eigenes Bauteil (Edge-Kantengriff)
 *                       und bleibt eine eigene Position.
 *
 * Damit gilt die Regel für JEDE Frontart gleich (Drehtür, Schub, Klappe, Schiebetür):
 * Sie hängt am Artikel, nicht am Front-Typ. Die Preise bleiben im Stamm erhalten — sie
 * werden gebraucht, sobald ein Griff einzeln verkauft oder als Aufpreis geführt wird.
 *
 * Griffleisten (107/Curve) und das Griffprofil der zweiläufigen Schiebetür laufen gar
 * nicht über die Griff-Auswahl; sie sind eigene Felder und von dieser Regel unberührt.
 */
export function griffImFrontpreisEnthalten(artikel: { preislogik: string; einheit: string } | undefined): boolean {
  if (!artikel) return false
  return artikel.preislogik === 'FESTPREIS' && /st(ü|ue)ck/i.test(artikel.einheit)
}

/**
 * GRIFFLÄNGE EINES GRIFFS NACH LAUFENDEM METER (Edge-Kantengriff, 40 €/lfm).
 *
 * Preisliste S. 3, bestätigt von Cramer am 23.09.2026:
 *   „Länge: Bei Schiebetüren über volle Türhöhe (Stabilität); bei Drehtüren auch gekürzt
 *    möglich. Griff nur vertikal einplanen. Horizontal nicht möglich."
 *
 *   Schiebetür   immer die volle Türhöhe — eine gekürzte Angabe gilt dort nicht.
 *   Drehtür      Vorgabe ist die Türhöhe (keine Eingabe nötig); gekürzt, wenn der Berater
 *                eine kürzere Länge einträgt. Länger als die Tür geht nicht.
 *   Schub/Klappe Edge wäre dort waagerecht — nicht möglich, die Auswahl bietet ihn nicht an.
 *                Kommt er trotzdem an (Altentwurf, „Werte übernehmen"), wird nichts geraten.
 */
export interface Grifflaenge {
  laengeCm?: number
  /** true, wenn eine Drehtür bewusst kürzer als die Türhöhe bestückt wird. */
  gekuerzt?: boolean
  /** Warum keine Länge feststeht — die Position bleibt dann „auf Anfrage". */
  problem?: string
}

export function grifflaenge(frontTypId: string, hoeheCm: number | undefined, gewuenschtCm?: number): Grifflaenge {
  if (!EDGE_FRONT_TYPE_IDS.includes(frontTypId)) {
    return { problem: 'Edge ist nur vertikal an Dreh- und Schiebetüren möglich — horizontal nicht.' }
  }
  if (hoeheCm == null) return {}
  if (!EDGE_KUERZBAR_FRONT_TYPE_IDS.includes(frontTypId) || gewuenschtCm == null) return { laengeCm: hoeheCm }
  if (gewuenschtCm <= 0 || gewuenschtCm > hoeheCm) {
    return { problem: `Grifflänge ${String(gewuenschtCm).replace('.', ',')} cm passt nicht zur Türhöhe ${String(hoeheCm).replace('.', ',')} cm — höchstens die volle Türhöhe.` }
  }
  return { laengeCm: gewuenschtCm, gekuerzt: gewuenschtCm < hoeheCm }
}

/**
 * Schubhöhe für den Preis-Lookup.
 *
 * Vor der Achsen-Reform musste die Fronthöhe hier in eine Rasterstufe (1 · 1,5 · 2)
 * übersetzt werden, weil die Preiszeilen nach Rastern geschlüsselt waren. Heute trägt
 * die Höhenachse ihre Zentimeter selbst (12,5 · 18,9 · 25,3 cm) und rundet auf — die
 * Fronthöhe kann unverändert durchgereicht werden.
 *
 * Bleibt nur der Rückfall: Ohne erfasste Höhe gilt die mittlere Standardstufe, damit
 * ein unfertiger Entwurf einen Preis zeigt statt einer Lücke.
 */
export const SCHUB_STANDARDHOEHE_CM = 18.9

export function schubHoeheCm(hoeheCm: number | undefined): number {
  return hoeheCm ?? SCHUB_STANDARDHOEHE_CM
}

// ---------------------------------------------------------------------------
// Ausstattung
// ---------------------------------------------------------------------------

/**
 * Ausstattungs-Option (`config/equipment.ts`) → Artikel im Preisblatt.
 *
 * `nutztPg` markiert die Artikel, deren Preisblatt seit der PG-Migration eine
 * Preisgruppen-Achse führt (siehe `scripts/lib/refugium-pg.js`). Die Preisgruppe kommt
 * aus der INNENAUSFÜHRUNG des Korpus — Dietmar Cramer, Überarbeitung 6, S. 2: „Das
 * Material der Ausstattung orientiert sich immer am Material des Innenkorpus. Es muss
 * also nicht extra gewählt werden."
 *
 * Wo `nutztPg` fehlt, hat der Artikel im Preisblatt bewusst nur einen Preis — Cramer:
 * „Wenn ihr von mir keine Info bekommt, ist nur der Preis in der Preisgruppe 1 relevant."
 */
export const ausstattungLookups: Record<string, BauteilLookup> = {
  // Überarbeitung 8, S. 5: Material wie Korpus innen — Preisgruppe und Tiefe wählen die Zeile
  // (PG 1 Refugium, PG 2–4 Atrium „Aufpreis für zusätzliche Böden" S. 13 / 14 / 15).
  einlegeboden: { artikel: '40-014-0001', nutztTiefe: true, nutztPg: true },
  glasboden: { artikel: '40-014-0002' },
  rollboden: { artikel: '40-014-0003', nutztPg: true },
  kleiderlift: { artikel: '40-015-0001' },
  // Überarbeitung 8, S. 5: Einlegebodenpreis (wie oben) + 15 € Kleiderstange (KST-002).
  'einlegeboden-kleiderstange': {
    artikel: '40-014-0001',
    nutztTiefe: true,
    nutztPg: true,
    label: 'Einlegeboden inkl. Kleiderstange',
    teilLabel: 'Einlegeboden',
    komponenten: [{ artikel: '40-015-0002', label: 'Kleiderstange' }],
  },
  innenschublade: { artikel: '40-016-0001', nutztHoehe: true, nutztPg: true },
  rollkorb: { artikel: '40-016-0002' },
  'innenspiegel-drehtuer': { artikel: '40-018-0001' },
  krawattenspange: { artikel: '40-023-0012' },
  'led-syncro': { artikel: '50-024-0008' },
  'led-band-aluprofil': { artikel: '50-024-0006', nutztHoehe: true, hoeheAusKorpus: true },
  'kleiderlift-conero': { artikel: '40-023-0006' },
  'guertel-krawattenauszug-conero': { artikel: '40-023-0005' },
  'schuhablage-conero': { artikel: '40-023-0007' },
  'schubladenunterteilung-craft': { artikel: '40-023-0011', nutztPg: true },
  'hemdeinsatz-craft': { artikel: '40-023-0008', nutztPg: true },
  'rollboden-schuhablage-craft': { artikel: '40-023-0010', nutztPg: true },
  kleiderbuegelhalter: { artikel: '40-023-0009' },
  revisionsklappe: { artikel: '50-027-0003' },
  rueckwandausschnitt: { artikel: '50-027-0004' },
}

/**
 * Verblendung → Artikel. Seit Überarbeitung 6 (S. 7) keine Ausstattungs-Option mehr,
 * sondern EINE Angabe je Möbel im Schritt „Maße" — korpusbündig ODER frontbündig.
 * Die Schlüssel sind die Werte von `VerblendungArt`.
 */
export const verblendungLookups: Record<string, BauteilLookup> = {
  frontbuendig: { artikel: '90-038-0001' },
  korpusbuendig: { artikel: '90-038-0002' },
}

/**
 * Container-Varianten. Der Stamm führt jede Ausführung als eigenen Artikel, der
 * Konfigurator kennt eine Option mit Varianten-Auswahl.
 *
 * Die Deckplatte (Decoboard/Rauchglas) ist seit der Varianten-Migration KEINE Achse
 * mehr, sondern ein eigener Artikel je Ausführung — `artikelBeiAuswahl` nennt den
 * Artikel, der statt `artikel` gilt, sobald der Berater die Rauchglas-Option ankreuzt.
 */
export const containerLookups: Record<string, Record<string, BauteilLookup>> = {
  'container-conero': {
    A: { artikel: '40-017-0001', artikelBeiAuswahl: '40-017-0020', nutztPg: true },
    B: { artikel: '40-017-0002', artikelBeiAuswahl: '40-017-0021', nutztPg: true },
    C: { artikel: '40-017-0003', artikelBeiAuswahl: '40-017-0022', nutztPg: true },
    D: { artikel: '40-017-0004', artikelBeiAuswahl: '40-017-0023', nutztPg: true },
    E: { artikel: '40-017-0005', artikelBeiAuswahl: '40-017-0024', nutztPg: true },
    F: { artikel: '40-017-0006', artikelBeiAuswahl: '40-017-0025', nutztPg: true },
    // G und H sind Festpreis-Container und nur im 100er Korpus lieferbar (S. 30); sie
    // führen deshalb keine Preisgruppen-Achse. Das Preisblatt kennt DREI G-Ausführungen
    // — 12 Hosenhalter (-0007), 2 Wäschesäcke (-0009), 6 Hosenhalter + 1 Wäschesack
    // (-0011) — zum identischen Preis. Der Katalog bietet bisher nur ein „G" an; bis er
    // die drei unterscheidet, steht hier die erste Ausführung, der Betrag stimmt für alle.
    G: { artikel: '40-017-0007', artikelBeiAuswahl: '40-017-0008' },
    H: { artikel: '40-017-0013', artikelBeiAuswahl: '40-017-0014' },
  },
  'container-craft': {
    A: { artikel: '40-017-0015', artikelBeiAuswahl: '40-017-0026', nutztPg: true },
    B: { artikel: '40-017-0016', artikelBeiAuswahl: '40-017-0027', nutztPg: true },
    C: { artikel: '40-017-0017', artikelBeiAuswahl: '40-017-0028', nutztPg: true },
  },
  // Der Basis-Container führt seine Höhe als Rasterachse (4,5 R und 6 R) statt als
  // eigenen Artikel — die Variante wird deshalb in eine Rasterstufe übersetzt.
  // OHNE `nutztPg`: Er ist in Überarbeitung 6 nicht annotiert und trägt im Preisblatt
  // weiterhin nur einen Preis (offene Rückfrage, siehe scripts/lib/refugium-pg.js).
  container: {
    '4,5R': { artikel: '40-017-0019', artikelBeiAuswahl: '40-017-0029', nutztHoehe: true },
    '6R': { artikel: '40-017-0019', artikelBeiAuswahl: '40-017-0029', nutztHoehe: true },
  },
}

/**
 * Varianten-Bezeichnung des Basis-Containers → Raster-ETIKETT der Höhenachse.
 *
 * Die Zentimeter dahinter stehen in den Stammdaten („57,3 cm | 4,5R"), nicht hier:
 * Der Lookup löst das Etikett über die Preiszeilen des Artikels auf. Damit ändert eine
 * neue Containerhöhe in der Mappe nichts am Code.
 */
export const containerRaster: Record<string, number> = { '4,5R': 4.5, '6R': 6 }

/**
 * Rasterstufe aus einer Varianten-Bezeichnung („1,5R" ⇒ 1,5).
 *
 * Die Innenschublade führt ihre BAUHÖHE als Variante (1R · 1,5R · 2R) — und genau die ist
 * ihr Preisschlüssel. Vor Überarbeitung 2_2 wurde sie stattdessen aus dem Freitext der
 * Einbauhöhe geraten (`schubRasterFuerHoehe(zahl(heightNote))`); „auf 120 cm" ergab damit
 * die teuerste Stufe, obwohl 120 cm die Montagehöhe war und nicht die Schubladenhöhe.
 * Seit die Einbauhöhe strukturiert erfasst wird, ist die Verwechslung ausgeschlossen.
 */
export function rasterAusVariante(variante: string | undefined): number | undefined {
  if (!variante) return undefined
  const treffer = /^(\d+(?:[.,]\d+)?)\s*R$/i.exec(variante.trim())
  return treffer ? Number(treffer[1].replace(',', '.')) : undefined
}

// ---------------------------------------------------------------------------
// Aufschläge — welches Häkchen welchen Aufschlag-Artikel auslöst
// ---------------------------------------------------------------------------

/*
 * Satz, Einheit und Preisbasis eines Aufschlags stehen im ARTIKEL (Preisart „Aufschlag",
 * Artikelverwaltung) — hier steht nur, welches Häkchen im Entwurf ihn auslöst.
 *
 * Mit der Stammdaten-Reform gestrichen bleiben die übrigen Prozent-Artikel (wandhängende
 * Kastenmöbel 15 %, Überhöhe 20 %): „Prozent Artikel, Prozent Möbel, Prozent Auftragssumme
 * … bitte ganz streichen. Das kann am Ende … vom Verkäufer entschieden werden." Sie stehen
 * mit Preisart „Auf Anfrage" im Stamm. Die Überhöhe steckt ohnehin schon in den 21-Raster-
 * Preiszeilen (18 R × 1,20) — ein Aufschlag darauf wäre doppelt gerechnet.
 */

/**
 * ARTIKELBEZOGENE AUFSCHLÄGE — Stufe 1 der Kalkulation.
 *
 * Sie rechnen auf den Möbelpreis (Summe aller Artikelpositionen) und GEHÖREN ZUM MÖBEL:
 * Möbelpreis + artikelbezogene Aufschläge = Gesamtmöbelpreis.
 */
export const artikelAufschlaege: ReadonlyArray<{
  art: 'raumteiler' | 'sichtrueckwand'
  artikel: string
  /** Häkchen im Entwurf, das den Aufschlag auslöst. */
  ausloeser: 'raumteiler' | 'sichtRueckwandAussen'
}> = [
  { art: 'raumteiler', artikel: '90-037-0001', ausloeser: 'raumteiler' },
  { art: 'sichtrueckwand', artikel: '90-037-0004', ausloeser: 'sichtRueckwandAussen' },
]

/**
 * NACHGELAGERTE ZUSCHLÄGE — Stufe 2 der Kalkulation (Preisliste 06.2026).
 *
 * Montage (Art. 21033) und Lieferung regional (Art. 21032) rechnen auf den
 * GESAMTMÖBELPREIS, jede für sich — nie aufeinander — und verändern den Möbelpreis nicht.
 * Im Abschluss sind sie per Häkchen abwählbar (`Draft.pricingOptions`, Vorgabe: an).
 */
export const serviceZuschlaege: ReadonlyArray<{
  art: 'montage' | 'lieferung'
  artikel: string
  /** Schalter in `Draft.pricingOptions`. */
  option: 'montage' | 'lieferungRegional'
}> = [
  { art: 'montage', artikel: '90-039-0001', option: 'montage' },
  { art: 'lieferung', artikel: '90-039-0002', option: 'lieferungRegional' },
]

/**
 * Ableitung der Preisgruppe aus Materialart und Farbsystem.
 *
 * Farben sind bei Cramer frei wählbar (PG3 „andere RAL-Lacke", PG4 „Sikkens, NCS,
 * RAL Design") und damit nicht abzählbar. Für die Kalkulation zählt allein die
 * Preisgruppe; die konkrete Farbbezeichnung trägt der Informationsfluss zur AV.
 *
 * Die Materialmatrix hinterlegt die PG bereits je Gruppe bzw. Option — diese Funktion
 * ist der Rückfall für frei eingegebene Oberflächen („anders").
 */
export function leitePreisgruppeAb(
  materialGroupId: string | undefined,
  optionId: string | undefined,
): PriceGroup | undefined {
  // Seit dem Oberflächen-Modul steht die Zuordnung NICHT mehr hier, sondern in den
  // Stammdaten: die Kategorie trägt die Preisgruppe, eine einzelne Oberfläche darf sie
  // überschreiben (z. B. Wengé PG 4 in der PG-3-Gruppe Furnier). Diese Funktion ist
  // damit nur noch der Einstiegspunkt — eine zweite, hartcodierte Wahrheit wäre die
  // sichere Quelle für stille Preisabweichungen.
  return resolvePriceGroup(materialGroupId, optionId)
}
