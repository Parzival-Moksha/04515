'use client'

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// OASIS — Main Page
// Entry point to the Oasis — The Forge and beyond
// ─═̷─═̷─ॐ─═̷─═̷─ Where consciousness renders itself ─═̷─═̷─ॐ─═̷─═̷─
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { RealmSelector } from '@/components/realms/RealmSelector'
import { useOasisStore } from '@/store/oasisStore'
// View mode banner removed — user exits via world selector dropdown

// Dynamic import to avoid SSR issues with Three.js
const Scene = dynamic(() => import('@/components/Scene'), {
  ssr: false,
  loading: () => null,  // No overlay — scene renders progressively on black bg
})

export default function OasisPage() {
  const { data: session, status } = useSession()
  const switchWorld = useOasisStore(s => s.switchWorld)
  const enterViewMode = useOasisStore(s => s.enterViewMode)
  const routeHandled = useRef(false)

  // Handle ?world=xxx (switch to own world) and ?view=xxx (view public world)
  // Guarded by ref: runs exactly once after session resolves.
  // Without this, enterViewMode → Zustand re-render → effect re-fires with
  // URL already stripped → falls into !session → redirects to /explore.
  useEffect(() => {
    if (status === 'loading') return
    if (routeHandled.current) return
    routeHandled.current = true

    const params = new URLSearchParams(window.location.search)
    const worldParam = params.get('world')
    const viewParam = params.get('view')

    if (viewParam) {
      enterViewMode(viewParam)
      window.history.replaceState({}, '', window.location.pathname)
    } else if (worldParam && session) {
      const registry = useOasisStore.getState().worldRegistry
      if (registry.some(w => w.id === worldParam)) {
        switchWorld(worldParam)
      }
      window.history.replaceState({}, '', window.location.pathname)
    } else if (!session) {
      // Anonymous user without ?view= param — redirect to explore
      window.location.href = '/explore'
    } else {
      // Authenticated user, no params — first visit?
      const hasVisited = localStorage.getItem('oasis-has-visited')
      if (!hasVisited) {
        localStorage.setItem('oasis-has-visited', '1')
        enterViewMode('world-1772594968383-6r20') // "Ready Player One" showcase
      }
    }
  }, [switchWorld, enterViewMode, session, status])

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
