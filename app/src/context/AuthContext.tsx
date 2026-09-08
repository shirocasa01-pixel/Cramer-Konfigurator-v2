import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getConsultants } from '../data/consultants'
import { SEED_ROOT_ADMIN } from '../data/seedAdmin'
import { appConfig } from '../config/appConfig'
import { isValidEmail } from '../lib/validation'
import { makeId } from '../lib/frontsHelpers'
import { sha256Hex } from '../lib/passwort'
import { getMitarbeiterListe } from '../lib/stammdatenStore'
import { hatZugang, pruefeZugang } from '../lib/zugangStore'
import type { Admin, AdminSummary, AuthUser, Consultant, UserRole, UserSettings } from '../types'

const AUTH_KEY = 'cramer-planer.auth'
const USERS_KEY = 'cramer-planer.users.v1'

/** Persistierter Benutzer-Bestand (Prototyp: localStorage; Produktion: Backend/SSO). */
interface UserStore {
  admins: Admin[]
  consultants: Consultant[]
  settings: UserSettings
  /** Einmal-Token des simulierten Root-Aktivierungslinks. */
  rootActivationToken: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  /** Login per E-Mail ODER Admin-Benutzername + Passwort (async wegen Hash-Vergleich). */
  login: (identifier: string, password: string) => Promise<{ ok: boolean; error?: string; isAdmin?: boolean }>
  logout: () => void

  // --- Benutzerverwaltung (Phase 10) ---
  /** Anzeige-Liste (Seed-Root + im Store angelegte Admins), ohne Passwörter/Hashes. */
  admins: AdminSummary[]
  consultants: Consultant[]
  settings: UserSettings
  /** true => ein Root-Admin ist eingerichtet. */
  rootInitialized: boolean
  /** Aktueller Aktivierungs-Token (für die simulierte Setup-URL). */
  activationToken: string | null
  /** Erzeugt/erneuert den simulierten Aktivierungslink und liefert den Token. */
  requestRootActivation: () => string
  /** Richtet den Root-Admin ein (validiert den Token) und meldet ihn an. */
  setupRootAdmin: (
    token: string,
    data: { username: string; email: string; password: string },
  ) => string | null
  addConsultant: (data: { name: string; email: string; password: string }) => string | null
  deleteConsultant: (id: string) => void
  addAdmin: (data: { username: string; email: string; password: string }) => string | null
  setEnforceCramerEmail: (value: boolean) => void
  /** Validiert eine Mitarbeiter-E-Mail nach aktueller Regel (Testphase vs. Produktion). */
  validateStaffEmail: (email: string) => string | null

