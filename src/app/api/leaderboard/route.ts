// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// LEADERBOARD API — Who's grinding hardest?
// GET /api/leaderboard?type=xp|aura&period=week|month|all&limit=50
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getServerSupabase } from '@/lib/supabase'
import { getLevelTitle, levelFromXp } from '@/lib/xp'

export interface LeaderboardEntry {
  rank: number
  user_id: string
  display_name: string
  avatar_url: string | null
  level: number
  level_title: string
  level_badge: string
  value: number // xp or aura depending on type
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[]
  user_rank: number | null
  user_value: number | null
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id || null

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'xp'
    const period = searchParams.get('period') || 'all'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const sb = getServerSupabase()

    if (type === 'aura') {
      return await getAuraLeaderboard(sb, userId, limit)
    }

    if (period === 'week' || period === 'month') {
      return await getPeriodXpLeaderboard(sb, userId, period, limit)
    }

    return await getAllTimeXpLeaderboard(sb, userId, limit)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Leaderboard] error:', msg)
    return NextResponse.json({ entries: [], user_rank: null, user_value: null }, { status: 500 })
  }
}

// All-time XP: just query profiles ordered by xp DESC
async function getAllTimeXpLeaderboard(sb: ReturnType<typeof getServerSupabase>, userId: string | null, limit: number): Promise<NextResponse> {
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, display_name, name, avatar_url, xp, level')
    .not('display_name', 'is', null)
    .order('xp', { ascending: false })
    .limit(limit)

  if (!profiles) return NextResponse.json({ entries: [], user_rank: null, user_value: null })

  const entries: LeaderboardEntry[] = profiles.map((p, i) => {
    const level = levelFromXp(p.xp || 0)
    const title = getLevelTitle(level)
    return {
      rank: i + 1,
      user_id: p.id,
      display_name: p.display_name || p.name || 'Wanderer',
      avatar_url: p.avatar_url,
      level,
      level_title: title.title,
      level_badge: title.badge,
      value: p.xp || 0,
    }
  })

  // Find current user's rank
  let user_rank: number | null = null
  let user_value: number | null = null
  if (userId) {
    const found = entries.find(e => e.user_id === userId)
    if (found) {
      user_rank = found.rank
      user_value = found.value
    } else {
      // User not in top N — find their rank
      const { count } = await sb
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .not('display_name', 'is', null)
        .gt('xp', 0)

      const { data: userProfile } = await sb
        .from('profiles')
        .select('xp')
        .eq('id', userId)
        .single()

      if (userProfile) {
        user_value = userProfile.xp || 0
        const { count: above } = await sb
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .not('display_name', 'is', null)
          .gt('xp', user_value)

        user_rank = (above || 0) + 1
      }
    }
  }

  return NextResponse.json({ entries, user_rank, user_value })
}

// Period XP: aggregate from xp_events within time window
async function getPeriodXpLeaderboard(sb: ReturnType<typeof getServerSupabase>, userId: string | null, period: 'week' | 'month', limit: number): Promise<NextResponse> {
  const daysAgo = period === 'week' ? 7 : 30
  const since = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()

  // Get XP events within the period
  const { data: events } = await sb
    .from('xp_events')
    .select('user_id, xp')
    .gte('created_at', since)

  if (!events || events.length === 0) {
    return NextResponse.json({ entries: [], user_rank: null, user_value: null })
  }

  // Aggregate XP per user
  const xpMap: Record<string, number> = {}
  for (const e of events) {
    xpMap[e.user_id] = (xpMap[e.user_id] || 0) + e.xp
  }

  // Sort and take top N
  const sorted = Object.entries(xpMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)

  const userIds = sorted.map(([uid]) => uid)
  if (userIds.length === 0) {
    return NextResponse.json({ entries: [], user_rank: null, user_value: null })
  }

  // Fetch profile info for these users
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, display_name, name, avatar_url, xp, level')
    .in('id', userIds)

  const profileMap: Record<string, typeof profiles extends (infer T)[] | null ? T : never> = {}
  if (profiles) {
    for (const p of profiles) profileMap[p.id] = p
  }

  const entries: LeaderboardEntry[] = sorted.map(([uid, periodXp], i) => {
    const p = profileMap[uid]
    const level = levelFromXp(p?.xp || 0)
    const title = getLevelTitle(level)
    return {
      rank: i + 1,
      user_id: uid,
      display_name: p?.display_name || p?.name || 'Wanderer',
      avatar_url: p?.avatar_url || null,
      level,
      level_title: title.title,
      level_badge: title.badge,
      value: periodXp,
    }
  })

  // Current user's rank in this period
  let user_rank: number | null = null
  let user_value: number | null = null
  if (userId && xpMap[userId] !== undefined) {
    user_value = xpMap[userId]
    // Count how many users have more period XP
    const above = Object.values(xpMap).filter(v => v > user_value!).length
    user_rank = above + 1
  }

  return NextResponse.json({ entries, user_rank, user_value })
}

// Aura leaderboard: profiles ordered by aura DESC
async function getAuraLeaderboard(sb: ReturnType<typeof getServerSupabase>, userId: string | null, limit: number): Promise<NextResponse> {
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, display_name, name, avatar_url, xp, level, aura')
    .not('display_name', 'is', null)
    .gt('aura', 0)
    .order('aura', { ascending: false })
    .limit(limit)

  if (!profiles) return NextResponse.json({ entries: [], user_rank: null, user_value: null })

  const entries: LeaderboardEntry[] = profiles.map((p, i) => {
    const level = levelFromXp(p.xp || 0)
    const title = getLevelTitle(level)
    return {
      rank: i + 1,
      user_id: p.id,
      display_name: p.display_name || p.name || 'Wanderer',
      avatar_url: p.avatar_url,
      level,
      level_title: title.title,
      level_badge: title.badge,
      value: p.aura || 0,
    }
  })

  let user_rank: number | null = null
  let user_value: number | null = null
  if (userId) {
    const found = entries.find(e => e.user_id === userId)
    if (found) {
      user_rank = found.rank
      user_value = found.value
    } else {
      const { data: userProfile } = await sb
        .from('profiles')
        .select('aura')
        .eq('id', userId)
        .single()

      if (userProfile && (userProfile.aura || 0) > 0) {
        user_value = userProfile.aura || 0
        const { count: above } = await sb
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .not('display_name', 'is', null)
          .gt('aura', user_value)

        user_rank = (above || 0) + 1
      }
    }
  }

  return NextResponse.json({ entries, user_rank, user_value })
}
