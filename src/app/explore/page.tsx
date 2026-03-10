'use client'

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// WORLD EXPLORER + LEADERBOARD
// ─═̷─═̷─ॐ─═̷─═̷─ The gateway to the community ─═̷─═̷─ॐ─═̷─═̷─
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { ExploreWorld } from '@/app/api/explore/route'
import type { LeaderboardEntry, LeaderboardResponse } from '@/app/api/leaderboard/route'

type PageTab = 'worlds' | 'leaderboard'
type SortMode = 'hot' | 'new' | 'top'
type LeaderboardType = 'xp' | 'aura'
type LeaderboardPeriod = 'week' | 'month' | 'all'

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/explore`
  : '/api/explore'

const LB_API_BASE = typeof window !== 'undefined'
  ? `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/leaderboard`
  : '/api/leaderboard'

function getInitialTab(): PageTab {
  if (typeof window === 'undefined') return 'worlds'
  const params = new URLSearchParams(window.location.search)
  return params.get('tab') === 'leaderboard' ? 'leaderboard' : 'worlds'
}

export default function ExplorePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [pageTab, setPageTab] = useState<PageTab>(getInitialTab)

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
              {pageTab === 'worlds' ? 'EXPLORE WORLDS' : 'LEADERBOARD'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {!session?.user ? (
              <button
                onClick={() => router.push('/login')}
                className="px-4 py-2 text-sm font-medium text-white rounded transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #7C3AED, #A855F7)',
                  boxShadow: '0 0 15px rgba(168,85,247,0.3)',
                }}
              >
                Sign Up to Build
              </button>
            ) : (
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 text-sm border border-gray-700 rounded hover:bg-gray-900 transition-colors"
              >
                Enter the Oasis
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Page tabs: Worlds | Leaderboard */}
      <div className="max-w-6xl mx-auto px-6 pt-4">
        <div className="flex gap-1 bg-gray-900/60 rounded-lg p-1 w-fit">
          <button
            onClick={() => setPageTab('worlds')}
            className={`px-5 py-2 text-sm rounded-md font-medium transition-all ${
              pageTab === 'worlds'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Worlds
          </button>
          <button
            onClick={() => setPageTab('leaderboard')}
            className={`px-5 py-2 text-sm rounded-md font-medium transition-all ${
              pageTab === 'leaderboard'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Leaderboard
          </button>
        </div>
      </div>

      {/* Content */}
      {pageTab === 'worlds' ? (
        <WorldsTab session={session} router={router} />
      ) : (
        <LeaderboardTab session={session} />
      )}

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-4 text-center">
        <p className="text-gray-700 text-xs">04515.xyz — The Oasis</p>
      </footer>
    </main>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLDS TAB — The original explore grid
// ═══════════════════════════════════════════════════════════════════════════

function WorldsTab({ session, router }: { session: ReturnType<typeof useSession>['data']; router: ReturnType<typeof useRouter> }) {
  const [worlds, setWorlds] = useState<ExploreWorld[]>([])
  const [sort, setSort] = useState<SortMode>('hot')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [votingId, setVotingId] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search input (400ms)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 400)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  const fetchWorlds = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort })
      if (debouncedSearch) params.set('q', debouncedSearch)
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
  }, [sort, debouncedSearch])

  useEffect(() => { fetchWorlds() }, [fetchWorlds])

  const handleVote = async (worldId: string) => {
    if (!session?.user) {
      router.push('/login')
      return
    }
    if (votingId) return
    setVotingId(worldId)
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
    } finally {
      setVotingId(null)
    }
  }

  const handleWorldClick = (world: ExploreWorld) => {
    if (session?.user?.id === world.user_id) {
      router.push(`/?world=${world.id}`)
    } else {
      router.push(`/?view=${world.id}`)
    }
  }

  return (
    <>
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
              {s === 'hot' ? 'Hot' : s === 'new' ? 'New' : 'Top'}
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
                isOwn={session?.user?.id === world.user_id}
                onVote={() => handleVote(world.id)}
                voting={votingId === world.id}
                onClick={() => handleWorldClick(world)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// LEADERBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════

function LeaderboardTab({ session }: { session: ReturnType<typeof useSession>['data'] }) {
  const [lbType, setLbType] = useState<LeaderboardType>('xp')
  const [period, setPeriod] = useState<LeaderboardPeriod>('all')
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: lbType, period, limit: '50' })
      const res = await fetch(`${LB_API_BASE}?${params}`)
      if (res.ok) setData(await res.json())
    } catch (err) {
      console.error('[Leaderboard] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [lbType, period])

  useEffect(() => { fetchLeaderboard() }, [fetchLeaderboard])

  return (
    <div className="max-w-4xl mx-auto px-6 py-4 pb-8">
      {/* Sub-tabs: XP | Aura */}
      <div className="flex items-center gap-4 flex-wrap mb-4">
        <div className="flex gap-1 bg-gray-900 rounded p-1">
          <button
            onClick={() => setLbType('xp')}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              lbType === 'xp' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            XP Grind
          </button>
          <button
            onClick={() => setLbType('aura')}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              lbType === 'aura' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            Aura
          </button>
        </div>

        {/* Period filter — only for XP */}
        {lbType === 'xp' && (
          <div className="flex gap-1 bg-gray-900 rounded p-1">
            {(['week', 'month', 'all'] as LeaderboardPeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  period === p ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {p === 'week' ? '7 days' : p === 'month' ? '30 days' : 'All-time'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* User rank banner */}
      {session?.user && data?.user_rank && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-purple-900/20 border border-purple-500/20 flex items-center gap-3">
          <span className="text-purple-400 font-mono text-sm">Your rank:</span>
          <span className="text-white font-bold text-lg">#{data.user_rank}</span>
          <span className="text-gray-400 text-sm">
            ({(data.user_value || 0).toLocaleString()} {lbType === 'xp' ? 'XP' : 'aura'})
          </span>
        </div>
      )}

      {/* Leaderboard table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500 animate-pulse">Loading leaderboard...</p>
        </div>
      ) : !data?.entries.length ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-gray-500 text-lg">No rankings yet</p>
          <p className="text-gray-600 text-sm">
            {lbType === 'xp' && period !== 'all'
              ? `No one earned XP in the last ${period === 'week' ? '7' : '30'} days`
              : 'Start building to claim your spot'}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Header row */}
          <div className="grid grid-cols-[3rem_1fr_5rem_6rem] sm:grid-cols-[3rem_1fr_6rem_4rem_6rem] items-center px-3 py-2 text-xs text-gray-500 font-mono uppercase tracking-wider">
            <span>#</span>
            <span>Builder</span>
            <span className="hidden sm:block text-center">Level</span>
            <span className="text-right">{lbType === 'xp' ? 'XP' : 'Aura'}</span>
          </div>

          {data.entries.map(entry => (
            <LeaderboardRow
              key={entry.user_id}
              entry={entry}
              isCurrentUser={session?.user?.id === entry.user_id}
              valueLabel={lbType === 'xp' ? 'XP' : ''}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// LEADERBOARD ROW
// ═══════════════════════════════════════════════════════════════════════════

const RANK_STYLES: Record<number, { bg: string; text: string; medal: string }> = {
  1: { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400', medal: '' },
  2: { bg: 'bg-gray-300/10 border-gray-400/30', text: 'text-gray-300', medal: '' },
  3: { bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400', medal: '' },
}

function LeaderboardRow({ entry, isCurrentUser, valueLabel }: {
  entry: LeaderboardEntry
  isCurrentUser: boolean
  valueLabel: string
}) {
  const style = RANK_STYLES[entry.rank]
  const isTop3 = !!style

  return (
    <div
      className={`grid grid-cols-[3rem_1fr_5rem_6rem] sm:grid-cols-[3rem_1fr_6rem_4rem_6rem] items-center px-3 py-2.5 rounded-lg border transition-colors ${
        isCurrentUser
          ? 'bg-purple-900/20 border-purple-500/30'
          : isTop3
            ? `${style.bg} border`
            : 'bg-gray-900/40 border-transparent hover:bg-gray-900/60'
      }`}
    >
      {/* Rank */}
      <span className={`font-mono font-bold text-sm ${
        isTop3 ? style.text : 'text-gray-500'
      }`}>
        {isTop3 ? style.medal : `#${entry.rank}`}
      </span>

      {/* User info */}
      <div className="flex items-center gap-2.5 min-w-0">
        {entry.avatar_url ? (
          <img src={entry.avatar_url} alt="" className="w-7 h-7 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
            <span className="text-xs text-gray-500">{entry.display_name[0]?.toUpperCase()}</span>
          </div>
        )}
        <div className="min-w-0">
          <span className={`text-sm truncate block ${isCurrentUser ? 'text-purple-300 font-medium' : 'text-white'}`}>
            {entry.display_name}
            {isCurrentUser && <span className="text-purple-500 text-xs ml-1">(you)</span>}
          </span>
          <span className="text-xs text-gray-600 sm:hidden">{entry.level_badge} {entry.level_title}</span>
        </div>
      </div>

      {/* Level (desktop) */}
      <div className="hidden sm:flex items-center justify-center gap-1">
        <span className="text-xs font-mono text-gray-400">{entry.level_badge}</span>
        <span className="text-xs text-gray-500">Lv.{entry.level}</span>
      </div>

      {/* Value */}
      <span className={`text-right font-mono text-sm ${isTop3 ? style.text : 'text-gray-300'}`}>
        {entry.value.toLocaleString()}
        {valueLabel && <span className="text-gray-600 text-xs ml-0.5">{valueLabel}</span>}
      </span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLD CARD — Single world in the grid
// ═══════════════════════════════════════════════════════════════════════════

function WorldCard({
  world,
  isOwn,
  onVote,
  voting,
  onClick,
}: {
  world: ExploreWorld
  isOwn: boolean
  onVote: () => void
  voting: boolean
  onClick: () => void
}) {
  return (
    <div
      className={`group border rounded-lg overflow-hidden bg-gray-950 hover:border-gray-600 transition-all cursor-pointer ${
        isOwn ? 'border-orange-500/30' : 'border-gray-800'
      }`}
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
          <div className="flex flex-col items-center gap-2">
            <span className="text-5xl">{world.icon}</span>
            <span className="text-xs text-gray-700 font-mono">{world.object_count} objects</span>
          </div>
        )}
        {/* Visit count overlay */}
        <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded text-xs text-gray-300">
          {world.visit_count} visits
        </div>
        {/* Own world badge */}
        {isOwn && (
          <div className="absolute top-2 left-2 bg-orange-500/80 px-2 py-0.5 rounded text-xs text-white font-bold">
            YOUR WORLD
          </div>
        )}
        {/* Open Build badge */}
        {world.visibility === 'public_edit' && !isOwn && (
          <div className="absolute top-2 left-2 bg-green-500/80 px-2 py-0.5 rounded text-xs text-white font-bold">
            OPEN BUILD
          </div>
        )}
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
          {!isOwn && (
            <button
              onClick={e => { e.stopPropagation(); onVote() }}
              disabled={voting}
              className={`flex flex-col items-center px-2 py-1 rounded transition-colors ${
                world.user_voted
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                  : 'bg-gray-900 text-gray-400 hover:text-purple-400 border border-transparent hover:border-purple-500/30'
              } ${voting ? 'opacity-50' : ''}`}
            >
              <span className="text-sm">{world.user_voted ? '▲' : '△'}</span>
              <span className="text-xs font-mono">{world.upvotes}</span>
            </button>
          )}
          {isOwn && world.upvotes > 0 && (
            <div className="flex flex-col items-center px-2 py-1 text-purple-400/60">
              <span className="text-sm">▲</span>
              <span className="text-xs font-mono">{world.upvotes}</span>
            </div>
          )}
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
