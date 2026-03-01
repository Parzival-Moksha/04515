'use client'

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// OASIS - Main 3D Scene
// The canvas upon which worlds are built
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, PointerLockControls, KeyboardControls, useKeyboardControls, Stars, Grid, Html, Line, TransformControls, Environment, useProgress } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Suspense, useState, useRef, useContext, useEffect, useCallback, useTransition } from 'react'
import * as THREE from 'three'

// ═══════════════════════════════════════════════════════════════════════════════
// ─═̷─═̷─🌐─═̷─═̷─{ BASEPATH ASSET RESOLVER }─═̷─═̷─🌐─═̷─═̷─
// Next.js basePath doesn't auto-prefix public/ file references.
// THREE.DefaultLoadingManager intercepts ALL asset fetches before they fire.
// ═══════════════════════════════════════════════════════════════════════════════
const OASIS_BASE = process.env.NEXT_PUBLIC_BASE_PATH || ''
if (OASIS_BASE) {
  THREE.DefaultLoadingManager.setURLModifier((url: string) => {
    if (url.startsWith('/') && !url.startsWith(OASIS_BASE)) {
      return OASIS_BASE + url
    }
    return url
  })
}

import { useOasisStore } from '../store/oasisStore'

import type { OasisSettings } from './scene-lib'
import { defaultSettings, SKY_BACKGROUNDS } from './scene-lib'
import { SettingsContext, DragContext } from './scene-lib'
import { ForgeRealm } from './realms/ForgeRealm'
import PanoramaCapture from './forge/PanoramaCapture'
import { WizardConsole } from './forge/WizardConsole'
// AssetExplorerWindow deleted — functionality lives in WizardConsole
import { ObjectInspector } from './forge/ObjectInspector'
import { ActionLogButton, ActionLogPanel } from './forge/ActionLog'
import { useWorldLoader } from './forge/WorldObjects'

// ═══════════════════════════════════════════════════════════════════════════════
// ─═̷─═̷─🎮─═̷─═̷─{ QUAKE FPS CONTROLS - WASD + Q/E }─═̷─═̷─🎮─═̷─═̷─
// ═══════════════════════════════════════════════════════════════════════════════

enum FPSControls {
  forward = 'forward',
  backward = 'backward',
  left = 'left',
  right = 'right',
  up = 'up',
  down = 'down',
}

const FPS_KEYBOARD_MAP = [
  { name: FPSControls.forward, keys: ['KeyW', 'ArrowUp'] },
  { name: FPSControls.backward, keys: ['KeyS', 'ArrowDown'] },
  { name: FPSControls.left, keys: ['KeyA', 'ArrowLeft'] },
  { name: FPSControls.right, keys: ['KeyD', 'ArrowRight'] },
  { name: FPSControls.up, keys: ['KeyQ', 'Space'] },
  { name: FPSControls.down, keys: ['KeyE', 'ShiftLeft'] },
]

