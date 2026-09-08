/**
 * Minimale, abhängigkeitsarme XLSX-Schicht (nur `fflate` fürs ZIP).
 *
 * Warum nicht SheetJS/ExcelJS: `Cramer-Stammdaten.xlsx` enthält 12.072 INDEX/MATCH-Formeln,
 * Autofilter, Zellformate (graue Formelspalten), Drawings und benannte Bereiche. Ein
 * Round-Trip durch eine Tabellen-Bibliothek schreibt die Mappe komplett neu und verliert
 * dabei zuverlässig einen Teil davon. Dieser Layer fasst stattdessen **nur die Zellen an,
 * die sich ändern** — alle übrigen ZIP-Einträge bleiben Byte-identisch.
 *
 * Bewusst kein vollständiger XLSX-Parser: gelesen wird, was die Stammdatenmappe braucht
 * (Werte, Formeln, Shared Strings). Formatierung wird nicht interpretiert, sondern erhalten.
 */

import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate'
import { writeFileSync } from 'node:fs'

// ---------------------------------------------------------------------------
// XML-Hilfen
// ---------------------------------------------------------------------------

/** Entschärft die fünf XML-Entities + numerische Referenzen. */
export function xmlUnescape(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
}

export function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** `"H12"` → `"H"` */
export function colOf(ref) {
  return /^([A-Z]+)/.exec(ref)?.[1] ?? ''
}

// ---------------------------------------------------------------------------
// Mappe öffnen
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Workbook
 * @property {Record<string, Uint8Array>} files   alle ZIP-Einträge (unveränderte Rohdaten)
 * @property {Map<string, string>} sheetPath      Blattname -> Pfad im ZIP
 * @property {string[]} sharedStrings             aufgelöste Shared-String-Tabelle
 */

