#!/usr/bin/env node
/**
 * SCHRITT 3 — Stammdaten aus den beiden Quell-Dateien in ein getyptes TS-Modul überführen.
 *
 *   Cramer-Stammdaten.xlsx  ┐
 *                           ├─→  src/data/stammdaten.generated.ts
 *   ARTIKELNUMMER-LOGIK.md  ┘
 *
 * Erzeugt werden nicht nur die Daten, sondern auch die **Typen**: Serien-, Produktgruppen-,
 * Artikelgruppen-, Teileart-, Preislogik- und Achsen-Kürzel werden als Literal-Unions aus
 * den Wertelisten-Blättern abgeleitet. Ein Tippfehler wie `'REFUGIUM'` statt `'refugium'`
 * ist damit ein Compile-Fehler, kein stiller Leerbefund zur Laufzeit.
 *
 * Beide Quellen beschreiben die Klassifikation — das Script vergleicht sie und meldet
 * jede Abweichung, statt eine der beiden stillschweigend zu bevorzugen.
 *
 * Aufruf:
 *   node scripts/build-stammdaten.js            # schreibt das Modul
 *   node scripts/build-stammdaten.js --check    # nur prüfen (CI/Vorab), nichts schreiben
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

import { STAMMDATEN_XLSX, LOGIK_MD, SHEETS, REPO_ROOT } from './lib/paths.js'
import { ACHSEN_REPARATUREN, findeReparatur } from './lib/achsen-reparatur.js'
import { readProgramCodes, parseModus } from './lib/modus.js'
import { openWorkbook, readTable } from './lib/xlsx-raw.js'
import { baueNummernMigration } from './lib/nummern-migration.js'
import { splitSections, findSection, parseTables, parseCodeBlocks, plain } from './lib/markdown.js'

const OUT = path.join(REPO_ROOT, 'src', 'data', 'stammdaten.generated.ts')

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
}

const warnings = []
const warn = (msg) => warnings.push(msg)

/** Beim Erzeugen angewandte Achsen-Korrekturen (siehe `lib/achsen-reparatur.js`). */
const reparaturenAngewandt = []

// ---------------------------------------------------------------------------
// Emit-Helfer
// ---------------------------------------------------------------------------

