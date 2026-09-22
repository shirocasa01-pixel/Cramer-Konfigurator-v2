import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { STANDARD_PASSWORT, getConsultants } from '../data/consultants'
import { SEED_ROOT_ADMIN } from '../data/seedAdmin'
import { appConfig } from '../config/appConfig'
import { isValidEmail } from '../lib/validation'
import { makeId } from '../lib/frontsHelpers'
import { sha256Hex } from '../lib/passwort'
import { getMitarbeiterListe, verwerfeAusstehendeAenderungen } from '../lib/stammdatenStore'
import { useStammdaten } from '../lib/useStammdaten'
import { pruefeZugang } from '../lib/zugangStore'
import { getEinstellungen, setzeEinstellung, subscribeEinstellungen } from '../lib/einstellungenStore'
import { getSyncStatus, istTabelleFehlt, setzeBearbeiter, subscribeSyncStatus } from '../lib/supabaseSystem'
import { aktualisiereSystem, uebernehmeAlteLokaleStaende } from '../lib/systemSync'
import type { AdminSummary, AuthUser, Consultant, UserRole, UserSettings } from '../types'

/**
 * Die ANMELDUNG dieses Geräts — nur die Sitzung, kein Konto. Konten, Rollen, Passwörter
 * und Einstellungen liegen seit 09/2026 ausschließlich in Supabase (siehe
 * `lib/systemSync.ts`); gegen deren aktuellen Stand wird die Sitzung laufend geprüft.
 */
const AUTH_KEY = 'cramer-planer.auth'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  /** Login per E-Mail ODER Admin-Benutzername + Passwort (async: Prüfung in Supabase). */
  login: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string; isAdmin?: boolean }>
  logout: () => void

  // --- Benutzerverwaltung ---
  /** Das fest verankerte Hauptadmin-Konto — für die Eindeutigkeitsprüfung der Verwaltung. */
  admins: AdminSummary[]
  /** Aktive Berater aus den (Supabase-)Stammdaten. */
  consultants: Consultant[]
  settings: UserSettings
  /** Immer true: Der Root-Admin ist fest verankert (`data/seedAdmin.ts`). */
  rootInitialized: boolean
  /** Aktueller Aktivierungs-Token (für die simulierte Setup-URL). */
  activationToken: string | null
  /** Erzeugt/erneuert den simulierten Aktivierungslink und liefert den Token. */
  requestRootActivation: () => string
  /** Richtet den Root-Admin ein — seit dem fest verankerten Konto stets abgelehnt. */
  setupRootAdmin: (
    token: string,
    data: { username: string; email: string; password: string },
  ) => string | null
  setEnforceCramerEmail: (value: boolean) => void
  /** Validiert eine Mitarbeiter-E-Mail nach aktueller Regel (Testphase vs. Produktion). */
  validateStaffEmail: (email: string) => string | null

  // --- Wartungsmodus ---
  /** Effektiv aktiv = globaler Schalter (appConfig) ODER Admin-Schalter in Supabase. */
  maintenanceActive: boolean
  setMaintenanceMode: (value: boolean) => void
  /**
   * Lädt den Stand frisch aus Supabase und meldet, ob die Wartung weiterhin aktiv ist —
   * für den „Status aktualisieren"-Knopf auf der Wartungsseite.
   */
  refreshMaintenanceStatus: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthUser>
    if (!parsed.id || !parsed.email) return null
    const role: UserRole = parsed.role === 'admin' ? 'admin' : 'consultant'
    return { id: parsed.id, name: parsed.name ?? parsed.email, email: parsed.email, role, branchId: parsed.branchId }
  } catch {
    return null
  }
}

