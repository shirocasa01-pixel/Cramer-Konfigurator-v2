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
import type { Draft } from '../types'
import { generateEntwurfsnummer } from '../lib/id'
import { verificationDrafts } from '../data/verificationDrafts'
import {
  deleteProject,
  getAllProjects,
  isSupabaseConfigured,
  loadProject,
  saveProject,
} from '../lib/supabaseProjects'
import { friereBeimSpeichernEin, ohneSnapshot } from '../lib/pricingSnapshot'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'

/**
 * Der AKTUELLE Entwurf bleibt gerätelokal: Er überlebt einen Reload oder einen
 * zugeklappten Laptop, auch ohne Netz. Die ÜBERSICHT dagegen kommt vollständig aus
 * Supabase — ein Entwurf, den Kollege A anlegt, muss auf dem Rechner von Kollegin B
 * auftauchen, und das kann localStorage prinzipiell nicht leisten.
 */
const CURRENT_KEY = 'cramer-planer.draft.current.v2'

/** Verwaister Schlüssel der früheren localStorage-Übersicht — wird einmalig geräumt. */
const ALTER_LISTEN_KEY = 'cramer-planer.drafts.v2'

/** Wartezeit des Auto-Speicherns nach der letzten Eingabe. */
const AUTOSAVE_VERZOEGERUNG_MS = 2000

/**
 * Fest im Code hinterlegte Verifizierungs-Entwürfe immer einblenden (oben),
 * ohne persistierte Duplikate. So spiegeln sie stets den aktuellen Code-Stand.
 */
function withVerificationDrafts(list: Draft[]): Draft[] {
  const ids = new Set(list.map((item) => item.id))
  const pinned = verificationDrafts.filter((v) => !ids.has(v.id))
  return [...pinned, ...list]
}

/**
 * Hat der Entwurf genug Inhalt, um in der Übersicht zu erscheinen? (Die Auftragsnummer
 * ist ab Schritt 2 optional/nachträglich → nicht mehr das alleinige Kriterium.)
 */
function hatInhalt(draft: Draft): boolean {
  return Boolean(
    draft.customerName.trim() ||
      draft.orderNumber.trim() ||
      draft.artikelnummer?.trim() ||
      draft.productGroupId,
  )
}

interface DraftContextValue {
  draft: Draft | null
  /** Entwürfe & Aufträge für das Dashboard — Quelle ist Supabase. */
  savedDrafts: Draft[]
  /** true, solange die Übersicht aus Supabase geladen wird. */
  draftsLoading: boolean
  /** Klartext-Fehler beim Laden der Übersicht, sonst null. */
  draftsError: string | null
  /** Lädt die Übersicht neu aus Supabase. */
  refreshDrafts: () => Promise<void>
  /** `branchId` belegt die Heimatfiliale des Beraters vor (Punkt 1); änderbar bleibt sie. */
  startNewDraft: (consultant: { id: string; name: string; branchId?: string }) => void
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
  /**
   * Schreibt den aktuellen Entwurf nach Supabase (Upsert über die Entwurfsnummer)
   * und meldet das Ergebnis per Toast. Liefert true bei Erfolg.
   */
  saveDraft: () => Promise<boolean>
  /** Wie `saveDraft`, markiert den Entwurf zusätzlich als abgeschlossen. */
  finalizeDraft: () => Promise<boolean>
  /** true, solange eine Supabase-Speicherung läuft (für Button-Zustände). */
  cloudSaving: boolean
  /** Lädt einen Entwurf aus Supabase als aktuellen. Liefert false, wenn das misslingt. */
  loadDraft: (id: string) => Promise<boolean>
  /** Löscht einen Entwurf in Supabase. Referenz-Entwürfe sind nicht löschbar. */
  deleteDraft: (id: string) => Promise<boolean>
  /**
   * Dupliziert einen Entwurf als neue Variante (Schritt 1): neue Entwurfsnummer,
   * `variantOf` gesetzt, Auftrags-/Artikelnummer & Abschluss geleert. Setzt die Kopie
   * als aktuellen Entwurf, legt sie in Supabase an und gibt sie zurück.
   */
  duplicateDraft: (id: string) => Promise<Draft | null>
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

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft | null>(loadCurrent)
  const [remoteDrafts, setRemoteDrafts] = useState<Draft[]>([])
  const [draftsLoading, setDraftsLoading] = useState(false)
  const [draftsError, setDraftsError] = useState<string | null>(null)
  const [cloudSaving, setCloudSaving] = useState(false)
  const { user } = useAuth()
  const { showToast } = useToast()

  useEffect(() => {
    if (draft) localStorage.setItem(CURRENT_KEY, JSON.stringify(draft))
    else localStorage.removeItem(CURRENT_KEY)
  }, [draft])

