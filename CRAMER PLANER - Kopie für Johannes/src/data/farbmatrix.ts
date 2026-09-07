/**
 * FARBMATRIX — GRUNDSTAND DER OBERFLÄCHEN-STAMMDATEN.
 *
 * Dieselbe Rolle wie `stammdaten.generated.ts` für Artikel und Preiszeilen: die Datei ist
 * der unveränderte Ausgangsbestand. Bearbeitet wird NICHT hier, sondern im Reiter
 * „Oberflächen" der Stammdatenverwaltung; die Abweichung liegt als Overlay im
 * `stammdatenStore` und überlebt damit einen neuen Grundstand.
 *
 *     farbmatrix.ts (Grundstand) ──+── Overlay (Verwaltung) ──> stammdatenStore
 *                                                                    │
 *                                            config/materialMatrix.ts (Zugriffsschicht)
 *                                                                    │
 *                                   Korpus- und Front-Dropdowns · Preisgruppen · Kalkulation
 *
 * ZWEI EBENEN:
 *   1. Oberflächenkategorie (Mattlack, Decoboard, Gläser …) — trägt die Preisgruppe.
 *   2. Oberfläche (Schwarz RAL 9005, Eiche Milano …) — verweist auf ihre Kategorie und
 *      erbt deren Preisgruppe, sofern sie keine eigene trägt (z. B. Wengé PG 4 in PG 3).
 *
 * Neue Farben gehören in die Verwaltung, nicht in diese Datei — sie ist der Stand, auf den
 * „Zurücksetzen" zurückfällt.
 */

import type { Oberflaeche, Oberflaechenkategorie } from '../types/index.ts'

/** Ebene 1 — Oberflächenkategorien mit ihrer Preisgruppe. */
export const basisOberflaechenkategorien: Oberflaechenkategorie[] = [
  { id: 'decoboard', bezeichnung: 'Decoboard', preisgruppe: 'PG1', standardauswahl: true, sortierung: 10, status: 'aktiv', bemerkung: '' },
  { id: 'mattlack', bezeichnung: 'Mattlack', preisgruppe: 'PG2', standardauswahl: true, sortierung: 20, status: 'aktiv', bemerkung: '' },
  { id: 'furnier', bezeichnung: 'Furnier', preisgruppe: 'PG3', standardauswahl: true, sortierung: 30, status: 'aktiv', bemerkung: '' },
  { id: 'glas', bezeichnung: 'Gläser', preisgruppe: 'PG3', standardauswahl: true, sortierung: 40, status: 'aktiv', bemerkung: '' },
  { id: 'xtreme-plus', bezeichnung: 'Xtreme Plus', preisgruppe: 'PG4', standardauswahl: true, sortierung: 50, status: 'aktiv', bemerkung: '' },
  { id: 'sonstiges', bezeichnung: 'Sonstiges / Sonderwerkstoffe (nur über „anders")', preisgruppe: 'PG4', standardauswahl: false, sortierung: 60, status: 'aktiv', bemerkung: 'Punkt 5.10 — nur über „anders" wählbar; steht in keiner Bereichs- oder Front-Konfiguration.' },
  { id: 'akustikpaneele', bezeichnung: 'Akustikpaneele', preisgruppe: '', standardauswahl: false, sortierung: 70, status: 'aktiv', bemerkung: 'In der Farbmatrix bewusst ohne Preisgruppe geführt.' },
]

