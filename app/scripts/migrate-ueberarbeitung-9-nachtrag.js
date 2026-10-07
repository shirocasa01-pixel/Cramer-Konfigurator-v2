#!/usr/bin/env node
/**
 * MIGRATION — Überarbeitung 9 (Nachtrag 10/2026) in die Stammdaten-Mappe.
 *
 *   LEU-008  LED-Syncro 100er               405 → 400 € (Tippfehler der Preisliste)
 *   CON-019  Container Decoboard            BREITE × HOEHE → BREITE × HOEHE × PG, + 3 R / 7,5 R
 *   CON-029  Container Rauchglas            dito (Decoboard + 210/220/230 € Deckplatte)
 *   CON-007…014 Conero G/H                  + PG 2–4 (+30/40/50 %)
 *   CON-030…033 Conero H                    neue Ausführungen 6 Hosenhalter/1 Wäschesack, 2 Wäschesäcke
 *   AZG-002  Rollkorb                       BREITE → BREITE × PG
 *   ZUS-001 / ZUS-004 Raumteiler, Sichtrückwand → Status „entwurf"
 *   ZUB-011  Schubladenunterteilung          Bemerkung „immer PG 1" (die Regel steht im Lookup)
 *   Craft    Breitenstufe „50/60er"          Schwelle 50 → 60 cm (60er Korpus bekam den 80er-Preis)
 *
 * Was woher kommt, steht in `scripts/lib/ueberarbeitung-9-nachtrag.js`.
 *
 * IDEMPOTENT: Jeder Teil prüft, ob die Mappe ihn schon trägt (Achse PG vorhanden, Zeile
 * vorhanden, Artikel vorhanden, Status gesetzt). Ein zweiter Lauf meldet „nichts zu tun".
 *
 *   node scripts/migrate-ueberarbeitung-9-nachtrag.js [--dry-run] [--no-backup]
 *   npm run data:migrate-ue9-nachtrag
 */

import { readFileSync, existsSync, copyFileSync } from 'node:fs'

