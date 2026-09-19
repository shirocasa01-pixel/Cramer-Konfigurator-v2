/**
 * EBENE 2 — DER MODUL-BAUKASTEN.
 *
 * Die vier Ebenen des Konfigurators, von oben nach unten:
 *
 *   EBENE 1  BENUTZEROBERFLÄCHE      was Berater und Kunde sehen — 1:1, ohne Beiwerk
 *   EBENE 2  MODULE                  fertig programmierte Bausteine (Korpus, Maße,
 *                                    Oberfläche, Ausstattung …). Der Administrator sieht
 *                                    sie im echten Layout, beschriftet sie und ordnet sie
 *                                    an. Die RECHENLOGIK bleibt im Code.
 *   EBENE 3  DROPDOWN-VERWALTUNG     jedes Auswahlfeld trägt seinen dreistelligen
 *                                    Dropdown-Code (DDD) aus `TT-DDD-NNNN`
 *   EBENE 4  ARTIKEL- & STAMMDATEN   die einzige Datenquelle für Preise, Preisachsen,
 *                                    Farben und Verfügbarkeiten
 *
 * Diese Datei beschreibt Ebene 2 und verankert sie nach unten. Sie enthält bewusst KEINE
 * Dropdown-Nummern als eigene Angabe: Verankert wird über die ARTIKELNUMMER aus
 * `config/preisMapping.ts` — deren mittlerer Block IST die Dropdown-Nummer. Dadurch kann
 * die Anzeige nicht von der Kalkulation abweichen; beide lesen dieselbe Zuordnung. Ein
 * Feld, das keinen Artikel bepreist (Freitexte, Maßeingaben), sagt das ebenso deutlich.
 */

import {
  ausstattungLookups,
  containerLookups,
  frontLookups,
  serienRegeln,
  verblendungLookups,
  type BauteilLookup,
} from './preisMapping.ts'

// ---------------------------------------------------------------------------
// Module (Ebene 2)
// ---------------------------------------------------------------------------

export interface ModulDefinition {
  id: string
  /** Name, wie ihn der Administrator im Inspector liest. */
  name: string
  /** Schritt (Abschnitt-ID des Schemas), in dem das Modul steht. */
  abschnitt: string
  /** Wofür das Modul zuständig ist — ein Satz, keine Bedienungsanleitung. */
  zweck: string
}

/**
 * Der Katalog der Module. Bewusst eine feste Liste im Code: Ein Modul ist programmierter
 * Ablauf (Maßrechnung, Preisgruppen-Kopplung, Rasterableitung), kein Datensatz. Was der
 * Administrator daran ändern darf — Beschriftung, Hinweis, Reihenfolge — liegt im Schema.
 */
export const moduleKatalog: ModulDefinition[] = [
  {
    id: 'auftragskopf',
    name: 'Auftragskopf-Modul',
    abschnitt: 'auftragskopf',
    zweck: 'Kunde, Filiale, Auftrags- und Artikelnummer sowie die automatisch erfassten Angaben.',
  },
  {
    id: 'produktwahl',
    name: 'Produktwahl-Modul',
    abschnitt: 'produkt',
    zweck: 'Produktgruppe und Serie; die Serie schaltet alle folgenden Auswahlfelder frei.',
  },
  {
    id: 'mass',
    name: 'Maß-Modul',
    abschnitt: 'masse',
    zweck: 'Höhe, Tiefe und Breite je Korpus; daraus folgen Frontbreiten, Raster und Außenmaß.',
  },
  {
    id: 'korpus',
    name: 'Korpus-Modul',
    abschnitt: 'masse',
    zweck: 'Anzahl der Korpi, Lochreihe, Abschlussset, Verblendung und Fußleistenausschnitt.',
  },
  {
    id: 'oberflaeche',
    name: 'Oberflächen-Modul',
    abschnitt: 'material',
    zweck:
      'Materialgruppe (Chips) mit gekoppeltem Ausführungs-Dropdown aus der Farbmatrix; die Preisgruppe wird automatisch zugeordnet.',
  },
  {
    id: 'ausstattung',
    name: 'Ausstattungs-Modul',
    abschnitt: 'ausstattung',
    zweck: 'Vorauswahl, welche Innenausstattung der Schrank braucht — sie filtert Schritt 6.',
  },
  {
    id: 'fronten',
    name: 'Fronten-Modul',
    abschnitt: 'fronten',
    zweck: 'Front-Bauteile je Segment, von unten nach oben, mit Stil-Linie und Maßen.',
  },
  {
    id: 'frontausstattung',
    name: 'Ausstattung-hinter-Front-Modul',
    abschnitt: 'fronten',
    zweck: 'Die in Schritt 5 vorausgewählte Ausstattung, je Segment konkret erfasst.',
  },
  {
    id: 'abschluss',
    name: 'Abschluss-Modul',
    abschnitt: 'abschluss',
    zweck: 'Zusammenfassung, Kalkulation, Verkaufspreis, Handzeichnung und AV-PDF.',
  },
]

