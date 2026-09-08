/**
 * FEST VERANKERTER ROOT-ADMINISTRATOR (Sicherheits-Hotfix, Phase 11.1).
 *
 * Damit auf frischen Geräten/Clients NICHT der „Systemeigentümer aktivieren"-Flow
 * erscheint (Root-Hijack-Vektor), ist der Eigentümer hier permanent im Code hinterlegt.
 * Das Passwort liegt NUR als SHA-256-Hash vor (kein Klartext im Quellcode).
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
  id: 'seed-owner',
  username: 'owner',
  email: 'owner@cramer.de',
  // SHA-256("cramer-root-2026")
  passwordHash: '5594a0a125cc7d81aa2a84dd956a543e1ffd8be12134a990d791890a02f3db07',
  isRoot: true,
}