/** Ebene 2 — konkrete Oberflächen/Farben, je einer Kategorie zugeordnet. */
export const basisOberflaechen: Oberflaeche[] = [
  { id: 'eiche-milano-r20095nw', kategorie: 'decoboard', bezeichnung: 'Eiche Milano (R20095NW)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 10, status: 'aktiv', bemerkung: '' },
  { id: 'sonoma-eiche-hell-r2012bru', kategorie: 'decoboard', bezeichnung: 'Sonoma Eiche hell (R2012BRU)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 20, status: 'aktiv', bemerkung: '' },
  { id: 'okapi-walnut-r30135nw', kategorie: 'decoboard', bezeichnung: 'Okapi Walnut (R30135NW)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 30, status: 'aktiv', bemerkung: '' },
  { id: 'interior-white-w10100sd', kategorie: 'decoboard', bezeichnung: 'Interior White (W10100SD)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 40, status: 'aktiv', bemerkung: '' },
  { id: 'delphingrau-u12044sd', kategorie: 'decoboard', bezeichnung: 'Delphingrau (U12044SD)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 50, status: 'aktiv', bemerkung: '' },
  { id: 'platingrau-u12115sd', kategorie: 'decoboard', bezeichnung: 'Platingrau (U12115SD)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 60, status: 'aktiv', bemerkung: '' },
  { id: 'anthrazitgrau-u12290sd', kategorie: 'decoboard', bezeichnung: 'Anthrazitgrau (U12290SD)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 70, status: 'aktiv', bemerkung: '' },
  { id: 'kaschmirgrau-u12168sd', kategorie: 'decoboard', bezeichnung: 'Kaschmirgrau (U12168SD)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 80, status: 'aktiv', bemerkung: '' },
  { id: 'congo-u16002sd', kategorie: 'decoboard', bezeichnung: 'Congo (U16002SD)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 90, status: 'aktiv', bemerkung: '' },
  { id: 'schwarz-u190vl', kategorie: 'decoboard', bezeichnung: 'Schwarz (U190VL)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 100, status: 'aktiv', bemerkung: '' },
  { id: 'verkehrsweiss-ral-9016', kategorie: 'mattlack', bezeichnung: 'Verkehrsweiß RAL 9016', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 10, status: 'aktiv', bemerkung: '' },
  { id: 'reinweiss-ral-9010', kategorie: 'mattlack', bezeichnung: 'Reinweiß RAL 9010', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 20, status: 'aktiv', bemerkung: '' },
  { id: 'edelweiss-sikkens-on-00-78', kategorie: 'mattlack', bezeichnung: 'Edelweiß Sikkens ON.00.78', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 30, status: 'aktiv', bemerkung: '' },
  { id: 'seidengrau-ral-7044', kategorie: 'mattlack', bezeichnung: 'Seidengrau RAL 7044', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 40, status: 'aktiv', bemerkung: '' },
  { id: 'staubgrau-ral-7037', kategorie: 'mattlack', bezeichnung: 'Staubgrau RAL 7037', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 50, status: 'aktiv', bemerkung: '' },
  { id: 'basaltgrau-ral-7012', kategorie: 'mattlack', bezeichnung: 'Basaltgrau RAL 7012', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 60, status: 'aktiv', bemerkung: '' },
  { id: 'umbragrau-ral-7022', kategorie: 'mattlack', bezeichnung: 'Umbragrau RAL 7022', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 70, status: 'aktiv', bemerkung: '' },
  { id: 'schwarzgrau-ral-7021', kategorie: 'mattlack', bezeichnung: 'Schwarzgrau RAL 7021', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 80, status: 'aktiv', bemerkung: '' },
  { id: 'schwarz-ral-9005', kategorie: 'mattlack', bezeichnung: 'Schwarz RAL 9005', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 90, status: 'aktiv', bemerkung: '' },
  { id: 'sienabraun-sikkens-e0-10-40', kategorie: 'mattlack', bezeichnung: 'Sienabraun Sikkens E0.10.40', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 100, status: 'aktiv', bemerkung: '' },
  { id: 'beigegrau-ral-7006', kategorie: 'mattlack', bezeichnung: 'Beigegrau RAL 7006', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 110, status: 'aktiv', bemerkung: '' },
  { id: 'graubeige-ral-1019', kategorie: 'mattlack', bezeichnung: 'Graubeige RAL 1019', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 120, status: 'aktiv', bemerkung: '' },
  { id: 'kiesel-sikkens-e4-05-55', kategorie: 'mattlack', bezeichnung: 'Kiesel Sikkens E4.05.55', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 130, status: 'aktiv', bemerkung: '' },
  { id: 'champagner-sikkens-f2-05-65', kategorie: 'mattlack', bezeichnung: 'Champagner Sikkens F2.05.65', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 140, status: 'aktiv', bemerkung: '' },
  { id: 'sand-sikkens-f4-04-73', kategorie: 'mattlack', bezeichnung: 'Sand Sikkens F4.04.73', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 150, status: 'aktiv', bemerkung: '' },
  { id: 'schilf-sikkens-g3-12-56', kategorie: 'mattlack', bezeichnung: 'Schilf Sikkens G3.12.56', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 160, status: 'aktiv', bemerkung: '' },
  { id: 'oxidrot-ral-3009', kategorie: 'mattlack', bezeichnung: 'Oxidrot RAL 3009', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 170, status: 'aktiv', bemerkung: '' },
  { id: 'ros-ncs-s2010-y90r', kategorie: 'mattlack', bezeichnung: 'Rosé NCS S2010-Y90R', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 180, status: 'aktiv', bemerkung: '' },
  { id: 'aqua-sikkens-qo-10-50', kategorie: 'mattlack', bezeichnung: 'Aqua Sikkens QO.10.50', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 190, status: 'aktiv', bemerkung: '' },
  { id: 'fjord-sikkens-uo-10-20', kategorie: 'mattlack', bezeichnung: 'Fjord Sikkens UO.10.20', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 200, status: 'aktiv', bemerkung: '' },
  { id: 'karamell-sikkens-e7-42-34', kategorie: 'mattlack', bezeichnung: 'Karamell Sikkens E7.42.34', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 210, status: 'aktiv', bemerkung: '' },
  { id: 'curry-sikkens-e8-59-46', kategorie: 'mattlack', bezeichnung: 'Curry Sikkens E8.59.46', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 220, status: 'aktiv', bemerkung: '' },
  { id: 'goldgelb-sikkens-f2-60-60', kategorie: 'mattlack', bezeichnung: 'Goldgelb Sikkens F2.60.60', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 230, status: 'aktiv', bemerkung: '' },
  { id: 'eiche-lackiert', kategorie: 'furnier', bezeichnung: 'Eiche lackiert', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 10, status: 'aktiv', bemerkung: '' },
  { id: 'eiche-geoelt', kategorie: 'furnier', bezeichnung: 'Eiche geölt', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 20, status: 'aktiv', bemerkung: '' },
  { id: 'eiche-puro-geoelt', kategorie: 'furnier', bezeichnung: 'Eiche Puro geölt', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 30, status: 'aktiv', bemerkung: '' },
  { id: 'eiche-weissoel', kategorie: 'furnier', bezeichnung: 'Eiche Weißöl', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 40, status: 'aktiv', bemerkung: '' },
  { id: 'eiche-molteni-grau-lackiert', kategorie: 'furnier', bezeichnung: 'Eiche Molteni grau lackiert', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 50, status: 'aktiv', bemerkung: '' },
  { id: 'eiche-schwarzoel', kategorie: 'furnier', bezeichnung: 'Eiche Schwarzöl', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 60, status: 'aktiv', bemerkung: '' },
  { id: 'kirsche-lackiert', kategorie: 'furnier', bezeichnung: 'Kirsche lackiert', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 70, status: 'aktiv', bemerkung: '' },
  { id: 'kirsche-geoelt', kategorie: 'furnier', bezeichnung: 'Kirsche geölt', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 80, status: 'aktiv', bemerkung: '' },
  { id: 'europaeischer-nussbaum-lackiert-farbspiel-splint-kern', kategorie: 'furnier', bezeichnung: 'Europäischer Nussbaum lackiert (Farbspiel Splint/Kern)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 90, status: 'aktiv', bemerkung: '' },
  { id: 'europaeischer-nussbaum-geoelt-farbspiel-splint-kern', kategorie: 'furnier', bezeichnung: 'Europäischer Nussbaum geölt (Farbspiel Splint/Kern)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 100, status: 'aktiv', bemerkung: '' },
  { id: 'amerikanischer-nussbaum-lackiert', kategorie: 'furnier', bezeichnung: 'Amerikanischer Nussbaum lackiert', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 110, status: 'aktiv', bemerkung: '' },
  { id: 'amerikanischer-nussbaum-geoelt', kategorie: 'furnier', bezeichnung: 'Amerikanischer Nussbaum geölt', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 120, status: 'aktiv', bemerkung: '' },
  { id: 'amerikanischer-nussbaum-weissoel', kategorie: 'furnier', bezeichnung: 'Amerikanischer Nussbaum Weißöl', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 130, status: 'aktiv', bemerkung: '' },
  { id: 'amerikanischer-nussbaum-linea-geoelt', kategorie: 'furnier', bezeichnung: 'Amerikanischer Nussbaum Linea geölt', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 140, status: 'aktiv', bemerkung: '' },
  { id: 'amerikanischer-nussbaum-linea-lackiert', kategorie: 'furnier', bezeichnung: 'Amerikanischer Nussbaum Linea lackiert', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 150, status: 'aktiv', bemerkung: '' },
  { id: 'raeuchereiche-lackiert-farbton-kann-variieren', kategorie: 'furnier', bezeichnung: 'Räuchereiche lackiert (Farbton kann variieren)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 160, status: 'aktiv', bemerkung: '' },
  { id: 'raeuchereiche-geoelt-farbton-kann-variieren', kategorie: 'furnier', bezeichnung: 'Räuchereiche geölt (Farbton kann variieren)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 170, status: 'aktiv', bemerkung: '' },
  { id: 'wenge-dunkel-lackiert', kategorie: 'furnier', bezeichnung: 'Wenge dunkel lackiert', preisgruppe: 'PG4', freitext: false, freitextLabel: '', sortierung: 180, status: 'aktiv', bemerkung: '' },
  { id: 'weiss-optiwhite', kategorie: 'glas', bezeichnung: 'Weiß optiwhite', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 10, status: 'aktiv', bemerkung: '' },
  { id: 'latte-macchiato', kategorie: 'glas', bezeichnung: 'Latte Macchiato', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 20, status: 'aktiv', bemerkung: '' },
  { id: 'stone', kategorie: 'glas', bezeichnung: 'Stone', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 30, status: 'aktiv', bemerkung: '' },
  { id: 'earth', kategorie: 'glas', bezeichnung: 'Earth', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 40, status: 'aktiv', bemerkung: '' },
  { id: 'wood', kategorie: 'glas', bezeichnung: 'Wood', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 50, status: 'aktiv', bemerkung: '' },
  { id: 'volcano', kategorie: 'glas', bezeichnung: 'Volcano', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 60, status: 'aktiv', bemerkung: '' },
  { id: 'schwarz', kategorie: 'glas', bezeichnung: 'Schwarz', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 70, status: 'aktiv', bemerkung: '' },
  { id: 'pure-white-noprint', kategorie: 'glas', bezeichnung: 'Pure white noprint', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 80, status: 'aktiv', bemerkung: '' },
  { id: 'satinato-spiegel', kategorie: 'glas', bezeichnung: 'Satinato Spiegel', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 90, status: 'aktiv', bemerkung: '' },
  { id: 'silver-grey', kategorie: 'glas', bezeichnung: 'Silver grey', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 100, status: 'aktiv', bemerkung: '' },
  { id: 'silver-bronze', kategorie: 'glas', bezeichnung: 'Silver bronze', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 110, status: 'aktiv', bemerkung: '' },
  { id: 'black-satina', kategorie: 'glas', bezeichnung: 'Black satina', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 120, status: 'aktiv', bemerkung: '' },
  { id: 'rauchglas-grau', kategorie: 'glas', bezeichnung: 'Rauchglas grau', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 130, status: 'aktiv', bemerkung: '' },
  { id: 'rauchglas-dark-grey', kategorie: 'glas', bezeichnung: 'Rauchglas dark grey', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 140, status: 'aktiv', bemerkung: '' },
  { id: 'weissglas-hinterlackiert', kategorie: 'glas', bezeichnung: 'Weißglas hinterlackiert', preisgruppe: '', freitext: true, freitextLabel: 'Wunsch-Lackfarbe', sortierung: 150, status: 'aktiv', bemerkung: '' },
  { id: 'weissglas-satina-hinterlackiert', kategorie: 'glas', bezeichnung: 'Weißglas satina hinterlackiert', preisgruppe: '', freitext: true, freitextLabel: 'Wunsch-Lackfarbe', sortierung: 160, status: 'aktiv', bemerkung: '' },
  { id: 'wave-hinterlackiert', kategorie: 'glas', bezeichnung: 'Wave hinterlackiert', preisgruppe: '', freitext: true, freitextLabel: 'Wunsch-Lackfarbe', sortierung: 170, status: 'aktiv', bemerkung: '' },
  { id: 'kreide-u11102xp', kategorie: 'xtreme-plus', bezeichnung: 'Kreide (U11102XP)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 10, status: 'aktiv', bemerkung: '' },
  { id: 'delphingrau-u12044xp', kategorie: 'xtreme-plus', bezeichnung: 'Delphingrau (U12044XP)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 20, status: 'aktiv', bemerkung: '' },
  { id: 'platingrau-u12115xp', kategorie: 'xtreme-plus', bezeichnung: 'Platingrau (U12115XP)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 30, status: 'aktiv', bemerkung: '' },
  { id: 'anthrazitgrau-u12290xp', kategorie: 'xtreme-plus', bezeichnung: 'Anthrazitgrau (U12290XP)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 40, status: 'aktiv', bemerkung: '' },
  { id: 'vulkanschwarz-u12000xp', kategorie: 'xtreme-plus', bezeichnung: 'Vulkanschwarz (U12000XP)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 50, status: 'aktiv', bemerkung: '' },
  { id: 'kaschmirgrau-u12168xp', kategorie: 'xtreme-plus', bezeichnung: 'Kaschmirgrau (U12168XP)', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 60, status: 'aktiv', bemerkung: '' },
  { id: 'multiplex-glattweiss-18-mm', kategorie: 'sonstiges', bezeichnung: 'Multiplex glattweiß 18 mm', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 10, status: 'aktiv', bemerkung: '' },
  { id: 'linoleum-schwarz-auf-mpx', kategorie: 'sonstiges', bezeichnung: 'Linoleum schwarz auf MPX', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 20, status: 'aktiv', bemerkung: '' },
  { id: 'corian-6-mm-cameo-white', kategorie: 'sonstiges', bezeichnung: 'Corian 6 mm Cameo white', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 30, status: 'aktiv', bemerkung: '' },
  { id: 'amerikanischer-nussbaum-geoelt', kategorie: 'akustikpaneele', bezeichnung: 'Amerikanischer Nussbaum geölt', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 10, status: 'aktiv', bemerkung: '' },
  { id: 'eiche-geoelt', kategorie: 'akustikpaneele', bezeichnung: 'Eiche geölt', preisgruppe: '', freitext: false, freitextLabel: '', sortierung: 20, status: 'aktiv', bemerkung: '' },
]
