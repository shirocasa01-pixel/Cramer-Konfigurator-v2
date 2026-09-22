#!/usr/bin/env node
/**
 * SUPABASE-OVERRIDES — Abgleich mit den Preisarten (Überarbeitung 09/2026).
 *
 * Liest `stammdaten_overrides` (nur lesend), vergleicht jede Zeile mit dem Excel-Stand
 * und teilt sie in zwei Gruppen:
 *
 *   ENTFERNEN   Altstände, die den neuen Regeln widersprechen oder nichts mehr ändern.
 *               Jede Zeile wird vor dem Löschen erneut geprüft: Hat sie inzwischen jemand
 *               geändert (andere Version, anderer Inhalt), bleibt sie stehen.
 *   BEHALTEN    bewusste Änderungen eines Administrators — auch wenn sie der Preisliste
 *               widersprechen. Sie werden nur gemeldet; entscheiden muss Cramer.
 *
 *   node scripts/bereinige-overrides-preisarten.js              (nur anzeigen)
 *   node scripts/bereinige-overrides-preisarten.js --ausfuehren (sichern + entfernen)
 *
 * Die entfernten Zeilen landen vollständig in `supabase/override-bereinigung-preisarten.json`
 * und lassen sich von dort wieder einspielen.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { artikel, preise } from '../src/data/stammdaten.generated.ts'

const HIER = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(HIER, '..')
const SICHERUNG = path.join(APP, 'supabase', 'override-bereinigung-preisarten.json')
const ausfuehren = process.argv.includes('--ausfuehren')

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
}

function env() {
  const datei = path.join(APP, '.env.local')
  if (!existsSync(datei)) throw new Error('.env.local fehlt — ohne Supabase-Zugang nichts zu prüfen.')
  const werte = Object.fromEntries(
    readFileSync(datei, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
  )
  return { url: werte.VITE_SUPABASE_URL, key: werte.VITE_SUPABASE_ANON_KEY }
}

const { url, key } = env()
const kopf = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

async function ladeOverrides() {
  const r = await fetch(`${url}/rest/v1/stammdaten_overrides?select=*&order=bereich,schluessel`, { headers: kopf })
  if (!r.ok) throw new Error(`Supabase: ${r.status} ${await r.text()}`)
  return r.json()
}

const artikelNach = new Map(artikel.map((a) => [a.artikelnummer, a]))
const unterschiede = (basis, daten) =>
  Object.entries(daten ?? {}).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(basis?.[k])).map(([k]) => k)
const rasterEtikett = (w) => /\|\s*([\d,]+R)\s*$/.exec(w ?? '')?.[1]

/**
 * DIE ENTSCHEIDUNGEN — je Zeile eine Begründung. Was hier nicht steht, bleibt.
 * `passt` prüft, dass die Zeile noch genau der Altstand ist, der analysiert wurde.
 */
const ENTFERNEN = [
  {
    bereich: 'artikel',
    schluessel: '90-037-0001',
    grund:
      'Raumteiler: Altstand „entwurf" mit Preislogik AUF_ANFRAGE und der Bemerkung „wird NICHT mehr automatisch kalkuliert". Widerspricht der Vorgabe (Raumteiler als Aufschlag) — der Aufschlag wäre sonst „auf Anfrage". Satz 5 % steht jetzt im Artikel.',
    passt: (z) => z.daten?.status === 'entwurf' && z.daten?.preislogik === 'AUF_ANFRAGE',
  },
  {
    bereich: 'artikel',
    schluessel: '90-037-0004',
    grund:
      'Sichtrückwand: derselbe Altstand wie der Raumteiler (entwurf, AUF_ANFRAGE, veraltete Bemerkung). Satz 10 % steht jetzt im Artikel.',
    passt: (z) => z.daten?.status === 'entwurf' && z.daten?.preislogik === 'AUF_ANFRAGE',
  },
  {
    bereich: 'artikel',
    schluessel: '10-004-0001',
    grund: 'Abdeckplatte: einzige Abweichung ist der gestrichene Code MATRIX_AUF — sonst identisch mit der Mappe.',
    passt: (z) => unterschiede(artikelNach.get(z.schluessel), z.daten).join() === 'preislogik' && z.daten.preislogik === 'MATRIX_AUF',
  },
  {
    bereich: 'artikel',
    schluessel: '20-009-0001',
    grund: 'Schublade: identisch mit der Mappe bis auf den früheren Code MATRIX — ändert nichts, würde aber künftige Pflege in der Mappe verdecken.',
    passt: (z) => unterschiede(artikelNach.get(z.schluessel), z.daten).every((k) => k === 'preislogik') && z.daten.preislogik === 'MATRIX',
  },
  {
    bereich: 'artikel',
    schluessel: '40-017-0018',
    grund: 'Aufpreis Rauchglas: identisch mit der Mappe (dort ebenfalls gesperrt) — ohne Wirkung.',
    passt: (z) => unterschiede(artikelNach.get(z.schluessel), z.daten).length === 0,
  },
]

