/**
 * ZENTRALE APP-/DEPLOY-KONFIGURATION (Phase 11).
 * „Schalter ganz oben in der Codebase“ für Betrieb & Deployment.
 */
export const appConfig = {
  /**
   * GLOBALER Wartungsmodus (Deploy-Ebene). true => bei allen Nutzern erscheint das
   * Wartungs-Overlay. Global umschaltbar über die Env-Variable `VITE_MAINTENANCE_MODE`
   * (z. B. in Vercel) oder hier hart auf `true`, danach neu deployen.
   *
   * Der Toggle im Admin-Dashboard ist ein zusätzlicher Schalter, der in Supabase liegt
   * (`system_daten` → `einstellungen`) und damit ohne Redeploy auf allen Geräten gilt.
   * Effektiv aktiv = dieser Schalter ODER der Admin-Toggle.
   */
  isMaintenanceMode: import.meta.env.VITE_MAINTENANCE_MODE === 'true',

  /** Text des Wartungs-Overlays. */
  maintenanceMessage:
    'Der Cramer Planer wird gerade aktualisiert. Wir sind gleich wieder für Sie da!',

  /**
   * Basis-URL der Scan-Bridge-API. Leer = gleiche Origin – funktioniert sowohl mit dem
   * Vite-Dev-Plugin (lokal) als auch mit der Vercel-Serverless-Function (`/api/scan`).
   * Für ein separates Relay/Backend hier bzw. über `VITE_SCAN_API_BASE` setzen.
   */
  scanApiBase: import.meta.env.VITE_SCAN_API_BASE ?? '',
} as const
