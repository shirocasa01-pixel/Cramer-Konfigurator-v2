#!/usr/bin/env node
/**
 * MIGRATION — Preisgruppen für die Refugium-Innenausstattung.
 *
 * Schreibt die Aufschläge EINMALIG als Stammdaten in `Cramer-Stammdaten.xlsx`:
 *
 *   „10 Artikel"  je betroffenem Artikel eine zusätzliche Achse `PG`
 *   „20 Preise"   die vorhandene Zeile wird PG1, drei neue Zeilen PG2/PG3/PG4
 *
 * Danach rechnet der Konfigurator NICHT mit Prozentsätzen, sondern schlägt den
 * gespeicherten Preis über die vorhandene PG-Achse nach — dieselbe Mechanik, die
 * Außenset, Atrium-Korpus und Conero G/H längst benutzen.
 *
 * IDEMPOTENT: Ein Artikel, der bereits eine PG-Achse trägt oder dessen Preiszeilen
 * schon PG-Werte führen, wird übersprungen. Zweimal laufen lassen erzeugt keine zweite
 * Garnitur Preiszeilen — geprüft wird VOR dem Schreiben, nicht hinterher aufgeräumt.
 *
 *   node scripts/migrate-refugium-pg.js [--dry-run] [--no-backup]
 *   npm run data:migrate-pg
 */

import { readFileSync, existsSync, copyFileSync } from 'node:fs'

import { STAMMDATEN_XLSX, SHEETS } from './lib/paths.js'
import { baueNummernMigration } from './lib/nummern-migration.js'
import {
  BETROFFENE_ARTIKEL,
  OFFENE_ZUORDNUNG,
  PG_FAKTOREN,
  PG_STUFEN,
  runde2,
} from './lib/refugium-pg.js'
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

