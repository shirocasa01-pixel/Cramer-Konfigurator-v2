#!/usr/bin/env node
/**
 * MIGRATION — Preisarten, Aufschläge, Montage und Lieferung in die Stammdaten-Mappe.
 *
 *   34 Preislogiken   sechs Preisarten mit Anzeigename und Kurztext (vorher drei Codes)
 *   10 Artikel        MATRIX wird zu der Preisart, die die Engine bisher schon rechnete
 *                     (Stufenpreis · Maßgenau · Festpreis + Matrix — `leitePreisartAb`)
 *                     + Spalten „Aufschlag", „Aufschlag-Einheit", „Aufschlag-Basis",
 *                       „Preislisten-Nr."
 *                     Raumteiler (ZUS-001) und Sichtrückwand (ZUS-004) → Preisart Aufschlag
 *                     + Montage (SRV-001, Preisliste Art. 21033) und Lieferung regional
 *                       (SRV-002, Art. 21032) als Aufschlag auf den Gesamtmöbelpreis
 *   32 Artikelgruppen + Dropdown SERVICE („Serviceleistung", Teileart KALKULATION → 039)
 *   20 Preise         Wandpaneele PG 2–4: €/m²-Preis laut Preisliste (210 / 270 / 330 statt 150)
 *   50 Meta           die vier Zuschlagssätze entfallen dort — maßgeblich ist jetzt der
 *                     jeweilige Artikel in der Artikelverwaltung. Die Zeilen bleiben mit
 *                     einem Verweis stehen, damit niemand den Satz dort weiter sucht.
 *
 * Die Sätze werden aus „50 Meta" übernommen (dort standen sie bisher), nicht neu gesetzt:
 * Hat Herr Dietmann einen Satz dort schon geändert, wandert genau dieser Wert mit.
 *
 * IDEMPOTENT: Jeder Teil prüft, ob die Mappe ihn schon trägt. Ein zweiter Lauf meldet
 * „nichts zu tun".
 *
 *   node scripts/migrate-preisarten.js [--dry-run] [--no-backup]
 *   npm run data:migrate-preisarten
 */

import { readFileSync, existsSync, copyFileSync } from 'node:fs'

import { STAMMDATEN_XLSX, SHEETS } from './lib/paths.js'
import {
  openWorkbook,
  readTable,
  editSheet,
  appendRow,
  setCellNumber,
  setOrCreateCellString,
  saveWorkbook,
  writeFileWithRetry,
  colIndex,
  indexToCol,
} from './lib/xlsx-raw.js'
import { schreibeWerteliste } from './lib/werteliste.js'
import { PREISART_CODES, PREISART_KATALOG, istPreisartCode, leitePreisartAb } from '../src/lib/preisarten.ts'

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
}

/** Neue Spalten in „10 Artikel", rechts an die bestehenden angehängt. */
const NEUE_SPALTEN = ['Aufschlag', 'Aufschlag-Einheit', 'Aufschlag-Basis', 'Preislisten-Nr.']

/** Frühere Codes, die bei der Migration aus den Preiszeilen abgeleitet werden. */
const ABZULEITEN = new Set(['MATRIX', 'MATRIX_AUF', 'PRO_LFM', 'PRO_QM', 'GRUND_PLUS_QM'])

const SERVICE_GRUPPE = {
  'Nr (Stelle 3)': '15',
  Code: 'SERVICE',
  Produktgruppe: 'KALKULATION',
  Teileart: 'KALKULATION',
  'Bezeichnung (Dropdown-Titel)': 'Serviceleistung',
  Nummernkreis: '70-90-15-',
  Artikel: '2',
}

/**
 * Artikelbezogene Aufschläge: Kurzzeichen → Meta-Schlüssel des bisherigen Satzes.
 * Beide rechnen auf den MÖBELPREIS und gehören damit zum Gesamtmöbelpreis.
 */
