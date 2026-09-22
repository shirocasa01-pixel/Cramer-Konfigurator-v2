# CRAMER PLANER

Internes Konfigurations-Tool für den Vertrieb von **Cramer Möbel**. Digitalisiert die
Schnittstelle zwischen Beratung (Vertrieb) und Arbeitsvorbereitung (AV) – optimiert für den
Einsatz auf dem **iPad/Laptop während des Live-Kundengesprächs**. Ziel: keine Datenverluste
durch regelbasierte, erzwungene Konfiguration.

> **Status:** Prototyp vollständig – Phasen 1–6 implementiert (Login → Dashboard → Konfigurator → Scan → AV-PDF).

## Tech-Stack
- **Vite + React 18 + TypeScript**, **CSS Modules** + Design-Token-System (`src/styles/tokens.css`)
- **React Router**, Client-State (Context + `localStorage`)
- **jspdf** (AV-PDF), **qrcode** (Smartphone-Scan-Bridge)

## Starten
```bash
npm install
npm run dev
```
`http://localhost:5173` (dank `host: true` auch vom iPad/Smartphone im WLAN).
`npm run dev` erzeugt vorher automatisch das Stammdaten-Modul (siehe unten).

### Zugang
Berater und Administratoren kommen aus `Cramer-Stammdaten.xlsx`, Blatt „40 Mitarbeiter"
(Status `aktiv`). Einheitliches Standard-Passwort für alle, auch für `admin@cramer.de`:
`cramer2026` (`STANDARD_PASSWORT` in `src/data/consultants.ts` – bewusst nicht in der
Mappe, siehe Kommentar dort). Ein eigenes Passwort je Konto lässt sich in der
Benutzerverwaltung vergeben; es ersetzt dann das Standard-Passwort.

## Stammdaten (Single Source of Truth)

Artikel, Preise, Serien, Berater und Filialen liegen **nicht** im Code, sondern in zwei
Dateien eine Ebene über dem Repo:

| Datei | Inhalt |
| ----- | ------ |
| `Cramer-Stammdaten.xlsx` | 190 Artikel · 1509 Preiszeilen · Serien, Klassifikationen, Mitarbeiter, Filialen, Meta |
| `ARTIKELNUMMER-LOGIK.md` | Aufbau der Artikelnummer + Klassifikations-Tabellen (Gegenprobe zur Excel) |

Daraus erzeugt `npm run data:build` das getypte Modul `src/data/stammdaten.generated.ts`
(**nie von Hand bearbeiten**). Zugriff ausschließlich über `src/lib/stammdaten.ts`.

```bash
npm run data:build          # Modul neu erzeugen (läuft automatisch vor dev/build)
npm run data:check          # nur Kreuzprüfung Excel ↔ Markdown ↔ Referenzen
npm run data:test           # Selbsttest der Modus-/Lookup-Logik gegen die echten Daten
npm run kalk:test           # Kalkulation gegen die Sollwerte des Vorgänger-Tools
npm run ue89:test           # Überarbeitung 8+9: Front-Geometrie, Mittelseite, Böden, Sonderfarben, Verblendung
```

Einmalige Datenpflege-Läufe (alle idempotent, mit Backup):
```bash
npm run data:clean-modus    # Modus-Spalte auf Buchstaben-Notation
npm run data:seed-filialen  # echte Filialanschriften in „41 Filialen"
npm run data:fix-achsen     # belegte Achsenwert-Korrekturen in „20 Preise"
npm run data:migrate-ue89   # Überarbeitung 8+9: Mittelseite/Einlegeboden mit Tiefe×PG, Kleiderstange 15 €, Drehtür 21 R
```

