import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './context/AuthContext'
import { MaintenanceOverlay } from './components/layout/MaintenanceOverlay'
import LoginPage from './pages/Login/Login'
import DashboardPage from './pages/Dashboard/Dashboard'
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

/** Schützt Routen, die eine aktive Anmeldung voraussetzen (Berater-Pfad). */
function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Schützt Admin-Routen: nur mit Administrator-Rolle erreichbar. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { isAuthenticated, isAdmin, maintenanceActive } = useAuth()
  const location = useLocation()

  // Wartungsmodus fängt das gesamte Routing ab – außer Login/Admin, damit
  // Administratoren den Modus wieder deaktivieren können.
  const maintenanceExempt =
    location.pathname === '/login' || location.pathname.startsWith('/admin')
  if (maintenanceActive && !maintenanceExempt) return <MaintenanceOverlay />

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={isAdmin ? '/admin' : '/'} replace /> : <LoginPage />}
      />

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
      <Route path="/new" element={<RequireAuth><NewDraftPage /></RequireAuth>} />
      {/* Phase 3 – Produktgruppen- & Serien-Auswahl */}
      <Route path="/products" element={<RequireAuth><ProductSelectionPage /></RequireAuth>} />
      {/* Phase 4 – Korpus-Konfiguration */}
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