/** Achsen-Spalten von „10 Artikel". */
const ART_ACHSE_SPALTEN = ['Achse 1', 'Achse 2', 'Achse 3', 'Achse 4', 'Achse 5']
/** Achsenwert-Spalten von „20 Preise". */
const PREIS_ACHSE_SPALTEN = ['A1', 'A2', 'A3', 'A4', 'A5']
/** Spalten von „20 Preise", die „10 Artikel" per INDEX/MATCH spiegeln. */
const SPIEGEL_SPALTEN = [
  'Bezeichnung',
  'Teileart',
  'Produktgruppe',
  'Artikelgruppe',
  'Modus',
  'Preislogik',
  'Einheit',
  'Achsen',
]
/** Platzhalter für die noch unbekannte Zeilennummer in kopierten Formeln. */
const ZEILEN_PLATZHALTER = '{ZEILE}'

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const noBackup = process.argv.includes('--no-backup')
  if (!existsSync(STAMMDATEN_XLSX)) throw new Error(`Stammdatendatei nicht gefunden: ${STAMMDATEN_XLSX}`)

  console.log(c.bold('\nPreisgruppen für die Refugium-Innenausstattung'))
  console.log(c.dim(`  ${STAMMDATEN_XLSX}`))

  const wb = openWorkbook(readFileSync(STAMMDATEN_XLSX))
  const artikelTab = readTable(wb, SHEETS.artikel)
  const preiseTab = readTable(wb, SHEETS.preise)

  // Die Mappe führt weiterhin die alten Vier-Block-Nummern, die Anwendung die neuen.
  // `nummernMap` übersetzt alt → neu; hier wird die Gegenrichtung gebraucht.
  const mig = baueNummernMigration({
    artikel: artikelTab.rows,
    artikelgruppen: readTable(wb, SHEETS.artikelgruppen).rows,
    produktgruppen: readTable(wb, SHEETS.produktgruppen).rows,
  })
  const alteNummer = new Map()
  for (const [alt, neu] of mig.nummernMap) alteNummer.set(neu, alt)

  const preiseSheet = readSheet(wb, SHEETS.preise)
  const artikelBlatt = editSheet(wb, SHEETS.artikel)
  const preiseBlatt = editSheet(wb, SHEETS.preise)

  const bericht = { migriert: [], uebersprungen: [], fehlend: [], neueZeilen: 0 }

  for (const [neueNr, grund] of Object.entries(BETROFFENE_ARTIKEL)) {
    const alt = alteNummer.get(neueNr)
    const artZeile = alt ? artikelTab.rows.find((r) => r['Artikelnummer'] === alt) : undefined
    if (!artZeile) {
      bericht.fehlend.push({ neueNr, grund: 'Artikel nicht in „10 Artikel" gefunden' })
      continue
    }

    const achsen = ART_ACHSE_SPALTEN.map((k) => String(artZeile[k] ?? '').trim())
    if (achsen.includes('PG')) {
      bericht.uebersprungen.push({ neueNr, grund: 'trägt bereits eine PG-Achse' })
      continue
    }
    // Reine Zahlen in den Achsen-Spalten sind Altlasten und zählen als leer —
    // `build-stammdaten.js` filtert sie an derselben Stelle heraus.
    const freierSlot = achsen.findIndex((v) => v === '' || /^\d+$/.test(v))
    if (freierSlot < 0) {
      bericht.fehlend.push({ neueNr, grund: 'alle fünf Achsen belegt — PG passt nicht mehr hinein' })
      continue
    }

    const zeilen = preiseTab.rows.filter((r) => r['Artikel'] === alt)
    if (zeilen.length === 0) {
      bericht.fehlend.push({ neueNr, grund: 'keine Preiszeile in „20 Preise"' })
      continue
    }
    // Zweites Sicherheitsnetz: Steht in einer Zeile schon irgendwo „PGx", ist der
    // Artikel bereits (teil-)migriert. Dann wird NICHTS geschrieben — lieber melden
    // als doppeln.
    const schonPg = zeilen.some((r) =>
      PREIS_ACHSE_SPALTEN.some((k) => /^PG[1-4]$/i.test(String(r[k] ?? '').trim())),
    )
    if (schonPg) {
      bericht.uebersprungen.push({ neueNr, grund: 'Preiszeilen tragen bereits PG-Werte' })
      continue
    }
    const ohnePreis = zeilen.filter((r) => {
      const n = Number(String(r['Preis'] ?? '').replace(',', '.'))
      return String(r['Preis'] ?? '').trim() === '' || !Number.isFinite(n)
    })
    if (ohnePreis.length > 0) {
      bericht.fehlend.push({
        neueNr,
        grund: `${ohnePreis.length} Preiszeile(n) ohne Betrag — ein Aufschlag auf „kein Preis" ergibt keinen Preis`,
      })
      continue
    }

    // --- „10 Artikel": Achse eintragen -----------------------------------------------
    const achseSpalte = artikelTab.header.get(ART_ACHSE_SPALTEN[freierSlot])
    const achsenTextSpalte = artikelTab.header.get('Achsen')
    const zellenSpalte = artikelTab.header.get('Preiszellen')
    const oberflaecheSpalte = artikelTab.header.get('Oberfläche')
    const neueAchsenListe = [...achsen.slice(0, freierSlot).filter((v) => v && !/^\d+$/.test(v)), 'PG']
    if (!dryRun) {
      setOrCreateCellString(artikelBlatt, `${achseSpalte}${artZeile._row}`, 'PG')
      setOrCreateCellString(artikelBlatt, `${achsenTextSpalte}${artZeile._row}`, neueAchsenListe.join(' × '))
      if (zellenSpalte) {
        setCellNumber(artikelBlatt, `${zellenSpalte}${artZeile._row}`, zeilen.length * PG_STUFEN.length)
      }
      // Der Preis hängt jetzt am Material — genau das sagt die Spalte „Oberfläche" aus.
      if (oberflaecheSpalte) setOrCreateCellString(artikelBlatt, `${oberflaecheSpalte}${artZeile._row}`, 'J')
    }

    // --- „20 Preise": vorhandene Zeile wird PG1 --------------------------------------
    const preisAchseSpalte = preiseTab.header.get(PREIS_ACHSE_SPALTEN[freierSlot])
    for (const zeile of zeilen) {
      if (!dryRun) setOrCreateCellString(preiseBlatt, `${preisAchseSpalte}${zeile._row}`, 'PG1')
    }

    // --- „20 Preise": PG2/PG3/PG4 anhängen ------------------------------------------
    for (const stufe of PG_STUFEN.slice(1)) {
      for (const zeile of zeilen) {
        const basis = Number(String(zeile['Preis']).replace(',', '.'))
        const werte = {}
        werte[preiseTab.header.get('Artikel')] = alt

        // Spalten B–I spiegeln „10 Artikel" per INDEX/MATCH. Die Formel wird aus der
        // Quellzeile übernommen und die Zeilennummer nachgezogen, damit die neue Zeile
        // nicht als einzige leer bleibt.
        for (const name of SPIEGEL_SPALTEN) {
          const spalte = preiseTab.header.get(name)
          if (!spalte) continue
          const quelle = preiseSheet.get(zeile._row)?.[spalte]
          if (quelle?.f) {
            werte[spalte] = { f: quelle.f.replaceAll(String(zeile._row), ZEILEN_PLATZHALTER), v: quelle.v }
          } else if (quelle?.v) {
            werte[spalte] = quelle.v
          }
        }

        // Achsenwerte 1:1 übernehmen — nur die PG-Spalte trägt die Stufe.
        PREIS_ACHSE_SPALTEN.forEach((k, i) => {
          const spalte = preiseTab.header.get(k)
          const wert = i === freierSlot ? stufe : String(zeile[k] ?? '')
          if (wert !== '') werte[spalte] = wert
        })

        werte[preiseTab.header.get('Preis')] = runde2(basis * PG_FAKTOREN[stufe])
        werte[preiseTab.header.get('Status')] = String(zeile['Status'] ?? 'fixed')
        const seite = Number(String(zeile['Seite'] ?? '').replace(',', '.'))
        if (Number.isFinite(seite) && String(zeile['Seite'] ?? '').trim() !== '') {
          werte[preiseTab.header.get('Seite')] = seite
        }
        // `Ref` bleibt leer: Die Zeile hat kein Gegenstück in der Vorgänger-Extraktion.

        if (!dryRun) {
          const neueZeilenNr = appendRow(preiseBlatt, werte)
          setzeZeilennummerInFormeln(preiseBlatt, neueZeilenNr)
        }
        bericht.neueZeilen += 1
      }
    }

    bericht.migriert.push({
      neueNr,
      grund,
      basiszeilen: zeilen.length,
      achse: ART_ACHSE_SPALTEN[freierSlot],
    })
  }

  // --- Ausgabe ------------------------------------------------------------------------
  if (bericht.migriert.length) {
    console.log(c.bold('\n  Migriert'))
    for (const m of bericht.migriert) {
      console.log(
        `    ${c.green('+')} ${m.neueNr}  ${m.achse} = PG  ·  ${m.basiszeilen} Basiszeile(n) → ${m.basiszeilen * PG_STUFEN.length} Zeilen`,
      )
      console.log(c.dim(`        ${m.grund}`))
    }
  }
  if (bericht.uebersprungen.length) {
    console.log(c.bold('\n  Übersprungen (bereits migriert)'))
    for (const u of bericht.uebersprungen) console.log(`    ${c.dim('=')} ${u.neueNr} — ${u.grund}`)
  }
  if (bericht.fehlend.length) {
    console.log(c.bold(`\n  ${c.yellow('Nicht migriert')}`))
    for (const f of bericht.fehlend) console.log(`    ${c.yellow('!')} ${f.neueNr} — ${f.grund}`)
  }
  console.log(c.bold('\n  Offene fachliche Zuordnung (bewusst unverändert)'))
  for (const [nr, frage] of Object.entries(OFFENE_ZUORDNUNG)) console.log(`    ${c.dim('?')} ${nr} — ${frage}`)

  console.log(c.bold(`\n  ${bericht.migriert.length} Artikel · ${bericht.neueZeilen} neue Preiszeilen`))

  if (dryRun) {
    console.log(c.yellow('\n  --dry-run: nichts geschrieben.\n'))
    return
  }
  if (bericht.neueZeilen === 0) {
    console.log(c.green('\n  Nichts zu tun — die Mappe ist bereits auf diesem Stand.\n'))
    return
  }

  if (!noBackup) {
    const backup = STAMMDATEN_XLSX.replace(
      /\.xlsx$/,
      `.backup-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`,
    )
    copyFileSync(STAMMDATEN_XLSX, backup)
    console.log(c.dim(`\n  Sicherung: ${backup}`))
  }

  artikelBlatt.commit()
  preiseBlatt.commit()
  // Die gespiegelten Spalten sind Formeln — Excel soll sie beim Öffnen neu rechnen.
  forceFullCalcOnLoad(wb)
  writeFileWithRetry(STAMMDATEN_XLSX, saveWorkbook(wb))
  console.log(c.green('  Geschrieben. Jetzt `npm run data:build` ausführen.\n'))
}

/**
 * Setzt in den gerade angehängten Formeln die richtige Zeilennummer ein.
 *
 * `appendRow` kennt die neue Zeilennummer erst beim Schreiben; die Formeln wurden davor
 * mit einem Platzhalter gebaut. Ein zweiter, eng begrenzter Durchlauf über genau diese
 * eine Zeile ist einfacher und nachvollziehbarer, als `appendRow` um eine
 * Rückrufschnittstelle zu erweitern.
 */
function setzeZeilennummerInFormeln(sheetState, zeilenNr) {
  const re = new RegExp(`<row\\b[^>]*\\br="${zeilenNr}"[^>]*>[\\s\\S]*?</row>`)
  const m = re.exec(sheetState.xml)
  if (!m) return
  sheetState.xml = sheetState.xml.replace(re, m[0].replaceAll(ZEILEN_PLATZHALTER, String(zeilenNr)))
}

main()
