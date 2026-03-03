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
    .select('id, name, icon, created_at, updated_at')
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
  return { id, name, icon, createdAt: now, lastSavedAt: now }
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

// ▓▓▓▓【W̸O̸R̸L̸D̸】▓▓▓▓ॐ▓▓▓▓【S̸E̸R̸V̸E̸R̸】▓▓▓▓
