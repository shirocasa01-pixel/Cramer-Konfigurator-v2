/**
 * Kleiner Markdown-Leser für die ergänzende Logik-Datei.
 *
 * Bewusst kein vollständiger Parser: gebraucht werden Überschriften-Abschnitte,
 * GFM-Tabellen und Code-Blöcke. Alles davon ist zeilenweise erkennbar.
 */

/**
 * Zerlegt ein Dokument in Abschnitte entlang der `#`-Überschriften.
 * @returns {Array<{level: number, title: string, body: string, lines: string[]}>}
 */
export function splitSections(markdown) {
  const lines = markdown.split(/\r?\n/)
  const sections = []
  let current = { level: 0, title: '', lines: [] }
  let inFence = false

  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence
    const heading = !inFence && /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      sections.push(current)
      current = { level: heading[1].length, title: heading[2].trim(), lines: [] }
    } else {
      current.lines.push(line)
    }
  }
  sections.push(current)

  return sections.map((s) => ({ ...s, body: s.lines.join('\n') }))
}

/** Erster Abschnitt, dessen Titel `pattern` erfüllt. */
export function findSection(sections, pattern) {
  const test = pattern instanceof RegExp ? (t) => pattern.test(t) : (t) => t.includes(pattern)
  return sections.find((s) => test(s.title))
}

/** Zerlegt eine Tabellenzeile `| a | b |` in ihre Zellen. */
function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

/** Trennzeile einer GFM-Tabelle: `|---|:--:|` */
function isDelimiter(line) {
  return /^\s*\|?[\s:-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes('-')
}

/**
 * Findet alle GFM-Tabellen in einem Textblock.
 * @returns {Array<{headers: string[], rows: Array<Record<string, string>>}>}
 */
export function parseTables(body) {
  const lines = body.split(/\r?\n/)
  const tables = []

  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].includes('|') || !isDelimiter(lines[i + 1])) continue

    const headers = splitRow(lines[i])
    const rows = []
    let j = i + 2
    for (; j < lines.length && lines[j].includes('|') && lines[j].trim() !== ''; j++) {
      const cells = splitRow(lines[j])
      const rec = {}
      headers.forEach((h, k) => {
        rec[h] = cells[k] ?? ''
      })
      rows.push(rec)
    }
    tables.push({ headers, rows })
    i = j - 1
  }
  return tables
}

/** Inhalt aller ``` -Blöcke eines Abschnitts. */
export function parseCodeBlocks(body) {
  return [...body.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1].replace(/\n$/, ''))
}

/** Entfernt Markdown-Auszeichnung (`**fett**`, `*kursiv*`, `` `code` ``) aus einer Zelle. */
export function plain(text) {
  return String(text ?? '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim()
}
