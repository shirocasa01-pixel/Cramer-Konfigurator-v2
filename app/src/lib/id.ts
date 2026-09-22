import { brand } from '../config/brand'

const SEQ_KEY = 'cramer-planer.seq'

/** Initialen aus dem Beraternamen (z. B. „Anna Berger“ -> „AB“). */
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'XX'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Fortlaufende, gut lesbare 4-stellige Nummer (localStorage-Zähler, Prototyp).
 * HINWEIS: geräteweit fortlaufend. In Produktion sollte die Sequenz serverseitig
 * vergeben werden, um Kollisionen über mehrere Arbeitsplätze auszuschließen.
 */
function nextSequence(): string {
  let n = 1
  try {
    n = Number(localStorage.getItem(SEQ_KEY) ?? '0') + 1
    localStorage.setItem(SEQ_KEY, String(n))
  } catch {
    n = Date.now() % 10000
  }
  return String(n).padStart(4, '0')
}

/**
 * Erzeugt eine gut kommunizierbare Entwurfsnummer (Primary Key) im Muster
 * `CRAMER-<Jahr>-<Initialen>-<NNNN>`, z. B. `CRAMER-2026-AB-0001`.
 */
export function generateEntwurfsnummer(
  consultant: { name: string },
  date: Date = new Date(),
): string {
  return `${brand.draftIdPrefix}-${date.getFullYear()}-${initialsFrom(consultant.name)}-${nextSequence()}`
}

/**
 * Wie `generateEntwurfsnummer`, aber garantiert frei gegenüber `belegt`.
 *
 * Der Zähler oben ist GERÄTELOKAL. Ein zweiter Rechner (oder ein frischer Browser)
 * beginnt wieder bei 0001 und würde Nummern vergeben, die in Supabase längst stehen —
 * und weil `saveProject` per Upsert über die Entwurfsnummer schreibt, überschriebe der
 * neue Entwurf dann einen fremden. Deshalb wird gegen alle bekannten Nummern geprüft
 * und so lange weitergezählt, bis eine freie gefunden ist.
 */
export function freieEntwurfsnummer(
  consultant: { name: string },
  belegt: ReadonlySet<string>,
  date: Date = new Date(),
): string {
  for (let versuch = 0; versuch < 10000; versuch++) {
    const id = generateEntwurfsnummer(consultant, date)
    if (!belegt.has(id)) return id
  }
  // Praktisch unerreichbar; eine eindeutige Nummer ist dann wichtiger als eine hübsche.
  return `${brand.draftIdPrefix}-${date.getFullYear()}-${initialsFrom(consultant.name)}-${Date.now()}`
}
