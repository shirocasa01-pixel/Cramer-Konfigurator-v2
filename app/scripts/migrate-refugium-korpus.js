#!/usr/bin/env node
/**
 * MIGRATION — Refugium-Korpus auf BREITE × RASTER × TIEFE × PG.
 *
 * Vorher:  6 Preiszeilen  (3 Breiten × 2 Raster), ein Material, eine Tiefe
 * Nachher: 96 Preiszeilen (4 Breitenwerte × 2 Raster × 3 Tiefen × 4 Preisgruppen)
 *
 * Was woher kommt, steht in `scripts/lib/refugium-korpus.js`. Kurz:
 *   PG 1   der gedruckte Refugium-Preis (S. 26), für alle drei Tiefen gleich
 *   PG 2–4 der Atrium-Korpuspreis derselben Breite/Tiefe (S. 13 / 14 / 15)
 *   21 R   bei PG 2–4 der 18-Raster-Preis × 1,20 (Atrium endet bei 18 Rastern);
 *          bei PG 1 bleibt der gedruckte 21-Raster-Preis stehen
 *
 * Die 1,20 dient ausschließlich dieser einmaligen Erzeugung. Im Konfigurator wird
 * anschließend nur noch nachgeschlagen.
 *
 * IDEMPOTENT: Trägt der Artikel bereits eine TIEFE- oder PG-Achse, passiert nichts.
 *
 *   node scripts/migrate-refugium-korpus.js [--dry-run] [--no-backup]
 *   npm run data:migrate-korpus
 */

import { readFileSync, existsSync, copyFileSync } from 'node:fs'

import { STAMMDATEN_XLSX, SHEETS } from './lib/paths.js'
import { baueNummernMigration } from './lib/nummern-migration.js'
import {
  ATRIUM,
  BREITEN,
  PG_STUFEN,
  RASTER_SONDER,
  RASTER_STANDARD,
  REFUGIUM_KORPUS_ARTIKEL,
  SEITE_BREITE,
  SONDERHOEHE_FAKTOR,
  TIEFEN,
  runde2,
} from './lib/refugium-korpus.js'
import {
  openWorkbook,
  readTable,
  readSheet,
  editSheet,
  appendRow,
  setOrCreateCellString,
  setCellNumber,
  forceFullCalcOnLoad,
  saveWorkbook,
  writeFileWithRetry,
} from './lib/xlsx-raw.js'

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
}