// ─═̷─═̷─🕹️─═̷─═̷─{ FPS MOVEMENT COMPONENT }─═̷─═̷─🕹️─═̷─═̷─
// Smooth 1-second acceleration ramp via velocity lerp
function FPSMovement({ speed }: { speed: number }) {
  const [, getKeys] = useKeyboardControls<FPSControls>()
  const velocityRef = useRef(new THREE.Vector3())

  useFrame((state, delta) => {
    const { forward, backward, left, right, up, down } = getKeys()

    const direction = new THREE.Vector3()
    const camera = state.camera

    const cameraDir = new THREE.Vector3()
    camera.getWorldDirection(cameraDir)
    cameraDir.y = 0
    cameraDir.normalize()

    const cameraRight = new THREE.Vector3()
    cameraRight.crossVectors(cameraDir, new THREE.Vector3(0, 1, 0)).normalize()

    if (forward) direction.add(cameraDir)
    if (backward) direction.sub(cameraDir)
    if (right) direction.add(cameraRight)
    if (left) direction.sub(cameraRight)
    if (up) direction.y += 1
    if (down) direction.y -= 1

    direction.normalize()

    const targetVelocity = direction.multiplyScalar(speed)

    // Lerp velocity for smooth ramp (~0.2s to 80% speed)
    const lerpFactor = 1 - Math.exp(-5 * delta)
    velocityRef.current.lerp(targetVelocity, lerpFactor)

    camera.position.add(velocityRef.current.clone().multiplyScalar(delta))
  })

  return null
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS PANEL — Forge-relevant controls only
// ═══════════════════════════════════════════════════════════════════════════════

function SettingsContent() {
  const { settings, updateSetting } = useContext(SettingsContext)

  const toggles = [
    { key: 'bloomEnabled' as const, label: 'Bloom', category: 'Post-FX' },
    { key: 'vignetteEnabled' as const, label: 'Vignette', category: 'Post-FX' },
    { key: 'chromaticEnabled' as const, label: 'Chromatic Aberration', category: 'Post-FX' },
    { key: 'fpsCounterEnabled' as const, label: 'FPS Counter', category: 'UI' },
  ]

  const categories = ['Post-FX', 'UI']

  return (
    <div className="p-4 w-fit">
      <div className="text-xs text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2 whitespace-nowrap">
        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
        Settings
      </div>

      {categories.map(category => (
        <div key={category} className="mb-4">
          <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">{category}</div>

          {category !== 'UI' && toggles.filter(t => t.category === category).map(toggle => (
            <label key={toggle.key} className="flex items-center gap-3 py-1.5 cursor-pointer group hover:bg-white/5 rounded px-1 -mx-1 transition-colors">
              <div
                onClick={() => updateSetting(toggle.key, !settings[toggle.key])}
                className={`w-10 h-5 rounded-full transition-all cursor-pointer relative flex-shrink-0 ${
                  settings[toggle.key] ? 'bg-purple-600 shadow-lg shadow-purple-500/30' : 'bg-gray-700'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-all ${
                  settings[toggle.key] ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </div>
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors whitespace-nowrap">{toggle.label}</span>
            </label>
          ))}

          {/* UI-specific settings */}
          {category === 'UI' && (
            <>
              {toggles.filter(t => t.category === 'UI').map(toggle => (
                <label key={toggle.key} className="flex items-center gap-3 py-1.5 cursor-pointer group hover:bg-white/5 rounded px-1 -mx-1 transition-colors">
                  <div
                    onClick={() => updateSetting(toggle.key, !settings[toggle.key])}
                    className={`w-10 h-5 rounded-full transition-all cursor-pointer relative flex-shrink-0 ${
                      settings[toggle.key] ? 'bg-purple-600 shadow-lg shadow-purple-500/30' : 'bg-gray-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white mt-0.5 transition-all ${
                      settings[toggle.key] ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </div>
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors whitespace-nowrap">{toggle.label}</span>
                </label>
              ))}

              {/* FPS Font Size */}
              <div className="py-1.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">FPS Font Size</span>
                  <span className="text-xs text-purple-400 font-mono">{settings.fpsCounterFontSize}px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="24"
                  value={settings.fpsCounterFontSize}
                  onChange={(e) => updateSetting('fpsCounterFontSize', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Panel Opacity — custom div slider, native range unreliable in portals on Windows */}
              <div className="py-1.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">Menu Opacity</span>
                  <span className="text-xs text-purple-400 font-mono">{Math.round(settings.uiOpacity * 100)}%</span>
                </div>
                <div
                  className="w-full h-4 rounded-full bg-gray-700 cursor-pointer relative select-none"
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    const rect = e.currentTarget.getBoundingClientRect()
                    const update = (clientX: number) => {
                      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
                      const v = Math.round((0.1 + pct * 0.9) * 20) / 20
                      updateSetting('uiOpacity', v)
                    }
                    update(e.clientX)
                    const onMove = (ev: MouseEvent) => update(ev.clientX)
                    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
                    document.addEventListener('mousemove', onMove)
                    document.addEventListener('mouseup', onUp)
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-purple-500/60"
                    style={{ width: `${((settings.uiOpacity - 0.1) / 0.9) * 100}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-purple-400 border-2 border-purple-300 shadow-md"
                    style={{ left: `calc(${((settings.uiOpacity - 0.1) / 0.9) * 100}% - 6px)` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      ))}

      {/* ─═̷─═̷─🎮─═̷─═̷─ CAMERA CONTROLS ─═̷─═̷─🎮─═̷─═̷─ */}
      <div className="mb-2">
        <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Camera Controls</div>
        <select
          value={settings.controlMode}
          onChange={(e) => updateSetting('controlMode', e.target.value as 'orbit' | 'fps')}
          className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-300 hover:border-purple-500 focus:border-purple-500 focus:outline-none transition-colors mb-2"
        >
          <option value="orbit">Orbit (Classic)</option>
          <option value="fps">FPS (Quake-style)</option>
        </select>

        {settings.controlMode === 'orbit' && (
          <label className="flex items-center gap-2 mt-1 mb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showOrbitTarget}
              onChange={(e) => updateSetting('showOrbitTarget', e.target.checked)}
              className="accent-purple-500"
            />
            <span className="text-sm text-gray-300">Show orbit pivot point</span>
          </label>
        )}

        {settings.controlMode === 'fps' && (
          <>
            <div className="py-1.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Mouse Sensitivity</span>
                <span className="text-xs text-purple-400 font-mono">{settings.mouseSensitivity.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={settings.mouseSensitivity * 10}
                onChange={(e) => updateSetting('mouseSensitivity', parseInt(e.target.value) / 10)}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
            </div>

            <div className="py-1.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Move Speed</span>
                <span className="text-xs text-purple-400 font-mono">{settings.moveSpeed}</span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={settings.moveSpeed}
                onChange={(e) => updateSetting('moveSpeed', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
            </div>

            <div className="text-[10px] text-gray-500 mt-2">
              Click canvas to lock pointer · WASD to move · Q/E up/down · ESC to unlock
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKY BACKGROUND — procedural stars or HDRI panorama
// ═══════════════════════════════════════════════════════════════════════════════

function SkyBackgroundInner({ backgroundId }: { backgroundId: string }) {
  const skyConfig = SKY_BACKGROUNDS.find(s => s.id === backgroundId) || SKY_BACKGROUNDS[0]

  // drei built-in preset (CDN-hosted HDR) — sets both background AND environment (IBL)
  if ('preset' in skyConfig && skyConfig.preset) {
    return (
      <Environment
        preset={skyConfig.preset as any}
        background
        backgroundBlurriness={0}
        backgroundIntensity={1}
      />
    )
  }

  // Procedural stars — no IBL environment
  if (!skyConfig.path) {
    return <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.3} />
  }

  // Local HDRI file — sets both background AND environment (IBL)
  return (
    <Environment
      files={`${OASIS_BASE}${skyConfig.path}`}
      background
      backgroundBlurriness={0}
      backgroundIntensity={1}
    />
  )
}

// Wrapper: keeps old sky visible until new one loads (no black flash)
function SkyBackground({ backgroundId }: { backgroundId: string }) {
  const [activeId, setActiveId] = useState(backgroundId)
  const [isPending, startTransition] = useTransition()
  useEffect(() => {
    startTransition(() => setActiveId(backgroundId))
  }, [backgroundId])
  return <SkyBackgroundInner backgroundId={activeId} />
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORBIT TARGET GIZMO — metallic armillary sphere pivot point
// ═══════════════════════════════════════════════════════════════════════════════

function makeRingPoints(radius: number, segments: number, plane: 'xz' | 'xy' | 'yz'): [number, number, number][] {
  const pts: [number, number, number][] = []
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    const c = Math.cos(theta) * radius
    const s = Math.sin(theta) * radius
    if (plane === 'xz') pts.push([c, 0, s])
    else if (plane === 'xy') pts.push([c, s, 0])
    else pts.push([0, c, s])
  }
  return pts
}

const RING_XZ = makeRingPoints(0.18, 48, 'xz')
const RING_XY = makeRingPoints(0.18, 48, 'xy')
const RING_YZ = makeRingPoints(0.18, 48, 'yz')
const AXIS_LEN = 0.25

function OrbitTargetSphere({ controlsRef }: { controlsRef: React.RefObject<any> }) {
  const groupRef = useRef<THREE.Group>(null)
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null)

  useFrame((state) => {
    if (!groupRef.current || !controlsRef.current) return
    const t = controlsRef.current.target
    groupRef.current.position.set(t.x, t.y, t.z)

    if (coreMatRef.current) {
      const pulse = 0.4 + Math.sin(state.clock.elapsedTime * 2.5) * 0.35
      coreMatRef.current.emissiveIntensity = pulse
    }
  })

  return (
    <group ref={groupRef}>
      <mesh renderOrder={999}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial
          ref={coreMatRef}
          color="#c0c0d0"
          metalness={0.92}
          roughness={0.12}
          emissive="#a855f7"
          emissiveIntensity={0.4}
          transparent
          opacity={0.95}
          depthTest={false}
        />
      </mesh>

      <Line points={RING_XZ} color="#a855f7" lineWidth={1.5} transparent opacity={0.5} />
      <Line points={RING_XY} color="#a855f7" lineWidth={1.0} transparent opacity={0.3} />
      <Line points={RING_YZ} color="#a855f7" lineWidth={1.0} transparent opacity={0.3} />

      <Line points={[[-AXIS_LEN, 0, 0], [AXIS_LEN, 0, 0]]} color="#ef4444" lineWidth={1.0} transparent opacity={0.45} />
      <Line points={[[0, -AXIS_LEN, 0], [0, AXIS_LEN, 0]]} color="#22c55e" lineWidth={1.0} transparent opacity={0.45} />
      <Line points={[[0, 0, -AXIS_LEN], [0, 0, AXIS_LEN]]} color="#3b82f6" lineWidth={1.0} transparent opacity={0.45} />
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAMERA LERP — Smooth transition to a target position when selecting objects
// ░▒▓ Set cameraLookAt in the store → camera glides there over 1500ms ▓▒░
// ═══════════════════════════════════════════════════════════════════════════════

function CameraLerp({ controlsRef }: { controlsRef: React.RefObject<any> }) {
  const cameraLookAt = useOasisStore(s => s.cameraLookAt)
  const setCameraLookAt = useOasisStore(s => s.setCameraLookAt)
  const targetRef = useRef<THREE.Vector3 | null>(null)
  const startRef = useRef<THREE.Vector3 | null>(null)
  const startTimeRef = useRef(0)
  const DURATION = 1.5 // seconds

  useEffect(() => {
    if (!cameraLookAt || !controlsRef.current) return
    const controls = controlsRef.current
    startRef.current = controls.target.clone()
    targetRef.current = new THREE.Vector3(...cameraLookAt)
    startTimeRef.current = performance.now() / 1000
    // Clear from store immediately so it's a one-shot trigger
    setCameraLookAt(null)
  }, [cameraLookAt, controlsRef, setCameraLookAt])

  useFrame((state) => {
    if (!targetRef.current || !startRef.current || !controlsRef.current) return
    const elapsed = state.clock.elapsedTime - startTimeRef.current
    // Fix: use wall clock delta since startTimeRef is wall time
    const now = performance.now() / 1000
    const t = Math.min(1, (now - startTimeRef.current) / DURATION)
    // Smooth ease-out cubic
    const ease = 1 - Math.pow(1 - t, 3)
    controlsRef.current.target.lerpVectors(startRef.current, targetRef.current, ease)
    if (t >= 1) {
      targetRef.current = null
      startRef.current = null
    }
  })

  return null
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST-PROCESSING EFFECTS
// ═══════════════════════════════════════════════════════════════════════════════

function PostProcessing() {
  const { settings } = useContext(SettingsContext)

  const hasEffects = settings.bloomEnabled || settings.vignetteEnabled || settings.chromaticEnabled
  if (!hasEffects) return null

  return (
    <EffectComposer>
      <Bloom
        intensity={settings.bloomEnabled ? 0.4 : 0}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.4}
      />
      <Vignette
        offset={0.3}
        darkness={settings.vignetteEnabled ? 0.7 : 0}
        blendFunction={BlendFunction.NORMAL}
      />
      <ChromaticAberration
        offset={settings.chromaticEnabled ? [0.003, 0.003] as any : [0, 0] as any}
        radialModulation
        modulationOffset={0.5}
      />
    </EffectComposer>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FPS COUNTER
// ═══════════════════════════════════════════════════════════════════════════════

const fpsRef = { current: 60 }
const frameTimesRef = { current: [] as number[] }

function FPSTracker() {
  useFrame(() => {
    const now = performance.now()
    const frameTimes = frameTimesRef.current

    frameTimes.push(now)

    while (frameTimes.length > 60) {
      frameTimes.shift()
    }

    if (frameTimes.length >= 2) {
      const elapsed = frameTimes[frameTimes.length - 1] - frameTimes[0]
      if (elapsed > 0) {
        fpsRef.current = Math.round((frameTimes.length - 1) / (elapsed / 1000))
      }
    }
  })

  return null
}

function FPSDisplay({ enabled, fontSize }: { enabled: boolean; fontSize: number }) {
  const [fps, setFps] = useState(60)

  useEffect(() => {
    if (!enabled) return

    const interval = setInterval(() => {
      setFps(fpsRef.current)
    }, 200)

    return () => clearInterval(interval)
  }, [enabled])

  if (!enabled) return null

  const color = fps >= 55 ? '#22c55e' : fps >= 30 ? '#facc15' : '#ef4444'

  return (
    <div
      className="fixed top-4 right-4 z-[100] font-mono font-bold pointer-events-none select-none"
      style={{
        fontSize: `${fontSize}px`,
        color,
        textShadow: `0 0 10px ${color}40, 0 2px 4px rgba(0,0,0,0.5)`,
      }}
    >
      {fps} FPS
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCENE
// ═══════════════════════════════════════════════════════════════════════════════

export default function Scene() {
  const [isDragging, setIsDragging] = useState(false)

  // ─═̷─═̷─💾─═̷─═̷─{ SETTINGS PERSISTENCE }─═̷─═̷─💾─═̷─═̷─
  const [settings, setSettings] = useState<OasisSettings>(() => {
    if (typeof window !== 'undefined') {
      // Clean up Parzival-era key — start fresh with Oasis defaults
      if (localStorage.getItem('uploader-settings')) localStorage.removeItem('uploader-settings')
      const saved = localStorage.getItem('oasis-settings')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return { ...defaultSettings, ...parsed }
        } catch {
          return defaultSettings
        }
      }
    }
    return defaultSettings
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('oasis-settings', JSON.stringify(settings))
    }
  }, [settings])

  const selectObject = useOasisStore(s => s.selectObject)
  const inspectedObjectId = useOasisStore(s => s.inspectedObjectId)
  const setInspectedObject = useOasisStore(s => s.setInspectedObject)
  const worldSkyBackground = useOasisStore(s => s.worldSkyBackground)

  // ─═̷─═̷─🌍─═̷─═̷─{ WORLD LOADER — ensures conjured assets + world state loaded }─═̷─═̷─🌍─═̷─═̷─
  useWorldLoader()

  // ─═̷─═̷─✨─═̷─═̷─{ WIZARD CONSOLE + ASSET EXPLORER STATE }─═̷─═̷─✨─═̷─═̷─
  const [wizardOpen, setWizardOpen] = useState(true)
  // Asset Explorer removed — merged into WizardConsole
  const [actionLogOpen, setActionLogOpen] = useState(false)

  const orbitControlsRef = useRef<any>(null)

  const updateSetting = <K extends keyof OasisSettings>(key: K, value: OasisSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // ─═̷─═̷─🎮─═̷─═̷─{ CAMERA MODE HOTKEY: Ctrl+Alt+C }─═̷─═̷─🎮─═̷─═̷─
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.code === 'KeyC') {
        e.preventDefault()
        setSettings(prev => ({
          ...prev,
          controlMode: prev.controlMode === 'orbit' ? 'fps' : 'orbit',
        }))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ─═̷─═̷─🎯─═̷─═̷─{ FPS POINTER LOCK STATE + RIGHT-CLICK UNLOCK }─═̷─═̷─🎯─═̷─═̷─
  const [pointerLocked, setPointerLocked] = useState(false)

  useEffect(() => {
    const onPointerLockChange = () => setPointerLocked(!!document.pointerLockElement)
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2 && document.pointerLockElement) {
        e.preventDefault()
        document.exitPointerLock()
      }
    }
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target?.closest('#uploader-canvas') || target?.tagName === 'CANVAS') {
        e.preventDefault()
      }
    }
    document.addEventListener('pointerlockchange', onPointerLockChange)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('contextmenu', onContextMenu)
    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('contextmenu', onContextMenu)
    }
  }, [])

  // ─═̷─═̷─🎮─═̷─═̷─{ CANVAS }─═̷─═̷─🎮─═̷─═̷─
  const CanvasContent = (
    <Canvas
      id="uploader-canvas"
      camera={{ position: [12, 10, 12], fov: 50, near: 0.1, far: 500 }}
      gl={{ antialias: true }}
      onPointerMissed={() => {
        selectObject(null)
      }}
    >
        <color attach="background" args={['#030303']} />

        <SkyBackground backgroundId={worldSkyBackground} />

        {/* ─═̷─═̷─🎮─═̷─═̷─ CAMERA CONTROLS ─═̷─═̷─🎮─═̷─═̷─ */}
        {settings.controlMode === 'orbit' ? (
          <>
            <OrbitControls
              ref={orbitControlsRef}
              enablePan={!isDragging}
              enableZoom={!isDragging}
              enableRotate={!isDragging}
              enableDamping={false}
              minDistance={3}
              maxDistance={500}
            />
            {settings.showOrbitTarget && <OrbitTargetSphere controlsRef={orbitControlsRef} />}
            <CameraLerp controlsRef={orbitControlsRef} />
          </>
        ) : (
          <>
            <PointerLockControls
              selector="#uploader-canvas"
              pointerSpeed={settings.mouseSensitivity}
            />
            <FPSMovement speed={settings.moveSpeed} />
          </>
        )}

        <Grid
          position={[0, 0, 0]}
          args={[50, 50]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#1a1a2e"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#2a2a4e"
          fadeDistance={50}
          fadeStrength={1}
          infiniteGrid
        />

        {/* ─═̷─═̷─🌍─═̷─═̷─ THE FORGE ─═̷─═̷─🌍─═̷─═̷─ */}
        <Suspense fallback={null}>
          <ForgeRealm />
        </Suspense>

        {/* ─═̷─═̷─📸─═̷─═̷─ PANORAMA CAPTURE (Ctrl+Shift+P) ─═̷─═̷─📸─═̷─═̷─ */}
        <PanoramaCapture />

        <PostProcessing />
        <FPSTracker />
    </Canvas>
  )

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
    <DragContext.Provider value={{ isDragging, setIsDragging }}>
      <KeyboardControls map={FPS_KEYBOARD_MAP}>
        {CanvasContent}
      </KeyboardControls>

      {/* ─═̷─═̷─⚡ FPS DISPLAY ─═̷─═̷─⚡ */}
      <FPSDisplay enabled={settings.fpsCounterEnabled} fontSize={settings.fpsCounterFontSize} />

      {/* ─═̷─═̷─🎯 CROSSHAIR — FPS mode only ─═̷─═̷─🎯 */}
      {settings.controlMode === 'fps' && pointerLocked && (
        <div className="fixed inset-0 pointer-events-none z-[99] flex items-center justify-center">
          <div className="relative w-5 h-5">
            <div className="absolute top-1/2 left-0 w-full h-px bg-white/40" />
            <div className="absolute left-1/2 top-0 h-full w-px bg-white/40" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-white/60" />
          </div>
        </div>
      )}

      {/* ─═̷─═̷─🔮─═̷─═̷─ TOP-LEFT BUTTON BAR — Settings, Wizard, Action Log ─═̷─═̷─🔮─═̷─═̷─ */}
      <div className="fixed top-4 left-4 z-[200] flex items-start gap-2">
        <SettingsGear>
          <SettingsContent />
        </SettingsGear>
        <button
          onClick={() => setWizardOpen(prev => !prev)}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all hover:scale-110"
          style={{
            background: wizardOpen ? 'rgba(249,115,22,0.4)' : 'rgba(0,0,0,0.6)',
            border: `1px solid ${wizardOpen ? 'rgba(249,115,22,0.6)' : 'rgba(255,255,255,0.15)'}`,
            color: wizardOpen ? '#F97316' : '#aaa',
            boxShadow: wizardOpen ? '0 0 12px rgba(249,115,22,0.3)' : 'none',
          }}
          title="Wizard Console"
        >
          ✨
        </button>
        <ActionLogButton
          onClick={() => setActionLogOpen(prev => !prev)}
          isOpen={actionLogOpen}
        />
      </div>

      {/* ✨ Wizard Console */}
      <WizardConsole
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />

      {/* 🔍 Object Inspector */}
      <ObjectInspector
        isOpen={!!inspectedObjectId}
        onClose={() => setInspectedObject(null)}
      />

      {/* ⏪ Action Log */}
      <ActionLogPanel
        isOpen={actionLogOpen}
        onClose={() => setActionLogOpen(false)}
      />

      {/* ░▒▓ LOADING OVERLAY ▓▒░ */}
      <OasisLoader />
    </DragContext.Provider>
    </SettingsContext.Provider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS GEAR — replaces the old hamburger MenuSystem
// ═══════════════════════════════════════════════════════════════════════════════

function SettingsGear({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        if ((e.target as HTMLElement)?.tagName === 'CANVAS') return
        const target = e.target as HTMLElement
        if (target.closest('[data-menu-portal]')) return
        if (target.closest('[class*="fixed"]')) return
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all hover:scale-110"
        style={{
          background: isOpen ? 'rgba(168,85,247,0.3)' : 'rgba(0,0,0,0.6)',
          border: `1px solid ${isOpen ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.15)'}`,
          color: isOpen ? '#A855F7' : '#aaa',
          boxShadow: isOpen ? '0 0 12px rgba(168,85,247,0.3)' : 'none',
        }}
        title="Settings"
      >
        ⚙️
      </button>

      {isOpen && (
        <div
          className="absolute top-0 left-12 backdrop-blur-sm border border-gray-800 rounded-xl shadow-2xl animate-in slide-in-from-left-2 duration-200"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            boxShadow: '0 0 40px rgba(0,0,0,0.5), 0 0 20px rgba(168, 85, 247, 0.1)',
            maxHeight: '85vh',
            overflowY: 'auto',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// OASIS LOADER — "channeling bytes" with REAL data units
// ═══════════════════════════════════════════════════════════════════════════════

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`
  if (bytesPerSec < 1048576) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`
}

function OasisLoader() {
  const { progress, active, loaded, total } = useProgress()
  const [show, setShow] = useState(true)
  const hasCompletedFirstLoad = useRef(false)

  const [byteInfo, setByteInfo] = useState({ loaded: 0, total: 0, speed: 0 })

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const origOpen = XMLHttpRequest.prototype.open as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const origSend = XMLHttpRequest.prototype.send as any
    const activeXhr = new Map<XMLHttpRequest, { loaded: number; total: number }>()
    let prevLoaded = 0
    let prevTime = performance.now()
    let smoothSpeed = 0
    let rafId = 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    XMLHttpRequest.prototype.open = function(this: any, ...args: any[]) {
      const url = String(args[1] || '')
      if (/\.(glb|gltf|hdr|exr|bin|jpg|png|ktx2)(\?|$)/i.test(url)) {
        this._oasisTrack = true
      }
      return origOpen.apply(this, args)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    XMLHttpRequest.prototype.send = function(this: any, ...args: any[]) {
      if (this._oasisTrack) {
        activeXhr.set(this, { loaded: 0, total: 0 })
        this.addEventListener('progress', (e: ProgressEvent) => {
          if (e.lengthComputable) {
            activeXhr.set(this, { loaded: e.loaded, total: e.total })
          }
        })
        const cleanup = () => activeXhr.delete(this)
        this.addEventListener('loadend', cleanup)
        this.addEventListener('error', cleanup)
        this.addEventListener('abort', cleanup)
      }
      return origSend.apply(this, args)
    }

    const tick = () => {
      let tLoaded = 0
      let tTotal = 0
      activeXhr.forEach(({ loaded: l, total: t }) => { tLoaded += l; tTotal += t })

      const now = performance.now()
      const dt = (now - prevTime) / 1000
      if (dt >= 0.2) {
        const instantSpeed = Math.max(0, (tLoaded - prevLoaded) / dt)
        smoothSpeed = smoothSpeed * 0.6 + instantSpeed * 0.4
        prevLoaded = tLoaded
        prevTime = now
      }

      setByteInfo({ loaded: tLoaded, total: tTotal, speed: smoothSpeed })
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      XMLHttpRequest.prototype.open = origOpen
      XMLHttpRequest.prototype.send = origSend
      cancelAnimationFrame(rafId)
    }
  }, [])

  useEffect(() => {
    if (!active && progress === 100) {
      const timer = setTimeout(() => {
        setShow(false)
        hasCompletedFirstLoad.current = true
      }, 800)
      return () => clearTimeout(timer)
    }
    if (active && !hasCompletedFirstLoad.current) setShow(true)
  }, [active, progress])

  if (!show) return null

  const hasByteData = byteInfo.total > 0

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 20px',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        borderRadius: '8px',
        border: '1px solid rgba(168, 85, 247, 0.25)',
        zIndex: 9998,
        transition: 'opacity 0.6s ease',
        opacity: active ? 1 : 0,
        pointerEvents: 'none',
      }}
    >
      <span style={{ color: '#A855F7', fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
        channeling bytes
      </span>

      <div style={{
        width: '120px', height: '3px', background: 'rgba(168,85,247,0.2)',
        borderRadius: '2px', overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{
          width: `${progress}%`, height: '100%',
          background: 'linear-gradient(90deg, #A855F7, #06B6D4)',
          transition: 'width 0.3s ease',
          borderRadius: '2px',
        }} />
      </div>

      <div style={{
        color: '#666', fontSize: '11px', fontFamily: 'monospace',
        display: 'flex', gap: '6px', alignItems: 'center', whiteSpace: 'nowrap',
      }}>
        {hasByteData ? (
          <>
            <span style={{ color: '#888' }}>
              {formatBytes(byteInfo.loaded)} / {formatBytes(byteInfo.total)}
            </span>
            {byteInfo.speed > 1024 && (
              <>
                <span style={{ color: '#444' }}>|</span>
                <span style={{ color: '#06B6D4' }}>{formatSpeed(byteInfo.speed)}</span>
              </>
            )}
          </>
        ) : (
          <span>{loaded}/{total} | {Math.round(progress)}%</span>
        )}
      </div>
    </div>
  )
}
