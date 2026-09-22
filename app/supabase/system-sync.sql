-- ---------------------------------------------------------------------------
-- SYSTEM-SYNC — Stammdaten, Konten und Admin-Einstellungen zentral in Supabase
--
-- Ausführen im Supabase-Dashboard unter SQL Editor (einmal, idempotent — ein
-- zweiter Lauf ändert nichts). Danach sehen alle Geräte denselben Stand:
--
--   stammdaten_overrides  Abweichungen vom Excel-Grundstand, EINE ZEILE JE DATENSATZ
--                         (Artikel, Preiszeile, Mitarbeiter, Filiale, Oberfläche …).
--                         Zwei Administratoren, die verschiedene Datensätze ändern,
--                         kommen sich damit nicht in die Quere.
--   system_daten          Dokumente: Konfigurator-Struktur, Versionen, Benutzer-
--                         Papierkorb, Einstellungen (Wartungsmodus, E-Mail-Regel).
--   benutzer_zugaenge     Eigene Passwörter (SHA-256-Hash). NICHT direkt lesbar —
--                         nur über die Funktionen unten, damit kein Hash über den
--                         öffentlichen ANON-Key abrufbar ist.
--
-- Jede Zeile trägt eine `version`. Die App schreibt nur, wenn die Version noch die
-- ist, die sie zuletzt gelesen hat („optimistisches Sperren"); sonst meldet sie einen
-- Konflikt, statt die Änderung eines anderen Administrators zu überschreiben.
--
-- ACHTUNG, SICHERHEIT — dieselbe Grenze wie „Variante A" in projects-rls.sql: Der
-- ANON-Key steht im Browser-Bundle. Wer ihn hat, kann Stammdaten und Einstellungen
-- lesen UND ändern und auch Passwörter NEU SETZEN (nur nicht auslesen). Eine echte
-- Rechteprüfung braucht Supabase Auth (serverseitige Rolle je Sitzung). Bis dahin
-- ist das eine gemeinsame Datenbasis für ein internes Werkzeug, keine Zugriffssperre.
-- ---------------------------------------------------------------------------


-- === Tabellen ================================================================

create table if not exists public.stammdaten_overrides (
  bereich     text        not null
              check (bereich in ('artikel', 'preise', 'mitarbeiter', 'filialen', 'kategorien', 'oberflaechen', 'meta')),
  schluessel  text        not null,
  -- geaendert: `daten` ist ein Feld-Patch auf den Grundstand
  -- neu:       `daten` ist der vollständige Datensatz
  -- geloescht: blendet den Grundstand-Datensatz aus, `daten` ist leer
  -- wert:      freier Wert (bereich 'meta', z. B. die Import-Marken)
  aktion      text        not null check (aktion in ('geaendert', 'neu', 'geloescht', 'wert')),
  daten       jsonb,
  version     integer     not null default 1,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (bereich, schluessel)
);

create table if not exists public.system_daten (
  schluessel  text        primary key,
  wert        jsonb,
  version     integer     not null default 1,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create table if not exists public.benutzer_zugaenge (
  personalnr     text        primary key,
  passwort_hash  text        not null,
  gesetzt_am     date        not null default current_date,
  updated_at     timestamptz not null default now()
);


-- === Row-Level-Security ======================================================

alter table public.stammdaten_overrides enable row level security;
alter table public.system_daten         enable row level security;
alter table public.benutzer_zugaenge    enable row level security;

do $$
begin
  -- stammdaten_overrides: lesen und schreiben (Prototyp, siehe Hinweis oben)
  if not exists (select 1 from pg_policies where tablename = 'stammdaten_overrides' and policyname = 'sync_lesen') then
    create policy "sync_lesen"     on public.stammdaten_overrides for select using (true);
    create policy "sync_anlegen"   on public.stammdaten_overrides for insert with check (true);
    create policy "sync_aendern"   on public.stammdaten_overrides for update using (true) with check (true);
    create policy "sync_loeschen"  on public.stammdaten_overrides for delete using (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'system_daten' and policyname = 'sync_lesen') then
    create policy "sync_lesen"     on public.system_daten for select using (true);
    create policy "sync_anlegen"   on public.system_daten for insert with check (true);
    create policy "sync_aendern"   on public.system_daten for update using (true) with check (true);
    create policy "sync_loeschen"  on public.system_daten for delete using (true);
  end if;

  -- benutzer_zugaenge: bewusst KEINE Policy — die Tabelle ist nur über die
  -- security-definer-Funktionen unten erreichbar.
end $$;


-- === Zugangs-Funktionen ======================================================

-- Welche Konten ein eigenes Passwort haben (ohne Hash) — für die Benutzerverwaltung.
create or replace function public.zugang_liste()
returns table (personalnr text, gesetzt_am date)
language sql security definer set search_path = public
as $$
  select personalnr, gesetzt_am from public.benutzer_zugaenge;
$$;

-- Anmeldeprüfung: 'kein' (kein eigenes Passwort ⇒ Standard-Passwort gilt),
-- 'ok' oder 'falsch'. Der Hash verlässt die Datenbank nie.
create or replace function public.zugang_pruefen(p_personalnr text, p_hash text)
returns text
language sql security definer set search_path = public
as $$
  select coalesce(
    (select case when passwort_hash = p_hash then 'ok' else 'falsch' end
       from public.benutzer_zugaenge where personalnr = p_personalnr),
    'kein');
$$;

create or replace function public.zugang_setzen(p_personalnr text, p_hash text)
returns void
language sql security definer set search_path = public
as $$
  insert into public.benutzer_zugaenge (personalnr, passwort_hash, gesetzt_am, updated_at)
  values (p_personalnr, p_hash, current_date, now())
  on conflict (personalnr) do update
    set passwort_hash = excluded.passwort_hash, gesetzt_am = current_date, updated_at = now();
$$;

create or replace function public.zugang_entfernen(p_personalnr text)
returns void
language sql security definer set search_path = public
as $$
  delete from public.benutzer_zugaenge where personalnr = p_personalnr;
$$;

grant execute on function public.zugang_liste()                to anon, authenticated;
grant execute on function public.zugang_pruefen(text, text)    to anon, authenticated;
grant execute on function public.zugang_setzen(text, text)     to anon, authenticated;
grant execute on function public.zugang_entfernen(text)        to anon, authenticated;


-- === Realtime ================================================================
-- Damit Admin B eine Änderung von Admin A ohne Klick sieht. Fehlt das, bleibt der
-- Knopf „System aktualisieren 🔄" — die App funktioniert auch ohne Realtime.

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'stammdaten_overrides') then
    alter publication supabase_realtime add table public.stammdaten_overrides;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'system_daten') then
    alter publication supabase_realtime add table public.system_daten;
  end if;
end $$;
