#!/usr/bin/env node
/**
 * MIGRATION — Raumteiler- und Sichtrückwand-Aufschlag wieder automatisch.
 *
 * Mit der Stammdaten-Reform waren beide Prozent-Aufschläge aus der Kalkulation gestrichen
 * worden („wird NICHT mehr automatisch kalkuliert"). Jetzt rechnet der Konfigurator sie
 * wieder, jeweils auf den MÖBELPREIS:
 *
 *   Raumteiler      +5 %   (Artikel ZUS-001)
 *   Sichtrückwand  +10 %   (Artikel ZUS-004)
 *
 * Die Sätze stehen wie Montage und Lieferung in „50 Meta" — dort kann Herr Dietmann sie
 * selbst pflegen. `scripts/build-stammdaten.js` liest sie als `meta.raumteilerZuschlagPct`
 * / `meta.sichtrueckwandZuschlagPct`. Die Bemerkung der beiden Zuschlag-Artikel in
 * „10 Artikel" wird nachgezogen, damit dort nicht mehr das Gegenteil steht.
 *
 * IDEMPOTENT: Vorhandene Meta-Schlüssel bleiben unangetastet (auch wenn dort inzwischen ein
 * anderer Satz gepflegt ist); eine bereits aktuelle Bemerkung wird nicht neu geschrieben.
 *
 *   node scripts/migrate-zuschlag-raumteiler-sichtrueckwand.js [--dry-run] [--no-backup]
 *   npm run data:migrate-zuschlaege
 */

import { readFileSync, existsSync, copyFileSync } from 'node:fs'

import { STAMMDATEN_XLSX, SHEETS } from './lib/paths.js'
import {
  openWorkbook,
  readTable,
  editSheet,
  appendRow,
  setCellString,
  saveWorkbook,
  writeFileWithRetry,
} from './lib/xlsx-raw.js'

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
}

const META_SCHLUESSEL = [
  {
    schluessel: 'raumteilerZuschlagPct',
    wert: '0.05',
    bedeutung: 'Raumteiler-Aufschlag auf den Möbelpreis (0.05 = 5 %), Art. ZUS-001',
  },
  {
    schluessel: 'sichtrueckwandZuschlagPct',
    wert: '0.1',
    bedeutung: 'Sichtrückwand-Aufschlag auf den Möbelpreis (0.1 = 10 %), Art. ZUS-004',
  },
]

/** Kurzzeichen → neue Bemerkung. Das Kurzzeichen ist stabil, die Artikelnummer nicht. */
const BEMERKUNGEN = {
  'ZUS-001':
    'Aufschlag 5 % auf den Möbelpreis — wird automatisch kalkuliert, sobald im Schritt ' +
    '„Material" „Raumteiler" angehakt ist. Satz: „50 Meta", raumteilerZuschlagPct.',
  'ZUS-004':
    'Aufschlag 10 % auf den Möbelpreis — wird automatisch kalkuliert, sobald im Schritt ' +
    '„Material" „Sicht-Rückwand" angehakt ist. Satz: „50 Meta", sichtrueckwandZuschlagPct.',
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const noBackup = process.argv.includes('--no-backup')
  if (!existsSync(STAMMDATEN_XLSX)) throw new Error(`Stammdatendatei nicht gefunden: ${STAMMDATEN_XLSX}`)

  console.log(c.bold('\nRaumteiler- und Sichtrückwand-Aufschlag'))
  console.log(c.dim(`  ${STAMMDATEN_XLSX}`))

  const wb = openWorkbook(readFileSync(STAMMDATEN_XLSX))

  const metaTab = readTable(wb, SHEETS.meta)
  const vorhanden = new Set(metaTab.rows.map((r) => String(r['Schlüssel'] ?? '').trim()))
  const fehlend = META_SCHLUESSEL.filter((z) => !vorhanden.has(z.schluessel))

  const artikelTab = readTable(wb, SHEETS.artikel)
  const bemerkungSpalte = artikelTab.header.get('Bemerkung')
  if (!bemerkungSpalte) throw new Error(`„${SHEETS.artikel}" führt keine Spalte „Bemerkung".`)
  const bemerkungNeu = []
  for (const [kurzzeichen, text] of Object.entries(BEMERKUNGEN)) {
    const zeile = artikelTab.rows.find((r) => String(r['Kurzzeichen'] ?? '').trim() === kurzzeichen)
    if (!zeile) throw new Error(`Artikel ${kurzzeichen} nicht in „${SHEETS.artikel}" gefunden.`)
    if (zeile['Bemerkung'] !== text) bemerkungNeu.push({ kurzzeichen, ref: `${bemerkungSpalte}${zeile._row}`, text })
  }

  if (fehlend.length === 0 && bemerkungNeu.length === 0) {
    console.log(c.green('\n  Nichts zu tun — die Mappe ist bereits auf dem aktuellen Stand.\n'))
    return
  }

  console.log(c.bold('\n  Änderungen'))
  for (const z of fehlend) console.log(`    ${c.green('+')} 50 Meta   ${z.schluessel.padEnd(28)} ${z.wert}`)
  for (const b of bemerkungNeu) console.log(`    ${c.green('~')} ${b.kurzzeichen}   Bemerkung (${b.ref})`)

  if (dryRun) {
    console.log(c.yellow('\n  --dry-run: nichts geschrieben.\n'))
    return
  }

  const spalte = (name) => {
    const s = metaTab.header.get(name)
    if (!s) throw new Error(`„${SHEETS.meta}" führt keine Spalte „${name}".`)
    return s
  }
  const metaBlatt = editSheet(wb, SHEETS.meta)
  for (const z of fehlend) {
    appendRow(metaBlatt, {
      [spalte('Schlüssel')]: z.schluessel,
      [spalte('Wert')]: z.wert,
      [spalte('Bedeutung')]: z.bedeutung,
    })
  }
  const artikelBlatt = editSheet(wb, SHEETS.artikel)
  for (const b of bemerkungNeu) {
    if (!setCellString(artikelBlatt, b.ref, b.text)) throw new Error(`Zelle ${b.ref} existiert nicht.`)
  }

  if (!noBackup) {
    const backup = STAMMDATEN_XLSX.replace(/\.xlsx$/, `.backup-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`)
    copyFileSync(STAMMDATEN_XLSX, backup)
    console.log(c.dim(`\n  Sicherung: ${backup}`))
  }
  metaBlatt.commit()
  artikelBlatt.commit()
  writeFileWithRetry(STAMMDATEN_XLSX, saveWorkbook(wb))
  console.log(c.green('  Geschrieben. Jetzt `npm run data:build` ausführen.\n'))
}

main()