  // --- Wartungsmodus (Phase 11) ---
  /** Effektiv aktiv = globaler Schalter (appConfig) ODER Admin-Toggle. */
  maintenanceActive: boolean
  setMaintenanceMode: (value: boolean) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Stamm-Filiale eines Beraters aus Blatt „40 Mitarbeiter".
 *
 * Geschlüsselt über die Personalnummer — sie ist die Identität des Mitarbeiters und
 * zugleich die `id` des angemeldeten Nutzers. Fehlt die Zuordnung, bleibt das
 * Filialfeld im Entwurf schlicht leer; der Berater wählt dann wie bisher selbst.
 */
function heimatFiliale(personalnr: string): string | undefined {
  return getMitarbeiterListe().find((m) => m.personalnr === personalnr)?.filiale || undefined
}

function defaultStore(): UserStore {
  return {
    admins: [],
    consultants: getConsultants(),
    settings: { enforceCramerEmail: false, maintenanceMode: false },
    rootActivationToken: null,
  }
}

function loadStore(): UserStore {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserStore>
      return {
        admins: parsed.admins ?? [],
        consultants: parsed.consultants ?? getConsultants(),
        settings: {
          enforceCramerEmail: Boolean(parsed.settings?.enforceCramerEmail),
          maintenanceMode: Boolean(parsed.settings?.maintenanceMode),
        },
        rootActivationToken: parsed.rootActivationToken ?? null,
      }
    }
  } catch {
    /* Seed unten */
  }
  return defaultStore()
}

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthUser>
    if (!parsed.id || !parsed.email) return null
    const role: UserRole = parsed.role === 'admin' ? 'admin' : 'consultant'
    return { id: parsed.id, name: parsed.name ?? parsed.email, email: parsed.email, role }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser)
  const [store, setStore] = useState<UserStore>(loadStore)

  useEffect(() => {
    if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user))
    else localStorage.removeItem(AUTH_KEY)
  }, [user])

  useEffect(() => {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(store))
    } catch {
      /* best-effort im Prototyp */
    }
  }, [store])

  // Ein Root-Admin existiert IMMER (fest verankerter Seed) ODER wurde im Store angelegt
  // → das „Systemeigentümer aktivieren"-Onboarding ist damit global deaktiviert.
  const rootInitialized = SEED_ROOT_ADMIN.isRoot || store.admins.some((admin) => admin.isRoot)

  // Anzeige-Liste fürs Dashboard: Seed-Root zuerst, dann Store-Admins (ohne Passwörter).
  const adminSummaries: AdminSummary[] = [
    {
      id: SEED_ROOT_ADMIN.id,
      username: SEED_ROOT_ADMIN.username,
      email: SEED_ROOT_ADMIN.email,
      isRoot: SEED_ROOT_ADMIN.isRoot,
    },
    ...store.admins.map((a) => ({ id: a.id, username: a.username, email: a.email, isRoot: a.isRoot })),
  ]

  const login = useCallback<AuthContextValue['login']>(
    async (identifier, password) => {
      const id = identifier.trim().toLowerCase()

      // 1) Fest verankerter Seed-Root-Admin (SHA-256-Vergleich, kein Klartext im Code).
      if (id === SEED_ROOT_ADMIN.username.toLowerCase() || id === SEED_ROOT_ADMIN.email.toLowerCase()) {
        try {
          if ((await sha256Hex(password)) === SEED_ROOT_ADMIN.passwordHash) {
            setUser({
              id: SEED_ROOT_ADMIN.id,
              name: SEED_ROOT_ADMIN.username,
              email: SEED_ROOT_ADMIN.email,
              role: 'admin',
            })
            return { ok: true, isAdmin: true }
          }
        } catch {
          /* Web-Crypto nicht verfügbar → unten weiter prüfen */
        }
      }

      // 2) Im Dashboard angelegte Admins (Prototyp: Klartext).
      const admin = store.admins.find(
        (a) => (a.email.toLowerCase() === id || a.username.toLowerCase() === id) && a.password === password,
      )
      if (admin) {
        setUser({ id: admin.id, name: admin.username, email: admin.email, role: 'admin' })
        return { ok: true, isAdmin: true }
      }

      // 3) Berater (Consultants) mit dem Prototyp-Demopasswort.
      //    Sobald der Administrator in der Berateransicht ein eigenes Passwort vergeben
      //    hat, gilt NUR noch dieses — sonst käme man mit dem allen bekannten
      //    Demopasswort weiterhin in ein Konto, das gerade abgesichert wurde.
      const consultant = store.consultants.find(
        (c) => c.email.toLowerCase() === id && c.password === password && !hatZugang(c.id),
      )
      if (consultant) {
        setUser({
          id: consultant.id,
          name: consultant.name,
          email: consultant.email,
          role: 'consultant',
          branchId: heimatFiliale(consultant.id),
        })
        return { ok: true, isAdmin: false }
      }

      // 4) Mitarbeiter aus den Stammdaten, die der Administrator in der Berateransicht
      //    freigeschaltet hat. Nur „aktiv" — ein gesperrter Stammsatz kommt nicht herein,
      //    auch wenn das Passwort noch hinterlegt ist.
      const mitarbeiter = getMitarbeiterListe().find(
        (m) => m.status === 'aktiv' && m.email.trim().toLowerCase() === id,
      )
      if (mitarbeiter && (await pruefeZugang(mitarbeiter.personalnr, password))) {
        setUser({
          id: mitarbeiter.personalnr,
          name: mitarbeiter.name,
          email: mitarbeiter.email,
          role: mitarbeiter.rolle === 'admin' ? 'admin' : 'consultant',
          branchId: mitarbeiter.filiale || undefined,
        })
        return { ok: true, isAdmin: mitarbeiter.rolle === 'admin' }
      }

      return { ok: false, error: 'E-Mail/Benutzername oder Passwort ist nicht korrekt.' }
    },
    [store.admins, store.consultants],
  )

  const logout = useCallback(() => setUser(null), [])

  const requestRootActivation = useCallback(() => {
    const token = makeId('act')
    setStore((s) => ({ ...s, rootActivationToken: token }))
    return token
  }, [])

  const setupRootAdmin = useCallback<AuthContextValue['setupRootAdmin']>(
    (token, data) => {
      if (rootInitialized) return 'Es ist bereits ein Root-Administrator eingerichtet.'
      if (!store.rootActivationToken || token !== store.rootActivationToken) {
        return 'Ungültiger oder abgelaufener Aktivierungslink.'
      }
      if (!data.username.trim()) return 'Benutzername ist erforderlich.'
      if (!isValidEmail(data.email)) return 'Bitte eine gültige E-Mail-Adresse angeben.'
      if (data.password.length < 6) return 'Das Passwort muss mindestens 6 Zeichen haben.'
      const admin: Admin = {
        id: makeId('adm'),
        username: data.username.trim(),
        email: data.email.trim(),
        password: data.password,
        isRoot: true,
      }
      setStore((s) => ({ ...s, admins: [...s.admins, admin], rootActivationToken: null }))
      setUser({ id: admin.id, name: admin.username, email: admin.email, role: 'admin' })
      return null
    },
    [rootInitialized, store.rootActivationToken],
  )

  const validateStaffEmail = useCallback<AuthContextValue['validateStaffEmail']>(
    (email) => {
      if (!isValidEmail(email)) return 'Bitte eine gültige E-Mail-Adresse eingeben.'
      if (store.settings.enforceCramerEmail && !email.trim().toLowerCase().endsWith('@cramer.de')) {
        return 'E-Mail muss auf „@cramer.de“ enden (Produktions-Regel aktiv).'
      }
      return null
    },
    [store.settings.enforceCramerEmail],
  )

  const addConsultant = useCallback<AuthContextValue['addConsultant']>(
    (data) => {
      if (!data.name.trim()) return 'Name ist erforderlich.'
      const emailError = validateStaffEmail(data.email)
      if (emailError) return emailError
      if (data.password.length < 6) return 'Das Passwort muss mindestens 6 Zeichen haben.'
      const exists = store.consultants.some(
        (c) => c.email.toLowerCase() === data.email.trim().toLowerCase(),
      )
      if (exists) return 'Für diese E-Mail existiert bereits ein Konto.'
      const consultant: Consultant = {
        id: makeId('c'),
        name: data.name.trim(),
        email: data.email.trim(),
        password: data.password,
      }
      setStore((s) => ({ ...s, consultants: [...s.consultants, consultant] }))
      return null
    },
    [store.consultants, validateStaffEmail],
  )

  const deleteConsultant = useCallback((id: string) => {
    setStore((s) => ({ ...s, consultants: s.consultants.filter((c) => c.id !== id) }))
  }, [])

  const addAdmin = useCallback<AuthContextValue['addAdmin']>(
    (data) => {
      if (!data.username.trim()) return 'Benutzername ist erforderlich.'
      if (!isValidEmail(data.email)) return 'Bitte eine gültige E-Mail-Adresse angeben.'
      if (data.password.length < 6) return 'Das Passwort muss mindestens 6 Zeichen haben.'
      const exists = store.admins.some(
        (a) =>
          a.username.toLowerCase() === data.username.trim().toLowerCase() ||
          a.email.toLowerCase() === data.email.trim().toLowerCase(),
      )
      if (exists) return 'Benutzername oder E-Mail ist bereits vergeben.'
      const admin: Admin = {
        id: makeId('adm'),
        username: data.username.trim(),
        email: data.email.trim(),
        password: data.password,
        isRoot: false,
      }
      setStore((s) => ({ ...s, admins: [...s.admins, admin] }))
      return null
    },
    [store.admins],
  )

  const setEnforceCramerEmail = useCallback((value: boolean) => {
    setStore((s) => ({ ...s, settings: { ...s.settings, enforceCramerEmail: value } }))
  }, [])

  const setMaintenanceMode = useCallback((value: boolean) => {
    setStore((s) => ({ ...s, settings: { ...s.settings, maintenanceMode: value } }))
  }, [])

  // Global (Env/Code) ODER Admin-Toggle.
  const maintenanceActive = appConfig.isMaintenanceMode || store.settings.maintenanceMode

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isAdmin: user?.role === 'admin',
      login,
      logout,
      admins: adminSummaries,
      consultants: store.consultants,
      settings: store.settings,
      rootInitialized,
      activationToken: store.rootActivationToken,
      requestRootActivation,
      setupRootAdmin,
      addConsultant,
      deleteConsultant,
      addAdmin,
      setEnforceCramerEmail,
      validateStaffEmail,
      maintenanceActive,
      setMaintenanceMode,
    }),
    [
      user,
      store.admins,
      store.consultants,
      store.settings,
      store.rootActivationToken,
      rootInitialized,
      login,
      logout,
      requestRootActivation,
      setupRootAdmin,
      addConsultant,
      deleteConsultant,
      addAdmin,
      setEnforceCramerEmail,
      validateStaffEmail,
      maintenanceActive,
      setMaintenanceMode,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth muss innerhalb von <AuthProvider> verwendet werden.')
  return ctx
}
