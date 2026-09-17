#!/usr/bin/env node
/**
 * MIGRATION — Achsen- und Preislogik-Reform in `Cramer-Stammdaten.xlsx`.
 *
 * Schreibt die Reform EINMALIG in die Mappe, damit sie danach über die
 * Stammdatenverwaltung gepflegt werden kann und nicht im Code lebt:
 *
 *   „35 Achsen"      neuer Katalog mit Spalte `Art` (stufe · mass · liste · text · preisart)
 *   „34 Preislogiken" nur noch MATRIX · FESTPREIS · AUF_ANFRAGE
 *   „10 Artikel"      Achsen umgeschlüsselt, Preislogik ersetzt, Einheit aufgeräumt,
 *                     verlorene Fließtexte in die Bemerkung gerettet
 *   „20 Preise"       Achsenwerte in die Form „<cm> cm | <Etikett>" gebracht,
 *                     Aufpreis-Artikel in echte Preiszeilen aufgelöst,
 *                     Rate und Grundpreis als getrennte PREISART-Zeilen
 *
 * IDEMPOTENT: Ein Artikel, dessen Achsen bereits die neuen Codes tragen, wird
 * übersprungen. Zweimal laufen lassen verdoppelt keine Zeile — geprüft wird VOR dem
 * Schreiben.
 *
 *   node scripts/migrate-achsen-reform.js [--dry-run] [--no-backup]
 *   npm run data:migrate-achsen
 */

import { readFileSync, existsSync, copyFileSync } from 'node:fs'

import { STAMMDATEN_XLSX, SHEETS } from './lib/paths.js'
import {
  ACHSEN_KATALOG,
  AUFPREIS_AUFLOESUNG,
  PREISARTEN,
  PREISLOGIK_ERSATZ,
  PREISLOGIK_KATALOG,
  PROZENT_LOGIKEN,
  baueStufenwert,
  bereinigeEinheit,
  hoeheFuerRaster,
  istKanonisch,
  istKorpusartikel,
  zerlegeStufenwert,
  leseAlteBedingung,
  leseAlteBreite,
  leseAlteVariante,
  leseEinheit,
  offsetFuerArtikel,
  prozentBemerkung,
  rasterEtikett,
  runde2,
  zahl,
} from './lib/achsen-reform.js'
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
import { schreibeWerteliste } from './lib/werteliste.js'

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
}

const ART_ACHSE_SPALTEN = ['Achse 1', 'Achse 2', 'Achse 3', 'Achse 4', 'Achse 5']
const PREIS_ACHSE_SPALTEN = ['A1', 'A2', 'A3', 'A4', 'A5']
const SPIEGEL_SPALTEN = [
  'Bezeichnung', 'Teileart', 'Produktgruppe', 'Artikelgruppe', 'Modus', 'Preislogik', 'Einheit', 'Achsen',
]
const ZEILEN_PLATZHALTER = '{ZEILE}'

/** Reihenfolge, in der die neuen Achsen in A1–A5 stehen. */
const ACHSEN_REIHENFOLGE = [
  'BREITE', 'HOEHE', 'TIEFE', 'BREITE_CM', 'HOEHE_CM', 'TIEFE_CM',
  'LAENGE', 'PG', 'LINIE_PG', 'AUSFUEHRUNG', 'PREISART',
]

const NEUE_CODES = new Set(ACHSEN_REIHENFOLGE)

