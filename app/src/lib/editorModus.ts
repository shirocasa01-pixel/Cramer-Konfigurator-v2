import { useSyncExternalStore } from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * BEARBEITUNGSMODUS — der Konfigurator, während der Administrator ihn umbaut.
 *
 * Es gibt bewusst KEINE zweite, nachgebaute Oberfläche für die Verwaltung: Der
 * Administrator läuft durch denselben Konfigurator wie der Berater, Schritt für Schritt,
 * und sieht dabei genau das Ergebnis. Der Modus legt nur eine Bearbeitungsschicht darüber
 * — Stift an Überschriften und Feldern, Plus am Ende der Abschnitte, eine Leiste mit
 * „Veröffentlichen".
 *
 * Der Zustand lebt absichtlich nur in dieser Sitzung (kein `localStorage`): Wer die Seite
 * neu lädt, ist wieder im normalen Betrieb. Ein versehentlich angelassener
 * Bearbeitungsmodus wäre sonst die unangenehmere Variante.
 */
let aktiv = false
const hoerer = new Set<() => void>()

function melde() {
  hoerer.forEach((h) => h())
}

export function subscribeEditorModus(h: () => void): () => void {
  hoerer.add(h)
  return () => hoerer.delete(h)
}

export function getEditorModus(): boolean {
  return aktiv
}

export function setzeEditorModus(wert: boolean): void {
  if (aktiv === wert) return
  aktiv = wert
  melde()
}

/**
 * true ⇒ der Schalter steht auf „Bearbeiten".
 *
 * Nur der Schalter — ob die Bearbeitungsschicht auch erscheinen DARF, beantwortet
 * `useBearbeitungsModus()`. Wer eine Oberfläche baut, nimmt immer den gesicherten Haken.
 */
export function useEditorModus(): boolean {
  return useSyncExternalStore(subscribeEditorModus, getEditorModus, getEditorModus)
}

/**
 * DIE RECHTE-SPERRE DER BEARBEITUNGSSCHICHT.
 *
 * Der eine Haken, den jede Stift-, Plus- und Inspector-Anzeige abfragt: Bearbeitungsmodus
 * eingeschaltet UND angemeldet als Administrator. Für einen Berater bleibt die Oberfläche
 * dadurch vollständig sauber — kein Rahmen, kein Stift, kein Plus, kein Datenquellen-Text.
 *
 * Die Rolle wird bei JEDEM Rendern neu gelesen statt einmal beim Einschalten gemerkt: Ein
 * Rollenwechsel (Abmelden, Wechsel des Kontos) nimmt die Schicht damit sofort weg und
 * nicht erst beim nächsten Seitenwechsel.
 *
 * Grenze wie bei der übrigen Anmeldung: Das ist eine Oberflächen-Sperre, keine
 * Sicherheitsgrenze — die gesamte Anmeldung läuft im Browser (siehe `data/seedAdmin.ts`).
 * Echten Schutz gibt es erst mit server-seitiger Rollenprüfung.
 */
export function useBearbeitungsModus(): boolean {
  const { isAdmin } = useAuth()
  const eingeschaltet = useEditorModus()
  return eingeschaltet && isAdmin
}
