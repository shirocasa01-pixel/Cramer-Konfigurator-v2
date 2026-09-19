import { Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { useAuth } from './context/AuthContext'
import { setzeEditorModus } from './lib/editorModus'
import LoginPage from './pages/Login/Login'
import WartungPage from './pages/Wartung/Wartung'
import DashboardPage from './pages/Dashboard/Dashboard'
import TrashPage from './pages/Trash/Trash'
import NewDraftPage from './pages/NewDraft/NewDraft'
import ProductSelectionPage from './pages/ProductSelection/ProductSelection'
import KorpusPage from './pages/Korpus/Korpus'
import DimensionsPage from './pages/Dimensions/Dimensions'
import AusstattungPage from './pages/Ausstattung/Ausstattung'
import FrontsPage from './pages/Fronts/Fronts'
import SummaryPage from './pages/Summary/Summary'
import MobileScanPage from './pages/MobileScan/MobileScan'
import RootActivatePage from './pages/Admin/RootActivate'
import RootSetupPage from './pages/Admin/RootSetup'
import AdminDashboardPage from './pages/Admin/AdminDashboard'

/**
 * Schützt Routen, die eine aktive Anmeldung voraussetzen (Berater-Pfad).
 *
 * ROLLENBASIERTE WARTUNGS-PRÜFUNG (Phase 11.3) — hier und nur hier, an einer einzigen
 * Stelle statt einer Sperre, die vor dem gesamten Routing lag (frühere Fassung; genau
 * die Vermischung führte zur gemeldeten blockierten Login-Maske):
 *
 *   ADMINISTRATOR   ignoriert den Wartungsmodus vollständig — die Prüfung unten
 *                   greift für ihn gar nicht erst, egal welche dieser Routen er ansieht.
 *   BERATER         geht bei aktivem Wartungsmodus auf `/wartung`. Das gilt nicht nur
 *                   unmittelbar nach dem Login, sondern durchgehend: `maintenanceActive`
 *                   wird bei jedem Render neu gelesen, ein Berater MITTEN in der
 *                   Sitzung wird also ebenso herausgenommen, sobald ein Administrator
 *                   den Modus einschaltet. Alles andere liefe dem Zweck einer Wartung
 *                   zuwider — sie soll aktive Nutzung beenden, nicht nur neue verhindern.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, maintenanceActive } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin && maintenanceActive) return <Navigate to="/wartung" replace />
  return <>{children}</>
}

/**
 * Schützt Admin-Routen: nur mit Administrator-Rolle erreichbar.
 * Der Wartungsmodus hat hier bewusst KEINE Prüfung — Administratoren sind von ihm
 * strukturell ausgenommen, nicht per Sonderfall.
 */
function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

/**
 * Schützt die Wartungsseite selbst — sie ist kein Ziel, das man „anwählt", sondern nur
 * gültig, solange alle drei Bedingungen gelten: angemeldet, kein Administrator, Wartung
 * aktiv. Fällt eine davon weg (Wartung endet, Abmeldung, Administrator navigiert direkt
 * dorthin), leitet diese Prüfung sofort weiter — dieselbe Route wird dadurch nie zur
 * Sackgasse.
 */
function RequireWartung({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, maintenanceActive } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (isAdmin) return <Navigate to="/admin" replace />
  if (!maintenanceActive) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { isAuthenticated, isAdmin, maintenanceActive } = useAuth()

  /*
    Die Bearbeitungsschicht folgt der Rolle, nicht dem Verlauf.

    Jede Stift-, Plus- und Inspector-Anzeige fragt zwar `useBearbeitungsModus()` und wird
    damit ohnehin ausgeblendet — aber der Schalter selbst soll gar nicht erst
    angeschaltet bleiben, wenn sich ein Berater anmeldet, während der Administrator den
    Modus noch offen hatte. Abmelden und Kontowechsel laufen beide hier durch.
  */
  useEffect(() => {
    if (!isAdmin) setzeEditorModus(false)
  }, [isAdmin])

  return (
    <Routes>
      {/*
        Die Anmeldemaske prüft NIE auf Wartung — das ist die ganze Korrektur dieser
        Überarbeitung. Ist bereits jemand angemeldet, geht es rollen- und statusgerecht
        weiter: Administrator immer zu `/admin`, Berater bei aktiver Wartung zu
        `/wartung`, sonst zum Dashboard.
      */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={isAdmin ? '/admin' : maintenanceActive ? '/wartung' : '/'} replace />
          ) : (
            <LoginPage />
          )
        }
      />

      <Route path="/wartung" element={<RequireWartung><WartungPage /></RequireWartung>} />

      {/* Öffentliche Mobile-Scan-Ansicht (per QR geöffnet, ohne Login) */}
      <Route path="/scan/:draftId" element={<MobileScanPage />} />


      {/* Phase 10 – Admin-Onboarding (öffentlich: Aktivierung & Einrichtung) */}
      <Route path="/admin/activate" element={<RootActivatePage />} />
      <Route path="/admin/setup" element={<RootSetupPage />} />
      {/* Phase 10 – Admin-Dashboard (nur Administrator) */}
      <Route path="/admin" element={<RequireAdmin><AdminDashboardPage /></RequireAdmin>} />

      {/* Phase 6 – Dashboard (Startseite) */}
      <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      {/* Phase 2 – Neuen Entwurf anlegen */}
      <Route path="/papierkorb" element={<RequireAuth><TrashPage /></RequireAuth>} />

      <Route path="/new" element={<RequireAuth><NewDraftPage /></RequireAuth>} />
      {/* Phase 3 – Produktgruppen- & Serien-Auswahl */}
      <Route path="/products" element={<RequireAuth><ProductSelectionPage /></RequireAuth>} />
      {/* Schritt 4 – Material (Route bleibt /korpus) */}
      <Route path="/korpus" element={<RequireAuth><KorpusPage /></RequireAuth>} />
      {/* Phase 4.5 – Maße & Segmente */}
      <Route path="/dimensions" element={<RequireAuth><DimensionsPage /></RequireAuth>} />
      {/* Schritt 6 (Refugium) – Ausstattung-Vorauswahl */}
      <Route path="/ausstattung" element={<RequireAuth><AusstattungPage /></RequireAuth>} />
      {/* Phase 5 – Fronten & Abschlüsse */}
      <Route path="/fronts" element={<RequireAuth><FrontsPage /></RequireAuth>} />
      {/* Phase 6 – Zusammenfassung & Abschluss */}
      <Route path="/summary" element={<RequireAuth><SummaryPage /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
