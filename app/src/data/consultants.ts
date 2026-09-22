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
 * Zustand.
 *
 * EINHEITLICHES STANDARD-PASSWORT (09/2026): Jedes aktive Konto aus „40 Mitarbeiter" —
 * Berater wie Administratoren — meldet sich mit `cramer2026` an, solange der
 * Administrator in der Benutzerverwaltung kein eigenes Passwort vergeben hat. Der fest
 * verankerte Hauptadmin (`data/seedAdmin.ts`) trägt denselben Wert als Hash.
 *
 * ACHTUNG: Ein allen bekanntes Passwort ist ein Start-Zustand, keine Absicherung. Vor dem
 * echten Betrieb je Konto ein eigenes Passwort vergeben bzw. auf echte Authentifizierung
 * (Backend / SSO) umstellen – siehe README, Abschnitt „Sicherheitshinweis".
 */
export const STANDARD_PASSWORT = 'cramer2026'

/**
 * Funktion statt Konstante: Ein in der Verwaltung gesperrter Berater soll auch aus der
 * Anmeldung verschwinden — eine beim Modulstart eingefrorene Liste hätte ihn behalten.
 */
export function getConsultants(): Consultant[] {
  return getBerater().map((m) => ({
    id: m.personalnr,
    name: m.name,
    email: m.email,
    password: STANDARD_PASSWORT,
  }))
}
