import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { Draft } from '../../types'
import { konstruktion } from '../../lib/konstruktion'
import { AnsichtsKontext, KonstruktionsAnsicht, type Ansicht } from './ansichten'
import styles from './Konstruktion2D.module.css'

/**
 * SKIZZE ALS BILD FÜR DAS AV-PDF.
 *
 * Rendert eine Ansicht unsichtbar mit denselben Bauteilen wie auf dem Bildschirm, übernimmt
 * die berechneten Stile direkt in die SVG (sonst fehlen im Bild alle CSS-Klassen) und
 * rastert sie in hoher Auflösung. Bei 2.400 px Breite entspricht das auf einer A4-Seite gut
 * 300 dpi — Maßketten und Zahlen bleiben im Druck scharf.
 *
 * Bewusst ein Bild und keine Vektor-Übertragung: jsPDF kennt kein SVG, und ein zweiter
 * Zeichenweg nur für das PDF würde früher oder später anders aussehen als der Bildschirm.
 */

export interface SkizzenBild {
  dataUrl: string
  breite: number
  hoehe: number
}

const BILDSCHIRM_BREITE = 1000
/** Stile, die die Zeichnung braucht — alles andere bleibt Standard. */
const STILE = ['fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'opacity', 'font-family', 'font-weight'] as const

function uebertrageStile(original: Element, kopie: Element, faktor: number) {
  const s = getComputedStyle(original)
  const teile: string[] = []
  for (const name of STILE) {
    let wert = s.getPropertyValue(name)
    if (!wert) continue
    // Strichmuster sind wie die Linienstärke Bildschirm-Pixel (non-scaling-stroke).
    if (name === 'stroke-dasharray' && wert !== 'none') wert = wert.replace(/[\d.]+/g, (n) => String(Number(n) * faktor))
    teile.push(`${name}:${wert}`)
  }
  const breite = parseFloat(s.getPropertyValue('stroke-width'))
  if (Number.isFinite(breite)) teile.push(`stroke-width:${breite * faktor}px`)
  kopie.setAttribute('style', teile.join(';'))
}

function ladeBild(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fehler) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => fehler(new Error('Skizze konnte nicht gerastert werden.'))
    img.src = src
  })
}

/**
 * Die gewünschten Ansichten eines Entwurfs als PNG. Leeres Ergebnis, wenn der Entwurf noch
 * keine vollständigen Korpusmaße hat.
 */
export async function skizzenBilder(
  draft: Draft,
  ansichten: Ansicht[] = ['vorne', 'innen', 'oben'],
  zielBreite = 2400,
): Promise<Partial<Record<Ansicht, SkizzenBild>>> {
  const m = konstruktion(draft)
  if (!m) return {}
  const ergebnis: Partial<Record<Ansicht, SkizzenBild>> = {}

  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${BILDSCHIRM_BREITE}px;pointer-events:none;`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    for (const ansicht of ansichten) {
      flushSync(() =>
        root.render(
          <AnsichtsKontext.Provider value={{ klasse: `${styles.svg} ${styles.svgDruck}` }}>
            <KonstruktionsAnsicht m={m} ansicht={ansicht} />
          </AnsichtsKontext.Provider>,
        ),
      )
      const svg = host.querySelector('svg')
      if (!svg) continue
      const [, , vbB, vbH] = (svg.getAttribute('viewBox') ?? '0 0 1 1').split(' ').map(Number)
      const breite = zielBreite
      const hoehe = Math.round((zielBreite * vbH) / vbB)
      const faktor = zielBreite / svg.getBoundingClientRect().width

      const kopie = svg.cloneNode(true) as SVGSVGElement
      const quellen = [svg, ...svg.querySelectorAll('*')]
      const ziele = [kopie, ...kopie.querySelectorAll('*')]
      quellen.forEach((q, i) => uebertrageStile(q, ziele[i], faktor))
      kopie.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      kopie.setAttribute('width', String(breite))
      kopie.setAttribute('height', String(hoehe))
      kopie.removeAttribute('class')

      const text = new XMLSerializer().serializeToString(kopie)
      const img = await ladeBild(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`)
      const canvas = document.createElement('canvas')
      canvas.width = breite
      canvas.height = hoehe
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, breite, hoehe)
      // Schwarz-weiß wie die Cramer-AV-Zeichnung — die Bildschirmfarben gehören nicht in den Druck.
      ctx.filter = 'grayscale(1)'
      ctx.drawImage(img, 0, 0, breite, hoehe)
      ergebnis[ansicht] = { dataUrl: canvas.toDataURL('image/png'), breite, hoehe }
    }
  } finally {
    root.unmount()
    host.remove()
  }
  return ergebnis
}