import { STAMMDATEN_XLSX, SHEETS } from './lib/paths.js'
import {
  AUF_ENTWURF,
  BREITENSTUFE_50_60,
  BASIS_CONTAINER,
  CONERO_GH,
  CONERO_H_BEMERKUNG,
  CONERO_H_NEU,
  LED_SYNCRO,
  PG_FAKTOREN,
  PG_STUFEN,
  ROLLKORB,
  SCHUBLADENUNTERTEILUNG,
  runde2,
} from './lib/ueberarbeitung-9-nachtrag.js'
import {
  openWorkbook,
  readTable,
  readSheet,
  editSheet,
  appendRow,
  setCellString,
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
/** Spalten von „20 Preise", die „10 Artikel" per INDEX/MATCH spiegeln. */
const SPIEGEL_SPALTEN = ['Bezeichnung', 'Teileart', 'Produktgruppe', 'Artikelgruppe', 'Modus', 'Preislogik', 'Einheit', 'Achsen']
const ZEILEN_PLATZHALTER = '{ZEILE}'
const ZAHL_SPALTEN = new Set(['Preiszellen', 'Sortierung'])

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const noBackup = process.argv.includes('--no-backup')
  if (!existsSync(STAMMDATEN_XLSX)) throw new Error(`Stammdatendatei nicht gefunden: ${STAMMDATEN_XLSX}`)

  console.log(c.bold('\nÜberarbeitung 9 (Nachtrag) — Stammdaten'))
  console.log(c.dim(`  ${STAMMDATEN_XLSX}`))

  const wb = openWorkbook(readFileSync(STAMMDATEN_XLSX))
  const artikelTab = readTable(wb, SHEETS.artikel)
  const preiseTab = readTable(wb, SHEETS.preise)
  const preiseSheet = readSheet(wb, SHEETS.preise)

  const aSp = (name) => {
    const s = artikelTab.header.get(name)
    if (!s) throw new Error(`„${SHEETS.artikel}" führt keine Spalte „${name}".`)
    return s
  }
  const pSp = (name) => {
    const s = preiseTab.header.get(name)
    if (!s) throw new Error(`„${SHEETS.preise}" führt keine Spalte „${name}".`)
    return s
  }
  const artikelNach = (kurzzeichen) => artikelTab.rows.find((r) => String(r['Kurzzeichen'] ?? '').trim() === kurzzeichen)
  const artikelPflicht = (kurzzeichen) => {
    const z = artikelNach(kurzzeichen)
    if (!z) throw new Error(`Artikel ${kurzzeichen} nicht in „${SHEETS.artikel}" gefunden.`)
    return z
  }
  const achsenVon = (art) => ART_ACHSE_SPALTEN.map((k) => String(art[k] ?? '').trim())
  const zeilenVon = (nummer) => preiseTab.rows.filter((r) => r['Artikel'] === nummer)
  const wert = (zeile, i) => String(zeile[PREIS_ACHSE_SPALTEN[i]] ?? '').trim()
  const preisVon = (zeile) => Number(String(zeile['Preis']).replace(',', '.'))

  const zellen = [] // { blatt, ref, text?, zahl? }
  const neueZeilen = [] // { nummer, vorlage, achsen: string[5], preis, seite }
  const neueArtikel = [] // { werte: Record<Spaltenname, string|number> }
  const berichte = []
  const setzeText = (blatt, ref, text) => zellen.push({ blatt, ref, text })
  const setzeZahl = (blatt, ref, zahl) => zellen.push({ blatt, ref, zahl })
  function stelleAchsenUm(art, achsen) {
    achsen.forEach((a, i) => setzeText('artikel', `${aSp(ART_ACHSE_SPALTEN[i])}${art._row}`, a))
    setzeText('artikel', `${aSp('Achsen')}${art._row}`, achsen.filter(Boolean).join(' × '))
  }

  // --- 1) LED-Syncro 100er --------------------------------------------------------------
  {
    const art = artikelPflicht(LED_SYNCRO.kurzzeichen)
    const zeile = zeilenVon(art['Artikelnummer']).find((z) => wert(z, 0) === LED_SYNCRO.stufe)
    if (!zeile) throw new Error(`${LED_SYNCRO.kurzzeichen}: Zeile ${LED_SYNCRO.stufe} fehlt.`)
    if (preisVon(zeile) === LED_SYNCRO.neu) {
      berichte.push(`${c.dim('=')} ${LED_SYNCRO.kurzzeichen} 100er steht bereits auf ${LED_SYNCRO.neu} € — übersprungen`)
    } else {
      setzeZahl('preise', `${pSp('Preis')}${zeile._row}`, LED_SYNCRO.neu)
      berichte.push(`${c.green('~')} ${LED_SYNCRO.kurzzeichen} LED-Syncro 100er: ${preisVon(zeile)} → ${LED_SYNCRO.neu} € (Tippfehler der Preisliste)`)
    }
  }

  // --- 2) Basis-Container: Höhen 3 R / 7,5 R und Preisgruppen ----------------------------
  for (const [kurz, istRauchglas] of [
    [BASIS_CONTAINER.decoboard, false],
    [BASIS_CONTAINER.rauchglas, true],
  ]) {
    const art = artikelPflicht(kurz)
    const nummer = art['Artikelnummer']
    const achsen = achsenVon(art)
    const bestand = zeilenVon(nummer)
    const sollPg1 = (hoeheKey, breitenIndex) =>
      BASIS_CONTAINER.decoboardPg1[hoeheKey][breitenIndex] + (istRauchglas ? BASIS_CONTAINER.rauchglasAufpreis[breitenIndex] : 0)

    if (!achsen.includes('PG')) {
      if (achsen[0] !== 'BREITE' || achsen[1] !== 'HOEHE' || achsen.slice(2).some(Boolean)) {
        throw new Error(`${kurz}: erwartet Achsen BREITE × HOEHE, gefunden ${achsen.join(', ')}.`)
      }
      // Bestandszeilen gegen die Vorgabe prüfen — sonst stimmt die Ableitung nicht.
      for (const z of bestand) {
        const bi = BASIS_CONTAINER.breiten.indexOf(wert(z, 0))
        const hk = Object.keys(BASIS_CONTAINER.hoehen).find((k) => BASIS_CONTAINER.hoehen[k] === wert(z, 1))
        if (bi < 0 || !hk) throw new Error(`${kurz}: unerwartete Bestandszeile ${wert(z, 0)} / ${wert(z, 1)}.`)
        if (preisVon(z) !== sollPg1(hk, bi)) {
          throw new Error(`${kurz}: Bestandszeile ${wert(z, 0)} / ${hk} = ${preisVon(z)} €, erwartet ${sollPg1(hk, bi)} €.`)
        }
        setzeText('preise', `${pSp('A3')}${z._row}`, 'PG1')
      }
      stelleAchsenUm(art, ['BREITE', 'HOEHE', 'PG', '', ''])
      berichte.push(`${c.green('+')} ${kurz}: Achse PG ergänzt (Bestandszeilen = PG1)`)
    }
    const vorhanden = new Set(bestand.map((z) => `${wert(z, 0)}|${wert(z, 1)}|${wert(z, 2) || 'PG1'}`))
    let n = 0
    for (const [hk, etikett] of Object.entries(BASIS_CONTAINER.hoehen)) {
      BASIS_CONTAINER.breiten.forEach((breite, bi) => {
        for (const pg of PG_STUFEN) {
          if (vorhanden.has(`${breite}|${etikett}|${pg}`)) continue
          neueZeilen.push({
            nummer,
            vorlage: bestand[0],
            achsen: [breite, etikett, pg, '', ''],
            preis: runde2(sollPg1(hk, bi) * PG_FAKTOREN[pg]),
            seite: 26,
          })
          n++
        }
      })
    }
    const soll = Object.keys(BASIS_CONTAINER.hoehen).length * BASIS_CONTAINER.breiten.length * PG_STUFEN.length
    if (n > 0) {
      setzeZahl('artikel', `${aSp('Preiszellen')}${art._row}`, soll)
      setzeText('artikel', `${aSp('Bemerkung')}${art._row}`, BASIS_CONTAINER.bemerkung)
      berichte.push(`${c.green('+')} ${kurz}: ${n} neue Zeilen (3 R / 7,5 R, PG 2–4) → ${soll} Zeilen`)
    } else {
      berichte.push(`${c.dim('=')} ${kurz}: alle ${soll} Zeilen vorhanden — übersprungen`)
    }
  }

  // --- 3) Conero G/H: PG 2–4 -------------------------------------------------------------
  {
    let n = 0
    for (const kurz of CONERO_GH) {
      const art = artikelPflicht(kurz)
      const achsen = achsenVon(art)
      if (achsen[0] !== 'BREITE' || achsen[1] !== 'PG') throw new Error(`${kurz}: erwartet BREITE × PG, gefunden ${achsen.join(', ')}.`)
      const bestand = zeilenVon(art['Artikelnummer'])
      const pg1 = bestand.filter((z) => wert(z, 1) === 'PG1')
      if (pg1.length === 0) throw new Error(`${kurz}: keine PG1-Zeile.`)
      const vorhanden = new Set(bestand.map((z) => `${wert(z, 0)}|${wert(z, 1)}`))
      for (const z of pg1) {
        for (const pg of PG_STUFEN.slice(1)) {
          if (vorhanden.has(`${wert(z, 0)}|${pg}`)) continue
          neueZeilen.push({ nummer: art['Artikelnummer'], vorlage: z, achsen: [wert(z, 0), pg, '', '', ''], preis: runde2(preisVon(z) * PG_FAKTOREN[pg]), seite: 30 })
          n++
        }
      }
      if (n > 0) setzeZahl('artikel', `${aSp('Preiszellen')}${art._row}`, pg1.length * PG_STUFEN.length)
    }
    berichte.push(n > 0 ? `${c.green('+')} Conero G/H: ${n} Zeilen PG 2–4` : `${c.dim('=')} Conero G/H: PG 2–4 vorhanden — übersprungen`)
  }

  // --- 4) Conero H: zwei weitere Ausführungen --------------------------------------------
  for (const def of CONERO_H_NEU) {
    if (artikelNach(def.kurzzeichen)) {
      berichte.push(`${c.dim('=')} ${def.kurzzeichen} vorhanden — übersprungen`)
      continue
    }
    const vorlage = artikelPflicht(def.vorlage)
    const werte = {}
    for (const name of artikelTab.header.keys()) werte[name] = vorlage[name] ?? ''
    Object.assign(werte, {
      Artikelnummer: def.nummer,
      Kurzzeichen: def.kurzzeichen,
      Bezeichnung: def.bezeichnung,
      Sortierung: def.sortierung,
      Preiszellen: PG_STUFEN.length,
      Bemerkung: CONERO_H_BEMERKUNG,
      Quelle: 'Überarbeitung 9, S. 5 (Preis wie H 12 Hosenhalter, S. 30)',
    })
    neueArtikel.push({ werte })
    const pg1 = zeilenVon(vorlage['Artikelnummer']).find((z) => wert(z, 1) === 'PG1')
    for (const pg of PG_STUFEN) {
      neueZeilen.push({ nummer: def.nummer, vorlage: pg1, achsen: [wert(pg1, 0), pg, '', '', ''], preis: runde2(preisVon(pg1) * PG_FAKTOREN[pg]), seite: 30 })
    }
    berichte.push(`${c.green('+')} ${def.kurzzeichen} ${def.bezeichnung} (${preisVon(pg1)} €, PG 1–4)`)
  }

  // --- 5) Rollkorb: Preisgruppen ---------------------------------------------------------
  {
    const art = artikelPflicht(ROLLKORB.kurzzeichen)
    const achsen = achsenVon(art)
    if (achsen.includes('PG')) {
      berichte.push(`${c.dim('=')} ${ROLLKORB.kurzzeichen} trägt bereits PG — übersprungen`)
    } else {
      if (achsen[0] !== 'BREITE' || achsen.slice(1).some(Boolean)) throw new Error(`${ROLLKORB.kurzzeichen}: erwartet nur BREITE.`)
      const bestand = zeilenVon(art['Artikelnummer'])
      for (const z of bestand) {
        setzeText('preise', `${pSp('A2')}${z._row}`, 'PG1')
        for (const pg of PG_STUFEN.slice(1)) {
          neueZeilen.push({ nummer: art['Artikelnummer'], vorlage: z, achsen: [wert(z, 0), pg, '', '', ''], preis: runde2(preisVon(z) * PG_FAKTOREN[pg]), seite: 26 })
        }
      }
      stelleAchsenUm(art, ['BREITE', 'PG', '', '', ''])
      setzeZahl('artikel', `${aSp('Preiszellen')}${art._row}`, bestand.length * PG_STUFEN.length)
      setzeText('artikel', `${aSp('Oberfläche')}${art._row}`, 'J')
      setzeText('artikel', `${aSp('Bemerkung')}${art._row}`, ROLLKORB.bemerkung)
      berichte.push(`${c.green('+')} ${ROLLKORB.kurzzeichen} Rollkorb: BREITE × PG, ${bestand.length * 3} neue Zeilen`)
    }
  }

  // --- 6) Raumteiler / Sichtrückwand auf „entwurf" ---------------------------------------
  for (const def of AUF_ENTWURF) {
    const art = artikelPflicht(def.kurzzeichen)
    if (art['Status'] === 'entwurf') {
      berichte.push(`${c.dim('=')} ${def.kurzzeichen} bereits „entwurf" — übersprungen`)
      continue
    }
    setzeText('artikel', `${aSp('Status')}${art._row}`, 'entwurf')
    if (!String(art['Bemerkung'] ?? '').includes('Überarbeitung 9')) {
      setzeText('artikel', `${aSp('Bemerkung')}${art._row}`, `${art['Bemerkung'] ?? ''}${def.bemerkungZusatz}`)
    }
    berichte.push(`${c.green('~')} ${def.kurzzeichen} ${art['Bezeichnung']}: Status ${art['Status']} → entwurf`)
  }

  // --- 7) Schubladenunterteilung: Hinweis ------------------------------------------------
  {
    const art = artikelPflicht(SCHUBLADENUNTERTEILUNG.kurzzeichen)
    if (String(art['Bemerkung'] ?? '') === SCHUBLADENUNTERTEILUNG.bemerkung) {
      berichte.push(`${c.dim('=')} ${SCHUBLADENUNTERTEILUNG.kurzzeichen} Bemerkung gesetzt — übersprungen`)
    } else {
      setzeText('artikel', `${aSp('Bemerkung')}${art._row}`, SCHUBLADENUNTERTEILUNG.bemerkung)
      berichte.push(`${c.green('~')} ${SCHUBLADENUNTERTEILUNG.kurzzeichen} Bemerkung „immer PG 1"`)
    }
  }

  // --- 8) Breitenstufe „50/60er" auf 60 cm -----------------------------------------------
  {
    const betroffen = preiseTab.rows.filter((z) => PREIS_ACHSE_SPALTEN.some((_, i) => wert(z, i) === BREITENSTUFE_50_60.alt))
    for (const z of betroffen) {
      PREIS_ACHSE_SPALTEN.forEach((sp, i) => {
        if (wert(z, i) === BREITENSTUFE_50_60.alt) setzeText('preise', `${pSp(sp)}${z._row}`, BREITENSTUFE_50_60.neu)
      })
    }
    berichte.push(
      betroffen.length
        ? `${c.green('~')} Breitenstufe „${BREITENSTUFE_50_60.alt}" → „${BREITENSTUFE_50_60.neu}" in ${betroffen.length} Preiszeilen (Craft: 60er Korpus bekam den 80er-Preis)`
        : `${c.dim('=')} Breitenstufe 50/60er steht bereits auf 60 cm — übersprungen`,
    )
  }

  // --- Ausgabe -------------------------------------------------------------------------
  console.log(c.bold('\n  Plan'))
  for (const b of berichte) console.log(`    ${b}`)
  if (zellen.length === 0 && neueZeilen.length === 0 && neueArtikel.length === 0) {
    console.log(c.green('\n  Nichts zu tun — die Mappe ist bereits auf dem aktuellen Stand.\n'))
    return
  }
  if (dryRun) {
    console.log(c.yellow(`\n  --dry-run: nichts geschrieben. (${zellen.length} Zellen, ${neueZeilen.length} neue Preiszeilen, ${neueArtikel.length} neue Artikel)\n`))
    return
  }

  // --- Schreiben -----------------------------------------------------------------------
  const artikelBlatt = editSheet(wb, SHEETS.artikel)
  const preiseBlatt = editSheet(wb, SHEETS.preise)
  const blattFuer = { artikel: artikelBlatt, preise: preiseBlatt }
  for (const z of zellen) {
    const blatt = blattFuer[z.blatt]
    if (z.zahl != null) {
      if (!setCellNumber(blatt, z.ref, z.zahl)) throw new Error(`Zelle ${z.ref} existiert nicht.`)
    } else if (z.text === '') {
      setCellString(blatt, z.ref, '')
    } else if (!setOrCreateCellString(blatt, z.ref, z.text)) {
      throw new Error(`Zelle ${z.ref} konnte nicht gesetzt werden.`)
    }
  }
  for (const a of neueArtikel) {
    const werte = {}
    for (const [name, w] of Object.entries(a.werte)) {
      if (w === '' || w == null) continue
      werte[aSp(name)] = ZAHL_SPALTEN.has(name) ? Number(w) : w
    }
    appendRow(artikelBlatt, werte)
  }
  for (const z of neueZeilen) {
    const werte = {}
    werte[pSp('Artikel')] = z.nummer
    for (const name of SPIEGEL_SPALTEN) {
      const spalte = preiseTab.header.get(name)
      if (!spalte) continue
      const q = preiseSheet.get(z.vorlage._row)?.[spalte]
      if (q?.f) werte[spalte] = { f: q.f.replaceAll(String(z.vorlage._row), ZEILEN_PLATZHALTER), v: q.v }
      else if (q?.v) werte[spalte] = q.v
    }
    z.achsen.forEach((a, i) => {
      if (a) werte[pSp(PREIS_ACHSE_SPALTEN[i])] = a
    })
    werte[pSp('Preis')] = z.preis
    werte[pSp('Status')] = 'fixed'
    werte[pSp('Seite')] = z.seite
    const zeilenNr = appendRow(preiseBlatt, werte)
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
  console.log(
    c.green(`  Geschrieben: ${zellen.length} Zellen, ${neueZeilen.length} neue Preiszeilen, ${neueArtikel.length} neue Artikel. Jetzt \`npm run data:build\` ausführen.\n`),
  )
}

main()
