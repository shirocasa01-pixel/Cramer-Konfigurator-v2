#!/usr/bin/env node
/**
 * MIGRATION — Überarbeitung 8 + 9 in die Stammdaten-Mappe.
 *
 *   MIT-001  Mittelseite     HÖHE          →  HÖHE × TIEFE × PG        (2 → 24 Zeilen)
 *   BOD-001  Einlegeboden    BREITE        →  BREITE × TIEFE × PG      (3 → 36 Zeilen)
 *   KST-002  Kleiderstange   Boden + Stange → Aufpreis 15 € zum Boden  (3 Zeilen, neu bepreist)
 *   DRT-001  Drehtür         + 21 Raster (18 R × 1,20)                 (120 → 140 Zeilen)
 *   50 Meta  beleuchtungTiefenzugabeMm = 10
 *
 * Was woher kommt, steht in `scripts/lib/ueberarbeitung-8-9.js`.
 *
 * IDEMPOTENT: Jeder Teil prüft vor dem Schreiben, ob die Mappe ihn schon trägt
 * (Achse vorhanden, 21-Raster-Stufe vorhanden, Marker in der Bemerkung, Meta-Schlüssel
 * vorhanden). Ein zweiter Lauf meldet „nichts zu tun".
 *
 *   node scripts/migrate-ueberarbeitung-8-9.js [--dry-run] [--no-backup]
 *   npm run data:migrate-ue89
 */

import { readFileSync, existsSync, copyFileSync } from 'node:fs'

