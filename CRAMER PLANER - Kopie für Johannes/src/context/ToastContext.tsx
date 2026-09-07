import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import styles from './ToastContext.module.css'

/** Erfolg (grün) oder Fehler (rot) – mehr Varianten braucht der Planer nicht. */
export type ToastVariant = 'success' | 'error'

interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  /**
   * Blendet eine kurze Rückmeldung ein. Fehlermeldungen bleiben doppelt so lange
   * stehen wie Erfolgsmeldungen – der Berater soll sie lesen können.
   */
  showToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const DAUER: Record<ToastVariant, number> = { success: 3200, error: 6400 }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef<number[]>([])

  // Offene Timer beim Unmount abräumen (StrictMode ruft das im Dev doppelt auf).
  useEffect(() => {
    const laufende = timers
    return () => {
      laufende.current.forEach((t) => window.clearTimeout(t))
      laufende.current = []
    }
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback<ToastContextValue['showToast']>(
    (message, variant = 'success') => {
      const id = nextId.current++
      setToasts((list) => [...list, { id, message, variant }])
      const timer = window.setTimeout(() => dismiss(id), DAUER[variant])
      timers.current.push(timer)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.stack} role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`${styles.toast} ${styles[toast.variant]}`}>
            <span className={styles.message}>{toast.message}</span>
            <button
              type="button"
              className={styles.close}
              aria-label="Meldung schließen"
              onClick={() => dismiss(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast muss innerhalb von <ToastProvider> verwendet werden.')
  return ctx
}
