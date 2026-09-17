import { readFileSync } from 'node:fs'
import { STAMMDATEN_XLSX, SHEETS } from '../lib/paths.js'
import { openWorkbook, readSheet, readTable } from '../lib/xlsx-raw.js'
const wb = openWorkbook(readFileSync(STAMMDATEN_XLSX))
for (const name of [SHEETS.artikel, SHEETS.artikelgruppen]) {
  const sh = readSheet(wb, name)
  const mitFormel = []
  for (const [row, cells] of sh) for (const [col, c] of Object.entries(cells)) if (c.f) mitFormel.push(`${col}${row}: ${c.f.slice(0,60)}`)
  console.log(`${name}: ${mitFormel.length} Formelzellen`, mitFormel.slice(0,3).join(' | '))
}
const t = readTable(wb, SHEETS.artikel)
console.log('Spaltenbuchstaben:', [...t.header].map(([k,v])=>`${v}=${k}`).join(' '))
