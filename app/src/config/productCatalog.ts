/**
 * Zentraler Produktkatalog (Phase 3): Produktfamilien und die je Familie
 * freigeschalteten Serien.
 *
 * Die Serien selbst (ID, Name, Reihenfolge) kommen aus den Stammdaten, Blatt
 * „30 Programme" — sie sind hier nicht mehr hinterlegt. Eine neue Serie ist eine
 * Zeile in `Cramer-Stammdaten.xlsx`.
 *
 * Zwei Dinge stehen bewusst weiterhin hier, weil sie in keiner der beiden
 * Quell-Dateien vorkommen:
 *
 *   1. Die UI-Flags (`korpusInnen`, `hasAbdeckplatte`, …) — Korpus-Regeln aus den
 *      Spezifikations-Dokumenten `CRAMER PLANER - *`.
 *   2. Die Zuordnung Produktfamilie → Serien. Achtung: „Produktgruppe" heißt in der
 *      Excel etwas anderes — dort ist es ein Schritt im Konfigurator (KORPUS, FRONT, …),
 *      nicht die Kachel-Familie (Sideboards, Kleiderschränke, …). Siehe
 *      `schritte` in `src/lib/stammdaten.ts`.
 */

import { getSerie, serien } from '../lib/stammdaten.ts'

export interface ProductSeries {
  id: string
  name: string
  /**
   * Aktiviert den bedingten Korpus-Bereich „Innen“ (Korpus-Regel: nur bei
   * Velare/Refugium sichtbar). Der Variantenname für die Anzeige ist `name`.
   */
  korpusInnen?: boolean
  /**
   * Serien-Filtering: `false` blendet die Abdeckplatte-Auswahl im UI aus
   * (Kleiderschränke/Refugium haben keine Abdeckplatten). `undefined`/`true` ⇒ sichtbar.
   * Die Datenstruktur `korpus['abdeckplatte']` bleibt im Hintergrund für andere Serien erhalten.
   */
  hasAbdeckplatte?: boolean
  /**
   * Serien-Filtering: `false` blendet den „Sicht-Rückwand?"-Schalter im UI aus
   * (Refugium braucht keine Sichtrückwand). `undefined`/`true` ⇒ sichtbar.
   */
  hasSichtRueckwand?: boolean
  /**
   * Schritt 4: `true` schaltet das strukturierte Korpus-Maß-Raster (Höhe/Tiefe-Modi,
   * Breite je Korpus, Abschlussset, Fußleiste) statt der einfachen H/B/T-Eingabe frei.
   * Aktuell nur Refugium.
   */
  korpusRaster?: boolean
  /**
   * Serien-Filtering: `false` blendet den Umschalter „Außenkorpus komplett / getrennt"
   * aus und erzwingt „komplett".
   *
   * Hintergrund (Rückmeldung „Überarbeitung 2", S. 4): Bei Refugium ist die
   * Abdeckplatte ohnehin ausgeblendet, und die sichtbaren Außenseiten sind die
   * Abschlusssets — deren Material wird seit derselben Rückmeldung separat und bei
   * Bedarf links/rechts getrennt abgefragt. Der Umschalter hätte dort keine Wirkung
   * mehr. Bei Atrium, Velare und Publicum existiert die Abdeckplatte und der
   * Außenkorpus ist sichtbar; dort trägt die Unterscheidung weiterhin.
   */
  hasAussenkorpusModus?: boolean
  /**
   * Serien-Filtering: `false` entfernt den Material-Bereich „Korpus außen" vollständig
   * (auch die getrennten Varianten links/rechts). `undefined`/`true` ⇒ sichtbar.
   *
   * Hintergrund: Bei einem Kleiderschrank gibt es keine sichtbare Außenfläche des
   * Korpus. Jede Oberfläche ist an anderer Stelle bereits festgelegt —
   *
   *     Korpus innen   →  Innenausführung
   *     Seiten außen   →  Abschlussset (eigene Materialwahl, links/rechts trennbar)
   *     Front          →  Fronten-Auswahl
   *
   * Die zusätzliche Abfrage war damit redundant und hat im schlimmsten Fall eine
   * Preisgruppe geliefert, die zu keiner sichtbaren Fläche gehört.
   */
  hasAussenkorpus?: boolean
}

