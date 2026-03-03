// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// THE FORGE — Type Definitions
// Where thought becomes form, form becomes type, type becomes matter
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

// ═══════════════════════════════════════════════════════════════════════════════
// REALM SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

export type RealmId = 'forge'

export interface RealmDefinition {
  id: RealmId
  name: string
  icon: string
  description: string
  color: string
}

export const REALMS: RealmDefinition[] = [
  {
    id: 'forge',
    name: 'The Forge',
    icon: '\u{1F525}',
    description: 'Conjuring sandbox — text to 3D, wizard tools',
    color: '#F97316',
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// CONJURE PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

export type ProviderName = 'meshy' | 'tripo'

export interface ProviderTier {
  id: string
  name: string
  description: string
  estimatedSeconds: number
  estimatedCost: string
  creditCost: number           // 1 credit = $1. Deducted before pipeline starts.
}

export interface ProviderDefinition {
  name: ProviderName
  displayName: string
  envKey: string
  tiers: ProviderTier[]
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    name: 'meshy',
    displayName: 'Meshy',
    envKey: 'MESHY_API_KEY',
    tiers: [
      { id: 'preview', name: 'Preview', description: 'Fast untextured mesh (meshy-6)', estimatedSeconds: 30, estimatedCost: '$1', creditCost: 1 },
      { id: 'refine', name: 'Refine', description: 'Full PBR textured model', estimatedSeconds: 120, estimatedCost: '$1', creditCost: 1 },
    ],
  },
  {
    name: 'tripo',
    displayName: 'Tripo',
    envKey: 'TRIPO_API_KEY',
    tiers: [
      { id: 'turbo', name: 'Turbo', description: 'Blazing fast (Turbo v1.0)', estimatedSeconds: 10, estimatedCost: '$1', creditCost: 1 },
      { id: 'draft', name: 'Draft', description: 'Fast shape (v2.0)', estimatedSeconds: 20, estimatedCost: '$1', creditCost: 1 },
      { id: 'standard', name: 'Standard', description: 'Balanced quality (v2.5)', estimatedSeconds: 40, estimatedCost: '$1', creditCost: 1 },
      { id: 'premium', name: 'Premium', description: 'Sculpture-level detail (v3.1)', estimatedSeconds: 60, estimatedCost: '$1', creditCost: 1 },
    ],
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// CREDIT COSTS — 1 credit = $1. Post-processing charged per operation.
// ═══════════════════════════════════════════════════════════════════════════════

export const POST_PROCESS_COSTS: Record<string, number> = {
  texture: 1,
  remesh: 1,
  rig: 1,
  animate: 1,
}

// New users get this many free credits to try the Forge
export const FREE_CREDITS = 3

// ═══════════════════════════════════════════════════════════════════════════════
// CREDIT PACKS — Stripe checkout line items
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreditPack {
  id: string
  credits: number
  priceUsd: number          // cents for Stripe (e.g. 500 = $5)
  label: string
  popular?: boolean
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: 'pack_5',   credits: 5,   priceUsd: 500,   label: '5 Credits — $5' },
  { id: 'pack_25',  credits: 25,  priceUsd: 2000,  label: '25 Credits — $20', popular: true },
  { id: 'pack_100', credits: 100, priceUsd: 7000,  label: '100 Credits — $70' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// CONJURED ASSETS
// ═══════════════════════════════════════════════════════════════════════════════

export type ConjureStatus = 'queued' | 'generating' | 'refining' | 'downloading' | 'ready' | 'failed'

// ═══════════════════════════════════════════════════════════════════════════════
// POST-PROCESSING — Texture, Remesh, and future pipeline steps
// ─═̷─═̷─ Each step produces a new asset linked to its parent ─═̷─═̷─
// ═══════════════════════════════════════════════════════════════════════════════

export type ConjureAction = 'conjure' | 'texture' | 'remesh' | 'rig' | 'animate'
export type PostProcessAction = 'texture' | 'remesh' | 'rig' | 'animate'
export type RemeshQuality = 'low' | 'medium' | 'high' | 'ultra'
export type MeshTopology = 'quad' | 'triangle'

export const REMESH_PRESETS: Record<RemeshQuality, { polycount: number; label: string }> = {
  low:    { polycount: 5_000,   label: 'Low (5K — game-ready)' },
  medium: { polycount: 15_000,  label: 'Medium (15K)' },
  high:   { polycount: 30_000,  label: 'High (30K — default)' },
  ultra:  { polycount: 100_000, label: 'Ultra (100K — sculpture)' },
}

export interface ProcessRequest {
  action: PostProcessAction
  options?: {
    targetPolycount?: number
    topology?: MeshTopology
    texturePrompt?: string
    quality?: RemeshQuality
    // ░▒▓ Character pipeline — rig + animate ▓▒░
    heightMeters?: number               // rigging: character height for skeleton scaling
    animationPresetId?: string          // animate: which of 586 presets to apply
  }
}

export interface ConjuredAsset {
  id: string
  prompt: string
  displayName?: string                 // user-editable name (UI shows this over prompt)
  provider: ProviderName
  tier: string
  providerTaskId: string
  status: ConjureStatus
  progress: number                     // 0-100
  glbPath?: string                     // relative: /conjured/{id}.glb
  thumbnailUrl?: string                // provider thumbnail or local /conjured/{id}_thumb.jpg
  errorMessage?: string
  position: [number, number, number]   // where in The Forge
  scale: number
  rotation: [number, number, number]
  cost?: number
  metadata?: {
    model?: string
    vertexCount?: number
    triangleCount?: number
    fileSizeBytes?: number
    generationTimeMs?: number
  }
  createdAt: string
  completedAt?: string
  // ░▒▓ Post-processing lineage — assets form chains: draft → textured → remeshed ▓▒░
  sourceAssetId?: string               // parent asset this was derived from
  action?: ConjureAction               // what pipeline produced this asset
  // ░▒▓ Character pipeline — A-pose conjurations eligible for rigging ▓▒░
  characterMode?: boolean              // conjured with character intent → enables Rig button
  // ░▒▓ Auto-pipeline flags — chain steps automatically ▓▒░
  autoRig?: boolean                    // auto-rig when generation completes
  autoAnimate?: boolean                // auto-animate when rig completes
  animationPreset?: string             // which animation to apply
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRAFTED SCENES (LLM procedural geometry)
// ═══════════════════════════════════════════════════════════════════════════════

export type PrimitiveType = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'plane' | 'capsule'

export interface CraftedPrimitive {
  type: PrimitiveType
  position: [number, number, number]
  rotation?: [number, number, number]
  scale: [number, number, number]
  color: string
  metalness?: number
  roughness?: number
  emissive?: string
  emissiveIntensity?: number
  opacity?: number              // 0-1, <1 enables transparency (glass, water, holograms)
}

export interface CraftedScene {
  id: string
  name: string
  prompt: string
  objects: CraftedPrimitive[]
  position: [number, number, number]
  createdAt: string
  thumbnailUrl?: string           // /crafted-thumbs/{id}.jpg — auto-generated on creation
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATALOG PLACEMENTS — Pre-made assets placed in the world from ASSET_CATALOG
// ═══════════════════════════════════════════════════════════════════════════════

export interface CatalogPlacement {
  id: string                              // unique per placement: `catalog-${catalogId}-${timestamp}`
  catalogId: string                       // references AssetDefinition.id from ASSET_CATALOG
  name: string
  glbPath: string                         // path to the .gltf/.glb file
  position: [number, number, number]
  rotation?: [number, number, number]     // Euler angles in radians
  scale: number
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESH STATS — The polygon anatomy of a loaded GLB
// ░▒▓ X-ray vision into the geometry that makes up a conjured or catalog object ▓▒░
// ═══════════════════════════════════════════════════════════════════════════════

export interface ModelStats {
  triangles: number
  vertices: number
  meshCount: number
  materialCount: number
  boneCount: number
  dimensions: { w: number; h: number; d: number }  // bounding box in world units (W × H × D)
  clips: { name: string; duration: number }[]       // animation clips: name + duration (seconds)
  fileSize?: number                                  // GLB file size in bytes (set via HEAD request)
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORLD LIGHTS — Placeable light sources, per-world, fully persistent
// ─═̷─═̷─💡─═̷─═̷─ Let there be light, and let the user decide where ─═̷─═̷─💡─═̷─═̷─
// ═══════════════════════════════════════════════════════════════════════════════

export type WorldLightType = 'point' | 'spot' | 'directional' | 'ambient' | 'hemisphere' | 'environment'

/** Single source of truth for intensity slider ranges per light type.
 *  Both WizardConsole and ObjectInspector read from here. */
export const LIGHT_INTENSITY_MAX: Record<WorldLightType, number> = {
  spot: 5000,
  point: 500,
  directional: 500,
  ambient: 500,
  hemisphere: 500,
  environment: 50,
}
export const LIGHT_INTENSITY_STEP: Record<WorldLightType, number> = {
  spot: 1,
  point: 0.5,
  directional: 0.5,
  ambient: 0.5,
  hemisphere: 0.5,
  environment: 0.1,
}

export interface WorldLight {
  id: string                              // unique: `light-${type}-${timestamp}`
  type: WorldLightType
  color: string                           // hex color, e.g. '#FFE4B5'
  intensity: number                       // 0-10 range
  position: [number, number, number]      // world position (ignored for ambient)
  /** Spot/directional: target direction. Default [0, -1, 0] (straight down). */
  target?: [number, number, number]
  /** Spot only: cone angle in degrees. Default 45. */
  angle?: number
  /** Hemisphere only: ground color. Default '#3a5f0b'. */
  groundColor?: string
  castShadow?: boolean
  visible?: boolean
}

/** Fresh world = just IBL. Clean slate, PBR materials look correct, zero GPU overhead.
 *  Player adds sun/ambient/hemi as they build — intentional lighting is part of world-building. */
export const DEFAULT_WORLD_LIGHTS: Omit<WorldLight, 'id'>[] = [
  { type: 'environment', color: '#ffffff', intensity: 1.0, position: [0, 0, 0] },
]

// ═══════════════════════════════════════════════════════════════════════════════
// MOVEMENT PRESETS — Procedural animation for placed objects
// ─═̷─═̷─ Patrol deferred to v2 (needs visual waypoint editor) ─═̷─═̷─
// ═══════════════════════════════════════════════════════════════════════════════

export type MovementPreset =
  | { type: 'static' }
  | { type: 'spin'; axis: 'x' | 'y' | 'z'; speed: number }
  | { type: 'hover'; amplitude: number; speed: number; offset: number }
  | { type: 'orbit'; radius: number; speed: number; axis: 'xz' | 'xy' | 'yz' }
  | { type: 'bounce'; height: number; speed: number }
  | { type: 'pendulum'; axis: 'x' | 'y' | 'z'; angle: number; speed: number }
  | { type: 'patrol'; radius: number; speed: number; startAngle?: number }

export interface AnimationConfig {
  clipName: string
  loop: 'once' | 'repeat' | 'pingpong'
  speed: number       // 0.25 - 2.0x
}

export interface ObjectBehavior {
  label?: string      // custom name override
  movement: MovementPreset
  animation?: AnimationConfig
  visible: boolean
  /** RTS-style move-to target. Set by right-clicking ground while object is selected. */
  moveTarget?: [number, number, number]
  /** Movement speed for moveTarget (units/sec). Default 3. */
  moveSpeed?: number
}

// ═══════════════════════════════════════════════════════════════════════════════
// API REQUEST/RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConjureRequest {
  prompt: string
  provider: ProviderName
  tier: string
  // ░▒▓ Character pipeline — A-pose generation for rigging ▓▒░
  characterMode?: boolean
  characterOptions?: CharacterGenerationOptions
  // ░▒▓ Image-to-3D — paste a URL, get geometry ▓▒░
  imageUrl?: string
  // ░▒▓ Auto-pipeline — chain conjure → rig → animate in one shot ▓▒░
  autoRig?: boolean
  autoAnimate?: boolean
  animationPreset?: string              // which animation to auto-apply (e.g. 'walk', 'idle')
}

// ═══════════════════════════════════════════════════════════════════════════════
// CURATED ANIMATION PRESETS — v0.1 ships with a tight set, not the full 586
// ░▒▓ Meshy rig includes FREE walk + run. Everything else costs credits. ▓▒░
// ░▒▓ Tripo presets are built-in per rig type. ▓▒░
// ═══════════════════════════════════════════════════════════════════════════════

export interface CuratedAnimation {
  id: string                             // for Tripo: preset name. For Meshy: 'free:walk', 'free:run', or animation_id
  label: string
  provider: ProviderName | 'both'
  free?: boolean                         // true = included with rig, no extra cost
}

export const CURATED_ANIMATIONS: CuratedAnimation[] = [
  // ░▒▓ FREE — bundled with Meshy rig result ▓▒░
  { id: 'free:walk', label: 'Walk (free)', provider: 'meshy', free: true },
  { id: 'free:run', label: 'Run (free)', provider: 'meshy', free: true },
  // ░▒▓ Tripo built-in presets (cost credits but guaranteed to work) ▓▒░
  { id: 'idle', label: 'Idle', provider: 'tripo' },
  { id: 'walk', label: 'Walk', provider: 'tripo' },
  { id: 'run', label: 'Run', provider: 'tripo' },
  { id: 'jump', label: 'Jump', provider: 'tripo' },
  { id: 'slash', label: 'Slash', provider: 'tripo' },
  { id: 'shoot', label: 'Shoot', provider: 'tripo' },
  { id: 'dive', label: 'Dive', provider: 'tripo' },
  { id: 'hurt', label: 'Hurt', provider: 'tripo' },
]

// ═══════════════════════════════════════════════════════════════════════════════
// CHARACTER PIPELINE — From text/image to rigged, animated character
// ─═̷─═̷─ The full alchemy: conjure → texture → remesh → rig → animate ─═̷─═̷─
// ═══════════════════════════════════════════════════════════════════════════════

export interface CharacterGenerationOptions {
  poseMode?: 'a-pose' | 't-pose'     // A-pose = better shoulder deformation (industry standard)
  symmetry?: boolean                   // symmetric mesh = cleaner rig
  topology?: MeshTopology              // quad = animation-ready
}

export interface RigResult {
  riggedGlbUrl?: string
  riggedFbxUrl?: string
  walkAnimUrl?: string                 // FREE walk animation (included with rig, 0 credits)
  runAnimUrl?: string                  // FREE run animation (included with rig, 0 credits)
}

export interface AnimationPreset {
  animation_id: string
  name: string
  category: AnimationCategory
  thumbnail_url?: string
}

export type AnimationCategory =
  | 'DailyActions'
  | 'Fighting'
  | 'Dancing'
  | 'Sports'
  | 'Acrobatics'
  | 'Emotes'
  | 'Others'

export const ANIMATION_CATEGORIES: AnimationCategory[] = [
  'DailyActions', 'Fighting', 'Dancing', 'Sports', 'Acrobatics', 'Emotes', 'Others',
]

export interface ConjureResponse {
  id: string
  status: ConjureStatus
  estimatedSeconds?: number
}

export interface ConjureStatusResponse {
  asset: ConjuredAsset
}

export interface CraftRequest {
  prompt: string
}

export interface CraftResponse {
  scene: CraftedScene
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER INTERFACE (implemented by each provider client)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConjureProviderClient {
  name: ProviderName
  startGeneration(prompt: string, tier: string, options?: CharacterGenerationOptions & { imageUrl?: string }): Promise<{ taskId: string }>
  checkStatus(taskId: string): Promise<{ status: ConjureStatus; progress: number; resultUrl?: string; thumbnailUrl?: string }>
  downloadResult(resultUrl: string, destPath: string): Promise<void>
}

// ▓▓▓▓【F̸O̸R̸G̸E̸】▓▓▓▓ॐ▓▓▓▓【C̸O̸N̸J̸U̸R̸E̸】▓▓▓▓
