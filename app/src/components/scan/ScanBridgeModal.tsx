import { useEffect, useRef, useState } from 'react'
import { toDataURL } from 'qrcode'
import { Modal } from '../ui/Modal'
import { buildMobileScanUrl, fetchScan, getScanHost } from '../../lib/scanBridge'
import styles from './ScanBridgeModal.module.css'

interface ScanBridgeModalProps {
  open: boolean
  draftId: string
  onClose: () => void
  onReceived: (image: string) => void
}

/**
 * Laptop-Seite der Scan-Bridge: zeigt einen dynamischen QR-Code (Draft-ID-spezifisch)
 * und pollt das Relay, bis das Smartphone das optimierte Bild übertragen hat.
 */
export function ScanBridgeModal({ open, draftId, onClose, onReceived }: ScanBridgeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [scanUrl, setScanUrl] = useState('')
  const [received, setReceived] = useState(false)
  const timerRef = useRef<number | null>(null)

  // QR-Code + Scan-URL aufbauen, sobald das Modal öffnet.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setReceived(false)
    setQrDataUrl(null)
    void (async () => {
      const host = await getScanHost()
      const url = buildMobileScanUrl(host, draftId)
      if (cancelled) return
      setScanUrl(url)
      try {
        const dataUrl = await toDataURL(url, { width: 240, margin: 1 })
        if (!cancelled) setQrDataUrl(dataUrl)
      } catch {
        /* QR-Erzeugung best-effort */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, draftId])

  // Auf ein übertragenes Bild pollen.
  useEffect(() => {
    if (!open) return
    let active = true
    const poll = async () => {
      const image = await fetchScan(draftId)
      if (!active) return
      if (image) {
        setReceived(true)
        onReceived(image)
        timerRef.current = window.setTimeout(() => active && onClose(), 900)
        return
      }
      timerRef.current = window.setTimeout(poll, 1500)
    }
    void poll()
    return () => {
      active = false
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [open, draftId, onReceived, onClose])

  return (
    <Modal open={open} title="Skizze via Smartphone scannen" onClose={onClose}>
      <div className={styles.body}>
        <ol className={styles.steps}>
          <li>QR-Code mit der Smartphone-Kamera scannen.</li>
          <li>Handzeichnung fotografieren – wird automatisch als Dokument optimiert.</li>
          <li>„An Laptop senden“ – die Skizze erscheint hier automatisch.</li>
        </ol>

        <div className={styles.qrWrap}>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR-Code zum Scannen" className={styles.qr} />
          ) : (
            <div className={styles.qrLoading}>QR-Code …</div>
          )}
          <div className={received ? styles.statusOk : styles.status}>
            {received ? '✓ Skizze empfangen' : 'Warte auf Übertragung …'}
          </div>
        </div>

        {scanUrl ? <p className={styles.url}>{scanUrl}</p> : null}
        <p className={styles.hint}>
          Smartphone und Laptop im selben WLAN. Für die Live-Kamera ist HTTPS nötig; der
          Foto-Upload funktioniert auch über HTTP.
        </p>
      </div>
    </Modal>
  )
}
