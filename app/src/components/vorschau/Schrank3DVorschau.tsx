import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Draft } from '../../types'
import { formatMassZahl } from '../../lib/format'
import { schrankModell, type BauteilArt, type FrontVorschau, type SchrankModell } from '../../lib/schrankModell'
import styles from './Schrank3DVorschau.module.css'

/**
 * 3D-VORSCHAU DES KLEIDERSCHRANKS (Überarbeitung 10, Prototyp).
 *
 * Zeigt die Korpus-Module aus dem Schritt „Maße" — Breiten (50er, 60er, 80er, 100er …), Höhe,
 * Tiefe, Anzahl, Abschlusssets — und darüber wahlweise die geplanten Fronten, Standard-Drehtüren,
 * zweiläufige Schiebetüren oder keine Fronten. Jede Änderung der Maße baut das Modell neu.
 *
 * Die Geometrie kommt vollständig aus `lib/schrankModell.ts`; hier wird nur gezeichnet. Three.js
 * wird mit dieser Datei lazy geladen (siehe `pages/Dimensions/Dimensions.tsx`).
 */

const MODI: Array<{ id: FrontVorschau; label: string }> = [
  { id: 'geplant', label: 'Geplante Fronten' },
  { id: 'drehtueren', label: 'Drehtüren' },
  { id: 'schiebetueren', label: 'Schiebetüren' },
  { id: 'ohne', label: 'Ohne Fronten' },
]

/** Anschauungsfarben — bewusst neutral, keine Materialtreue. */
const FARBE: Record<BauteilArt, { farbe: number; rau?: number }> = {
  korpus: { farbe: 0xe9e4da },
  rueckwand: { farbe: 0xdcd6ca },
  abschlussset: { farbe: 0xc9c2b5 },
  sockel: { farbe: 0x5b5a57 },
  drehtuer: { farbe: 0xf5f3ef },
  schublade: { farbe: 0xefece6 },
  schiebetuer: { farbe: 0xe6e2da },
  klappe: { farbe: 0xf1eee8 },
  griff: { farbe: 0x3b3b3d, rau: 0.35 },
  kleiderstange: { farbe: 0xa8a9ad, rau: 0.25 },
}

/** Teile, die eine Kantenlinie bekommen (macht Fugen und Module lesbar). */
const MIT_KANTE = new Set<BauteilArt>(['korpus', 'abschlussset', 'drehtuer', 'schublade', 'schiebetuer', 'klappe'])

interface Buehne {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  gruppe: THREE.Group
  boden: THREE.Mesh
  frame: number
  passendFuer?: string
}

function leereGruppe(gruppe: THREE.Group) {
  for (const kind of [...gruppe.children]) {
    gruppe.remove(kind)
    kind.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      const mat = m.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
  }
}

function baueModell(gruppe: THREE.Group, modell: SchrankModell) {
  leereGruppe(gruppe)
  const materialien = new Map<BauteilArt, THREE.MeshStandardMaterial>()
  const material = (art: BauteilArt) => {
    let m = materialien.get(art)
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: FARBE[art].farbe, roughness: FARBE[art].rau ?? 0.8, metalness: art === 'griff' || art === 'kleiderstange' ? 0.6 : 0 })
      materialien.set(art, m)
    }
    return m
  }
  const kante = new THREE.LineBasicMaterial({ color: 0x8f897e, transparent: true, opacity: 0.55 })
  for (const t of modell.bauteile) {
    if (t.art === 'kleiderstange' && modell.fronten !== 'ohne') continue
    if (t.b <= 0 || t.h <= 0 || t.t <= 0) continue
    const geo = new THREE.BoxGeometry(t.b / 100, t.h / 100, t.t / 100)
    const mesh = new THREE.Mesh(geo, material(t.art))
    mesh.position.set((t.x + t.b / 2) / 100, (t.y + t.h / 2) / 100, (t.z + t.t / 2) / 100)
    mesh.castShadow = t.art !== 'griff'
    mesh.receiveShadow = true
    gruppe.add(mesh)
    if (MIT_KANTE.has(t.art)) {
      const linien = new THREE.LineSegments(new THREE.EdgesGeometry(geo), kante)
      linien.position.copy(mesh.position)
      gruppe.add(linien)
    }
  }
}

/** Kamera so stellen, dass der ganze Schrank schräg von vorne im Bild ist. */
function passeKameraAn(b: Buehne, modell: SchrankModell) {
  const breite = modell.breiteCm / 100
  const hoehe = modell.hoeheCm / 100
  const tiefe = modell.tiefeCm / 100
  const ziel = new THREE.Vector3(breite / 2, hoehe / 2, tiefe / 2)
  const fov = (b.camera.fov * Math.PI) / 180
  const groesse = Math.max(hoehe, breite / Math.max(b.camera.aspect, 0.6))
  const abstand = (groesse / 2 / Math.tan(fov / 2)) * 1.12
  b.controls.target.copy(ziel)
  b.camera.position.set(ziel.x + abstand * 0.38, ziel.y + abstand * 0.12, ziel.z + abstand)
  b.camera.near = 0.05
  b.camera.far = abstand * 10
  b.camera.updateProjectionMatrix()
  b.boden.position.set(breite / 2, 0, tiefe / 2)
  b.controls.update()
}

