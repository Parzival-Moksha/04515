// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// 04515 — Zustand State Store
// The memory of the Oasis
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { create } from 'zustand'
import type { ConjuredAsset, CraftedScene, CatalogPlacement, RealmId, ObjectBehavior, WorldLight, WorldLightType } from '../lib/conjure/types'
import { DEFAULT_WORLD_LIGHTS } from '../lib/conjure/types'
import type { TerrainParams } from '../lib/forge/terrain-generator'
import {
  loadWorld, debouncedSaveWorld, saveWorld,
  getWorldRegistry, getActiveWorldId, setActiveWorldId,
  createWorld, deleteWorld, exportWorld, importWorld,
  migrateIfNeeded, cancelPendingSave,
  loadPublicWorld,
  type WorldMeta, type PublicWorldResult,
} from '../lib/forge/world-persistence'
import { addToSceneLibrary, getSceneLibrary, removeFromSceneLibrary } from '../lib/forge/scene-library'
import { awardXp } from '../hooks/useXp'

// ─═̷─═̷─🏗️ SSR-SAFE LOCALSTORAGE ─═̷─═̷─🏗️
// Next.js pre-renders on the server where `window` doesn't exist.
// These two helpers mean we write `typeof window` exactly once — here — instead
// of scattering the guard across every localStorage read/write in the store.
const isBrowser = typeof window !== 'undefined'
const stored  = (key: string): string | null => isBrowser ? localStorage.getItem(key) : null
const persist = (key: string, value: string): void => { if (isBrowser) localStorage.setItem(key, value) }

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// ─═̷─═̷─🪄 VFX TYPES — the language of materialization ─═̷─═̷─🪄
export type ConjureVfxType =
  | 'textswirl' | 'arcane' | 'vortex'
  | 'quantumassembly' | 'primordialcauldron' | 'stellarnursery' | 'chronoforge' | 'abyssalemergence'
  | 'random'

export const CONJURE_VFX_LIST: Exclude<ConjureVfxType, 'random'>[] = ['textswirl', 'arcane', 'vortex', 'quantumassembly', 'primordialcauldron', 'stellarnursery', 'chronoforge', 'abyssalemergence']

export type PlacementVfxType =
  | 'runeflash' | 'sparkburst' | 'portalring' | 'sigilpulse'
  | 'quantumcollapse' | 'phoenixascension' | 'dimensionalrift' | 'crystalgenesis'
  | 'meteorimpact' | 'arcanebloom' | 'voidanchor' | 'stellarforge'
  | 'random'

const PLACEMENT_VFX_LIST: Exclude<PlacementVfxType, 'random'>[] = ['runeflash', 'sparkburst', 'portalring', 'sigilpulse', 'quantumcollapse', 'phoenixascension', 'dimensionalrift', 'crystalgenesis', 'meteorimpact', 'arcanebloom', 'voidanchor', 'stellarforge']

export interface PlacementPending {
  type: 'catalog' | 'conjured' | 'crafted' | 'library'
  catalogId?: string
  name: string
  path?: string
  defaultScale?: number
  sceneId?: string
}

export interface ActivePlacementVfx {
  id: string
  position: [number, number, number]
  type: PlacementVfxType
  startedAt: number
  duration: number
}

// ─═̷─═̷─⏪ UNDO/REDO — Time travel for world edits ─═̷─═̷─⏪
// Full-snapshot approach: each command stores complete world state before + after.
// Simple, correct, no stale closures. ~50KB per snapshot × 20 max = ~2MB. Fine.
export interface WorldSnapshot {
  placedCatalogAssets: CatalogPlacement[]
  worldConjuredAssetIds: string[]
  craftedScenes: CraftedScene[]
  transforms: Record<string, { position: [number, number, number]; rotation?: [number, number, number]; scale?: [number, number, number] | number }>
  behaviors: Record<string, ObjectBehavior>
  groundTiles: Record<string, string>
  worldLights: WorldLight[]
}

export interface UndoCommand {
  label: string
  icon: string
  timestamp: number
  before: WorldSnapshot
  after: WorldSnapshot
}

const MAX_UNDO_STACK = 20

