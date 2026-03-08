'use client'

// VRM Avatar Renderer — loads VRM files via @pixiv/three-vrm
// Handles spring bones (hair/cloth physics), expressions, and idle animation
// VRM is GLB + metadata: humanoid bone mapping, expression presets, spring bones

import { useRef, useEffect, useMemo, useState } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRM, VRMUtils } from '@pixiv/three-vrm'

interface VRMAvatarProps {
  url: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

export function VRMAvatar({
  url,
  position = [0, 0, 3],
  rotation = [0, Math.PI, 0],
  scale = 1,
}: VRMAvatarProps) {
  const groupRef = useRef<THREE.Group>(null)
  const vrmRef = useRef<VRM | null>(null)
  const [vrm, setVrm] = useState<VRM | null>(null)

  // Load VRM via GLTFLoader + VRMLoaderPlugin
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.register((parser) => new VRMLoaderPlugin(parser))
  })

  // Extract VRM from loaded GLTF
  useEffect(() => {
    const loadedVrm = gltf.userData.vrm as VRM | undefined
    if (!loadedVrm) {
      console.warn('[VRMAvatar] No VRM data found in', url)
      return
    }

    // Rotate the VRM model (VRM spec: model faces +Z, Three.js faces -Z)
    VRMUtils.rotateVRM0(loadedVrm)

    // Fix materials: MToon shader needs GI equalization to respond to IBL
    loadedVrm.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const mat of mats) {
          // MToon: boost indirect light contribution (default can be 0 = no IBL response)
          if ('giEqualizationFactor' in mat) {
            ;(mat as Record<string, unknown>).giEqualizationFactor = 0.9
          }
          // Standard materials: ensure envMap intensity
          if ('envMapIntensity' in mat) {
            ;(mat as THREE.MeshStandardMaterial).envMapIntensity = 1.0
          }
        }
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })

    vrmRef.current = loadedVrm
    setVrm(loadedVrm)

    // Log VRM capabilities
    const expressions = loadedVrm.expressionManager?.expressions
    const expressionNames = expressions
      ? Object.keys(loadedVrm.expressionManager?.expressionMap || {})
      : []
    console.log(`[VRMAvatar] Loaded: ${url.split('/').pop()}`)
    console.log(`[VRMAvatar] Expressions: ${expressionNames.length > 0 ? expressionNames.join(', ') : 'none'}`)
    console.log(`[VRMAvatar] Spring bones: ${loadedVrm.springBoneManager ? 'yes' : 'no'}`)
  }, [gltf, url])

  // Idle animation — procedural breathing, blink cycle, expression cycling
  useFrame((state, delta) => {
    const v = vrmRef.current
    if (!v) return

    // MUST call update every frame for spring bones + constraints
    v.update(delta)

    const t = state.clock.elapsedTime
    const expr = v.expressionManager

    if (expr) {
      // Blink cycle — blink every 3-5 seconds, quick close/open
      const blinkPhase = t % 4
      if (blinkPhase > 3.7 && blinkPhase < 3.9) {
        expr.setValue('blink', 1)
      } else {
        expr.setValue('blink', 0)
      }

      // Subtle smile — breathing between neutral and slight joy
      const smileAmount = Math.sin(t * 0.3) * 0.15 + 0.1
      expr.setValue('happy', Math.max(0, smileAmount))
    }

    // LookAt — eyes follow a slow wandering point
    if (v.lookAt && v.lookAt.target) {
      (v.lookAt.target as THREE.Object3D).position.set(
        Math.sin(t * 0.5) * 2,
        1.5 + Math.sin(t * 0.3) * 0.3,
        -3 + Math.cos(t * 0.4) * 1
      )
    }
  })

  if (!vrm) return null

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <primitive object={vrm.scene} scale={scale} />
    </group>
  )
}
