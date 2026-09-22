#!/usr/bin/env node
/**
 * PRÜFUNG — Stammdaten-Abgleich mit Supabase, ohne Supabase.
 *
 * Der Store legt den Serverstand (Tabelle `stammdaten_overrides`) zugrunde und die noch
 * nicht gespeicherten Eingaben dieses Geräts darüber. Genau diese Mischung entscheidet,
 * ob zwei Administratoren gleichzeitig arbeiten können, ohne einander zu überschreiben.
 * Geprüft wird sie hier mit einem simulierten Serverstand:
 *
 *   A  Serverstand wirkt auf Arbeitsstand und Kalkulationsgrundlage
 *   B  Eine lokale, ungespeicherte Änderung überlebt einen fremden Serverstand
 *   C  Kommt die eigene Änderung als Serverstand zurück, ist sie nicht mehr „ausstehend"
 *      — auch wenn Postgres die JSON-Schlüssel umsortiert
 *   D  „Zurücksetzen" ist eine ausstehende Änderung, kein sofortiges Löschen
 *   E  Verwerfen stellt exakt den Serverstand her
 *
 *   npm run sync:test
 */

import {
  aendereArtikel,
  getArtikelListe,
  getPreisListe,
  listeAenderungen,
  preisSchluessel,
  setzeAllesZurueck,
  uebernehmeServerStand,
  verwerfeAusstehendeAenderungen,
  zaehleAusstehendeAenderungen,
} from '../src/lib/stammdatenStore.ts'

let fehler = 0
function pruefe(bedingung, text, detail) {
  console.log(`  ${bedingung ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${text}`)
  if (!bedingung) {
    fehler++
    if (detail !== undefined) console.log(`      ${JSON.stringify(detail)}`)
  }
}

const artikel = getArtikelListe()[0]
const zeile = getPreisListe().find((p) => p.preis != null)
const preisKey = preisSchluessel(zeile)

console.log('\nA — Serverstand wirkt')
uebernehmeServerStand([
  { bereich: 'preise', schluessel: preisKey, aktion: 'geaendert', daten: { preis: 999.5 }, version: 1 },
])
pruefe(getPreisListe().find((p) => preisSchluessel(p) === preisKey)?.preis === 999.5, 'Preis aus Supabase gilt im Arbeitsstand')
pruefe(zaehleAusstehendeAenderungen() === 0, 'nichts ausstehend — der Serverstand ist der gespeicherte Stand')

console.log('\nB — eigene Eingabe überlebt fremden Serverstand')
aendereArtikel(artikel.artikelnummer, { bezeichnung: 'Lokal geändert', einheit: 'Stück (Test)' })
pruefe(zaehleAusstehendeAenderungen() === 1, 'eine Änderung ausstehend')
// Admin B speichert inzwischen einen anderen Preis — Realtime liefert den neuen Stand.
uebernehmeServerStand([
  { bereich: 'preise', schluessel: preisKey, aktion: 'geaendert', daten: { preis: 1234 }, version: 2 },
])
pruefe(getPreisListe().find((p) => preisSchluessel(p) === preisKey)?.preis === 1234, 'fremde Preisänderung übernommen')
pruefe(
  getArtikelListe().find((a) => a.artikelnummer === artikel.artikelnummer)?.bezeichnung === 'Lokal geändert',
  'eigene, ungespeicherte Artikeländerung bleibt erhalten',
)
pruefe(zaehleAusstehendeAenderungen() === 1, 'und steht weiter als ausstehend da')

console.log('\nC — eigene Änderung kommt als Serverstand zurück')
const patch = listeAenderungen().find((a) => a.bereich === 'artikel')
pruefe(Boolean(patch?.ausstehend), 'vor dem Zurückkommen: ausstehend')
// Postgres (jsonb) liefert die Schlüssel in anderer Reihenfolge zurück.
uebernehmeServerStand([
  { bereich: 'preise', schluessel: preisKey, aktion: 'geaendert', daten: { preis: 1234 }, version: 2 },
  { bereich: 'artikel', schluessel: artikel.artikelnummer, aktion: 'geaendert', daten: { einheit: 'Stück (Test)', bezeichnung: 'Lokal geändert' }, version: 1 },
])
pruefe(zaehleAusstehendeAenderungen() === 0, 'nicht mehr ausstehend', listeAenderungen())

console.log('\nD — Zurücksetzen wird erst mit „Speichern" wirksam')
setzeAllesZurueck()
pruefe(getPreisListe().find((p) => preisSchluessel(p) === preisKey)?.preis === zeile.preis, 'Arbeitsstand zeigt den Excel-Grundstand')
pruefe(zaehleAusstehendeAenderungen() === 2, 'beide Overrides stehen als ausstehende Löschung da', zaehleAusstehendeAenderungen())

console.log('\nE — Verwerfen stellt den Serverstand her')
verwerfeAusstehendeAenderungen()
pruefe(getPreisListe().find((p) => preisSchluessel(p) === preisKey)?.preis === 1234, 'Serverpreis wieder da')
pruefe(zaehleAusstehendeAenderungen() === 0, 'nichts mehr ausstehend')

console.log(fehler === 0 ? '\n\x1b[32mAlle Prüfungen bestanden.\x1b[0m\n' : `\n\x1b[31m${fehler} Prüfung(en) fehlgeschlagen.\x1b[0m\n`)
process.exit(fehler === 0 ? 0 : 1)
