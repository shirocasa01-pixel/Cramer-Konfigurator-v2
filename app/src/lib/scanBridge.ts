import { appConfig } from '../config/appConfig'

/**
 * Client-Helfer für die Smartphone-Scan-Bridge (Phase 6 + 11).
 *
 * Endpunkte werden über `appConfig.scanApiBase` (Standard: gleiche Origin) angesprochen –
 * lokal bedient sie das Vite-Dev-Plugin (`vite.config.ts`), in Produktion die Vercel-
 * Serverless-Function (`/api/scan`). Der Client „sucht“ seinen Endpunkt also identisch
 * in beiden Umgebungen.
 */

const API = appConfig.scanApiBase

export interface ScanHost {
  host: string
  port: number
}

function isLocalHost(): boolean {
  if (typeof window === 'undefined') return false
  return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)
}

/**
 * LAN-Host für eine vom Smartphone erreichbare Scan-URL – nur im lokalen Dev nötig.
 * In Produktion ist die Deployment-Origin bereits öffentlich (HTTPS) → `null`, der
 * Aufrufer nutzt dann `window.location.origin`.
 */
export async function getScanHost(): Promise<ScanHost | null> {
  if (!isLocalHost()) return null
  try {
    const res = await fetch(`${API}/api/net-host`)
    if (!res.ok) return null
    return (await res.json()) as ScanHost
  } catch {
    return null
  }
}

/** Baut die Smartphone-Scan-URL – LAN-IP im Dev, sonst die (öffentliche) Origin. */
export function buildMobileScanUrl(host: ScanHost | null, draftId: string): string {
  const path = `/scan/${encodeURIComponent(draftId)}`
  if (host && host.host && host.host !== 'localhost') {
    return `http://${host.host}:${host.port}${path}`
  }
  return `${window.location.origin}${path}`
}

/** Überträgt das optimierte Scan-Bild (Data-URL) an das Relay. */
export async function postScan(draftId: string, image: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId, image }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean }
    return Boolean(data.ok)
  } catch {
    return false
  }
}

/** Fragt das Relay nach einem übertragenen Scan-Bild (Long-Polling durch den Laptop). */
export async function fetchScan(draftId: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/api/scan?draftId=${encodeURIComponent(draftId)}`)
    if (!res.ok) return null
    const data = (await res.json()) as { image: string | null }
    return data.image ?? null
  } catch {
    return null
  }
}
