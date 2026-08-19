import { filialen as stammFilialen, getFiliale } from '../lib/stammdaten'
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
export const branches: Branch[] = stammFilialen.map((f) => ({
  id: f.filialnr,
  name: f.name,
  street: f.strasse,
  postalCode: f.plz,
  city: f.ort,
  phone: f.telefon || undefined,
  email: f.email || undefined,
}))

/**
 * Filiale per ID (Kopfzeile, Zusammenfassung, AV-PDF).
 *
 * Löst auch die früheren Code-IDs auf (`cramer-wohnvilla-hamburg` → `F-002`): sie stehen
 * als Spalte `Alt-ID` in der Mappe. Ohne das würden bereits gespeicherte Entwürfe ihre
 * Filiale verlieren, weil `Draft.branchId` dort noch den alten Slug trägt.
 */
export function getBranch(id: string | undefined): Branch | undefined {
  if (!id) return undefined
  const treffer = branches.find((b) => b.id === id)
  if (treffer) return treffer
  const ueberAltId = getFiliale(id)
  return ueberAltId ? branches.find((b) => b.id === ueberAltId.filialnr) : undefined
}
