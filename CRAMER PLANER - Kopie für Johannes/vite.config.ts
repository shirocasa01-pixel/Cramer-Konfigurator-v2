import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'node:os'

/**
 * Scan-Bridge (Prototyp/Dev): In-Memory-Relay, um ein Foto vom Smartphone an die
 * Laptop-Session zu übertragen. Beide Geräte sprechen denselben Vite-Dev-Server an
 * (Laptop via localhost, Smartphone via LAN-IP dank `host: true`).
 *
 * PRODUKTIV: durch ein echtes Backend / WebSocket- oder Storage-Endpoint ersetzen.
 * Für Live-Kamera (getUserMedia) auf dem Smartphone ist zusätzlich HTTPS nötig
 * (sicherer Kontext); der Datei-Upload-Fallback funktioniert auch über HTTP.
 */
function scanBridge(): Plugin {
  const store = new Map<string, { image: string; at: number }>()

  const readBody = (req: NodeJS.ReadableStream): Promise<string> =>
    new Promise((resolve) => {
      let data = ''
      req.on('data', (chunk) => (data += chunk))
      req.on('end', () => resolve(data))
      req.on('error', () => resolve(''))
    })

  return {
    name: 'cramer-scan-bridge',
    configureServer(server) {
      server.middlewares.use('/api/scan', async (req, res, next) => {
        if (req.method === 'POST') {
          const body = await readBody(req)
          try {
            const { draftId, image } = JSON.parse(body || '{}')
            const ok = Boolean(draftId && image)
            if (ok) store.set(String(draftId), { image, at: Date.now() })
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok }))
          } catch {
            res.statusCode = 400
            res.end(JSON.stringify({ ok: false }))
          }
          return
        }
        if (req.method === 'GET') {
          const draftId = new URLSearchParams((req.url || '').split('?')[1] || '').get('draftId')
          const entry = draftId ? store.get(draftId) : undefined
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ image: entry ? entry.image : null }))
          return
        }
        next()
      })

      // Liefert die LAN-IP, damit der QR-Code eine vom Smartphone erreichbare Adresse trägt.
      server.middlewares.use('/api/net-host', (_req, res) => {
        const nets = os.networkInterfaces()
        let host = 'localhost'
        for (const name of Object.keys(nets)) {
          for (const net of nets[name] || []) {
            if (net.family === 'IPv4' && !net.internal) {
              host = net.address
              break
            }
          }
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ host, port: server.config.server.port ?? 5173 }))
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), scanBridge()],
  server: {
    // host: true => im LAN erreichbar (iPad/Smartphone im selben Netzwerk)
    host: true,
    port: 5173,
  },
})