**Serien-Freigabe („Modus").** Jeder Artikel trägt die Kürzel der Serien, für die er
freigegeben ist – `A` Atrium · `V` Velare · `P` Publicum · `R` Refugium · `O` Porticus ·
`C` Cavum · `S` Supersonus · `T` Tavolo · `U` Arcum (Blatt „30 Programme"). GROSS =
Standard, klein = Sonderanfertigung. Die Auswertung in `src/lib/modus.ts` ist bewusst
tolerant: Reihenfolge, Trennzeichen und Groß-/Kleinschreibung spielen für das Matching
keine Rolle (`RP` ≡ `R, P` ≡ `_R_P_` ≡ `p r`).

**Dropdown-Regel** (aus Blatt „00 Anleitung"): Produktgruppe = ein Schritt im
Konfigurator → Artikelgruppe = ein Dropdown darin → Artikel = die Einträge, gefiltert
über `Modus` und `Status` (nur `aktiv`).

## Kalkulation

Aus einem Entwurf wird eine bepreiste Positionsliste — `src/lib/kalkulation.ts`.
Der Verkaufspreis wird **berechnet**, das VK-Feld bleibt als begründungspflichtiger
Override daneben stehen.

| Datei | Rolle |
| ----- | ----- |
| `src/lib/raster.ts` | cm ↔ Raster als Formel, in ganzzahligen Millimetern |
| `src/lib/preisAchsen.ts` | Achsenwerte lesen und einordnen (7 Breiten-Schreibweisen) |
| `src/lib/preisLookup.ts` | Artikelnummer + Achsen → Preiszelle |
| `src/config/preisMapping.ts` | Zuordnung Konfigurator-Begriff → Artikelnummer (reine Daten) |
| `src/lib/kalkulation.ts` | Engine: normalisieren → ableiten → prüfen → bepreisen → Zuschläge |
| `src/components/pricing/KalkulationsPanel.tsx` | Positionsliste in der Zusammenfassung |

```
Fronthöhe    H = R × 128 mm − 3 mm            (alle Programme)
Korpushöhe   H = R × 128 mm + Offset(Serie)   aus „50 Meta"
```

Drei Prinzipien: **nie raten** (fehlende Preiszeile ⇒ Position „auf Anfrage", nie
geschätzt), **Ableitungen begründen** (Mittelseiten = Segmente − 1, mit Klartext-Hinweis),
**jeder Preis rückverfolgbar** (Artikelnummer, Achsenwerte A1–A5 und Seite der Preisliste
stehen an der Position). Serienspezifisches gehört ausschließlich in `preisMapping.ts` —
in `kalkulation.ts` steht kein `if (serieId === 'refugium')`.

## Workflow-Routen
`/login` → `/` (Dashboard) → `/new` (Entwurf) → `/products` → `/korpus` → `/dimensions` →
`/fronts` → `/summary` (Scan + AV-PDF + Abschluss). Öffentlich (per QR): `/scan/:draftId`.

## Phasen
| Phase | Inhalt | Status |
| ----- | ------ | ------ |
| 1 | Login / Authentifizierung | ✅ |
| 2 | Neuen Entwurf anlegen (Auto-ID `CRAMER-<Jahr>-<Initialen>-<NNNN>`) | ✅ |
| 3 | Produktgruppen- & Serien-Auswahl (regelbasiert, kaskadierend) | ✅ |
| 4 | Korpus-Konfiguration (Regel-Engine + Farbmatrix, „Keine Abdeckplatte“) | ✅ |
| 4.5 | Maße & Segmente (initialisiert die Front-Typ-Spalten) | ✅ |
| 5 | Fronten & Abschlüsse (Spalten/Segmente + kaskadierende Bäume, Front-Material Pflicht) | ✅ |
| 6 | Dashboard, Smartphone-Scan-Bridge, AV-PDF, Speichern/Abschließen | ✅ |

## Zentrale Konfiguration (datengetrieben; Docs `CRAMER PLANER - *` sind maßgeblich)
`brand.ts` · `branches.ts` · `productCatalog.ts` (Serien aus den Stammdaten + UI-Flags) ·
`materialMatrix.ts` (Farbmatrix, Sonderfälle `anders`/`keine`) · `korpus.ts` ·
`frontCatalog.ts` (Front-Baum) · `workflow.ts` · `support.ts`.
Regeln: `src/lib/*Rules.ts`, `src/lib/*Validation.ts`.

Noch **nicht** auf die Stammdaten umgestellt (steht bewusst weiterhin im Code, weil es in
keiner der beiden Quell-Dateien vorkommt bzw. eine eigene Migration braucht):
`materialMatrix.ts` (Farbmatrix – steht im Dokument `CRAMER PLANER - Farbmatrix`),
`equipment.ts`/`frontCatalog.ts` (Kataloge) sowie die alte
Preis-Engine `lib/pricing.ts` auf `data/priceList.json` (nur noch für `formatEuro`/`parseVkPreis`
in Verwendung; die Kalkulation läuft über `lib/kalkulation.ts` gegen das Excel-Preisblatt).
Griffe und Filialen kommen inzwischen aus der Mappe.

## Supabase: Systemdaten für alle Geräte

Alle Admin- und Systemdaten liegen in Supabase, damit mehrere Administratoren gleichzeitig
und geräteübergreifend arbeiten können. **Einmalig einrichten:** `supabase/system-sync.sql`
im Supabase-Dashboard unter *SQL Editor* ausführen (idempotent).

| Tabelle | Inhalt |
|---|---|
| `stammdaten_overrides` | Abweichungen vom Excel-Grundstand, eine Zeile je Datensatz (Artikel, Preise, Mitarbeiter/Rollen, Filialen, Oberflächen) |
| `system_daten` | Konfigurator-Schema (veröffentlicht + Entwurf), Versionen, Konten-Papierkorb, Einstellungen (Wartungsmodus, E-Mail-Regel) |
| `benutzer_zugaenge` | eigene Passwörter (Hash) — nur über Funktionen erreichbar, nicht lesbar |

- **Laden:** beim Start (Ladebildschirm), per Realtime bei jeder Änderung, beim Zurückkehren
  ins Fenster, vor dem Abschluss eines Auftrags und per „System aktualisieren 🔄" im Kopf.
- **Speichern:** Stammdaten mit „Speichern" in der Stammdatenverwaltung, Konten sofort.
  Jede Zeile trägt eine Version; hat ein anderer Administrator denselben Datensatz
  inzwischen gespeichert, wird nicht überschrieben, sondern ein Konflikt gemeldet.
- **Umstellung:** Früher nur lokal gespeicherte Stammdaten-Änderungen erscheinen einmalig als
  „ausstehend" und werden mit „Speichern" übernommen; lokales Schema, Versionen, Papierkorb und
  Einstellungen lädt der erste Administrator-Login hoch, sofern in Supabase noch nichts steht.
- Prüfung der Abgleich-Logik: `npm run sync:test`.

## ⚠️ Prototyp-Grenzen (für Produktion zu ersetzen)
- **Scan-Bridge (`vite.config.ts`)**: In-Memory-Relay im Dev-Server. Produktiv → echtes Backend /
  WebSocket / Storage-Endpoint.
- **Live-Kamera (getUserMedia)** braucht auf dem Smartphone **HTTPS** (sicherer Kontext). Der
  **Foto-Upload-Fallback** (`<input capture>`) funktioniert auch über HTTP-LAN. Für Live-Kamera:
  Dev-Server über HTTPS betreiben (z. B. `@vitejs/plugin-basic-ssl`).
- **Entwurfsnummer-Sequenz**: geräteweiter `localStorage`-Zähler. Produktiv → serverseitig vergeben.
- **„An AV senden“**: erzeugt das PDF + öffnet eine `mailto:`-Vorlage (PDF anhängen). Produktiv →
  echter Mail-/Schnittstellen-Versand.
- **Auth**: Konten und Passwörter liegen in Supabase, die Anmeldung wird aber im Browser
  entschieden, und der ANON-Key darf Stammdaten, Einstellungen und Passwörter schreiben
  (siehe Kopf von `supabase/system-sync.sql`). Produktiv → Supabase Auth mit serverseitiger
  Rollenprüfung (RLS je Rolle).
