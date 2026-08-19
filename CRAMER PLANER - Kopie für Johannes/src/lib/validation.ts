/** Bewusst tolerante, robuste E-Mail-Prüfung (kein RFC-Vollparser nötig). */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export interface LoginErrors {
  email?: string
  password?: string
}

/**
 * Validiert die Login-Eingaben und liefert feldbezogene Fehlermeldungen.
 * Leeres Ergebnis-Objekt => Eingaben sind formal gültig.
 */
export function validateLogin(email: string, password: string): LoginErrors {
  const errors: LoginErrors = {}

  if (!email.trim()) {
    errors.email = 'Bitte E-Mail-Adresse eingeben.'
  } else if (!isValidEmail(email)) {
    errors.email = 'Bitte eine gültige E-Mail-Adresse eingeben.'
  }

  if (!password) {
    errors.password = 'Bitte Passwort eingeben.'
  }

  return errors
}
