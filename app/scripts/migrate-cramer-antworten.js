#!/usr/bin/env node
/**
 * MIGRATION — Antworten von Cramer auf die Rückfragen der Preisarten-Überarbeitung
 * (23.09.2026), soweit sie die Stammdaten-Mappe betreffen.
 *
 *   10 Artikel   TPL-001 / TPL-002 Tavolo-Massivplatten → Status „entwurf", Preisart
 *                „Auf Anfrage": Tavolo wird im Konfigurator derzeit nicht verbaut. Die
 *                Preiszeilen bleiben stehen — sie werden gebraucht, sobald Tavolo kommt.
 *                GRF-001 Edge-Griff → Bemerkung mit der vollständigen Vorgabe (Länge nach
 *                Türhöhe, an Drehtüren kürzbar, nur vertikal, Stahl, RAL-Ton nach Wahl).
 *
 * Die übrigen Antworten (Edge-Staffel, Wandtablar, Aufkantung, Container-Sperre,
 * Personalnummer M-104) betreffen Supabase-Overrides — die Mappe trägt dort bereits den
 * Stand der Preisliste. Siehe `scripts/bereinige-overrides-cramer-antworten.js`.
 *
 * IDEMPOTENT: Ein zweiter Lauf meldet „nichts zu tun".
 *
 *   node scripts/migrate-cramer-antworten.js [--dry-run] [--no-backup]
 *   npm run data:migrate-cramer-antworten
 */

import { readFileSync, existsSync, copyFileSync } from 'node:fs'

import { STAMMDATEN_XLSX, SHEETS } from './lib/paths.js'
import { openWorkbook, readTable, editSheet, setOrCreateCellString, saveWorkbook, writeFileWithRetry } from './lib/xlsx-raw.js'

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
}

const TAVOLO_BEMERKUNG =
  'Auf Anfrage: Tavolo wird im Konfigurator derzeit nicht verbaut (Cramer, 23.09.2026). ' +
  'Die Preiszeilen bleiben für die spätere Zuordnung stehen (3 cm / 4 cm / andere Formen, ' +
  'laut Preisliste zzgl. Grundpreis 115 €).'

/** Soll-Stand je Kurzzeichen: nur die Spalten, die diese Migration setzt. */
const SOLL = [
  { kurzzeichen: 'TPL-001', werte: { Status: 'entwurf', Preislogik: 'AUF_ANFRAGE', Bemerkung: TAVOLO_BEMERKUNG } },
  { kurzzeichen: 'TPL-002', werte: { Status: 'entwurf', Preislogik: 'AUF_ANFRAGE', Bemerkung: TAVOLO_BEMERKUNG } },
  {
    kurzzeichen: 'GRF-001',
    werte: {
      Bemerkung:
        'Länge: bei Schiebetüren über die volle Türhöhe (Stabilität); bei Drehtüren auch gekürzt möglich. ' +
        'Griff nur vertikal einplanen, horizontal nicht möglich — deshalb nur an Dreh- und Schiebetüren. ' +
        'Material Stahl, Oberfläche RAL-Ton nach Wahl. Die Länge übernimmt der Konfigurator aus der ' +
        'Türhöhe; an Drehtüren kann sie gekürzt werden (Cramer, 23.09.2026).',
    },
  },
]

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const noBackup = process.argv.includes('--no-backup')
  if (!existsSync(STAMMDATEN_XLSX)) throw new Error(`Stammdatendatei nicht gefunden: ${STAMMDATEN_XLSX}`)

  console.log(c.bold('\nAntworten Cramer (23.09.2026) — Stammdaten-Mappe'))
  console.log(c.dim(`  ${STAMMDATEN_XLSX}`))

  const wb = openWorkbook(readFileSync(STAMMDATEN_XLSX))
  const artikelTab = readTable(wb, SHEETS.artikel)
  const sp = (name) => {
    const ref = artikelTab.header.get(name)
    if (!ref) throw new Error(`„${SHEETS.artikel}" führt keine Spalte „${name}".`)
    return ref
  }

  const plan = []
  for (const { kurzzeichen, werte } of SOLL) {
    const zeile = artikelTab.rows.find((r) => String(r['Kurzzeichen'] ?? '').trim() === kurzzeichen)
    if (!zeile) throw new Error(`Artikel ${kurzzeichen} nicht in „${SHEETS.artikel}" gefunden.`)
    for (const [spalte, soll] of Object.entries(werte)) {
      const ist = String(zeile[spalte] ?? '')
      if (ist === soll) continue
      plan.push({ ref: `${sp(spalte)}${zeile._row}`, soll, text: `${kurzzeichen} ${zeile['Bezeichnung']} · ${spalte}: „${ist || '—'}" → „${soll}"` })
    }
  }

  if (plan.length === 0) {
    console.log(c.green('\n  Nichts zu tun — die Mappe ist bereits auf dem aktuellen Stand.\n'))
    return
  }
  console.log(c.bold('\n  Änderungen'))
  for (const p of plan) console.log(`    ${c.green('~')} ${p.text}`)

  if (dryRun) {
    console.log(c.yellow('\n  --dry-run: nichts geschrieben.\n'))
    return
  }

  const artikelBlatt = editSheet(wb, SHEETS.artikel)
  for (const { ref, soll } of plan) {
    if (!setOrCreateCellString(artikelBlatt, ref, soll)) throw new Error(`Zelle ${ref} nicht beschreibbar.`)
  }
  if (!noBackup) {
    const backup = STAMMDATEN_XLSX.replace(/\.xlsx$/, `.backup-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`)
    copyFileSync(STAMMDATEN_XLSX, backup)
    console.log(c.dim(`\n  Sicherung: ${backup}`))
  }
  artikelBlatt.commit()
  writeFileWithRetry(STAMMDATEN_XLSX, saveWorkbook(wb))
  console.log(c.green('  Geschrieben. Jetzt `npm run data:build` ausführen.\n'))
}

main()
