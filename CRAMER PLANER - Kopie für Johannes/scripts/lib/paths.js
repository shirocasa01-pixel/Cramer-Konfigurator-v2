/**
 * Zentrale Pfade zu den beiden Quell-Dateien.
 *
 * Beide liegen eine Ebene über dem Repo, direkt im Projektordner:
 *
 *   Cramer Planer 2 – Johannes x Sarib Version/
 *   ├── Cramer-Stammdaten.xlsx      ← Stammdaten (Artikel, Preise, Programme, Berater …)
 *   ├── ARTIKELNUMMER-LOGIK.md      ← ergänzende Logiken
 *   └── CRAMER PLANER - Kopie für Johannes/   ← dieses Repo
 *
 * Überschreibbar per Umgebungsvariable, damit sich Script und Dev-Server auch auf eine
 * Kopie richten lassen (z. B. zum Testen), ohne Code zu ändern.
 */

import { fileURLToPath } from 'node:url'
import path from 'node:path'

/** Repo-Wurzel (= Ordner mit package.json). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Projektordner eine Ebene darüber – dort liegen die Quell-Dateien. */
export const DATA_ROOT = process.env.CRAMER_DATA_ROOT
  ? path.resolve(process.env.CRAMER_DATA_ROOT)
  : path.resolve(REPO_ROOT, '..')

export const STAMMDATEN_XLSX = process.env.CRAMER_STAMMDATEN
  ? path.resolve(process.env.CRAMER_STAMMDATEN)
  : path.join(DATA_ROOT, 'Cramer-Stammdaten.xlsx')

export const LOGIK_MD = process.env.CRAMER_LOGIK_MD
  ? path.resolve(process.env.CRAMER_LOGIK_MD)
  : path.join(DATA_ROOT, 'ARTIKELNUMMER-LOGIK.md')

/** Blattnamen der Stammdatenmappe – an einer Stelle, nicht über den Code verstreut. */
export const SHEETS = {
  anleitung: '00 Anleitung',
  artikel: '10 Artikel',
  preise: '20 Preise',
  programme: '30 Programme',
  produktgruppen: '31 Produktgruppen',
  artikelgruppen: '32 Artikelgruppen',
  teilearten: '33 Teilearten',
  preislogiken: '34 Preislogiken',
  achsen: '35 Achsen',
  mitarbeiter: '40 Mitarbeiter',
  filialen: '41 Filialen',
  kunden: '42 Kunden',
  meta: '50 Meta',
}
