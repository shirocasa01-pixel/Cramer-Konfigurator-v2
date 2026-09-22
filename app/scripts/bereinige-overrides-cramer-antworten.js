#!/usr/bin/env node
/**
 * SUPABASE-OVERRIDES — Antworten von Cramer auf die Rückfragen der Preisarten-
 * Überarbeitung (23.09.2026).
 *
 * Die Bereinigung vom 22.09. (`bereinige-overrides-preisarten.js`) hat fünf Overrides
 * bewusst stehen lassen und als Rückfrage gemeldet. Cramer hat entschieden:
 *
 *   Edge-Griff 30-012-0001        Staffel 100/200/300 cm raus → 40 €/lfm laut Preisliste
 *   KMK-Wandtablar 40-020-0003    Festpreis 255 € raus → 75 € + 180 €/lfm laut Preisliste
 *   Hintere Aufkantung 50-027-0001  45 € je Stück raus → 45 €/lfd. m laut Preisliste
 *   Container 40-017-0029         Sperre aufheben → gültig, regulär berechnet
 *   Personalnummer M-004          Dietmar Kerschbaummayr bekommt M-104, Sarib behält M-004
 *
 * Die Mappe trägt bei allen vier Artikeln bereits den Stand der Preisliste — das Entfernen
 * des Overrides genügt. Jede Zeile wird vorher geprüft: Hat sie inzwischen jemand geändert
 * (andere Version, anderer Inhalt), bleibt sie stehen.
 *
 *   node scripts/bereinige-overrides-cramer-antworten.js              (nur anzeigen)
 *   node scripts/bereinige-overrides-cramer-antworten.js --ausfuehren (sichern + ändern)
 *
 * Entfernte Zeilen landen vollständig in `supabase/override-bereinigung-cramer-antworten.json`
 * und lassen sich von dort wieder einspielen.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mitarbeiter } from '../src/data/stammdaten.generated.ts'

const HIER = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(HIER, '..')
const SICHERUNG = path.join(APP, 'supabase', 'override-bereinigung-cramer-antworten.json')
const ausfuehren = process.argv.includes('--ausfuehren')
const BEARBEITER = 'Skript: Antworten Cramer 23.09.2026'

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

async function hole(pfad, init) {
  const r = await fetch(`${url}/rest/v1/${pfad}`, { headers: kopf, ...init })
  if (!r.ok) throw new Error(`Supabase ${pfad.split('?')[0]}: ${r.status} ${await r.text()}`)
  return r.json()
}

/**
 * DIE ENTSCHEIDUNGEN — je Zeile der Altstand, der analysiert wurde (`passt`), und die
 * Antwort von Cramer (`grund`).
 */
const EDGE = 'Edge-Griff: Cramer 23.09.2026 — 40 €/lfm laut Preisliste S. 3 statt Staffel je angefangenem Meter.'
const WANDTABLAR = 'KMK-Wandtablar: Cramer 23.09.2026 — Festpreis + Matrix laut Preisliste S. 33 (75 € + 180 €/lfm) statt Festpreis 255 €.'
const ENTFERNEN = [
  {
    bereich: 'artikel',
    schluessel: '30-012-0001',
    grund: `${EDGE} Override führte Preislogik MATRIX nur mit Achse LAENGE; die Mappe trägt Matrix – Maßgenau (LAENGE × PREISART).`,
    passt: (z) => z.aktion === 'geaendert' && z.daten?.preislogik === 'MATRIX' && z.daten?.achsen?.join() === 'LAENGE',
  },
  { bereich: 'preise', schluessel: '30-012-0001#|200 cm||||', grund: `${EDGE} Staffelzeile 200 cm → 80 €.`, passt: (z) => z.aktion === 'neu' && z.daten?.preis === 80 },
  { bereich: 'preise', schluessel: '30-012-0001#|300 cm||||', grund: `${EDGE} Staffelzeile 300 cm → 120 €.`, passt: (z) => z.aktion === 'neu' && z.daten?.preis === 120 },
  { bereich: 'preise', schluessel: '30-012-0001#16|100 cm|€/m|||', grund: `${EDGE} Staffelzeile 100 cm → 40 €.`, passt: (z) => z.aktion === 'neu' && z.daten?.preis === 40 },
  {
    bereich: 'preise',
    schluessel: '30-012-0001#16||€/m|||',
    grund: `${EDGE} Blendete die Mappenzeile „40 €/m" aus — ohne diese Zeile gilt sie wieder.`,
    passt: (z) => z.aktion === 'geloescht',
  },
  {
    bereich: 'artikel',
    schluessel: '40-020-0003',
    grund: `${WANDTABLAR} Override führte Preislogik FESTPREIS.`,
    passt: (z) => z.aktion === 'geaendert' && z.daten?.preislogik === 'FESTPREIS',
  },
  {
    bereich: 'preise',
    schluessel: '40-020-0003#1250||Fixpreis|||',
    grund: `${WANDTABLAR} Grundpreis war auf 255 € gesetzt (Mappe: 75 €).`,
    passt: (z) => z.aktion === 'geaendert' && z.daten?.preis === 255,
  },
  {
    bereich: 'preise',
    schluessel: '40-020-0003#||€/m|||',
    grund: `${WANDTABLAR} Blendete die Mappenzeile „180 €/m" aus — ohne diese Zeile gilt sie wieder.`,
    passt: (z) => z.aktion === 'geloescht',
  },
  {
    bereich: 'artikel',
    schluessel: '50-027-0001',
    grund: 'Hintere Aufkantung: Cramer 23.09.2026 — 45 €/lfd. m laut Preisliste S. 32 statt 45 € je Stück (Override: FESTPREIS ohne Achsen).',
    passt: (z) => z.aktion === 'geaendert' && z.daten?.preislogik === 'FESTPREIS' && (z.daten?.achsen ?? []).length === 0,
  },
  {
    bereich: 'artikel',
    schluessel: '40-017-0029',
    grund: 'Container 4,5 R / 6 R mit Rauchglas-Deckplatte: Cramer 23.09.2026 — Sperre aufheben, Artikel ist gültig (Mappe: aktiv).',
    passt: (z) => z.aktion === 'geaendert' && z.daten?.status === 'gesperrt',
  },
]

