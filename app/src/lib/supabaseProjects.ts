/**
 * Supabase-Anbindung für Cramer-Planer-Entwürfe (Tabelle `public.projects`).
 *
 * Die Zugangsdaten kommen aus `.env.local` (VITE_SUPABASE_URL /
 * VITE_SUPABASE_ANON_KEY) und landen über Vite im Browser-Bundle — hier darf
 * deshalb nur der ANON-Key mit aktiver Row-Level-Security stehen.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Draft } from '../types'
import { friereBeimSpeichernEin, normalisiereBeimLaden } from './pricingSnapshot'
import { isSupabaseConfigured, supabase } from './supabaseClient'

/**
 * Fehlt die Konfiguration, bleibt die App lauffähig, statt schon beim Import zu
 * crashen — die Speicherfunktion meldet den fehlenden Zugang dann im Klartext.
 */
export { isSupabaseConfigured, supabase }

/** Liefert den Client oder wirft eine verständliche Fehlermeldung. */
function client(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase ist nicht konfiguriert: VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY ' +
        'fehlen in .env.local (nach dem Anlegen den Dev-Server neu starten).',
    )
  }
  return supabase
}

/**
 * Eine Zeile der Tabelle `public.projects`.
 *
 * PFLICHT sind nur die Spalten, die die Tabelle heute hat. Alles Weitere sind
 * DENORMALISIERTE Bequemlichkeits-Spalten: Sie stehen ohnehin im `configuration`-JSON
 * und dienen nur dazu, in Supabase filtern/sortieren zu können, ohne das JSON
 * auszupacken. Fehlen sie in der Tabelle, wird trotzdem gespeichert (siehe
 * `saveProject`); anlegen lassen sie sich mit `supabase/projects-zusatzspalten.sql`.
 */
export interface ProjectRow {
  id: string
  project_name: string
  created_at: string
  updated_at: string
  created_by_user_id: string
  created_by_name: string
  configuration: Draft
  branch_id?: string | null
  customer_name?: string
  total_price?: number | null
  shared_with?: string[]
  finalized_at?: string | null
  is_verification?: boolean
}

/**
 * Spalten, die die Tabelle haben KANN, aber nicht haben MUSS. Meldet PostgREST
 * eine davon als unbekannt, lässt `saveProject` sie fallen und schreibt erneut.
 */
const OPTIONALE_SPALTEN = [
  'branch_id',
  'customer_name',
  'total_price',
  'shared_with',
  'finalized_at',
  'is_verification',
] as const

/**
 * Merkt sich pro Session, welche optionalen Spalten die Tabelle nicht kennt —
 * damit nur der allererste Speichervorgang einen Fehlversuch kostet.
 */
const unbekannteSpalten = new Set<string>()

/** Liest den Spaltennamen aus einer PostgREST-Meldung („Could not find the 'x' column"). */
function fehlendeSpalte(message: string): string | null {
  const treffer = /Could not find the '([^']+)' column/i.exec(message)
  return treffer ? treffer[1] : null
}

export interface SaveProjectInput {
  configuration: Draft
  projectName?: string
  sharedWith?: string[]
}