export interface ProductGroup {
  id: string
  name: string
  /** Kurzbeschreibung für die Kachel. */
  description: string
  /** false => Kachel sichtbar, aber deaktiviert (Platzhalter ohne Funktion). */
  active: boolean
  /** Regelbasis: nur diese Serien sind für die Gruppe zulässig. */
  series: ProductSeries[]
}

/**
 * UI-Regeln je Serie. Stehen in keiner Quell-Datei, sondern in den Spezifikations-
 * Dokumenten — deshalb hier und nicht in den Stammdaten. ID und Name kommen aus der Mappe.
 */
const SERIEN_UI_REGELN: Record<string, Omit<ProductSeries, 'id' | 'name'>> = {
  velare: { korpusInnen: true },
  refugium: {
    korpusInnen: true,
    hasAbdeckplatte: false,
    hasSichtRueckwand: false,
    korpusRaster: true,
    hasAussenkorpusModus: false,
    hasAussenkorpus: false,
  },
}

/** Serie aus den Stammdaten + UI-Regeln. Unbekannte ID ⇒ Fehler beim Start, nicht stumm. */
function serie(id: string): ProductSeries {
  const stamm = getSerie(id)
  if (!stamm) {
    throw new Error(
      `Serie "${id}" steht nicht in den Stammdaten (Blatt „30 Programme"). ` +
        `Bekannt: ${serien.map((s) => s.id).join(', ')}. Ggf. „npm run data:build" ausführen.`,
    )
  }
  return { id: stamm.id, name: stamm.name, ...SERIEN_UI_REGELN[stamm.id] }
}

// Serien-Registry – jede Serie einmal aufgelöst, mehrfach referenzierbar
// (z. B. Atrium/Publicum kommen in mehreren Familien vor).
const S = {
  atrium: serie('atrium'),
  porticus: serie('porticus'),
  publicum: serie('publicum'),
  velare: serie('velare'),
  refugium: serie('refugium'),
  cavum: serie('cavum'),
  supersonus: serie('supersonus'),
  tavolo: serie('tavolo'),
  arcum: serie('arcum'),
} satisfies Record<string, ProductSeries>

export const productGroups: ProductGroup[] = [
  {
    id: 'sideboards',
    name: 'Sideboards',
    description: 'Kommoden & Sideboards',
    active: true,
    series: [S.atrium, S.porticus, S.publicum, S.velare],
  },
  {
    id: 'kleiderschraenke',
    name: 'Kleiderschränke',
    description: 'Schränke & Garderoben',
    active: true,
    series: [S.refugium],
  },
  {
    id: 'regale',
    name: 'Regale / Wohnwände',
    description: 'Regale & Wohnwände',
    active: true,
    series: [S.atrium, S.publicum],
  },
  {
    id: 'medienmoebel',
    name: 'Medienmöbel',
    description: 'TV- & Medienmöbel',
    active: true,
    series: [S.cavum, S.supersonus],
  },
  {
    id: 'tische',
    name: 'Tische',
    description: 'Ess- & Beistelltische',
    active: true,
    series: [S.tavolo, S.arcum],
  },
  // Inaktive Platzhalter – sichtbar, aber (laut Spezifikation) ohne Funktion.
  { id: 'sitzen', name: 'Sitzen', description: 'In Vorbereitung', active: false, series: [] },
  { id: 'schlafen', name: 'Schlafen', description: 'In Vorbereitung', active: false, series: [] },
]

/** Produktgruppe per ID. */
export function getProductGroup(id: string | undefined): ProductGroup | undefined {
  return id ? productGroups.find((group) => group.id === id) : undefined
}

/**
 * Serie per ID – nur gültig, wenn sie zur angegebenen Gruppe gehört
 * (Regel: keine gruppenfremden Serien).
 */
export function getSeries(
  groupId: string | undefined,
  seriesId: string | undefined,
): ProductSeries | undefined {
  const group = getProductGroup(groupId)
  return group && seriesId ? group.series.find((series) => series.id === seriesId) : undefined
}
