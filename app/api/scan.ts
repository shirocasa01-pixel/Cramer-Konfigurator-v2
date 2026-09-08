/**
 * CRAMER PLANER · Scan-Bridge – Vercel Serverless Function (Phase 11).
 *
 * Überträgt das optimierte Scan-Bild (Data-URL) vom Smartphone (POST) an die
 * Laptop-/Desktop-Session (GET-Long-Polling). Spiegelt exakt das Vite-Dev-Plugin
 * (`vite.config.ts`), sodass der Client-Code (`src/lib/scanBridge.ts`) lokal wie in
 * Produktion denselben Endpunkt `/api/scan` anspricht.
 *
 * ⚠️ PLATZHALTER-STORE: Die In-Memory-Map lebt nur innerhalb einer warmen Function-
 * Instanz. Für zuverlässige geräteübergreifende Übertragung in Produktion ersetzen
 * durch einen geteilten Store, z. B.:
 *   - `@vercel/kv`   (Redis/KV, ideal für kurzlebige Long-Polling-Payloads)
 *   - `@vercel/blob` (für größere Bilddateien statt Data-URLs)
 *   - oder ein echtes WebSocket-/Pusher-/Ably-Relay für Push statt Polling.
 * Die Handler-Signatur bleibt dabei unverändert – nur `store.get/set` austauschen.
 */

interface ScanEntry {
  image: string
  at: number
}

// Platzhalter-Store (siehe Hinweis oben).
const store = new Map<string, ScanEntry>()

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

/**
 * Vercel fuehrt `api/*.ts` sonst als Node-Function aus, die `(req, res)` erwartet.
 * Dieser Handler ist gegen die Web-API geschrieben (`Request` rein, `Response` raus) —
 * ohne diese Zeile wird der zurueckgegebene Response ignoriert, die Function antwortet
 * nie und Vercel liefert HTTP 500.
 */
export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)

  if (req.method === 'POST') {
    try {
      const body = (await req.json()) as { draftId?: string; image?: string }
      const ok = Boolean(body.draftId && body.image)
      if (ok) store.set(String(body.draftId), { image: String(body.image), at: Date.now() })
      return json({ ok })
    } catch {
      return json({ ok: false }, 400)
    }
  }

  if (req.method === 'GET') {
    const draftId = url.searchParams.get('draftId')
    const entry = draftId ? store.get(draftId) : undefined
    return json({ image: entry ? entry.image : null })
  }

  return json({ error: 'method not allowed' }, 405)
}