  // Einmalig aufräumen: Die alte localStorage-Liste ist keine Quelle mehr und würde
  // sonst als toter Datensatz weiterleben und beim Debuggen in die Irre führen.
  useEffect(() => {
    try {
      localStorage.removeItem(ALTER_LISTEN_KEY)
    } catch {
      /* best-effort */
    }
  }, [])

  const refreshDrafts = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setRemoteDrafts([])
      setDraftsError(
        'Supabase ist nicht konfiguriert — VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ' +
          'in .env.local eintragen. Die Übersicht bleibt leer.',
      )
      return
    }
    setDraftsLoading(true)
    try {
      setRemoteDrafts(await getAllProjects())
      setDraftsError(null)
    } catch (error) {
      // Die Liste NICHT leeren: ein zuvor geladener Stand ist besser als ein leeres
      // Dashboard, das wie „keine Entwürfe vorhanden" aussieht.
      setDraftsError(`Übersicht konnte nicht geladen werden — Supabase meldet: ${(error as Error).message}`)
    } finally {
      setDraftsLoading(false)
    }
  }, [])

  // Übersicht laden, sobald jemand angemeldet ist; beim Abmelden verwerfen.
  useEffect(() => {
    if (!user) {
      setRemoteDrafts([])
      setDraftsError(null)
      return
    }
    void refreshDrafts()
  }, [user?.id, refreshDrafts])

  /**
   * Schreibt einen Entwurf nach Supabase.
   *
   * `still` unterdrückt die Erfolgsmeldung — das Auto-Speichern soll den Berater nicht
   * alle paar Sekunden mit einem Toast unterbrechen. Fehler werden IMMER gemeldet:
   * ein stumm fehlschlagendes Speichern ist die schlimmste Variante.
   */
  const pushToCloud = useCallback(
    async (entry: Draft, opts: { still?: boolean } = {}): Promise<boolean> => {
      if (!isSupabaseConfigured) {
        showToast(
          'Nicht gespeichert: Supabase ist nicht konfiguriert — VITE_SUPABASE_URL / ' +
            'VITE_SUPABASE_ANON_KEY in .env.local eintragen.',
          'error',
        )
        return false
      }
      if (!opts.still) setCloudSaving(true)
      try {
        const row = await saveProject({
          configuration: entry,
          projectName: entry.variantLabel?.trim() || entry.customerName.trim() || entry.id,
        })
        // Den zurückgelesenen Stand in die Übersicht übernehmen, statt neu zu laden —
        // spart eine Abfrage und hält die Liste trotzdem konsistent mit der Datenbank.
        setRemoteDrafts((list) => [
          row.configuration,
          ...list.filter((item) => item.id !== row.configuration.id),
        ])
        if (!opts.still) showToast(`Entwurf ${entry.id} in Supabase gespeichert.`)
        return true
      } catch (error) {
        showToast(`Speichern fehlgeschlagen — Supabase meldet: ${(error as Error).message}`, 'error')
        return false
      } finally {
        if (!opts.still) setCloudSaving(false)
      }
    },
    [showToast],
  )

  // AUTO-SPEICHERN. Früher wanderte jede Änderung sofort in die localStorage-Liste;
  // jetzt geht sie nach Supabase. Weil dabei echte Netzwerk-Schreibvorgänge entstehen,
  // wird gebündelt: erst zwei Sekunden nach der letzten Eingabe wird geschrieben, nicht
  // bei jedem Tastendruck. Damit bleibt die Zusage erhalten, dass ein Entwurf mit Inhalt
  // jederzeit über das Dashboard wiederauffindbar ist.
  const autosaveTimer = useRef<number | null>(null)
  useEffect(() => {
    if (!draft || !hatInhalt(draft) || draft.isVerification) return
    if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current)
    autosaveTimer.current = window.setTimeout(() => {
      autosaveTimer.current = null
      void pushToCloud(draft, { still: true })
    }, AUTOSAVE_VERZOEGERUNG_MS)
    return () => {
      if (autosaveTimer.current !== null) window.clearTimeout(autosaveTimer.current)
      autosaveTimer.current = null
    }
  }, [draft, pushToCloud])

  /**
   * Was das Dashboard sieht: der Stand aus Supabase, überlagert vom Entwurf, an dem
   * gerade gearbeitet wird. Ohne diese Überlagerung verschwände ein frisch angelegter
   * Entwurf für die zwei Sekunden bis zum Auto-Speichern aus der Liste.
   */
  const savedDrafts = useMemo(() => {
    const liste = [...remoteDrafts]
    if (draft && hatInhalt(draft)) {
      const index = liste.findIndex((item) => item.id === draft.id)
      if (index === -1) liste.unshift(draft)
      else liste[index] = draft
    }
    return withVerificationDrafts(liste)
  }, [remoteDrafts, draft])

  const startNewDraft = useCallback<DraftContextValue['startNewDraft']>((consultant) => {
    setDraft({
      id: generateEntwurfsnummer(consultant),
      createdAt: new Date().toISOString(),
      // Nur id und name – die Filiale gehört an den Entwurf, nicht in den Berater-Datensatz.
      consultant: { id: consultant.id, name: consultant.name },
      orderNumber: '',
      customerName: '',
      // Vorbelegung aus den Stammdaten – im Formular frei änderbar.
      branchId: consultant.branchId ?? '',
    })
  }, [])

  const updateDraft = useCallback<DraftContextValue['updateDraft']>((patch) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const updateDraftFrom = useCallback<DraftContextValue['updateDraftFrom']>((berechne) => {
    setDraft((prev) => (prev ? { ...prev, ...berechne(prev) } : prev))
  }, [])

  const resetDraft = useCallback(() => setDraft(null), [])

  const saveDraft = useCallback<DraftContextValue['saveDraft']>(async () => {
    if (!draft) return false
    return pushToCloud(draft)
  }, [draft, pushToCloud])

  const finalizeDraft = useCallback<DraftContextValue['finalizeDraft']>(async () => {
    if (!draft) return false
    // Hier wird der Preisstand eingefroren — und zwar VOR dem Setzen des lokalen
    // Zustands. Täte man das erst in `saveProject`, trüge die Datenbank den
    // Snapshot und der lokale Entwurf nicht; beim nächsten Rendern zeigte der
    // frisch abgeschlossene Auftrag dann noch live gerechnete Preise.
    const finalized = friereBeimSpeichernEin({
      ...draft,
      finalizedAt: draft.finalizedAt ?? new Date().toISOString(),
    })
    setDraft(finalized)
    return pushToCloud(finalized)
  }, [draft, pushToCloud])

  const loadDraft = useCallback<DraftContextValue['loadDraft']>(
    async (id) => {
      // Referenz-Entwürfe leben im Code, nicht in der Datenbank.
      const pinned = verificationDrafts.find((item) => item.id === id)
      if (pinned) {
        setDraft({ ...pinned })
        return true
      }
      try {
        setDraft(await loadProject(id))
        return true
      } catch (error) {
        showToast(`Entwurf ${id} konnte nicht geladen werden: ${(error as Error).message}`, 'error')
        return false
      }
    },
    [showToast],
  )

  const deleteDraft = useCallback<DraftContextValue['deleteDraft']>(
    async (id) => {
      if (verificationDrafts.some((item) => item.id === id)) return false // nicht löschbar
      try {
        await deleteProject(id)
        setRemoteDrafts((list) => list.filter((item) => item.id !== id))
        // Der gelöschte Entwurf darf nicht als „aktueller" weiterleben.
        setDraft((prev) => (prev?.id === id ? null : prev))
        showToast(`Entwurf ${id} gelöscht.`)
        return true
      } catch (error) {
        showToast(`Löschen fehlgeschlagen — Supabase meldet: ${(error as Error).message}`, 'error')
        return false
      }
    },
    [showToast],
  )

  const duplicateDraft = useCallback<DraftContextValue['duplicateDraft']>(
    async (id) => {
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
      // Die Kopie ist wieder ein offener Entwurf und muss mit aktuellen Preisen
      // rechnen — der eingefrorene Stand des Originals darf nicht mitwandern.
      const offeneKopie = ohneSnapshot(copy)
      setDraft(offeneKopie)
      // Sofort anlegen, damit die Variante auch für Kollegen sichtbar ist und nicht
      // erst beim Auto-Speichern entsteht.
      await pushToCloud(offeneKopie, { still: true })
      return offeneKopie
    },
    [savedDrafts, pushToCloud],
  )

  const value = useMemo<DraftContextValue>(
    () => ({
      draft,
      savedDrafts,
      draftsLoading,
      draftsError,
      refreshDrafts,
      startNewDraft,
      updateDraft,
      updateDraftFrom,
      resetDraft,
      saveDraft,
      finalizeDraft,
      cloudSaving,
      loadDraft,
      deleteDraft,
      duplicateDraft,
    }),
    [
      draft,
      savedDrafts,
      draftsLoading,
      draftsError,
      refreshDrafts,
      startNewDraft,
      updateDraft,
      updateDraftFrom,
      resetDraft,
      saveDraft,
      finalizeDraft,
      cloudSaving,
      loadDraft,
      deleteDraft,
      duplicateDraft,
    ],
  )

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}

export function useDraft(): DraftContextValue {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useDraft muss innerhalb von <DraftProvider> verwendet werden.')
  return ctx
}