/** Liest die Mappe aus einem Buffer und löst Blattnamen -> ZIP-Pfad auf. */
export function openWorkbook(buffer) {
  const files = unzipSync(new Uint8Array(buffer))

  const workbookXml = strFromU8(files['xl/workbook.xml'])
  const relsXml = strFromU8(files['xl/_rels/workbook.xml.rels'])

  /** rId -> Ziel-Pfad */
  const rels = new Map()
  for (const m of relsXml.matchAll(/<Relationship\b([^>]*)>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[1])?.[1]
    const target = /\bTarget="([^"]+)"/.exec(m[1])?.[1]
    if (id && target) rels.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target}`)
  }

  const sheetPath = new Map()
  for (const m of workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = /\bname="([^"]+)"/.exec(m[1])?.[1]
    const rid = /\br:id="([^"]+)"/.exec(m[1])?.[1]
    if (name && rid && rels.has(rid)) sheetPath.set(xmlUnescape(name), rels.get(rid))
  }

  const sharedStrings = []
  /** Roh-XML jedes <si> – wird beim Speichern unverändert zurückgeschrieben, damit
   *  Rich-Text-Runs und Phonetik nicht durch das Flachklopfen verloren gehen. */
  const sharedStringsRaw = []
  /** Ursprüngliches count-Attribut (Anzahl Verweise, nicht Einträge) – bleibt gültig,
   *  weil dieser Layer Verweise nur ersetzt und keine Zellen hinzufügt. */
  let sharedStringsCount = null

  const ssPath = 'xl/sharedStrings.xml'
  if (files[ssPath]) {
    const ssXml = strFromU8(files[ssPath])
    sharedStringsCount = /<sst\b[^>]*\bcount="(\d+)"/.exec(ssXml)?.[1] ?? null
    for (const si of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      // <si> kann in mehrere <r>-Runs zerfallen (Rich Text) – Textknoten zusammensetzen.
      sharedStrings.push([...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => xmlUnescape(t[1])).join(''))
      sharedStringsRaw.push(si[1])
    }
  }

  return { files, sheetPath, sharedStrings, sharedStringsRaw, sharedStringsCount }
}

/** Rohes Blatt-XML per Blattname. */
export function sheetXml(wb, name) {
  const path = wb.sheetPath.get(name)
  if (!path) throw new Error(`Blatt "${name}" nicht in der Mappe (vorhanden: ${[...wb.sheetPath.keys()].join(', ')})`)
  return strFromU8(wb.files[path])
}

export function setSheetXml(wb, name, xml) {
  wb.files[wb.sheetPath.get(name)] = strToU8(xml)
}

// ---------------------------------------------------------------------------
// Blatt lesen
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Cell
 * @property {string} ref            z. B. "H2"
 * @property {string|undefined} t    Zelltyp laut OOXML (`s`, `str`, `n`, `inlineStr`, `b`, …)
 * @property {string|undefined} f    Formel ohne führendes "="
 * @property {string} v              aufgelöster Textwert ("" wenn leer)
 */

/**
 * Liest ein Blatt als `Map<Zeilennummer, Record<Spaltenbuchstabe, Cell>>`.
 * Leere Zellen fehlen — wie in der Datei.
 */
export function readSheet(wb, name) {
  const xml = sheetXml(wb, name)
  const rows = new Map()

  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNum = Number(/\br="(\d+)"/.exec(rowMatch[1])?.[1])
    if (!rowNum) continue
    const cells = {}

    for (const cm of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1]
      const body = cm[2] ?? ''
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1]
      if (!ref) continue
      const t = /\bt="([^"]+)"/.exec(attrs)?.[1]
      const f = /<f\b[^>]*>([\s\S]*?)<\/f>/.exec(body)?.[1]
      const vRaw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]

      let v = ''
      if (t === 's') {
        v = wb.sharedStrings[Number(vRaw)] ?? ''
      } else if (t === 'inlineStr') {
        const is = /<is>([\s\S]*?)<\/is>/.exec(body)?.[1] ?? ''
        v = [...is.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => xmlUnescape(x[1])).join('')
      } else if (vRaw != null) {
        v = xmlUnescape(vRaw)
      }

      cells[colOf(ref)] = { ref, t, f: f ? xmlUnescape(f) : undefined, v }
    }
    rows.set(rowNum, cells)
  }
  return rows
}

/**
 * Liest ein Blatt als Objekt-Liste, Kopfzeile = Spaltennamen.
 * Rückgabe: `{ header: Map<Spaltenname, Spaltenbuchstabe>, rows: Array<{ _row, [name]: string }> }`
 */
export function readTable(wb, name, headerRow = 1) {
  const sheet = readSheet(wb, name)
  const header = new Map()
  for (const [col, cell] of Object.entries(sheet.get(headerRow) ?? {})) {
    const label = cell.v.trim()
    if (label) header.set(label, col)
  }

  const rows = []
  for (const [rowNum, cells] of [...sheet].sort((a, b) => a[0] - b[0])) {
    if (rowNum <= headerRow) continue
    const rec = { _row: rowNum }
    let empty = true
    for (const [label, col] of header) {
      const v = cells[col]?.v ?? ''
      rec[label] = v
      if (v !== '') empty = false
    }
    if (!empty) rows.push(rec)
  }
  return { header, rows }
}

// ---------------------------------------------------------------------------
// Blatt schreiben (chirurgisch – nur die genannten Zellen)
// ---------------------------------------------------------------------------

/** Findet das komplette `<c …>…</c>`-Element einer Zelle (auch selbstschließend). */
function cellRegex(ref) {
  return new RegExp(`<c\\b[^>]*?\\br="${ref}"(?:\\s[^>]*?)?(?:/>|>[\\s\\S]*?</c>)`)
}

/** Übernimmt `r` und `s` (Zellformat) aus dem alten Element; alles andere wird neu gesetzt. */
function keepRefAndStyle(oldEl, ref) {
  const s = /\bs="(\d+)"/.exec(oldEl)?.[1]
  return `r="${ref}"${s != null ? ` s="${s}"` : ''}`
}

/**
 * Setzt einen Text in eine Zelle — als Shared String, damit die Datei idiomatisch bleibt.
 * Zellformat (`s`) bleibt erhalten. Gibt `false` zurück, wenn die Zelle nicht existiert.
 */
export function setCellString(sheetState, ref, text) {
  const re = cellRegex(ref)
  const m = re.exec(sheetState.xml)
  if (!m) return false
  const idx = internSharedString(sheetState.wb, text)
  sheetState.xml = sheetState.xml.replace(re, `<c ${keepRefAndStyle(m[0], ref)} t="s"><v>${idx}</v></c>`)
  return true
}

/**
 * Aktualisiert **nur den zwischengespeicherten Wert** einer Formelzelle; die Formel bleibt
 * unangetastet. Nötig, weil `20 Preise` die Merkmale per INDEX/MATCH spiegelt und der
 * gecachte Wert sonst bis zur nächsten Neuberechnung veraltet wäre.
 */
export function setFormulaCachedString(sheetState, ref, text) {
  const re = cellRegex(ref)
  const m = re.exec(sheetState.xml)
  if (!m || !/<f\b/.test(m[0])) return false
  const formula = /<f\b[^>]*>[\s\S]*?<\/f>|<f\b[^>]*\/>/.exec(m[0])?.[0]
  if (!formula) return false
  sheetState.xml = sheetState.xml.replace(
    re,
    `<c ${keepRefAndStyle(m[0], ref)} t="str">${formula}<v>${xmlEscape(text)}</v></c>`,
  )
  return true
}

/** Öffnet ein Blatt zum Bearbeiten. `commit()` schreibt es in die Mappe zurück. */
export function editSheet(wb, name) {
  const state = { wb, name, xml: sheetXml(wb, name) }
  state.commit = () => setSheetXml(wb, name, state.xml)
  return state
}

/** Spaltenbuchstabe → 1-basierter Index („A" → 1, „AA" → 27). */
export function colIndex(col) {
  let n = 0
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

/** 1-basierter Index → Spaltenbuchstabe. */
export function indexToCol(n) {
  let s = ''
  while (n > 0) {
    const rest = (n - 1) % 26
    s = String.fromCharCode(65 + rest) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/**
 * Setzt einen Text in eine Zelle und LEGT SIE AN, falls sie noch nicht existiert
 * (leere Zellen fehlen in der Datei schlicht). Zellformat wird von der Nachbarzelle
 * links bzw. der Vorgängerzeile übernommen, damit die Spalte einheitlich aussieht.
 */
export function setOrCreateCellString(sheetState, ref, text) {
  if (setCellString(sheetState, ref, text)) return true

  const col = colOf(ref)
  const rowNum = Number(ref.slice(col.length))
  const rowRe = new RegExp(`<row\\b[^>]*\\br="${rowNum}"[^>]*>[\\s\\S]*?</row>`)
  const rowMatch = rowRe.exec(sheetState.xml)
  if (!rowMatch) return false

  // Zellformat von einer beliebigen Zelle derselben Zeile erben.
  const style = /<c\b[^>]*?\bs="(\d+)"/.exec(rowMatch[0])?.[1]
  const idx = internSharedString(sheetState.wb, text)
  const cell = `<c r="${ref}"${style != null ? ` s="${style}"` : ''} t="s"><v>${idx}</v></c>`

  // An der richtigen Stelle einsortieren – Zellen müssen nach Spalte geordnet stehen.
  const target = colIndex(col)
  const cells = [...rowMatch[0].matchAll(/<c\b[^>]*?\br="([A-Z]+)\d+"(?:\s[^>]*?)?(?:\/>|>[\s\S]*?<\/c>)/g)]
  const after = cells.find((m) => colIndex(m[1]) > target)
  const updated = after
    ? rowMatch[0].replace(after[0], cell + after[0])
    : rowMatch[0].replace('</row>', `${cell}</row>`)

  sheetState.xml = sheetState.xml.replace(rowRe, updated)
  return true
}

/**
 * Hängt eine Zeile ans Blattende an. `values` ist eine Map Spaltenbuchstabe → Text;
 * leere Werte werden übersprungen. Zellformate werden aus der letzten Datenzeile
 * übernommen, `<dimension>` wird mitgezogen.
 *
 * @returns die neue Zeilennummer
 */
export function appendRow(sheetState, values) {
  const rowNums = [...sheetState.xml.matchAll(/<row\b[^>]*\br="(\d+)"/g)].map((m) => Number(m[1]))
  const lastRow = rowNums.length ? Math.max(...rowNums) : 0
  const newRow = lastRow + 1

  // Zellformate der letzten Zeile als Vorlage – sonst fällt die neue Zeile optisch heraus.
  const lastRowXml = new RegExp(`<row\\b[^>]*\\br="${lastRow}"[^>]*>[\\s\\S]*?</row>`).exec(sheetState.xml)?.[0] ?? ''
  const styleByCol = new Map()
  for (const m of lastRowXml.matchAll(/<c\b[^>]*?\br="([A-Z]+)\d+"[^>]*?\bs="(\d+)"/g)) {
    styleByCol.set(m[1], m[2])
  }
  const fallbackStyle = [...styleByCol.values()][0]

  const cells = Object.entries(values)
    .filter(([, v]) => v != null && String(v) !== '')
    .sort((a, b) => colIndex(a[0]) - colIndex(b[0]))
    .map(([col, v]) => {
      const style = styleByCol.get(col) ?? fallbackStyle
      const idx = internSharedString(sheetState.wb, String(v))
      return `<c r="${col}${newRow}"${style != null ? ` s="${style}"` : ''} t="s"><v>${idx}</v></c>`
    })
    .join('')

  const rowXml = `<row r="${newRow}" customFormat="false" ht="15" hidden="false" customHeight="false" outlineLevel="0" collapsed="false">${cells}</row>`
  sheetState.xml = sheetState.xml.replace('</sheetData>', `${rowXml}</sheetData>`)

  // <dimension> nachziehen, damit Excel den benutzten Bereich korrekt kennt.
  sheetState.xml = sheetState.xml.replace(/<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/, (all, c1, r1, c2, r2) => {
    const maxCol = Math.max(
      colIndex(c2),
      ...Object.keys(values).filter((k) => values[k] != null && String(values[k]) !== '').map(colIndex),
    )
    return `<dimension ref="${c1}${r1}:${indexToCol(maxCol)}${Math.max(Number(r2), newRow)}"/>`
  })

  return newRow
}

/** Liefert den Shared-String-Index für `text` und legt ihn bei Bedarf neu an. */
export function internSharedString(wb, text) {
  const existing = wb.sharedStrings.indexOf(text)
  if (existing >= 0) return existing
  wb.sharedStrings.push(text)
  wb.sharedStringsRaw.push(`<t xml:space="preserve">${xmlEscape(text)}</t>`)
  wb._sharedStringsDirty = true
  return wb.sharedStrings.length - 1
}

/**
 * Sorgt dafür, dass Excel/LibreOffice die Mappe beim Öffnen komplett neu berechnet.
 * Absicherung für die 12.072 Spiegel-Formeln.
 */
export function forceFullCalcOnLoad(wb) {
  let xml = strFromU8(wb.files['xl/workbook.xml'])
  if (/<calcPr\b[^>]*\bfullCalcOnLoad="1"/.test(xml)) return
  xml = /<calcPr\b/.test(xml)
    ? xml.replace(/<calcPr\b([^>]*?)(\/?)>/, (_, attrs, slash) => `<calcPr${attrs} fullCalcOnLoad="1"${slash}>`)
    : xml.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>')
  wb.files['xl/workbook.xml'] = strToU8(xml)
}

// ---------------------------------------------------------------------------
// Mappe speichern
// ---------------------------------------------------------------------------

/**
 * Schreibt die (ggf. erweiterte) Shared-String-Tabelle zurück. Bestehende Einträge gehen
 * als unveränderte Roh-XML wieder raus — nur neu angelegte Strings kommen hinzu.
 */
function flushSharedStrings(wb) {
  if (!wb._sharedStringsDirty) return
  const body = wb.sharedStringsRaw.map((raw) => `<si>${raw}</si>`).join('')
  const xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    `count="${wb.sharedStringsCount ?? wb.sharedStrings.length}" uniqueCount="${wb.sharedStrings.length}">${body}</sst>`
  wb.files['xl/sharedStrings.xml'] = strToU8(xml)
  wb._sharedStringsDirty = false
}

/**
 * Schreibt eine Datei und wiederholt es bei kurzzeitiger Sperre.
 *
 * Das Projekt liegt in einem OneDrive-Ordner: der Sync-Client hält die Datei nach jeder
 * Änderung für den Bruchteil einer Sekunde offen und quittiert einen Schreibversuch mit
 * `EBUSY`/`EPERM`. Ein einzelner Fehlschlag ist deshalb kein Grund aufzugeben — hält die
 * Sperre dagegen an (Datei in Excel geöffnet), kommt der Fehler mit klarem Hinweis durch.
 */
export function writeFileWithRetry(file, data, versuche = 60, pauseMs = 500) {
  for (let i = 1; ; i++) {
    try {
      writeFileSync(file, data)
      return i
    } catch (err) {
      const transient = err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES'
      if (!transient || i >= versuche) {
        if (transient) {
          throw new Error(
            `${file} ist dauerhaft gesperrt (${err.code}). Ist die Mappe in Excel geöffnet? ` +
              `Bitte schließen und erneut ausführen.`,
          )
        }
        throw err
      }
      // Kurz blockierend warten – die Scripts sind synchron aufgebaut.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, pauseMs)
    }
  }
}

/** Packt die Mappe wieder zu einem XLSX-Buffer. `[Content_Types].xml` kommt laut OPC zuerst. */
export function saveWorkbook(wb) {
  flushSharedStrings(wb)
  const ordered = {}
  if (wb.files['[Content_Types].xml']) ordered['[Content_Types].xml'] = wb.files['[Content_Types].xml']
  for (const [name, data] of Object.entries(wb.files)) {
    if (name !== '[Content_Types].xml') ordered[name] = data
  }
  return Buffer.from(zipSync(ordered, { level: 6 }))
}
