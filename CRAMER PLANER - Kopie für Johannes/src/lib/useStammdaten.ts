import { useSyncExternalStore } from 'react'
import { getStammdatenStand, subscribe } from './stammdatenStore.ts'

/**
 * Bindet den Stammdaten-Store an React.
 *
 * Liefert den aktuellen Arbeitsstand und rendert neu, sobald sich etwas ändert — damit
 * greifen Bearbeitungen in der Verwaltung sofort in Kalkulation und Auswahlfelder durch,
 * ohne dass irgendwo ein Reload nötig wäre.
 */
export function useStammdaten() {
  return useSyncExternalStore(subscribe, getStammdatenStand, getStammdatenStand)
}