function captureWorldSnapshot(state: { placedCatalogAssets: CatalogPlacement[]; worldConjuredAssetIds: string[]; craftedScenes: CraftedScene[]; transforms: Record<string, any>; behaviors: Record<string, ObjectBehavior>; groundTiles: Record<string, string>; worldLights: WorldLight[] }): WorldSnapshot {
  // structuredClone for deep copy — no shared references between snapshots
  return structuredClone({
    placedCatalogAssets: state.placedCatalogAssets,
    worldConjuredAssetIds: state.worldConjuredAssetIds,
    craftedScenes: state.craftedScenes,
    transforms: state.transforms,
    behaviors: state.behaviors,
    groundTiles: state.groundTiles,
    worldLights: state.worldLights,
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════════

interface OasisState {
  // ─═̷─═̷─⚙️ VISUAL SETTINGS ─═̷─═̷─⚙️
  fpsCounterEnabled: boolean
  fpsCounterFontSize: number  // px
  streamOpacity: number       // 0.1-1.0 — ThoughtStream (stashed for Merlin)

  // ─═̷─═̷─🧠 AI MODEL SETTINGS ─═̷─═̷─🧠
  craftModel: string                        // OpenRouter model ID for craft + terrain
  voiceModel: string                        // placeholder for Merlin voice model

  // ─═̷─═̷─🔥 REALM STATE ─═̷─═̷─🔥
  activeRealm: RealmId
  conjuredAssets: ConjuredAsset[]           // global asset registry (server-side)
  worldConjuredAssetIds: string[]           // which conjured assets are in THIS world
  craftedScenes: CraftedScene[]
  conjureVfxType: ConjureVfxType
  placedCatalogAssets: CatalogPlacement[]  // pre-made assets placed in THIS world

  // ─═̷─═̷─🪄 PLACEMENT MODE + VFX ─═̷─═̷─🪄
  placementPending: PlacementPending | null   // what we're about to place (null = not in placement mode)
  placementVfxType: PlacementVfxType
  placementVfxDuration: number                // seconds, 0.5-3.0
  activePlacementVfx: ActivePlacementVfx[]    // currently playing VFX instances

  // ─═̷─═̷─🌍 TERRAIN + WORLD STATE ─═̷─═̷─🌍
  terrainParams: TerrainParams | null
  terrainLoading: boolean
  groundPresetId: string                    // 'none', 'grass', 'sand', etc. (base/default ground)
  groundTiles: Record<string, string>       // sparse: "x,z" → presetId (painted tiles)
  paintMode: boolean
  paintBrushPresetId: string | null
  paintBrushSize: number                    // 1, 3, or 5
  selectedObjectId: string | null      // id of selected crafted scene or asset
  inspectedObjectId: string | null     // id of object with inspector open (double-click)
  transformMode: 'translate' | 'rotate' | 'scale'
  cameraLookAt: [number, number, number] | null  // set to lerp camera to this position
  transforms: Record<string, {        // object id → transform overrides
    position: [number, number, number]
    rotation?: [number, number, number]
    scale?: [number, number, number] | number
  }>
  behaviors: Record<string, ObjectBehavior>  // object id → movement/animation/label
  objectMeshStats: Record<string, import('../lib/conjure/types').ModelStats>  // ░▒▓ per-object mesh anatomy — extracted once when GLB loads ▓▒░
  worldLights: WorldLight[]            // per-world placeable light sources
  worldSkyBackground: string           // per-world sky preset ID (was global in SettingsContext)
  activeWorldId: string
  worldRegistry: WorldMeta[]
  _worldReady: boolean               // ░▒▓ GUARD: true after first successful load from Supabase ▓▒░

  // ─═̷─═̷─🧑 AVATAR — RPM 3D avatar ─═̷─═̷─🧑
  avatar3dUrl: string | null

  // ─═̷─═̷─👁️ VIEW MODE — read-only access to other users' worlds ─═̷─═̷─👁️
  isViewMode: boolean
  viewingWorldMeta: { name: string; icon: string; creator_name?: string; creator_avatar?: string } | null

  // ─═̷─═̷─⚙️ SETTINGS ACTIONS ─═̷─═̷─⚙️
  setFpsCounterEnabled: (enabled: boolean) => void
  setFpsCounterFontSize: (size: number) => void
  setStreamOpacity: (opacity: number) => void
  setCraftModel: (model: string) => void
  setVoiceModel: (model: string) => void

  // ─═̷─═̷─🔥 REALM ACTIONS ─═̷─═̷─🔥
  setActiveRealm: (realm: RealmId) => void
  setConjuredAssets: (assets: ConjuredAsset[]) => void
  addConjuredAsset: (asset: ConjuredAsset) => void
  updateConjuredAsset: (id: string, updates: Partial<ConjuredAsset>) => void
  removeConjuredAsset: (id: string) => void
  placeConjuredAssetInWorld: (assetId: string) => void
  removeConjuredAssetFromWorld: (assetId: string) => void
  addCraftedScene: (scene: CraftedScene) => void
  removeCraftedScene: (id: string) => void
  updateCraftedScene: (id: string, updates: Partial<CraftedScene>) => void
  setConjureVfxType: (type: ConjureVfxType) => void
  placeCatalogAsset: (catalogId: string, name: string, path: string, defaultScale: number) => void
  removeCatalogAsset: (id: string) => void

  // ─═̷─═̷─🪄 PLACEMENT + VFX ACTIONS ─═̷─═̷─🪄
  enterPlacementMode: (pending: PlacementPending) => void
  cancelPlacement: () => void
  placeCatalogAssetAt: (catalogId: string, name: string, path: string, defaultScale: number, position: [number, number, number]) => void
  placeLibrarySceneAt: (sceneId: string, position: [number, number, number]) => void
  setPlacementVfxType: (type: PlacementVfxType) => void
  setPlacementVfxDuration: (duration: number) => void
  spawnPlacementVfx: (position: [number, number, number]) => void
  removePlacementVfx: (id: string) => void
  previewPlacementSpell: (type: PlacementVfxType) => void
  conjurePreview: { type: ConjureVfxType; startedAt: number } | null
  startConjurePreview: (type: ConjureVfxType) => void
  clearConjurePreview: () => void

  // ─═̷─═̷─🔮 CRAFTING VFX — LLM generation in progress ─═̷─═̷─🔮
  craftingInProgress: boolean
  craftingPrompt: string | null
  setCraftingState: (inProgress: boolean, prompt?: string | null) => void

  // ─═̷─═̷─📚 SCENE LIBRARY ─═̷─═̷─📚
  sceneLibrary: CraftedScene[]
  refreshSceneLibrary: () => void
  placeLibraryScene: (sceneId: string) => void
  deleteFromLibrary: (sceneId: string) => void

  // ─═̷─═̷─🌍 TERRAIN + WORLD ACTIONS ─═̷─═̷─🌍
  setTerrainParams: (params: TerrainParams | null) => void
  setTerrainLoading: (loading: boolean) => void
  setGroundPreset: (presetId: string) => void
  enterPaintMode: (presetId: string) => void
  exitPaintMode: () => void
  setPaintBrushSize: (size: number) => void
  paintGroundArea: (cx: number, cz: number) => void
  eraseGroundTile: (x: number, z: number) => void
  clearAllGroundTiles: () => void
  selectObject: (id: string | null) => void
  setInspectedObject: (id: string | null) => void
  setTransformMode: (mode: 'translate' | 'rotate' | 'scale') => void
  setCameraLookAt: (position: [number, number, number] | null) => void
  setObjectTransform: (id: string, transform: { position: [number, number, number]; rotation?: [number, number, number]; scale?: [number, number, number] | number }) => void
  setObjectBehavior: (id: string, behavior: Partial<ObjectBehavior>) => void
  setObjectMeshStats: (id: string, stats: import('../lib/conjure/types').ModelStats) => void
  /** RTS-style: send selected object to a target position */
  setMoveTarget: (id: string, target: [number, number, number]) => void
  /** Clear moveTarget when object arrives */
  clearMoveTarget: (id: string) => void
  // ─═̷─═̷─🌅 SKY ACTION ─═̷─═̷─🌅
  setWorldSkyBackground: (id: string) => void
  // ─═̷─═̷─💡 LIGHT ACTIONS ─═̷─═̷─💡
  addWorldLight: (type: WorldLightType) => void
  removeWorldLight: (id: string) => void
  updateWorldLight: (id: string, updates: Partial<WorldLight>) => void
  setWorldLightTransform: (id: string, position: [number, number, number]) => void

  loadWorldState: () => void
  saveWorldState: () => void
  switchWorld: (worldId: string) => void
  createNewWorld: (name: string, icon?: string) => string   // returns new world id
  deleteWorldById: (worldId: string) => void
  refreshWorldRegistry: () => void
  exportCurrentWorld: () => Promise<string | null>
  importWorldFromJson: (json: string) => Promise<string | null>  // returns new world id or null
  initWorlds: () => Promise<void>                                // hydrate registry + scene library on mount
  setAvatar3dUrl: (url: string | null) => void
  enterViewMode: (worldId: string) => void                       // load a public world read-only
  exitViewMode: () => void                                       // return to user's own world

  // ─═̷─═̷─⏪ UNDO/REDO ─═̷─═̷─⏪
  undoStack: UndoCommand[]
  redoStack: UndoCommand[]
  _undoBatch: { label: string; icon: string; before: WorldSnapshot } | null
  _isUndoRedoing: boolean
  undo: () => void
  redo: () => void
  beginUndoBatch: (label: string, icon: string) => void
  commitUndoBatch: () => void
}

export const useOasisStore = create<OasisState>((set, get) => {
  // ░▒▓ withUndo — wraps any world-mutating action with undo snapshot capture ▓▒░
  const withUndo = (label: string, icon: string, fn: () => void) => {
    if (get()._isUndoRedoing) { fn(); return }
    const before = captureWorldSnapshot(get())
    fn()
    const after = captureWorldSnapshot(get())
    set(state => ({
      undoStack: [...state.undoStack, { label, icon, timestamp: Date.now(), before, after }].slice(-MAX_UNDO_STACK),
      redoStack: [],  // new action clears redo stack
    }))
  }

  return ({
  // ─═̷─═̷─⚙️ VISUAL SETTINGS ─═̷─═̷─⚙️
  fpsCounterEnabled: true,
  fpsCounterFontSize: 14,
  streamOpacity: 0.85,

  // ─═̷─═̷─🧠 AI MODEL SETTINGS ─═̷─═̷─🧠
  craftModel: stored('oasis-craft-model') || 'moonshotai/kimi-k2.5',
  voiceModel: stored('oasis-voice-model') || 'merlin-v1',

  // ─═̷─═̷─🔥 REALM STATE ─═̷─═̷─🔥
  activeRealm: 'forge' as RealmId,
  conjuredAssets: [],
  worldConjuredAssetIds: [],
  craftedScenes: [],
  conjureVfxType: (stored('oasis-vfx') as ConjureVfxType) || 'textswirl',
  placedCatalogAssets: [],
  sceneLibrary: [],

  // ─═̷─═̷─🪄 PLACEMENT MODE + VFX ─═̷─═̷─🪄
  placementPending: null,
  placementVfxType: (stored('oasis-placement-vfx') as PlacementVfxType) || 'runeflash',
  placementVfxDuration: parseFloat(stored('oasis-placement-duration') || '1.2'),
  activePlacementVfx: [],
  conjurePreview: null,
  craftingInProgress: false,
  craftingPrompt: null,

  // ─═̷─═̷─🌍 TERRAIN + WORLD STATE ─═̷─═̷─🌍
  terrainParams: null,
  terrainLoading: false,
  groundPresetId: 'none',
  groundTiles: {},
  paintMode: false,
  paintBrushPresetId: null,
  paintBrushSize: 1,
  selectedObjectId: null,
  inspectedObjectId: null,
  transformMode: 'translate' as const,
  cameraLookAt: null,
  transforms: {},
  behaviors: {},
  objectMeshStats: {},
  worldLights: [],
  worldSkyBackground: 'night007',
  activeWorldId: isBrowser ? getActiveWorldId() : 'forge-default',
  worldRegistry: [],
  _worldReady: false,  // ░▒▓ GUARD: prevents saving empty state before world loads from Supabase ▓▒░

  // ─═̷─═̷─🧑 AVATAR ─═̷─═̷─🧑
  avatar3dUrl: null,

  // ─═̷─═̷─👁️ VIEW MODE ─═̷─═̷─👁️
  isViewMode: false,
  viewingWorldMeta: null,

  // ─═̷─═̷─⏪ UNDO/REDO STATE ─═̷─═̷─⏪
  undoStack: [],
  redoStack: [],
  _undoBatch: null,
  _isUndoRedoing: false,

  // ─═̷─═̷─⚙️ SETTINGS ACTIONS ─═̷─═̷─⚙️
  setFpsCounterEnabled: (fpsCounterEnabled) => set({ fpsCounterEnabled }),
  setFpsCounterFontSize: (fpsCounterFontSize) => set({ fpsCounterFontSize }),
  setStreamOpacity: (streamOpacity) => set({ streamOpacity: Math.max(0.1, Math.min(1, streamOpacity)) }),
  setCraftModel: (craftModel) => {
    persist('oasis-craft-model', craftModel)
    set({ craftModel })
  },
  setVoiceModel: (voiceModel) => {
    persist('oasis-voice-model', voiceModel)
    set({ voiceModel })
  },

  // ─═̷─═̷─🔥 REALM ACTIONS ─═̷─═̷─🔥
  setActiveRealm: (activeRealm) => {
    persist('oasis-realm', activeRealm)
    set({ activeRealm })
  },
  setConjuredAssets: (conjuredAssets) => set({ conjuredAssets }),
  addConjuredAsset: (asset) => set((state) => ({ conjuredAssets: [...state.conjuredAssets, asset] })),
  updateConjuredAsset: (id, updates) => set((state) => ({
    conjuredAssets: state.conjuredAssets.map(a => a.id === id ? { ...a, ...updates } : a),
  })),
  removeConjuredAsset: (id) => set((state) => ({
    conjuredAssets: state.conjuredAssets.filter(a => a.id !== id),
  })),
  placeConjuredAssetInWorld: (assetId) => {
    withUndo('Place conjured', '✨', () => {
      set((state) => ({
        worldConjuredAssetIds: state.worldConjuredAssetIds.includes(assetId)
          ? state.worldConjuredAssetIds
          : [...state.worldConjuredAssetIds, assetId],
      }))
    })
    setTimeout(() => get().saveWorldState(), 100)
  },
  removeConjuredAssetFromWorld: (assetId) => {
    withUndo('Remove conjured', '🗑️', () => {
      set((state) => ({
        worldConjuredAssetIds: state.worldConjuredAssetIds.filter(id => id !== assetId),
      }))
    })
    setTimeout(() => get().saveWorldState(), 100)
  },
  addCraftedScene: (scene) => {
    // ░▒▓ SPAWN OFFSET — place crafted scene where the crafting VFX played ▓▒░
    const activeConjures = get().conjuredAssets.filter(a => !['ready', 'failed'].includes(a.status)).length
    const craftX = activeConjures * 4 + (activeConjures > 0 ? 4 : 0)
    const offsetScene = { ...scene, position: [craftX, scene.position[1], scene.position[2]] as [number, number, number] }
    withUndo('Add crafted', '🔮', () => {
      set((state) => ({ craftedScenes: [...state.craftedScenes, offsetScene] }))
    })
    // Persist to library — survives deletion from world
    addToSceneLibrary(offsetScene).then(() =>
      getSceneLibrary().then(lib => set({ sceneLibrary: lib }))
    )
    // ░▒▓ Spell VFX on materialization ▓▒░
    get().spawnPlacementVfx(offsetScene.position)
    // Auto-save world on scene add
    setTimeout(() => get().saveWorldState(), 100)
  },
  removeCraftedScene: (id) => {
    withUndo('Remove crafted', '🗑️', () => {
      set((state) => ({
        craftedScenes: state.craftedScenes.filter(s => s.id !== id),
        selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
      }))
    })
    setTimeout(() => get().saveWorldState(), 100)
  },
  updateCraftedScene: (id, updates) => set((state) => ({
    craftedScenes: state.craftedScenes.map(s => s.id === id ? { ...s, ...updates } : s),
  })),
  setConjureVfxType: (conjureVfxType) => {
    persist('oasis-vfx', conjureVfxType)
    set({ conjureVfxType })
  },

  // ─═̷─═̷─📦 CATALOG ASSET ACTIONS ─═̷─═̷─📦
  placeCatalogAsset: (catalogId, name, path, defaultScale) => {
    withUndo(`Place ${name}`, '📦', () => {
      const id = `catalog-${catalogId}-${Date.now()}`
      const placement: CatalogPlacement = {
        id,
        catalogId,
        name,
        glbPath: path,
        position: [(Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8],
        scale: defaultScale,
      }
      set(state => ({
        placedCatalogAssets: [...state.placedCatalogAssets, placement],
      }))
    })
    setTimeout(() => get().saveWorldState(), 100)
    // XP for placing objects
    awardXp('PLACE_CATALOG_OBJECT', get().activeWorldId)
  },
  removeCatalogAsset: (id) => {
    const asset = get().placedCatalogAssets.find(a => a.id === id)
    withUndo(`Delete ${asset?.name || 'object'}`, '🗑️', () => {
      set(state => ({
        placedCatalogAssets: state.placedCatalogAssets.filter(a => a.id !== id),
        selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
      }))
    })
    setTimeout(() => get().saveWorldState(), 100)
  },

  // ─═̷─═̷─📚 SCENE LIBRARY ACTIONS ─═̷─═̷─📚
  refreshSceneLibrary: () => {
    getSceneLibrary().then(lib => set({ sceneLibrary: lib }))
  },
  placeLibraryScene: (sceneId) => {
    const library = get().sceneLibrary
    const scene = library.find(s => s.id === sceneId)
    if (!scene) return
    withUndo('Place scene', '🎭', () => {
      const clone: CraftedScene = {
        ...scene,
        id: `${scene.id}-${Date.now()}`,
        position: [(Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6],
      }
      set((state) => ({ craftedScenes: [...state.craftedScenes, clone] }))
    })
    setTimeout(() => get().saveWorldState(), 100)
  },
  deleteFromLibrary: (sceneId) => {
    removeFromSceneLibrary(sceneId).then(() =>
      getSceneLibrary().then(lib => set({ sceneLibrary: lib }))
    )
  },

  // ─═̷─═̷─🪄 PLACEMENT + VFX ACTIONS ─═̷─═̷─🪄
  // ░▒▓ The ritual of placing objects into the world ▓▒░
  enterPlacementMode: (pending) => {
    // ░▒▓ Preload GLB while user picks a spot — kills Suspense flash ▓▒░
    if (pending.path) {
      import('@react-three/drei').then(drei => drei.useGLTF.preload(pending.path!))
    }
    set({ placementPending: pending })
  },
  cancelPlacement: () => set({ placementPending: null }),

  placeCatalogAssetAt: (catalogId, name, path, defaultScale, position) => {
    withUndo(`Place ${name}`, '📦', () => {
      const id = `catalog-${catalogId}-${Date.now()}`
      const placement: CatalogPlacement = { id, catalogId, name, glbPath: path, position, scale: defaultScale }
      set(state => ({
        placedCatalogAssets: [...state.placedCatalogAssets, placement],
        placementPending: null,
      }))
    })
    get().spawnPlacementVfx(position)
    setTimeout(() => get().saveWorldState(), 100)
    awardXp('PLACE_CATALOG_OBJECT', get().activeWorldId)
  },

  placeLibrarySceneAt: (sceneId, position) => {
    const library = get().sceneLibrary
    const scene = library.find(s => s.id === sceneId)
    if (!scene) return
    withUndo('Place scene', '🎭', () => {
      const clone: CraftedScene = { ...scene, id: `${scene.id}-${Date.now()}`, position }
      set(state => ({
        craftedScenes: [...state.craftedScenes, clone],
        placementPending: null,
      }))
    })
    get().spawnPlacementVfx(position)
    setTimeout(() => get().saveWorldState(), 100)
  },

  setPlacementVfxType: (type) => {
    persist('oasis-placement-vfx', type)
    set({ placementVfxType: type })
  },

  setPlacementVfxDuration: (duration) => {
    const clamped = Math.max(0.5, Math.min(3.0, duration))
    persist('oasis-placement-duration', String(clamped))
    set({ placementVfxDuration: clamped })
  },

  spawnPlacementVfx: (position) => {
    const { placementVfxType, placementVfxDuration } = get()
    // ░▒▓ RANDOM — resolve to a concrete VFX type ▓▒░
    const resolvedType = placementVfxType === 'random'
      ? PLACEMENT_VFX_LIST[Math.floor(Math.random() * PLACEMENT_VFX_LIST.length)]
      : placementVfxType
    const vfx: ActivePlacementVfx = {
      id: `vfx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      position,
      type: resolvedType,
      startedAt: performance.now(),
      duration: placementVfxDuration,
    }
    set(state => ({ activePlacementVfx: [...state.activePlacementVfx, vfx] }))
  },

  removePlacementVfx: (id) => {
    set(state => ({ activePlacementVfx: state.activePlacementVfx.filter(v => v.id !== id) }))
  },

  // ─═̷─═̷─👁 SPELL PREVIEW — see the magic before you commit ─═̷─═̷─👁
  previewPlacementSpell: (type) => {
    const { placementVfxDuration } = get()
    const vfx: ActivePlacementVfx = {
      id: `preview-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      position: [0, 0, 0],
      type,
      startedAt: performance.now(),
      duration: placementVfxDuration,
    }
    set(state => ({ activePlacementVfx: [...state.activePlacementVfx, vfx] }))
  },
  startConjurePreview: (type) => {
    set({ conjurePreview: { type, startedAt: Date.now() } })
  },
  clearConjurePreview: () => {
    set({ conjurePreview: null })
  },
  setCraftingState: (inProgress, prompt = null) => {
    set({ craftingInProgress: inProgress, craftingPrompt: inProgress ? (prompt ?? null) : null })
  },

  // ─═̷─═̷─🌍 TERRAIN + WORLD ACTIONS ─═̷─═̷─🌍
  setTerrainParams: (terrainParams) => {
    set({ terrainParams })
    setTimeout(() => get().saveWorldState(), 100)
  },
  setTerrainLoading: (terrainLoading) => set({ terrainLoading }),
  setGroundPreset: (groundPresetId) => {
    set({ groundPresetId })
    setTimeout(() => get().saveWorldState(), 100)
  },
  // ─═̷─═̷─🎨 PAINT MODE — tile-by-tile ground painting ─═̷─═̷─🎨
  enterPaintMode: (presetId) => {
    set({ paintMode: true, paintBrushPresetId: presetId, placementPending: null })
  },
  exitPaintMode: () => {
    set({ paintMode: false, paintBrushPresetId: null })
  },
  setPaintBrushSize: (size) => {
    set({ paintBrushSize: Math.max(1, Math.min(5, size)) })
  },
  paintGroundArea: (cx, cz) => {
    const { paintBrushPresetId, paintBrushSize, groundTiles } = get()
    if (!paintBrushPresetId) return
    const half = Math.floor(paintBrushSize / 2)
    const newTiles = { ...groundTiles }
    for (let dx = -half; dx <= half; dx++) {
      for (let dz = -half; dz <= half; dz++) {
        const tx = Math.floor(cx) + dx
        const tz = Math.floor(cz) + dz
        // Clamp to world bounds: -50 to +49
        if (tx < -50 || tx > 49 || tz < -50 || tz > 49) continue
        newTiles[`${tx},${tz}`] = paintBrushPresetId
      }
    }
    set({ groundTiles: newTiles })
    get().saveWorldState()
  },
  eraseGroundTile: (x, z) => {
    const { groundTiles } = get()
    const key = `${Math.floor(x)},${Math.floor(z)}`
    if (!(key in groundTiles)) return
    const newTiles = { ...groundTiles }
    delete newTiles[key]
    set({ groundTiles: newTiles })
    get().saveWorldState()
  },
  clearAllGroundTiles: () => {
    withUndo('Clear all tiles', '🧹', () => {
      set({ groundTiles: {} })
    })
    setTimeout(() => get().saveWorldState(), 100)
  },
  selectObject: (selectedObjectId) => set({ selectedObjectId }),
  setInspectedObject: (inspectedObjectId) => set({ inspectedObjectId }),
  setTransformMode: (transformMode) => set({ transformMode }),
  setCameraLookAt: (cameraLookAt) => set({ cameraLookAt }),
  setObjectBehavior: (id, partial) => {
    // Only push undo for meaningful changes (not ephemeral moveTarget/moveSpeed)
    const isUndoable = partial.movement || partial.animation || partial.visible !== undefined || partial.label !== undefined
    if (isUndoable) {
      withUndo('Change behavior', '⚙️', () => {
        set((state) => {
          const existing = state.behaviors[id] || { movement: { type: 'static' as const }, visible: true }
          return { behaviors: { ...state.behaviors, [id]: { ...existing, ...partial } } }
        })
      })
    } else {
      set((state) => {
        const existing = state.behaviors[id] || { movement: { type: 'static' as const }, visible: true }
        return { behaviors: { ...state.behaviors, [id]: { ...existing, ...partial } } }
      })
    }
    setTimeout(() => get().saveWorldState(), 100)
  },
  setObjectMeshStats: (id, stats) => {
    set((state) => ({ objectMeshStats: { ...state.objectMeshStats, [id]: stats } }))
  },
  setMoveTarget: (id, target) => {
    set((state) => {
      const existing = state.behaviors[id] || { movement: { type: 'static' as const }, visible: true }
      return {
        behaviors: { ...state.behaviors, [id]: { ...existing, moveTarget: target, moveSpeed: existing.moveSpeed || 3 } },
      }
    })
  },
  clearMoveTarget: (id) => {
    set((state) => {
      const existing = state.behaviors[id]
      if (!existing) return state
      const { moveTarget, ...rest } = existing
      return {
        behaviors: { ...state.behaviors, [id]: rest as ObjectBehavior },
      }
    })
    // Sync final position to transforms after arrival
    setTimeout(() => get().saveWorldState(), 100)
  },
  setObjectTransform: (id, transform) => {
    set((state) => ({
      transforms: { ...state.transforms, [id]: transform },
    }))
    debouncedSaveWorld({
      terrain: get().terrainParams,
      groundPresetId: get().groundPresetId,
      groundTiles: get().groundTiles,
      craftedScenes: get().craftedScenes,
      conjuredAssetIds: get().worldConjuredAssetIds,
      catalogPlacements: get().placedCatalogAssets,
      transforms: get().transforms,
      behaviors: get().behaviors,
      lights: get().worldLights,
      skyBackgroundId: get().worldSkyBackground,
    })
  },
  // ─═̷─═̷─🌅 SKY — per-world sky preset ─═̷─═̷─🌅
  setWorldSkyBackground: (id) => {
    set({ worldSkyBackground: id })
    setTimeout(() => get().saveWorldState(), 100)
  },
  // ─═̷─═̷─💡 LIGHT CRUD — placeable light sources, per-world ─═̷─═̷─💡
  addWorldLight: (type) => {
    // Only allow one environment light per world
    if (type === 'environment' && get().worldLights.some(l => l.type === 'environment')) return
    withUndo(`Add ${type} light`, '💡', () => {
      const light: WorldLight = {
        id: `light-${type}-${Date.now()}`,
        type,
        color: type === 'hemisphere' ? '#87CEEB' : type === 'ambient' ? '#B0C4DE' : type === 'environment' ? '#ffffff' : '#FFF5E6',
        intensity: type === 'ambient' ? 0.4 : type === 'hemisphere' ? 0.3 : type === 'directional' ? 1.2 : 1.0,
        position: type === 'directional' ? [30, 40, 20] : [0, 5, 0],
        ...(type === 'hemisphere' ? { groundColor: '#3a5f0b' } : {}),
        ...(type === 'spot' ? { angle: 45, target: [0, 0, 0] } : {}),
        visible: true,
      }
      set(s => ({ worldLights: [...s.worldLights, light] }))
    })
    setTimeout(() => get().saveWorldState(), 100)
    awardXp('ADD_LIGHT', get().activeWorldId)
  },
  removeWorldLight: (id) => {
    withUndo('Remove light', '🗑️', () => {
      set(s => ({ worldLights: s.worldLights.filter(l => l.id !== id) }))
    })
    setTimeout(() => get().saveWorldState(), 100)
  },
  updateWorldLight: (id, updates) => {
    set(s => ({
      worldLights: s.worldLights.map(l => l.id === id ? { ...l, ...updates } : l),
    }))
    setTimeout(() => get().saveWorldState(), 100)
  },
  setWorldLightTransform: (id, position) => {
    set(s => ({
      worldLights: s.worldLights.map(l => l.id === id ? { ...l, position } : l),
    }))
    setTimeout(() => get().saveWorldState(), 100)
  },

  loadWorldState: () => {
    if (get().isViewMode) return // don't overwrite viewed world with user's own data

    // ░▒▓ CRITICAL: Cancel any pending saves BEFORE loading ▓▒░
    // Without this, a debounced save of stale/empty state can fire AFTER
    // the load starts, overwriting the world we're about to read.
    cancelPendingSave()
    set({ _worldReady: false }) // Block saves until load completes

    // Helper: seed default lights with proper IDs (for fresh/old worlds)
    const seedDefaultLights = (): WorldLight[] =>
      DEFAULT_WORLD_LIGHTS.map((l, i) => ({ ...l, id: `light-${l.type}-default-${i}`, visible: true } as WorldLight))

    loadWorld().then(world => {
      if (get().isViewMode) return // check again after async — view mode may have been entered during fetch
      if (!world) {
        set({ _worldReady: true, terrainParams: null, groundPresetId: 'none', groundTiles: {}, craftedScenes: [], worldConjuredAssetIds: [], placedCatalogAssets: [], transforms: {}, behaviors: {}, worldLights: seedDefaultLights(), worldSkyBackground: 'night007' })
        console.log('[World] No data — initialized empty world')
        return
      }
      // If lights field is undefined (old world never had lights) → seed with defaults
      // If lights is an array (even empty = user chose darkness) → respect it
      const lights = world.lights !== undefined ? world.lights : seedDefaultLights()
      set({
        _worldReady: true,
        terrainParams: world.terrain || null,
        groundPresetId: world.groundPresetId || 'none',
        groundTiles: world.groundTiles || {},
        craftedScenes: world.craftedScenes || [],
        worldConjuredAssetIds: world.conjuredAssetIds || [],
        placedCatalogAssets: world.catalogPlacements || [],
        transforms: world.transforms || {},
        behaviors: world.behaviors || {},
        worldLights: lights,
        worldSkyBackground: world.skyBackgroundId || 'night007',
      })
      console.log('[World] Loaded:', world.savedAt, '| preset:', world.groundPresetId || 'none', '| tiles:', Object.keys(world.groundTiles || {}).length, '| catalog:', world.catalogPlacements?.length || 0, '| lights:', lights.length, '| sky:', world.skyBackgroundId || 'night007')
    })
  },
  saveWorldState: () => {
    if (get().isViewMode) return // don't save someone else's world
    // ░▒▓ CRITICAL GUARD: never save until world has loaded from Supabase ▓▒░
    // Without this, a save during the mount→load gap writes empty state to the DB,
    // nuking the entire world. This was the Alexandria bug.
    if (!get()._worldReady) {
      console.warn('[World] ⚠️ Save blocked — world not loaded yet (preventing empty-state overwrite)')
      return
    }
    const { terrainParams, groundPresetId, groundTiles, craftedScenes, worldConjuredAssetIds, placedCatalogAssets, transforms, behaviors, worldLights, worldSkyBackground } = get()
    debouncedSaveWorld({ terrain: terrainParams, groundPresetId, groundTiles, craftedScenes, conjuredAssetIds: worldConjuredAssetIds, catalogPlacements: placedCatalogAssets, transforms, behaviors, lights: worldLights, skyBackgroundId: worldSkyBackground })
  },

  // ─═̷─═̷─🌍 MULTI-WORLD ACTIONS ─═̷─═̷─🌍
  switchWorld: (worldId) => {
    // Exit view mode if active — user clicked one of their own worlds
    if (get().isViewMode) {
      set({ isViewMode: false, viewingWorldMeta: null })
    }
    // ░▒▓ RACE CONDITION FIX — kill any pending debounced saves from the OLD world ▓▒░
    // Without this, a stale save timer can fire AFTER the new world loads,
    // overwriting the new world's lights/sky with the old world's stale state.
    cancelPendingSave()
    // Save current world first (immediate, not debounced) — but ONLY if world was loaded
    if (get()._worldReady) {
      const { terrainParams, groundPresetId, groundTiles, craftedScenes, worldConjuredAssetIds, placedCatalogAssets, transforms, behaviors, worldLights, worldSkyBackground, activeWorldId } = get()
      saveWorld({ terrain: terrainParams, groundPresetId, groundTiles, craftedScenes, conjuredAssetIds: worldConjuredAssetIds, catalogPlacements: placedCatalogAssets, transforms, behaviors, lights: worldLights, skyBackgroundId: worldSkyBackground }, activeWorldId)
    }

    // ░▒▓ Block saves during transition — prevents empty state nuke ▓▒░
    set({ _worldReady: false })

    // Switch to new world
    setActiveWorldId(worldId)
    loadWorld(worldId).then(world => {
      // Seed defaults for old worlds that never had lights (lights field undefined)
      const defaultLights: WorldLight[] = DEFAULT_WORLD_LIGHTS.map((l, i) => ({ ...l, id: `light-${l.type}-default-${i}`, visible: true } as WorldLight))
      const lights = world?.lights !== undefined ? (world?.lights || []) : defaultLights
      set({
        _worldReady: true,
        activeWorldId: worldId,
        terrainParams: world?.terrain || null,
        groundPresetId: world?.groundPresetId || 'none',
        groundTiles: world?.groundTiles || {},
        craftedScenes: world?.craftedScenes || [],
        worldConjuredAssetIds: world?.conjuredAssetIds || [],
        placedCatalogAssets: world?.catalogPlacements || [],
        transforms: world?.transforms || {},
        behaviors: world?.behaviors || {},
        worldLights: lights,
        worldSkyBackground: world?.skyBackgroundId || 'night007',
        selectedObjectId: null,
        inspectedObjectId: null,
        paintMode: false,
        paintBrushPresetId: null,
        activeRealm: 'forge' as RealmId,
        // Clear undo/redo — snapshots are world-scoped, can't leak across worlds
        undoStack: [],
        redoStack: [],
        _undoBatch: null,
      })
      persist('oasis-realm', 'forge')
      console.log(`[World] Switched to: ${worldId}`, world ? `(terrain: ${!!world.terrain}, scenes: ${world.craftedScenes?.length || 0}, assets: ${world.conjuredAssetIds?.length || 0}, catalog: ${world.catalogPlacements?.length || 0}, sky: ${world.skyBackgroundId || 'night007'})` : '(empty)')
    })
  },

  createNewWorld: (name, icon = '🌍') => {
    // Save current world first — only if world was loaded (prevent empty-state nuke)
    cancelPendingSave()
    if (get()._worldReady) {
      const { terrainParams, groundPresetId, groundTiles, craftedScenes, worldConjuredAssetIds, placedCatalogAssets, transforms, behaviors, worldLights, worldSkyBackground, activeWorldId } = get()
      saveWorld({ terrain: terrainParams, groundPresetId, groundTiles, craftedScenes, conjuredAssetIds: worldConjuredAssetIds, catalogPlacements: placedCatalogAssets, transforms, behaviors, lights: worldLights, skyBackgroundId: worldSkyBackground }, activeWorldId)
    }

    // Create and switch to new world (async) — seed with default lights so it's not pitch black
    createWorld(name, icon).then(meta => {
      const defaultLights: WorldLight[] = DEFAULT_WORLD_LIGHTS.map((l, i) => ({ ...l, id: `light-${l.type}-default-${i}`, visible: true } as WorldLight))
      setActiveWorldId(meta.id)
      return getWorldRegistry().then(registry => {
        set({
          _worldReady: true,  // New world is "loaded" — it's empty by definition
          activeWorldId: meta.id,
          worldRegistry: registry,
          terrainParams: null,
          groundPresetId: 'none',
          groundTiles: {},
          craftedScenes: [],
          worldConjuredAssetIds: [],
          placedCatalogAssets: [],
          transforms: {},
          behaviors: {},
          worldLights: defaultLights,
          worldSkyBackground: 'night007',
          selectedObjectId: null,
          paintMode: false,
          paintBrushPresetId: null,
          activeRealm: 'forge' as RealmId,
          // Fresh world = fresh undo history
          undoStack: [],
          redoStack: [],
          _undoBatch: null,
        })
        persist('oasis-realm', 'forge')
        console.log(`[World] Created new world: "${name}" (${meta.id})`)
      })
    })
    return '' // id available async via worldRegistry
  },

  deleteWorldById: (worldId) => {
    const { activeWorldId } = get()
    deleteWorld(worldId).then(() =>
      getWorldRegistry().then(registry => {
        set({ worldRegistry: registry })
        if (worldId === activeWorldId && registry.length > 0) {
          get().switchWorld(registry[0].id)
        }
      })
    )
  },

  refreshWorldRegistry: () => {
    getWorldRegistry().then(registry => set({ worldRegistry: registry }))
  },

  exportCurrentWorld: async () => {
    return exportWorld(get().activeWorldId)
  },

  importWorldFromJson: async (json) => {
    const meta = await importWorld(json)
    if (!meta) return null
    const registry = await getWorldRegistry()
    set({ worldRegistry: registry })
    get().switchWorld(meta.id)
    return meta.id
  },

  // ─═̷─═̷─ॐ─═̷─═̷─ INIT — hydrate from server on mount ─═̷─═̷─ॐ─═̷─═̷─
  initWorlds: async () => {
    const [registry, library] = await Promise.all([
      getWorldRegistry(),
      getSceneLibrary(),
    ])

    // If stored activeWorldId doesn't exist in the registry (e.g. old 'forge-default'
    // from pre-Supabase era), switch to the first available world
    const currentId = get().activeWorldId
    const worldExists = registry.some(w => w.id === currentId)
    if (!worldExists && registry.length > 0) {
      const firstWorld = registry[0]
      setActiveWorldId(firstWorld.id)
      set({ worldRegistry: registry, sceneLibrary: library, activeWorldId: firstWorld.id })
    } else {
      set({ worldRegistry: registry, sceneLibrary: library })
    }

    // Load active world state
    get().loadWorldState()
  },

  setAvatar3dUrl: (url) => set({ avatar3dUrl: url }),

  // ─═̷─═̷─👁️ VIEW MODE — peek into someone else's world (read-only) ─═̷─═̷─👁️
  enterViewMode: (worldId) => {
    // Save current world before entering view mode (if not already viewing)
    if (!get().isViewMode && get()._worldReady) {
      cancelPendingSave()
      const { terrainParams, groundPresetId, groundTiles, craftedScenes, worldConjuredAssetIds, placedCatalogAssets, transforms, behaviors, worldLights, worldSkyBackground, activeWorldId } = get()
      saveWorld({ terrain: terrainParams, groundPresetId, groundTiles, craftedScenes, conjuredAssetIds: worldConjuredAssetIds, catalogPlacements: placedCatalogAssets, transforms, behaviors, lights: worldLights, skyBackgroundId: worldSkyBackground }, activeWorldId)
    }

    // Set view mode flag IMMEDIATELY — prevents initWorlds/loadWorldState from overwriting
    set({ isViewMode: true, viewingWorldMeta: { name: 'Loading...', icon: '⏳' } })

    loadPublicWorld(worldId).then(result => {
      if (!result) {
        console.error(`[ViewMode] World ${worldId} not found or not public`)
        set({ isViewMode: false, viewingWorldMeta: null })
        return
      }
      const { state, meta } = result
      const defaultLights: WorldLight[] = DEFAULT_WORLD_LIGHTS.map((l, i) => ({ ...l, id: `light-${l.type}-default-${i}`, visible: true } as WorldLight))
      const lights = state.lights !== undefined ? state.lights : defaultLights
      set({
        viewingWorldMeta: { name: meta.name, icon: meta.icon, creator_name: meta.creator_name, creator_avatar: meta.creator_avatar },
        terrainParams: state.terrain || null,
        groundPresetId: state.groundPresetId || 'none',
        groundTiles: state.groundTiles || {},
        craftedScenes: state.craftedScenes || [],
        worldConjuredAssetIds: state.conjuredAssetIds || [],
        placedCatalogAssets: state.catalogPlacements || [],
        transforms: state.transforms || {},
        behaviors: state.behaviors || {},
        worldLights: lights,
        worldSkyBackground: state.skyBackgroundId || 'night007',
        selectedObjectId: null,
        inspectedObjectId: null,
        paintMode: false,
        paintBrushPresetId: null,
      })
      console.log(`[ViewMode] Entered: "${meta.name}" by ${meta.creator_name || 'unknown'}`)
    })
  },

  exitViewMode: () => {
    if (!get().isViewMode) return
    set({ isViewMode: false, viewingWorldMeta: null })
    // Reload user's own active world
    get().loadWorldState()
    console.log('[ViewMode] Exited — back to own world')
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // ░▒▓█ UNDO/REDO — The temporal cortex of world editing █▓▒░
  // Full-snapshot commands: each entry stores world state before + after.
  // Batch mechanism for continuous ops (drag transforms, paint strokes).
  // Ctrl+Z / Ctrl+Shift+Z keyboard bindings in TransformKeyHandler.
  // ═══════════════════════════════════════════════════════════════════════════════

  undo: () => {
    const { undoStack } = get()
    if (undoStack.length === 0) return
    const command = undoStack[undoStack.length - 1]
    set(state => ({
      _isUndoRedoing: true,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, command].slice(-MAX_UNDO_STACK),
      // ░▒▓ Restore world state from before snapshot ▓▒░
      ...command.before,
    }))
    set({ _isUndoRedoing: false })
    // Persist the restored state
    setTimeout(() => get().saveWorldState(), 100)
  },

  redo: () => {
    const { redoStack } = get()
    if (redoStack.length === 0) return
    const command = redoStack[redoStack.length - 1]
    set(state => ({
      _isUndoRedoing: true,
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, command].slice(-MAX_UNDO_STACK),
      // ░▒▓ Re-apply world state from after snapshot ▓▒░
      ...command.after,
    }))
    set({ _isUndoRedoing: false })
    setTimeout(() => get().saveWorldState(), 100)
  },

  // ─═̷─═̷─ BATCH — for continuous ops (drag transforms, paint strokes) ─═̷─═̷─
  // Call beginUndoBatch on drag start / paint start,
  // commitUndoBatch on drag end / paint end.
  beginUndoBatch: (label, icon) => {
    set({ _undoBatch: { label, icon, before: captureWorldSnapshot(get()) } })
  },

  commitUndoBatch: () => {
    const batch = get()._undoBatch
    if (!batch) return
    const after = captureWorldSnapshot(get())
    set(state => ({
      _undoBatch: null,
      undoStack: [...state.undoStack, {
        label: batch.label,
        icon: batch.icon,
        timestamp: Date.now(),
        before: batch.before,
        after,
      }].slice(-MAX_UNDO_STACK),
      redoStack: [],  // new action clears redo stack
    }))
  },
})})  // }) closes return ({...}), }) closes arrow function + create()

// ▓▓▓▓【0̸4̸5̸1̸5̸】▓▓▓▓ॐ▓▓▓▓【O̸A̸S̸I̸S̸】▓▓▓▓