/**
 * Drehtür-Zeilen „102,1 / 114,9 / 191,2 / 230,1 cm": 80 neu angelegte Zeilen, Betrag für
 * Betrag gleich den Mappenzeilen derselben Rasterstufe (102 / 114 / 191 / 230 cm). Sie
 * verschieben nur die Stufengrenze um Millimeter — doppelte Preiszeilen, keine Änderung.
 */
function istDrehtuerDoppel(z) {
  if (z.bereich !== 'preise' || z.aktion !== 'neu' || z.daten?.artikel !== '20-006-0001') return false
  const d = z.daten
  if (!/^(102,1|114,9|191,2|230,1) cm \|/.test(d.a[1])) return false
  const zwilling = preise.find(
    (p) => p.artikel === d.artikel && p.a[0] === d.a[0] && rasterEtikett(p.a[1]) === rasterEtikett(d.a[1]) && p.a[2] === d.a[2],
  )
  return Boolean(zwilling && zwilling.preis === d.preis && zwilling.a[1] !== d.a[1])
}

/** Bewusste Änderungen, die bleiben — mit dem, was an ihnen offen ist. */
const BEHALTEN = {
  'artikel/30-012-0001':
    'Edge-Griff: Staffel 100/200/300 cm → 40/80/120 € (je angefangenem Meter) statt 40 €/lfm maßgenau laut Preisliste S. 3. Bewusst angelegt — bitte bestätigen, welche Rechnung gilt.',
  'preise/30-012-0001': 'gehört zur Edge-Staffel (siehe oben).',
  'artikel/40-020-0003':
    'KMK-Wandtablar: als Festpreis 255 € gepflegt; die Preisliste S. 33 nennt 75 € + 180 €/lfm (Festpreis + Matrix). Nicht im Konfigurator verwendet — bitte bestätigen.',
  'preise/40-020-0003': 'gehört zum Wandtablar (siehe oben).',
  'artikel/50-027-0001':
    'Hintere Aufkantung: als Festpreis ohne Achsen gepflegt (45 € je Stück); die Preisliste S. 32 nennt 45 €/lfd.m. Nicht im Konfigurator verwendet — bitte bestätigen.',
  'artikel/40-017-0029':
    'Container 4,5 R/6 R mit Rauchglas-Deckplatte: gesperrt. Der Konfigurator bietet die Option an — mit Sperre steht die Position „auf Anfrage". Bitte bestätigen, ob die Sperre gewollt ist.',
  'artikel/40-020-0001': 'Anlehnleiter & Relingsystem: „entwurf" mit Bemerkung „in arbeit" — bewusst, bleibt.',
  'artikel/90-037-0005': 'Sonderprogrammierungen: „entwurf" (nach Aufwand) — passt zur Preisart „Auf Anfrage", bleibt.',
  'artikel/90-037-0006': 'Überhöhe: gesperrt — richtig, der 20-%-Aufschlag steckt bereits in den 21-Raster-Preisen.',
  'artikel/90-037-0007': 'Wandhängende Kastenmöbel: „entwurf" — Prozent-Artikel bleiben „Auf Anfrage", bleibt.',
  'artikel/90-037-0008': 'Wandhängende Kastenmöbel: „entwurf" — wie oben, bleibt.',
}

