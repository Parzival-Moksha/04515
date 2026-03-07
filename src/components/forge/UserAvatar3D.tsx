'use client'

// 3D Avatar Renderer — loads Avaturn/RPM GLB and renders it in the world
// Finds humanoid skeleton, poses from T-pose to natural rest, adds idle animation

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

// Standard humanoid bone names (Mixamo/Avaturn/RPM convention)
// Arms need rotating down from T-pose (arms straight out) to A-pose (arms at sides)
const ARM_POSE: Record<string, THREE.Euler> = {
  // Left arm: rotate Z negative to bring down, slight X forward
  'LeftUpperArm':  new THREE.Euler(0.15, 0, -1.15),
  'LeftLowerArm':  new THREE.Euler(0, 0, -0.15),
  // Right arm: rotate Z positive to bring down
  'RightUpperArm': new THREE.Euler(0.15, 0, 1.15),
  'RightLowerArm': new THREE.Euler(0, 0, 0.15),
  // Hands: slight natural curl
  'LeftHand':  new THREE.Euler(0, 0, -0.1),
  'RightHand': new THREE.Euler(0, 0, 0.1),
}

// Alternative bone name patterns (different exporters use different conventions)
const BONE_ALIASES: Record<string, string[]> = {
  'LeftUpperArm':  ['LeftUpperArm', 'leftUpperArm', 'Left_Upper_Arm', 'mixamorig:LeftArm', 'LeftArm', 'J_Bip_L_UpperArm'],
  'LeftLowerArm':  ['LeftLowerArm', 'leftLowerArm', 'Left_Lower_Arm', 'mixamorig:LeftForeArm', 'LeftForeArm', 'J_Bip_L_LowerArm'],
  'RightUpperArm': ['RightUpperArm', 'rightUpperArm', 'Right_Upper_Arm', 'mixamorig:RightArm', 'RightArm', 'J_Bip_R_UpperArm'],
  'RightLowerArm': ['RightLowerArm', 'rightLowerArm', 'Right_Lower_Arm', 'mixamorig:RightForeArm', 'RightForeArm', 'J_Bip_R_LowerArm'],
  'LeftHand':      ['LeftHand', 'leftHand', 'Left_Hand', 'mixamorig:LeftHand', 'J_Bip_L_Hand'],
  'RightHand':     ['RightHand', 'rightHand', 'Right_Hand', 'mixamorig:RightHand', 'J_Bip_R_Hand'],
  'Spine':         ['Spine', 'spine', 'mixamorig:Spine', 'Spine1', 'J_Bip_C_Spine'],
  'Spine1':        ['Spine1', 'spine1', 'mixamorig:Spine1', 'Spine2', 'J_Bip_C_Chest'],
  'Head':          ['Head', 'head', 'mixamorig:Head', 'J_Bip_C_Head'],
  'Hips':          ['Hips', 'hips', 'mixamorig:Hips', 'J_Bip_C_Hips'],
}

function findBone(root: THREE.Object3D, canonicalName: string): THREE.Bone | null {
  const aliases = BONE_ALIASES[canonicalName] || [canonicalName]
  let found: THREE.Bone | null = null
  root.traverse((child) => {
    if (found) return
    if ((child as THREE.Bone).isBone && aliases.some(a => child.name.includes(a))) {
      found = child as THREE.Bone
    }
  })
  return found
}

export function UserAvatar3D({
  url,
  position = [0, 0, 3],
  rotation = [0, Math.PI, 0],
  scale = 1,
}: UserAvatar3DProps) {
  const groupRef = useRef<THREE.Group>(null)
  const bonesRef = useRef<Record<string, THREE.Bone>>({})
  const { scene, animations } = useGLTF(url)

  // Clone the scene so multiple avatars don't share geometry
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)
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

  // Find bones and apply rest pose (T-pose → natural A-pose)
  useEffect(() => {
    const bones: Record<string, THREE.Bone> = {}

    // Find all named bones
    for (const canonicalName of Object.keys(BONE_ALIASES)) {
      const bone = findBone(clonedScene, canonicalName)
      if (bone) bones[canonicalName] = bone
    }

    bonesRef.current = bones

    // Apply arm rest pose if no built-in animations
    if (animations.length === 0) {
      for (const [boneName, euler] of Object.entries(ARM_POSE)) {
        const bone = bones[boneName]
        if (bone) {
          bone.rotation.set(euler.x, euler.y, euler.z)
        }
      }
    }

    // Log found bones for debugging
    const boneNames = Object.keys(bones)
    if (boneNames.length > 0) {
      console.log(`[Avatar3D] Found ${boneNames.length} bones:`, boneNames.join(', '))
    } else {
      console.warn('[Avatar3D] No humanoid bones found in avatar skeleton')
    }
  }, [clonedScene, animations.length])

  // Animation mixer for built-in animations
  const mixer = useMemo(() => {
    if (animations.length === 0) return null
    const m = new THREE.AnimationMixer(clonedScene)
    const clip = animations[0]
    const action = m.clipAction(clip)
    action.play()
    return m
  }, [animations, clonedScene])

  // Procedural idle animation — breathing, subtle sway, weight shift
  useFrame((state, delta) => {
    if (mixer) {
      mixer.update(delta)
      return
    }

    const t = state.clock.elapsedTime
    const bones = bonesRef.current

    // Breathing: subtle chest/spine expansion
    const spine = bones['Spine1'] || bones['Spine']
    if (spine) {
      const breathCycle = Math.sin(t * 1.2) * 0.012
      spine.rotation.x = breathCycle + 0.02 // slight forward lean
    }

    // Head: subtle micro-movements (looking around slightly)
    const head = bones['Head']
    if (head) {
      head.rotation.y = Math.sin(t * 0.4) * 0.04
      head.rotation.x = Math.sin(t * 0.6 + 1) * 0.02 - 0.05 // slight downward
    }

    // Hips: very subtle weight shift side to side
    const hips = bones['Hips']
    if (hips) {
      hips.rotation.z = Math.sin(t * 0.3) * 0.008
      // Subtle vertical bob from breathing
      hips.position.y = (hips.position.y || 0) + Math.sin(t * 1.2) * 0.001
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
