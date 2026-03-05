// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// VISIBILITY API — Toggle world privacy
// PUT /api/worlds/[id]/visibility { visibility: 'private' | 'public' | 'unlisted' }
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { setWorldVisibility } from '@/lib/forge/world-server'
import { XP_AWARDS } from '@/lib/xp'
import { getServerSupabase } from '@/lib/supabase'

const VALID_VISIBILITY = ['private', 'public', 'unlisted'] as const

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: worldId } = await params
    const body = await req.json() as { visibility: string }

    if (!body.visibility || !VALID_VISIBILITY.includes(body.visibility as typeof VALID_VISIBILITY[number])) {
      return NextResponse.json({ error: 'Invalid visibility. Use: private, public, unlisted' }, { status: 400 })
    }

    const visibility = body.visibility as 'private' | 'public' | 'unlisted'
    await setWorldVisibility(worldId, session.user.id, visibility)

    // Award XP for first time setting a world to public
    if (visibility === 'public') {
      const sb = getServerSupabase()
      const { data: existing } = await sb
        .from('xp_events')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('action', 'SET_WORLD_PUBLIC')
        .eq('world_id', worldId)
        .limit(1)

      if (!existing || existing.length === 0) {
        await sb.from('xp_events').insert({
          user_id: session.user.id,
          action: 'SET_WORLD_PUBLIC',
          xp: XP_AWARDS.SET_WORLD_PUBLIC,
          world_id: worldId,
        })

        const { data: profile } = await sb
          .from('profiles')
          .select('xp')
          .eq('id', session.user.id)
          .single()

        if (profile) {
          await sb.from('profiles')
            .update({ xp: (profile.xp || 0) + XP_AWARDS.SET_WORLD_PUBLIC })
            .eq('id', session.user.id)
        }
      }
    }

    return NextResponse.json({ ok: true, visibility })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Visibility] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