async function main() {
  console.log(c.bold('\nSupabase-Overrides — Abgleich mit den Preisarten'))
  const zeilen = await ladeOverrides()
  console.log(c.dim(`  ${zeilen.length} Zeilen in stammdaten_overrides`))

  const entfernen = []
  const uebersprungen = []
  for (const regel of ENTFERNEN) {
    const z = zeilen.find((x) => x.bereich === regel.bereich && x.schluessel === regel.schluessel)
    if (!z) continue
    if (regel.passt(z)) entfernen.push({ zeile: z, grund: regel.grund })
    else uebersprungen.push(`${z.bereich}/${z.schluessel} — Inhalt weicht vom analysierten Altstand ab, bleibt stehen`)
  }
  const drehtuer = zeilen.filter(istDrehtuerDoppel)
  for (const z of drehtuer) {
    entfernen.push({ zeile: z, grund: 'Drehtür: doppelte Preiszeile (gleicher Betrag wie die Mappenzeile derselben Rasterstufe).' })
  }

  console.log(c.bold('\n  ENTFERNEN'))
  for (const e of entfernen.filter((e) => e.zeile.bereich !== 'preise')) {
    console.log(`    ${c.red('−')} ${e.zeile.bereich}/${e.zeile.schluessel} (v${e.zeile.version})\n      ${c.dim(e.grund)}`)
  }
  if (drehtuer.length) console.log(`    ${c.red('−')} ${drehtuer.length} × preise/20-006-0001 (Drehtür 8/9/15/18 R, doppelt)`)

  console.log(c.bold('\n  BEHALTEN (bewusst gepflegt — Rückfrage)'))
  const entfernteSchluessel = new Set(entfernen.map((e) => `${e.zeile.bereich}/${e.zeile.schluessel}`))
  const gemeldet = new Set()
  for (const z of zeilen) {
    const k = `${z.bereich}/${z.schluessel}`
    if (entfernteSchluessel.has(k)) continue
    const nr = z.bereich === 'preise' ? z.daten?.artikel ?? z.schluessel.split('#')[0] : z.schluessel
    const text = BEHALTEN[`${z.bereich}/${nr}`]
    const id = `${z.bereich}/${nr}`
    if (gemeldet.has(id)) continue
    gemeldet.add(id)
    console.log(`    ${c.yellow('•')} ${id}${text ? `\n      ${c.dim(text)}` : c.dim('  (keine Preisrelevanz für diese Überarbeitung)')}`)
  }
  for (const u of uebersprungen) console.log(`    ${c.yellow('!')} ${u}`)

  if (!ausfuehren) {
    console.log(c.yellow(`\n  Nur angezeigt. Mit --ausfuehren werden ${entfernen.length} Zeilen gesichert und entfernt.\n`))
    return
  }
  if (entfernen.length === 0) {
    console.log(c.green('\n  Nichts zu entfernen.\n'))
    return
  }

  const bisher = existsSync(SICHERUNG) ? JSON.parse(readFileSync(SICHERUNG, 'utf8')) : { laeufe: [] }
  bisher.zweck =
    'Preisarten-Überarbeitung 09/2026: Supabase-Overrides entfernt, die den neuen Regeln widersprechen oder nichts mehr ändern. Wiederherstellen: Zeilen unverändert in stammdaten_overrides einfügen.'
  bisher.laeufe.push({ entferntAm: new Date().toISOString(), zeilen: entfernen.map((e) => ({ ...e.zeile, grund: e.grund })) })
  writeFileSync(SICHERUNG, JSON.stringify(bisher, null, 1) + '\n')
  console.log(c.dim(`\n  Sicherung: ${path.relative(APP, SICHERUNG)}`))

  let geloescht = 0
  for (const { zeile } of entfernen) {
    const filter = `bereich=eq.${encodeURIComponent(zeile.bereich)}&schluessel=eq.${encodeURIComponent(zeile.schluessel)}&version=eq.${zeile.version}`
    const r = await fetch(`${url}/rest/v1/stammdaten_overrides?${filter}`, {
      method: 'DELETE',
      headers: { ...kopf, Prefer: 'return=representation' },
    })
    if (!r.ok) throw new Error(`Löschen ${zeile.bereich}/${zeile.schluessel}: ${r.status} ${await r.text()}`)
    const weg = await r.json()
    if (weg.length === 1) geloescht++
    else console.log(c.yellow(`    ! ${zeile.bereich}/${zeile.schluessel}: inzwischen geändert — nicht entfernt`))
  }
  console.log(c.green(`  ${geloescht} von ${entfernen.length} Zeilen entfernt.\n`))
}

main().catch((e) => {
  console.error(c.red(`\n  ${e.message}\n`))
  process.exit(1)
})