const s = (v) => JSON.stringify(String(v ?? ''))
const num = (v) => {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
/** Literal-Union aus einer Werteliste – deterministisch sortiert. */
const union = (values) =>
  values.length ? [...new Set(values)].sort().map(s).join(' | ') : 'never'

/** Objekt-Literal in einer Zeile; leere Strings und `null` bleiben erhalten (Feldtreue). */
const obj = (fields) =>
  `{ ${Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')} }`

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

function ladeExcel() {
  if (!existsSync(STAMMDATEN_XLSX)) throw new Error(`Stammdatendatei nicht gefunden: ${STAMMDATEN_XLSX}`)
  const wb = openWorkbook(readFileSync(STAMMDATEN_XLSX))
  const t = (sheet) => readTable(wb, sheet).rows

  const programme = t(SHEETS.programme)
  const codes = readProgramCodes(programme)
  const serienCodes = [...codes.values()].sort((a, b) => a.position - b.position)

  const produktgruppen = t(SHEETS.produktgruppen)
  const artikelgruppen = t(SHEETS.artikelgruppen)
  const teilearten = t(SHEETS.teilearten)
  const preislogiken = t(SHEETS.preislogiken)
  const achsen = t(SHEETS.achsen)
  const artikel = t(SHEETS.artikel)
  const preise = t(SHEETS.preise)
  const mitarbeiter = t(SHEETS.mitarbeiter)
  const filialen = t(SHEETS.filialen)
  const kunden = t(SHEETS.kunden).filter((r) => /^K-\d+/.test(r['Kundennr'] ?? ''))
  const metaRows = t(SHEETS.meta)
  const anleitung = t(SHEETS.anleitung)

  return {
    codes, serienCodes, produktgruppen, artikelgruppen, teilearten, preislogiken,
    achsen, artikel, preise, mitarbeiter, filialen, kunden, metaRows, anleitung,
  }
}

/** „00 Anleitung" ist Fließtext – daraus kommen die Status-Domäne und das Nummern-Muster. */
function ladeAnleitung(rows) {
  const text = rows.map((r) => Object.values(r).filter((v) => typeof v === 'string').join(' ')).join('\n')
  const statusMatch = /Status:\s*([a-zäöü]+(?:\s*\|\s*[a-zäöü]+)+)/i.exec(text)
  const musterMatch = /Aufbau\s+([A-Z]+(?:-[A-Z]+)+)/.exec(text)
  return {
    artikelStatusDomain: statusMatch ? statusMatch[1].split('|').map((x) => x.trim()) : [],
    nummernMuster: musterMatch ? musterMatch[1] : '',
  }
}

function ladeMeta(rows) {
  const scalars = {}
  const preisgruppen = {}
  const korpusOffsetMm = {}

  for (const row of rows) {
    const key = (row['Schlüssel'] ?? '').trim()
    const value = (row['Wert'] ?? '').trim()
    if (!key || value === '') continue
    if (key.startsWith('offset.')) korpusOffsetMm[key.slice('offset.'.length)] = num(value)
    else if (/^PG\d$/.test(key)) preisgruppen[key] = value
    else if (/^[a-z][A-Za-z0-9]*$/.test(key)) scalars[key] = value
  }

  for (const key of [
    'validity',
    'currency',
    'vatRate',
    // Montage, Lieferung, Raumteiler und Sichtrückwand stehen seit der Preisarten-
    // Überarbeitung als Aufschlag-Artikel in „10 Artikel", nicht mehr hier.
    'rasterMm',
    'beleuchtungTiefenzugabeMm',
  ]) {
    if (scalars[key] === undefined) warn(`„${SHEETS.meta}": Schlüssel "${key}" fehlt.`)
  }
  return { scalars, preisgruppen, korpusOffsetMm }
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

function ladeMarkdown() {
  if (!existsSync(LOGIK_MD)) {
    warn(`Markdown-Datei nicht gefunden: ${LOGIK_MD} — Artikelnummer-Logik bleibt leer.`)
    return { bloecke: [], teilearten: [], produktgruppen: [], artikelgruppen: [], beispiele: [] }
  }
  const sections = splitSections(readFileSync(LOGIK_MD, 'utf8'))

  // --- Blöcke der Artikelnummer aus dem ASCII-Diagramm ---------------------------
  const aufbau = findSection(sections, /Der Aufbau/i)
  const bloecke = []
  let beispielNummer = ''
  if (aufbau) {
    const block = parseCodeBlocks(aufbau.body)[0] ?? ''
    const zeilen = block.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim() !== '')
    beispielNummer = (zeilen[0] ?? '').trim()
    // Beschriftungen stehen von unten nach oben – die Reihenfolge in der Nummer ist umgekehrt.
    const labels = zeilen
      .map((l) => /└[─]+\s*(.+)$/.exec(l)?.[1])
      .filter(Boolean)
      .map((l) => l.split(/\s{2,}/)[0].trim())
      .reverse()
    const teile = beispielNummer.split('-')
    if (labels.length !== teile.length) {
      warn(`Artikelnummer-Diagramm: ${teile.length} Blöcke, aber ${labels.length} Beschriftungen — Blöcke unvollständig.`)
    }
    teile.forEach((teil, i) => {
      bloecke.push({ name: labels[i] ?? `Block ${i + 1}`, laenge: teil.length, beispiel: teil })
    })
  } else {
    warn('Markdown: Abschnitt „Der Aufbau" nicht gefunden — keine Nummern-Blöcke.')
  }

  // --- Klassifikations-Tabellen ---------------------------------------------------
  const alleTabellen = sections.flatMap((sec) => parseTables(sec.body))
  const tabelleMit = (...spalten) =>
    alleTabellen.find((t) => spalten.every((sp) => t.headers.some((h) => h.toLowerCase().includes(sp))))

  const teileartTab = tabelleMit('nr', 'code', 'bedeutung')
  const teilearten = (teileartTab?.rows ?? []).map((r) => ({
    nr: plain(r[teileartTab.headers[0]]),
    code: plain(r[teileartTab.headers[1]]),
    bedeutung: plain(r[teileartTab.headers[2]]),
  }))

  // Produktgruppen-Tabelle: genau zwei Spalten Nr | Code
  const pgTab = alleTabellen.find(
    (t) => t.headers.length === 2 && /nr/i.test(t.headers[0]) && /code/i.test(t.headers[1]),
  )
  const mdProduktgruppen = (pgTab?.rows ?? []).map((r) => ({
    nr: plain(r[pgTab.headers[0]]),
    code: plain(r[pgTab.headers[1]]),
  }))

  // Artikelgruppen: „05 Korpus · 10 Mittelseite · …" je Produktgruppe
  const agTab = tabelleMit('produktgruppe', 'artikelgruppen')
  const artikelgruppen = []
  for (const row of agTab?.rows ?? []) {
    const pgZelle = plain(row[agTab.headers[0]])
    const pgCode = /^\d+\s+(\S+)/.exec(pgZelle)?.[1] ?? pgZelle
    for (const eintrag of plain(row[agTab.headers[1]]).split('·')) {
      const m = /^\s*(\d+)\s+(.+?)\s*$/.exec(eintrag)
      if (m) artikelgruppen.push({ produktgruppe: pgCode, nr: m[1], bezeichnung: m[2] })
    }
  }

  // Beispiel-Artikelnummern aus dem echten Bestand
  const beispielTab = tabelleMit('artikelnummer', 'kurzzeichen')
  const beispiele = (beispielTab?.rows ?? []).map((r) => ({
    artikelnummer: plain(r[beispielTab.headers[0]]),
    kurzzeichen: plain(r[beispielTab.headers[1]]),
    bezeichnung: plain(r[beispielTab.headers[2]] ?? ''),
    achsen: plain(r[beispielTab.headers[3]] ?? ''),
  }))

  return { bloecke, beispielNummer, teilearten, produktgruppen: mdProduktgruppen, artikelgruppen, beispiele }
}

// ---------------------------------------------------------------------------
// Kreuzprüfung Excel ↔ Markdown ↔ Referenzintegrität
// ---------------------------------------------------------------------------

function pruefe(xl, md) {
  const codeSet = (rows, col) => new Set(rows.map((r) => (r[col] ?? '').trim()).filter(Boolean))

  const vergleiche = (label, ausExcel, ausMd) => {
    if (ausMd.size === 0) return
    const fehltImMd = [...ausExcel].filter((x) => !ausMd.has(x))
    const fehltInExcel = [...ausMd].filter((x) => !ausExcel.has(x))
    if (fehltImMd.length) warn(`${label}: in der Excel, nicht im Markdown — ${fehltImMd.join(', ')}`)
    if (fehltInExcel.length) warn(`${label}: im Markdown, nicht in der Excel — ${fehltInExcel.join(', ')}`)
  }

  // Die Mappe fuehrt weiter das alte Vier-Block-Schema; verglichen wird deshalb gegen
  // die Markdown-Angaben zu Produktgruppen und Artikelgruppen. Die alte Spalte
  // „Teileart" wird nicht mehr ausgewertet (siehe lib/nummern-migration.js).
  vergleiche('Teilearten (bisher Produktgruppen)', codeSet(xl.produktgruppen, 'Code'), codeSet(md.produktgruppen, 'code'))

  // Artikelgruppen: über (Produktgruppe, Nr) vergleichen – die Klartext-Namen weichen ab.
  const excelAg = new Set(xl.artikelgruppen.map((r) => `${r['Produktgruppe']}/${r['Nr (Stelle 3)']}`))
  const mdAg = new Set(md.artikelgruppen.map((r) => `${r.produktgruppe}/${r.nr}`))
  vergleiche('Artikelgruppen (Produktgruppe/Nr)', excelAg, mdAg)

  // Referenzintegrität innerhalb der Mappe
  const pgCodes = codeSet(xl.produktgruppen, 'Code')
  const agCodes = codeSet(xl.artikelgruppen, 'Code')
  const plCodes = codeSet(xl.preislogiken, 'Code')
  const achsCodes = codeSet(xl.achsen, 'Code')
  const artikelNummern = new Set(xl.artikel.map((r) => r['Artikelnummer']))

  for (const a of xl.artikel) {
    const wo = `Artikel ${a['Artikelnummer']}`
    if (!pgCodes.has(a['Produktgruppe'])) warn(`${wo}: unbekannte Teileart "${a['Produktgruppe']}"`)
    if (!agCodes.has(a['Artikelgruppe'])) warn(`${wo}: unbekanntes Dropdown "${a['Artikelgruppe']}"`)
    if (!plCodes.has(a['Preislogik'])) warn(`${wo}: unbekannte Preislogik "${a['Preislogik']}"`)
    for (let i = 1; i <= 5; i++) {
      const ach = a[`Achse ${i}`]
      if (ach && !achsCodes.has(ach) && !/^\d+$/.test(ach)) warn(`${wo}: unbekannte Achse "${ach}"`)
    }
    if (parseModus(a['Modus'], [...xl.codes.keys()]).length === 0) {
      warn(`${wo}: Modus "${a['Modus']}" gibt keine Serie frei — der Artikel erscheint nirgends.`)
    }
  }

  const verwaist = xl.preise.filter((p) => !artikelNummern.has(p['Artikel']))
  if (verwaist.length) warn(`${verwaist.length} Preiszeilen verweisen auf unbekannte Artikel (z. B. ${verwaist[0]['Artikel']}).`)

  const filialNummern = new Set(xl.filialen.map((f) => f['Filialnr']))
  for (const m of xl.mitarbeiter) {
    if (m['Filiale'] && !filialNummern.has(m['Filiale'])) {
      warn(`Mitarbeiter ${m['Personalnr']} (${m['Name']}): Filiale "${m['Filiale']}" gibt es in „${SHEETS.filialen}" nicht.`)
    }
  }
}

// ---------------------------------------------------------------------------
// Modul erzeugen
// ---------------------------------------------------------------------------

function erzeugeModul(xl, md, anleitung, meta, mig) {
  const serienIds = xl.serienCodes.map((p) => p.id)
  const statusDomain = [...new Set([...anleitung.artikelStatusDomain, ...xl.artikel.map((a) => a['Status'])])].filter(Boolean)
  const preisStatus = [...new Set(xl.preise.map((p) => p['Status']).filter(Boolean))]

  const L = []
  const push = (...lines) => L.push(...lines)

  push(
    '/*',
    ' * AUTOMATISCH GENERIERT — nicht von Hand bearbeiten.',
    ' *',
    ' * Quellen:',
    ` *   ${path.basename(STAMMDATEN_XLSX)}  (${xl.artikel.length} Artikel, ${xl.preise.length} Preiszeilen)`,
    ` *   ${path.basename(LOGIK_MD)}`,
    ' *',
    ' * Neu erzeugen nach jeder Änderung an den Quell-Dateien:',
    ' *   npm run data:build      (läuft auch automatisch vor `npm run dev` und `npm run build`)',
    ' *',
    ' * Die Kürzel-Typen unten sind aus den Wertelisten-Blättern abgeleitet: eine neue Serie,',
    ' * Produktgruppe oder Artikelgruppe in der Mappe erweitert automatisch den Typ.',
    ' */',
    '',
    '// ---------------------------------------------------------------------------',
    '// Kürzel (Literal-Unions aus den Wertelisten-Blättern)',
    '// ---------------------------------------------------------------------------',
    '',
    `/** Serien-Kürzel im Feld \`Modus\` — Blatt „${SHEETS.programme}". */`,
    `export type SerienCode = ${union(xl.serienCodes.map((p) => p.code))}`,
    '',
    '/** Serien-ID für die Anwendung (kleingeschrieben, stabil). */',
    `export type SerienId = ${union(serienIds)}`,
    '',
    '/** Alle Serien-Kürzel in kanonischer Reihenfolge — Eingabe für `parseModus()`. */',
    `export const SERIEN_CODES = [${xl.serienCodes.map((p) => s(p.code)).join(', ')}] as const`,
    '',
    '/** Teileart = oberste Kategorie, zugleich der Hauptschritt im Konfigurator. */',
    `export type TeileartCode = ${union(xl.produktgruppen.map((r) => r['Code']))}`,
    '/** Dropdown = ein konkretes Auswahlfeld im Konfigurator. */',
    `export type DropdownCode = ${union(xl.artikelgruppen.map((r) => r['Code']))}`,
    `export type PreislogikCode = ${union(xl.preislogiken.map((r) => r['Code']))}`,
    `export type AchseCode = ${union(xl.achsen.map((r) => r['Code']))}`,
    '/** Wie der Wert einer Achse gelesen wird — Spalte „Art" in Blatt „35 Achsen". */',
    `export type AchsenArt = ${union(xl.achsen.map((r) => r['Art']).filter(Boolean))}`,
    `export type ArtikelStatus = ${union(statusDomain)}`,
    `export type PreisStatus = ${union(preisStatus)}`,
    '',
    '// ---------------------------------------------------------------------------',
    '// Strukturen',
    '// ---------------------------------------------------------------------------',
    '',
    '/** Eine Möbelserie („Programm"). */',
    'export interface Serie {',
    '  code: SerienCode',
    '  id: SerienId',
    '  name: string',
    '  schwerpunkt: string',
    '  /** Frühere Position im Positions-Modus; heute nur noch Sortierreihenfolge. */',
    '  position: number',
    '}',
    '',
    '/** Ein Artikel aus dem Stamm. Ein Artikel = eine Zeile, seine Preisvarianten sind Achsen. */',
    'export interface Artikel {',
    '  artikelnummer: string',
    '  /** Lesehilfe (z. B. „DRT-001") — ausdrücklich KEIN Schlüssel. */',
    '  kurzzeichen: string',
    '  bezeichnung: string',
    '  bezeichnung2: string',
    '  /** Block 1 der Artikelnummer — Hauptschritt im Konfigurator. */',
    '  teileart: TeileartCode',
    '  /** Block 2 der Artikelnummer — das Auswahlfeld, in dem der Artikel erscheint. */',
    '  dropdown: DropdownCode',
    '  /**',
    '   * Serien-Freigabe als reine Buchstaben (GROSS = Standard, klein = Sonderanfertigung).',
    '   * Nicht selbst zerlegen — `src/lib/modus.ts` bzw. `src/lib/stammdaten.ts` benutzen.',
    '   */',
    '  modus: string',
    '  preislogik: PreislogikCode',
    '  einheit: string',
    '  /** Achsen als Klartext, z. B. „BREITE × RASTER × LINIE+PG". */',
    '  achsenText: string',
    '  /** Bedeutung der Spalten A1–A5 der Preiszeilen, in dieser Reihenfolge. */',
    '  achsen: AchseCode[]',
    '  /** Anzahl hinterlegter Preiszellen laut Stamm. */',
    '  preiszellen: number | null',
    '  /** Oberfläche/Material relevant (Spalte „Oberfläche" J/N). */',
    '  oberflaeche: boolean',
    '  status: ArtikelStatus',
    '  /** Reihenfolge im Dropdown — bewusst getrennt von der Artikelnummer. */',
    '  sortierung: number | null',
    '  quelle: string',
    '  bemerkung: string',
    '  /**',
    '   * Nur bei Preisart AUFSCHLAG: Satz in Prozentpunkten (5 = 5 %) bzw. Betrag in EUR.',
    '   * Optional, weil Altstände aus Supabase und alte Exporte die Felder nicht kennen.',
    '   */',
    '  aufschlag?: number | null',
    '  /** „%" oder „€" — siehe `src/lib/preisarten.ts`. */',
    '  aufschlagEinheit?: string',
    '  /** MOEBELPREIS (artikelbezogen) oder GESAMTMOEBELPREIS (Montage, Lieferung). */',
    '  aufschlagBasis?: string',
    '  /** Artikelnummer der gedruckten Preisliste bzw. des ERP (z. B. 21033 Montage). */',
    '  preislistenNr?: string',
    '}',
    '',
    '/** Eine Preiszelle: Artikel × Achsenwerte → Preis. */',
    'export interface Preiszeile {',
    '  /** Verweis auf `Artikel.artikelnummer`. */',
    '  artikel: string',
    '  /** Achsenwerte; ihre Bedeutung steht in `Artikel.achsen`. */',
    '  a: [string, string, string, string, string]',
    '  /** VK-EUR inkl. MwSt.; `null` bei `on-request`/`note`. */',
    '  preis: number | null',
    '  status: PreisStatus',
    '  /** Seite der gedruckten Preisliste (Herkunftsnachweis). */',
    '  seite: string',
    '  /** Zeilen-ID der früheren Extraktion (`src/data/priceList.json`). */',
    '  ref: number | null',
    '}',
    '',
    '/** Teileart = oberste Kategorie und zugleich der Hauptschritt im Konfigurator. */',
    'export interface Teileart {',
    '  /** Block 1 der Artikelnummer, zweistellig. */',
    '  nr: string',
    '  code: TeileartCode',
    '  reihenfolge: number',
    '  bezeichnung: string',
    '  /** Klartext des Konfigurator-Schritts. */',
    '  schritt: string',
    '}',
    '',
    '/** Dropdown = ein konkretes Auswahlfeld im Konfigurator. */',
    'export interface Dropdown {',
    '  /** Block 2 der Artikelnummer, dreistellig und systemweit eindeutig. */',
    '  nr: string',
    '  code: DropdownCode',
    '  /** Zu welchem Hauptschritt das Auswahlfeld gehört. */',
    '  teileart: TeileartCode',
    '  /** Titel des Dropdowns. */',
    '  bezeichnung: string',
    '  /** Nummernkreis-Präfix, z. B. 30-012- */',
    '  nummernkreis: string',
    '  anzahlArtikel: number | null',
    '  /** Präfix im alten Vier-Block-Schema — Brücke zur Mappe und zu Altbeständen. */',
    '  alterNummernkreis: string',
    '}',
    '/** Eine Preisart (Blatt „34 Preislogiken"): Code, Anzeigename, Kurzerklärung. */',
    'export interface Preislogik { code: PreislogikCode; bezeichnung: string; bedeutung: string }',
    '/**',
    ' * Eine Preisachse. `art` sagt, WIE der Wert gelesen wird — das ist der Kern der',
    ' * Achsen-Reform: eine cm-Stufe wird aufgerundet, eine Liste per Komma zerlegt, ein',
    ' * Text exakt verglichen, und `preisart` sagt, worauf sich der Betrag bezieht.',
    ' */',
    'export interface Achse { code: AchseCode; bedeutung: string; art: AchsenArt }',
    '',
    '/** Berater bzw. Administrator — Blatt „40 Mitarbeiter". */',
    'export interface Mitarbeiter {',
    '  personalnr: string',
    '  name: string',
    '  email: string',
    '  rolle: string',
    '  /** Verweis auf `Filiale.filialnr`. */',
    '  filiale: string',
    '  status: string',
    '  bemerkung: string',
    '}',
    '',
    'export interface Filiale {',
    '  filialnr: string',
    '  name: string',
    '  strasse: string',
    '  plz: string',
    '  ort: string',
    '  telefon: string',
    '  email: string',
    '  status: string',
    '  /** Frühere Code-ID der Filiale — löst `branchId` gespeicherter Entwürfe auf. */',
    '  altId: string',
    '}',
    '',
    'export interface Kunde {',
    '  kundennr: string',
    '  name: string',
    '  strasse: string',
    '  plz: string',
    '  ort: string',
    '  telefon: string',
    '  email: string',
    '  quelle: string',
    '  status: string',
    '}',
    '',
    '/** Ein Block der Artikelnummer, aus dem Markdown-Diagramm gelesen. */',
    'export interface ArtikelnummerBlock { name: string; laenge: number; beispiel: string }',
    '',
    '// ---------------------------------------------------------------------------',
    '// Daten',
    '// ---------------------------------------------------------------------------',
    '',
    `export const serien: readonly Serie[] = [`,
    ...xl.serienCodes.map((p) =>
      `  ${obj({ code: s(p.code), id: s(p.id), name: s(p.name), schwerpunkt: s(p.focus), position: p.position })},`,
    ),
    ']',
    '',
  )

  // --- Artikel ---------------------------------------------------------------------
  push('export const artikel: readonly Artikel[] = [')
  for (const a of xl.artikel) {
    const achsen = [1, 2, 3, 4, 5]
      .map((i) => a[`Achse ${i}`])
      .filter((x) => x && !/^\d+$/.test(x))
      .map(s)
    push(
      `  ${obj({
        artikelnummer: s(mig.nummernMap.get(a['Artikelnummer']) ?? a['Artikelnummer']),
        kurzzeichen: s(a['Kurzzeichen']),
        bezeichnung: s(a['Bezeichnung']),
        bezeichnung2: s(a['Bezeichnung 2']),
        teileart: s(a['Produktgruppe']),
        dropdown: s(a['Artikelgruppe']),
        modus: s(a['Modus']),
        preislogik: s(a['Preislogik']),
        einheit: s(a['Einheit']),
        achsenText: s(a['Achsen']),
        achsen: `[${achsen.join(', ')}]`,
        preiszellen: num(a['Preiszellen']),
        oberflaeche: String((a['Oberfläche'] ?? '').toUpperCase() === 'J'),
        status: s(a['Status']),
        sortierung: num(a['Sortierung']),
        quelle: s(a['Quelle']),
        bemerkung: s(a['Bemerkung']),
        aufschlag: num(a['Aufschlag']),
        aufschlagEinheit: s(a['Aufschlag-Einheit']),
        aufschlagBasis: s(a['Aufschlag-Basis']),
        preislistenNr: s(a['Preislisten-Nr.']),
      })},`,
    )
  }
  push(']', '')

  // --- Preise ----------------------------------------------------------------------
  push(
    '/**',
    ' * Preiszellen. Gelesen werden laut „00 Anleitung" nur Artikel, A1–A5, Preis, Status und',
    ' * Seite — die übrigen Spalten des Blattes sind Formeln auf „10 Artikel" und werden hier',
    ' * bewusst NICHT gespiegelt, damit es genau eine Quelle der Wahrheit gibt.',
    ' *',
    ' * AUFGETEILT IN BLÖCKE: Ein einziges Array-Literal dieser Größe kann der',
    ' * TypeScript-Prüfer nicht mehr prüfen — er bricht mit TS2590 („union type that is too',
    ' * complex to represent") ab. Die Grenze wurde mit den Preisgruppen-Zeilen der',
    ' * Refugium-Innenausstattung überschritten. Mehrere kleinere Literale prüft er',
    ' * einzeln; zusammengesetzt ist das Ergebnis Wert für Wert dasselbe Array.',
    ' */',
  )
  // Achsen-Bedeutung je Artikel — nötig, um eine Reparatur der richtigen Spalte zuzuordnen.
  const achsenVonArtikel = new Map(
    xl.artikel.map((a) => [
      a['Artikelnummer'],
      [1, 2, 3, 4, 5].map((i) => a[`Achse ${i}`]).filter((x) => x && !/^\d+$/.test(x)),
    ]),
  )
  const preisZeilen = xl.preise.map((p) => {
    const achsen = achsenVonArtikel.get(p['Artikel']) ?? []
    const werte = ['A1', 'A2', 'A3', 'A4', 'A5'].map((k, i) => {
      const roh = p[k] ?? ''
      const achse = achsen[i]
      if (!achse) return roh
      const fix = findeReparatur(p['Artikel'], achse, roh)
      if (!fix) return roh
      reparaturenAngewandt.push({ ...fix, zeile: p._row })
      return fix.richtig
    })
    return `  ${obj({
      artikel: s(mig.nummernMap.get(p['Artikel']) ?? p['Artikel']),
      a: `[${werte.map(s).join(', ')}]`,
      preis: num(p['Preis']),
      status: s(p['Status']),
      seite: s(p['Seite']),
      ref: num(p['Ref']),
    })},`
  })

  const BLOCK = 400
  const blockNamen = []
  for (let i = 0; i < preisZeilen.length; i += BLOCK) {
    const name = `preiseBlock${blockNamen.length + 1}`
    blockNamen.push(name)
    push(`const ${name}: readonly Preiszeile[] = [`, ...preisZeilen.slice(i, i + BLOCK), ']', '')
  }
  push(`export const preise: readonly Preiszeile[] = [`)
  for (const name of blockNamen) push(`  ...${name},`)
  push(']', '')

  // --- Wertelisten -------------------------------------------------------------------
  push(
    'export const teilearten: readonly Teileart[] = [',
    ...mig.teilearten.map((t) =>
      `  ${obj({
        nr: s(t.nr),
        code: s(t.code),
        reihenfolge: num(t.reihenfolge) ?? 0,
        bezeichnung: s(t.bezeichnung),
        schritt: s(t.schritt),
      })},`,
    ),
    ']',
    '',
    'export const dropdowns: readonly Dropdown[] = [',
    ...mig.dropdowns.map((d) =>
      `  ${obj({
        nr: s(d.nr),
        code: s(d.code),
        teileart: s(d.teileart),
        bezeichnung: s(d.bezeichnung),
        nummernkreis: s(d.nummernkreis),
        anzahlArtikel: num(d.anzahlArtikel),
        alterNummernkreis: s(d.alterNummernkreis),
      })},`,
    ),
    ']',
    '',
    'export const preislogiken: readonly Preislogik[] = [',
    ...xl.preislogiken.map((r) =>
      `  ${obj({ code: s(r['Code']), bezeichnung: s(r['Bezeichnung'] || r['Code']), bedeutung: s(r['Bedeutung']) })},`,
    ),
    ']',
    '',
    'export const achsen: readonly Achse[] = [',
    ...xl.achsen.map((r) => `  ${obj({ code: s(r['Code']), bedeutung: s(r['Bedeutung']), art: s(r['Art'] || 'text') })},`),
    ']',
    '',
  )

  // --- Personen & Orte ----------------------------------------------------------------
  push(
    `/** Berater & Administratoren — Blatt „${SHEETS.mitarbeiter}". Enthält keine Passwörter. */`,
    'export const mitarbeiter: readonly Mitarbeiter[] = [',
    ...xl.mitarbeiter.map((r) =>
      `  ${obj({
        personalnr: s(r['Personalnr']),
        name: s(r['Name']),
        email: s(r['E-Mail']),
        rolle: s((r['Rolle'] ?? '').toLowerCase()),
        filiale: s(r['Filiale']),
        status: s(r['Status']),
        bemerkung: s(r['Bemerkung']),
      })},`,
    ),
    ']',
    '',
    'export const filialen: readonly Filiale[] = [',
    ...xl.filialen.map((r) =>
      `  ${obj({
        filialnr: s(r['Filialnr']),
        name: s(r['Name']),
        strasse: s(r['Straße']),
        plz: s(r['PLZ']),
        ort: s(r['Ort']),
        telefon: s(r['Telefon']),
        email: s(r['E-Mail']),
        status: s(r['Status']),
        altId: s(r['Alt-ID']),
      })},`,
    ),
    ']',
    '',
    'export const kunden: readonly Kunde[] = [',
    ...xl.kunden.map((r) =>
      `  ${obj({
        kundennr: s(r['Kundennr']),
        name: s(r['Name']),
        strasse: s(r['Straße']),
        plz: s(r['PLZ']),
        ort: s(r['Ort']),
        telefon: s(r['Telefon']),
        email: s(r['E-Mail']),
        quelle: s(r['Quelle']),
        status: s(r['Status']),
      })},`,
    ),
    ']',
    '',
  )

  // --- Meta ----------------------------------------------------------------------------
  const sc = meta.scalars
  push(
    `/** Kopfdaten der Preisliste — Blatt „${SHEETS.meta}". */`,
    'export const meta = {',
    `  gueltigkeit: ${s(sc.validity)},`,
    `  waehrung: ${s(sc.currency)},`,
    `  mwstSatz: ${num(sc.vatRate) ?? 0},`,
    `  mwstHinweis: ${s(sc.vatNote)},`,
    `  rasterMm: ${num(sc.rasterMm) ?? 0},`,
    `  frontOffsetMm: ${num(sc.frontOffsetMm) ?? 0},`,
    '  /** Zusätzliche Korpustiefe bei Beleuchtung (Kabelführung) — Planungsmaß, keine Preisachse. */',
    `  beleuchtungTiefenzugabeMm: ${num(sc.beleuchtungTiefenzugabeMm) ?? 0},`,
    `  quelle: ${s(sc.source)},`,
    '  preisgruppen: {',
    ...Object.entries(meta.preisgruppen).map(([k, v]) => `    ${k}: ${s(v)},`),
    '  },',
    '  /** Korpushöhen-Offset je Serie in Millimetern. */',
    '  korpusOffsetMm: {',
    ...Object.entries(meta.korpusOffsetMm).map(([k, v]) => `    ${k}: ${v},`),
    '  },',
    '} as const',
    '',
  )

  // --- Artikelnummer-Logik aus dem Markdown ---------------------------------------------
  push(
    `/**`,
    ` * Aufbau der Artikelnummer — aus \`${path.basename(LOGIK_MD)}\` gelesen.`,
    ` * \`${md.beispielNummer ?? ''}\` = ${md.bloecke.map((b) => b.name).join(' · ')}`,
    ` */`,
    'export const artikelnummerLogik = {',
    // Das Muster steht in „00 Anleitung" noch im alten Vier-Block-Format. Massgeblich
        // ist das Diagramm im Markdown, aus dem auch die Bloecke stammen — sonst
        // widerspraechen sich Muster und Bloecke im selben Objekt.
        `  muster: ${s(md.bloecke.length ? md.bloecke.map((b) => (b.name === 'Teileart' ? 'TT' : b.name === 'Dropdown' ? 'DDD' : 'NNNN')).join('-') : anleitung.nummernMuster)},`,
    `  beispiel: ${s(md.beispielNummer ?? '')},`,
    `  trennzeichen: ${s('-')},`,
    '  bloecke: [',
    ...md.bloecke.map((b) => `    ${obj({ name: s(b.name), laenge: b.laenge, beispiel: s(b.beispiel) })},`),
    '  ] as ArtikelnummerBlock[],',
    '  beispiele: [',
    ...md.beispiele.map((b) =>
      `    ${obj({ artikelnummer: s(b.artikelnummer), kurzzeichen: s(b.kurzzeichen), bezeichnung: s(b.bezeichnung), achsen: s(b.achsen) })},`,
    ),
    '  ],',
    '} as const',
    '',
  )

  return L.join('\n')
}

// ---------------------------------------------------------------------------

function main() {
  const check = process.argv.includes('--check')
  console.log(c.bold('\nSCHRITT 3 — Stammdaten-Modul erzeugen'))

  const xl = ladeExcel()
  const mig = baueNummernMigration(xl)
  const md = ladeMarkdown()
  const anleitung = ladeAnleitung(xl.anleitung)
  const meta = ladeMeta(xl.metaRows)
  pruefe(xl, md)

  const code = erzeugeModul(xl, md, anleitung, meta, mig)

  console.log(c.dim(`  ${path.basename(STAMMDATEN_XLSX)}`))
  console.log(
    `    ${xl.artikel.length} Artikel · ${xl.preise.length} Preiszeilen · ${xl.serienCodes.length} Serien · ` +
      `${mig.teilearten.length} Teilearten · ${mig.dropdowns.length} Dropdowns`,
  )
  console.log(`    ${xl.mitarbeiter.length} Mitarbeiter · ${xl.filialen.length} Filialen · ${xl.kunden.length} Kunden`)
  console.log(c.dim(`  ${path.basename(LOGIK_MD)}`))
  console.log(
    `    ${md.bloecke.length} Nummern-Blöcke (${md.bloecke.map((b) => b.name).join(' · ')}) · ` +
      `${md.beispiele.length} Beispiele`,
  )

  if (reparaturenAngewandt.length) {
    const jeRegel = new Map()
    for (const r of reparaturenAngewandt) {
      const key = `${r.artikel}|${r.achse}|${r.falsch}`
      jeRegel.set(key, (jeRegel.get(key) ?? 0) + 1)
    }
    console.log(c.yellow(`\n  ${reparaturenAngewandt.length} Achsenwerte beim Erzeugen korrigiert (die Mappe selbst ist noch unverändert):`))
    for (const regel of ACHSEN_REPARATUREN) {
      const n = jeRegel.get(`${regel.artikel}|${regel.achse}|${regel.falsch}`) ?? 0
      if (n === 0) continue
      console.log(c.yellow(`    • ${regel.artikel} ${regel.achse}: "${regel.falsch}" → "${regel.richtig}" (${n}×) — ${regel.beleg}`))
    }
    console.log(c.dim('    Dauerhaft übernehmen: npm run data:fix-achsen'))
  } else if (ACHSEN_REPARATUREN.length > 0) {
    console.log(c.green('\n  ✓ Keine Achsen-Korrektur nötig — die Mappe ist bereinigt (scripts/lib/achsen-reparatur.js kann entfallen).'))
  }

  if (warnings.length) {
    console.log(c.yellow(`\n  ${warnings.length} Hinweis(e) aus der Kreuzprüfung:`))
    for (const w of warnings.slice(0, 25)) console.log(c.yellow(`    • ${w}`))
    if (warnings.length > 25) console.log(c.yellow(`    … und ${warnings.length - 25} weitere`))
  } else {
    console.log(c.green('\n  ✓ Kreuzprüfung ohne Befund (Excel ↔ Markdown ↔ Referenzen)'))
  }

  if (check) {
    console.log(c.yellow('\n  --check: nichts geschrieben.\n'))
    return
  }

  mkdirSync(path.dirname(OUT), { recursive: true })
  writeFileSync(OUT, code + '\n', 'utf8')
  const kb = Math.round(Buffer.byteLength(code) / 1024)
  console.log(c.green(`\n  Geschrieben: src/data/${path.basename(OUT)} (${kb} KB, ${code.split('\n').length} Zeilen)\n`))
}

try {
  main()
} catch (err) {
  console.error(c.red(`\nFEHLER: ${err.message}\n`))
  if (process.env.DEBUG) console.error(err.stack)
  process.exitCode = 1
}
