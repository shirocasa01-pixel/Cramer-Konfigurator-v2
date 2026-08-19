#!/usr/bin/env node
/**
 * SCHRITT 1 — Echte Filial-Stammdaten aus dem Vorgänger-Tool in die Mappe übernehmen.
 *
 * Das Blatt „41 Filialen" enthielt zwei Beispielzeilen mit Platzhalter-Anschriften
 * („Beispielstraße 1"). Die echten sechs Standorte lagen bis dahin nur hartcodiert in
 * `src/config/branches.ts` — dieselbe Datei ist im Vorgänger-Tool byte-identisch, es ist
 * also derselbe, geprüfte Datenbestand.
 *
 *   F-001 und F-002 BEHALTEN ihre Nummer (dort stehen bereits Cramer Möbel+Design und
 *   Wohnvilla), es werden nur die Anschriften vervollständigt. Damit bleiben die
 *   Verweise aus „40 Mitarbeiter" gültig — „Nummer = Identität" (ARTIKELNUMMER-LOGIK.md).
 *
 * Zusätzlich bekommt das Blatt die Spalte `Alt-ID`: die frühere Code-ID der Filiale.
 * Bereits gespeicherte Entwürfe referenzieren diese Slugs in `Draft.branchId`; über die
 * Spalte lassen sie sich weiter auflösen, ohne dass eine Zuordnung im Code steht.
 *
 * Idempotent: ein zweiter Lauf meldet 0 Änderungen.
 *
 *   node scripts/seed-filialen.js [--dry-run] [--no-backup]
 */

import { readFileSync, existsSync, copyFileSync } from 'node:fs'
import path from 'node:path'

import { STAMMDATEN_XLSX, SHEETS } from './lib/paths.js'
import {
  openWorkbook, readTable, editSheet, appendRow,
  setOrCreateCellString, forceFullCalcOnLoad, saveWorkbook, writeFileWithRetry,
} from './lib/xlsx-raw.js'

/**
 * Die sechs echten Standorte, in der Reihenfolge von `src/config/branches.ts`.
 * `altId` ist die dortige ID — sie wandert als Spalte mit in die Mappe.
 */
const FILIALEN = [
  {
    filialnr: 'F-001', altId: 'cramer-moebel-design-hamburg',
    name: 'Cramer Möbel+Design GmbH', strasse: 'Kieler Straße 301',
    plz: '22525', ort: 'Hamburg', telefon: '040-5473780', email: 'm+d@cramer.de',
  },
  {
    filialnr: 'F-002', altId: 'cramer-wohnvilla-hamburg',
    name: 'Cramer Wohnvilla', strasse: 'Osterstraße 29',
    plz: '20259', ort: 'Hamburg', telefon: '040-403508', email: 'wohnvilla@cramer.de',
  },
  {
    filialnr: 'F-003', altId: 'cramer-2c-elmshorn',
    name: 'Cramer+Cramer 2C-Möbelfabrik (GmbH + Co. KG)', strasse: 'Sibirien 6a',
    plz: '25335', ort: 'Elmshorn', telefon: '04121-8004-0', email: 'info@cramer.de',
  },
  {
    filialnr: 'F-004', altId: 'cramer-stammhaus-elmshorn',
    name: 'Cramer Stammhaus', strasse: 'Sibirien 6',
    plz: '25335', ort: 'Elmshorn', telefon: '04121-800450', email: '',
  },
  {
    filialnr: 'F-005', altId: 'cramer-design-loft-berlin',
    name: 'Cramer Design Loft', strasse: 'Meinekestraße 11',
    plz: '10719', ort: 'Berlin', telefon: '030-8819216', email: 'berlin@cramer.de',
  },
  {
    filialnr: 'F-006', altId: 'cor-studio-berlin',
    name: 'COR Studio Berlin', strasse: 'Grolmannstraße 36',
    plz: '10623', ort: 'Berlin', telefon: '030-88920888', email: 'info@corberlin.de',
  },
]

