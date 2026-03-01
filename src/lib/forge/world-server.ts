// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// WORLD SERVER — The bedrock beneath all worlds
// ─═̷─═̷─ॐ─═̷─═̷─ File I/O for world persistence ─═̷─═̷─ॐ─═̷─═̷─
//
// Minecraft-style: one JSON file per world, one registry index.
// Same pattern as conjured-registry.ts — battle-tested, no DB needed.
//
// data/worlds/
//   registry.json          — WorldMeta[] index
//   forge-default.json     — default world state
//   world-17400xxxxx.json  — user-created worlds
//
// SERVER-ONLY — uses fs, never import from client code.
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join } from 'path'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES — re-export so API routes import from one place
// ═══════════════════════════════════════════════════════════════════════════

import type { WorldMeta, WorldState } from './world-persistence'
export type { WorldState, WorldMeta }

// ═══════════════════════════════════════════════════════════════════════════
// PATHS — data/worlds/ lives alongside data/conjured-registry.json
// ═══════════════════════════════════════════════════════════════════════════

const DATA_DIR = join(process.cwd(), 'data', 'worlds')
const REGISTRY_PATH = join(DATA_DIR, 'registry.json')
const DEFAULT_WORLD_ID = 'forge-default'

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
    console.log('[WorldServer] Created data/worlds/ directory')
  }
}

function isValidWorldId(id: string): boolean {
  return /^[\w\-]{1,80}$/.test(id)
}

function worldPath(id: string): string {
  if (!isValidWorldId(id)) throw new Error('Invalid world ID')
  return join(DATA_DIR, `${id}.json`)
}

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRY — The index of all known worlds
// ═══════════════════════════════════════════════════════════════════════════

export function getRegistry(): WorldMeta[] {
  ensureDir()
  if (!existsSync(REGISTRY_PATH)) {
    // First boot — create default world
    const now = new Date().toISOString()
    const defaultMeta: WorldMeta = {
      id: DEFAULT_WORLD_ID,
      name: 'The Forge',
      icon: '🔥',
      createdAt: now,
      lastSavedAt: now,
    }
    const registry = [defaultMeta]
    writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8')
    return registry
  }
  try {
    const raw = readFileSync(REGISTRY_PATH, 'utf-8')
    return JSON.parse(raw) as WorldMeta[]
  } catch {
    return []
  }
}

export function saveRegistry(registry: WorldMeta[]): void {
  ensureDir()
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8')
}

// ═══════════════════════════════════════════════════════════════════════════
// WORLD CRUD — One JSON file per world
// ═══════════════════════════════════════════════════════════════════════════

export function loadWorldFromDisk(id: string): WorldState | null {
  ensureDir()
  const path = worldPath(id)
  if (!existsSync(path)) return null
  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw) as WorldState
    if (parsed.version !== 1) return null
    return parsed
  } catch (err) {
    console.error(`[WorldServer] Failed to load world ${id}:`, err)
    return null
  }
}

export function saveWorldToDisk(id: string, state: Omit<WorldState, 'version' | 'savedAt'>): void {
  ensureDir()
  const now = new Date().toISOString()
  const world: WorldState = {
    version: 1,
    ...state,
    savedAt: now,
  }
  writeFileSync(worldPath(id), JSON.stringify(world, null, 2), 'utf-8')

  // Update lastSavedAt in registry
  const registry = getRegistry()
  const meta = registry.find(w => w.id === id)
  if (meta) {
    meta.lastSavedAt = now
    saveRegistry(registry)
  }
}

export function deleteWorldFromDisk(id: string): void {
  const path = worldPath(id)
  if (existsSync(path)) {
    unlinkSync(path)
  }
}

export function createWorldOnDisk(name: string, icon = '🌍'): WorldMeta {
  ensureDir()
  const id = `world-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const now = new Date().toISOString()
  const meta: WorldMeta = { id, name, icon, createdAt: now, lastSavedAt: now }

  // Add to registry
  const registry = getRegistry()
  registry.push(meta)
  saveRegistry(registry)

  // Initialize empty world file
  saveWorldToDisk(id, {
    terrain: null,
    craftedScenes: [],
    conjuredAssetIds: [],
    catalogPlacements: [],
    transforms: {},
  })

  console.log(`[WorldServer] Created world "${name}" (${id})`)
  return meta
}

// ▓▓▓▓【W̸O̸R̸L̸D̸】▓▓▓▓ॐ▓▓▓▓【S̸E̸R̸V̸E̸R̸】▓▓▓▓