export default function Schrank3DVorschau({ draft }: { draft: Draft }) {
  const [modus, setModus] = useState<FrontVorschau>('geplant')
  const [webglFehlt, setWebglFehlt] = useState(false)
  const buehneRef = useRef<HTMLDivElement>(null)
  const buehne = useRef<Buehne | null>(null)

  const { korpusGrunddaten, fronts, seriesId, ausstattung } = draft
  const modell = useMemo(
    () => schrankModell({ korpusGrunddaten, fronts, seriesId, ausstattung }, modus),
    [korpusGrunddaten, fronts, seriesId, ausstattung, modus],
  )

  // Bühne einmalig aufbauen und beim Verlassen vollständig freigeben.
  useEffect(() => {
    const el = buehneRef.current
    if (!el) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      setWebglFehlt(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.maxPolarAngle = Math.PI * 0.5
    controls.minDistance = 0.8
    controls.maxDistance = 25

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c6, 1.5))
    const sonne = new THREE.DirectionalLight(0xffffff, 1.6)
    sonne.position.set(-3, 6, 6)
    sonne.castShadow = true
    sonne.shadow.mapSize.set(2048, 2048)
    Object.assign(sonne.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 30 })
    scene.add(sonne)

    const boden = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.16 }))
    boden.rotation.x = -Math.PI / 2
    boden.receiveShadow = true
    scene.add(boden)

    const gruppe = new THREE.Group()
    scene.add(gruppe)

    const b: Buehne = { renderer, scene, camera, controls, gruppe, boden, frame: 0 }
    buehne.current = b

    const groesse = () => {
      const w = el.clientWidth || 1
      const h = el.clientHeight || 1
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    groesse()
    const beobachter = new ResizeObserver(groesse)
    beobachter.observe(el)

    const zeichne = () => {
      b.frame = requestAnimationFrame(zeichne)
      controls.update()
      renderer.render(scene, camera)
    }
    zeichne()

    return () => {
      cancelAnimationFrame(b.frame)
      beobachter.disconnect()
      controls.dispose()
      leereGruppe(gruppe)
      boden.geometry.dispose()
      ;(boden.material as THREE.Material).dispose()
      renderer.dispose()
      renderer.domElement.remove()
      buehne.current = null
    }
  }, [])

  // Modell neu bauen, sobald sich Maße, Fronten oder die Ansicht ändern.
  useEffect(() => {
    const b = buehne.current
    if (!b) return
    if (!modell) {
      leereGruppe(b.gruppe)
      return
    }
    baueModell(b.gruppe, modell)
    // Die Kamera folgt nur geänderten Außenmaßen — wer gedreht hat, behält beim Umschalten der
    // Ansicht seinen Blickwinkel.
    const schluessel = `${modell.breiteCm}|${modell.hoeheCm}|${modell.tiefeCm}`
    if (b.passendFuer !== schluessel) {
      passeKameraAn(b, modell)
      b.passendFuer = schluessel
    }
  }, [modell])

  if (webglFehlt) {
    return (
      <section className={styles.wrap} aria-label="3D-Vorschau">
        <p className={styles.fehler}>Die 3D-Vorschau braucht WebGL — in diesem Browser ist es nicht verfügbar.</p>
      </section>
    )
  }

  return (
    <section className={styles.wrap} aria-label="3D-Vorschau">
      <div className={styles.head}>
        <h2 className={styles.title}>3D-Vorschau</h2>
        <span className={styles.badge}>Prototyp</span>
      </div>
      <div className={styles.chips} role="group" aria-label="Fronten in der Vorschau">
        {MODI.map((m) => {
          const gesperrt = m.id === 'geplant' && !modell?.hatGeplanteFronten
          const aktiv = (modell?.fronten ?? modus) === m.id
          return (
            <button
              key={m.id}
              type="button"
              className={aktiv ? styles.chipActive : styles.chip}
              aria-pressed={aktiv}
              disabled={gesperrt}
              title={gesperrt ? 'Fronten werden im Schritt „Fronten" geplant.' : undefined}
              onClick={() => setModus(m.id)}
            >
              {m.label}
            </button>
          )
        })}
      </div>
      <div ref={buehneRef} className={styles.buehne} data-testid="schrank-3d" />
      {modell ? (
        <p className={styles.masse}>
          {modell.korpusse.length} {modell.korpusse.length === 1 ? 'Korpus' : 'Korpi'} (
          {modell.korpusse.map((k) => `${formatMassZahl(k.breiteCm)}er`).join(' · ')}) · Höhe ca.{' '}
          {formatMassZahl(modell.hoeheCm)} cm · Tiefe {formatMassZahl(modell.tiefeCm)} cm
          {modell.aussenbreiteCm != null ? ` · Außenbreite ca. ${formatMassZahl(modell.aussenbreiteCm)} cm` : ''}
          {modell.schiebetueren > 0 ? ` · ${modell.schiebetueren} Schiebetüren` : ''}
        </p>
      ) : (
        <p className={styles.hinweis}>Sobald Höhe, Tiefe und jede Korpusbreite feststehen, erscheint hier der Schrank.</p>
      )}
      <p className={styles.hinweis}>
        Ziehen zum Drehen, Mausrad oder zwei Finger zum Zoomen. Anschauungsmodell — maßgeblich sind das Außenmaß
        oben und die AV.
      </p>
    </section>
  )
}
