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
import { useLocation, useNavigate } from 'react-router-dom'
import type { Draft } from '../types'
import { generateEntwurfsnummer } from '../lib/id'
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
 * Tiefe der Rückgängig-Historie.
 *
 * Protokolliert wird JEDE Änderung — auch jedes einzelne getippte Zeichen, weil jeder
 * Tastendruck durch `updateDraft` läuft. 300 Schritte sind damit etwa eine halbe Seite
 * Tipparbeit; der Speicherbedarf bleibt im einstelligen Megabyte-Bereich, weil ein
 * Entwurf wenige Kilobyte JSON ist.
 */
const HISTORIE_TIEFE = 300

/** Aufbewahrungsfrist verworfener Entwürfe, danach räumt der Papierkorb von selbst. */
export const ENTWURF_AUFBEWAHRUNG_TAGE = 30

/**
 * Ein Zustand VOR einer Änderung, zusammen mit dem Ort, an dem sie stattfand.
 *
 * Die Route mitzuführen ist der eigentliche Trick: Ohne sie würde „Rückgängig" einen Wert
 * zurücksetzen, den der Berater gerade gar nicht sieht — er stünde in Schritt 6 und
 * wunderte sich, warum sich nichts tut, während in Schritt 3 eine Breite zurückspringt.
 * Mit ihr springt die Ansicht an die Stelle, an der die Änderung passiert ist.
 */
interface HistorieEintrag {
  draft: Draft
  route: string
  zeit: number
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
  /** Verwirft den laufenden Entwurf vollständig (Abmelden, Kontowechsel). */
  resetDraft: () => void

  // --- Rückgängig / Wiederherstellen (↶ / ↷) ---
  /** true ⇒ es gibt einen Schritt, der sich zurücknehmen lässt. */
  kannRueckgaengig: boolean
  /**
   * true ⇒ es wurde mindestens einmal zurückgenommen und noch nichts Neues geändert.
   * Erst dann erscheint der Vorwärts-Pfeil — wie in Word.
   */
  kannWiederherstellen: boolean
  /** Nimmt die letzte Änderung zurück und springt zu der Stelle, an der sie passierte. */
  rueckgaengig: () => void
  /** Stellt die zuletzt zurückgenommene Änderung wieder her. */
  wiederherstellen: () => void

