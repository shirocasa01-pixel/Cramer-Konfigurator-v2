#!/usr/bin/env node
/**
 * MIGRATION — aus jeder Ausführungsvariante wird ein eigener Artikel.
 *
 * Vorgabe: „Bei den VARIANTEN neue Artikel anlegen, d. h. Decoboard und Rauchglas werden
 * als getrennte Artikel geführt."
 *
 * Damit fällt die letzte Achse, die sich nicht auf ein Maß, eine Preisgruppe oder eine
 * Stil-Linie zurückführen ließ. Die Reform vom 17.09.2026 hatte `VARIANTE` zunächst nur
 * zu `AUSFÜHRUNG` mit geschlossenem Wertevorrat gezähmt — dieser Schritt löst sie ganz auf:
 *
 *     40-40-20-0001  Container Conero A          24 Zeilen, Achse AUSFÜHRUNG
 *       ⇒  40-40-20-0001  Container Conero A – Deckplatte Decoboard        12 Zeilen
 *          40-40-20-0020  Container Conero A – Deckplatte Rauchglas grau   12 Zeilen
 *
 * Warum das besser ist: Der Berater wählt einen Artikel, keine Achse. Eine Ausführung, die
 * nur in der Preistabelle existiert, taucht in keinem Dropdown auf und ist damit für
 * niemanden auffindbar, der nicht die Preiszeilen liest. Außerdem trugen die Conero-G/H-
 * Container ihre Deckplatte längst als eigenen Artikel (0007 gegen 0008) — nur mit
 * IDENTISCHER Bezeichnung, was sie ununterscheidbar machte. Beides ist damit erledigt.
 *
 * Die Zuordnung der Preiszeilen läuft über die Spalte `Artikel`: Zeilen der zweiten und
 * jeder weiteren Ausführung werden auf die neue Nummer UMGEHÄNGT, nicht kopiert. Es
 * entsteht keine Zeile und es verschwindet keine — die Beträge bleiben Zeile für Zeile
 * dieselben.
 *
 * IDEMPOTENT: Ein Artikel ohne AUSFÜHRUNGS-Achse wird übersprungen.
 *
 *   node scripts/migrate-varianten-artikel.js [--dry-run] [--no-backup]
 *   npm run data:migrate-varianten
 */

import { readFileSync, existsSync, copyFileSync } from 'node:fs'

