// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// EXPLORE API — Discover public worlds
// GET /api/explore?sort=hot|new|top&limit=20&offset=0
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getServerSupabase } from '@/lib/supabase'

export interface ExploreWorld {
  id: string
  name: string
  icon: string
  visibility: string  // 'public' | 'public_edit'
  creator_name: string
  creator_avatar: string | null
  user_id: string
  visit_count: number
  object_count: number
  thumbnail_url: string | null
  created_at: string
  updated_at: string
  upvotes: number
  user_voted: boolean  // whether current user has upvoted
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const userId = session?.user?.id || null

    const { searchParams } = new URL(req.url)
    const sort = searchParams.get('sort') || 'hot'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('q') || ''

    const sb = getServerSupabase()

    // Base query: public + public_edit worlds
    let query = sb
      .from('worlds')
      .select('id, name, icon, user_id, visibility, creator_name, creator_avatar, visit_count, object_count, thumbnail_url, created_at, updated_at')
      .in('visibility', ['public', 'public_edit'])

    // Search filter
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    // Sort order
    switch (sort) {
      case 'new':
        query = query.order('created_at', { ascending: false })
        break
      case 'top':
        query = query.order('visit_count', { ascending: false })
        break
      case 'hot':
      default:
        // Hot = recent activity + visits (sort by updated_at as proxy)
        query = query.order('updated_at', { ascending: false })
        break
    }

    query = query.range(offset, offset + limit - 1)

    const { data: worlds, error } = await query

    if (error) {
      console.error('[Explore] query error:', error.message)
      return NextResponse.json({ worlds: [], total: 0 })
    }

    if (!worlds || worlds.length === 0) {
      return NextResponse.json({ worlds: [], total: 0 })
    }

    // Get vote counts + fresh profile data for these worlds
    const worldIds = worlds.map(w => w.id)
    const uniqueUserIds = [...new Set(worlds.map(w => w.user_id))]

    // Fetch fresh profile data (display_name, avatar_url) — never stale
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, display_name, name, avatar_url')
      .in('id', uniqueUserIds)

    const profileMap: Record<string, { name: string; avatar: string | null }> = {}
    if (profiles) {
      for (const p of profiles) {
        profileMap[p.id] = {
          name: p.display_name || p.name || 'Anonymous',
          avatar: p.avatar_url,
        }
      }
    }

    const { data: voteCounts } = await sb
      .from('world_votes')
      .select('world_id, vote')
      .in('world_id', worldIds)

    // Aggregate votes per world
    const voteMap: Record<string, number> = {}
    const userVoteMap: Record<string, boolean> = {}

    if (voteCounts) {
      for (const v of voteCounts) {
        voteMap[v.world_id] = (voteMap[v.world_id] || 0) + v.vote
      }
    }

    // Check which worlds current user has voted on
    if (userId) {
      const { data: userVotes } = await sb
        .from('world_votes')
        .select('world_id')
        .eq('user_id', userId)
        .in('world_id', worldIds)

      if (userVotes) {
        for (const v of userVotes) {
          userVoteMap[v.world_id] = true
        }
      }
    }

    const result: ExploreWorld[] = worlds.map(w => ({
      id: w.id,
      name: w.name,
      icon: w.icon || '🌍',
      visibility: w.visibility,
      // Prefer fresh profile data over cached world columns
      creator_name: profileMap[w.user_id]?.name || w.creator_name || 'Anonymous',
      creator_avatar: profileMap[w.user_id]?.avatar ?? w.creator_avatar,
      user_id: w.user_id,
      visit_count: w.visit_count || 0,
      object_count: w.object_count || 0,
      thumbnail_url: w.thumbnail_url,
      created_at: w.created_at,
      updated_at: w.updated_at,
      upvotes: voteMap[w.id] || 0,
      user_voted: userVoteMap[w.id] || false,
    }))

    // Re-sort by upvotes for "hot" mode
    if (sort === 'hot') {
      result.sort((a, b) => {
        // Hot score: upvotes + visits + recency bonus
        const recencyA = (Date.now() - new Date(a.updated_at).getTime()) / (1000 * 60 * 60 * 24) // days ago
        const recencyB = (Date.now() - new Date(b.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        const scoreA = a.upvotes * 10 + a.visit_count - recencyA * 2
        const scoreB = b.upvotes * 10 + b.visit_count - recencyB * 2
        return scoreB - scoreA
      })
    }

    return NextResponse.json({ worlds: result, total: result.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Explore] error:', msg)
    return NextResponse.json({ worlds: [], total: 0 }, { status: 500 })
  }
}