const ARTIKEL_AUFSCHLAEGE = [
  {
    kurzzeichen: 'ZUS-001',
    meta: 'raumteilerZuschlagPct',
    basis: 'MOEBELPREIS',
    bemerkung:
      'Preisart Aufschlag: % auf den Möbelpreis (Summe aller Artikelpositionen). Wird automatisch ' +
      'berechnet, sobald im Schritt „Material" „Raumteiler" angehakt ist, und gehört zum Gesamtmöbelpreis. ' +
      'Preisliste S. 33: Rückwand 10 mm einspringend.',
  },
  {
    kurzzeichen: 'ZUS-004',
    meta: 'sichtrueckwandZuschlagPct',
    basis: 'MOEBELPREIS',
    bemerkung:
      'Preisart Aufschlag: % auf den Möbelpreis (Summe aller Artikelpositionen). Wird automatisch ' +
      'berechnet, sobald im Schritt „Material" „Sicht-Rückwand" angehakt ist, und gehört zum Gesamtmöbelpreis. ' +
      'Preisliste S. 33: Rückwand 1 mm einspringend.',
  },
]

/** Nachgelagerte Zuschläge: eigene Artikel im neuen Dropdown SERVICE. */
const SERVICE_ARTIKEL = [
  {
    Artikelnummer: '70-90-15-0001',
    Kurzzeichen: 'SRV-001',
    Bezeichnung: 'Montage',
    meta: 'montageSurchargePct',
    preislistenNr: '21033',
    sortierung: '10',
    bemerkung:
      'Preisart Aufschlag auf den Gesamtmöbelpreis (Möbelpreis inkl. artikelbezogener Aufschläge). ' +
      'Nachgelagert: verändert den Möbelpreis nicht und rechnet unabhängig von der Lieferung. ' +
      'Im Abschluss per Häkchen abwählbar (Vorgabe: an). Preisliste 06.2026, Art. 21033.',
  },
  {
    Artikelnummer: '70-90-15-0002',
    Kurzzeichen: 'SRV-002',
    Bezeichnung: 'Lieferung regional',
    meta: 'lieferungRegionalPct',
    preislistenNr: '21032',
    sortierung: '20',
    bemerkung:
      'Preisart Aufschlag auf den Gesamtmöbelpreis (Möbelpreis inkl. artikelbezogener Aufschläge). ' +
      'Nachgelagert: verändert den Möbelpreis nicht und rechnet unabhängig von der Montage. ' +
      'Im Abschluss per Häkchen abwählbar (Vorgabe: an). Preisliste 06.2026, Art. 21032.',
  },
]

/** Alle Serien — Montage und Lieferung gelten für jedes Möbel. */
const ALLE_SERIEN = 'AVPROCSTU'

/**
 * PREISZEILEN, DIE VON DER PREISLISTE ABWEICHEN — gefunden beim Abgleich aller
 * „Festpreis + Matrix"-Artikel mit der Extraktion (`src/data/priceList.json`).
 *
 * Wandpaneele (S. 33): „EUR/Stk zzgl. 150 / 210 / 270 / 330 EUR/m²" für PG 1–4
 * (Extraktion Zeilen 1252–1255). Die Mappe führte für PG 2–4 ebenfalls 150 €/m².
 * Der Grundpreis 75 € stimmte. Alle übrigen 19 Kombinationspreise stimmen überein.
 */
const PREIS_KORREKTUREN = [
  { kurzzeichen: 'WND-007', achsen: ['', '', 'PG2', '€/m²', ''], preis: 210, quelle: 'Extraktion Zeile 1253' },
  { kurzzeichen: 'WND-007', achsen: ['', '', 'PG3', '€/m²', ''], preis: 270, quelle: 'Extraktion Zeile 1254' },
  { kurzzeichen: 'WND-007', achsen: ['', '', 'PG4', '€/m²', ''], preis: 330, quelle: 'Extraktion Zeile 1255' },
]

