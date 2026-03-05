'use client'

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// WORLD EXPLORER — Discover public worlds
// ─═̷─═̷─ॐ─═̷─═̷─ The gateway to the community ─═̷─═̷─ॐ─═̷─═̷─
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { ExploreWorld } from '@/app/api/explore/route'

type SortMode = 'hot' | 'new' | 'top'

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/explore`
  : '/api/explore'

export default function ExplorePage() {
  const router = useRouter()
  const [worlds, setWorlds] = useState<ExploreWorld[]>([])
  const [sort, setSort] = useState<SortMode>('hot')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchWorlds = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort })
      if (search) params.set('q', search)
      const res = await fetch(`${API_BASE}?${params}`)
      if (res.ok) {
        const data = await res.json()
        setWorlds(data.worlds || [])
      }
    } catch (err) {
      console.error('[Explore] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [sort, search])

  useEffect(() => { fetchWorlds() }, [fetchWorlds])

  const handleVote = async (worldId: string) => {
    try {
      const res = await fetch(`/api/worlds/${worldId}/vote`, { method: 'POST' })
      if (res.ok) {
        const { voted } = await res.json()
        setWorlds(prev => prev.map(w =>
          w.id === worldId
            ? { ...w, upvotes: w.upvotes + (voted ? 1 : -1), user_voted: voted }
            : w
        ))
      }
    } catch (err) {
      console.error('[Explore] vote error:', err)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="/favicon.svg" alt="Oasis" width={32} height={32} className="opacity-90" />
            <h1
              className="text-xl font-bold tracking-wider"
              style={{ fontFamily: "'Courier New', monospace", textShadow: '0 0 15px rgba(168, 85, 247, 0.4)' }}
            >
              EXPLORE WORLDS
            </h1>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 text-sm border border-gray-700 rounded hover:bg-gray-900 transition-colors"
          >
            Enter the Oasis
          </button>
        </div>
      </header>

      {/* Controls */}
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
        {/* Sort tabs */}
        <div className="flex gap-1 bg-gray-900 rounded p-1">
          {(['hot', 'new', 'top'] as SortMode[]).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                sort === s
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {s === 'hot' ? '🔥 Hot' : s === 'new' ? '✨ New' : '🏆 Top'}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search worlds..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] max-w-sm px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
        />
      </div>

      {/* World Grid */}
      <div className="max-w-6xl mx-auto px-6 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-gray-500 animate-pulse">Loading worlds...</p>
          </div>
        ) : worlds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <p className="text-gray-500 text-lg">No public worlds yet</p>
            <p className="text-gray-600 text-sm">Be the first to share your world with the community</p>
            <button
              onClick={() => router.push('/')}
              className="mt-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded text-sm transition-colors"
            >
              Create a World
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {worlds.map(world => (
              <WorldCard
                key={world.id}
                world={world}
                onVote={() => handleVote(world.id)}
                onClick={() => {
                  // TODO: Open world in read-only viewer mode
                  // For now, just show the world name
                  console.log('[Explore] View world:', world.id)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-4 text-center">
        <p className="text-gray-700 text-xs">04515.xyz — The Oasis</p>
      </footer>
    </main>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLD CARD — Single world in the grid
// ═══════════════════════════════════════════════════════════════════════════

function WorldCard({
  world,
  onVote,
  onClick,
}: {
  world: ExploreWorld
  onVote: () => void
  onClick: () => void
}) {
  return (
    <div
      className="group border border-gray-800 rounded-lg overflow-hidden bg-gray-950 hover:border-gray-600 transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-gray-900 flex items-center justify-center relative overflow-hidden">
        {world.thumbnail_url ? (
          <img
            src={world.thumbnail_url}
            alt={world.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-4xl">{world.icon}</span>
        )}
        {/* Visit count overlay */}
        <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded text-xs text-gray-300">
          👁 {world.visit_count}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-white truncate">
              {world.icon} {world.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {world.creator_avatar && (
                <img
                  src={world.creator_avatar}
                  alt=""
                  className="w-4 h-4 rounded-full"
                />
              )}
              <span className="text-xs text-gray-500 truncate">
                {world.creator_name}
              </span>
            </div>
          </div>

          {/* Upvote button */}
          <button
            onClick={e => { e.stopPropagation(); onVote() }}
            className={`flex flex-col items-center px-2 py-1 rounded transition-colors ${
              world.user_voted
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                : 'bg-gray-900 text-gray-400 hover:text-purple-400 border border-transparent hover:border-purple-500/30'
            }`}
          >
            <span className="text-sm">▲</span>
            <span className="text-xs font-mono">{world.upvotes}</span>
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
          <span>{world.object_count} objects</span>
          <span>·</span>
          <span>{timeAgo(world.updated_at)}</span>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}