const ART_ACHSE_SPALTEN = ['Achse 1', 'Achse 2', 'Achse 3', 'Achse 4', 'Achse 5']
const PREIS_ACHSE_SPALTEN = ['A1', 'A2', 'A3', 'A4', 'A5']
const SPIEGEL_SPALTEN = [
  'Bezeichnung', 'Teileart', 'Produktgruppe', 'Artikelgruppe',
  'Modus', 'Preislogik', 'Einheit', 'Achsen',
]
const ZEILEN_PLATZHALTER = '{ZEILE}'
/** Seite der gedruckten Preisliste je Tiefe — Herkunftsnachweis an der Zeile. */
const QUELLSEITE = { 31: 13, 41: 14, 60: 15 }
/** Tiefe, mit der die sechs bestehenden Zeilen gekennzeichnet werden (Refugium-Standard). */
const BESTANDS_TIEFE = '60'

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const noBackup = process.argv.includes('--no-backup')
  if (!existsSync(STAMMDATEN_XLSX)) throw new Error(`Stammdatendatei nicht gefunden: ${STAMMDATEN_XLSX}`)

  console.log(c.bold('\nRefugium-Korpus: Tiefen- und Preisgruppen-Achse'))
  console.log(c.dim(`  ${STAMMDATEN_XLSX}`))

  const wb = openWorkbook(readFileSync(STAMMDATEN_XLSX))
  const artikelTab = readTable(wb, SHEETS.artikel)
  const preiseTab = readTable(wb, SHEETS.preise)
  const mig = baueNummernMigration({
    artikel: artikelTab.rows,
    artikelgruppen: readTable(wb, SHEETS.artikelgruppen).rows,
    produktgruppen: readTable(wb, SHEETS.produktgruppen).rows,
  })
  const alteNummer = new Map()
  for (const [alt, neu] of mig.nummernMap) alteNummer.set(neu, alt)

  const alt = alteNummer.get(REFUGIUM_KORPUS_ARTIKEL)
  const artZeile = alt ? artikelTab.rows.find((r) => r['Artikelnummer'] === alt) : undefined
  if (!artZeile) throw new Error(`Korpus ${REFUGIUM_KORPUS_ARTIKEL} nicht in „10 Artikel" gefunden.`)

  const achsen = ART_ACHSE_SPALTEN.map((k) => String(artZeile[k] ?? '').trim())
  if (achsen.includes('TIEFE') || achsen.includes('PG')) {
    console.log(c.green('\n  Nichts zu tun — der Korpus trägt bereits TIEFE und/oder PG.\n'))
    return
  }

  const bestand = preiseTab.rows.filter((r) => r['Artikel'] === alt)
  if (bestand.length !== BREITEN.length * 2) {
    throw new Error(
      `Erwartet ${BREITEN.length * 2} Bestandszeilen (3 Breiten × 2 Raster), gefunden ${bestand.length}. ` +
        `Migration abgebrochen — hier stimmt eine Annahme nicht.`,
    )
  }

  const breitenIndex = achsen.indexOf('BREITE')
  const rasterIndex = achsen.indexOf('RASTER')
  if (breitenIndex < 0 || rasterIndex < 0) throw new Error('Korpus führt nicht BREITE und RASTER — Migration abgebrochen.')

  // Gedruckte Refugium-Preise als PG-1-Grundlage einlesen: Breite|Raster → EUR.
  const pg1 = new Map()
  for (const z of bestand) {
    const breite = String(z[PREIS_ACHSE_SPALTEN[breitenIndex]] ?? '').trim()
    const raster = String(z[PREIS_ACHSE_SPALTEN[rasterIndex]] ?? '').trim()
    const preis = Number(String(z['Preis']).replace(',', '.'))
    if (!Number.isFinite(preis)) throw new Error(`Bestandszeile ${z._row} ohne Betrag.`)
    pg1.set(`${breite}|${raster}`, { preis, zeile: z })
  }

  const tiefeSlot = achsen.findIndex((v) => v === '' || /^\d+$/.test(v))
  const pgSlot = tiefeSlot + 1
  if (pgSlot > 4) throw new Error('Zu wenig freie Achsen-Spalten für TIEFE und PG.')

  const artikelBlatt = editSheet(wb, SHEETS.artikel)
  const preiseBlatt = editSheet(wb, SHEETS.preise)
  const preiseSheet = readSheet(wb, SHEETS.preise)
  const vorlage = bestand[0]

  /** Preis für eine Kombination — oder `null`, wenn die Preisliste sie nicht führt. */
  function preisFuer(breite, raster, tiefe, pg) {
    if (pg === 'PG1') {
      // Decoboard: der gedruckte Refugium-Preis, für alle drei Tiefen derselbe.
      return pg1.get(`${breite}|${raster}`)?.preis ?? null
    }
    const atrium = ATRIUM[tiefe]?.[breite]?.[RASTER_STANDARD]?.[pg]
    if (atrium == null) return null
    // Atrium endet bei 18 Rastern — 21 Raster ist die Sonderhöhe (+20 %).
    return raster === String(RASTER_SONDER) ? runde2(atrium * SONDERHOEHE_FAKTOR) : atrium
  }

  /** Baut die Wertemap einer neuen Preiszeile. */
  function baueZeile(breite, raster, tiefe, pg, preis, quellSeite) {
    const werte = {}
    werte[preiseTab.header.get('Artikel')] = alt
    for (const name of SPIEGEL_SPALTEN) {
      const spalte = preiseTab.header.get(name)
      if (!spalte) continue
      const quelle = preiseSheet.get(vorlage._row)?.[spalte]
      if (quelle?.f) werte[spalte] = { f: quelle.f.replaceAll(String(vorlage._row), ZEILEN_PLATZHALTER), v: quelle.v }
      else if (quelle?.v) werte[spalte] = quelle.v
    }
    werte[preiseTab.header.get(PREIS_ACHSE_SPALTEN[breitenIndex])] = breite
    werte[preiseTab.header.get(PREIS_ACHSE_SPALTEN[rasterIndex])] = raster
    werte[preiseTab.header.get(PREIS_ACHSE_SPALTEN[tiefeSlot])] = tiefe
    werte[preiseTab.header.get(PREIS_ACHSE_SPALTEN[pgSlot])] = pg
    werte[preiseTab.header.get('Preis')] = preis
    werte[preiseTab.header.get('Status')] = 'fixed'
    werte[preiseTab.header.get('Seite')] = quellSeite
    return werte
  }

  const neu = []
  const fehlend = []

  // --- 1) Korpusbreiten ------------------------------------------------------------
  for (const breite of BREITEN) {
    for (const raster of [String(RASTER_STANDARD), String(RASTER_SONDER)]) {
      for (const tiefe of TIEFEN) {
        for (const pg of PG_STUFEN) {
          // Die sechs Bestandszeilen werden nicht neu angelegt, sondern beschriftet.
          if (pg === 'PG1' && tiefe === BESTANDS_TIEFE) continue
          const preis = preisFuer(breite, raster, tiefe, pg)
          if (preis == null) {
            fehlend.push(`${breite} · ${raster} R · ${tiefe} cm · ${pg}`)
            continue
          }
          const quelle = pg === 'PG1' ? Number(vorlage['Seite']) || 26 : QUELLSEITE[tiefe]
          neu.push({ breite, raster, tiefe, pg, preis, quelle })
        }
      }
    }
  }

  // --- 2) Bauteilseite („Seite (2,0 cm)" der Atrium-Tabelle) ------------------------
  for (const raster of [String(RASTER_STANDARD), String(RASTER_SONDER)]) {
    for (const tiefe of TIEFEN) {
      for (const pg of PG_STUFEN) {
        const basis = ATRIUM[tiefe]?.[SEITE_BREITE]?.[RASTER_STANDARD]?.[pg]
        if (basis == null) {
          fehlend.push(`${SEITE_BREITE} · ${raster} R · ${tiefe} cm · ${pg}`)
          continue
        }
        const preis = raster === String(RASTER_SONDER) ? runde2(basis * SONDERHOEHE_FAKTOR) : basis
        neu.push({ breite: SEITE_BREITE, raster, tiefe, pg, preis, quelle: QUELLSEITE[tiefe] })
      }
    }
  }

  // --- Ausgabe ----------------------------------------------------------------------
  console.log(c.bold('\n  Bestandszeilen (werden zu TIEFE 60 / PG1)'))
  for (const [schluessel, v] of pg1) console.log(`    ${c.dim('=')} ${schluessel.replace('|', ' · ')} R  →  ${v.preis} €`)
  console.log(c.bold(`\n  Neue Zeilen: ${neu.length}`))
  const proBreite = new Map()
  for (const z of neu) proBreite.set(z.breite, (proBreite.get(z.breite) ?? 0) + 1)
  for (const [b, n] of proBreite) console.log(`    ${c.green('+')} ${b.padEnd(6)} ${n} Zeilen`)
  console.log(c.dim('\n    Proben:'))
  for (const probe of [
    { breite: '60er', raster: '18', tiefe: '60', pg: 'PG1' },
    { breite: '60er', raster: '18', tiefe: '60', pg: 'PG2' },
    { breite: '60er', raster: '21', tiefe: '60', pg: 'PG2' },
    { breite: '60er', raster: '18', tiefe: '31', pg: 'PG3' },
    { breite: 'Seite', raster: '18', tiefe: '60', pg: 'PG4' },
  ]) {
    const t = neu.find((z) => z.breite === probe.breite && z.raster === probe.raster && z.tiefe === probe.tiefe && z.pg === probe.pg)
    const wert = t ? `${t.preis} € (S. ${t.quelle})` : `${pg1.get(`${probe.breite}|${probe.raster}`)?.preis} € — Bestandszeile`
    console.log(c.dim(`      ${probe.breite} · ${probe.raster} R · ${probe.tiefe} cm · ${probe.pg}  →  ${wert}`))
  }
  if (fehlend.length) {
    console.log(c.bold(`\n  ${c.yellow('Ohne Preis geblieben')}`))
    for (const f of fehlend) console.log(`    ${c.yellow('!')} ${f}`)
  }

  if (dryRun) {
    console.log(c.yellow(`\n  --dry-run: nichts geschrieben. (${bestand.length} + ${neu.length} = ${bestand.length + neu.length} Zeilen)\n`))
    return
  }

  // --- Schreiben --------------------------------------------------------------------
  setOrCreateCellString(artikelBlatt, `${artikelTab.header.get(ART_ACHSE_SPALTEN[tiefeSlot])}${artZeile._row}`, 'TIEFE')
  setOrCreateCellString(artikelBlatt, `${artikelTab.header.get(ART_ACHSE_SPALTEN[pgSlot])}${artZeile._row}`, 'PG')
  setOrCreateCellString(
    artikelBlatt,
    `${artikelTab.header.get('Achsen')}${artZeile._row}`,
    'BREITE × RASTER × TIEFE × PG',
  )
  setCellNumber(artikelBlatt, `${artikelTab.header.get('Preiszellen')}${artZeile._row}`, bestand.length + neu.length)
  // Der Korpuspreis hängt jetzt am Material — genau das sagt die Spalte „Oberfläche".
  setOrCreateCellString(artikelBlatt, `${artikelTab.header.get('Oberfläche')}${artZeile._row}`, 'J')

  for (const z of bestand) {
    setOrCreateCellString(preiseBlatt, `${preiseTab.header.get(PREIS_ACHSE_SPALTEN[tiefeSlot])}${z._row}`, BESTANDS_TIEFE)
    setOrCreateCellString(preiseBlatt, `${preiseTab.header.get(PREIS_ACHSE_SPALTEN[pgSlot])}${z._row}`, 'PG1')
  }
  for (const z of neu) {
    const zeilenNr = appendRow(preiseBlatt, baueZeile(z.breite, z.raster, z.tiefe, z.pg, z.preis, z.quelle))
    const re = new RegExp(`<row\\b[^>]*\\br="${zeilenNr}"[^>]*>[\\s\\S]*?</row>`)
    const m = re.exec(preiseBlatt.xml)
    if (m) preiseBlatt.xml = preiseBlatt.xml.replace(re, m[0].replaceAll(ZEILEN_PLATZHALTER, String(zeilenNr)))
  }

  if (!noBackup) {
    const backup = STAMMDATEN_XLSX.replace(/\.xlsx$/, `.backup-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`)
    copyFileSync(STAMMDATEN_XLSX, backup)
    console.log(c.dim(`\n  Sicherung: ${backup}`))
  }
  artikelBlatt.commit()
  preiseBlatt.commit()
  forceFullCalcOnLoad(wb)
  writeFileWithRetry(STAMMDATEN_XLSX, saveWorkbook(wb))
  console.log(c.green(`  Geschrieben: ${bestand.length + neu.length} Preiszeilen. Jetzt \`npm run data:build\` ausführen.\n`))
}

main()
