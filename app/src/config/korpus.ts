import { ALLE_MATERIALGRUPPEN } from './materialMatrix.ts'
import type { ProductSeries } from './productCatalog.ts'

/**
 * Korpus-Bereiche (Phase 4) als Konfiguration. Legt fest, welche Materialgruppen
 * je Bereich zulässig sind, ob „anders“ (Freitext) erlaubt ist, ob eine „Keine“-
 * Option existiert, ob der Bereich bedingt sichtbar ist (Innen) und ob er Pflicht ist.
 *
 * Datengetrieben: Neue Bereiche oder geänderte Materialzulassungen erfordern nur
 * Anpassungen hier – keine UI-/Logik-Umbauten.
 */
export interface KorpusArea {
  id: string
  /** Anzeigename laut Korpus-Doku (z. B. „a. Innen“). */
  label: string
  /** Kurzbeschreibung laut Korpus-Doku. */
  hint?: string
  /** Zulässige Materialgruppen (Verweise auf materialMatrix-IDs). */
  materialGroupIds: string[]
  /** „anders“ (manuelles Freitextfeld) erlauben. */
  allowCustom: boolean
  /** Optional: „Keine …“-Auswahl (erfüllt die Pflicht ohne Material), z. B. „Keine Abdeckplatte“. */
  noneLabel?: string
  /** Nur sichtbar, wenn die Serie „Innen“ aktiviert (Korpus-Regel Velare/Refugium). */
  requiresInnenSeries?: boolean
  /**
   * Gehört zum Außenkorpus und entfällt bei Serien mit `hasAussenkorpus: false`.
   * Als Merkmal am Bereich statt als Aufzählung von IDs in der Regel weiter unten —
   * eine neue Außen-Variante ist damit automatisch mit abgedeckt.
   */
  istAussenkorpus?: boolean
  /** Pflichtbereich (sofern sichtbar) – erzwungene Progression. */
  required: boolean
  /**
   * Materialgruppen, die dieser Bereich bei einer bestimmten Serie NICHT anbietet — eine
   * Verwendungsregel, keine Löschung: Die Gruppe bleibt in den Stammdaten und an allen
   * anderen Stellen wählbar. Ausgewertet in `getVisibleKorpusAreas`.
   */
  ausgeschlosseneGruppenJeSerie?: Record<string, string[]>
}

/** Außenkorpus-Modus (Phase 9b). */
export type KorpusMode = 'komplett' | 'getrennt'

// Für Außen & Abdeckplatte identische Materialzulassung (laut Korpus-Doku).
// Platzhalter statt Aufzählung: eine in der Verwaltung neu angelegte Oberflächenkategorie
// steht damit ohne Code-Änderung auch am Außenkorpus und an der Abdeckplatte zur Wahl.
const AUSSEN_ABDECKPLATTE_GROUPS = [ALLE_MATERIALGRUPPEN]

/**
 * Punkt 5.3 — Dietmars Beispiel: „Korpi mittel (teilweise offen) >> Korpus innen
 * daher furniert." Neben Decoboard steht deshalb auch Furnier zur Auswahl.
 *
 * WARUM GENAU DIESE VIER GRUPPEN
 * Die Innenausführung bestimmt seit der Preisgruppen-Umstellung den Preis von Korpus
 * UND Innenausstattung — Dietmar Cramer, Überarbeitung 6, S. 2: „Das Material der
 * Ausstattung orientiert sich immer am Material des Innenkorpus." Cramer hat Aufpreise
 * für PG 2, 3 und 4 vorgegeben; angeboten wurden hier aber nur Decoboard (PG 1) und
 * Furnier (PG 3). PG 2 und PG 4 waren damit nur über „anders" erreichbar, und die Hälfte
 * der hinterlegten Preiszeilen im Normalbetrieb tot. Mattlack (PG 2) und Xtreme Plus
 * (PG 4) sind deshalb ergänzt — dieselben vier Gruppen wie beim Abschlussset.
 *
 * Gläser fehlen bewusst: eine Schrankinnenseite aus Glas gibt es nicht. Wer sie doch
 * braucht, nimmt „anders" und beschreibt sie im Freitext.
 */
