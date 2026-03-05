// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// 04515 — Profile API
// GET /api/profile — returns credits, xp, level, aura, level title
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getServerSupabase } from '@/lib/supabase'
import { FREE_CREDITS } from '@/lib/conjure/types'
import { getLevelTitle, levelProgress, xpToNextLevel } from '@/lib/xp'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await getServerSupabase()
      .from('profiles')
      .select('credits, xp, level, aura, wallet_address, last_login_date')
      .eq('id', session.user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({
        credits: FREE_CREDITS, xp: 0, level: 1, aura: 0,
        wallet_address: null, levelTitle: 'Apprentice', levelBadge: '░',
        levelProgress: 0, xpToNext: 100,
      })
    }

    const level = data.level || 1
    const xp = data.xp || 0
    const title = getLevelTitle(level)

    return NextResponse.json({
      ...data,
      aura: data.aura || 0,
      levelTitle: title.title,
      levelBadge: title.badge,
      levelProgress: levelProgress(xp),
      xpToNext: xpToNextLevel(level),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Profile] GET error:', msg)
    return NextResponse.json({
      credits: FREE_CREDITS, xp: 0, level: 1, aura: 0,
      wallet_address: null, levelTitle: 'Apprentice', levelBadge: '░',
      levelProgress: 0, xpToNext: 100,
    })
  }
}
