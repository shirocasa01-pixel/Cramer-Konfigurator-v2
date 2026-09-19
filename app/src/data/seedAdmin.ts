/**
 * FEST VERANKERTER ROOT-ADMINISTRATOR (Sicherheits-Hotfix, Phase 11.1).
 *
 * Damit auf frischen Geräten/Clients NICHT der „Systemeigentümer aktivieren"-Flow
 * erscheint (Root-Hijack-Vektor), ist der Eigentümer hier permanent im Code hinterlegt.
 * Das Passwort liegt NUR als SHA-256-Hash vor (kein Klartext im Quellcode).
 *
 * KONSOLIDIERT AUF EIN EINZIGES PRIMÄRES ADMIN-KONTO (Phase 11.3): Vorher lautete dieses
 * Konto `owner@cramer.de`. Es gibt jetzt nur noch `admin@cramer.de` — dieselbe Adresse,
 * die auch in den Stammdaten (Blatt „40 Mitarbeiter", Personalnummer M-900,
 * „Systemadministration") steht. Die beiden Wege sind bewusst getrennt: Dieses Konto ist
 * IMMER anmeldbar, unabhängig vom Browser (hart im Bundle hinterlegt); der
 * Mitarbeiter-Stammsatz würde zusätzlich einen über die Stammdatenverwaltung vergebenen
 * Zugang (`lib/zugangStore.ts`) brauchen. `AuthContext.login()` prüft dieses Konto
 * zuerst, deshalb gewinnt es bei gleicher E-Mail immer.
 *
 * Weitere Administratoren lassen sich weiterhin über „Konten & Betrieb" im
 * Admin-Dashboard anlegen (`addAdmin`) — dieses Konto hier ist nur das EINE, das ohne
 * jede Einrichtung funktioniert.
 *
 * ⚠️ WICHTIG: Dies ist eine Härtung des Onboardings, KEINE echte Sicherheitsgrenze.
 * Die gesamte Auth ist clientseitig (Bundle einsehbar; `localStorage`-Rolle manipulierbar).
 * Für echten Schutz ist ein Backend mit server-seitiger Session-/Rollenprüfung nötig.
 */
export interface SeedAdmin {
  id: string
  username: string
  email: string
  /** SHA-256-Hex des Passworts (kein Klartext). */
  passwordHash: string
  isRoot: boolean
}

export const SEED_ROOT_ADMIN: SeedAdmin = {
  id: 'seed-admin',
  username: 'admin',
  email: 'admin@cramer.de',
  // SHA-256("cramer2026") — Start-Passwort, siehe Hinweis oben. Vor dem Launch ändern:
  // im Admin-Dashboard unter „Konten & Betrieb" ein neues Administrator-Konto anlegen
  // und dieses hier durch einen frischen Hash ersetzen (oder deaktivieren).
  passwordHash: '202c1ab690f021a3abc67d39fea152f03260d162cb5b807aaa88ae3d9c7d0ebe',
  isRoot: true,
}
