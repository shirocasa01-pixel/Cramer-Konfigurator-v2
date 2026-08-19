#!/usr/bin/env node
/**
 * Schreibt die belegten Achsenwert-Korrekturen dauerhaft in „20 Preise".
 *
 * Solange das nicht gelaufen ist, wendet `build-stammdaten.js` dieselbe Tabelle beim
 * Erzeugen an und weist bei jedem Lauf darauf hin. Danach greift keine Regel mehr —
 * der Generator meldet dann „keine Korrektur nötig".
 *
 * Begründung und Belege je Regel: `scripts/lib/achsen-reparatur.js`.
 *
 *   node scripts/fix-preisachsen.js [--dry-run] [--no-backup]
 */

import { readFileSync, existsSync, copyFileSync } from 'node:fs'
import path from 'node:path'

import { STAMMDATEN_XLSX, SHEETS } from './lib/paths.js'
import { ACHSEN_REPARATUREN, findeReparatur } from './lib/achsen-reparatur.js'
import { openWorkbook, readTable, editSheet, setCellString, forceFullCalcOnLoad, saveWorkbook, writeFileWithRetry } from './lib/xlsx-raw.js'

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const noBackup = process.argv.includes('--no-backup')
  if (!existsSync(STAMMDATEN_XLSX)) throw new Error(`Stammdatendatei nicht gefunden: ${STAMMDATEN_XLSX}`)

  console.log(c.bold('\nAchsenwerte in „20 Preise" korrigieren'))

  const wb = openWorkbook(readFileSync(STAMMDATEN_XLSX))
  const artikel = readTable(wb, SHEETS.artikel)
  const preise = readTable(wb, SHEETS.preise)

  // Achsen-Reihenfolge je Artikel: sie sagt, welche Spalte A1–A5 welche Achse trägt.
  const achsenVonArtikel = new Map(
    artikel.rows.map((a) => [
      a['Artikelnummer'],
      [1, 2, 3, 4, 5].map((i) => a[`Achse ${i}`]).filter((x) => x && !/^\d+$/.test(x)),
    ]),
  )

  const sheet = editSheet(wb, SHEETS.preise)
  const treffer = []

  for (const zeile of preise.rows) {
    const achsen = achsenVonArtikel.get(zeile['Artikel']) ?? []
    achsen.forEach((achse, i) => {
      const spalte = preise.header.get(`A${i + 1}`)
      if (!spalte) return
      const wert = zeile[`A${i + 1}`] ?? ''
      const fix = findeReparatur(zeile['Artikel'], achse, wert)
      if (!fix) return
      if (!setCellString(sheet, `${spalte}${zeile._row}`, fix.richtig)) {
        throw new Error(`Zelle ${spalte}${zeile._row} in „${SHEETS.preise}" nicht schreibbar.`)
      }
      treffer.push({ ...fix, zeile: zeile._row, spalte })
    })
  }
  sheet.commit()
  forceFullCalcOnLoad(wb)

  console.log(c.bold(`\n  ${ACHSEN_REPARATUREN.length} Regeln, ${treffer.length} betroffene Zellen:\n`))
  for (const regel of ACHSEN_REPARATUREN) {
    const n = treffer.filter((t) => t.artikel === regel.artikel && t.achse === regel.achse).length
    const zellen = treffer
      .filter((t) => t.artikel === regel.artikel && t.achse === regel.achse)
      .map((t) => `${t.spalte}${t.zeile}`)
      .join(', ')
    console.log(
      `    ${regel.artikel}  ${regel.achse.padEnd(8)} "${regel.falsch}" → "${regel.richtig}"  ${
        n > 0 ? c.green(`${n} Zellen`) : c.dim('nichts zu tun')
      }`,
    )
    console.log(c.dim(`      ${regel.beleg}`))
    if (n > 0) console.log(c.dim(`      ${zellen}`))
  }

  if (treffer.length === 0) {
    console.log(c.green('\n  Die Mappe ist bereits korrigiert — nichts zu tun.\n'))
    return
  }
  if (dryRun) {
    console.log(c.yellow('\n  --dry-run: nichts geschrieben.\n'))
    return
  }

  if (!noBackup) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backup = STAMMDATEN_XLSX.replace(/\.xlsx$/i, `.backup-${stamp}.xlsx`)
    copyFileSync(STAMMDATEN_XLSX, backup)
    console.log(c.dim(`\n  Backup: ${path.basename(backup)}`))
  }
  writeFileWithRetry(STAMMDATEN_XLSX, saveWorkbook(wb))
  console.log(c.green(`  Geschrieben: ${path.basename(STAMMDATEN_XLSX)}`))

  // Gegenprobe: greift jetzt wirklich keine Regel mehr?
  const check = readTable(openWorkbook(readFileSync(STAMMDATEN_XLSX)), SHEETS.preise)
  const uebrig = check.rows.filter((z) => {
    const achsen = achsenVonArtikel.get(z['Artikel']) ?? []
    return achsen.some((achse, i) => findeReparatur(z['Artikel'], achse, z[`A${i + 1}`] ?? ''))
  })
  console.log(
    uebrig.length === 0
      ? c.green('\n  ✓ Gegenprobe: keine fehlerhaften Achsenwerte mehr\n')
      : c.red(`\n  ✗ ${uebrig.length} Zellen weiterhin fehlerhaft\n`),
  )
  if (uebrig.length) process.exitCode = 1
}

try {
  main()
} catch (err) {
  console.error(c.red(`\nFEHLER: ${err.message}\n`))
  if (process.env.DEBUG) console.error(err.stack)
  process.exitCode = 1
}
