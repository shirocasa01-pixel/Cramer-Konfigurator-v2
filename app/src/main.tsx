import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { DraftProvider } from './context/DraftContext'
import { ToastProvider } from './context/ToastContext'
import './styles/tokens.css'
import './styles/global.css'
import { starteSystemSync } from './lib/systemSync'

// Stammdaten, Konten und Einstellungen kommen aus Supabase — der Abgleich beginnt,
// bevor irgendetwas angezeigt wird (siehe SystemLadeSchirm in App.tsx).
starteSystemSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <DraftProvider>
            <App />
          </DraftProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
