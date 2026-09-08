/**
 * PASSWÖRTER — hashen und prüfen, an einer Stelle.
 *
 * SHA-256 über die Web-Crypto-API. Der Login läuft stets in sicherem Kontext
 * (localhost oder HTTPS), dort ist `crypto.subtle` verfügbar.
 *
 * Warum überhaupt hashen, wo der Prototyp doch im localStorage speichert: damit im
 * Browser-Speicher, im Excel-Export und in einem versehentlich weitergegebenen
 * Bildschirmfoto kein lesbares Passwort steht. Das ersetzt keine serverseitige
 * Anmeldung — SHA-256 ohne Salt und ohne Iterationen ist gegen einen ernsthaften
 * Angreifer wenig wert. Sobald die Anmeldung ans Backend geht, gehört sie dorthin
 * mit Argon2id oder bcrypt; diese Datei ist dann der einzige Anpassungspunkt.
 */

/** SHA-256-Hex eines Textes. */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Mindestlänge — dieselbe Regel wie im Admin-Dashboard. */
export const PASSWORT_MINDESTLAENGE = 8

/**
 * Prüft ein Wunschpasswort. Liefert die Beanstandung im Klartext oder `null`.
 *
 * Bewusst nur die Länge und keine Zeichenklassen-Pflicht: „Muss eine Ziffer und ein
 * Sonderzeichen enthalten" erzeugt erfahrungsgemäß `Sommer2024!` und einen Zettel am
 * Bildschirm, nicht mehr Sicherheit.
 */
export function pruefePasswortRegeln(klartext: string): string | null {
  if (klartext.length < PASSWORT_MINDESTLAENGE) {
    return `Das Passwort muss mindestens ${PASSWORT_MINDESTLAENGE} Zeichen haben.`
  }
  return null
}

/** Klartext → Hash, wie er gespeichert wird. */
export async function hashPasswort(klartext: string): Promise<string> {
  return sha256Hex(klartext)
}

/** Vergleicht eine Eingabe gegen einen gespeicherten Hash. */
export async function passwortStimmt(klartext: string, hash: string): Promise<boolean> {
  if (!hash) return false
  try {
    return (await sha256Hex(klartext)) === hash
  } catch {
    return false
  }
}