// ---------------------------------------------------------------------------

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const noBackup = process.argv.includes('--no-backup')
  if (!existsSync(STAMMDATEN_XLSX)) throw new Error(`Stammdatendatei nicht gefunden: ${STAMMDATEN_XLSX}`)

  console.log(c.bold('\nAchsen- und Preislogik-Reform'))
  console.log(c.dim(`  ${STAMMDATEN_XLSX}`))

  const wb = openWorkbook(readFileSync(STAMMDATEN_XLSX))
  const artikelTab = readTable(wb, SHEETS.artikel)
  const preiseTab = readTable(wb, SHEETS.preise)
  const achsenTab = readTable(wb, SHEETS.achsen)
  const logikTab = readTable(wb, SHEETS.preislogiken)
  const preiseSheet = readSheet(wb, SHEETS.preise)

  const artikelBlatt = editSheet(wb, SHEETS.artikel)
  const preiseBlatt = editSheet(wb, SHEETS.preise)
  const achsenBlatt = editSheet(wb, SHEETS.achsen)
  const logikBlatt = editSheet(wb, SHEETS.preislogiken)

  const zeilenNachArtikel = new Map()
  for (const z of preiseTab.rows) {
    const liste = zeilenNachArtikel.get(z['Artikel'])
    if (liste) liste.push(z)
    else zeilenNachArtikel.set(z['Artikel'], [z])
  }

  const bericht = { artikel: 0, zeilen: 0, neueZeilen: 0, uebersprungen: 0, hinweise: [], unklar: [] }

  // --- 1) Wertelisten-Blätter -----------------------------------------------------
  if (!dryRun) {
    schreibeWerteliste(achsenBlatt, achsenTab, ACHSEN_KATALOG, ['Code', 'Bedeutung'], 'Art')
    schreibeWerteliste(logikBlatt, logikTab, PREISLOGIK_KATALOG, ['Code', 'Bedeutung'])
  }

  // --- 2) Artikel + Preiszeilen ---------------------------------------------------
  /** Was je Artikel geplant ist — erst vollständig rechnen, dann schreiben. */
  const plaene = new Map()

  for (const art of artikelTab.rows) {
    const plan = planeArtikel(art, zeilenNachArtikel.get(art['Artikelnummer']) ?? [], bericht)
    if (plan) plaene.set(art['Artikelnummer'], plan)
    else bericht.uebersprungen += 1
  }

  // Aufpreis-Artikel in ihre Zielartikel auflösen — erst jetzt, weil dazu beide Pläne
  // fertig sein müssen.
  loeseAufpreiseAuf(plaene, artikelTab, bericht)

  // --- 3) Schreiben ---------------------------------------------------------------
  for (const [nummer, plan] of plaene) {
    const art = plan.artikel
    if (!dryRun) {
      setzeArtikel(artikelBlatt, artikelTab, art._row, plan)
      for (const zeile of plan.zeilen) setzeZeile(preiseBlatt, preiseTab, zeile, plan.achsen)
      for (const neu of plan.neueZeilen) {
        const nr = appendRow(preiseBlatt, baueNeueZeile(preiseTab, preiseSheet, neu, plan.achsen))
        setzeZeilennummerInFormeln(preiseBlatt, nr)
      }
    }
    bericht.artikel += 1
    bericht.zeilen += plan.zeilen.length
    bericht.neueZeilen += plan.neueZeilen.length
    void nummer
  }

  // --- 4) Ausgabe -----------------------------------------------------------------
  if (bericht.unklar.length) {
    console.log(c.bold(`\n  ${c.yellow('Achsenwerte ohne erkennbares Maß')} (unverändert übernommen)`))
    for (const u of bericht.unklar.slice(0, 20)) console.log(`    ${c.yellow('?')} ${u}`)
    if (bericht.unklar.length > 20) console.log(c.dim(`    … und ${bericht.unklar.length - 20} weitere`))
  }
  if (bericht.hinweise.length) {
    console.log(c.bold('\n  Aufgelöste Mischsysteme und gestrichene Logiken'))
    for (const h of bericht.hinweise) console.log(`    ${c.green('→')} ${h}`)
  }

  console.log(
    c.bold(
      `\n  ${bericht.artikel} Artikel · ${bericht.zeilen} Preiszeilen umgeschrieben · ` +
        `${bericht.neueZeilen} neue Preiszeilen · ${bericht.uebersprungen} übersprungen\n`,
    ),
  )

  if (dryRun) {
    console.log(c.yellow('  --dry-run: nichts geschrieben.\n'))
    return
  }
  if (bericht.artikel === 0) {
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
  achsenBlatt.commit()
  logikBlatt.commit()
  forceFullCalcOnLoad(wb)
  writeFileWithRetry(STAMMDATEN_XLSX, saveWorkbook(wb))
  console.log(c.green('  Geschrieben. Jetzt `npm run data:build` ausführen.\n'))
}

