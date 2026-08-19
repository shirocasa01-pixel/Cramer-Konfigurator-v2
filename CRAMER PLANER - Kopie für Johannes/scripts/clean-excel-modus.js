#!/usr/bin/env node
/**
 * SCHRITT 1 — Modus-Spalte der Stammdaten auf reine Buchstaben-Notation umstellen.
 *
 *   `A_P_O_S__`  →  `APOS`
 *   `_R_V_`      →  `RV`
 *   `R, P`       →  `PR`   (kanonisch sortiert laut „30 Programme")
 *
 * Was das Script anfasst:
 *   • „10 Artikel", Spalte `Modus`            — die eigentliche Umstellung
 *   • „20 Preise",  Spalte `Modus`            — nur der zwischengespeicherte Formelwert
 *                                               (die INDEX/MATCH-Formel bleibt unverändert)
 *   • `xl/workbook.xml`                       — `fullCalcOnLoad`, damit Excel neu rechnet
 *
 * Alles andere — 12.072 Formeln, Autofilter, Zellformate, Drawings — bleibt Byte-identisch,
 * weil die Mappe nicht neu geschrieben, sondern zellweise bearbeitet wird.
 *
 * Aufruf:
 *   node scripts/clean-excel-modus.js               # überschreibt die Stammdatei (mit Backup)
 *   node scripts/clean-excel-modus.js --dry-run     # nur berichten, nichts schreiben
 *   node scripts/clean-excel-modus.js --out neu.xlsx
 *   node scripts/clean-excel-modus.js --no-backup
 */

import { readFileSync, existsSync, copyFileSync } from 'node:fs'
import path from 'node:path'

import { STAMMDATEN_XLSX, SHEETS } from './lib/paths.js'
import { normalizeModus, readProgramCodes } from './lib/modus.js'
import { openWorkbook, readTable, editSheet, setCellString, setFormulaCachedString, forceFullCalcOnLoad, saveWorkbook, writeFileWithRetry } from './lib/xlsx-raw.js'

const MODUS_HEADER = 'Modus'
const ARTIKEL_KEY = 'Artikelnummer'
const PREISE_KEY = 'Artikel'

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { in: STAMMDATEN_XLSX, out: null, dryRun: false, backup: true }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run' || a === '-n') opts.dryRun = true
    else if (a === '--no-backup') opts.backup = false
    else if (a === '--in') opts.in = path.resolve(argv[++i])
    else if (a === '--out') opts.out = path.resolve(argv[++i])
    else if (a === '--help' || a === '-h') opts.help = true
    else throw new Error(`Unbekannte Option: ${a}`)
  }
  opts.out ??= opts.in
  return opts
}

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
}

// ---------------------------------------------------------------------------