import { STAMMDATEN_XLSX, SHEETS } from './lib/paths.js'
import { ACHSEN_KATALOG } from './lib/achsen-reform.js'
import { schreibeWerteliste } from './lib/werteliste.js'
import {
  openWorkbook,
  readTable,
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
const ACHSE = 'AUSFUEHRUNG'

/** Trennzeichen zwischen Grundbezeichnung und Ausführung. */
const TRENNER = ' – '

// ---------------------------------------------------------------------------

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const noBackup = process.argv.includes('--no-backup')
  if (!existsSync(STAMMDATEN_XLSX)) throw new Error(`Stammdatendatei nicht gefunden: ${STAMMDATEN_XLSX}`)

  console.log(c.bold('\nAusführungsvarianten werden eigene Artikel'))
  console.log(c.dim(`  ${STAMMDATEN_XLSX}`))

  const wb = openWorkbook(readFileSync(STAMMDATEN_XLSX))
  const artikelTab = readTable(wb, SHEETS.artikel)
  const preiseTab = readTable(wb, SHEETS.preise)
  const gruppenTab = readTable(wb, SHEETS.artikelgruppen)
  const achsenTab = readTable(wb, SHEETS.achsen)

  const artikelBlatt = editSheet(wb, SHEETS.artikel)
  const preiseBlatt = editSheet(wb, SHEETS.preise)
  const gruppenBlatt = editSheet(wb, SHEETS.artikelgruppen)
  const achsenBlatt = editSheet(wb, SHEETS.achsen)

  const zeilenNachArtikel = new Map()
  for (const z of preiseTab.rows) {
    const liste = zeilenNachArtikel.get(z['Artikel'])
    if (liste) liste.push(z)
    else zeilenNachArtikel.set(z['Artikel'], [z])
  }

  /** Höchste vergebene Laufnummer je Artikelgruppe — Ausgangspunkt für neue Nummern. */
  const hoechsteLaufnummer = new Map()
  for (const a of artikelTab.rows) {
    const lauf = Number(String(a['Artikelnummer']).split('-')[3])
    if (!Number.isFinite(lauf)) continue
    const gruppe = a['Artikelgruppe']
    hoechsteLaufnummer.set(gruppe, Math.max(hoechsteLaufnummer.get(gruppe) ?? 0, lauf))
  }

  const bericht = { umbenannt: [], gespalten: [], neueArtikel: 0, umgehaengt: 0 }
  /** Wie viele Artikel jede Artikelgruppe in diesem Lauf dazubekommt. */
  const zuwachsJeGruppe = new Map()

  for (const art of artikelTab.rows) {
    const achsen = ART_ACHSE_SPALTEN.map((k) => String(art[k] ?? '').trim()).filter(Boolean)
    const spalte = achsen.indexOf(ACHSE)
    if (spalte < 0) continue

    const zeilen = zeilenNachArtikel.get(art['Artikelnummer']) ?? []
    const neueAchsen = achsen.filter((a) => a !== ACHSE)

    // Ausführungen in der Reihenfolge, in der die Preisliste sie führt.
    const ausfuehrungen = []
    for (const z of zeilen) {
      const wert = String(z[PREIS_ACHSE_SPALTEN[spalte]] ?? '').trim()
      if (wert && !ausfuehrungen.includes(wert)) ausfuehrungen.push(wert)
    }
    if (ausfuehrungen.length === 0) {
      // Achse ohne Werte — sie war nie ein Preisschlüssel und kann ersatzlos weg.
      if (!dryRun) schreibeArtikel(artikelBlatt, artikelTab, art._row, { achsen: neueAchsen })
      for (const z of zeilen) if (!dryRun) schreibeAchsenwerte(preiseBlatt, preiseTab, z, achsen, neueAchsen, spalte)
      continue
    }

    /** Die erste Ausführung bleibt beim bisherigen Artikel — seine Nummer ändert sich nie. */
    const zielNummer = new Map([[ausfuehrungen[0], art['Artikelnummer']]])

    for (const wert of ausfuehrungen.slice(1)) {
      const lauf = (hoechsteLaufnummer.get(art['Artikelgruppe']) ?? 0) + 1
      hoechsteLaufnummer.set(art['Artikelgruppe'], lauf)
      const nummer = neueArtikelnummer(art['Artikelnummer'], lauf)
      zielNummer.set(wert, nummer)

      const anzahl = zeilen.filter((z) => String(z[PREIS_ACHSE_SPALTEN[spalte]] ?? '').trim() === wert).length
      if (!dryRun) {
        appendRow(
          artikelBlatt,
          baueArtikelzeile(artikelTab, art, {
            artikelnummer: nummer,
            kurzzeichen: neuesKurzzeichen(art['Kurzzeichen'], lauf),
            bezeichnung: mitAusfuehrung(art['Bezeichnung'], wert),
            achsen: neueAchsen,
            preiszellen: anzahl,
            sortierung: sortierungFuer(art['Sortierung'], ausfuehrungen.indexOf(wert)),
          }),
        )
      }
      bericht.neueArtikel += 1
      zuwachsJeGruppe.set(art['Artikelgruppe'], (zuwachsJeGruppe.get(art['Artikelgruppe']) ?? 0) + 1)
    }

    // Bisheriger Artikel: Bezeichnung um die erste Ausführung ergänzen, Achse entfernen.
    const eigeneZeilen = zeilen.filter(
      (z) => String(z[PREIS_ACHSE_SPALTEN[spalte]] ?? '').trim() === ausfuehrungen[0],
    )
    if (!dryRun) {
      schreibeArtikel(artikelBlatt, artikelTab, art._row, {
        bezeichnung: mitAusfuehrung(art['Bezeichnung'], ausfuehrungen[0]),
        achsen: neueAchsen,
        preiszellen: eigeneZeilen.length,
      })
    }

    // Preiszeilen: Achsenwerte neu setzen, fremde Ausführungen umhängen.
    for (const z of zeilen) {
      const wert = String(z[PREIS_ACHSE_SPALTEN[spalte]] ?? '').trim()
      const ziel = zielNummer.get(wert)
      if (!dryRun) {
        schreibeAchsenwerte(preiseBlatt, preiseTab, z, achsen, neueAchsen, spalte)
        if (ziel && ziel !== art['Artikelnummer']) {
          setOrCreateCellString(preiseBlatt, `${preiseTab.header.get('Artikel')}${z._row}`, ziel)
        }
      }
      if (ziel && ziel !== art['Artikelnummer']) bericht.umgehaengt += 1
    }

    if (ausfuehrungen.length === 1) {
      bericht.umbenannt.push(`${art['Artikelnummer']} → „${mitAusfuehrung(art['Bezeichnung'], ausfuehrungen[0])}"`)
    } else {
      bericht.gespalten.push({
        nummer: art['Artikelnummer'],
        bezeichnung: art['Bezeichnung'],
        teile: ausfuehrungen.map((w) => `${zielNummer.get(w)} ${w}`),
      })
    }
  }

  // --- Artikelgruppen: Artikelzahl nachziehen ---------------------------------------
  if (!dryRun && bericht.neueArtikel > 0) {
    const spalte = gruppenTab.header.get('Artikel')
    for (const [gruppe, zuwachs] of zuwachsJeGruppe) {
      const zeile = gruppenTab.rows.find((r) => r['Code'] === gruppe)
      if (!zeile || !spalte) continue
      const bisher = artikelTab.rows.filter((a) => a['Artikelgruppe'] === gruppe).length
      setCellNumber(gruppenBlatt, `${spalte}${zeile._row}`, bisher + zuwachs)
    }
  }

  // --- Achsen-Katalog: AUSFÜHRUNG ist damit verschwunden ----------------------------
  if (!dryRun) {
    schreibeWerteliste(
      achsenBlatt,
      achsenTab,
      ACHSEN_KATALOG.filter((a) => a.code !== ACHSE),
      ['Code', 'Bedeutung'],
      'Art',
    )
  }

  // --- Ausgabe ----------------------------------------------------------------------
  if (bericht.gespalten.length) {
    console.log(c.bold('\n  Gespalten'))
    for (const g of bericht.gespalten) {
      console.log(`    ${c.green('⑂')} ${g.nummer} ${g.bezeichnung}`)
      for (const t of g.teile) console.log(c.dim(`        ${t}`))
    }
  }
  if (bericht.umbenannt.length) {
    console.log(c.bold('\n  Nur umbenannt (eine einzige Ausführung)'))
    for (const u of bericht.umbenannt) console.log(`    ${c.dim('·')} ${u}`)
  }

  console.log(
    c.bold(
      `\n  ${bericht.gespalten.length} Artikel gespalten · ${bericht.neueArtikel} neue Artikel · ` +
        `${bericht.umgehaengt} Preiszeilen umgehängt\n`,
    ),
  )

  if (dryRun) {
    console.log(c.yellow('  --dry-run: nichts geschrieben.\n'))
    return
  }
  if (bericht.neueArtikel === 0 && bericht.umbenannt.length === 0) {
    console.log(c.green('  Nichts zu tun — die Mappe ist bereits auf diesem Stand.\n'))
    return
  }

  if (!noBackup) {
    const backup = STAMMDATEN_XLSX.replace(
      /\.xlsx$/,
      `.backup-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`,
    )
    copyFileSync(STAMMDATEN_XLSX, backup)
    console.log(c.dim(`  Sicherung: ${backup}`))
  }

  artikelBlatt.commit()
  preiseBlatt.commit()
  gruppenBlatt.commit()
  achsenBlatt.commit()
  forceFullCalcOnLoad(wb)
  writeFileWithRetry(STAMMDATEN_XLSX, saveWorkbook(wb))
  console.log(c.green('  Geschrieben. Jetzt `npm run data:build` ausführen.\n'))
}

