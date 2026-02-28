// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// THE FORGE — World Persistence API
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
//
//   ╔═══════════════════════════════════════════════════════════════════╗
//   ║                                                                   ║
//   ║    GET  /api/worlds        — List all worlds (registry)           ║
//   ║    POST /api/worlds        — Create new world / import           ║
//   ║                                                                   ║
//   ║    Minecraft-style file persistence:                              ║
//   ║    one JSON per world, one registry to rule them all.            ║
//   ║                                                                   ║
//   ║    "Not all who wander are lost,                                  ║
//   ║     but their worlds are finally saved."                          ║
//   ║                                    — Tolkien, if he vibed        ║
//   ║                                                                   ║
//   ╚═══════════════════════════════════════════════════════════════════╝
//
// ░▒▓█ WORLDS ROUTE █▓▒░
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { NextResponse } from 'next/server'
import {
  getRegistry, createWorldOnDisk, saveWorldToDisk,
  type WorldMeta, type WorldState,
} from '@/lib/forge/world-server'

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/worlds — All known worlds
// ═══════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const registry = getRegistry()
    return NextResponse.json(registry)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Worlds] GET error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/worlds — Create a new world OR import one
//
// Body (create):  { name: string, icon?: string }
// Body (import):  { import: true, meta?: WorldMeta, state: WorldState }
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // ░▒▓ Import path ▓▒░
    if (body.import && body.state) {
      const state = body.state as WorldState
      if (state.version !== 1) {
        return NextResponse.json({ error: 'Invalid world version' }, { status: 400 })
      }
      const name = body.meta?.name || 'Imported World'
      const icon = body.meta?.icon || '📦'
      const meta = createWorldOnDisk(name, icon)
      saveWorldToDisk(meta.id, {
        terrain: state.terrain,
        craftedScenes: state.craftedScenes || [],
        conjuredAssetIds: state.conjuredAssetIds || [],
        catalogPlacements: state.catalogPlacements || [],
        transforms: state.transforms || {},
        behaviors: state.behaviors,
        groundPresetId: state.groundPresetId,
      })
      return NextResponse.json(meta, { status: 201 })
    }

    // ░▒▓ Create path ▓▒░
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Missing "name" field' }, { status: 400 })
    }

    const meta = createWorldOnDisk(body.name, body.icon || '🌍')
    return NextResponse.json(meta, { status: 201 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Worlds] POST error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ▓▓▓▓【W̸O̸R̸L̸D̸S̸】▓▓▓▓ॐ▓▓▓▓【R̸O̸U̸T̸E̸】▓▓▓▓
