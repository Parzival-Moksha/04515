'use client'

// 3D Avatar Renderer — loads RPM GLB and renders it in the world
// Uses useGLTF for loading, applies idle animation

import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

interface UserAvatar3DProps {
  url: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

export function UserAvatar3D({
  url,
  position = [0, 0, 3],
  rotation = [0, Math.PI, 0],
  scale = 1,
}: UserAvatar3DProps) {
  const groupRef = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(url)

  // Clone the scene so multiple avatars don't share geometry
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)
    // Ensure materials are not shared across clones
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(m => m.clone())
        } else {
          mesh.material = mesh.material.clone()
        }
        mesh.castShadow = true
        mesh.receiveShadow = true
      }
    })
    return clone
  }, [scene])

  // Animation mixer for idle/built-in animations
  const mixer = useMemo(() => {
    if (animations.length === 0) return null
    const m = new THREE.AnimationMixer(clonedScene)
    // Play the first animation (usually idle or T-pose → idle)
    const clip = animations[0]
    const action = m.clipAction(clip)
    action.play()
    return m
  }, [animations, clonedScene])

  // Subtle idle breathing even without animations
  useFrame((state, delta) => {
    if (mixer) {
      mixer.update(delta)
    } else if (groupRef.current) {
      // Gentle breathing bob when no built-in animation
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.5) * 0.02
    }
  })

  // Cleanup
  useEffect(() => {
    return () => {
      mixer?.stopAllAction()
    }
  }, [mixer])

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      <primitive object={clonedScene} scale={scale} />
    </group>
  )
}