export function getModul(id: string | undefined): ModulDefinition | undefined {
  return moduleKatalog.find((m) => m.id === id)
}

/** Die Module eines Schritts in ihrer Code-Reihenfolge. */
export function moduleFuerAbschnitt(abschnittId: string): ModulDefinition[] {
  return moduleKatalog.filter((m) => m.abschnitt === abschnittId)
}

// ---------------------------------------------------------------------------
// Herkunft eines Feldes (Ebene 2 → 3 → 4)
// ---------------------------------------------------------------------------

export interface FeldHerkunft {
  /** Modul (Ebene 2), zu dem das Feld gehört. */
  modul: string
  /**
   * Artikelnummern, die dieses Feld bepreist. Aus ihnen leitet der Inspector den
   * Dropdown-Code (Ebene 3) und alles Weitere (Ebene 4) ab — nicht umgekehrt.
   */
  artikel?: string[]
  /** Woher die WERTE des Feldes kommen, wenn sie nicht aus dem Artikelstamm stammen. */
  werte?: string
  /** Regeln, die Werte ausschließen oder das Feld ganz ausblenden. */
  regeln?: string[]
  /** Ergänzung zur Preisherkunft, wenn sie sich nicht allein aus dem Artikel ergibt. */
  preis?: string
}

/** Beide Artikel eines Lookups: der Standard und der bei angehakter Ausführung. */
function artikelVon(...lookups: Array<BauteilLookup | undefined>): string[] {
  const liste = lookups.flatMap((l) => (l ? [l.artikel, l.artikelBeiAuswahl] : []))
  return [...new Set(liste.filter((nr): nr is string => Boolean(nr)))]
}

const refugium = serienRegeln.refugium

/**
 * Die fest verdrahteten Felder der Oberfläche.
 *
 * Die Schlüssel folgen dem Muster `<abschnitt>.<feld>` und stehen genau so am Aufrufort —
 * ein Feld ohne Eintrag zeigt im Inspector „nicht zugeordnet" statt einer erfundenen
 * Herkunft. Dynamische Felder (jede Ausstattungs-Option, jeder Front-Typ) stehen nicht
 * hier, sondern werden in `herkunftFuer()` aus denselben Zuordnungstabellen abgeleitet.
 */