  /**
   * Setzt die KONFIGURATION zurück und behält den Auftragskopf.
   *
   * Nicht dasselbe wie `resetDraft`: Wer „Entwurf zurücksetzen" wählt, will noch einmal
   * von vorn konfigurieren — nicht Kundenname, Auftragsnummer und Filiale neu eintippen.
   */
  setzeKonfigurationZurueck: () => void
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
  /** Entwürfe im Papierkorb (`deletedAt` gesetzt), neueste zuerst. */
  trashedDrafts: Draft[]
  /** Verschiebt einen Entwurf in den Papierkorb (Soft-Delete). */
  trashDraft: (id: string) => Promise<boolean>
  /** Holt einen Entwurf aus dem Papierkorb zurück. */
  restoreDraft: (id: string) => Promise<boolean>
  /** Leert den Papierkorb endgültig; liefert die Zahl der gelöschten Entwürfe. */
  emptyTrash: () => Promise<number>
  /** Speichert den laufenden Entwurf und verlässt ihn (Rückkehr zur Übersicht). */
  leaveDraft: () => Promise<boolean>
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
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (draft) localStorage.setItem(CURRENT_KEY, JSON.stringify(draft))
    else localStorage.removeItem(CURRENT_KEY)
  }, [draft])

  // -------------------------------------------------------------------------
  // Rückgängig / Wiederherstellen
  // -------------------------------------------------------------------------

  const [vergangenheit, setVergangenheit] = useState<HistorieEintrag[]>([])
  const [zukunft, setZukunft] = useState<HistorieEintrag[]>([])

  /** Die Route, auf der gerade gearbeitet wird — ohne sie im Callback zu veralten. */
  const routeRef = useRef(location.pathname)
  useEffect(() => {
    routeRef.current = location.pathname
  }, [location.pathname])

  /** Der zuletzt gesehene Entwurf — die Vergleichsgröße der Aufzeichnung unten. */
  const letzterRef = useRef<Draft | null>(draft)
  /**
   * Gesetzt, solange eine Zeitreise läuft.
   *
   * Ohne diese Bremse würde „Rückgängig" seinen eigenen Sprung als neue Änderung
   * protokollieren — die Historie liefe im Kreis und käme nie am Anfang an.
   */
  const zeitreiseRef = useRef(false)

  /*
    AUFGEZEICHNET WIRD IM EFFEKT, nicht im Schreibaufruf.

    Der naheliegende Weg wäre, in `updateDraft` vor dem Setzen den alten Stand
    wegzuschreiben. Das wäre aber eine Nebenwirkung im State-Updater, und React ruft
    Updater im Entwicklungsmodus absichtlich doppelt auf — jede Eingabe stünde zweimal in
    der Historie, und „Rückgängig" müsste man zweimal drücken.

    Hier läuft die Aufzeichnung nach dem Commit, und der Referenzvergleich (`vorher ===
    draft`) macht den doppelten Lauf wirkungslos: Beim zweiten Durchgang ist der
    Vergleichswert bereits nachgezogen.
  */
  useEffect(() => {
    const vorher = letzterRef.current
    letzterRef.current = draft
    if (zeitreiseRef.current) {
      zeitreiseRef.current = false
      return
    }
    if (!vorher || !draft || vorher === draft) return
    // Ein Wechsel des Entwurfs ist kein Bearbeitungsschritt: Die Historie des einen
    // Entwurfs darf nicht in den nächsten hineinwirken.
    if (vorher.id !== draft.id) {
      setVergangenheit([])
      setZukunft([])
      return
    }
    setVergangenheit((liste) => [
      ...liste.slice(-(HISTORIE_TIEFE - 1)),
      { draft: vorher, route: routeRef.current, zeit: Date.now() },
    ])
    // Jede neue Änderung kappt den Vorwärts-Ast — genau wie in Word.
    setZukunft([])
  }, [draft])

  /*
    Beide Zeitreisen sind reine Ereignisbehandlungen: Sie lesen den aktuellen Stand aus
    der Closure und schreiben mit unverschachtelten Updatern zurück. Ein `setDraft` INNEN
    in einem `setVergangenheit`-Updater wäre derselbe Doppelaufruf-Fehler, den die
    Aufzeichnung oben bewusst vermeidet.
  */

  /** Springt einen Schritt zurück und dorthin, wo die Änderung stattfand. */
  const rueckgaengig = useCallback(() => {
    const eintrag = vergangenheit[vergangenheit.length - 1]
    if (!eintrag || !draft) return
    zeitreiseRef.current = true
    setVergangenheit((liste) => liste.slice(0, -1))
    setZukunft((liste) => [...liste, { draft, route: routeRef.current, zeit: Date.now() }])
    setDraft(eintrag.draft)
    if (eintrag.route && eintrag.route !== routeRef.current) navigate(eintrag.route)
  }, [vergangenheit, draft, navigate])

  const wiederherstellen = useCallback(() => {
    const eintrag = zukunft[zukunft.length - 1]
    if (!eintrag || !draft) return
    zeitreiseRef.current = true
    setZukunft((liste) => liste.slice(0, -1))
    setVergangenheit((liste) => [...liste, { draft, route: routeRef.current, zeit: Date.now() }])
    setDraft(eintrag.draft)
    if (eintrag.route && eintrag.route !== routeRef.current) navigate(eintrag.route)
  }, [zukunft, draft, navigate])

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
    // Verworfene Entwürfe gehören in den Papierkorb, nicht in die Übersicht.
    return liste.filter((item) => !item.deletedAt)
  }, [remoteDrafts, draft])

  const trashedDrafts = useMemo(
    () =>
      remoteDrafts
        .filter((item) => item.deletedAt)
        .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '')),
    [remoteDrafts],
  )

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

  /**
   * „Entwurf zurücksetzen": die Konfiguration fällt, der Auftragskopf bleibt.
   *
   * Aufgezählt wird, was ERHALTEN bleibt, nicht was gelöscht wird. Andersherum — ein
   * Patch mit `productGroupId: undefined, dimensions: undefined, …` — müsste bei jedem
   * neuen Konfigurationsfeld nachgezogen werden, und genau das würde irgendwann jemand
   * vergessen. So kann ein neues Feld gar nicht erst überleben.
   */
  const setzeKonfigurationZurueck = useCallback(() => {
    setDraft((prev) => {
      if (!prev) return prev
      return {
        id: prev.id,
        createdAt: prev.createdAt,
        consultant: prev.consultant,
        // Schritt 1, der Auftragskopf — das ist der Teil, den niemand zweimal tippen will.
        orderNumber: prev.orderNumber,
        customerName: prev.customerName,
        branchId: prev.branchId,
        artikelnummer: prev.artikelnummer,
        variantLabel: prev.variantLabel,
        variantOf: prev.variantOf,
        zusatzfelder: prev.zusatzfelder,
        isVerification: prev.isVerification,
      }
    })
    navigate('/products')
  }, [navigate])

  /*
    30-TAGE-RÄUMUNG DES ENTWURFS-PAPIERKORBS.

    Ohne Server gibt es keinen nächtlichen Lauf; geräumt wird deshalb, wenn die Übersicht
    geladen wird. Für eine Aufbewahrungsfrist reicht das: Sie ist die Zusage „mindestens
    30 Tage", keine Stoppuhr. Referenz-Entwürfe (`isVerification`) sind ausgenommen — sie
    sind Prüfstände und keine Kundendaten.
  */
  useEffect(() => {
    const grenze = Date.now() - ENTWURF_AUFBEWAHRUNG_TAGE * 24 * 60 * 60 * 1000
    const faellige = remoteDrafts.filter((item) => {
      if (!item.deletedAt || item.isVerification) return false
      const zeitpunkt = new Date(item.deletedAt).getTime()
      return !Number.isNaN(zeitpunkt) && zeitpunkt < grenze
    })
    if (faellige.length === 0) return
    void (async () => {
      for (const eintrag of faellige) {
        try {
          await deleteProject(eintrag.id)
          setRemoteDrafts((list) => list.filter((item) => item.id !== eintrag.id))
        } catch {
          // Stillschweigend: Eine abgelaufene Frist ist kein Vorgang, über den der
          // Berater eine Fehlermeldung braucht — beim nächsten Laden wird es erneut
          // versucht.
        }
      }
    })()
  }, [remoteDrafts])

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

  /**
   * Verschiebt einen Entwurf in den Papierkorb — er bleibt in der Datenbank und trägt
   * nur `deletedAt`. Aus der Übersicht verschwindet er sofort; wiederherstellbar ist er
   * jederzeit. Endgültig entfernt wird erst über „Papierkorb leeren".
   */
  const trashDraft = useCallback<DraftContextValue['trashDraft']>(
    async (id) => {
      const quelle = remoteDrafts.find((item) => item.id === id) ?? (draft?.id === id ? draft : undefined)
      if (!quelle) return false
      const verworfen: Draft = { ...quelle, deletedAt: new Date().toISOString() }
      const ok = await pushToCloud(verworfen, { still: true })
      if (!ok) return false
      // Der verworfene Entwurf darf nicht als „aktueller" weiterleben.
      setDraft((prev) => (prev?.id === id ? null : prev))
      showToast(`Entwurf ${id} in den Papierkorb verschoben.`)
      return true
    },
    [remoteDrafts, draft, pushToCloud, showToast],
  )

  /** Holt einen Entwurf aus dem Papierkorb zurück in die Übersicht. */
  const restoreDraft = useCallback<DraftContextValue['restoreDraft']>(
    async (id) => {
      const quelle = remoteDrafts.find((item) => item.id === id)
      if (!quelle) return false
      const { deletedAt: _verworfen, ...wiederhergestellt } = quelle
      const ok = await pushToCloud(wiederhergestellt as Draft, { still: true })
      if (ok) showToast(`Entwurf ${id} wiederhergestellt.`)
      return ok
    },
    [remoteDrafts, pushToCloud, showToast],
  )

  /**
   * Leert den Papierkorb — DAS ist die endgültige Löschung aus der Datenbank.
   * Fehlgeschlagene Einträge bleiben stehen, statt die Schleife abzubrechen; der Bericht
   * nennt die Zahl, damit niemand glaubt, es sei alles weg.
   */
  const emptyTrash = useCallback<DraftContextValue['emptyTrash']>(async () => {
    const verworfene = remoteDrafts.filter((item) => item.deletedAt)
    let geloescht = 0
    for (const eintrag of verworfene) {
      try {
        await deleteProject(eintrag.id)
        setRemoteDrafts((list) => list.filter((item) => item.id !== eintrag.id))
        geloescht++
      } catch (error) {
        showToast(`${eintrag.id} konnte nicht gelöscht werden: ${(error as Error).message}`, 'error')
      }
    }
    if (geloescht > 0) showToast(`Papierkorb geleert — ${geloescht} Entwurf/Entwürfe endgültig entfernt.`)
    return geloescht
  }, [remoteDrafts, showToast])

  /**
   * „Entwurf verlassen": sichert den Stand und kehrt zur Übersicht zurück.
   *
   * Gespeichert wird alles, was überhaupt Inhalt hat — auch ein einzelner Buchstabe im
   * Kundennamen. Wer den Konfigurator verlässt, soll seine Eingabe wiederfinden; ein
   * leerer Rumpf-Entwurf würde die Übersicht dagegen nur zumüllen.
   */
  const leaveDraft = useCallback<DraftContextValue['leaveDraft']>(async () => {
    if (!draft) return true
    if (!hatInhalt(draft)) {
      setDraft(null)
      return true
    }
    const ok = await pushToCloud(draft, { still: true })
    if (ok) {
      setDraft(null)
      showToast(`Entwurf ${draft.id} gespeichert.`)
    }
    return ok
  }, [draft, pushToCloud, showToast])

  const deleteDraft = useCallback<DraftContextValue['deleteDraft']>(
    async (id) => {
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
      kannRueckgaengig: vergangenheit.length > 0,
      kannWiederherstellen: zukunft.length > 0,
      rueckgaengig,
      wiederherstellen,
      setzeKonfigurationZurueck,
      saveDraft,
      finalizeDraft,
      cloudSaving,
      loadDraft,
      deleteDraft,
      trashedDrafts,
      trashDraft,
      restoreDraft,
      emptyTrash,
      leaveDraft,
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
      vergangenheit,
      zukunft,
      rueckgaengig,
      wiederherstellen,
      setzeKonfigurationZurueck,
      saveDraft,
      finalizeDraft,
      cloudSaving,
      loadDraft,
      deleteDraft,
      trashedDrafts,
      trashDraft,
      restoreDraft,
      emptyTrash,
      leaveDraft,
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
