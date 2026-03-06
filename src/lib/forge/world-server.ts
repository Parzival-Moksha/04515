// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// WORLD SERVER — The bedrock beneath all worlds
// ─═̷─═̷─ॐ─═̷─═̷─ Supabase persistence ─═̷─═̷─ॐ─═̷─═̷─
//
// v3: Supabase PostgreSQL. One row per world, JSONB data column.
// Each world belongs to a user (user_id FK → profiles).
// Falls back to JSON files if Supabase is not configured.
//
// SERVER-ONLY — uses Supabase service role, never import from client code.
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { getServerSupabase } from '../supabase'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES — re-export so API routes import from one place
// ═══════════════════════════════════════════════════════════════════════════

import type { WorldMeta, WorldState } from './world-persistence'
export type { WorldState, WorldMeta }

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function sb() { return getServerSupabase() }

function toWorldMeta(row: Record<string, unknown>): WorldMeta {
  return {
    id: row.id as string,
    name: row.name as string,
    icon: (row.icon as string) || '🌍',
    visibility: (row.visibility as 'private' | 'public' | 'unlisted') || 'private',
    createdAt: row.created_at as string,
    lastSavedAt: row.updated_at as string,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRY — All worlds for a user
// ═══════════════════════════════════════════════════════════════════════════

export async function getRegistry(userId: string): Promise<WorldMeta[]> {
  const { data, error } = await sb()
    .from('worlds')
    .select('id, name, icon, visibility, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[WorldServer] getRegistry error:', error.message)
    return []
  }

  // If user has no worlds yet, create their default world
  if (!data || data.length === 0) {
    const defaultWorld = await createWorld('The Forge', '🔥', userId)
    return [defaultWorld]
  }

  return data.map(toWorldMeta)
}

// ═══════════════════════════════════════════════════════════════════════════
// LOAD — Fetch a single world's full state
// ═══════════════════════════════════════════════════════════════════════════

export async function loadWorld(id: string, userId: string): Promise<WorldState | null> {
  const { data, error } = await sb()
    .from('worlds')
    .select('data')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error || !data?.data) return null
  return data.data as WorldState
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE — Upsert world state (debounced on client side)
// ═══════════════════════════════════════════════════════════════════════════

export async function saveWorld(
  id: string,
  userId: string,
  state: Omit<WorldState, 'version' | 'savedAt'>
): Promise<void> {
  const now = new Date().toISOString()
  const worldData: WorldState = {
    version: 1,
    ...state,
    savedAt: now,
  }

  const { error } = await sb()
    .from('worlds')
    .update({
      data: worldData,
      updated_at: now,
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error(`[WorldServer] saveWorld(${id}) error:`, error.message)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE — New world for a user
// ═══════════════════════════════════════════════════════════════════════════

export async function createWorld(name: string, icon = '🌍', userId: string): Promise<WorldMeta> {
  const id = `world-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const now = new Date().toISOString()

  const emptyState: WorldState = {
    version: 1,
    terrain: null,
    craftedScenes: [],
    conjuredAssetIds: [],
    catalogPlacements: [],
    transforms: {},
    savedAt: now,
  }

  const { error } = await sb()
    .from('worlds')
    .insert({
      id,
      user_id: userId,
      name,
      icon,
      data: emptyState,
      created_at: now,
      updated_at: now,
    })

  if (error) {
    console.error('[WorldServer] createWorld error:', error.message)
    throw new Error(`Failed to create world: ${error.message}`)
  }

  console.log(`[WorldServer] Created world "${name}" (${id}) for user ${userId}`)
  return { id, name, icon, visibility: 'private', createdAt: now, lastSavedAt: now }
}

// ═══════════════════════════════════════════════════════════════════════════
// DELETE — Remove a world
// ═══════════════════════════════════════════════════════════════════════════

export async function deleteWorld(id: string, userId: string): Promise<void> {
  const { error } = await sb()
    .from('worlds')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error(`[WorldServer] deleteWorld(${id}) error:`, error.message)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VISIBILITY — toggle public/private/unlisted
// ═══════════════════════════════════════════════════════════════════════════

export async function setWorldVisibility(
  id: string,
  userId: string,
  visibility: 'private' | 'public' | 'unlisted'
): Promise<void> {
  const now = new Date().toISOString()

  // When setting to public, cache creator info for explorer cards
  if (visibility === 'public') {
    const { data: profile } = await sb()
      .from('profiles')
      .select('display_name, name, avatar_url')
      .eq('id', userId)
      .single()

    await sb()
      .from('worlds')
      .update({
        visibility,
        creator_name: profile?.display_name || profile?.name || 'Anonymous',
        creator_avatar: profile?.avatar_url || null,
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', userId)
  } else {
    await sb()
      .from('worlds')
      .update({ visibility, updated_at: now })
      .eq('id', id)
      .eq('user_id', userId)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VISIT — increment visit counter (for explore)
// ═══════════════════════════════════════════════════════════════════════════

export async function recordVisit(worldId: string): Promise<void> {
  const { data } = await sb()
    .from('worlds')
    .select('visit_count')
    .eq('id', worldId)
    .single()

  if (data) {
    await sb()
      .from('worlds')
      .update({ visit_count: (data.visit_count || 0) + 1 })
      .eq('id', worldId)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LOAD PUBLIC — load a world without user_id check (for explore)
// ═══════════════════════════════════════════════════════════════════════════

export async function loadPublicWorld(id: string): Promise<{ state: WorldState; meta: WorldMeta } | null> {
  const { data, error } = await sb()
    .from('worlds')
    .select('id, name, icon, visibility, data, user_id, created_at, updated_at')
    .eq('id', id)
    .in('visibility', ['public', 'unlisted'])
    .single()

  if (error || !data?.data) return null

  return {
    state: data.data as WorldState,
    meta: toWorldMeta(data),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE OBJECT COUNT — cache for explorer cards
// ═══════════════════════════════════════════════════════════════════════════

export async function updateObjectCount(id: string, userId: string, count: number): Promise<void> {
  await sb()
    .from('worlds')
    .update({ object_count: count })
    .eq('id', id)
    .eq('user_id', userId)
}

// ▓▓▓▓【W̸O̸R̸L̸D̸】▓▓▓▓ॐ▓▓▓▓【S̸E̸R̸V̸E̸R̸】▓▓▓▓
