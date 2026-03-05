// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// useXp — Client hook for awarding XP
// Fire-and-forget: call awardXp('CONJURE_ASSET') and it handles the rest
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { useCallback } from 'react'
import type { XpAction } from '@/lib/xp'

interface XpResult {
  xp: number
  totalXp: number
  level: number
  leveledUp: boolean
  oldLevel?: number
}

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/xp`
  : '/api/xp'

// ═══════════════════════════════════════════════════════════════════════════
// Floating +XP indicator — pure DOM, no React needed
// ═══════════════════════════════════════════════════════════════════════════

let floatOffset = 0 // staggers multiple simultaneous awards

function showXpFloat(amount: number, leveledUp: boolean, newLevel?: number) {
  if (typeof document === 'undefined') return

  const el = document.createElement('div')
  const yStart = 80 + floatOffset * 30
  floatOffset++
  setTimeout(() => { floatOffset = Math.max(0, floatOffset - 1) }, 400)

  el.textContent = leveledUp ? `⬆ LEVEL ${newLevel}!` : `+${amount} XP`
  Object.assign(el.style, {
    position: 'fixed',
    top: `${yStart}px`,
    left: '50%',
    transform: 'translateX(-50%)',
    color: leveledUp ? '#F59E0B' : '#A855F7',
    fontSize: leveledUp ? '18px' : '14px',
    fontFamily: "'Courier New', monospace",
    fontWeight: 'bold',
    textShadow: leveledUp ? '0 0 20px rgba(245,158,11,0.8)' : '0 0 12px rgba(168,85,247,0.6)',
    pointerEvents: 'none',
    zIndex: '99999',
    transition: 'all 2.5s ease-out',
    opacity: '1',
  })
  document.body.appendChild(el)

  // Animate upward + fade
  requestAnimationFrame(() => {
    el.style.top = `${yStart - 60}px`
    el.style.opacity = '0'
  })

  setTimeout(() => el.remove(), 3000)
}

/** Award XP for an action. Fire-and-forget — errors are swallowed. */
export async function awardXp(action: XpAction, worldId?: string): Promise<XpResult | null> {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, worldId }),
    })
    if (!res.ok) return null
    const result = await res.json() as XpResult
    if (result.xp > 0) {
      showXpFloat(result.xp, result.leveledUp, result.level)
    }
    return result
  } catch {
    return null
  }
}

/** React hook wrapper for awardXp */
export function useXp() {
  const award = useCallback(async (action: XpAction, worldId?: string) => {
    return awardXp(action, worldId)
  }, [])

  return { awardXp: award }
}
