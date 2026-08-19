import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Draft } from '../types'
import { generateEntwurfsnummer } from '../lib/id'
import { verificationDrafts } from '../data/verificationDrafts'

const CURRENT_KEY = 'cramer-planer.draft.current.v2'
const SAVED_KEY = 'cramer-planer.drafts.v2'

/**
 * Fest im Code hinterlegte Verifizierungs-Entwürfe immer einblenden (oben),
 * ohne persistierte Duplikate. So spiegeln sie stets den aktuellen Code-Stand.
 */
function withVerificationDrafts(list: Draft[]): Draft[] {
  const ids = new Set(list.map((item) => item.id))
  const pinned = verificationDrafts.filter((v) => !ids.has(v.id))
  return [...pinned, ...list]
}

interface DraftContextValue {
  draft: Draft | null
  /** Gespeicherte Entwürfe (aktiv & abgeschlossen) für das Dashboard. */
  savedDrafts: Draft[]
  startNewDraft: (consultant: { id: string; name: string }) => void
  updateDraft: (patch: Partial<Draft>) => void
  /**
   * Wie `updateDraft`, aber die Änderung wird aus dem AKTUELLEN Entwurf berechnet.
   *
   * Nötig überall dort, wo mehrere Änderungen kurz hintereinander auflaufen können:
   * `updateDraft` bekommt einen bereits fertigen Patch, der aus dem Zustand des
   * letzten Renderings stammt. Zwei schnelle Klicks auf „+ Drehtür" lasen so beide
   * denselben Stand — das zweite Element überschrieb das erste, und beide bekamen
   * die Kennzeichnung „D1". Mit dieser Variante rechnet die zweite Änderung auf dem
   * Ergebnis der ersten.
   */
  updateDraftFrom: (berechne: (aktuell: Draft) => Partial<Draft>) => void
  resetDraft: () => void
  /** Persistiert den aktuellen Entwurf in die Liste (Upsert). */
  saveDraft: () => void
  /** Markiert den aktuellen Entwurf als abgeschlossen und persistiert ihn. */
  finalizeDraft: () => void
  /** Lädt einen gespeicherten Entwurf als aktuellen. */
  loadDraft: (id: string) => void
  deleteDraft: (id: string) => void
  /**
   * Dupliziert einen gespeicherten Entwurf als neue Variante (Schritt 1): neue
   * Entwurfsnummer, `variantOf` gesetzt, Auftrags-/Artikelnummer & Abschluss geleert.
   * Setzt die Kopie als aktuellen Entwurf und gibt sie zurück.
   */
  duplicateDraft: (id: string) => Draft | null
}

const DraftContext = createContext<DraftContextValue | undefined>(undefined)

function loadCurrent(): Draft | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY)
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

function loadSaved(): Draft[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    return raw ? (JSON.parse(raw) as Draft[]) : []
  } catch {
    return []
  }
}

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft | null>(loadCurrent)
  const [savedDrafts, setSavedDrafts] = useState<Draft[]>(() => withVerificationDrafts(loadSaved()))

  useEffect(() => {
    if (draft) localStorage.setItem(CURRENT_KEY, JSON.stringify(draft))
    else localStorage.removeItem(CURRENT_KEY)
  }, [draft])

  useEffect(() => {
    try {
      // Verifizierungs-Entwürfe leben im Code – nicht mitpersistieren.
      const persistable = savedDrafts.filter((item) => !item.isVerification)
      localStorage.setItem(SAVED_KEY, JSON.stringify(persistable))
    } catch {
      /* best-effort im Prototyp */
    }
  }, [savedDrafts])

  // Auto-Speichern: sobald ein Entwurf identifizierbaren Inhalt hat, wird er in die Liste
  // übernommen/aktualisiert – jederzeit über das Dashboard wiederauffindbar. (Auftragsnummer
  // ist ab Schritt 2 optional/nachträglich → nicht mehr das alleinige Kriterium.)
  useEffect(() => {
    if (!draft) return
    const hasContent =
      draft.customerName.trim() ||
      draft.orderNumber.trim() ||
      draft.artikelnummer?.trim() ||
      draft.productGroupId
    if (!hasContent) return
    setSavedDrafts((list) => {
      const index = list.findIndex((item) => item.id === draft.id)
      if (index === -1) return [draft, ...list]
      const next = [...list]
      next[index] = draft
      return next
    })
  }, [draft])

  const startNewDraft = useCallback<DraftContextValue['startNewDraft']>((consultant) => {
    setDraft({
      id: generateEntwurfsnummer(consultant),
      createdAt: new Date().toISOString(),
      consultant,
      orderNumber: '',
      customerName: '',
      branchId: '',
    })
  }, [])

  const updateDraft = useCallback<DraftContextValue['updateDraft']>((patch) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const updateDraftFrom = useCallback<DraftContextValue['updateDraftFrom']>((berechne) => {
    setDraft((prev) => (prev ? { ...prev, ...berechne(prev) } : prev))
  }, [])

  const resetDraft = useCallback(() => setDraft(null), [])

  const upsert = useCallback((entry: Draft) => {
    setSavedDrafts((list) => [entry, ...list.filter((item) => item.id !== entry.id)])
  }, [])

  const saveDraft = useCallback(() => {
    if (draft) upsert(draft)
  }, [draft, upsert])

  const finalizeDraft = useCallback(() => {
    if (!draft) return
    const finalized: Draft = { ...draft, finalizedAt: new Date().toISOString() }
    setDraft(finalized)
    upsert(finalized)
  }, [draft, upsert])

  const loadDraft = useCallback(
    (id: string) => {
      const found = savedDrafts.find((item) => item.id === id)
      if (found) setDraft({ ...found })
    },
    [savedDrafts],
  )

  const deleteDraft = useCallback((id: string) => {
    setSavedDrafts((list) => {
      const target = list.find((item) => item.id === id)
      if (target?.isVerification) return list // Referenz-Entwürfe sind nicht löschbar
      return list.filter((item) => item.id !== id)
    })
  }, [])

  const duplicateDraft = useCallback<DraftContextValue['duplicateDraft']>(
    (id) => {
      const source = savedDrafts.find((item) => item.id === id)
      if (!source) return null
      // Tiefe Kopie – alle Draft-Daten sind JSON-serialisierbar (Supabase-/Export-tauglich).
      const clone = JSON.parse(JSON.stringify(source)) as Draft
      const copy: Draft = {
        ...clone,
        id: generateEntwurfsnummer(source.consultant),
        createdAt: new Date().toISOString(),
        variantOf: source.id,
        orderNumber: '', // neue Nummern werden separat/nachträglich vergeben
        artikelnummer: undefined,
        finalizedAt: undefined, // Variante startet als aktiver Entwurf
        isVerification: false, // Kopie einer Referenz ist ein normaler Entwurf
      }
      setDraft(copy)
      setSavedDrafts((list) => [copy, ...list])
      return copy
    },
    [savedDrafts],
  )

  const value = useMemo<DraftContextValue>(
    () => ({
      draft,
      savedDrafts,
      startNewDraft,
      updateDraft,
      updateDraftFrom,
      resetDraft,
      saveDraft,
      finalizeDraft,
      loadDraft,
      deleteDraft,
      duplicateDraft,
    }),
    [draft, savedDrafts, startNewDraft, updateDraft, updateDraftFrom, resetDraft, saveDraft, finalizeDraft, loadDraft, deleteDraft, duplicateDraft],
  )

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}

export function useDraft(): DraftContextValue {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useDraft muss innerhalb von <DraftProvider> verwendet werden.')
  return ctx
}
