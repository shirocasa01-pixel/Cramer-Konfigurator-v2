/**
 * TRANSPARENZ-INSPECTOR — die vier Ebenen an genau einem Feld sichtbar gemacht.
 *
 * Der Administrator klickt im Bearbeitungsmodus auf das ℹ️ an einem Auswahlfeld und
 * bekommt vier Antworten:
 *
 *   EBENE 2  Zu welchem MODUL gehört das Feld, und wofür ist es zuständig?
 *   EBENE 3  Welcher DROPDOWN-CODE (DDD) steckt dahinter?
 *   EBENE 4  Welche ARTIKEL lädt es für die laufende Serie — und woher kommt der PREIS?
 *   dazu     Welche REGEL schließt Werte aus?
 *
 * Nichts davon ist hier gepflegt. Der Bericht entsteht bei jedem Aufruf aus denselben
 * Quellen, aus denen auch gerechnet wird: `config/module.ts` verankert das Feld an einer
 * Artikelnummer, deren mittlerer Block die Dropdown-Nummer IST, und alles Weitere steht
 * im Artikelstamm. Eine Angabe im Inspector kann dadurch nicht veralten — sie ist
 * dieselbe Angabe, die die Kalkulation benutzt.
 */

import { herkunftFuer, getModul, type FeldHerkunft } from '../config/module.ts'
import { dropdowns as alleDropdowns } from '../data/stammdaten.generated.ts'
import {
  dropdownEintraege,
  getArtikel,
  istSonderanfertigungFuer,
  istVerfuegbar,
  parseArtikelnummer,
  preiseFuer,
  type Artikel,
  type Dropdown,
} from './stammdaten.ts'

/** Ein Auswahlfeld, wie die Dropdown-Verwaltung (Ebene 3) es kennt. */
export interface InspektorDropdown {
  /** Block 2 der Artikelnummer, dreistellig. */
  nr: string
  bezeichnung: string
  nummernkreis: string
  /** Artikel dieses Dropdowns insgesamt. */
  artikelGesamt: number
  /** Davon für die laufende Serie freigegeben und aktiv. */
  artikelFuerSerie: number
}

/** Ein Artikel, den das Feld bepreist (Ebene 4). */
export interface InspektorArtikel {
  nummer: string
  bezeichnung: string
  /** Achsen als Klartext, z. B. „BREITE × HÖHE × TIEFE × PG". */
  achsenText: string
  preislogik: string
  /** Anzahl hinterlegter Preiszellen. */
  preiszeilen: number
  status: string
  /** Für die laufende Serie: freigegeben, Sonderanfertigung oder gar nicht. */
  freigabe: 'standard' | 'sonderanfertigung' | 'nicht freigegeben'
}

export interface InspektorBericht {
  /** Ebene 2. */
  modul: { id: string; name: string; zweck: string } | null
  /** Ebene 3 — kann leer sein: nicht jedes Feld führt zu einem Artikel. */
  dropdowns: InspektorDropdown[]
  /** Ebene 4. */
  artikel: InspektorArtikel[]
  /** Woher die Werte kommen, wenn nicht aus dem Artikelstamm. */
  werte?: string
  /** Was Werte ausschließt. */
  regeln: string[]
  /** Woher der Preis stammt — aus den Artikeln abgeleitet, ergänzt um Sonderfälle. */
  preis: string[]
}

const PREISLOGIK_TEXT: Record<string, string> = {
  MATRIX: 'Matrix-Lookup über die Preisachsen',
  FESTPREIS: 'Festpreis, unabhängig von Achsen',
  AUF_ANFRAGE: 'kein Preis hinterlegt — die Arbeitsvorbereitung klärt',
}

function findeDropdown(nr: string): Dropdown | undefined {
  return alleDropdowns.find((d) => d.nr === nr)
}

function freigabe(artikel: Artikel, serieId: string | undefined): InspektorArtikel['freigabe'] {
  if (istSonderanfertigungFuer(artikel, serieId)) return 'sonderanfertigung'
  return istVerfuegbar(artikel, serieId) ? 'standard' : 'nicht freigegeben'
}

/**
 * Der Bericht zu einem Feld.
 *
 * `undefined` heißt: für diesen Schlüssel ist keine Herkunft hinterlegt. Das ist eine
 * ehrliche Antwort und bewusst kein leerer Bericht — ein Feld, dessen Herkunft niemand
 * eingetragen hat, soll im Inspector als solches erkennbar sein.
 */
export function berichteFuerFeld(
  schluessel: string,
  serieId: string | undefined,
): InspektorBericht | undefined {
  const herkunft = herkunftFuer(schluessel)
  if (!herkunft) return undefined
  return bericht(herkunft, serieId)
}

