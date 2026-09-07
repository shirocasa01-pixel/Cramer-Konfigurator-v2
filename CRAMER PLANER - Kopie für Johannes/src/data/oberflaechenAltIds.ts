/**
 * ALT-IDs DER OBERFLÄCHEN — Auflösung für bereits gespeicherte Entwürfe.
 *
 * Die Options-IDs hießen bis 09/2026 nach dem Farbnamen ohne Zusatz (`schwarz`) und waren
 * damit nur innerhalb ihrer Kategorie eindeutig — „Schwarz" gab es in Decoboard, Mattlack
 * und Gläsern dreimal unter derselben ID. Seit der Umstellung entspricht die ID exakt der
 * Bezeichnung (`schwarz-u190vl`, `schwarz-ral-9005`), ist damit selbsterklärend und über
 * den ganzen Bestand unterscheidbar.
 *
 * Entwürfe, die VOR der Umstellung gespeichert wurden, tragen die alte ID. Ohne diese
 * Tabelle verlören sie ihre Farbe: Zusammenfassung und AV-PDF zeigten die Materialgruppe
 * ohne Ausführung, und die Preisgruppe fiele auf die der Kategorie zurück. Deshalb löst
 * `getMaterialOption()` einen unbekannten Schlüssel zusätzlich hierüber auf.
 *
 * Die Tabelle darf entfallen, sobald kein Entwurf von vor der Umstellung mehr im Umlauf ist.
 */

export interface OberflaechenAltId {
  kategorie: string
  altId: string
  neuId: string
}

