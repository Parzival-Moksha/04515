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

/** Award XP for an action. Fire-and-forget — errors are swallowed. */
export async function awardXp(action: XpAction, worldId?: string): Promise<XpResult | null> {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, worldId }),
    })
    if (!res.ok) return null
    return await res.json() as XpResult
  } catch {
    return null
  }
}

/** React hook wrapper for awardXp */
export function useXp() {
  const award = useCallback(async (action: XpAction, worldId?: string) => {
    const result = await awardXp(action, worldId)
    if (result?.leveledUp) {
      console.log(`[XP] ⬆ LEVEL UP! ${result.oldLevel} → ${result.level}`)
      // TODO: Trigger level-up VFX here
    }
    return result
  }, [])

  return { awardXp: award }
}