const innenArea: KorpusArea = {
  id: 'innen',
  label: 'a. Innen',
  hint: 'Innenausführung – nur bei Velare / Refugium',
  materialGroupIds: ['decoboard', 'mattlack', 'furnier', 'xtreme-plus'],
  allowCustom: true,
  requiresInnenSeries: true,
  required: true,
  // Überarbeitung 8, S. 3: „Bei Innen bitte ‚Xtreme Plus' entfernen." — für Refugium. Xtreme
  // Plus bleibt als Material bestehen (Fronten, Abschlussset); nur innen wird es nicht angeboten.
  ausgeschlosseneGruppenJeSerie: { refugium: ['xtreme-plus'] },
}
const aussenArea: KorpusArea = {
  id: 'aussen',
  label: 'b. Außen (komplett)',
  istAussenkorpus: true,
  hint: 'Farbe / Material des gesamten Außenkorpus',
  materialGroupIds: AUSSEN_ABDECKPLATTE_GROUPS,
  allowCustom: true,
  required: true,
}
const aussenLinksArea: KorpusArea = {
  id: 'aussenLinks',
  label: 'b1. Außen – Seite links',
  istAussenkorpus: true,
  hint: 'Material der linken Seite',
  materialGroupIds: AUSSEN_ABDECKPLATTE_GROUPS,
  allowCustom: true,
  required: true,
}
const aussenRechtsArea: KorpusArea = {
  id: 'aussenRechts',
  label: 'b2. Außen – Seite rechts',
  istAussenkorpus: true,
  hint: 'Material der rechten Seite',
  materialGroupIds: AUSSEN_ABDECKPLATTE_GROUPS,
  allowCustom: true,
  required: true,
}
const abdeckplatteArea: KorpusArea = {
  id: 'abdeckplatte',
  label: 'c. Abdeckplatte',
  hint: 'Oberseite des Möbels',
  materialGroupIds: AUSSEN_ABDECKPLATTE_GROUPS,
  allowCustom: true,
  // Pflichtbereich, aber durch „Keine Abdeckplatte“ erfüllbar.
  noneLabel: 'Keine Abdeckplatte',
  required: true,
}

/** Rückwände (innen/außen) – volle Katalog-Auswahl inkl. Furnier (Phase B). */
export const RUECKWAND_GROUPS = AUSSEN_ABDECKPLATTE_GROUPS

/**
 * Materialgruppen des Abschlusssets (Seitenset, 10 mm).
 *
 * „Überarbeitung 2", S. 4: „Gläser nicht möglich." Ein 10 mm starkes Seitenset lässt
 * sich nicht in Glas ausführen — die Gruppe fehlt hier deshalb bewusst.
 * „anders" bleibt erlaubt und trägt Freitext samt Preisgruppe (Punkt 5.11).
 */
export const ABSCHLUSSSET_GROUPS = ['decoboard', 'mattlack', 'furnier', 'xtreme-plus']

/**
 * SICHTBARKEIT DES INNENAUSBAU-BLOCKS — Rückmeldung „Überarbeitung 2", S. 5.
 *
 * Der Block „Korpus Innen" fragte Rückwand, Lochreihe und Einlegeböden global ab,
 * bevor es zu den Fronten ging. Er ist an jeder Stelle doppelt und an einer sogar
 * schädlich:
 *
 *   Einlegeböden   werden je Segment hinter der Front erfasst UND dort korrekt
 *                  bepreist; die globale Angabe rechnete pauschal mit der Breite
 *                  von Segment 1.
 *   Kleiderstange  erzeugte global nur eine Info-Meldung, gezählt wird je Segment.
 *   Lochreihe      steht bereits je Korpus im Schritt „Maße".
 *   Rückwand innen hat kein Gegenstück — soll laut Entscheidung aber ebenfalls
 *                  zunächst nicht abgefragt werden, damit das Kundengespräch
 *                  schlank bleibt.
 *
 * Deshalb zwei getrennte Schalter statt gelöschtem Code: Der Block lässt sich
 * jederzeit wieder einblenden, ohne ihn neu zu bauen — die Datenstruktur
 * `Draft.korpusInnen` und die Auswertung in der Kalkulation bleiben unberührt,
 * damit bereits gespeicherte Entwürfe ihre Angaben behalten.
 */
