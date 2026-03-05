// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// VOTE API — Upvote/remove vote on a world
// POST /api/worlds/[id]/vote   → toggle upvote
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getServerSupabase } from '@/lib/supabase'
import { XP_AWARDS, levelFromXp } from '@/lib/xp'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: worldId } = await params
    const userId = session.user.id
    const sb = getServerSupabase()

    // Can't vote on your own world
    const { data: world } = await sb
      .from('worlds')
      .select('user_id, visibility')
      .eq('id', worldId)
      .single()

    if (!world) {
      return NextResponse.json({ error: 'World not found' }, { status: 404 })
    }

    if (world.user_id === userId) {
      return NextResponse.json({ error: 'Cannot vote on your own world' }, { status: 400 })
    }

    if (world.visibility !== 'public') {
      return NextResponse.json({ error: 'World is not public' }, { status: 400 })
    }

    // Check existing vote
    const { data: existing } = await sb
      .from('world_votes')
      .select('vote')
      .eq('user_id', userId)
      .eq('world_id', worldId)
      .single()

    if (existing) {
      // Remove vote (toggle off)
      await sb.from('world_votes').delete().eq('user_id', userId).eq('world_id', worldId)

      // Decrement world owner's aura
      const { data: ownerData } = await sb
        .from('profiles')
        .select('aura')
        .eq('id', world.user_id)
        .single()

      if (ownerData) {
        await sb.from('profiles')
          .update({ aura: Math.max(0, (ownerData.aura || 0) - 1) })
          .eq('id', world.user_id)
      }

      return NextResponse.json({ voted: false })
    } else {
      // Add upvote
      await sb.from('world_votes').insert({
        user_id: userId,
        world_id: worldId,
        vote: 1,
      })

      // Increment world owner's aura
      const { data: ownerProfile } = await sb
        .from('profiles')
        .select('aura, xp, level')
        .eq('id', world.user_id)
        .single()

      if (ownerProfile) {
        const newAura = (ownerProfile.aura || 0) + 1
        const newXp = (ownerProfile.xp || 0) + XP_AWARDS.WORLD_UPVOTED
        const newLevel = levelFromXp(newXp)
        await sb
          .from('profiles')
          .update({
            aura: newAura,
            xp: newXp,
            level: newLevel,
            updated_at: new Date().toISOString(),
          })
          .eq('id', world.user_id)

        // Record XP event for world owner
        await sb.from('xp_events').insert({
          user_id: world.user_id,
          action: 'WORLD_UPVOTED',
          xp: XP_AWARDS.WORLD_UPVOTED,
          world_id: worldId,
        })
      }

      // Award XP to the voter too
      await sb.from('xp_events').insert({
        user_id: userId,
        action: 'UPVOTE_WORLD',
        xp: XP_AWARDS.UPVOTE_WORLD,
        world_id: worldId,
      })

      // Update voter's XP
      const { data: voterProfile } = await sb
        .from('profiles')
        .select('xp')
        .eq('id', userId)
        .single()

      if (voterProfile) {
        const voterNewXp = (voterProfile.xp || 0) + XP_AWARDS.UPVOTE_WORLD
        await sb
          .from('profiles')
          .update({
            xp: voterNewXp,
            level: levelFromXp(voterNewXp),
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
      }

      return NextResponse.json({ voted: true })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Vote] error:', msg)
    return NextResponse.json({ error: 'Failed to vote' }, { status: 500 })
  }
}
