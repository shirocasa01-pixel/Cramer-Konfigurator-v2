import { getBerater } from '../lib/stammdaten'
import type { Consultant } from '../types'

/**
 * Berater-Konten für den Prototyp.
 *
 * Personen, E-Mails und Filialzuordnung kommen aus den Stammdaten, Blatt
 * „40 Mitarbeiter" — ein neuer Berater ist eine Zeile in der Mappe, keine Code-Änderung.
 * Gelesen werden nur Zeilen mit Rolle `berater` und Status `aktiv`.
 *
 * Das Passwort steht bewusst NICHT in der Mappe: Klartext-Passwörter in einer Datei,
 * die per Mail und OneDrive herumgereicht wird, wären schlechter als der bisherige
 * Zustand. Für den Prototyp gilt deshalb weiterhin ein gemeinsames Demo-Passwort
 * (das war auch vorher schon für alle drei Konten dasselbe).
 *
 * ACHTUNG: Nur zu Demonstrationszwecken. In Produktion durch echte Authentifizierung
 * (Backend / SSO) ersetzen – siehe README, Abschnitt „Sicherheitshinweis".
 */
export const PROTOTYP_PASSWORT = 'cramer2026'

/**
 * Funktion statt Konstante: Ein in der Verwaltung gesperrter Berater soll auch aus der
 * Anmeldung verschwinden — eine beim Modulstart eingefrorene Liste hätte ihn behalten.
 */
export function getConsultants(): Consultant[] {
  return getBerater().map((m) => ({
    id: m.personalnr,
    name: m.name,
    email: m.email,
    password: PROTOTYP_PASSWORT,
  }))
}