function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(readFileSync(new URL(import.meta.url)).toString().split('*/')[0].replace(/^#!.*\n/, ''))
    return
  }
  if (!existsSync(opts.in)) throw new Error(`Stammdatendatei nicht gefunden: ${opts.in}`)

  console.log(c.bold('\nSCHRITT 1 — Modus-Spalte bereinigen'))
  console.log(c.dim(`  Quelle: ${opts.in}`))

  const wb = openWorkbook(readFileSync(opts.in))

  // --- 1) Serien-Kürzel aus der Mappe holen (kein hartcodiertes Alphabet) ---------
  const programme = readTable(wb, SHEETS.programme)
  const codes = readProgramCodes(programme.rows)

  console.log(c.bold(`\n  Serien laut „${SHEETS.programme}" (${codes.size}):`))
  for (const p of [...codes.values()].sort((a, b) => a.position - b.position)) {
    console.log(`    ${c.cyan(p.code)}  ${p.name.padEnd(12)} ${c.dim(p.id.padEnd(12) + p.focus)}`)
  }

  // --- 2) „10 Artikel" umstellen --------------------------------------------------
  const artikel = readTable(wb, SHEETS.artikel)
  const modusCol = artikel.header.get(MODUS_HEADER)
  if (!modusCol) throw new Error(`Spalte "${MODUS_HEADER}" fehlt in „${SHEETS.artikel}".`)

  const sheet = editSheet(wb, SHEETS.artikel)
  /** Artikelnummer -> neuer Modus, für den Abgleich mit „20 Preise" */
  const newByArticle = new Map()
  /** alter Wert -> { neu, anzahl } */
  const transitions = new Map()
  const problems = []
  let changed = 0

  for (const row of artikel.rows) {
    const before = row[MODUS_HEADER] ?? ''
    const { value: after, unknown, caseConflicts } = normalizeModus(before, codes)

    if (unknown.length) problems.push(`Zeile ${row._row} (${row[ARTIKEL_KEY]}): unbekannte Zeichen ${unknown.map((x) => JSON.stringify(x)).join(', ')} in "${before}" — ignoriert`)
    if (caseConflicts.length) problems.push(`Zeile ${row._row} (${row[ARTIKEL_KEY]}): "${before}" nennt ${caseConflicts.join('/')} in beiden Schreibweisen — erste gewinnt`)
    if (after === '') problems.push(`Zeile ${row._row} (${row[ARTIKEL_KEY]}): "${before}" ergibt keine einzige Serie — Artikel wäre nirgends verfügbar`)

    newByArticle.set(row[ARTIKEL_KEY], after)

    const t = transitions.get(before) ?? { after, count: 0 }
    t.count++
    transitions.set(before, t)

    if (after !== before) {
      if (!setCellString(sheet, `${modusCol}${row._row}`, after)) {
        throw new Error(`Zelle ${modusCol}${row._row} in „${SHEETS.artikel}" nicht gefunden.`)
      }
      changed++
    }
  }
  sheet.commit()

  // --- 3) Gespiegelte Werte in „20 Preise" nachziehen -----------------------------
  const preise = readTable(wb, SHEETS.preise)
  const preisModusCol = preise.header.get(MODUS_HEADER)
  let mirrored = 0
  let mirrorMisses = 0

  if (preisModusCol) {
    const preisSheet = editSheet(wb, SHEETS.preise)
    for (const row of preise.rows) {
      const after = newByArticle.get(row[PREISE_KEY])
      if (after == null) { mirrorMisses++; continue }
      if (row[MODUS_HEADER] === after) continue
      if (setFormulaCachedString(preisSheet, `${preisModusCol}${row._row}`, after)) mirrored++
    }
    preisSheet.commit()
  }
  forceFullCalcOnLoad(wb)

  // --- 4) Bericht ------------------------------------------------------------------
  console.log(c.bold(`\n  Modus-Werte in „${SHEETS.artikel}" (${transitions.size} verschiedene, ${artikel.rows.length} Artikel):\n`))
  console.log(`    ${'ALT'.padEnd(13)}  ${'NEU'.padEnd(11)} ${'Artikel'.padStart(7)}   freigegeben für`)
  console.log(c.dim(`    ${'─'.repeat(13)}  ${'─'.repeat(11)} ${'─'.repeat(7)}   ${'─'.repeat(46)}`))
  const sorted = [...transitions].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
  for (const [before, { after, count }] of sorted) {
    const series = [...after].map((ch) => {
      const p = codes.get(ch.toUpperCase())
      return ch === ch.toLowerCase() ? `${p.name}*` : p.name
    })
    const mark = after === before ? c.dim('=') : c.green('→')
    console.log(`    ${before.padEnd(13)} ${mark} ${c.bold(after.padEnd(11))} ${String(count).padStart(7)}   ${c.dim(series.join(', '))}`)
  }
  if (sorted.some(([, t]) => /[a-z]/.test(t.after))) console.log(c.dim('\n    * Sonderanfertigung (Kleinbuchstabe) — Preis auf Anfrage'))

  if (problems.length) {
    console.log(c.yellow(`\n  ${problems.length} Hinweis(e):`))
    for (const p of problems) console.log(c.yellow(`    • ${p}`))
  }

  console.log(c.bold('\n  Ergebnis:'))
  console.log(`    ${String(changed).padStart(5)} von ${artikel.rows.length} Artikelzeilen umgestellt${changed === 0 ? c.dim(' (bereits sauber)') : ''}`)
  console.log(`    ${String(mirrored).padStart(5)} Preiszeilen mit nachgezogenem Spiegelwert ${c.dim(`(von ${preise.rows.length}; Formeln unverändert)`)}`)
  if (mirrorMisses) console.log(c.yellow(`    ${String(mirrorMisses).padStart(5)} Preiszeilen ohne passenden Artikel — unangetastet gelassen`))

  // --- 5) Schreiben ------------------------------------------------------------------
  if (opts.dryRun) {
    console.log(c.yellow('\n  --dry-run: nichts geschrieben.\n'))
    return
  }

  if (opts.backup && opts.out === opts.in) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backup = opts.in.replace(/\.xlsx$/i, `.backup-${stamp}.xlsx`)
    copyFileSync(opts.in, backup)
    console.log(c.dim(`\n  Backup: ${path.basename(backup)}`))
  }

  writeFileWithRetry(opts.out, saveWorkbook(wb))
  console.log(c.green(`  Geschrieben: ${opts.out}`))

  // --- 6) Gegenprobe an der geschriebenen Datei --------------------------------------
  const check = openWorkbook(readFileSync(opts.out))
  const checkArtikel = readTable(check, SHEETS.artikel)
  const stillDirty = checkArtikel.rows.filter((r) => /[^A-Za-z]/.test(r[MODUS_HEADER] ?? ''))
  const emptyModus = checkArtikel.rows.filter((r) => (r[MODUS_HEADER] ?? '') === '')
  const checkPreise = readTable(check, SHEETS.preise)
  const preiseDirty = checkPreise.rows.filter((r) => /[^A-Za-z]/.test(r[MODUS_HEADER] ?? '')).length

  console.log(c.bold('\n  Gegenprobe (neu eingelesen):'))
  console.log(`    ${checkArtikel.rows.length} Artikel · ${checkPreise.rows.length} Preiszeilen · ${check.sheetPath.size} Blätter erhalten`)
  console.log(
    stillDirty.length === 0 && preiseDirty === 0
      ? c.green(`    ✓ Modus enthält ausschließlich Serien-Buchstaben (${emptyModus.length} leer)`)
      : c.red(`    ✗ ${stillDirty.length} Artikel- und ${preiseDirty} Preiszeilen enthalten noch Sonderzeichen`),
  )
  if (stillDirty.length || preiseDirty) process.exitCode = 1
  console.log('')
}

try {
  main()
} catch (err) {
  console.error(c.red(`\nFEHLER: ${err.message}\n`))
  process.exitCode = 1
}
