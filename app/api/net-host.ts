/**
 * CRAMER PLANER · Scan-Bridge Host-Info – Vercel Serverless Function (Phase 11).
 *
 * Lokal (Vite-Dev-Plugin) liefert dieser Endpunkt die LAN-IP, damit das Smartphone
 * den Laptop erreicht. In Produktion ist die Deployment-URL selbst öffentlich und
 * per HTTPS erreichbar (was Live-Kamera via getUserMedia freischaltet) – daher gibt
 * der Client (`src/lib/scanBridge.ts`) hier gar keine Anfrage mehr auf und nutzt
 * direkt `window.location.origin`. Diese Function existiert nur als sauberer Fallback.
 */
/**
 * Vercel fuehrt `api/*.ts` sonst als Node-Function aus, die `(req, res)` erwartet.
 * Dieser Handler ist gegen die Web-API geschrieben (`Request` rein, `Response` raus) —
 * ohne diese Zeile wird der zurueckgegebene Response ignoriert, die Function antwortet
 * nie und Vercel liefert HTTP 500.
 */
export const config = { runtime: 'edge' }

export default function handler(req: Request): Response {
  const url = new URL(req.url)
  return new Response(
    JSON.stringify({ host: url.host, port: url.protocol === 'https:' ? 443 : 80, secure: url.protocol === 'https:' }),
    { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
  )
}
