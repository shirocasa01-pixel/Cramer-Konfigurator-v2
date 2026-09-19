import { useSyncExternalStore } from 'react'

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

/** true ⇒ die Bearbeitungsschicht ist eingeschaltet. */
export function useEditorModus(): boolean {
  return useSyncExternalStore(subscribeEditorModus, getEditorModus, getEditorModus)
}