// ---------------------------------------------------------------------------
// Benennung & Nummern
// ---------------------------------------------------------------------------

/**
 * Bezeichnung mit Ausführung.
 *
 * Steht die Ausführung schon im Namen, bleibt er unverändert — sonst hieße der Artikel
 * nach einem zweiten Lauf „Schloss – Aufschraub-Riegelschloss – Aufschraub-Riegelschloss".
 */
function mitAusfuehrung(bezeichnung, ausfuehrung) {
  const basis = String(bezeichnung ?? '').trim()
  const wert = String(ausfuehrung ?? '').trim()
  if (!wert || basis.includes(wert)) return basis
  return `${basis}${TRENNER}${wert}`
}

/** `40-40-20-0001` + 20 ⇒ `40-40-20-0020` — dieselbe Artikelgruppe, nächste Laufnummer. */
function neueArtikelnummer(vorlage, lauf) {
  const teile = String(vorlage).split('-')
  teile[teile.length - 1] = String(lauf).padStart(4, '0')
  return teile.join('-')
}

/**
 * `CON-001` + 20 ⇒ `CON-020`.
 *
 * Das Kurzzeichen ist Lesehilfe, kein Schlüssel — es muss nur eindeutig und erkennbar
 * sein. Es folgt deshalb der Laufnummer, genau wie bei den bestehenden Artikeln.
 */