export const oberflaechenAltIds: OberflaechenAltId[] = [
  { kategorie: 'decoboard', altId: 'eiche-milano', neuId: 'eiche-milano-r20095nw' },
  { kategorie: 'decoboard', altId: 'sonoma-eiche-hell', neuId: 'sonoma-eiche-hell-r2012bru' },
  { kategorie: 'decoboard', altId: 'okapi-walnut', neuId: 'okapi-walnut-r30135nw' },
  { kategorie: 'decoboard', altId: 'interior-white', neuId: 'interior-white-w10100sd' },
  { kategorie: 'decoboard', altId: 'delphingrau', neuId: 'delphingrau-u12044sd' },
  { kategorie: 'decoboard', altId: 'platingrau', neuId: 'platingrau-u12115sd' },
  { kategorie: 'decoboard', altId: 'anthrazitgrau', neuId: 'anthrazitgrau-u12290sd' },
  { kategorie: 'decoboard', altId: 'kaschmirgrau', neuId: 'kaschmirgrau-u12168sd' },
  { kategorie: 'decoboard', altId: 'congo', neuId: 'congo-u16002sd' },
  { kategorie: 'decoboard', altId: 'schwarz', neuId: 'schwarz-u190vl' },
  { kategorie: 'mattlack', altId: 'verkehrsweiss', neuId: 'verkehrsweiss-ral-9016' },
  { kategorie: 'mattlack', altId: 'reinweiss', neuId: 'reinweiss-ral-9010' },
  { kategorie: 'mattlack', altId: 'edelweiss', neuId: 'edelweiss-sikkens-on-00-78' },
  { kategorie: 'mattlack', altId: 'seidengrau', neuId: 'seidengrau-ral-7044' },
  { kategorie: 'mattlack', altId: 'staubgrau', neuId: 'staubgrau-ral-7037' },
  { kategorie: 'mattlack', altId: 'basaltgrau', neuId: 'basaltgrau-ral-7012' },
  { kategorie: 'mattlack', altId: 'umbragrau', neuId: 'umbragrau-ral-7022' },
  { kategorie: 'mattlack', altId: 'schwarzgrau', neuId: 'schwarzgrau-ral-7021' },
  { kategorie: 'mattlack', altId: 'schwarz', neuId: 'schwarz-ral-9005' },
  { kategorie: 'mattlack', altId: 'sienabraun', neuId: 'sienabraun-sikkens-e0-10-40' },
  { kategorie: 'mattlack', altId: 'beigegrau', neuId: 'beigegrau-ral-7006' },
  { kategorie: 'mattlack', altId: 'graubeige', neuId: 'graubeige-ral-1019' },
  { kategorie: 'mattlack', altId: 'kiesel', neuId: 'kiesel-sikkens-e4-05-55' },
  { kategorie: 'mattlack', altId: 'champagner', neuId: 'champagner-sikkens-f2-05-65' },
  { kategorie: 'mattlack', altId: 'sand', neuId: 'sand-sikkens-f4-04-73' },
  { kategorie: 'mattlack', altId: 'schilf', neuId: 'schilf-sikkens-g3-12-56' },
  { kategorie: 'mattlack', altId: 'oxidrot', neuId: 'oxidrot-ral-3009' },
  { kategorie: 'mattlack', altId: 'rose', neuId: 'ros-ncs-s2010-y90r' },
  { kategorie: 'mattlack', altId: 'aqua', neuId: 'aqua-sikkens-qo-10-50' },
  { kategorie: 'mattlack', altId: 'fjord', neuId: 'fjord-sikkens-uo-10-20' },
  { kategorie: 'mattlack', altId: 'karamell', neuId: 'karamell-sikkens-e7-42-34' },
  { kategorie: 'mattlack', altId: 'curry', neuId: 'curry-sikkens-e8-59-46' },
  { kategorie: 'mattlack', altId: 'goldgelb', neuId: 'goldgelb-sikkens-f2-60-60' },
  { kategorie: 'furnier', altId: 'eiche-molteni-grau', neuId: 'eiche-molteni-grau-lackiert' },
  { kategorie: 'furnier', altId: 'europ-nussbaum-lackiert', neuId: 'europaeischer-nussbaum-lackiert-farbspiel-splint-kern' },
  { kategorie: 'furnier', altId: 'europ-nussbaum-geoelt', neuId: 'europaeischer-nussbaum-geoelt-farbspiel-splint-kern' },
  { kategorie: 'furnier', altId: 'amerik-nussbaum-lackiert', neuId: 'amerikanischer-nussbaum-lackiert' },
  { kategorie: 'furnier', altId: 'amerik-nussbaum-geoelt', neuId: 'amerikanischer-nussbaum-geoelt' },
  { kategorie: 'furnier', altId: 'amerik-nussbaum-weissoel', neuId: 'amerikanischer-nussbaum-weissoel' },
  { kategorie: 'furnier', altId: 'amerik-nussbaum-linea-geoelt', neuId: 'amerikanischer-nussbaum-linea-geoelt' },
  { kategorie: 'furnier', altId: 'amerik-nussbaum-linea-lackiert', neuId: 'amerikanischer-nussbaum-linea-lackiert' },
  { kategorie: 'furnier', altId: 'raeuchereiche-lackiert', neuId: 'raeuchereiche-lackiert-farbton-kann-variieren' },
  { kategorie: 'furnier', altId: 'raeuchereiche-geoelt', neuId: 'raeuchereiche-geoelt-farbton-kann-variieren' },
  { kategorie: 'furnier', altId: 'wenge-dunkel', neuId: 'wenge-dunkel-lackiert' },
  { kategorie: 'xtreme-plus', altId: 'kreide', neuId: 'kreide-u11102xp' },
  { kategorie: 'xtreme-plus', altId: 'delphingrau', neuId: 'delphingrau-u12044xp' },
  { kategorie: 'xtreme-plus', altId: 'platingrau', neuId: 'platingrau-u12115xp' },
  { kategorie: 'xtreme-plus', altId: 'anthrazitgrau', neuId: 'anthrazitgrau-u12290xp' },
  { kategorie: 'xtreme-plus', altId: 'vulkanschwarz', neuId: 'vulkanschwarz-u12000xp' },
  { kategorie: 'xtreme-plus', altId: 'kaschmirgrau', neuId: 'kaschmirgrau-u12168xp' },
  { kategorie: 'sonstiges', altId: 'multiplex-glattweiss', neuId: 'multiplex-glattweiss-18-mm' },
  { kategorie: 'sonstiges', altId: 'linoleum-schwarz-mpx', neuId: 'linoleum-schwarz-auf-mpx' },
  { kategorie: 'sonstiges', altId: 'corian-cameo-white', neuId: 'corian-6-mm-cameo-white' },
  { kategorie: 'akustikpaneele', altId: 'amerik-nussbaum-geoelt', neuId: 'amerikanischer-nussbaum-geoelt' },
]