import { STAMMDATEN_XLSX, SHEETS } from './lib/paths.js'
import {
  ATRIUM_BOEDEN,
  BESTANDS_TIEFE,
  DREHTUER,
  EINLEGEBODEN,
  KLEIDERSTANGE,
  META_SCHLUESSEL,
  MITTELSEITE,
  PG_STUFEN,
  QUELLSEITE,
  TIEFEN,
  UEBERHOEHE_FAKTOR,
  runde2,
} from './lib/ueberarbeitung-8-9.js'
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

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const noBackup = process.argv.includes('--no-backup')
  if (!existsSync(STAMMDATEN_XLSX)) throw new Error(`Stammdatendatei nicht gefunden: ${STAMMDATEN_XLSX}`)

  console.log(c.bold('\nÜberarbeitung 8 + 9 — Stammdaten'))
  console.log(c.dim(`  ${STAMMDATEN_XLSX}`))

  const wb = openWorkbook(readFileSync(STAMMDATEN_XLSX))
  const artikelTab = readTable(wb, SHEETS.artikel)
  const preiseTab = readTable(wb, SHEETS.preise)
  const metaTab = readTable(wb, SHEETS.meta)
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

  const artikelNach = (kurzzeichen) => {
    const z = artikelTab.rows.find((r) => String(r['Kurzzeichen'] ?? '').trim() === kurzzeichen)
    if (!z) throw new Error(`Artikel ${kurzzeichen} nicht in „${SHEETS.artikel}" gefunden.`)
    return z
  }
  const achsenVon = (artZeile) => ART_ACHSE_SPALTEN.map((k) => String(artZeile[k] ?? '').trim())
  const zeilenVon = (artZeile) => preiseTab.rows.filter((r) => r['Artikel'] === artZeile['Artikelnummer'])
  const wert = (zeile, index) => String(zeile[PREIS_ACHSE_SPALTEN[index]] ?? '').trim()

  // Geplante Schreibvorgänge — erst sammeln, dann (ohne --dry-run) ausführen.
  const zellen = [] // { blatt: 'artikel'|'preise', ref, text?, zahl? }
  const neueZeilen = [] // { artZeile, vorlage, achsen: string[5], preis, seite }
  const berichte = []

  const setzeText = (blatt, ref, text) => zellen.push({ blatt, ref, text })
  const setzeZahl = (blatt, ref, zahl) => zellen.push({ blatt, ref, zahl })

  /** Achsen eines Artikels umstellen (Spalten „Achse n" und der Klartext „Achsen"). */
  function stelleAchsenUm(artZeile, achsen) {
    achsen.forEach((a, i) => setzeText('artikel', `${aSp(ART_ACHSE_SPALTEN[i])}${artZeile._row}`, a))
    setzeText('artikel', `${aSp('Achsen')}${artZeile._row}`, achsen.filter(Boolean).join(' × '))
  }

  // --- 1) Mittelseite ------------------------------------------------------------------
  {
    const art = artikelNach(MITTELSEITE.kurzzeichen)
    const achsen = achsenVon(art)
    if (achsen.includes('TIEFE')) {
      berichte.push(`${c.dim('=')} ${MITTELSEITE.kurzzeichen} trägt bereits TIEFE — übersprungen`)
    } else {
      if (achsen[0] !== 'HOEHE' || achsen.slice(1).some(Boolean)) {
        throw new Error(`${MITTELSEITE.kurzzeichen}: erwartet genau die Achse HOEHE, gefunden ${achsen.join(', ')}.`)
      }
      const bestand = zeilenVon(art)
      if (bestand.length !== 2) throw new Error(`${MITTELSEITE.kurzzeichen}: erwartet 2 Bestandszeilen (18 R / 21 R), gefunden ${bestand.length}.`)
      // PG 1: der gedruckte Refugium-Preis je Rasterstufe.
      const pg1 = new Map(bestand.map((z) => [wert(z, 0), Number(String(z['Preis']).replace(',', '.'))]))
      const stufe18 = [...pg1.keys()].find((k) => /\|\s*18R$/.test(k))
      const stufe21 = [...pg1.keys()].find((k) => /\|\s*21R$/.test(k))
      if (!stufe18 || !stufe21) throw new Error(`${MITTELSEITE.kurzzeichen}: Höhenstufen 18R/21R nicht gefunden.`)

      stelleAchsenUm(art, ['HOEHE', 'TIEFE', 'PG', '', ''])
      setzeZahl('artikel', `${aSp('Preiszellen')}${art._row}`, 2 * TIEFEN.length * PG_STUFEN.length)
      setzeText('artikel', `${aSp('Oberfläche')}${art._row}`, 'J')
      setzeText('artikel', `${aSp('Quelle')}${art._row}`, MITTELSEITE.quelle)
      setzeText('artikel', `${aSp('Bemerkung')}${art._row}`, MITTELSEITE.bemerkung)
      for (const z of bestand) {
        setzeText('preise', `${pSp('A2')}${z._row}`, `${BESTANDS_TIEFE} cm`)
        setzeText('preise', `${pSp('A3')}${z._row}`, 'PG1')
      }
      let n = 0
      for (const stufe of [stufe18, stufe21]) {
        const ist21 = stufe === stufe21
        for (const tiefe of TIEFEN) {
          for (const pg of PG_STUFEN) {
            if (pg === 'PG1' && tiefe === BESTANDS_TIEFE) continue // Bestandszeile
            let preis
            let seite
            if (pg === 'PG1') {
              preis = pg1.get(stufe)
              seite = 26
            } else {
              const basis = MITTELSEITE.seite18R(tiefe, pg)
              if (basis == null) throw new Error(`Atrium-Seite ${tiefe} cm / ${pg} fehlt in scripts/lib/refugium-korpus.js.`)
              preis = ist21 ? runde2(basis * UEBERHOEHE_FAKTOR) : basis
              seite = QUELLSEITE[tiefe]
            }
            neueZeilen.push({ artZeile: art, vorlage: bestand[0], achsen: [stufe, `${tiefe} cm`, pg, '', ''], preis, seite })
            n++
          }
        }
      }
      const probe = MITTELSEITE.seite18R('60', 'PG2')
      berichte.push(`${c.green('+')} ${MITTELSEITE.kurzzeichen} Mittelseite: HÖHE × TIEFE × PG, ${n} neue Zeilen (Probe 18 R · 60 cm · PG2 = ${probe} €)`)
    }
  }

  // --- 2) Einlegeboden -----------------------------------------------------------------
  {
    const art = artikelNach(EINLEGEBODEN.kurzzeichen)
    const achsen = achsenVon(art)
    if (achsen.includes('TIEFE')) {
      berichte.push(`${c.dim('=')} ${EINLEGEBODEN.kurzzeichen} trägt bereits TIEFE — übersprungen`)
    } else {
      if (achsen[0] !== 'BREITE' || achsen.slice(1).some(Boolean)) {
        throw new Error(`${EINLEGEBODEN.kurzzeichen}: erwartet genau die Achse BREITE, gefunden ${achsen.join(', ')}.`)
      }
      const bestand = zeilenVon(art)
      if (bestand.length !== EINLEGEBODEN.breiten.length) {
        throw new Error(`${EINLEGEBODEN.kurzzeichen}: erwartet ${EINLEGEBODEN.breiten.length} Bestandszeilen, gefunden ${bestand.length}.`)
      }
      // Breitenwert der Zelle („50 cm | 50er") je Nennbreite und der gedruckte PG-1-Preis.
      const jeBreite = new Map()
      for (const z of bestand) {
        const zelle = wert(z, 0)
        const nenn = EINLEGEBODEN.breiten.find((b) => zelle.endsWith(`| ${b}`) || zelle === b)
        if (!nenn) throw new Error(`${EINLEGEBODEN.kurzzeichen}: unbekannter Breitenwert „${zelle}".`)
        jeBreite.set(nenn, { zelle, preis: Number(String(z['Preis']).replace(',', '.')) })
      }

      stelleAchsenUm(art, ['BREITE', 'TIEFE', 'PG', '', ''])
      setzeZahl('artikel', `${aSp('Preiszellen')}${art._row}`, EINLEGEBODEN.breiten.length * TIEFEN.length * PG_STUFEN.length)
      setzeText('artikel', `${aSp('Oberfläche')}${art._row}`, 'J')
      setzeText('artikel', `${aSp('Quelle')}${art._row}`, EINLEGEBODEN.quelle)
      setzeText('artikel', `${aSp('Bemerkung')}${art._row}`, EINLEGEBODEN.bemerkung)
      for (const z of bestand) {
        setzeText('preise', `${pSp('A2')}${z._row}`, `${BESTANDS_TIEFE} cm`)
        setzeText('preise', `${pSp('A3')}${z._row}`, 'PG1')
      }
      let n = 0
      for (const breite of EINLEGEBODEN.breiten) {
        const { zelle, preis: pg1Preis } = jeBreite.get(breite)
        for (const tiefe of TIEFEN) {
          for (const pg of PG_STUFEN) {
            if (pg === 'PG1' && tiefe === BESTANDS_TIEFE) continue
            const preis = pg === 'PG1' ? pg1Preis : ATRIUM_BOEDEN[tiefe][breite][pg]
            const seite = pg === 'PG1' ? 26 : QUELLSEITE[tiefe]
            neueZeilen.push({ artZeile: art, vorlage: bestand[0], achsen: [zelle, `${tiefe} cm`, pg, '', ''], preis, seite })
            n++
          }
        }
      }
      berichte.push(`${c.green('+')} ${EINLEGEBODEN.kurzzeichen} Einlegeboden: BREITE × TIEFE × PG, ${n} neue Zeilen (Probe 60er · 60 cm · PG2 = ${ATRIUM_BOEDEN[60]['60er'].PG2} €)`)
    }
  }

  // --- 3) Kleiderstange ----------------------------------------------------------------
  {
    const art = artikelNach(KLEIDERSTANGE.kurzzeichen)
    if (String(art['Bezeichnung'] ?? '').includes(KLEIDERSTANGE.marker)) {
      berichte.push(`${c.dim('=')} ${KLEIDERSTANGE.kurzzeichen} ist bereits der Aufpreis zum Boden — übersprungen`)
    } else {
      const bestand = zeilenVon(art)
      // Gegenprobe der Zerlegung: gedruckter Preis − Bodenpreis = 15 € für jede Breite.
      const boden = zeilenVon(artikelNach(EINLEGEBODEN.kurzzeichen))
      for (const z of bestand) {
        const zelle = wert(z, 0)
        const nenn = Object.keys(KLEIDERSTANGE.bisher).find((b) => zelle.endsWith(`| ${b}`) || zelle === b)
        const bodenZeile = boden.find((b) => wert(b, 0) === zelle && (wert(b, 2) === '' || wert(b, 2) === 'PG1') && (wert(b, 1) === '' || wert(b, 1) === `${BESTANDS_TIEFE} cm`))
        const gedruckt = Number(String(z['Preis']).replace(',', '.'))
        const bodenPreis = bodenZeile ? Number(String(bodenZeile['Preis']).replace(',', '.')) : NaN
        if (!nenn || gedruckt - bodenPreis !== KLEIDERSTANGE.preis) {
          throw new Error(`${KLEIDERSTANGE.kurzzeichen}: Zerlegung passt nicht für „${zelle}" (${gedruckt} € − ${bodenPreis} € ≠ ${KLEIDERSTANGE.preis} €).`)
        }
        setzeZahl('preise', `${pSp('Preis')}${z._row}`, KLEIDERSTANGE.preis)
      }
      setzeText('artikel', `${aSp('Bezeichnung')}${art._row}`, KLEIDERSTANGE.bezeichnung)
      setzeText('artikel', `${aSp('Bemerkung')}${art._row}`, KLEIDERSTANGE.bemerkung)
      berichte.push(`${c.green('~')} ${KLEIDERSTANGE.kurzzeichen} Kleiderstange: ${bestand.length} Zeilen → ${KLEIDERSTANGE.preis} € (Gegenprobe 55/60/70 € = Boden + 15 € bestanden)`)
    }
  }

  // --- 4) Drehtür 21 Raster ------------------------------------------------------------
  {
    const art = artikelNach(DREHTUER.kurzzeichen)
    const achsen = achsenVon(art)
    const hoeheIndex = achsen.indexOf('HOEHE')
    if (hoeheIndex < 0) throw new Error(`${DREHTUER.kurzzeichen} führt keine HOEHE-Achse.`)
    const bestand = zeilenVon(art)
    if (bestand.some((z) => /\|\s*21R$/.test(wert(z, hoeheIndex)))) {
      berichte.push(`${c.dim('=')} ${DREHTUER.kurzzeichen} führt bereits 21 Raster — übersprungen`)
    } else {
      const quelle = bestand.filter((z) => new RegExp(`\\|\\s*${DREHTUER.quellRaster}$`).test(wert(z, hoeheIndex)))
      if (quelle.length === 0) throw new Error(`${DREHTUER.kurzzeichen}: keine 18-Raster-Zeilen gefunden.`)
      for (const z of quelle) {
        const achsWerte = PREIS_ACHSE_SPALTEN.map((_, i) => wert(z, i))
        achsWerte[hoeheIndex] = DREHTUER.zielStufe
        const preis = runde2(Number(String(z['Preis']).replace(',', '.')) * UEBERHOEHE_FAKTOR)
        neueZeilen.push({ artZeile: art, vorlage: z, achsen: achsWerte, preis, seite: Number(z['Seite']) || 7 })
      }
      setzeZahl('artikel', `${aSp('Preiszellen')}${art._row}`, bestand.length + quelle.length)
      setzeText('artikel', `${aSp('Bemerkung')}${art._row}`, DREHTUER.bemerkung)
      const probe = quelle.find((z) => wert(z, 0).endsWith('50er') && /Glatt1/.test(PREIS_ACHSE_SPALTEN.map((_, i) => wert(z, i)).join('|')))
      berichte.push(
        `${c.green('+')} ${DREHTUER.kurzzeichen} Drehtür: ${quelle.length} Zeilen „${DREHTUER.zielStufe}"` +
          (probe ? ` (Probe 50er · Glatt1: ${probe['Preis']} € × 1,2 = ${runde2(Number(probe['Preis']) * UEBERHOEHE_FAKTOR)} €)` : ''),
      )
    }
  }

  // --- 5) Meta -------------------------------------------------------------------------
  const vorhandeneMeta = new Set(metaTab.rows.map((r) => String(r['Schlüssel'] ?? '').trim()))
  const neueMeta = META_SCHLUESSEL.filter((z) => !vorhandeneMeta.has(z.schluessel))
  for (const z of neueMeta) berichte.push(`${c.green('+')} 50 Meta ${z.schluessel} = ${z.wert}`)
  if (neueMeta.length === 0) berichte.push(`${c.dim('=')} 50 Meta: Schlüssel vorhanden — übersprungen`)

  // --- Ausgabe -------------------------------------------------------------------------
  console.log(c.bold('\n  Plan'))
  for (const b of berichte) console.log(`    ${b}`)

  if (zellen.length === 0 && neueZeilen.length === 0 && neueMeta.length === 0) {
    console.log(c.green('\n  Nichts zu tun — die Mappe ist bereits auf dem aktuellen Stand.\n'))
    return
  }
  if (dryRun) {
    console.log(c.yellow(`\n  --dry-run: nichts geschrieben. (${zellen.length} Zellen, ${neueZeilen.length} neue Preiszeilen)\n`))
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
      // Leere Achse: vorhandene Zelle leeren, fehlende nicht anlegen.
      setCellString(blatt, z.ref, '')
    } else if (!setOrCreateCellString(blatt, z.ref, z.text)) {
      throw new Error(`Zelle ${z.ref} konnte nicht gesetzt werden.`)
    }
  }

  for (const z of neueZeilen) {
    const werte = {}
    werte[pSp('Artikel')] = z.artZeile['Artikelnummer']
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

  let metaBlatt = null
  if (neueMeta.length > 0) {
    const mSp = (name) => {
      const s = metaTab.header.get(name)
      if (!s) throw new Error(`„${SHEETS.meta}" führt keine Spalte „${name}".`)
      return s
    }
    metaBlatt = editSheet(wb, SHEETS.meta)
    for (const z of neueMeta) {
      appendRow(metaBlatt, { [mSp('Schlüssel')]: z.schluessel, [mSp('Wert')]: z.wert, [mSp('Bedeutung')]: z.bedeutung })
    }
  }

  if (!noBackup) {
    const backup = STAMMDATEN_XLSX.replace(/\.xlsx$/, `.backup-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`)
    copyFileSync(STAMMDATEN_XLSX, backup)
    console.log(c.dim(`\n  Sicherung: ${backup}`))
  }
  artikelBlatt.commit()
  preiseBlatt.commit()
  metaBlatt?.commit()
  forceFullCalcOnLoad(wb)
  writeFileWithRetry(STAMMDATEN_XLSX, saveWorkbook(wb))
  console.log(c.green(`  Geschrieben: ${zellen.length} Zellen, ${neueZeilen.length} neue Preiszeilen. Jetzt \`npm run data:build\` ausführen.\n`))
}

main()
