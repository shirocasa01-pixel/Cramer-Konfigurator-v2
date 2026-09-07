-- ---------------------------------------------------------------------------
-- OPTIONAL. Nur ausführen, wenn in Supabase nach Kunde, Filiale, Preis oder
-- Abschluss gefiltert bzw. sortiert werden soll — oder wenn die Freigabe an
-- Kollegen (`shareProject` / `getProjectsForUser`) genutzt wird.
--
-- Der vollständige Schrank-Status liegt IMMER im JSON-Feld `configuration`.
-- Die Spalten hier sind reine Duplikate daraus; ohne sie speichert der Planer
-- ebenso (src/lib/supabaseProjects.ts lässt unbekannte Spalten fallen).
--
-- Ausführen im Supabase-Dashboard unter SQL Editor.
-- ---------------------------------------------------------------------------

alter table public.projects add column if not exists branch_id       text;
alter table public.projects add column if not exists customer_name   text;
alter table public.projects add column if not exists total_price     numeric;
alter table public.projects add column if not exists shared_with     text[] not null default '{}';
alter table public.projects add column if not exists finalized_at    timestamptz;
alter table public.projects add column if not exists is_verification boolean not null default false;

-- Freigabe-Abfrage (`.contains('shared_with', [...])`) profitiert von einem GIN-Index.
create index if not exists projects_shared_with_idx on public.projects using gin (shared_with);
create index if not exists projects_created_by_idx  on public.projects (created_by_user_id);