function parseGermanPrice(value: string | undefined): number | null {
  if (!value) return null
  const normalized = value.trim().replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function toProjectRow(input: SaveProjectInput): Omit<ProjectRow, 'created_at' | 'updated_at'> {
  const draft = input.configuration
  return {
    id: draft.id,
    project_name: input.projectName ?? draft.variantLabel ?? draft.customerName,
    created_by_user_id: draft.consultant.id,
    created_by_name: draft.consultant.name,
    branch_id: draft.branchId ?? null,
    customer_name: draft.customerName,
    total_price: parseGermanPrice(draft.vkPreis),
    configuration: draft,
    shared_with: input.sharedWith ?? [],
    finalized_at: draft.finalizedAt ?? null,
    is_verification: draft.isVerification ?? false,
  }
}

/**
 * Speichert einen offenen Entwurf oder einen abgeschlossenen Auftrag
 * (Upsert über `configuration.id`).
 *
 * ENTWURF vs. AUFTRAG: Die Unterscheidung hängt an `finalizedAt` im Entwurf, das
 * zugleich in die Spalte `finalized_at` geschrieben wird. Ein Auftrag bekommt beim
 * ersten Speichern nach der Finalisierung seinen `pricing_snapshot` — danach bleibt
 * der Preisstand unangetastet, egal wie oft noch gespeichert wird und was in der
 * Artikelverwaltung passiert. Offene Entwürfe werden bewusst OHNE Snapshot abgelegt.
 *
 * Der vollständige Schrank-Status steckt immer im `configuration`-JSON. Die
 * zusätzlichen Spalten sind nur Duplikate zum Filtern — kennt die Tabelle eine
 * davon nicht, wird sie verworfen und der Schreibvorgang wiederholt, statt das
 * Speichern komplett scheitern zu lassen.
 */
export async function saveProject(input: SaveProjectInput): Promise<ProjectRow> {
  const eingefroren = friereBeimSpeichernEin(input.configuration)
  const row: Record<string, unknown> = { ...toProjectRow({ ...input, configuration: eingefroren }) }
  for (const spalte of unbekannteSpalten) delete row[spalte]

  // Höchstens ein Durchgang je optionaler Spalte, danach ist Schluss.
  for (let versuch = 0; versuch <= OPTIONALE_SPALTEN.length; versuch++) {
    const { data, error } = await client()
      .from('projects')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single()

    if (!error) return data as ProjectRow

    const spalte = fehlendeSpalte(error.message)
    const verzichtbar =
      spalte !== null &&
      spalte in row &&
      (OPTIONALE_SPALTEN as readonly string[]).includes(spalte)
    if (!verzichtbar) throw error

    unbekannteSpalten.add(spalte)
    delete row[spalte]
  }

  throw new Error('Speichern in Supabase fehlgeschlagen: Tabelle „projects" passt nicht zum Entwurf.')
}


/**
 * Baut aus einer Datenbankzeile den Entwurf für die Oberfläche.
 *
 * `finalized_at` aus der SPALTE ist führend: Danach filtern und sortieren Abfragen,
 * und sie ist der Wert, den andere Werkzeuge (Supabase-Dashboard, spätere Reports)
 * sehen. Weicht das JSON davon ab, gewinnt die Spalte.
 */
function ausProjectRow(row: ProjectRow): Draft {
  const draft = row.configuration
  const finalizedAt = row.finalized_at ?? draft.finalizedAt ?? undefined
  return normalisiereBeimLaden({ ...draft, finalizedAt })
}

/**
 * Lädt einen einzelnen Entwurf/Auftrag.
 *
 * Was danach angezeigt wird, entscheidet `aufgeloestePreise` (lib/pricingSnapshot):
 *
 *   • Auftrag (`finalizedAt` gesetzt) ⇒ Preise starr aus `pricing_snapshot`.
 *     Änderungen an Stammdaten/Preisen erreichen diesen Auftrag nicht mehr.
 *   • Offener Entwurf                 ⇒ Preise werden gegen den aktuellen
 *     Stammdaten-Stand neu durchgerechnet; ein alter Snapshot wird hier entfernt,
 *     damit er nicht doch noch in eine Anzeige gerät.
 */
export async function loadProject(projectId: string): Promise<Draft> {
  const { data, error } = await client()
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (error) throw error
  return ausProjectRow(data as ProjectRow)
}

/**
 * Lädt alle Entwürfe und Aufträge, die der angemeldete Nutzer sehen DARF — die
 * Datenquelle der Dashboard-Übersicht.
 *
 * Bewusst ohne Filter auf den Berater: Das Dashboard hat einen eigenen
 * Berater-Filter mit der Option „Alle Berater", über den auch fremde Vorgänge
 * sichtbar sein sollen. Wer was sehen darf, entscheidet Row-Level-Security in
 * Supabase — heute (Variante A) alles, nach der Umstellung auf Supabase Auth
 * (Variante B) automatisch nur noch eigene und freigegebene. Die Sichtbarkeits-
 * Regel gehört in die Datenbank, nicht in eine Client-Abfrage.
 */
export async function getAllProjects(): Promise<Draft[]> {
  const { data, error } = await client()
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => ausProjectRow(row as ProjectRow))
}