/** Personalnummer: der Datensatz von Herrn Kerschbaummayr wandert von M-004 nach M-104. */
const UMSCHLUESSELN = {
  von: 'M-004',
  nach: 'M-104',
  name: 'Dietmar Kerschbaummayr',
  grund: 'Personalnummer M-004 war doppelt (Mappe: Sarib Test-Berater). Cramer 23.09.2026: Herr Kerschbaummayr bekommt M-104, Sarib behält M-004.',
}

async function main() {
  console.log(c.bold('\nSupabase-Overrides — Antworten Cramer (23.09.2026)'))
  const zeilen = await hole('stammdaten_overrides?select=*&order=bereich,schluessel')
  console.log(c.dim(`  ${zeilen.length} Zeilen in stammdaten_overrides`))
  const finde = (bereich, schluessel) => zeilen.find((z) => z.bereich === bereich && z.schluessel === schluessel)

  const entfernen = []
  const hinweise = []
  for (const regel of ENTFERNEN) {
    const z = finde(regel.bereich, regel.schluessel)
    if (!z) continue
    if (regel.passt(z)) entfernen.push({ zeile: z, grund: regel.grund })
    else hinweise.push(`${z.bereich}/${z.schluessel} — Inhalt weicht vom analysierten Altstand ab, bleibt stehen`)
  }

  // --- Personalnummer: nur umschlüsseln, wenn nichts anderes an M-004 hängt ------------
  let umschluesseln = null
  const alt = finde('mitarbeiter', UMSCHLUESSELN.von)
  if (alt) {
    const hindernisse = []
    if (alt.aktion !== 'neu' || alt.daten?.name !== UMSCHLUESSELN.name) hindernisse.push(`Override ${UMSCHLUESSELN.von} ist nicht mehr der Datensatz von ${UMSCHLUESSELN.name}`)
    if (finde('mitarbeiter', UMSCHLUESSELN.nach) || mitarbeiter.some((m) => m.personalnr === UMSCHLUESSELN.nach)) hindernisse.push(`${UMSCHLUESSELN.nach} ist bereits vergeben`)
    // Ein eigenes Passwort ließe sich nicht mitnehmen — der Hash ist nicht auslesbar.
    const zugaenge = await hole('rpc/zugang_liste', { method: 'POST', body: '{}' })
    if (zugaenge.some((z) => z.personalnr === UMSCHLUESSELN.von)) hindernisse.push(`${UMSCHLUESSELN.von} hat ein eigenes Passwort — es gehört zu wem?`)
    // Entwürfe unter M-004 müssen alle von Sarib stammen, sonst gehören einige Herrn Kerschbaummayr.
    const entwuerfe = await hole(`projects?select=id,created_by_name&created_by_user_id=eq.${UMSCHLUESSELN.von}`)
    const fremd = entwuerfe.filter((e) => e.created_by_name !== 'Sarib Test-Berater')
    if (fremd.length) hindernisse.push(`${fremd.length} Entwürfe unter ${UMSCHLUESSELN.von} nicht von Sarib: ${fremd.map((e) => e.id).join(', ')}`)
    if (hindernisse.length) hinweise.push(...hindernisse.map((h) => `mitarbeiter/${UMSCHLUESSELN.von} — ${h}; nicht umgeschlüsselt`))
    else umschluesseln = { zeile: alt, entwuerfeSarib: entwuerfe.length }
  }

  console.log(c.bold('\n  ENTFERNEN (Mappe = Preisliste gilt wieder)'))
  for (const e of entfernen) console.log(`    ${c.red('−')} ${e.zeile.bereich}/${e.zeile.schluessel} (v${e.zeile.version})\n      ${c.dim(e.grund)}`)
  if (umschluesseln) {
    console.log(c.bold('\n  PERSONALNUMMER'))
    console.log(`    ${c.yellow('~')} mitarbeiter/${UMSCHLUESSELN.von} → ${UMSCHLUESSELN.nach} ${UMSCHLUESSELN.name}`)
    console.log(c.dim(`      ${UMSCHLUESSELN.grund} Kein eigenes Passwort; die ${umschluesseln.entwuerfeSarib} Entwürfe unter M-004 sind alle von Sarib.`))
  }
  for (const h of hinweise) console.log(`    ${c.yellow('!')} ${h}`)

  const anzahl = entfernen.length + (umschluesseln ? 1 : 0)
  if (!ausfuehren) {
    console.log(c.yellow(`\n  Nur angezeigt. Mit --ausfuehren werden ${anzahl} Änderung(en) gesichert und geschrieben.\n`))
    return
  }
  if (anzahl === 0) {
    console.log(c.green('\n  Nichts zu tun.\n'))
    return
  }

  const bisher = existsSync(SICHERUNG) ? JSON.parse(readFileSync(SICHERUNG, 'utf8')) : { laeufe: [] }
  bisher.zweck =
    'Antworten Cramer vom 23.09.2026 auf die Rückfragen der Preisarten-Überarbeitung: Overrides entfernt bzw. umgeschlüsselt. Wiederherstellen: Zeilen unverändert in stammdaten_overrides einfügen (bei M-104 vorher die neue Zeile löschen).'
  bisher.laeufe.push({
    am: new Date().toISOString(),
    entfernt: entfernen.map((e) => ({ ...e.zeile, grund: e.grund })),
    umgeschluesselt: umschluesseln ? [{ ...umschluesseln.zeile, neuerSchluessel: UMSCHLUESSELN.nach, grund: UMSCHLUESSELN.grund }] : [],
  })
  writeFileSync(SICHERUNG, JSON.stringify(bisher, null, 1) + '\n')
  console.log(c.dim(`\n  Sicherung: ${path.relative(APP, SICHERUNG)}`))

  if (umschluesseln) {
    // Erst die neue Zeile anlegen, dann die alte entfernen — scheitert das Anlegen, bleibt alles, wie es war.
    const neu = {
      bereich: 'mitarbeiter',
      schluessel: UMSCHLUESSELN.nach,
      aktion: 'neu',
      daten: { ...umschluesseln.zeile.daten, personalnr: UMSCHLUESSELN.nach },
      version: 1,
      updated_by: BEARBEITER,
    }
    await hole('stammdaten_overrides', { method: 'POST', headers: { ...kopf, Prefer: 'return=representation' }, body: JSON.stringify(neu) })
    entfernen.push({ zeile: umschluesseln.zeile })
    console.log(c.green(`  mitarbeiter/${UMSCHLUESSELN.nach} angelegt.`))
  }

  let geloescht = 0
  for (const { zeile } of entfernen) {
    const filter = `bereich=eq.${encodeURIComponent(zeile.bereich)}&schluessel=eq.${encodeURIComponent(zeile.schluessel)}&version=eq.${zeile.version}`
    const weg = await hole(`stammdaten_overrides?${filter}`, { method: 'DELETE', headers: { ...kopf, Prefer: 'return=representation' } })
    if (weg.length === 1) geloescht++
    else console.log(c.yellow(`    ! ${zeile.bereich}/${zeile.schluessel}: inzwischen geändert — nicht entfernt`))
  }
  console.log(c.green(`  ${geloescht} von ${entfernen.length} Zeilen entfernt.\n`))
}

main().catch((e) => {
  console.error(c.red(`\n  ${e.message}\n`))
  process.exit(1)
})