/** Meta-Zeilen, deren Satz jetzt im Artikel steht. */
const META_VERWEISE = {
  montageSurchargePct: 'entfällt — Satz steht im Artikel 90-039-0001 „Montage" (Artikelverwaltung, Preisart Aufschlag)',
  lieferungRegionalPct: 'entfällt — Satz steht im Artikel 90-039-0002 „Lieferung regional" (Artikelverwaltung, Preisart Aufschlag)',
  raumteilerZuschlagPct: 'entfällt — Satz steht im Artikel 90-037-0001 „Raumteiler" (Artikelverwaltung, Preisart Aufschlag)',
  sichtrueckwandZuschlagPct: 'entfällt — Satz steht im Artikel 90-037-0004 „Sichtrueckwand" (Artikelverwaltung, Preisart Aufschlag)',
}

/** „0.05" → 5 (Prozentpunkte), gerundet gegen Gleitkomma-Reste. */
function prozentpunkte(dezimal) {
  const n = Number(String(dezimal ?? '').replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100 * 1000) / 1000
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const noBackup = process.argv.includes('--no-backup')
  if (!existsSync(STAMMDATEN_XLSX)) throw new Error(`Stammdatendatei nicht gefunden: ${STAMMDATEN_XLSX}`)

  console.log(c.bold('\nPreisarten, Aufschläge, Montage und Lieferung'))
  console.log(c.dim(`  ${STAMMDATEN_XLSX}`))

  const wb = openWorkbook(readFileSync(STAMMDATEN_XLSX))
  const artikelTab = readTable(wb, SHEETS.artikel)
  const preiseTab = readTable(wb, SHEETS.preise)
  const metaTab = readTable(wb, SHEETS.meta)
  const gruppenTab = readTable(wb, SHEETS.artikelgruppen)
  const logikTab = readTable(wb, SHEETS.preislogiken)

  const aenderungen = []
  const plan = { logik: false, spalten: [], preislogik: [], aufschlag: [], service: [], gruppe: false, meta: [], preise: [] }

  // --- Metawerte lesen (bevor sie in 50 Meta entfallen) -------------------------------
  const metaWert = new Map(metaTab.rows.map((r) => [String(r['Schlüssel'] ?? '').trim(), r]))
  const satzAusMeta = (schluessel, vorgabe) => {
    const zeile = metaWert.get(schluessel)
    const wert = prozentpunkte(zeile?.['Wert'])
    return wert ?? vorgabe
  }

  // --- 34 Preislogiken ------------------------------------------------------------------
  const sollLogik = PREISART_CODES.map((code) => ({
    code,
    bedeutung: PREISART_KATALOG[code].kurz,
    art: PREISART_KATALOG[code].titel,
  }))
  const istLogik = logikTab.rows.map((r) => `${r['Code']}|${r['Bedeutung']}|${r['Bezeichnung'] ?? ''}`)
  const sollLogikText = sollLogik.map((e) => `${e.code}|${e.bedeutung}|${e.art}`)
  if (istLogik.join('\n') !== sollLogikText.join('\n')) {
    plan.logik = true
    aenderungen.push(`34 Preislogiken  ${logikTab.rows.map((r) => r['Code']).join(' · ')}  →  ${PREISART_CODES.join(' · ')}`)
  }

  // --- 10 Artikel: neue Spalten ---------------------------------------------------------
  const letzteSpalte = Math.max(...[...artikelTab.header.values()].map(colIndex))
  let naechste = letzteSpalte + 1
  const spalte = new Map(artikelTab.header)
  for (const name of NEUE_SPALTEN) {
    if (spalte.has(name)) continue
    const ref = indexToCol(naechste++)
    spalte.set(name, ref)
    plan.spalten.push({ name, ref })
    aenderungen.push(`10 Artikel       + Spalte ${ref} „${name}"`)
  }
  const sp = (name) => {
    const ref = spalte.get(name)
    if (!ref) throw new Error(`„${SHEETS.artikel}" führt keine Spalte „${name}".`)
    return ref
  }

  // --- 10 Artikel: Preislogik → Preisart -------------------------------------------------
  const zeilenJeArtikel = new Map()
  for (const p of preiseTab.rows) {
    const nr = String(p['Artikel'] ?? '').trim()
    const liste = zeilenJeArtikel.get(nr) ?? []
    const preis = String(p['Preis'] ?? '').trim()
    liste.push({ a: ['A1', 'A2', 'A3', 'A4', 'A5'].map((k) => String(p[k] ?? '')), preis: preis === '' ? null : Number(preis.replace(',', '.')) })
    zeilenJeArtikel.set(nr, liste)
  }
  const aufschlagKurz = new Set(ARTIKEL_AUFSCHLAEGE.map((a) => a.kurzzeichen))
  const zaehler = {}
  for (const art of artikelTab.rows) {
    const alt = String(art['Preislogik'] ?? '').trim()
    if (aufschlagKurz.has(String(art['Kurzzeichen'] ?? '').trim())) continue // eigener Teil unten
    if (istPreisartCode(alt) || !ABZULEITEN.has(alt)) continue
    const achsen = [1, 2, 3, 4, 5].map((i) => String(art[`Achse ${i}`] ?? '').trim()).filter((x) => x && !/^\d+$/.test(x))
    const neu = leitePreisartAb({ achsen }, zeilenJeArtikel.get(String(art['Artikelnummer']).trim()) ?? [])
    plan.preislogik.push({ ref: `${sp('Preislogik')}${art._row}`, neu })
    zaehler[neu] = (zaehler[neu] ?? 0) + 1
  }
  if (plan.preislogik.length) {
    aenderungen.push(
      `10 Artikel       Preislogik MATRIX → ${Object.entries(zaehler).map(([k, n]) => `${n}× ${k}`).join(' · ')}`,
    )
  }

  // --- 10 Artikel: Raumteiler und Sichtrückwand als Aufschlag ---------------------------
  for (const def of ARTIKEL_AUFSCHLAEGE) {
    const art = artikelTab.rows.find((r) => String(r['Kurzzeichen'] ?? '').trim() === def.kurzzeichen)
    if (!art) throw new Error(`Artikel ${def.kurzzeichen} nicht in „${SHEETS.artikel}" gefunden.`)
    const fertig =
      art['Preislogik'] === 'AUFSCHLAG' && art['Aufschlag-Basis'] === def.basis && String(art['Aufschlag'] ?? '') !== ''
    if (fertig) continue
    const satz = satzAusMeta(def.meta, null)
    if (satz == null) throw new Error(`„50 Meta": ${def.meta} fehlt — der bisherige Satz ist unbekannt.`)
    plan.aufschlag.push({ row: art._row, satz, def })
    aenderungen.push(`10 Artikel       ${def.kurzzeichen} ${art['Bezeichnung']}: Preisart Aufschlag ${satz} % auf ${def.basis}`)
  }

  // --- 32 Artikelgruppen + 10 Artikel: Montage und Lieferung ----------------------------
  if (!gruppenTab.rows.some((r) => r['Code'] === SERVICE_GRUPPE.Code)) {
    plan.gruppe = true
    aenderungen.push(`32 Artikelgruppen + ${SERVICE_GRUPPE.Code} „${SERVICE_GRUPPE['Bezeichnung (Dropdown-Titel)']}" (KALKULATION)`)
  }
  for (const def of SERVICE_ARTIKEL) {
    if (artikelTab.rows.some((r) => r['Artikelnummer'] === def.Artikelnummer)) continue
    const satz = satzAusMeta(def.meta, null)
    if (satz == null) throw new Error(`„50 Meta": ${def.meta} fehlt — der bisherige Satz ist unbekannt.`)
    plan.service.push({ def, satz })
    aenderungen.push(`10 Artikel       + ${def.Artikelnummer} ${def.Kurzzeichen} ${def.Bezeichnung}: Aufschlag ${satz} % auf GESAMTMOEBELPREIS (Preisliste ${def.preislistenNr})`)
  }

  // --- 20 Preise: Abweichungen von der Preisliste --------------------------------------
  const preisSpalte = preiseTab.header.get('Preis')
  for (const k of PREIS_KORREKTUREN) {
    const art = artikelTab.rows.find((r) => String(r['Kurzzeichen'] ?? '').trim() === k.kurzzeichen)
    if (!art) throw new Error(`Artikel ${k.kurzzeichen} nicht in „${SHEETS.artikel}" gefunden.`)
    const zeile = preiseTab.rows.find(
      (p) =>
        p['Artikel'] === art['Artikelnummer'] &&
        ['A1', 'A2', 'A3', 'A4', 'A5'].every((s, i) => String(p[s] ?? '').trim() === k.achsen[i]),
    )
    if (!zeile) throw new Error(`Preiszeile ${k.kurzzeichen} ${k.achsen.filter(Boolean).join(' · ')} nicht gefunden.`)
    if (Number(String(zeile['Preis']).replace(',', '.')) === k.preis) continue
    plan.preise.push({ ref: `${preisSpalte}${zeile._row}`, preis: k.preis })
    aenderungen.push(`20 Preise         ${k.kurzzeichen} ${k.achsen.filter(Boolean).join(' · ')}: ${zeile['Preis']} → ${k.preis} (${k.quelle})`)
  }

  // --- 50 Meta: Sätze entfallen, Verweis bleibt ------------------------------------------
  for (const [schluessel, verweis] of Object.entries(META_VERWEISE)) {
    const zeile = metaWert.get(schluessel)
    if (!zeile) continue
    if (String(zeile['Wert'] ?? '') === '' && zeile['Bedeutung'] === verweis) continue
    plan.meta.push({ row: zeile._row, verweis })
    aenderungen.push(`50 Meta          ${schluessel} = ${zeile['Wert'] || '—'} → Verweis auf den Artikel`)
  }

  if (aenderungen.length === 0) {
    console.log(c.green('\n  Nichts zu tun — die Mappe ist bereits auf dem aktuellen Stand.\n'))
    return
  }
  console.log(c.bold('\n  Änderungen'))
  for (const a of aenderungen) console.log(`    ${c.green('~')} ${a}`)

  if (dryRun) {
    console.log(c.yellow('\n  --dry-run: nichts geschrieben.\n'))
    return
  }

  // === Schreiben ===========================================================================
  const logikBlatt = editSheet(wb, SHEETS.preislogiken)
  if (plan.logik) schreibeWerteliste(logikBlatt, logikTab, sollLogik, ['Code', 'Bedeutung'], 'Bezeichnung')

  const artikelBlatt = editSheet(wb, SHEETS.artikel)
  for (const { name, ref } of plan.spalten) setOrCreateCellString(artikelBlatt, `${ref}1`, name)
  for (const { ref, neu } of plan.preislogik) {
    if (!setOrCreateCellString(artikelBlatt, ref, neu)) throw new Error(`Zelle ${ref} nicht beschreibbar.`)
  }
  const setzeZahl = (ref, zahl) => {
    if (!setOrCreateCellString(artikelBlatt, ref, String(zahl)) || !setCellNumber(artikelBlatt, ref, zahl)) {
      throw new Error(`Zelle ${ref} nicht beschreibbar.`)
    }
  }
  for (const { row, satz, def } of plan.aufschlag) {
    setOrCreateCellString(artikelBlatt, `${sp('Preislogik')}${row}`, 'AUFSCHLAG')
    setzeZahl(`${sp('Aufschlag')}${row}`, satz)
    setOrCreateCellString(artikelBlatt, `${sp('Aufschlag-Einheit')}${row}`, '%')
    setOrCreateCellString(artikelBlatt, `${sp('Aufschlag-Basis')}${row}`, def.basis)
    setOrCreateCellString(artikelBlatt, `${sp('Bemerkung')}${row}`, def.bemerkung)
  }
  for (const { def, satz } of plan.service) {
    appendRow(artikelBlatt, {
      [sp('Artikelnummer')]: def.Artikelnummer,
      [sp('Kurzzeichen')]: def.Kurzzeichen,
      [sp('Bezeichnung')]: def.Bezeichnung,
      [sp('Bezeichnung 2')]: 'Serviceleistungen',
      [sp('Teileart')]: 'KALKULATION',
      [sp('Produktgruppe')]: 'KALKULATION',
      [sp('Artikelgruppe')]: SERVICE_GRUPPE.Code,
      [sp('Modus')]: ALLE_SERIEN,
      [sp('Preislogik')]: 'AUFSCHLAG',
      [sp('Einheit')]: 'Aufschlag in %',
      [sp('Achsen')]: '—',
      [sp('Preiszellen')]: 0,
      [sp('Oberfläche')]: 'N',
      [sp('Status')]: 'aktiv',
      [sp('Sortierung')]: Number(def.sortierung),
      [sp('Quelle')]: `Preisliste 06.2026, Art. ${def.preislistenNr}`,
      [sp('Bemerkung')]: def.bemerkung,
      [sp('Aufschlag')]: satz,
      [sp('Aufschlag-Einheit')]: '%',
      [sp('Aufschlag-Basis')]: 'GESAMTMOEBELPREIS',
      [sp('Preislisten-Nr.')]: def.preislistenNr,
    })
  }
  // Benutzten Bereich auf die neuen Spalten ausdehnen (Excel liest sonst nur bis „V").
  const bisSpalte = indexToCol(Math.max(...[...spalte.values()].map(colIndex)))
  artikelBlatt.xml = artikelBlatt.xml.replace(
    /<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/,
    (all, c1, r1, c2, r2) => `<dimension ref="${c1}${r1}:${colIndex(c2) >= colIndex(bisSpalte) ? c2 : bisSpalte}${r2}"/>`,
  )

  const gruppenBlatt = editSheet(wb, SHEETS.artikelgruppen)
  if (plan.gruppe) {
    appendRow(
      gruppenBlatt,
      Object.fromEntries(Object.entries(SERVICE_GRUPPE).map(([name, wert]) => [gruppenTab.header.get(name), wert])),
    )
  }

  const preiseBlatt = editSheet(wb, SHEETS.preise)
  for (const { ref, preis } of plan.preise) {
    if (!setCellNumber(preiseBlatt, ref, preis)) throw new Error(`Zelle ${ref} nicht beschreibbar.`)
  }

  const metaBlatt = editSheet(wb, SHEETS.meta)
  const mSp = (name) => metaTab.header.get(name)
  for (const { row, verweis } of plan.meta) {
    setOrCreateCellString(metaBlatt, `${mSp('Wert')}${row}`, '')
    setOrCreateCellString(metaBlatt, `${mSp('Bedeutung')}${row}`, verweis)
  }

  if (!noBackup) {
    const backup = STAMMDATEN_XLSX.replace(/\.xlsx$/, `.backup-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`)
    copyFileSync(STAMMDATEN_XLSX, backup)
    console.log(c.dim(`\n  Sicherung: ${backup}`))
  }
  logikBlatt.commit()
  artikelBlatt.commit()
  gruppenBlatt.commit()
  preiseBlatt.commit()
  metaBlatt.commit()
  writeFileWithRetry(STAMMDATEN_XLSX, saveWorkbook(wb))
  console.log(c.green('  Geschrieben. Jetzt `npm run data:build` ausführen.\n'))
}

main()
