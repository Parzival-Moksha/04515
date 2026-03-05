// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// THE FORGE — Per-World API
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
//
//   GET    /api/worlds/[id]  — Load world state
//   PUT    /api/worlds/[id]  — Save world state (debounced on client)
//   PATCH  /api/worlds/[id]  — Update world metadata (name, icon)
//   DELETE /api/worlds/[id]  — Delete world
//
// ░▒▓█ WORLD [ID] ROUTE █▓▒░
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getServerSupabase } from '@/lib/supabase'
import {
  loadWorld, saveWorld, deleteWorld, getRegistry, updateObjectCount,
  type WorldState,
} from '@/lib/forge/world-server'

type RouteContext = { params: Promise<{ id: string }> }

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/worlds/[id] — Load a single world's full state
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const world = await loadWorld(id, session.user.id)
    if (!world) {
      return NextResponse.json({ error: 'World not found' }, { status: 404 })
    }
    return NextResponse.json(world)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Worlds] GET [id] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/worlds/[id] — Save world state
// Body: Partial<WorldState> (version + savedAt added server-side)
// ═══════════════════════════════════════════════════════════════════════════

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()

    const state = body as Omit<WorldState, 'version' | 'savedAt'>
    await saveWorld(id, session.user.id, state)

    // Sync object count for explorer cards (fire-and-forget)
    const objectCount = (state.conjuredAssetIds?.length || 0)
      + (state.catalogPlacements?.length || 0)
      + (state.craftedScenes?.length || 0)
    updateObjectCount(id, session.user.id, objectCount).catch(() => {})

    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Worlds] PUT [id] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/worlds/[id] — Update world metadata (name, icon)
// ═══════════════════════════════════════════════════════════════════════════

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json() as { name?: string; icon?: string }

    const updates: Record<string, string> = {}
    if (body.name?.trim()) updates.name = body.name.trim().slice(0, 50)
    if (body.icon) updates.icon = body.icon

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const sb = getServerSupabase()
    const { error } = await sb
      .from('worlds')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) throw error

    return NextResponse.json({ ok: true, ...updates })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Worlds] PATCH [id] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/worlds/[id] — Delete world
// ═══════════════════════════════════════════════════════════════════════════

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    // Don't let user delete their last world
    const registry = await getRegistry(session.user.id)
    if (registry.length <= 1) {
      return NextResponse.json({ error: 'Cannot delete your only world' }, { status: 400 })
    }

    await deleteWorld(id, session.user.id)

    return NextResponse.json({ ok: true, deleted: id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Worlds] DELETE [id] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ▓▓▓▓【W̸O̸R̸L̸D̸】▓▓▓▓ॐ▓▓▓▓【I̸D̸】▓▓▓▓ॐ▓▓▓▓【R̸O̸U̸T̸E̸】▓▓▓▓
