#!/usr/bin/env node
/**
 * Selbsttest der Schritt-2-Zusagen: Buchstaben-Notation, Reihenfolge-Unabhängigkeit,
 * Formatierungs-Toleranz — geprüft gegen die echten Stammdaten, nicht gegen Attrappen.
 *
 *   npm run data:test
 *
 * Läuft ohne Test-Framework: die Anwendung soll deswegen keine Dev-Dependency mehr tragen.
 */

import { modusErlaubt, parseModus, normalizeModus, istSonderanfertigung } from '../src/lib/modus.ts'
import { SERIEN_CODES } from '../src/data/stammdaten.generated.ts'
import {
  artikelFuerSerie, berater, dropdownsFuerSchritt, findePreis,
  parseArtikelnummer, schritte, serienVon,
} from '../src/lib/stammdaten.ts'

let fehler = 0
const ok = (name, bedingung) => {
  if (bedingung) console.log(`  \x1b[32m✓\x1b[0m ${name}`)
  else { fehler++; console.log(`  \x1b[31m✗ ${name}\x1b[0m`) }
}
const gruppe = (titel) => console.log(`\n\x1b[1m${titel}\x1b[0m`)

// Positions-Map, wie sie `normalizeModus` erwartet.
const codeMap = new Map(SERIEN_CODES.map((c, i) => [c, { code: c, position: i + 1 }]))

gruppe('A) Formatierungs-Toleranz — jede Schreibweise muss R und P freigeben')
for (const v of ['RP', 'PR', 'R,P', 'R/P', 'R - P', '_R_P_', 'rp', 'p R', 'R;P', '--R--P--', 'R\tP', 'R | P']) {
  ok(`${JSON.stringify(v).padEnd(12)} → Refugium + Publicum`, modusErlaubt(v, 'R') && modusErlaubt(v, 'P'))
}

gruppe('B) Reihenfolge-Unabhängigkeit')
const permutationen = ['RVP', 'PVR', 'VPR', 'RPV', 'VRP', 'PRV']
const ergebnisse = new Set(permutationen.map((p) => parseModus(p, SERIEN_CODES).join('')))
ok('alle 6 Permutationen liefern dieselbe Serien-Menge', ergebnisse.size === 1)
ok(`kanonische Form ist "${[...ergebnisse][0]}"`, [...ergebnisse][0] === 'VPR')

gruppe('C) Negativfälle — keine falschen Treffer')
ok('"AVP" gibt Refugium NICHT frei', !modusErlaubt('AVP', 'R'))
ok('leerer Modus gibt nichts frei', !modusErlaubt('', 'R'))
ok('unbekannte Buchstaben werden verworfen', parseModus('RXZ', SERIEN_CODES).join('') === 'R')
ok('mehrstelliger "Code" trifft nicht', !modusErlaubt('AVPR', 'RV'))
ok('Trennzeichen allein gibt nichts frei', !modusErlaubt('_ , / -', 'R'))

gruppe('D) Sonderanfertigung: verfügbar, aber unterscheidbar')
ok('"AVpR" gibt Publicum frei', modusErlaubt('AVpR', 'P'))
ok('"AVpR" → Publicum ist Sonderanfertigung', istSonderanfertigung('AVpR', 'P'))
ok('"AVPR" → Publicum ist Standard', !istSonderanfertigung('AVPR', 'P'))
ok('Bereinigung erhält die Kleinschreibung', normalizeModus('_A_V_p_R_', codeMap).value === 'AVpR')
ok('Bereinigung ist idempotent', normalizeModus(normalizeModus('R,p/A', codeMap).value, codeMap).value === 'ApR')

gruppe('E) Echte Stammdaten')
const refugium = artikelFuerSerie('refugium')
ok(`Refugium: ${refugium.length} Artikel freigegeben`, refugium.length === 109)
ok(`Tavolo: ${artikelFuerSerie('tavolo').length} Artikel freigegeben`, artikelFuerSerie('tavolo').length === 43)
ok('kein Refugium-Artikel ohne "R" im Modus', refugium.every((a) => a.modus.toUpperCase().includes('R')))
ok('Abdeckplatten sind für Refugium gesperrt', !refugium.some((a) => a.artikelgruppe === 'ABDECKPLATTE'))
ok('Abdeckplatten sind für Atrium frei', artikelFuerSerie('atrium').some((a) => a.artikelgruppe === 'ABDECKPLATTE'))
ok('unbekannte Serie liefert leere Liste', artikelFuerSerie('gibtsnicht').length === 0)
ok('serienVon("APOS") = Atrium, Publicum, Porticus, Supersonus',
  serienVon('APOS').map((s) => s.name).join(', ') === 'Atrium, Publicum, Porticus, Supersonus')
ok('Preis-Lookup 10-10-20-0001 / „-80cm" = 186 EUR', findePreis('10-10-20-0001', ['-80cm'])?.preis === 186)
ok('Artikelnummer 30-30-05-0011 zerlegt sich in 4 Blöcke',
  parseArtikelnummer('30-30-05-0011')?.artikelgruppe === '05')
ok('unvollständige Artikelnummer → null', parseArtikelnummer('30-30-05') === null)
ok('3 aktive Berater aus „40 Mitarbeiter"', berater.length === 3 && berater[0].name === 'Anna Berger')

gruppe('F) Schritte und Dropdowns je Serie (aus Modus + Artikelgruppe)')
for (const serieId of ['refugium', 'tavolo', 'cavum', 'atrium']) {
  const zeile = schritte
    .map((s) => [s.bezeichnung, dropdownsFuerSchritt(s.code, serieId).length])
    .filter(([, n]) => n > 0)
    .map(([b, n]) => `${b} (${n})`)
    .join(' · ')
  console.log(`  ${serieId.padEnd(11)} ${zeile}`)
}

console.log(
  fehler === 0
    ? '\n\x1b[32mAlle Prüfungen bestanden.\x1b[0m\n'
    : `\n\x1b[31m${fehler} Prüfung(en) fehlgeschlagen.\x1b[0m\n`,
)
process.exitCode = fehler ? 1 : 0
