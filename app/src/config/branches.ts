import { getFiliale, getFilialenAuswahl, type Filiale } from '../lib/stammdaten'
import type { Branch } from '../types'

/**
 * Filialen — aus den Stammdaten, Blatt „41 Filialen".
 *
 * Die sechs Standorte lagen bis zur Zusammenführung hartcodiert hier; sie stehen jetzt
 * in der Mappe (`npm run data:seed-filialen` hat sie dorthin übernommen). Eine neue
 * Filiale ist damit eine Zeile in der Excel, keine Code-Änderung.
 *
 * Im UI wird ausschließlich `name` angezeigt; die übrigen Felder bleiben intern
 * verfügbar (AV-PDF, Angebote, spätere ERP-Anbindung).
 */
function alsBranch(f: Filiale): Branch {
  return {
    id: f.filialnr,
    name: f.name,
    street: f.strasse,
    postalCode: f.plz,
    city: f.ort,
    phone: f.telefon || undefined,
    email: f.email || undefined,
  }
}

/**
 * Auswählbare Filialen für die Dropdowns (Dashboard-Filter, neuer Entwurf).
 *
 * Eine FUNKTION, keine Konstante: Eine in der Verwaltung auf „gesperrt" gesetzte Filiale
 * muss sofort aus der Auswahl verschwinden — als Konstante wäre die Liste beim Laden des
 * Moduls eingefroren gewesen und hätte die Sperrung nie mitbekommen.
 */
export function getBranches(): Branch[] {
  return getFilialenAuswahl().map(alsBranch)
}

/**
 * Filiale per ID (Kopfzeile, Zusammenfassung, AV-PDF).
 *
 * Löst auch die früheren Code-IDs auf (`cramer-wohnvilla-hamburg` → `F-002`): sie stehen
 * als Spalte `Alt-ID` in der Mappe. Ohne das würden bereits gespeicherte Entwürfe ihre
 * Filiale verlieren, weil `Draft.branchId` dort noch den alten Slug trägt.
 *
 * Sucht bewusst über ALLE Filialen, auch gesperrte: Ein altes Angebot muss seine Filiale
 * mit Namen und Anschrift behalten, auch wenn der Standort inzwischen geschlossen ist.
 */
export function getBranch(id: string | undefined): Branch | undefined {
  if (!id) return undefined
  const treffer = getFiliale(id)
  return treffer ? alsBranch(treffer) : undefined
}