// ---------------------------------------------------------------------------
// Planung je Artikel
// ---------------------------------------------------------------------------

/**
 * Rechnet für einen Artikel die neue Achsenbelegung und alle Zellwerte aus.
 * `null` ⇒ bereits migriert, nichts zu tun.
 */
function planeArtikel(art, zeilen, bericht) {
  const alteAchsen = ART_ACHSE_SPALTEN.map((k) => String(art[k] ?? '').trim()).filter((v) => v && !/^\d+$/.test(v))
  const altePreislogik = String(art['Preislogik'] ?? '').trim()
  const offsetMm = offsetFuerArtikel(art)
  const bemerkungen = []
  const fertigungsmasse = new Map()
  const unklar = new Set()

  /** Neue Werte je Preiszeile: Map<code, wert>. */
  const werteJeZeile = zeilen.map(() => new Map())
  /** Welche neuen Achsen tatsächlich gebraucht werden. */
  const gebraucht = new Set()

  alteAchsen.forEach((code, spalte) => {
    const spaltenName = PREIS_ACHSE_SPALTEN[spalte]

    zeilen.forEach((zeile, i) => {
      const roh = String(zeile[spaltenName] ?? '').trim()
      if (!roh) return
      const ziel = werteJeZeile[i]

      switch (code) {
        case 'BREITE': {
          const gelesen = leseAlteBreite(roh)
          if (!gelesen) return
          if (gelesen.unklar) {
            unklar.add(`${art['Artikelnummer']} BREITE „${roh}"`)
            ziel.set('BREITE', roh)
            gebraucht.add('BREITE')
            return
          }
          if (gelesen.fertigungsmass) fertigungsmasse.set(gelesen.etikett, gelesen.fertigungsmass)
          if (gelesen.ziel === 'HOEHE') {
            const cm = gelesen.cm ?? hoeheFuerRaster(gelesen.raster, offsetMm)
            ziel.set('HOEHE', baueStufenwert(cm, gelesen.etikett))
            gebraucht.add('HOEHE')
            return
          }
          ziel.set('BREITE', baueStufenwert(gelesen.cm, gelesen.etikett))
          gebraucht.add('BREITE')
          // Drehtür: der Katalog-Code trägt zusätzlich die Türhöhe.
          if (gelesen.hoehe) {
            ziel.set('HOEHE_CM_AUS_CODE', gelesen.hoehe.cm)
          }
          return
        }
        case 'RASTER': {
          const stufe = zahl(roh)
          if (stufe == null) {
            unklar.add(`${art['Artikelnummer']} RASTER „${roh}"`)
            return
          }
          // Steht die Höhe schon als gedruckter Zentimeterwert im Katalog-Code
          // (Drehtür „T50-51"), gilt der gedruckte Wert; das Raster liefert das Etikett.
          const ausCode = ziel.get('HOEHE_CM_AUS_CODE')
          const cm = ausCode ?? hoeheFuerRaster(stufe, offsetMm)
          ziel.set('HOEHE', baueStufenwert(cm, rasterEtikett(stufe)))
          gebraucht.add('HOEHE')
          return
        }
        case 'TIEFE': {
          gebraucht.add('TIEFE')
          if (istKanonisch(roh)) {
            ziel.set('TIEFE', roh)
            return
          }
          // Das Komma war hier eine Aufzählung („25,30" = 25 und 30 cm). Als Stufe mit
          // Aufrundung deckt die GRÖSSTE der genannten Tiefen beide Fälle ab.
          const stufen = roh.split(',').map((t) => zahl(t)).filter((n) => n != null)
          if (stufen.length === 0) {
            unklar.add(`${art['Artikelnummer']} TIEFE „${roh}"`)
            return
          }
          ziel.set('TIEFE', baueStufenwert(Math.max(...stufen), ''))
          return
        }
        case 'PG':
          ziel.set('PG', roh)
          gebraucht.add('PG')
          return
        case 'LINIE_PG':
          ziel.set('LINIE_PG', roh)
          gebraucht.add('LINIE_PG')
          return
        case 'VARIANTE': {
          const gelesen = leseAlteVariante(roh)
          if (!gelesen) return
          if (gelesen.ziel === 'BEMERKUNG') {
            bemerkungen.push(gelesen.text)
            return
          }
          ziel.set('AUSFUEHRUNG', gelesen.text)
          gebraucht.add('AUSFUEHRUNG')
          return
        }
        case 'BEDINGUNG': {
          const gelesen = leseAlteBedingung(roh)
          if (!gelesen) return
          if (gelesen.ziel === 'BEMERKUNG') {
            bemerkungen.push(gelesen.text)
            return
          }
          ziel.set('LAENGE', baueStufenwert(gelesen.cm, ''))
          gebraucht.add('LAENGE')
          return
        }
        case 'HOEHE': {
          /*
           * NACHKORREKTUR EINES BEREITS MIGRIERTEN WERTES.
           *
           * Korpusteile rechnen `R × 128 mm + Offset(Serie)`, alles andere
           * `R × 128 mm − 3 mm`. Wurde ein Korpus versehentlich nach der Frontformel
           * abgeleitet, steht dort 230,1 cm statt 235,0 cm — und eine Korpushöhe von
           * 235 cm fiele auf die nächste, teurere Stufe. Für Korpusteile wird die Höhe
           * deshalb aus dem Raster-Etikett neu gerechnet; alle anderen Artikel bleiben
           * unangetastet, weil ihre Werte teils GEDRUCKTE Obergrenzen sind
           * („bis 9Raster (120cm)") und keine abgeleiteten.
           */
          gebraucht.add('HOEHE')
          const { cm, etikett } = zerlegeStufenwert(roh)
          const stufe = /^([\d.,]+)\s*R$/i.exec(etikett)
          if (!istKorpusartikel(art) || !stufe) {
            ziel.set('HOEHE', roh)
            return
          }
          void cm
          ziel.set('HOEHE', baueStufenwert(hoeheFuerRaster(zahl(stufe[1]), offsetMm), etikett))
          return
        }
        default:
          if (NEUE_CODES.has(code)) {
            ziel.set(code, roh)
            gebraucht.add(code)
          }
      }
    })
  })

  for (const werte of werteJeZeile) werte.delete('HOEHE_CM_AUS_CODE')

  // --- Preislogik & Einheit --------------------------------------------------------
  const neuePreislogik = PREISLOGIK_ERSATZ[altePreislogik] ?? 'MATRIX'
  const alteEinheit = String(art['Einheit'] ?? '').trim()
  const bezug = leseEinheit(alteEinheit)
  const neueZeilen = []
  let status = String(art['Status'] ?? 'aktiv').trim() || 'aktiv'
  let neueEinheit = bereinigeEinheit(alteEinheit)

  if (PROZENT_LOGIKEN.has(altePreislogik)) {
    const satz = zeilen.length ? zahl(zeilen[0]['Preis']) : null
    bemerkungen.push(prozentBemerkung(satz))
    neueEinheit = 'Aufschlag in %'
    for (const werte of werteJeZeile) werte.set('__STATUS__', 'note')
    bericht.hinweise.push(
      `${art['Artikelnummer']} ${art['Bezeichnung']} — Preislogik ${altePreislogik} gestrichen, jetzt AUF_ANFRAGE`,
    )
  } else if (altePreislogik === 'SATZPREIS') {
    bemerkungen.push('Satzgröße bitte im Feld Einheit ergänzen, z. B. „Satz (Satzgröße: 4)".')
  } else if (gebraucht.has('PREISART')) {
    /*
     * BEREITS REFORMIERT.
     *
     * Die Bezugsgröße steht schon in den Preiszeilen, und das Einheitenfeld ist längst
     * aufgeräumt („Quadratmeter" statt „EUR/Stk zzgl. 525 EUR/m²"). Ein erneuter Blick
     * ins Einheitenfeld fände deshalb nichts mehr und würde die Mengenachsen wieder
     * abräumen — sie kommen jetzt aus den PREISART-Werten selbst.
     */
    const arten = new Set(werteJeZeile.map((w) => w.get('PREISART')).filter(Boolean))
    if (arten.has(PREISARTEN.QM)) {
      gebraucht.add('BREITE_CM')
      gebraucht.add('TIEFE_CM')
    }
    if (arten.has(PREISARTEN.M) || arten.has(PREISARTEN.CM)) gebraucht.add('LAENGE')
  } else if (bezug.basis !== PREISARTEN.FIX || bezug.zusatz) {
    // Der Betrag ist keine reine Stückzahl: die Bezugsgröße wird zur Achse.
    gebraucht.add('PREISART')
    for (const werte of werteJeZeile) werte.set('PREISART', bezug.basis)
    if (bezug.basis === PREISARTEN.QM || bezug.zusatz?.preisart === PREISARTEN.QM) {
      gebraucht.add('BREITE_CM')
      gebraucht.add('TIEFE_CM')
    }
    if (bezug.basis === PREISARTEN.M || bezug.zusatz?.preisart === PREISARTEN.M) {
      gebraucht.add('LAENGE')
    }
    if (bezug.zusatz && bezug.zusatz.preis != null) {
      zeilen.forEach((zeile, i) => {
        const kopie = new Map(werteJeZeile[i])
        kopie.set('PREISART', bezug.zusatz.preisart)
        neueZeilen.push({ vorlage: zeile, werte: kopie, preis: bezug.zusatz.preis })
      })
      bericht.hinweise.push(
        `${art['Artikelnummer']} ${art['Bezeichnung']} — „${alteEinheit}" in zwei Preiszeilen aufgeteilt ` +
          `(${bezug.basis} + ${bezug.zusatz.preisart})`,
      )
    }
  }

  if (fertigungsmasse.size > 0) {
    bemerkungen.push(
      `Fertigungsmaße: ${[...fertigungsmasse].map(([k, v]) => `${k} = ${v}`).join(' · ')}.`,
    )
  }
  for (const u of unklar) bericht.unklar.push(u)

  const achsen = ACHSEN_REIHENFOLGE.filter((code) => gebraucht.has(code))
  if (achsen.length > 5) {
    bericht.unklar.push(`${art['Artikelnummer']} — ${achsen.length} Achsen, nur 5 Spalten: ${achsen.join(' × ')}`)
    achsen.length = 5
  }

  const plan = {
    artikel: art,
    achsen,
    preislogik: neuePreislogik,
    einheit: neueEinheit,
    status,
    bemerkung: mischeBemerkung(art['Bemerkung'], bemerkungen),
    zeilen: zeilen.map((zeile, i) => ({ zeile, werte: werteJeZeile[i] })),
    neueZeilen,
  }

  // Schon auf diesem Stand? Dann nichts anfassen — das hält die Migration idempotent
  // und hält die Änderungsliste in der Verwaltung kurz.
  if (istUnveraendert(art, plan, alteAchsen)) return null
  return plan
}

