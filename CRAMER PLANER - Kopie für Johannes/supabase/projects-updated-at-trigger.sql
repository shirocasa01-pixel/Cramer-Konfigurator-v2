-- ---------------------------------------------------------------------------
-- `updated_at` beim Speichern mitziehen.
--
-- BEFUND: Die Spalte hat zwar einen Default (now()), wird beim Upsert eines
-- bestehenden Entwurfs aber nicht neu gesetzt — sie zeigt dauerhaft den Zeitpunkt
-- der ERSTEN Speicherung. `getProjectsForUser` sortiert nach `updated_at desc`
-- (src/lib/supabaseProjects.ts); ohne diesen Trigger ist das faktisch eine
-- Sortierung nach Anlagedatum, nicht nach letzter Änderung.
--
-- Ausführen im Supabase-Dashboard unter SQL Editor.
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;

create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();
