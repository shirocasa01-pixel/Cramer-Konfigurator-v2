/**
 * Griff-Katalog (Phase 9b) – Auswahl für die „Griff“-Option bei Glatt/Less/Glossy.
 * 1:1 aus der Preisliste („Griffe/Schlösser“). `priceEur` speist die Kalkulation
 * (Aufpreis-Bucket), sobald ein Griff gewählt ist.
 */
export interface HandleOption {
  id: string
  label: string
  /** VK-EUR inkl. MwSt. (Stück; „Edge“ = EUR/lfm). */
  priceEur: number
}

export const handles: HandleOption[] = [
  { id: 'nr19', label: 'Nr. 19', priceEur: 15 },
  { id: 'nr90', label: 'Nr. 90 (140 mm)', priceEur: 53 },
  { id: 'nr91', label: 'Nr. 91 (300 mm)', priceEur: 68 },
  { id: 'nr103', label: 'Nr. 103 (138 mm)', priceEur: 35 },
  { id: 'nr105', label: 'Nr. 105 (140 mm)', priceEur: 35 },
  { id: 'nr120', label: 'Nr. 120 (158 mm)', priceEur: 40 },
  { id: 'nr121', label: 'Nr. 121 (222 mm)', priceEur: 50 },
  { id: 'nr122', label: 'Nr. 122 (137 mm)', priceEur: 20 },
  { id: 'nr123', label: 'Nr. 123 (329 mm)', priceEur: 30 },
  { id: 'nr124', label: 'Nr. 124 (457 mm)', priceEur: 40 },
  { id: 'nr125', label: 'Nr. 125 Kantengriff (52 mm)', priceEur: 30 },
  { id: 'nr126', label: 'Nr. 126 Kantengriff (148 mm)', priceEur: 35 },
  { id: 'nr127', label: 'Nr. 127 Griffleiste (200 mm)', priceEur: 60 },
  { id: 'nr128', label: 'Nr. 128 Muschelgriff', priceEur: 40 },
  { id: 'edge', label: 'Edge (Kantengriff, 40 €/lfm)', priceEur: 40 },
]

export function getHandle(id: string | undefined): HandleOption | undefined {
  return id ? handles.find((handle) => handle.id === id) : undefined
}

/**
 * Schritt 7: Bei Glossy/Less nicht mögliche Griffe (S. 19): Nr. 103, 125, 126, 128.
 */
export const GLOSSY_LESS_EXCLUDED_HANDLE_IDS = ['nr103', 'nr125', 'nr126', 'nr128']

/** Verfügbare Griffe je Stil-Linie – bei Glossy/Less ohne die ausgeschlossenen Nummern. */
export function getAvailableHandles(styleLineId: string | undefined): HandleOption[] {
  if (styleLineId === 'glossy' || styleLineId === 'less') {
    return handles.filter((handle) => !GLOSSY_LESS_EXCLUDED_HANDLE_IDS.includes(handle.id))
  }
  return handles
}
