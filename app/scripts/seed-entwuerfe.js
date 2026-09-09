/**
 * TEST-ENTWÜRFE IN SUPABASE ANLEGEN.
 *
 * Schreibt die Entwürfe aus `src/data/testEntwuerfe.ts` als normale Zeilen in die
 * Tabelle `projects` — mit `is_verification = false`. Damit verhalten sie sich wie
 * jeder andere Entwurf: öffnen, duplizieren, bearbeiten und im Dashboard löschen.
 * Die früheren Referenz-Beispiele hingen im Code und ließen sich nicht entfernen.
 *
 * `total_price` bleibt bewusst LEER. Was die Möbel kosten, rechnet die Engine aus den
 * Stammdaten; ein hier eingetragener Betrag würde jede spätere Preisprüfung verfälschen.
 *
 *     node scripts/seed-entwuerfe.js            # anlegen/aktualisieren
 *     node scripts/seed-entwuerfe.js --dry-run  # nur zeigen, was geschrieben würde
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { testEntwuerfe } from '../src/data/testEntwuerfe.ts'

const trocken = process.argv.includes('--dry-run')

const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
}

/** Liest `VITE_SUPABASE_*` aus `.env.local` — dieselben Werte wie die Anwendung. */
function leseEnv() {
  const werte = {}
  for (const datei of ['.env.local', '.env']) {
    let inhalt
    try {
      inhalt = readFileSync(new URL(`../${datei}`, import.meta.url), 'utf8')
    } catch {
      continue
    }
    for (const zeile of inhalt.split(/\r?\n/)) {
      const treffer = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(zeile)
      if (treffer) werte[treffer[1]] ??= treffer[2].replace(/^["']|["']$/g, '')
    }
  }
  return werte
}

const env = leseEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error(c.red('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen in .env.local.'))
  process.exit(1)
}

/**
 * Dieselbe Spaltenzuordnung wie `saveProject()` in `src/lib/supabaseProjects.ts`.
 * Bewusst hier nachgebaut statt importiert: Jenes Modul liest `import.meta.env`, das
 * es außerhalb von Vite nicht gibt.
 */
function alsZeile(draft) {
  return {
    id: draft.id,
    project_name: draft.variantLabel ?? draft.customerName,
    created_by_user_id: draft.consultant.id,
    created_by_name: draft.consultant.name,
    branch_id: draft.branchId ?? null,
    customer_name: draft.customerName,
    total_price: null,
    configuration: draft,
    shared_with: [],
    finalized_at: null,
    is_verification: false,
  }
}

console.log(c.bold(`\nTest-Entwürfe → ${url}`))
console.log(c.dim(`  ${testEntwuerfe.length} Entwürfe · Tabelle „projects" · Upsert über id\n`))

const client = createClient(url, key)
let fehler = 0

for (const draft of testEntwuerfe) {
  const zeile = alsZeile(draft)
  const segmente = draft.fronts?.columns.length ?? 0
  const fronten = draft.fronts?.columns.reduce((n, s) => n + s.elements.length, 0) ?? 0
  const teile = draft.fronts?.columns.reduce((n, s) => n + (s.equipment?.length ?? 0), 0) ?? 0
  const info = `${segmente} Segmente · ${fronten} Fronten · ${teile} Ausstattungsteile`

  if (trocken) {
    console.log(`  ${c.dim('[dry-run]')} ${draft.id.padEnd(26)} ${info}`)
    continue
  }

  const { error } = await client.from('projects').upsert(zeile, { onConflict: 'id' })
  if (error) {
    fehler++
    console.log(`  ${c.red('✗')} ${draft.id.padEnd(26)} ${c.red(error.message)}`)
  } else {
    console.log(`  ${c.green('✓')} ${draft.id.padEnd(26)} ${info}`)
  }
}

console.log('')
if (fehler > 0) {
  console.log(c.red(`  ${fehler} Entwurf/Entwürfe konnten nicht geschrieben werden.\n`))
  process.exitCode = 1
} else if (!trocken) {
  console.log(c.green('  Fertig — die Entwürfe stehen im Dashboard und lassen sich dort auch löschen.\n'))
}