/** true, wenn der Plan exakt dem entspricht, was schon in der Mappe steht. */
function istUnveraendert(art, plan, alteAchsen) {
  if (plan.neueZeilen.length > 0) return false
  if (alteAchsen.join('|') !== plan.achsen.join('|')) return false
  if (String(art['Preislogik'] ?? '').trim() !== plan.preislogik) return false
  if (String(art['Einheit'] ?? '').trim() !== plan.einheit) return false
  if ((String(art['Status'] ?? '').trim() || 'aktiv') !== plan.status) return false
  if (String(art['Bemerkung'] ?? '').trim() !== plan.bemerkung) return false
  return plan.zeilen.every(({ zeile, werte }) =>
    PREIS_ACHSE_SPALTEN.every((name, i) => {
      const code = plan.achsen[i]
      const neu = code ? String(werte.get(code) ?? '') : ''
      return String(zeile[name] ?? '').trim() === neu
    }),
  )
}

/** Bemerkung ergänzen, ohne Vorhandenes zu verlieren und ohne zu doppeln. */
function mischeBemerkung(vorhanden, zusaetze) {
  const teile = String(vorhanden ?? '').trim() ? [String(vorhanden).trim()] : []
  for (const z of zusaetze) {
    const text = String(z ?? '').trim()
    if (text && !teile.some((t) => t.includes(text))) teile.push(text)
  }
  return teile.join(' · ')
}

