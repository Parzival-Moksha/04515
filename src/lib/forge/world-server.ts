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
// SNAPSHOT TYPES — born from the anorak2 tragedy, RIP 2026-03-09
// ═══════════════════════════════════════════════════════════════════════════

export interface SnapshotMeta {
  id: string
  world_id: string
  object_count: number
  source: 'auto' | 'manual'
  created_at: string
}

const MAX_SNAPSHOTS_PER_WORLD = 20
const SNAPSHOT_THROTTLE_MS = 5 * 60 * 1000  // 5 minutes — don't snapshot more often than this

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function sb() { return getServerSupabase() }

function toWorldMeta(row: Record<string, unknown>): WorldMeta {
  return {
    id: row.id as string,
    name: row.name as string,
    icon: (row.icon as string) || '🌍',
    visibility: (row.visibility as 'private' | 'public' | 'unlisted' | 'public_edit') || 'private',
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
// Now with auto-snapshot: stashes the PREVIOUS state before overwriting.
// ═══════════════════════════════════════════════════════════════════════════

export async function saveWorld(
  id: string,
  userId: string,
  state: Omit<WorldState, 'version' | 'savedAt'>,
  clientLoadedAt?: string  // Optimistic concurrency: when this client last loaded
): Promise<{ saved: boolean; conflict?: boolean; serverUpdatedAt?: string }> {
  const now = new Date().toISOString()
  const worldData: WorldState = {
    version: 1,
    ...state,
    savedAt: now,
  }

  // ░▒▓ OPTIMISTIC CONCURRENCY — reject save if someone else wrote since we loaded ▓▒░
  if (clientLoadedAt) {
    const { data: current } = await sb()
      .from('worlds')
      .select('updated_at')
      .eq('id', id)
      .eq('user_id', userId)
      .single()
    if (current?.updated_at && current.updated_at > clientLoadedAt) {
      console.warn(`[WorldServer] ⚠️ CONFLICT on ${id}: client loaded at ${clientLoadedAt}, server has ${current.updated_at}`)
      return { saved: false, conflict: true, serverUpdatedAt: current.updated_at }
    }
  }

  // ░▒▓ AUTO-SNAPSHOT — stash the old state before we overwrite ▓▒░
  await snapshotBeforeSave(id, userId)

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
    return { saved: false }
  }
  return { saved: true }
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
  visibility: 'private' | 'public' | 'unlisted' | 'public_edit'
): Promise<void> {
  const now = new Date().toISOString()

  // When setting to public or public_edit, cache creator info for explorer cards
  if (visibility === 'public' || visibility === 'public_edit') {
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
// SAVE PUBLIC_EDIT — save to a public_edit world (any authenticated user)
// Checks that the world exists AND has visibility='public_edit' before writing.
// ═══════════════════════════════════════════════════════════════════════════

export async function savePublicEditWorld(
  id: string,
  state: Omit<WorldState, 'version' | 'savedAt'>
): Promise<boolean> {
  const now = new Date().toISOString()
  const worldData: WorldState = {
    version: 1,
    ...state,
    savedAt: now,
  }

  // ░▒▓ AUTO-SNAPSHOT for public_edit worlds too ▓▒░
  await snapshotBeforeSave(id)

  const { error, count } = await sb()
    .from('worlds')
    .update({
      data: worldData,
      updated_at: now,
    })
    .eq('id', id)
    .eq('visibility', 'public_edit')

  if (error) {
    console.error(`[WorldServer] savePublicEditWorld(${id}) error:`, error.message)
    return false
  }
  return true
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

export async function loadPublicWorld(id: string): Promise<{ state: WorldState; meta: WorldMeta & { creator_name?: string; creator_avatar?: string } } | null> {
  const { data, error } = await sb()
    .from('worlds')
    .select('id, name, icon, visibility, data, user_id, creator_name, creator_avatar, created_at, updated_at')
    .eq('id', id)
    .in('visibility', ['public', 'unlisted', 'public_edit'])
    .single()

  if (error || !data?.data) return null

  // Fetch fresh profile data — never show stale cached creator_name/avatar
  let creatorName = (data.creator_name as string) || undefined
  let creatorAvatar = (data.creator_avatar as string) || undefined
  if (data.user_id) {
    const { data: profile } = await sb()
      .from('profiles')
      .select('display_name, name, avatar_url')
      .eq('id', data.user_id)
      .single()
    if (profile) {
      creatorName = profile.display_name || profile.name || creatorName
      creatorAvatar = profile.avatar_url ?? creatorAvatar
    }
  }

  return {
    state: data.data as WorldState,
    meta: {
      ...toWorldMeta(data),
      creator_name: creatorName,
      creator_avatar: creatorAvatar,
    },
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

// ═══════════════════════════════════════════════════════════════════════════
// SNAPSHOTS — Auto-backup before every save. Born from pain, forged in tears.
// ═══════════════════════════════════════════════════════════════════════════

/** Stash the current world state as a snapshot BEFORE overwriting it.
 *  Called automatically by saveWorld() and savePublicEditWorld().
 *  Prunes old snapshots to keep max N per world. */
async function snapshotBeforeSave(worldId: string, userId?: string): Promise<void> {
  try {
    // ░▒▓ THROTTLE — only snapshot if the last one is older than 5 minutes ▓▒░
    // This prevents DB spam during normal editing (debounced saves fire every 1s).
    // Guards 1 (_worldReady) and 2 (_loadedObjectCount) handle the fast path.
    const { data: lastSnap } = await sb()
      .from('world_snapshots')
      .select('created_at')
      .eq('world_id', worldId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (lastSnap?.created_at) {
      const elapsed = Date.now() - new Date(lastSnap.created_at).getTime()
      if (elapsed < SNAPSHOT_THROTTLE_MS) return // Too soon — skip
    }

    // Fetch current state (what's about to be overwritten)
    let query = sb().from('worlds').select('data, updated_at').eq('id', worldId)
    if (userId) query = query.eq('user_id', userId)
    const { data: current } = await query.single()

    if (!current?.data) return // Nothing to snapshot (new world)

    const worldData = current.data as WorldState
    // Count objects for quick reference
    const objectCount =
      (worldData.conjuredAssetIds?.length || 0) +
      (worldData.catalogPlacements?.length || 0) +
      (worldData.craftedScenes?.length || 0)

    // Don't snapshot empty worlds (nothing to preserve)
    if (objectCount === 0 && !worldData.terrain && (worldData.groundPresetId || 'none') === 'none') return

    // Insert snapshot
    await sb().from('world_snapshots').insert({
      world_id: worldId,
      data: current.data,
      object_count: objectCount,
      source: 'auto',
    })

    // Prune old snapshots (keep only MAX_SNAPSHOTS_PER_WORLD most recent)
    const { data: allSnapshots } = await sb()
      .from('world_snapshots')
      .select('id, created_at')
      .eq('world_id', worldId)
      .order('created_at', { ascending: false })

    if (allSnapshots && allSnapshots.length > MAX_SNAPSHOTS_PER_WORLD) {
      const toDelete = allSnapshots.slice(MAX_SNAPSHOTS_PER_WORLD).map(s => s.id)
      await sb().from('world_snapshots').delete().in('id', toDelete)
    }
  } catch (err) {
    // Snapshot failure should NEVER block the actual save
    console.error(`[WorldServer] Snapshot failed for ${worldId}:`, err)
  }
}

/** List snapshots for a world (most recent first) */
export async function listSnapshots(worldId: string, userId: string): Promise<SnapshotMeta[]> {
  const { data, error } = await sb()
    .from('world_snapshots')
    .select('id, world_id, object_count, source, created_at')
    .eq('world_id', worldId)
    .order('created_at', { ascending: false })
    .limit(MAX_SNAPSHOTS_PER_WORLD)

  if (error) {
    console.error(`[WorldServer] listSnapshots(${worldId}) error:`, error.message)
    return []
  }
  return (data || []) as SnapshotMeta[]
}

/** Load a specific snapshot's full WorldState */
export async function loadSnapshot(snapshotId: string): Promise<WorldState | null> {
  const { data, error } = await sb()
    .from('world_snapshots')
    .select('data')
    .eq('id', snapshotId)
    .single()

  if (error || !data?.data) return null
  return data.data as WorldState
}

/** Restore a snapshot: overwrites the world's current state with the snapshot.
 *  ALSO snapshots the current state first (so you can undo the restore). */
export async function restoreSnapshot(
  worldId: string,
  userId: string,
  snapshotId: string
): Promise<boolean> {
  // Load the snapshot
  const snapshotState = await loadSnapshot(snapshotId)
  if (!snapshotState) return false

  // Snapshot the CURRENT state before restoring (undo safety net)
  await snapshotBeforeSave(worldId, userId)

  // Overwrite with snapshot state
  const now = new Date().toISOString()
  const { error } = await sb()
    .from('worlds')
    .update({
      data: { ...snapshotState, savedAt: now },
      updated_at: now,
    })
    .eq('id', worldId)
    .eq('user_id', userId)

  if (error) {
    console.error(`[WorldServer] restoreSnapshot(${worldId}, ${snapshotId}) error:`, error.message)
    return false
  }

  console.log(`[WorldServer] ✅ Restored snapshot ${snapshotId} → world ${worldId}`)
  return true
}

// ▓▓▓▓【W̸O̸R̸L̸D̸】▓▓▓▓ॐ▓▓▓▓【S̸E̸R̸V̸E̸R̸】▓▓▓▓
