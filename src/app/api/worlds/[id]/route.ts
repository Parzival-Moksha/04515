// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// THE FORGE — Per-World API
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
//
//   GET    /api/worlds/[id]  — Load world state
//   PUT    /api/worlds/[id]  — Save world state (debounced on client)
//   DELETE /api/worlds/[id]  — Delete world + remove from registry
//
// ░▒▓█ WORLD [ID] ROUTE █▓▒░
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { NextResponse } from 'next/server'
import {
  loadWorldFromDisk, saveWorldToDisk, deleteWorldFromDisk,
  getRegistry, saveRegistry,
  type WorldState,
} from '@/lib/forge/world-server'

type RouteContext = { params: Promise<{ id: string }> }

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/worlds/[id] — Load a single world's full state
// ═══════════════════════════════════════════════════════════════════════════

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const world = loadWorldFromDisk(id)
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
    const { id } = await context.params
    const body = await request.json()

    saveWorldToDisk(id, body as Omit<WorldState, 'version' | 'savedAt'>)

    return NextResponse.json({ ok: true, savedAt: new Date().toISOString() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Worlds] PUT [id] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE /api/worlds/[id] — Delete world file + registry entry
// ═══════════════════════════════════════════════════════════════════════════

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params

    // Can't delete the default world — it's the forge's bedrock
    if (id === 'forge-default') {
      return NextResponse.json({ error: 'Cannot delete default world' }, { status: 400 })
    }

    deleteWorldFromDisk(id)

    // Also remove from registry
    const registry = getRegistry().filter(w => w.id !== id)
    saveRegistry(registry)

    return NextResponse.json({ ok: true, deleted: id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Worlds] DELETE [id] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ▓▓▓▓【W̸O̸R̸L̸D̸】▓▓▓▓ॐ▓▓▓▓【I̸D̸】▓▓▓▓ॐ▓▓▓▓【R̸O̸U̸T̸E̸】▓▓▓▓