const HERKUNFT: Record<string, FeldHerkunft> = {
  // --- Schritt 2 · Produkt ------------------------------------------------
  'produkt.gruppe': {
    modul: 'produktwahl',
    werte: 'Produktkatalog (`config/productCatalog.ts`)',
    regeln: ['Nicht freigeschaltete Gruppen sind sichtbar, aber nicht wählbar.'],
  },
  'produkt.serie': {
    modul: 'produktwahl',
    werte: 'Blatt „30 Serien" der Stammdaten-Mappe',
    regeln: [
      'Nur Serien der gewählten Produktgruppe.',
      'Die Serie filtert über das Feld „Modus" jedes Artikels alle folgenden Auswahlfelder.',
    ],
  },

  // --- Schritt 3 · Maße ---------------------------------------------------
  'masse.hoehe': {
    modul: 'mass',
    artikel: artikelVon(refugium?.korpus),
    werte: 'Rasterstufen 18R/21R oder freies Maß (50–274 cm)',
    regeln: ['Maße außerhalb des Standardbereichs werden nicht blockiert, sondern angemerkt.'],
    preis: 'Die Höhe geht als eigene Preisachse in den Korpus-Artikel ein.',
  },
  'masse.tiefe': {
    modul: 'mass',
    artikel: artikelVon(refugium?.korpus),
    werte: '60 cm oder freies Maß (31–60 cm)',
    regeln: ['Unter 60 cm (Sondertiefe) sind als Ausstattung nur Einlegeböden möglich.'],
    preis: 'Die Tiefe geht als eigene Preisachse in den Korpus-Artikel ein.',
  },
  'masse.breite': {
    modul: 'korpus',
    artikel: artikelVon(refugium?.korpus, refugium?.mittelseite),
    werte: 'Nennbreiten 50/60/100 oder freies Maß (15–100 cm)',
    regeln: ['Aus der Korpusbreite folgt die Frontaufteilung (Anzahl und Breite der Türen).'],
    preis: 'Die Breite ist die erste Preisachse des Korpus-Artikels.',
  },
  'masse.lochreihe': {
    modul: 'korpus',
    werte: 'Häkchen je Korpus',
    preis: 'Ohne eigenen Artikel — Ausführungsmerkmal für die Arbeitsvorbereitung.',
  },
  'masse.abschlussset': {
    modul: 'korpus',
    artikel: artikelVon(refugium?.aussenset),
    werte: 'keine / nur links / nur rechts / links & rechts',
    regeln: ['Glas ist als Abschlussset-Material nicht möglich.'],
    preis: 'Preisachsen: Rasterstufe des Korpus und Preisgruppe des gewählten Materials.',
  },
  'masse.verblendung': {
    modul: 'korpus',
    artikel: artikelVon(verblendungLookups.korpusbuendig, verblendungLookups.frontbuendig),
    werte: 'keine / korpusbündig / frontbündig',
    regeln: [
      'Korpusbündig und frontbündig schließen einander aus.',
      'Bei Schiebetürschränken ist die Verblendung nur seitlich möglich.',
    ],
    preis: 'Abgerechnet nach Laufmeter (lfm).',
  },
  'masse.fussleiste': {
    modul: 'korpus',
    artikel: artikelVon(refugium?.fussleistenausschnitt),
    werte: 'Häkchen mit Höhe und Tiefe in cm',
  },
  'masse.sonderformen': {
    modul: 'korpus',
    werte: 'Freitext',
    preis: 'Ohne Preiswirkung — geht unverändert an die Arbeitsvorbereitung.',
  },
  'masse.sondermasse': {
    modul: 'mass',
    werte: 'Freitext',
    preis: 'Ohne Preiswirkung — geht unverändert an die Arbeitsvorbereitung.',
  },
  'masse.aussenmass': {
    modul: 'mass',
    werte: 'Errechnet aus Frontbreiten, Fugen (3 mm) und Abschlusssets (10 mm)',
    regeln: ['Verblendungen und die Frontstärke sind im Außenmaß nicht enthalten.'],
  },

  // --- Schritt 4 · Material ----------------------------------------------
  'material.modus': {
    modul: 'oberflaeche',
    werte: 'Komplett oder getrennt (links, rechts, Abdeckplatte)',
    regeln: ['Nur bei Serien mit getrenntem Außenkorpus.'],
  },
  'material.bereich': {
    modul: 'oberflaeche',
    werte: 'Zentrale Farbmatrix (`config/materialMatrix.ts`), gepflegt im Reiter „Oberflächen"',
    regeln: [
      'Je Bereich sind nur die dort freigegebenen Materialgruppen wählbar.',
      'Bei der Abdeckplatte ist Rauchglas ausgeschlossen.',
    ],
    preis:
      'Kein eigener Artikel: Die Auswahl bestimmt die Preisgruppe (PG1–PG4), und die ist eine Preisachse von Korpus, Fronten und Ausstattung.',
  },
  'material.innenJeKorpus': {
    modul: 'oberflaeche',
    werte: 'Häkchen — je Korpus ein eigenes Innenmaterial',
    regeln: ['Erst wählbar, wenn im Schritt „Maße" mehr als ein Korpus angelegt ist.'],
  },
  'material.abschlussset': {
    modul: 'oberflaeche',
    artikel: artikelVon(refugium?.aussenset),
    werte: 'Zentrale Farbmatrix, ohne Glas',
    regeln: ['Die Position kommt aus dem Schritt „Maße" und ist hier nicht änderbar.'],
  },
  'material.rueckwandAussen': {
    modul: 'oberflaeche',
    werte: 'Zentrale Farbmatrix',
    regeln: ['Nur bei Serien mit Sichtrückwand — beim Kleiderschrank Refugium nicht.'],
  },

  // --- Schritt 6 · Fronten ------------------------------------------------
  'fronten.stilLinie': {
    modul: 'fronten',
    werte: 'Stil-Linien des Front-Typs (`config/frontCatalog.ts`)',
    preis: 'Die Stil-Linie bildet zusammen mit der Preisgruppe den Achsenwert „LINIE+PG".',
  },
  'fronten.anschlag': {
    modul: 'fronten',
    werte: 'links oder rechts',
    regeln: ['Unabhängig von der Position der Tür im Schrank — immer anzugeben.'],
    preis: 'Ohne Preiswirkung — Ausführungsmerkmal für die Arbeitsvorbereitung.',
  },
  'fronten.hoehe': {
    modul: 'fronten',
    werte: 'Rasterstufe, Höhe bis Korpusoberkante oder freies cm-Maß',
    regeln: ['1 Raster = 12,5 cm, dazwischen je 0,3 cm Fuge — errechnet, nicht editierbar.'],
    preis: 'Die Fronthöhe ist eine Preisachse des Front-Artikels.',
  },
  'fronten.breite': {
    modul: 'fronten',
    werte: 'Aus der Korpusbreite abgeleitet, überschreibbar',
  },
  'fronten.schiebetuerAnzahl': {
    modul: 'fronten',
    artikel: artikelVon(frontLookups['schiebetuer-zwei']),
    werte: 'Zulässige Anzahl aus der Segmentzahl',
    regeln: ['Eine Schiebetür muss zwischen 90 und 150 cm breit sein (Decoboard/Xtreme Plus bis 180 cm).'],
  },
  'fronten.griff': {
    modul: 'fronten',
    werte: 'Griffkatalog (`config/handles.ts`)',
    regeln: ['Je Stil-Linie sind bestimmte Griffe ausgeschlossen.'],
  },

  // --- Schritt 7 · Abschluss ----------------------------------------------
  'abschluss.kalkulation': {
    modul: 'abschluss',
    werte: 'Errechnet aus allen Artikeln des Entwurfs',
    preis: 'Preiszeilen aus Blatt „20 Preise" — Achsenwerte je Artikel, cm-Achsen runden auf.',
  },
  'abschluss.vk': {
    modul: 'abschluss',
    werte: 'Freie Eingabe, per Schaltfläche aus der Kalkulation übernehmbar',
    preis: 'Verbindlicher Endpreis für Angebot und AV-PDF — überschreibt die Kalkulation.',
  },
  'abschluss.scan': {
    modul: 'abschluss',
    werte: 'Foto vom Smartphone, farbecht mit angehobenem Kontrast',
  },
}

