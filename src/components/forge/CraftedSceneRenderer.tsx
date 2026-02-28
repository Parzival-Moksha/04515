// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// CRAFTED SCENE RENDERER — LLM imagination made tangible
// ─═̷─═̷─ॐ─═̷─═̷─ JSON → Primitives → Three.js → Reality ─═̷─═̷─ॐ─═̷─═̷─
// Each primitive is a thought crystallized in geometry.
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

'use client'

import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { CraftedScene, CraftedPrimitive } from '../../lib/conjure/types'
import { useOasisStore } from '../../store/oasisStore'
import { extractModelStats } from './ModelPreview'

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMITIVE GEOMETRY — maps type string to Three.js geometry
// ═══════════════════════════════════════════════════════════════════════════════

export function PrimitiveGeometry({ type }: { type: CraftedPrimitive['type'] }) {
  switch (type) {
    case 'box': return <boxGeometry args={[1, 1, 1]} />
    case 'sphere': return <sphereGeometry args={[0.5, 32, 32]} />
    case 'cylinder': return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
    case 'cone': return <coneGeometry args={[0.5, 1, 32]} />
    case 'torus': return <torusGeometry args={[0.4, 0.15, 16, 32]} />
    case 'plane': return <planeGeometry args={[1, 1]} />
    case 'capsule': return <capsuleGeometry args={[0.3, 0.5, 8, 16]} />
    default: return <boxGeometry args={[1, 1, 1]} />
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLE PRIMITIVE — one atomic piece of a crafted scene
// ═══════════════════════════════════════════════════════════════════════════════

export function CraftedPrimitiveMesh({ primitive }: { primitive: CraftedPrimitive }) {
  const hasOpacity = primitive.opacity !== undefined && primitive.opacity < 1
  return (
    <mesh
      position={primitive.position}
      rotation={primitive.rotation || [0, 0, 0]}
      scale={primitive.scale}
      castShadow={!hasOpacity}
      receiveShadow
    >
      <PrimitiveGeometry type={primitive.type} />
      <meshStandardMaterial
        color={primitive.color}
        metalness={primitive.metalness ?? 0}
        roughness={primitive.roughness ?? 0.7}
        emissive={primitive.emissive || '#000000'}
        emissiveIntensity={primitive.emissiveIntensity ?? 0}
        transparent={hasOpacity}
        opacity={primitive.opacity ?? 1}
        depthWrite={!hasOpacity}
      />
    </mesh>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRAFTED SCENE — the full composition
// ═══════════════════════════════════════════════════════════════════════════════

interface CraftedSceneRendererProps {
  scene: CraftedScene
  onDelete?: (id: string) => void
}

export function CraftedSceneRenderer({ scene, onDelete }: CraftedSceneRendererProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const [showLabel, setShowLabel] = useState(false)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spawnProgress = useRef(0)
  const spawnDone = useRef(false)

  // ░▒▓ Mesh stats — push to Zustand so ObjectInspector can display ▓▒░
  const setObjectMeshStats = useOasisStore(s => s.setObjectMeshStats)
  const statsReported = useRef(false)
  useEffect(() => {
    if (!groupRef.current || statsReported.current) return
    // Wait one frame for geometry to be created by R3F
    const raf = requestAnimationFrame(() => {
      if (!groupRef.current) return
      const stats = extractModelStats(groupRef.current, [])
      setObjectMeshStats(scene.id, stats)
      statsReported.current = true
    })
    return () => cancelAnimationFrame(raf)
  }, [scene.id, scene.objects.length, setObjectMeshStats])

  // Spawn animation — scales up then YIELDS to TransformControls
  // Position is managed by parent SelectableWrapper, NOT here
  useFrame((_, delta) => {
    if (!groupRef.current || spawnDone.current) return
    if (spawnProgress.current < 1) {
      spawnProgress.current = Math.min(1, spawnProgress.current + delta * 3)
      const t = spawnProgress.current
      const s = t === 1 ? 1 : 1 - Math.pow(2, -10 * t) * Math.cos((t * 10 - 0.75) * ((2 * Math.PI) / 3))
      groupRef.current.scale.setScalar(s)
    } else {
      groupRef.current.scale.setScalar(1)
      spawnDone.current = true // Never touch scale again — TransformControls owns it now
    }
  })

  return (
    <group
      ref={groupRef}
      onPointerOver={(e) => {
        e.stopPropagation()
        if (hoverTimeout.current) { clearTimeout(hoverTimeout.current); hoverTimeout.current = null }
        setHovered(true); setShowLabel(true)
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(false)
        // Debounce label hide — prevents flicker when raycaster briefly loses the mesh
        hoverTimeout.current = setTimeout(() => setShowLabel(false), 150)
      }}
    >
      {scene.objects.map((primitive, i) => (
        <CraftedPrimitiveMesh key={`${scene.id}-${i}`} primitive={primitive} />
      ))}

      {/* Hover glow base */}
      {hovered && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[3, 3.5, 32]} />
          <meshBasicMaterial color="#3B82F6" transparent opacity={0.2} />
        </mesh>
      )}

      {/* Info label — name + triangle count, consistent with conjured/catalog */}
      {showLabel && (
        <Html position={[0, 4, 0]} center style={{ pointerEvents: 'none' }}>
          <div
            className="px-2 py-1 rounded text-xs whitespace-nowrap select-none pointer-events-none"
            style={{
              background: 'rgba(0,0,0,0.85)',
              border: '1px solid rgba(59,130,246,0.4)',
              color: '#3B82F6',
            }}
          >
            {scene.name}
            <div className="text-[10px] text-gray-400">
              {scene.objects.reduce((sum, obj) => {
                // Estimate tris from primitive types
                const PRIM_TRIS: Record<string, number> = { box: 12, sphere: 960, cylinder: 96, cone: 64, torus: 768, plane: 2, ring: 128, circle: 32 }
                return sum + (PRIM_TRIS[(obj as any).geometry || 'box'] || 12)
              }, 0).toLocaleString()} tris
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

// ▓▓▓▓【C̸R̸A̸F̸T̸E̸D̸】▓▓▓▓ॐ▓▓▓▓【S̸C̸E̸N̸E̸】▓▓▓▓
