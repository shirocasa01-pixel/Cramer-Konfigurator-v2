import type { MaterialGroup, MaterialOption } from '../types'

/** Sonderfall-IDs für Material-Auswahlen (kein echter Matrix-Eintrag). */
export const MATERIAL_CUSTOM_ID = 'anders'
export const MATERIAL_NONE_ID = 'keine'

/**
 * ZENTRALE MATERIAL-, FARB- & PREISGRUPPENMATRIX ("das Gehirn").
 *
 * 1:1-Abbild aus `CRAMER PLANER - Farbmatrix`. Einzige Datenquelle für ALLE
 * Material-Dropdowns (Phase 4 Korpus und Phase 5 Fronten/Schübe) – dadurch keine
 * Duplizierung und eine einheitliche Datenbasis (Farbmatrix, Regel 3).
 *
 * Preisgruppe: Standard je Gruppe; Ausnahmen (z. B. Wengé) via `option.priceGroup`.
 * Neue Materialien/Farben/PGs werden ausschließlich hier gepflegt.
 */
export const materialGroups: MaterialGroup[] = [
  {
    id: 'decoboard',
    label: 'Decoboard',
    priceGroup: 'PG1',
    options: [
      // Holzdekore
      { id: 'eiche-milano', label: 'Eiche Milano (R20095NW)' },
      { id: 'sonoma-eiche-hell', label: 'Sonoma Eiche hell (R2012BRU)' },
      { id: 'okapi-walnut', label: 'Okapi Walnut (R30135NW)' },
      // Unifarben
      { id: 'interior-white', label: 'Interior White (W10100SD)' },
      { id: 'delphingrau', label: 'Delphingrau (U12044SD)' },
      { id: 'platingrau', label: 'Platingrau (U12115SD)' },
      { id: 'anthrazitgrau', label: 'Anthrazitgrau (U12290SD)' },
      { id: 'kaschmirgrau', label: 'Kaschmirgrau (U12168SD)' },
      { id: 'congo', label: 'Congo (U16002SD)' },
      { id: 'schwarz', label: 'Schwarz (U190VL)' },
    ],
  },
  {
    id: 'mattlack',
    label: 'Mattlack',
    priceGroup: 'PG2',
    options: [
      { id: 'verkehrsweiss', label: 'Verkehrsweiß (RAL 9016)' },
      { id: 'reinweiss', label: 'Reinweiß (RAL 9010)' },
      { id: 'grauweiss', label: 'Grauweiß (RAL 9002)' },
      { id: 'seidengrau', label: 'Seidengrau (RAL 7044)' },
      { id: 'staubgrau', label: 'Staubgrau (RAL 7037)' },
      { id: 'cremeweiss', label: 'Cremeweiß (RAL 9001)' },
      { id: 'graubeige', label: 'Graubeige (RAL 1019)' },
      { id: 'beigegrau', label: 'Beigegrau (RAL 7006)' },
      { id: 'quarzgrau', label: 'Quarzgrau (RAL 7039)' },
      { id: 'basaltgrau', label: 'Basaltgrau (RAL 7012)' },
      { id: 'graphitgrau', label: 'Graphitgrau (RAL 7024)' },
      { id: 'schwarzgrau', label: 'Schwarzgrau (RAL 7021)' },
      { id: 'schwarz', label: 'Schwarz (RAL 9005)' },
      // Sonderfarben (Schritt 5) – bei Auswahl öffnet sich ein Freitextfeld für die Farbbezeichnung.
      // (Die überarbeitete PG-2-Standardliste liefert der Fachberater separat nach – Frage B2.)
      { id: 'ral-classic', label: 'RAL Classic (Sonderfarbe)', priceGroup: 'PG3', requiresFreeText: true, freeTextLabel: 'RAL-Classic-Farbbezeichnung' },
      { id: 'ncs', label: 'NCS (Sonderfarbe)', priceGroup: 'PG4', requiresFreeText: true, freeTextLabel: 'NCS-Farbbezeichnung' },
      { id: 'ral-design', label: 'RAL Design (Sonderfarbe)', priceGroup: 'PG4', requiresFreeText: true, freeTextLabel: 'RAL-Design-Farbbezeichnung' },
      { id: 'sikkens', label: 'Sikkens (Sonderfarbe)', priceGroup: 'PG4', requiresFreeText: true, freeTextLabel: 'Sikkens-Farbbezeichnung' },
    ],
  },
  {
    id: 'furnier',
    label: 'Furnier',
    priceGroup: 'PG3',
    options: [
      // Furnier-Oberflächen PG 3 (Schritt 5, Fachberater-Stand 06/2026)
      { id: 'eiche-lackiert', label: 'Eiche lackiert' },
      { id: 'eiche-geoelt', label: 'Eiche geölt' },
      { id: 'eiche-puro-geoelt', label: 'Eiche Puro geölt' },
      { id: 'eiche-weissoel', label: 'Eiche Weißöl' },
      { id: 'eiche-molteni-grau', label: 'Eiche Molteni grau lackiert' },
      { id: 'eiche-schwarzoel', label: 'Eiche Schwarzöl' },
      { id: 'kirsche-lackiert', label: 'Kirsche lackiert' },
      { id: 'kirsche-geoelt', label: 'Kirsche geölt' },
      { id: 'europ-nussbaum-lackiert', label: 'Europäischer Nussbaum lackiert (Farbspiel Splint/Kern)' },
      { id: 'europ-nussbaum-geoelt', label: 'Europäischer Nussbaum geölt (Farbspiel Splint/Kern)' },
      { id: 'amerik-nussbaum-lackiert', label: 'Amerikanischer Nussbaum lackiert' },
      { id: 'amerik-nussbaum-geoelt', label: 'Amerikanischer Nussbaum geölt' },
      { id: 'amerik-nussbaum-weissoel', label: 'Amerikanischer Nussbaum Weißöl' },
      { id: 'amerik-nussbaum-linea-geoelt', label: 'Amerikanischer Nussbaum Linea geölt' },
      { id: 'amerik-nussbaum-linea-lackiert', label: 'Amerikanischer Nussbaum Linea lackiert' },
      // Premium-Edelholz (Ausnahme: PG 4)
      { id: 'wenge-dunkel', label: 'Wenge dunkel lackiert', priceGroup: 'PG4' },
    ],
  },
  {
    id: 'glas',
    label: 'Gläser',
    priceGroup: 'PG3',
    options: [
      { id: 'weiss-optiwhite', label: 'Weiß optiwhite' },
      { id: 'latte-macchiato', label: 'Latte Macchiato' },
      { id: 'stone', label: 'Stone' },
      { id: 'earth', label: 'Earth' },
      { id: 'wood', label: 'Wood' },
      { id: 'volcano', label: 'Volcano' },
      { id: 'schwarz', label: 'Schwarz' },
      { id: 'pure-white-noprint', label: 'Pure white noprint' },
      { id: 'satinato-spiegel', label: 'Satinato Spiegel' },
      { id: 'silver-grey', label: 'Silver grey' },
      { id: 'silver-bronze', label: 'Silver bronze' },
      { id: 'black-satina', label: 'Black satina' },
      { id: 'rauchglas-grau', label: 'Rauchglas grau' },
      { id: 'rauchglas-dark-grey', label: 'Rauchglas dark grey' },
      // Hinterlackierte Gläser (Schritt 5) – bei Auswahl öffnet sich ein Freitextfeld für die Wunsch-Lackfarbe.
      { id: 'weissglas-hinterlackiert', label: 'Weißglas hinterlackiert', requiresFreeText: true, freeTextLabel: 'Wunsch-Lackfarbe' },
      { id: 'weissglas-satina-hinterlackiert', label: 'Weißglas satina hinterlackiert', requiresFreeText: true, freeTextLabel: 'Wunsch-Lackfarbe' },
      { id: 'wave-hinterlackiert', label: 'Wave hinterlackiert', requiresFreeText: true, freeTextLabel: 'Wunsch-Lackfarbe' },
    ],
  },
  {
    id: 'xtreme-plus',
    label: 'Xtreme Plus',
    priceGroup: 'PG4',
    options: [
      { id: 'kreide', label: 'Kreide (U11102XP)' },
      { id: 'delphingrau', label: 'Delphingrau (U12044XP)' },
      { id: 'platingrau', label: 'Platingrau (U12115XP)' },
      { id: 'anthrazitgrau', label: 'Anthrazitgrau (U12290XP)' },
      { id: 'vulkanschwarz', label: 'Vulkanschwarz (U12000XP)' },
      { id: 'kaschmirgrau', label: 'Kaschmirgrau (U12168XP)' },
    ],
  },
  {
    /**
     * Punkt 5.10 — Dietmar: „Ich möchte, dass MPX, Linoleum schwarz und Corian 6 mm
     * nur über ‚anders‘ wählbar ist. Kommt sehr selten vor."
     *
     * Die Gruppe steht deshalb in KEINER Bereichs- oder Front-Konfiguration und
     * erscheint damit in keinem Dropdown. Sie bleibt als Nachschlagewerk erhalten
     * (Preisgruppe PG 4), damit der Berater beim Freitext weiß, was er einträgt.
     */
    id: 'sonstiges',
    label: 'Sonstiges / Sonderwerkstoffe (nur über „anders")',
    priceGroup: 'PG4',
    options: [
      { id: 'multiplex-glattweiss', label: 'Multiplex glattweiß 18 mm' },
      { id: 'linoleum-schwarz-mpx', label: 'Linoleum schwarz auf MPX' },
      { id: 'corian-cameo-white', label: 'Corian 6 mm Cameo white' },
    ],
  },
  {
    // Spezial-Option; in der Farbmatrix ohne Preisgruppe geführt (bewusst offen gelassen).
    id: 'akustikpaneele',
    label: 'Akustikpaneele',
    priceGroup: undefined,
    options: [
      { id: 'amerik-nussbaum-geoelt', label: 'Amerikanischer Nussbaum geölt' },
      { id: 'eiche-geoelt', label: 'Eiche geölt' },
    ],
  },
]

/** Materialgruppe per ID. */
export function getMaterialGroup(id: string | undefined): MaterialGroup | undefined {
  return id ? materialGroups.find((group) => group.id === id) : undefined
}

/** Konkrete Option innerhalb einer Materialgruppe. */
export function getMaterialOption(
  groupId: string | undefined,
  optionId: string | undefined,
): MaterialOption | undefined {
  const group = getMaterialGroup(groupId)
  return group && optionId ? group.options.find((option) => option.id === optionId) : undefined
}

/**
 * ALLE „Rauchglas"-Optionen der Glas-Gruppe – dynamisch aus der Matrix ermittelt
 * (Treffer per ID ODER Label), damit jede – auch künftige – Rauchglas-Variante
 * automatisch erfasst wird. Werden z. B. für die Abdeckplatte vollständig ausgeschlossen.
 */
export const RAUCHGLAS_OPTION_IDS: string[] = (
  materialGroups.find((group) => group.id === 'glas')?.options ?? []
)
  .filter((option) => /rauchglas/i.test(option.id) || /rauchglas/i.test(option.label))
  .map((option) => option.id)
