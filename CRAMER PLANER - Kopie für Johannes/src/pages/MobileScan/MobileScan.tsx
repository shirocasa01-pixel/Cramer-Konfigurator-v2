import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useParams } from 'react-router-dom'
import { brand } from '../../config/brand'
import { postScan } from '../../lib/scanBridge'
import styles from './MobileScan.module.css'

type Phase = 'starting' | 'live' | 'nocamera' | 'captured' | 'sending' | 'done' | 'error'

/** Globaler Threshold auf Basis der mittleren Helligkeit → Dokumenten-Look. */
function binarize(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  const mean = sum / (data.length / 4)
  const threshold = mean * 0.92 // etwas dunkler, damit Bleistiftlinien erhalten bleiben
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    const value = lum > threshold ? 255 : 0
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
  }
  ctx.putImageData(image, 0, 0)
}

/**
 * PHASE 6 – Mobile Scan-Ansicht (öffentliche Route `/scan/:draftId`, ohne Login).
 * Öffnet die Kamera (getUserMedia bei sicherem Kontext, sonst Datei-Aufnahme),
 * wandelt die Handzeichnung in ein kontrastreiches S/W-Dokument und überträgt es
 * an die Laptop-Session (Relay).
 */
export default function MobileScanPage() {
  const { draftId = '' } = useParams()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<Phase>('starting')
  const [preview, setPreview] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const canLiveCamera =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    if (!canLiveCamera) {
      setPhase('nocamera')
      setNote('Für die Live-Kamera ist eine sichere Verbindung (HTTPS) nötig. Alternativ Foto aufnehmen.')
      return
    }
    setPhase('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setPhase('live')
    } catch {
      setPhase('nocamera')
      setNote('Kamera nicht verfügbar – bitte Foto über die Aufnahme-Schaltfläche machen.')
    }
  }, [canLiveCamera])

  // Stream an das <video> hängen, sobald es (bei phase 'live') gerendert ist.
  useEffect(() => {
    if (phase === 'live' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [phase])

  useEffect(() => {
    void startCamera()
    return () => stopStream()
  }, [startCamera, stopStream])

  function renderToPreview(source: CanvasImageSource, sourceW: number, sourceH: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const maxW = 1100
    const scale = Math.min(1, maxW / (sourceW || maxW))
    const width = Math.max(1, Math.round((sourceW || maxW) * scale))
    const height = Math.max(1, Math.round((sourceH || maxW) * scale))
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(source, 0, 0, width, height)
    binarize(ctx, width, height)
    setPreview(canvas.toDataURL('image/jpeg', 0.82))
    setPhase('captured')
    stopStream()
  }

  function captureFromVideo() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    renderToPreview(video, video.videoWidth, video.videoHeight)
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      renderToPreview(image, image.naturalWidth, image.naturalHeight)
      URL.revokeObjectURL(url)
    }
    image.onerror = () => {
      setPhase('error')
      setNote('Bild konnte nicht gelesen werden.')
      URL.revokeObjectURL(url)
    }
    image.src = url
  }

  async function send() {
    if (!preview) return
    setPhase('sending')
    const ok = await postScan(draftId, preview)
    if (ok) {
      setPhase('done')
    } else {
      setPhase('error')
      setNote('Übertragung fehlgeschlagen. Bitte erneut senden.')
    }
  }

  function retake() {
    setPreview(null)
    setNote('')
    void startCamera()
  }

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <span className={styles.brand}>
          {brand.wordmark.primary} <span className={styles.thin}>{brand.wordmark.secondary}</span>
        </span>
        <span className={styles.sub}>Skizze scannen · {draftId || 'Entwurf'}</span>
      </header>

      <div className={styles.stage}>
        {preview ? (
          <img src={preview} alt="Scan-Vorschau" className={styles.preview} />
        ) : phase === 'live' ? (
          <video ref={videoRef} className={styles.video} playsInline muted />
        ) : (
          <div className={styles.placeholder}>
            {phase === 'starting' ? 'Kamera wird gestartet …' : 'Bereit zur Aufnahme'}
          </div>
        )}
        <canvas ref={canvasRef} className={styles.hiddenCanvas} />
      </div>

      {note ? <p className={styles.note}>{note}</p> : null}

      <div className={styles.actions}>
        {phase === 'live' ? (
          <button type="button" className={styles.primary} onClick={captureFromVideo}>
            Foto aufnehmen
          </button>
        ) : null}

        {phase === 'nocamera' ? (
          <label className={styles.primary}>
            Foto aufnehmen
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className={styles.fileInput}
              onChange={handleFile}
            />
          </label>
        ) : null}

        {phase === 'captured' ? (
          <>
            <button type="button" className={styles.ghost} onClick={retake}>
              Wiederholen
            </button>
            <button type="button" className={styles.primary} onClick={send}>
              An Laptop senden
            </button>
          </>
        ) : null}

        {phase === 'sending' ? <p className={styles.status}>Übertrage …</p> : null}
        {phase === 'done' ? (
          <p className={styles.done}>✓ Übertragen. Sie können zum Laptop zurückkehren.</p>
        ) : null}
        {phase === 'error' ? (
          <button type="button" className={styles.primary} onClick={preview ? send : retake}>
            Erneut versuchen
          </button>
        ) : null}
      </div>
    </div>
  )
}
