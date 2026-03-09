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
// View mode banner removed — user exits via world selector dropdown

// Dynamic import to avoid SSR issues with Three.js
const Scene = dynamic(() => import('@/components/Scene'), {
  ssr: false,
  loading: () => null,  // No overlay — scene renders progressively on black bg
})

export default function OasisPage() {
  const switchWorld = useOasisStore(s => s.switchWorld)
  const enterViewMode = useOasisStore(s => s.enterViewMode)

  // Handle ?world=xxx (switch to own world) and ?view=xxx (view public world)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const worldParam = params.get('world')
    const viewParam = params.get('view')

    if (viewParam) {
      enterViewMode(viewParam)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (worldParam) {
      const registry = useOasisStore.getState().worldRegistry
      if (registry.some(w => w.id === worldParam)) {
        switchWorld(worldParam)
      }
      window.history.replaceState({}, '', window.location.pathname)
    } else {
      // First visit ever? Show the showcase world
      const hasVisited = localStorage.getItem('oasis-has-visited')
      if (!hasVisited) {
        localStorage.setItem('oasis-has-visited', '1')
        enterViewMode('world-1772594968383-6r20') // "Ready Player One" showcase
      }
    }
  }, [switchWorld, enterViewMode])

  return (
    <main className="w-full h-screen bg-black">
      <Scene />

      {/* Realm selector — top center (also serves as exit from view mode) */}
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