/**
 * Die Herkunft eines Feldes — fest hinterlegt oder aus den Zuordnungstabellen abgeleitet.
 *
 * Abgeleitet wird für alles, wovon es viele gleichartige gibt: jede Ausstattungs-Option,
 * jeder Front-Typ, jede Container-Variante. Sie hier einzeln aufzuführen hieße, die
 * Zuordnung ein zweites Mal zu pflegen — und die zweite Fassung wäre irgendwann die
 * falsche.
 */
export function herkunftFuer(schluessel: string): FeldHerkunft | undefined {
  const fest = HERKUNFT[schluessel]
  if (fest) return fest

  const ausstattung = schluessel.match(/^ausstattung\.option\.(.+)$/)
  if (ausstattung) {
    const id = ausstattung[1]
    const lookup = ausstattungLookups[id]
    const container = containerLookups[id]
    const artikel = lookup
      ? artikelVon(lookup)
      : container
        ? artikelVon(...Object.values(container))
        : []
    if (artikel.length === 0) return { modul: 'ausstattung', werte: 'Ausstattungs-Katalog (`config/equipment.ts`)' }
    return {
      modul: 'ausstattung',
      artikel,
      werte: 'Ausstattungs-Katalog (`config/equipment.ts`)',
      regeln: ['Bei Sondertiefe (< 60 cm Korpustiefe) sind nur Einlegeböden möglich.'],
    }
  }

  const front = schluessel.match(/^fronten\.typ\.(.+)$/)
  if (front) {
    const lookup = frontLookups[front[1]]
    if (!lookup) return { modul: 'fronten', werte: 'Front-Katalog (`config/frontCatalog.ts`)' }
    return {
      modul: 'fronten',
      artikel: artikelVon(lookup),
      werte: 'Front-Katalog (`config/frontCatalog.ts`)',
      regeln: ['Die zweiläufige Schiebetür ist exklusiv — daneben ist keine weitere Front möglich.'],
    }
  }

  return undefined
}