export const KORPUS_INNEN_SICHTBAR: boolean = false

/** Eigener Schalter, damit die Rückwand auch bei wieder aktivem Block aus bleibt. */
export const RUECKWAND_INNEN_SICHTBAR: boolean = false

/**
 * Außen-Rückwand (Phase B) – nur relevant, wenn „Sicht-Rückwand?" aktiv ist.
 * Optional (kein Pflichtbereich); wird separat von `getVisibleKorpusAreas` behandelt.
 */
export const rueckwandAussenArea: KorpusArea = {
  id: 'rueckwandAussen',
  label: 'd. Rückwand Außen',
  hint: 'Sichtbare Außen-Rückwand',
  materialGroupIds: RUECKWAND_GROUPS,
  allowCustom: true,
  required: false,
}

/** Standard-Bereiche (Modus „komplett“). */
export const korpusAreas: KorpusArea[] = [innenArea, aussenArea, abdeckplatteArea]

/**
 * Regel: Welche Korpus-Bereiche sind für Serie & Modus sichtbar?
 * „Innen“ nur bei Velare/Refugium; „getrennt“ ersetzt „Außen“ durch links/rechts.
 *
 * DIESE FUNKTION IST DIE EINZIGE STELLE, an der über die Sichtbarkeit entschieden wird —
 * Material-Schritt, Pflichtprüfung (`isKorpusComplete`), Zusammenfassung und AV-PDF
 * lesen alle von hier. Ein Bereich, der hier fehlt, ist damit überall weg: keine
 * Eingabe, keine Pflicht, keine Ausgabe. Genau deshalb steht die Regel hier und nicht
 * je Komponente.
 */
export function getVisibleKorpusAreas(
  series: ProductSeries | undefined,
  mode: KorpusMode = 'komplett',
): KorpusArea[] {
  const aussen = mode === 'getrennt' ? [aussenLinksArea, aussenRechtsArea] : [aussenArea]
  const all = [innenArea, ...aussen, abdeckplatteArea].map((area) => {
    // Serienbezogene Verwendungsregel (z. B. kein Xtreme Plus innen bei Refugium): Der
    // Bereich kommt hier schon mit der gefilterten Liste heraus — Material-Schritt,
    // Pflichtprüfung, Zusammenfassung und AV-PDF sehen damit alle dieselbe Auswahl.
    const weg = series?.id ? area.ausgeschlosseneGruppenJeSerie?.[series.id] : undefined
    return weg?.length ? { ...area, materialGroupIds: area.materialGroupIds.filter((g) => !weg.includes(g)) } : area
  })
  return all.filter((area) => {
    // „Innen" nur bei Serien mit Innenausführung (Velare/Refugium).
    if (area.requiresInnenSeries && !series?.korpusInnen) return false
    // Serien-Filtering: Abdeckplatte für Serien ohne Abdeckplatte ausblenden (z. B. Refugium).
    if (area.id === 'abdeckplatte' && series?.hasAbdeckplatte === false) return false
    // Serien-Filtering: Kleiderschränke haben keine sichtbare Außenfläche des Korpus —
    // die Seiten sind das Abschlussset, die Vorderseite die Front (Refugium).
    if (area.istAussenkorpus && series?.hasAussenkorpus === false) return false
    return true
  })
}
