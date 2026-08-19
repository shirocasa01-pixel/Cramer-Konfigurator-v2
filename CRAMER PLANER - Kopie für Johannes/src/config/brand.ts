/**
 * Zentrale Marken-/Namenskonfiguration – einzige Quelle der Wahrheit für
 * Produktname, Wortmarke und den Entwurfsnummern-Präfix.
 * Wird u. a. von Login-Wortmarke, Kopfzeile und (später) AV-PDF-Header genutzt.
 */
export const brand = {
  /** Zweiteilige Wortmarke (siehe <BrandMark />). */
  wordmark: { primary: 'CRAMER', secondary: 'PLANER' },
  /** Vollständiger Produktname der App. */
  productName: 'CRAMER PLANER',
  /** Firmierung des Betreibers. */
  company: 'Cramer Möbel',
  /**
   * Präfix der automatischen Entwurfsnummer im Muster `<PREFIX>-<Jahr>-XXXXX`.
   * Zentral hier gepflegt – eine Änderung wirkt sich überall aus (Login, Kopfzeile, AV-PDF).
   */
  draftIdPrefix: 'CRAMER',
} as const