/**
 * Derselbe Bericht aus einer bereits bekannten Herkunft.
 *
 * Getrennt von `berichteFuerFeld`, weil Schemafelder ihre Herkunft selbst mitbringen
 * (Dropdown-Code aus der Feld-Einstellung) statt sie über einen Schlüssel zu suchen.
 */
export function bericht(herkunft: FeldHerkunft, serieId: string | undefined): InspektorBericht {
  const modul = getModul(herkunft.modul)

  const artikelnummern = herkunft.artikel ?? []
  const artikel: InspektorArtikel[] = artikelnummern.map((nummer) => {
    const a = getArtikel(nummer)
    return {
      nummer,
      bezeichnung: a?.bezeichnung || 'im Artikelstamm nicht gefunden',
      achsenText: a?.achsenText || '—',
      preislogik: a ? (PREISLOGIK_TEXT[a.preislogik] ?? a.preislogik) : '—',
      preiszeilen: preiseFuer(nummer).length,
      status: a?.status ?? 'unbekannt',
      freigabe: a ? freigabe(a, serieId) : 'nicht freigegeben',
    }
  })

  // Die Dropdown-Nummer IST der mittlere Block der Artikelnummer — deshalb aus den
  // Artikeln abgeleitet und nirgends zusätzlich gepflegt. Eine Nummer, die sich nicht
  // zerlegen lässt (Altbestand), wird übersprungen statt geraten.
  const nummern = [
    ...new Set(
      artikelnummern
        .map((nr) => parseArtikelnummer(nr)?.dropdown)
        .filter((nr): nr is string => Boolean(nr)),
    ),
  ].sort()

  const ddDropdowns: InspektorDropdown[] = nummern.map((nr) => {
    const dd = findeDropdown(nr)
    return {
      nr,
      bezeichnung: dd?.bezeichnung ?? 'in den Stammdaten nicht gefunden',
      nummernkreis: dd?.nummernkreis ?? `…-${nr}-`,
      artikelGesamt: dd?.anzahlArtikel ?? 0,
      artikelFuerSerie: dd ? dropdownEintraege(dd.code, serieId).length : 0,
    }
  })

  // Die Preisherkunft steht im Artikel selbst; der Eintrag aus `config/module.ts`
  // ergänzt nur, was sich daraus nicht ablesen lässt (etwa: dieses Feld ist die
  // Preisgruppen-Achse anderer Artikel).
  const preis = [
    ...artikel.map((a) => `${a.nummer} · ${a.preislogik} · ${a.preiszeilen} Preiszeilen`),
    ...(herkunft.preis ? [herkunft.preis] : []),
  ]

  return {
    modul: modul ? { id: modul.id, name: modul.name, zweck: modul.zweck } : null,
    dropdowns: ddDropdowns,
    artikel,
    werte: herkunft.werte,
    regeln: herkunft.regeln ?? [],
    preis,
  }
}

/**
 * Der Bericht zu einem Schemafeld, das direkt auf einen Dropdown-Code zeigt.
 *
 * Solche Felder legt der Administrator im Bausteinkatalog selbst an; ihre Ebene 3 steht
 * damit in der Feld-Einstellung und nicht in `config/module.ts`.
 */
export function berichtFuerDropdownCode(
  dropdownCode: string,
  modulId: string,
  serieId: string | undefined,
): InspektorBericht {
  const dd = findeDropdown(dropdownCode)
  const eintraege = dd ? dropdownEintraege(dd.code, serieId) : []
  const modul = getModul(modulId)
  return {
    modul: modul ? { id: modul.id, name: modul.name, zweck: modul.zweck } : null,
    dropdowns: [
      {
        nr: dropdownCode,
        bezeichnung: dd?.bezeichnung ?? 'in den Stammdaten nicht gefunden',
        nummernkreis: dd?.nummernkreis ?? `…-${dropdownCode}-`,
        artikelGesamt: dd?.anzahlArtikel ?? 0,
        artikelFuerSerie: eintraege.length,
      },
    ],
    // Bewusst nur die ersten Einträge: Der Inspector soll zeigen, WAS geladen wird, und
    // nicht den Artikelstamm nachdrucken — dafür gibt es die Artikelverwaltung.
    artikel: eintraege.slice(0, 8).map((a) => ({
      nummer: a.artikelnummer,
      bezeichnung: a.bezeichnung,
      achsenText: a.achsenText || '—',
      preislogik: PREISLOGIK_TEXT[a.preislogik] ?? a.preislogik,
      preiszeilen: preiseFuer(a.artikelnummer).length,
      status: a.status,
      freigabe: freigabe(a, serieId),
    })),
    werte: 'Artikelverwaltung — Artikel dieses Dropdowns, gefiltert über das Feld „Modus"',
    regeln:
      eintraege.length === 0
        ? ['Für die laufende Serie ist in diesem Dropdown kein Artikel freigegeben.']
        : [],
    preis: [],
  }
}
