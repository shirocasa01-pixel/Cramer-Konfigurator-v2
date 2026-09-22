#!/usr/bin/env node
/**
 * MIGRATION — Test-Berater in Blatt „40 Mitarbeiter" anlegen.
 *
 * Ein Berater ist eine Zeile in der Mappe, keine Code-Änderung (siehe
 * `src/data/consultants.ts`): `getConsultants()` liest alle Mitarbeiter mit Rolle
 * `berater` und Status `aktiv` und gibt ihnen das einheitliche Standard-Passwort.
 *
 * Das Passwort steht bewusst NICHT hier und nicht in der Mappe — es gilt
 * `STANDARD_PASSWORT`, solange der Administrator kein eigenes vergeben hat
 * (`src/lib/zugangStore.ts`).
 *
 * IDEMPOTENT: Existiert die Personalnummer bereits, passiert nichts.
 *
 *   node scripts/migrate-testberater.js [--dry-run] [--no-backup]
 *   npm run data:migrate-testberater
 */

import { readFileSync, existsSync, copyFileSync } from 'node:fs'

import { STAMMDATEN_XLSX, SHEETS } from './lib/paths.js'
import {
  openWorkbook,
  readTable,
  editSheet,
  appendRow,
  saveWorkbook,
  writeFileWithRetry,
} from './lib/xlsx-raw.js'

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
}

/** Der Test-Berater, dem die Praxistest-Entwürfe zugeordnet sind. */
export const TEST_BERATER = {
  personalnr: 'M-004',
  name: 'Sarib Test-Berater',
  email: 'sarib.test@cramer.de',
  rolle: 'berater',
  filiale: 'F-001',
  status: 'aktiv',
  bemerkung: 'Praxistest-Konto — 20 Testentwürfe (npm run praxis:test)',
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const noBackup = process.argv.includes('--no-backup')
  if (!existsSync(STAMMDATEN_XLSX)) throw new Error(`Stammdatendatei nicht gefunden: ${STAMMDATEN_XLSX}`)

  console.log(c.bold('\nTest-Berater in „40 Mitarbeiter"'))
  console.log(c.dim(`  ${STAMMDATEN_XLSX}`))

  const wb = openWorkbook(readFileSync(STAMMDATEN_XLSX))
  const tab = readTable(wb, SHEETS.mitarbeiter)

  const vorhanden = tab.rows.find(
    (r) =>
      r['Personalnr'] === TEST_BERATER.personalnr ||
      String(r['E-Mail'] ?? '').trim().toLowerCase() === TEST_BERATER.email,
  )
  if (vorhanden) {
    console.log(c.green(`\n  Nichts zu tun — ${vorhanden['Personalnr']} „${vorhanden['Name']}" steht bereits in der Mappe.\n`))
    return
  }

  console.log(c.bold('\n  Neue Zeile'))
  for (const [feld, wert] of Object.entries(TEST_BERATER)) {
    console.log(`    ${c.green('+')} ${feld.padEnd(12)} ${wert}`)
  }

  if (dryRun) {
    console.log(c.yellow('\n  --dry-run: nichts geschrieben.\n'))
    return
  }

  const blatt = editSheet(wb, SHEETS.mitarbeiter)
  const werte = {}
  const setze = (spaltenName, wert) => {
    const spalte = tab.header.get(spaltenName)
    if (!spalte) throw new Error(`„${SHEETS.mitarbeiter}" führt keine Spalte „${spaltenName}".`)
    werte[spalte] = wert
  }
  setze('Personalnr', TEST_BERATER.personalnr)
  setze('Name', TEST_BERATER.name)
  setze('E-Mail', TEST_BERATER.email)
  setze('Rolle', TEST_BERATER.rolle)
  setze('Filiale', TEST_BERATER.filiale)
  setze('Status', TEST_BERATER.status)
  setze('Bemerkung', TEST_BERATER.bemerkung)
  appendRow(blatt, werte)

  if (!noBackup) {
    const backup = STAMMDATEN_XLSX.replace(/\.xlsx$/, `.backup-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`)
    copyFileSync(STAMMDATEN_XLSX, backup)
    console.log(c.dim(`\n  Sicherung: ${backup}`))
  }
  blatt.commit()
  writeFileWithRetry(STAMMDATEN_XLSX, saveWorkbook(wb))
  console.log(c.green(`  Geschrieben. Jetzt \`npm run data:build\` ausführen.\n`))
}

main()
