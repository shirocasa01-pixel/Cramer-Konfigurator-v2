import { readFileSync } from 'node:fs'
import { STAMMDATEN_XLSX, SHEETS } from '../lib/paths.js'
import { openWorkbook, readTable } from '../lib/xlsx-raw.js'
const wb = openWorkbook(readFileSync(STAMMDATEN_XLSX))
const art = readTable(wb, SHEETS.artikel).rows
const pr = readTable(wb, SHEETS.preise).rows
const ag = readTable(wb, SHEETS.artikelgruppen).rows
const byArt = new Map()
for (const p of pr) { const k=p['Artikel']; if(!byArt.has(k)) byArt.set(k,[]); byArt.get(k).push(p) }
const AX=['Achse 1','Achse 2','Achse 3','Achse 4','Achse 5']
console.log('### Artikel mit AUSFUEHRUNG-Achse')
for (const a of art) {
  const achsen = AX.map(k=>(a[k]??'').trim())
  const i = achsen.indexOf('AUSFUEHRUNG')
  if (i < 0) continue
  const zs = byArt.get(a['Artikelnummer'])??[]
  const werte = []
  for (const z of zs) { const v=(z['A'+(i+1)]??'').trim(); if(v && !werte.includes(v)) werte.push(v) }
  console.log(`${a['Artikelnummer']} ${a['Kurzzeichen']} | ${a['Artikelgruppe']} | Sort=${a['Sortierung']} | Status=${a['Status']} | ${zs.length}Z | ${a['Bezeichnung']}`)
  werte.forEach((w,n)=>console.log(`    [${n}] "${w}"  (${zs.filter(z=>(z['A'+(i+1)]??'').trim()===w).length} Zeilen)`))
}
console.log('\n### Nummernkreise & hoechste Laufnummer je Artikelgruppe')
const maxLauf = new Map()
for (const a of art) {
  const g = a['Artikelgruppe']; const lauf = Number(String(a['Artikelnummer']).split('-')[3])
  if (Number.isFinite(lauf)) maxLauf.set(g, Math.max(maxLauf.get(g)??0, lauf))
}
for (const g of ['CONTAINER','SOCKELPLATTE','KLAPPE','PORTICUS_MODELL','SUPERSONUS_MODELL','SCHLOSS']) {
  const r = ag.find(x=>x['Code']===g)
  console.log(`${g}: Nummernkreis=${r?.['Nummernkreis']} Artikel=${r?.['Artikel']} maxLauf=${maxLauf.get(g)}`)
}
console.log('\n### Artikelgruppen-Spalten:', JSON.stringify(Object.keys(ag[0]||{})))