function neuesKurzzeichen(vorlage, lauf) {
  const praefix = String(vorlage ?? '').split('-')[0]
  return praefix ? `${praefix}-${String(lauf).padStart(3, '0')}` : ''
}

/**
 * Sortierung der Variante: dicht hinter dem Grundartikel.
 *
 * Die bestehenden Sortierungen sind Vielfache von zehn; +1, +2, +3 halten die Varianten
 * beisammen, ohne den nächsten Artikel zu überholen.
 */
function sortierungFuer(basis, index) {
  const zahl = Number(String(basis ?? '').replace(',', '.'))
  return Number.isFinite(zahl) ? zahl + index : null
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

/** Einzelne Felder eines bestehenden Artikels überschreiben. */
function schreibeArtikel(blatt, tab, zeilenNr, felder) {
  const set = (spalte, wert) => {
    const ref = tab.header.get(spalte)
    if (ref) setOrCreateCellString(blatt, `${ref}${zeilenNr}`, wert)
  }
  if (felder.bezeichnung != null) set('Bezeichnung', felder.bezeichnung)
  if (felder.achsen) {
    ART_ACHSE_SPALTEN.forEach((name, i) => set(name, felder.achsen[i] ?? ''))
    set('Achsen', felder.achsen.length ? felder.achsen.join(' × ') : '—')
  }
  if (felder.preiszellen != null) {
    const ref = tab.header.get('Preiszellen')
    if (ref) setCellNumber(blatt, `${ref}${zeilenNr}`, felder.preiszellen)
  }
}

/** Eine vollständige neue Artikelzeile, abgeleitet vom Grundartikel. */
function baueArtikelzeile(tab, vorlage, felder) {
  const werte = {}
  for (const [name, ref] of tab.header) {
    if (name === '_row') continue
    werte[ref] = vorlage[name] ?? ''
  }
  const setze = (name, wert) => {
    const ref = tab.header.get(name)
    if (ref) werte[ref] = wert
  }
  setze('Artikelnummer', felder.artikelnummer)
  setze('Kurzzeichen', felder.kurzzeichen)
  setze('Bezeichnung', felder.bezeichnung)
  ART_ACHSE_SPALTEN.forEach((name, i) => setze(name, felder.achsen[i] ?? ''))
  setze('Achsen', felder.achsen.length ? felder.achsen.join(' × ') : '—')
  setze('Preiszellen', felder.preiszellen)
  if (felder.sortierung != null) setze('Sortierung', felder.sortierung)
  // Leere Zellen werden von `appendRow` ohnehin übersprungen.
  return werte
}

/** Achsenwerte einer Preiszeile ohne die entfallene Achse neu schreiben. */
function schreibeAchsenwerte(blatt, tab, zeile, alteAchsen, neueAchsen, entfallen) {
  const werte = alteAchsen
    .map((_, i) => String(zeile[PREIS_ACHSE_SPALTEN[i]] ?? ''))
    .filter((_, i) => i !== entfallen)
  PREIS_ACHSE_SPALTEN.forEach((name, i) => {
    const ref = tab.header.get(name)
    if (!ref) return
    setOrCreateCellString(blatt, `${ref}${zeile._row}`, i < neueAchsen.length ? werte[i] : '')
  })
}

main()