/**
 * Löscht einen Entwurf/Auftrag endgültig.
 *
 * ACHTUNG, RLS-FALLE: Fehlt die DELETE-Policy, filtert Row-Level-Security die Zeile
 * einfach heraus — PostgREST liefert dann KEINEN Fehler, sondern „0 Zeilen gelöscht".
 * Ohne die Prüfung unten meldete die Oberfläche fröhlich Erfolg, während der Entwurf
 * in der Datenbank stehen bliebe und nach dem nächsten Neuladen wieder aufträte.
 * Deshalb wird das Ergebnis zurückgelesen und ein leeres Ergebnis als Fehler behandelt.
 */
export async function deleteProject(projectId: string): Promise<void> {
  const { data, error } = await client()
    .from('projects')
    .delete()
    .eq('id', projectId)
    .select('id')

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error(
      `Entwurf ${projectId} wurde nicht gelöscht: Die Zeile existiert nicht, oder ` +
        'Row-Level-Security erlaubt kein DELETE. Fehlende Policy nachziehen — ' +
        'siehe supabase/projects-rls.sql.',
    )
  }
}

/**
 * Lädt alle Entwürfe, die für den Berater sichtbar sind: eigene Entwürfe
 * sowie Entwürfe, die explizit für ihn freigegeben wurden.
 */
export async function getProjectsForUser(userId: string): Promise<ProjectRow[]> {
  const [owned, shared] = await Promise.all([
    client().from('projects').select('*').eq('created_by_user_id', userId),
    client().from('projects').select('*').contains('shared_with', [userId]),
  ])

  if (owned.error) throw owned.error
  // Ohne Spalte `shared_with` gibt es schlicht keine Freigaben — eigene Entwürfe
  // sollen deshalb trotzdem geladen werden.
  if (shared.error && !fehlendeSpalte(shared.error.message)) throw shared.error

  const byId = new Map<string, ProjectRow>()
  for (const roh of [...(owned.data ?? []), ...(shared.data ?? [])]) {
    const row = roh as ProjectRow
    byId.set(row.id, { ...row, configuration: ausProjectRow(row) })
  }

  return [...byId.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
}

/**
 * Dupliziert einen bestehenden Entwurf für einen Kollegen. Die Kopie bekommt
 * eine neue ID, wird dem Ziel-Berater zugeordnet, verweist per `variantOf`
 * auf den Ursprung und startet ohne eigene Freigaben sowie ohne `finalizedAt`.
 */
export async function duplicateProjectAsCopy(
  projectId: string,
  targetUserId: string,
  targetUserName: string,
  newId: string,
): Promise<ProjectRow> {
  const { data: source, error: fetchError } = await client()
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (fetchError) throw fetchError
  const sourceRow = source as ProjectRow

  const copy: Draft = {
    ...sourceRow.configuration,
    id: newId,
    createdAt: new Date().toISOString(),
    consultant: { id: targetUserId, name: targetUserName },
    variantOf: sourceRow.configuration.id,
    finalizedAt: undefined,
  }

  return saveProject({
    configuration: copy,
    projectName: sourceRow.project_name,
    sharedWith: [],
  })
}

/** Fügt eine Consultant-ID/E-Mail zur Freigabeliste eines Entwurfs hinzu. */
export async function shareProject(projectId: string, shareWithId: string): Promise<ProjectRow> {
  const { data: existing, error: fetchError } = await client()
    .from('projects')
    .select('shared_with')
    .eq('id', projectId)
    .single()

  if (fetchError) throw fetchError

  const current = (existing?.shared_with as string[]) ?? []
  const next = current.includes(shareWithId) ? current : [...current, shareWithId]

  const { data, error } = await client()
    .from('projects')
    .update({ shared_with: next })
    .eq('id', projectId)
    .select()
    .single()

  if (error) throw error
  return data as ProjectRow
}

/** Entfernt eine Consultant-ID/E-Mail aus der Freigabeliste eines Entwurfs. */
export async function unshareProject(projectId: string, shareWithId: string): Promise<ProjectRow> {
  const { data: existing, error: fetchError } = await client()
    .from('projects')
    .select('shared_with')
    .eq('id', projectId)
    .single()

  if (fetchError) throw fetchError

  const current = (existing?.shared_with as string[]) ?? []
  const next = current.filter((id) => id !== shareWithId)

  const { data, error } = await client()
    .from('projects')
    .update({ shared_with: next })
    .eq('id', projectId)
    .select()
    .single()

  if (error) throw error
  return data as ProjectRow
}