const SEED_SUMMARY: AdminSummary = {
  id: SEED_ROOT_ADMIN.id,
  username: SEED_ROOT_ADMIN.username,
  email: SEED_ROOT_ADMIN.email,
  isRoot: SEED_ROOT_ADMIN.isRoot,
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser)
  const [activationToken, setActivationToken] = useState<string | null>(null)
  const settings = useSyncExternalStore(subscribeEinstellungen, getEinstellungen, getEinstellungen)
  const syncStatus = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus)
  const stammdaten = useStammdaten()

  useEffect(() => {
    if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user))
    else localStorage.removeItem(AUTH_KEY)
    // Jede Zeile, die dieses Gerät nach Supabase schreibt, trägt ihren Urheber.
    setzeBearbeiter(user ? `${user.name} (${user.email})` : null)
  }, [user])

  /*
    SITZUNG GEGEN DEN SUPABASE-STAND PRÜFEN.

    Wird ein Konto auf einem anderen Gerät gesperrt, gelöscht oder umgestuft, soll das
    hier ankommen — nicht erst beim nächsten Anmelden. Geprüft wird erst nach dem ersten
    Abgleich, sonst entschiede ein veralteter Zwischenstand über die Sitzung.
  */
  useEffect(() => {
    if (!user || user.id === SEED_ROOT_ADMIN.id || !syncStatus.ersterAbgleichFertig) return
    const m = getMitarbeiterListe().find((x) => x.personalnr === user.id)
    if (!m || m.status !== 'aktiv') {
      setUser(null)
      return
    }
    const role: UserRole = m.rolle === 'admin' ? 'admin' : 'consultant'
    if (role !== user.role || m.name !== user.name || m.email !== user.email) {
      setUser({ ...user, role, name: m.name, email: m.email })
    }
  }, [user, stammdaten.version, syncStatus.ersterAbgleichFertig])

  /*
    Ein Berater-Gerät rechnet NIE mit Stammdaten, die nur dort liegen: Ungespeicherte
    Verwaltungs-Eingaben eines früher hier angemeldeten Administrators werden verworfen.
    Ein Administrator dagegen bringt beim Anmelden einmalig die früher nur lokal
    gespeicherten Stände (Konfigurator, Versionen, Papierkorb, Einstellungen) nach
    Supabase — nur dort, wo dort noch nichts steht.
  */
  useEffect(() => {
    if (!user) return
    if (user.role !== 'admin') verwerfeAusstehendeAenderungen()
    else void uebernehmeAlteLokaleStaende()
  }, [user?.id, user?.role])

  const login = useCallback<AuthContextValue['login']>(async (identifier, password) => {
    const id = identifier.trim().toLowerCase()

    // 1) Fest verankerter Hauptadmin (SHA-256-Vergleich, kein Klartext im Code). Er
    //    funktioniert auch ohne Verbindung zu Supabase — der Weg zurück bleibt offen.
    if (id === SEED_ROOT_ADMIN.username.toLowerCase() || id === SEED_ROOT_ADMIN.email.toLowerCase()) {
      try {
        if ((await sha256Hex(password)) === SEED_ROOT_ADMIN.passwordHash) {
          setUser({ id: SEED_ROOT_ADMIN.id, name: SEED_ROOT_ADMIN.username, email: SEED_ROOT_ADMIN.email, role: 'admin' })
          return { ok: true, isAdmin: true }
        }
      } catch {
        /* Web-Crypto nicht verfügbar → unten weiter prüfen */
      }
    }

    // 2) Alle aktiven Mitarbeiter aus den Stammdaten — Berater UND Administratoren.
    //    Ist das Konto hier (noch) unbekannt, erst frisch aus Supabase laden: Es kann
    //    gerade eben auf einem anderen Gerät angelegt worden sein.
    const finde = () =>
      getMitarbeiterListe().find((m) => m.status === 'aktiv' && m.email.trim().toLowerCase() === id)
    let mitarbeiter = finde()
    if (!mitarbeiter) {
      await aktualisiereSystem()
      mitarbeiter = finde()
    }
    if (!mitarbeiter) return { ok: false, error: 'E-Mail/Benutzername oder Passwort ist nicht korrekt.' }

    //    Eigenes Passwort, falls vergeben — sonst das Standard-Passwort. Die Prüfung
    //    läuft in der Datenbank; ohne deren Antwort wird NICHT auf das Standard-Passwort
    //    ausgewichen, denn es könnte ein eigenes gelten.
    let ergebnis: 'ok' | 'falsch' | 'kein'
    try {
      ergebnis = await pruefeZugang(mitarbeiter.personalnr, password)
    } catch (error) {
      if (!istTabelleFehlt(error)) {
        return {
          ok: false,
          error: 'Anmeldung gerade nicht möglich — keine Verbindung zu Supabase. Bitte Internetverbindung prüfen.',
        }
      }
      ergebnis = 'kein' // Tabellen noch nicht angelegt ⇒ es kann kein eigenes Passwort geben
    }
    const passt = ergebnis === 'ok' || (ergebnis === 'kein' && password === STANDARD_PASSWORT)
    if (!passt) return { ok: false, error: 'E-Mail/Benutzername oder Passwort ist nicht korrekt.' }

    const isAdmin = mitarbeiter.rolle === 'admin'
    setUser({
      id: mitarbeiter.personalnr,
      name: mitarbeiter.name,
      email: mitarbeiter.email,
      role: isAdmin ? 'admin' : 'consultant',
      branchId: mitarbeiter.filiale || undefined,
    })
    return { ok: true, isAdmin }
  }, [])

  const logout = useCallback(() => setUser(null), [])

  const requestRootActivation = useCallback(() => {
    const token = makeId('act')
    setActivationToken(token)
    return token
  }, [])

  // Der Root-Admin ist fest verankert — das frühere Onboarding bleibt nur als Hinweisseite.
  const setupRootAdmin = useCallback<AuthContextValue['setupRootAdmin']>(
    () => 'Es ist bereits ein Root-Administrator eingerichtet.',
    [],
  )

  const validateStaffEmail = useCallback<AuthContextValue['validateStaffEmail']>(
    (email) => {
      if (!isValidEmail(email)) return 'Bitte eine gültige E-Mail-Adresse eingeben.'
      if (settings.enforceCramerEmail && !email.trim().toLowerCase().endsWith('@cramer.de')) {
        return 'E-Mail muss auf „@cramer.de“ enden (Produktions-Regel aktiv).'
      }
      return null
    },
    [settings.enforceCramerEmail],
  )

  const setEnforceCramerEmail = useCallback((value: boolean) => setzeEinstellung({ enforceCramerEmail: value }), [])
  const setMaintenanceMode = useCallback((value: boolean) => setzeEinstellung({ maintenanceMode: value }), [])

  const refreshMaintenanceStatus = useCallback(async (): Promise<boolean> => {
    await aktualisiereSystem()
    return appConfig.isMaintenanceMode || getEinstellungen().maintenanceMode
  }, [])

  const maintenanceActive = appConfig.isMaintenanceMode || settings.maintenanceMode
  const consultants = useMemo(() => getConsultants(), [stammdaten.version])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isAdmin: user?.role === 'admin',
      login,
      logout,
      admins: [SEED_SUMMARY],
      consultants,
      settings,
      rootInitialized: true,
      activationToken,
      requestRootActivation,
      setupRootAdmin,
      setEnforceCramerEmail,
      validateStaffEmail,
      maintenanceActive,
      setMaintenanceMode,
      refreshMaintenanceStatus,
    }),
    [
      user,
      login,
      logout,
      consultants,
      settings,
      activationToken,
      requestRootActivation,
      setupRootAdmin,
      setEnforceCramerEmail,
      validateStaffEmail,
      maintenanceActive,
      setMaintenanceMode,
      refreshMaintenanceStatus,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth muss innerhalb von <AuthProvider> verwendet werden.')
  return ctx
}
