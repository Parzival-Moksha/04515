'use client'

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// 04515 — Profile Button + Dropdown
// First button in top-left bar. Shows avatar, opens profile panel.
// Fetches credits/xp/level from Supabase via /api/profile.
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { useState, useRef, useEffect, useContext, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { SettingsContext } from '../scene-lib'
import { FREE_CREDITS, CREDIT_PACKS } from '@/lib/conjure/types'
import { XP_AWARDS } from '@/lib/xp'

interface ProfileData {
  credits: number
  xp: number
  level: number
  aura: number
  wallet_address: string | null
  levelTitle: string
  levelBadge: string
  levelProgress: number
  xpToNext: number
}

const XP_ACTION_LABELS = [
  { label: 'Place object', xp: XP_AWARDS.PLACE_CATALOG_OBJECT },
  { label: 'Conjure asset', xp: XP_AWARDS.CONJURE_ASSET },
  { label: 'Craft scene', xp: XP_AWARDS.CRAFT_SCENE },
  { label: 'Add light', xp: XP_AWARDS.ADD_LIGHT },
  { label: 'Set world public', xp: XP_AWARDS.SET_WORLD_PUBLIC },
  { label: 'World upvoted', xp: XP_AWARDS.WORLD_UPVOTED },
  { label: 'Daily login', xp: XP_AWARDS.DAILY_LOGIN },
]

export function ProfileButton() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [profile, setProfile] = useState<ProfileData>({ credits: FREE_CREDITS, xp: 0, level: 1, aura: 0, wallet_address: null, levelTitle: 'Apprentice', levelBadge: '░', levelProgress: 0, xpToNext: 100 })
  const [showPacks, setShowPacks] = useState(false)
  const [showXpInfo, setShowXpInfo] = useState(false)
  const [buying, setBuying] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const { settings } = useContext(SettingsContext)

  const buyCredits = useCallback(async (packId: string) => {
    setBuying(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('[Profile] Checkout failed:', err)
    } finally {
      setBuying(false)
    }
  }, [])

  // Fetch profile data from Supabase when dropdown opens
  useEffect(() => {
    if (!isOpen || !session?.user) return
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => setProfile(data))
      .catch(() => {}) // fail silently, keep defaults
  }, [isOpen, session?.user])

  // Auto-open and refresh after Stripe checkout return
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('credits') === 'success') {
      setIsOpen(true)
      // Clean URL without reload
      window.history.replaceState({}, '', window.location.pathname)
      // Refetch profile to show new credit balance
      fetch('/api/profile')
        .then(r => r.json())
        .then(data => setProfile(data))
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!session?.user) return null

  const user = session.user
  const initial = (user.name?.[0] || user.email?.[0] || '?').toUpperCase()

  return (
    <div ref={panelRef} className="relative">
      {/* Avatar button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden transition-all hover:scale-110"
        style={{
          background: isOpen ? 'rgba(168,85,247,0.3)' : 'rgba(0,0,0,0.6)',
          border: `1px solid ${isOpen ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.15)'}`,
          boxShadow: isOpen ? '0 0 12px rgba(168,85,247,0.3)' : 'none',
        }}
        title={user.name || 'Profile'}
      >
        {user.image ? (
          <img src={user.image} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-sm font-bold text-purple-300">{initial}</span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className="absolute top-12 left-0 w-64 rounded-lg overflow-hidden"
          style={{
            backgroundColor: `rgba(0, 0, 0, ${settings.uiOpacity})`,
            border: '1px solid rgba(168,85,247,0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          {/* User info header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              {user.image ? (
                <img src={user.image} alt="" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-purple-900 flex items-center justify-center">
                  <span className="text-lg font-bold text-purple-300">{initial}</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name || 'Wanderer'}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="p-4 border-b border-white/10">
            {/* Level title + badge */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-purple-400 font-bold tracking-wider">
                {profile.levelBadge} Lv.{profile.level} {profile.levelTitle}
              </span>
              <span className="text-xs text-gray-600">
                {profile.xp} / {profile.xp + (profile.xpToNext - Math.round(profile.levelProgress * profile.xpToNext))} XP
              </span>
            </div>
            {/* XP progress bar */}
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(2, profile.levelProgress * 100)}%`,
                  background: 'linear-gradient(90deg, #7C3AED, #A855F7)',
                }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-green-400">{profile.credits}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Credits</p>
              </div>
              <div>
                <p className="text-lg font-bold text-orange-400">{profile.level}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Level</p>
              </div>
              <div>
                <p className="text-lg font-bold text-pink-400">{profile.aura}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Aura</p>
              </div>
            </div>
          </div>

          {/* XP Actions — collapsible */}
          <div className="px-4 py-2 border-b border-white/10">
            <button
              onClick={() => setShowXpInfo(!showXpInfo)}
              className="w-full flex items-center justify-between text-[10px] text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
            >
              <span className="uppercase tracking-wider">XP Guide</span>
              <span>{showXpInfo ? '▲' : '▼'}</span>
            </button>
            {showXpInfo && (
              <div className="mt-2 space-y-0.5 text-[10px]">
                {XP_ACTION_LABELS.map(({ label, xp }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-purple-400 font-mono">+{xp}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Buy Credits */}
          <div className="px-4 py-3 border-b border-white/10">
            {!showPacks ? (
              <button
                onClick={() => setShowPacks(true)}
                className="w-full py-2 rounded-md text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition-all cursor-pointer"
              >
                Buy Credits
              </button>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Select a pack</p>
                {CREDIT_PACKS.map(pack => (
                  <button
                    key={pack.id}
                    disabled={buying}
                    onClick={() => buyCredits(pack.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs transition-all cursor-pointer ${
                      pack.popular
                        ? 'bg-purple-600/20 border border-purple-500/40 text-purple-300 hover:bg-purple-600/30'
                        : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                    } ${buying ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    <span className="font-medium">{pack.credits} credits</span>
                    <span className="float-right text-green-400">${(pack.priceUsd / 100).toFixed(0)}</span>
                    {pack.popular && <span className="block text-[9px] text-purple-400 mt-0.5">Most popular</span>}
                  </button>
                ))}
                <button
                  onClick={() => setShowPacks(false)}
                  className="w-full text-center text-[10px] text-gray-600 hover:text-gray-400 mt-1 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Menu items */}
          <div className="p-2">
            <button
              onClick={() => { window.open('/explore', '_blank'); setIsOpen(false) }}
              className="w-full text-left px-3 py-2 rounded text-sm text-purple-300 hover:bg-purple-500/10 transition-colors cursor-pointer"
            >
              🌐 Explore Worlds
            </button>
            <button
              disabled
              className="w-full text-left px-3 py-2 rounded text-sm text-gray-500 cursor-not-allowed"
            >
              Wallet (coming soon)
            </button>
            <button
              onClick={() => { signOut({ callbackUrl: '/login' }); setIsOpen(false) }}
              className="w-full text-left px-3 py-2 rounded text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