/** Spalte im Blatt „41 Filialen" → Feld im Datensatz oben. */
const SPALTEN = {
  'Filialnr': 'filialnr',
  'Name': 'name',
  'Straße': 'strasse',
  'PLZ': 'plz',
  'Ort': 'ort',
  'Telefon': 'telefon',
  'E-Mail': 'email',
  'Status': 'status',
  'Alt-ID': 'altId',
}

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

  console.log(c.bold('\nSCHRITT 1 — Filial-Stammdaten vervollständigen'))

  const wb = openWorkbook(readFileSync(STAMMDATEN_XLSX))
  const vorher = readTable(wb, SHEETS.filialen)
  const sheet = editSheet(wb, SHEETS.filialen)

  // --- Spalte „Alt-ID" anlegen, falls noch nicht vorhanden -------------------------
  const header = new Map(vorher.header)
  if (!header.has('Alt-ID')) {
    const letzteSpalte = [...header.values()].sort().pop() ?? 'H'
    const neueSpalte = String.fromCharCode(letzteSpalte.charCodeAt(0) + 1)
    if (!setOrCreateCellString(sheet, `${neueSpalte}1`, 'Alt-ID')) {
      throw new Error(`Kopfzelle ${neueSpalte}1 konnte nicht angelegt werden.`)
    }
    header.set('Alt-ID', neueSpalte)
    console.log(c.dim(`  Spalte „Alt-ID" ergänzt (${neueSpalte})`))
  }

  // --- Bestehende Zeilen aktualisieren, fehlende anhängen ---------------------------
  const zeileNach = new Map(vorher.rows.map((r) => [r['Filialnr'], r._row]))
  let aktualisiert = 0
  let angelegt = 0
  const aenderungen = []

  for (const f of FILIALEN) {
    const datensatz = { ...f, status: 'aktiv' }
    const zeile = zeileNach.get(f.filialnr)

    if (zeile != null) {
      const alt = vorher.rows.find((r) => r._row === zeile)
      for (const [spaltenName, feld] of Object.entries(SPALTEN)) {
        const col = header.get(spaltenName)
        if (!col) continue
        const neu = datensatz[feld] ?? ''
        if ((alt?.[spaltenName] ?? '') === neu) continue
        if (!setOrCreateCellString(sheet, `${col}${zeile}`, neu)) {
          throw new Error(`Zelle ${col}${zeile} in „${SHEETS.filialen}" nicht schreibbar.`)
        }
        aenderungen.push(`${f.filialnr} ${spaltenName}: "${alt?.[spaltenName] ?? ''}" → "${neu}"`)
      }
      aktualisiert++
    } else {
      const values = {}
      for (const [spaltenName, feld] of Object.entries(SPALTEN)) {
        const col = header.get(spaltenName)
        if (col) values[col] = datensatz[feld] ?? ''
      }
      appendRow(sheet, values)
      angelegt++
    }
  }
  sheet.commit()

  // --- Mitarbeiter: Filialverweise prüfen -------------------------------------------
  const mitarbeiter = readTable(wb, SHEETS.mitarbeiter)
  const gueltig = new Set(FILIALEN.map((f) => f.filialnr))
  const offen = mitarbeiter.rows.filter((m) => m['Filiale'] && !gueltig.has(m['Filiale']))

  forceFullCalcOnLoad(wb)

  // --- Bericht ------------------------------------------------------------------------
  console.log(c.bold(`\n  „${SHEETS.filialen}" — ${FILIALEN.length} Standorte:\n`))
  console.log(`    ${'Nr'.padEnd(6)} ${'Name'.padEnd(46)} ${'Ort'.padEnd(10)} ${'Telefon'.padEnd(14)} Alt-ID`)
  console.log(c.dim(`    ${'─'.repeat(6)} ${'─'.repeat(46)} ${'─'.repeat(10)} ${'─'.repeat(14)} ${'─'.repeat(28)}`))
  for (const f of FILIALEN) {
    const neu = !zeileNach.has(f.filialnr)
    console.log(
      `    ${(neu ? c.green(f.filialnr) : f.filialnr).padEnd(neu ? 15 : 6)} ${f.name.padEnd(46)} ${f.ort.padEnd(10)} ${(f.telefon || '—').padEnd(14)} ${c.dim(f.altId)}`,
    )
  }

  if (aenderungen.length) {
    console.log(c.bold('\n  Korrigierte Felder:'))
    for (const a of aenderungen) console.log(`    · ${a}`)
  }

  console.log(c.bold('\n  Mitarbeiter-Zuordnung:'))
  for (const m of mitarbeiter.rows) {
    const f = FILIALEN.find((x) => x.filialnr === m['Filiale'])
    console.log(`    ${m['Personalnr']}  ${(m['Name'] ?? '').padEnd(22)} ${(m['Rolle'] ?? '').padEnd(9)} ${m['Filiale'] || c.dim('— ohne Filiale')}${f ? c.dim(`  (${f.name})`) : ''}`)
  }
  if (offen.length) {
    console.log(c.yellow(`\n  ${offen.length} Mitarbeiter verweisen auf eine unbekannte Filiale:`))
    for (const m of offen) console.log(c.yellow(`    • ${m['Personalnr']} ${m['Name']}: „${m['Filiale']}"`))
  }

  console.log(c.bold('\n  Ergebnis:'))
  console.log(`    ${angelegt} Filialen neu angelegt · ${aktualisiert} aktualisiert · ${aenderungen.length} Felder geändert`)

  if (dryRun) {
    console.log(c.yellow('\n  --dry-run: nichts geschrieben.\n'))
    return
  }
  if (angelegt === 0 && aenderungen.length === 0) {
    console.log(c.dim('\n  Nichts zu tun — die Mappe ist bereits vollständig.\n'))
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

  // --- Gegenprobe ----------------------------------------------------------------------
  const check = readTable(openWorkbook(readFileSync(STAMMDATEN_XLSX)), SHEETS.filialen)
  const vollstaendig = check.rows.filter((r) => r['Name'] && r['Straße'] && r['PLZ'] && r['Ort'])
  console.log(
    vollstaendig.length === FILIALEN.length
      ? c.green(`\n  ✓ ${check.rows.length} Filialen eingelesen, alle mit vollständiger Anschrift\n`)
      : c.red(`\n  ✗ nur ${vollstaendig.length} von ${check.rows.length} Zeilen vollständig\n`),
  )
  if (vollstaendig.length !== FILIALEN.length) process.exitCode = 1
}

try {
  main()
} catch (err) {
  console.error(c.red(`\nFEHLER: ${err.message}\n`))
  if (process.env.DEBUG) console.error(err.stack)
  process.exitCode = 1
}