// ---------------------------------------------------------------------------
// Aufpreis-Mischsysteme auflösen
// ---------------------------------------------------------------------------

function loeseAufpreiseAuf(plaene, artikelTab, bericht) {
  for (const [quelleNr, regel] of Object.entries(AUFPREIS_AUFLOESUNG)) {
    const quelle = plaene.get(quelleNr)
    if (!quelle) continue

    // Der Aufpreis-Artikel selbst wird stillgelegt — er bleibt lesbar, aber ohne Preis.
    quelle.status = 'gesperrt'
    quelle.preislogik = 'AUF_ANFRAGE'
    quelle.bemerkung = mischeBemerkung(quelle.bemerkung, [regel.grund])
    for (const z of quelle.zeilen) z.werte.set('__STATUS__', 'note')
    bericht.hinweise.push(`${quelleNr} ${quelle.artikel['Bezeichnung']} — ${regel.grund}`)

    if (!regel.ziel) continue
    const ziel = plaene.get(regel.ziel)
    if (!ziel) {
      bericht.unklar.push(`${quelleNr} — Zielartikel ${regel.ziel} nicht gefunden, Aufpreis bleibt stehen`)
      continue
    }

    // Aufpreisbeträge der Quelle, in der Reihenfolge ihrer Zeilen.
    const aufpreise = quelle.zeilen.map((z) => zahl(z.zeile['Preis'])).filter((n) => n != null)
    if (aufpreise.length === 0) continue

    /** Aufpreis für eine Zielzeile bestimmen. */
    const aufpreisFuer = (werte) => {
      if (!regel.aufpreisNachBreiteCm) return aufpreise[0]
      const breite = werte.get('BREITE')
      const cm = breite ? zahl(String(breite).split('|')[0].replace(/cm/i, '')) : null
      const index = cm == null ? -1 : regel.aufpreisNachBreiteCm.indexOf(cm)
      return index >= 0 && index < aufpreise.length ? aufpreise[index] : null
    }

    if (!ziel.achsen.includes('AUSFUEHRUNG')) {
      if (ziel.achsen.length >= 5) {
        bericht.unklar.push(`${regel.ziel} — keine freie Achse für AUSFÜHRUNG, Aufpreis ${quelleNr} bleibt stehen`)
        continue
      }
      ziel.achsen = ACHSEN_REIHENFOLGE.filter((code) => ziel.achsen.includes(code) || code === 'AUSFUEHRUNG')
    }

    for (const z of ziel.zeilen) {
      if (!z.werte.get('AUSFUEHRUNG')) z.werte.set('AUSFUEHRUNG', regel.ausfuehrungBasis)
    }
    for (const z of [...ziel.zeilen]) {
      const basis = zahl(z.zeile['Preis'])
      const aufpreis = aufpreisFuer(z.werte)
      if (basis == null || aufpreis == null) continue
      const werte = new Map(z.werte)
      werte.set('AUSFUEHRUNG', regel.ausfuehrungAufpreis)
      ziel.neueZeilen.push({ vorlage: z.zeile, werte, preis: runde2(basis + aufpreis) })
    }
    ziel.bemerkung = mischeBemerkung(ziel.bemerkung, [
      `Ausführung „${regel.ausfuehrungAufpreis}" enthält den früheren Aufpreis aus ${quelleNr}.`,
    ])
    void artikelTab
  }
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

function setzeArtikel(blatt, tab, zeilenNr, plan) {
  const set = (spalte, wert) => {
    const ref = tab.header.get(spalte)
    if (ref) setOrCreateCellString(blatt, `${ref}${zeilenNr}`, wert)
  }
  ART_ACHSE_SPALTEN.forEach((name, i) => set(name, plan.achsen[i] ?? ''))
  set('Achsen', plan.achsen.length ? plan.achsen.join(' × ') : '—')
  set('Preislogik', plan.preislogik)
  set('Einheit', plan.einheit)
  set('Status', plan.status)
  set('Bemerkung', plan.bemerkung)
  const zellen = tab.header.get('Preiszellen')
  if (zellen) setCellNumber(blatt, `${zellen}${zeilenNr}`, plan.zeilen.length + plan.neueZeilen.length)
}

function setzeZeile(blatt, tab, eintrag, achsen) {
  const { zeile, werte } = eintrag
  PREIS_ACHSE_SPALTEN.forEach((name, i) => {
    const ref = tab.header.get(name)
    if (!ref) return
    const code = achsen[i]
    setOrCreateCellString(blatt, `${ref}${zeile._row}`, code ? String(werte.get(code) ?? '') : '')
  })
  const statusRef = tab.header.get('Status')
  if (statusRef && werte.get('__STATUS__')) {
    setOrCreateCellString(blatt, `${statusRef}${zeile._row}`, werte.get('__STATUS__'))
  }
}

function baueNeueZeile(tab, sheet, neu, achsen) {
  const { vorlage, werte, preis } = neu
  const felder = {}
  felder[tab.header.get('Artikel')] = vorlage['Artikel']

  for (const name of SPIEGEL_SPALTEN) {
    const spalte = tab.header.get(name)
    if (!spalte) continue
    const quelle = sheet.get(vorlage._row)?.[spalte]
    if (quelle?.f) {
      felder[spalte] = { f: quelle.f.replaceAll(String(vorlage._row), ZEILEN_PLATZHALTER), v: quelle.v }
    } else if (quelle?.v) {
      felder[spalte] = quelle.v
    }
  }

  PREIS_ACHSE_SPALTEN.forEach((name, i) => {
    const spalte = tab.header.get(name)
    const code = achsen[i]
    const wert = code ? String(werte.get(code) ?? '') : ''
    if (spalte && wert !== '') felder[spalte] = wert
  })

  felder[tab.header.get('Preis')] = preis
  felder[tab.header.get('Status')] = String(vorlage['Status'] ?? 'fixed')
  const seite = zahl(vorlage['Seite'])
  if (seite != null) felder[tab.header.get('Seite')] = seite
  return felder
}

function setzeZeilennummerInFormeln(sheetState, zeilenNr) {
  const re = new RegExp(`<row\\b[^>]*\\br="${zeilenNr}"[^>]*>[\\s\\S]*?</row>`)
  const m = re.exec(sheetState.xml)
  if (!m) return
  sheetState.xml = sheetState.xml.replace(re, m[0].replaceAll(ZEILEN_PLATZHALTER, String(zeilenNr)))
}

main()
