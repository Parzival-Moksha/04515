'use client'

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// OASIS — Main Page
// Entry point to the Oasis — The Forge and beyond
// ─═̷─═̷─ॐ─═̷─═̷─ Where consciousness renders itself ─═̷─═̷─ॐ─═̷─═̷─
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { RealmSelector } from '@/components/realms/RealmSelector'
import { useOasisStore } from '@/store/oasisStore'

// Dynamic import to avoid SSR issues with Three.js
const Scene = dynamic(() => import('@/components/Scene'), {
  ssr: false,
  loading: () => null,  // No overlay — scene renders progressively on black bg
})

export default function OasisPage() {
  const switchWorld = useOasisStore(s => s.switchWorld)

  // Handle ?world=xxx from explore page (switch to own world)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const worldParam = params.get('world')
    if (worldParam) {
      const registry = useOasisStore.getState().worldRegistry
      if (registry.some(w => w.id === worldParam)) {
        switchWorld(worldParam)
      }
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [switchWorld])

  return (
    <main className="w-full h-screen bg-black">
      <Scene />

      {/* Realm selector — top center */}
      <RealmSelector />

      {/* Controls hint - bottom center */}
      <div className="ui-overlay bottom-4 left-1/2 -translate-x-1/2">
        <p className="text-xs text-gray-600 text-center">
          Drag to orbit • Scroll to zoom • Click to interact
        </p>
      </div>
    </main>
  )
}
