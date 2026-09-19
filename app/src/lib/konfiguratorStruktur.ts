/**
 * KONFIGURATOR-STRUKTUR — was aus den Stammdaten kommt und was im Code steht.
 *
 * Die Mappe beschreibt den Aufbau des Konfigurators bereits vollständig: Blatt
 * „33 Teilearten" liefert die Hauptschritte, Blatt „32 Artikelgruppen" die Auswahlfelder
 * (Dropdowns) darunter, und die Artikelnummer verbindet beides (`TT-DDD-NNNN`).
 * Sichtbar war dieser Baum bisher nirgends — die Oberfläche ist von Hand gebaut und
 * greift nur punktuell darauf zu.
 *
 * Dieses Modul stellt beide Seiten nebeneinander:
 *
 *   SOLL   der Baum aus den Stammdaten (Schritt → Dropdown → Artikel)
 *   IST    welche Dropdowns der Konfigurator tatsächlich bepreist
 *
 * Das IST wird NICHT von Hand gepflegt, sondern aus den Zuordnungstabellen in
 * `config/preisMapping.ts` abgeleitet: Jede dort hinterlegte Artikelnummer trägt im
 * mittleren Block die Dropdown-Nummer. Ein Dropdown gilt damit als angebunden, sobald der
 * Konfigurator mindestens einen seiner Artikel bepreist. Dadurch kann die Übersicht nicht
 * veralten — sie liest denselben Stand wie die Kalkulation.
 */

import {
  ausstattungLookups,
  containerLookups,
  frontLookups,
  serienRegeln,
  verblendungLookups,
  type BauteilLookup,
} from '../config/preisMapping.ts'
import { dropdownEintraege, dropdownsFuerSchritt, parseArtikelnummer, schritte } from './stammdaten.ts'

/** Ein Auswahlfeld des Konfigurators, wie die Mappe es kennt. */
export interface StrukturDropdown {
  /** Block 2 der Artikelnummer, dreistellig. */
  nr: string
  code: string
  bezeichnung: string
  nummernkreis: string
  /** Artikel dieses Dropdowns, die für die gewählte Serie freigegeben und aktiv sind. */
  artikelFuerSerie: number
  /**
   * Stellen im Konfigurator, die Artikel dieses Dropdowns bepreisen. Leer bedeutet:
   * Die Artikel stehen im Stamm, aber kein Eingabefeld führt zu ihnen.
   */
  verwendetIn: string[]
}

/** Ein Hauptschritt des Konfigurators mit seinen Auswahlfeldern. */
export interface StrukturSchritt {
  /** Block 1 der Artikelnummer, zweistellig. */
  nr: string
  code: string
  /** Klartext des Schritts aus der Mappe. */
  schritt: string
  bezeichnung: string
  dropdowns: StrukturDropdown[]
}

/**
 * Artikelnummer → Dropdown-Nummer. Der mittlere Block IST die Dropdown-Nummer; eine
 * Nummer, die sich nicht zerlegen lässt (Altbestand), wird übersprungen statt geraten.
 */
function dropdownNrVon(artikelnummer: string | undefined): string | undefined {
  if (!artikelnummer) return undefined
  return parseArtikelnummer(artikelnummer)?.dropdown
}

function merke(ziel: Map<string, Set<string>>, artikelnummer: string | undefined, ort: string) {
  const nr = dropdownNrVon(artikelnummer)
  if (!nr) return
  const vorhanden = ziel.get(nr)
  if (vorhanden) vorhanden.add(ort)
  else ziel.set(nr, new Set([ort]))
}

/** Beide Artikel eines Lookups — der Standardartikel und der bei angehakter Option. */
function merkeLookup(ziel: Map<string, Set<string>>, lookup: BauteilLookup | undefined, ort: string) {
  if (!lookup) return
  merke(ziel, lookup.artikel, ort)
  merke(ziel, lookup.artikelBeiAuswahl, ort)
}

/**
 * Dropdown-Nummer → Konfigurator-Stellen, die daraus bepreisen.
 *
 * Bewusst über alle Serien, nicht nur über die gewählte: Ein Dropdown, das nur Atrium
 * anbindet, ist angebunden — es taucht bei Refugium lediglich nicht auf.
 */
export function verwendungJeDropdown(): Map<string, Set<string>> {
  const ziel = new Map<string, Set<string>>()

  for (const regel of Object.values(serienRegeln)) {
    merkeLookup(ziel, regel.korpus, 'Maße · Korpus')
    merkeLookup(ziel, regel.mittelseite, 'Maße · abgeleitet')
    merkeLookup(ziel, regel.aussenset, 'Maße · abgeleitet')
    merkeLookup(ziel, regel.fussleistenausschnitt, 'Maße · Fußleistenausschnitt')
  }
  for (const lookup of Object.values(frontLookups)) merkeLookup(ziel, lookup, 'Fronten')
  for (const lookup of Object.values(ausstattungLookups)) merkeLookup(ziel, lookup, 'Ausstattung')
  for (const varianten of Object.values(containerLookups)) {
    for (const lookup of Object.values(varianten)) merkeLookup(ziel, lookup, 'Ausstattung · Container')
  }
  for (const lookup of Object.values(verblendungLookups)) merkeLookup(ziel, lookup, 'Maße · Verblendung')

  return ziel
}

/**
 * Der Konfigurator-Baum einer Serie: Schritte aus „33 Teilearten", darunter die
 * Auswahlfelder aus „32 Artikelgruppen", die für diese Serie überhaupt Artikel führen.
 */
export function baueStruktur(serieId: string | undefined): StrukturSchritt[] {
  const verwendung = verwendungJeDropdown()

  return schritte
    .map((teileart) => ({
      nr: teileart.nr,
      code: teileart.code,
      schritt: teileart.schritt,
      bezeichnung: teileart.bezeichnung,
      dropdowns: dropdownsFuerSchritt(teileart.code, serieId).map((dd) => ({
        nr: dd.nr,
        code: dd.code,
        bezeichnung: dd.bezeichnung,
        nummernkreis: dd.nummernkreis,
        artikelFuerSerie: dropdownEintraege(dd.code, serieId).length,
        verwendetIn: [...(verwendung.get(dd.nr) ?? [])].sort(),
      })),
    }))
    .filter((s) => s.dropdowns.length > 0)
}

/** Kennzahlen für die Kopfzeile der Übersicht. */
export interface StrukturBilanz {
  schritte: number
  dropdowns: number
  angebunden: number
  offen: number
  artikel: number
}

export function bilanziere(struktur: StrukturSchritt[]): StrukturBilanz {
  const alle = struktur.flatMap((s) => s.dropdowns)
  return {
    schritte: struktur.length,
    dropdowns: alle.length,
    angebunden: alle.filter((d) => d.verwendetIn.length > 0).length,
    offen: alle.filter((d) => d.verwendetIn.length === 0).length,
    artikel: alle.reduce((summe, d) => summe + d.artikelFuerSerie, 0),
  }
}
