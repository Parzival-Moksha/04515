// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// WIZARD CONSOLE — The Forge's conjuring interface
// ─═̷─═̷─ॐ─═̷─═̷─{ Speak the spell, choose the forge, cast into being }─═̷─═̷─ॐ─═̷─═̷─
// Draggable/resizable popup (follows CuratorStreamPopup pattern)
// Three providers, one dream. Text goes in, GLB comes out.
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useConjure } from '../../hooks/useConjure'
import { useOasisStore } from '../../store/oasisStore'
import { PROVIDERS, REMESH_PRESETS, LIGHT_INTENSITY_MAX, LIGHT_INTENSITY_STEP, type ProviderName, type ConjuredAsset, type ConjureStatus, type CraftedScene, type CatalogPlacement, type RemeshQuality, type WorldLightType, type GeneratedImage } from '../../lib/conjure/types'
import type { PlacementVfxType } from '../../store/oasisStore'
import { useContext } from 'react'
import { GROUND_PRESETS, getTextureUrls } from '../../lib/forge/ground-textures'
import { ASSET_CATALOG, SKY_BACKGROUNDS } from '../scene-lib/constants'
import { SettingsContext } from '../scene-lib/contexts'
import type { AssetDefinition } from '../scene-lib/types'
import { awardXp } from '../../hooks/useXp'
import { ModelPreviewPanel, CraftedPreviewPanel } from './ModelPreview'
import { generateSingleCraftedThumbnail, useCraftedThumbnailGenerator, useCatalogThumbnailGenerator } from '../../hooks/useThumbnailGenerator'
import { usePricing, getConjurePriceKey } from '../../hooks/usePricing'
import { extractPartialCraftData } from '../../lib/craft-stream'
import { addToSceneLibrary, getSceneLibrary } from '../../lib/forge/scene-library'

const OASIS_BASE = process.env.NEXT_PUBLIC_BASE_PATH || ''

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BADGE — Visual feedback for conjuration progress
// ═══════════════════════════════════════════════════════════════════════════════

const STATUS_STYLES: Record<ConjureStatus, { bg: string; text: string; label: string }> = {
  queued: { bg: 'rgba(156, 163, 175, 0.2)', text: '#9CA3AF', label: 'Queued' },
  generating: { bg: 'rgba(251, 191, 36, 0.2)', text: '#FBBF24', label: 'Forging...' },
  refining: { bg: 'rgba(168, 85, 247, 0.2)', text: '#A855F7', label: 'Refining' },
  downloading: { bg: 'rgba(59, 130, 246, 0.2)', text: '#3B82F6', label: 'Pulling' },
  ready: { bg: 'rgba(34, 197, 94, 0.2)', text: '#22C55E', label: 'Ready' },
  failed: { bg: 'rgba(239, 68, 68, 0.2)', text: '#EF4444', label: 'Failed' },
}

function StatusBadge({ status, progress }: { status: ConjureStatus; progress: number }) {
  const style = STATUS_STYLES[status]
  const isActive = status === 'generating' || status === 'refining' || status === 'downloading'
  return (
    <div
      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${isActive ? 'animate-pulse' : ''}`}
      style={{ background: style.bg, color: style.text }}
    >
      {style.label}{isActive && progress > 0 ? ` ${Math.round(progress)}%` : ''}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET THUMBNAIL — <img> with graceful emoji fallback
// ─═̷─═̷─ Every creation deserves a face, even if the portrait isn't ready yet ─═̷─═̷─
// ═══════════════════════════════════════════════════════════════════════════════

function AssetThumb({ src, fallback, alt }: { src: string; fallback: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return <span className="text-xl opacity-30">{fallback}</span>
  }
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
      loading="lazy"
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIGHT TOOLTIP — styled HTML tooltip for light type buttons
// Native title= is ugly single-line garbage. This is The Forge.
// ═══════════════════════════════════════════════════════════════════════════════

const LIGHT_TOOLTIPS: Record<string, { icon: string; name: string; tagline: string; details: string[] }> = {
  directional: {
    icon: '☀️', name: 'Directional (Sun)',
    tagline: 'Parallel rays from infinitely far away',
    details: ['Casts real shadows', 'Azimuth + Elevation controls', 'The main outdoor light source'],
  },
  ambient: {
    icon: '🌤️', name: 'Ambient',
    tagline: 'Uniform light from everywhere',
    details: ['No shadows, no direction', 'Fills dark areas so nothing is pure black', 'Start low: 0.3–1.0'],
  },
  hemisphere: {
    icon: '🌗', name: 'Hemisphere',
    tagline: 'Sky color above, ground color below',
    details: ['Natural gradient lighting', 'Mimics outdoor atmosphere', 'Great for nature scenes'],
  },
  environment: {
    icon: '🌐', name: 'IBL (Image-Based)',
    tagline: 'Uses the sky background as a light source',
    details: ['Realistic PBR reflections', 'Makes metallic materials shine', 'Usually keep one per scene'],
  },
  point: {
    icon: '💡', name: 'Point',
    tagline: 'Radiates equally in all directions',
    details: ['Like a light bulb', 'Place near objects for local highlights', '3D-positioned in world'],
  },
  spot: {
    icon: '🔦', name: 'Spot',
    tagline: 'Cone-shaped beam aimed at a target',
    details: ['Angle controls cone width', 'Azimuth + Elevation aim direction', 'Intensity up to 5000 — dramatic'],
  },
}

function LightTooltipWrap({ type, children, className }: { type: string; children: React.ReactNode; className?: string }) {
  const [show, setShow] = useState(false)
  const tip = LIGHT_TOOLTIPS[type]
  if (!tip) return <>{children}</>
  return (
    <div className={className || 'relative'} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div
          className="absolute z-[9999] bottom-full left-1/2 mb-2 pointer-events-none"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div
            className="w-52 rounded-lg p-2.5 text-[10px] leading-relaxed shadow-lg"
            style={{
              background: 'rgba(8, 8, 12, 0.92)',
              border: '1px solid rgba(250, 204, 21, 0.15)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">{tip.icon}</span>
              <span className="text-[11px] font-semibold text-yellow-300">{tip.name}</span>
            </div>
            <div className="text-gray-300 mb-1.5">{tip.tagline}</div>
            {tip.details.map((d, i) => (
              <div key={i} className="flex items-start gap-1 text-gray-400">
                <span className="text-yellow-500/60 text-[8px] mt-[2px]">▸</span>
                <span>{d}</span>
              </div>
            ))}
          </div>
          {/* Arrow */}
          <div
            className="w-2 h-2 mx-auto"
            style={{
              background: 'rgba(8, 8, 12, 0.92)',
              borderRight: '1px solid rgba(250, 204, 21, 0.15)',
              borderBottom: '1px solid rgba(250, 204, 21, 0.15)',
              transform: 'rotate(45deg) translateY(-4px)',
            }}
          />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// GALLERY ITEM — Each conjured asset in the grid
// ═══════════════════════════════════════════════════════════════════════════════

function GalleryItem({ asset, onDelete, isInWorld, onPlace, onRemove, onTexture, onRemesh, onRig, onRename, pricing }: {
  asset: ConjuredAsset
  onDelete: (id: string) => void
  isInWorld: boolean
  onPlace: (id: string) => void
  onRemove: (id: string) => void
  onTexture?: (id: string) => void
  onRemesh?: (id: string, quality: RemeshQuality) => void
  onRig?: (id: string) => void
  onRename?: (id: string, name: string) => void
  pricing?: Record<string, number>
}) {
  const provider = PROVIDERS.find(p => p.name === asset.provider)
  const isActive = !['ready', 'failed'].includes(asset.status)
  const fileSizeKB = asset.metadata?.fileSizeBytes ? (asset.metadata.fileSizeBytes / 1024).toFixed(0) : null
  const [remeshOpen, setRemeshOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(asset.displayName || asset.prompt)
  const displayLabel = asset.displayName || asset.prompt

  // ░▒▓ Determine which post-processing buttons to show ▓▒░
  // Texture: Meshy-only (Tripo textures during generation with pbr: true)
  const canTexture = asset.status === 'ready' && asset.provider === 'meshy'
    && asset.tier === 'preview' && asset.action !== 'texture'
  // Remesh: Meshy + Tripo — any ready asset that isn't already a remesh
  const canRemesh = asset.status === 'ready'
    && (asset.provider === 'meshy' || asset.provider === 'tripo')
    && asset.action !== 'remesh'
  // Rig: Meshy + Tripo — only character-mode assets (humanoids conjured for rigging)
  // Lineage: base → rig. Rig = anim now (library animations handle dance moves)
  const canRig = asset.status === 'ready'
    && (asset.provider === 'meshy' || asset.provider === 'tripo')
    && asset.action !== 'rig' && asset.action !== 'animate'
    && asset.characterMode === true

  return (
    <div
      className="relative rounded-lg border overflow-hidden group transition-all duration-200 hover:scale-[1.02]"
      style={{
        background: 'rgba(20, 20, 20, 0.8)',
        borderColor: asset.status === 'ready'
          ? 'rgba(34, 197, 94, 0.3)'
          : asset.status === 'failed'
            ? 'rgba(239, 68, 68, 0.3)'
            : 'rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Thumbnail / placeholder */}
      <div className="aspect-square flex items-center justify-center relative overflow-hidden"
        style={{ background: 'rgba(0, 0, 0, 0.4)' }}
      >
        {asset.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnailUrl.startsWith('http') ? asset.thumbnailUrl : `${OASIS_BASE}${asset.thumbnailUrl}`} alt={asset.displayName || asset.prompt} className="w-full h-full object-cover" />
        ) : isActive ? (
          <div className="flex flex-col items-center gap-1">
            <div className="text-2xl animate-spin-slow">✨</div>
            {asset.progress > 0 && (
              <div className="w-3/4 h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-500 rounded-full"
                  style={{ width: `${asset.progress}%` }}
                />
              </div>
            )}
          </div>
        ) : asset.status === 'ready' ? (
          <div className="flex flex-col items-center gap-1">
            <div className="text-3xl text-green-400/60">&#9878;</div>
            {fileSizeKB && (
              <div className="text-[9px] text-gray-400 font-mono">{fileSizeKB} KB</div>
            )}
          </div>
        ) : (
          <div className="text-2xl text-red-500">&#10006;</div>
        )}

        {/* Delete button (top-right, on hover) — with confirmation */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            const name = asset.displayName || asset.prompt?.slice(0, 30) || asset.id
            if (window.confirm(`Delete "${name}"? This removes the GLB file permanently.`)) {
              onDelete(asset.id)
            }
          }}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-gray-400 hover:text-red-400 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          &#10005;
        </button>

        {/* Tier + action badge (top-left) */}
        <div className="absolute top-1 left-1 text-[8px] font-mono px-1 py-0.5 rounded bg-black/60 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
          {asset.action && asset.action !== 'conjure' ? asset.action : asset.tier}
        </div>
      </div>

      {/* Info — click name to rename */}
      <div className="p-1.5">
        {isEditing ? (
          <input
            autoFocus
            className="text-[10px] text-gray-200 bg-gray-800/80 border border-gray-600 rounded px-1 py-0.5 w-full font-mono outline-none focus:border-orange-500/50"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={() => {
              setIsEditing(false)
              const trimmed = editName.trim()
              if (trimmed && trimmed !== (asset.displayName || asset.prompt) && onRename) {
                onRename(asset.id, trimmed)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') { setEditName(asset.displayName || asset.prompt); setIsEditing(false) }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="text-[10px] text-gray-300 truncate cursor-pointer hover:text-orange-300 transition-colors"
            title={`${displayLabel} (click to rename)`}
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditName(asset.displayName || asset.prompt) }}
          >
            {displayLabel}
          </div>
        )}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-gray-400 font-mono">{provider?.displayName || asset.provider}</span>
            {asset.action === 'rig' && (
              <span className="px-1 py-px rounded text-[7px] font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30">{'\u2699'}rig</span>
            )}
            {asset.action === 'animate' && (
              <span className="px-1 py-px rounded text-[7px] font-mono bg-green-500/20 text-green-400 border border-green-500/30">{'\uD83C\uDFC3'}anim</span>
            )}
          </div>
          <StatusBadge status={asset.status} progress={asset.progress} />
        </div>
        {asset.status === 'failed' && asset.errorMessage && (
          <div className="text-[9px] text-red-400/70 mt-0.5 truncate" title={asset.errorMessage}>
            {asset.errorMessage}
          </div>
        )}
        {asset.completedAt && (
          <div className="text-[8px] text-gray-500 mt-0.5 font-mono">
            {new Date(asset.completedAt).toLocaleDateString()}
          </div>
        )}

        {/* ░▒▓ Action buttons row ▓▒░ */}
        {asset.status === 'ready' && (
          <div className="flex gap-1 mt-1">
            {/* Place — always available, allows multiple copies of same asset */}
            <button
              onClick={(e) => { e.stopPropagation(); onPlace(asset.id) }}
              className="flex-1 text-[10px] py-0.5 rounded border transition-colors font-mono text-emerald-400/70 border-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40 bg-emerald-500/5"
            >
              + place{isInWorld ? ' another' : ''}
            </button>

            {/* Texture button — for untextured meshy previews */}
            {canTexture && onTexture && (
              <button
                onClick={(e) => { e.stopPropagation(); onTexture(asset.id) }}
                className="text-[10px] py-0.5 px-1.5 rounded border transition-colors font-mono text-purple-400/80 border-purple-500/20 hover:text-purple-300 hover:border-purple-500/40 bg-purple-500/5"
                title={`Add PBR textures (${pricing?.post_texture ?? 0.5} cr)`}
              >
                Texture <span className="text-[8px] opacity-60">{pricing?.post_texture ?? 0.5}cr</span>
              </button>
            )}

            {/* Remesh button — for textured meshy assets */}
            {canRemesh && onRemesh && (
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setRemeshOpen(!remeshOpen) }}
                  className="text-[10px] py-0.5 px-1.5 rounded border transition-colors font-mono text-cyan-400/80 border-cyan-500/20 hover:text-cyan-300 hover:border-cyan-500/40 bg-cyan-500/5"
                  title={`Retopologize (${pricing?.post_remesh ?? 0.25} cr)`}
                >
                  Remesh <span className="text-[8px] opacity-60">{pricing?.post_remesh ?? 0.25}cr</span> &#9660;
                </button>
                {remeshOpen && (
                  <div
                    className="absolute bottom-full right-0 mb-1 rounded-lg border border-gray-700/50 overflow-hidden z-10"
                    style={{ background: 'rgba(15, 15, 15, 0.95)' }}
                  >
                    {(Object.entries(REMESH_PRESETS) as [RemeshQuality, { polycount: number; label: string }][]).map(([quality, preset]) => (
                      <button
                        key={quality}
                        onClick={(e) => {
                          e.stopPropagation()
                          setRemeshOpen(false)
                          onRemesh(asset.id, quality)
                        }}
                        className="block w-full text-left text-[10px] px-3 py-1.5 font-mono text-gray-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors whitespace-nowrap"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ░▒▓ Rig button — breathe a skeleton into the sculpture ▓▒░ */}
            {canRig && onRig && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  // Warn about high-poly models (Meshy rig limit: 300k faces)
                  const tris = asset.metadata?.triangleCount || 0
                  if (tris > 300000) {
                    if (!window.confirm(`This model has ${Math.round(tris / 1000)}k triangles — Meshy rig limit is 300k. Remesh first to reduce poly count, then rig. Continue anyway?`)) return
                  }
                  onRig(asset.id)
                }}
                className="text-[10px] py-0.5 px-1.5 rounded border transition-colors font-mono text-amber-400/80 border-amber-500/20 hover:text-amber-300 hover:border-amber-500/40 bg-amber-500/5"
                title={`Auto-rig: add Mixamo skeleton (${pricing?.post_rig ?? 0.75} cr). Models >300k faces must be remeshed first.`}
              >
                &#9760; Rig <span className="text-[8px] opacity-60">{pricing?.post_rig ?? 0.75}cr</span>
              </button>
            )}

          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGINE TAB — Text-to-image via Gemini, ground textures, gallery
// ═══════════════════════════════════════════════════════════════════════════════

const IMAGINE_MODELS = [
  { key: 'gemini-flash', label: 'Gemini Flash', desc: 'Google — fast multimodal' },
  { key: 'riverflow', label: 'Riverflow v2', desc: 'Sourceful — fast diffusion' },
  { key: 'flux-klein', label: 'FLUX Klein', desc: 'Black Forest Labs — 4B param' },
  { key: 'seedream', label: 'Seedream 4.5', desc: 'ByteDance — high quality' },
] as const

interface InFlightImage {
  id: string
  prompt: string
  model: string
  startedAt: number
  error?: string
}

function ImagineTab() {
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>('gemini-flash')
  const [inFlight, setInFlight] = useState<InFlightImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const generatedImages = useOasisStore(s => s.generatedImages)
  const addGeneratedImage = useOasisStore(s => s.addGeneratedImage)
  const removeGeneratedImage = useOasisStore(s => s.removeGeneratedImage)
  const addCustomGroundPreset = useOasisStore(s => s.addCustomGroundPreset)
  const customGroundPresets = useOasisStore(s => s.customGroundPresets)
  const enterPaintMode = useOasisStore(s => s.enterPaintMode)
  const enterPlacementMode = useOasisStore(s => s.enterPlacementMode)

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return
    const flightId = `flight_${Date.now()}`
    const capturedPrompt = prompt.trim()
    const capturedModel = selectedModel
    setInFlight(prev => [...prev, { id: flightId, prompt: capturedPrompt, model: capturedModel, startedAt: Date.now() }])
    setPrompt('')
    setError(null)
    try {
      const res = await fetch(`${OASIS_BASE}/api/imagine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: capturedPrompt, model: capturedModel }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        setInFlight(prev => prev.map(f => f.id === flightId ? { ...f, error: data.error || `Error ${res.status}` } : f))
        return
      }
      const data = await res.json()
      addGeneratedImage({
        id: data.id,
        prompt: data.prompt,
        url: data.url,
        tileUrl: data.tileUrl,
        createdAt: data.createdAt,
      })
      awardXp('GENERATE_IMAGE')
    } catch (e) {
      setInFlight(prev => prev.map(f => f.id === flightId ? { ...f, error: (e as Error).message } : f))
      return
    }
    // Remove from in-flight on success
    setInFlight(prev => prev.filter(f => f.id !== flightId))
  }, [prompt, selectedModel, addGeneratedImage])

  const handleUseAsTile = useCallback((image: { id: string; prompt: string; tileUrl: string; url: string }) => {
    const presetId = `custom_${image.id}`
    // Check if already registered
    if (!customGroundPresets.some(p => p.id === presetId)) {
      addCustomGroundPreset({
        id: presetId,
        name: image.prompt.slice(0, 20),
        icon: '🎨',
        color: '#888888',
        assetName: '',
        tileRepeat: 1,
        customTextureUrl: image.tileUrl,
      })
    }
    enterPaintMode(presetId)
  }, [customGroundPresets, addCustomGroundPreset, enterPaintMode])

  return (
    <>
      <div className="space-y-3">
        {/* Prompt input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] text-pink-400/60 uppercase tracking-widest font-mono">
              Text to Image
            </div>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="text-[10px] bg-black/60 border border-pink-500/20 rounded px-1.5 py-0.5 text-pink-300 font-mono focus:outline-none focus:border-pink-500/50 cursor-pointer"
            >
              {IMAGINE_MODELS.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleGenerate() }}
              placeholder="Describe what you see..."
              className="flex-1 bg-black/60 border border-pink-500/20 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 font-mono"
            />
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className="px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
              style={{
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.3), rgba(168, 85, 247, 0.3))',
                color: '#F9A8D4',
                border: '1px solid rgba(236, 72, 153, 0.3)',
              }}
            >
              {inFlight.length > 0 ? `Imagine (${inFlight.length})` : 'Imagine'}
            </button>
          </div>
          {error && (
            <div className="mt-1 text-[10px] text-red-400 font-mono">{error}</div>
          )}
        </div>

        {/* In-flight generations */}
        {inFlight.length > 0 && (
          <div>
            <div className="text-[10px] text-pink-400/60 uppercase tracking-widest font-mono mb-1.5">
              Generating ({inFlight.length})
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {inFlight.map(f => (
                <div key={f.id} className="relative rounded-lg overflow-hidden border border-pink-500/20 bg-black/40">
                  <div className="w-full aspect-square flex flex-col items-center justify-center p-2">
                    {f.error ? (
                      <>
                        <div className="text-red-400 text-lg mb-1">✕</div>
                        <div className="text-[9px] text-red-400 font-mono text-center">{f.error}</div>
                        <button
                          onClick={() => setInFlight(prev => prev.filter(x => x.id !== f.id))}
                          className="mt-1 text-[9px] text-gray-400 hover:text-gray-200 font-mono"
                        >dismiss</button>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl mb-2 animate-pulse">🎨</div>
                        <div className="text-[9px] text-pink-300 font-mono text-center line-clamp-2">{f.prompt}</div>
                        <div className="text-[8px] text-gray-500 font-mono mt-1">
                          {IMAGINE_MODELS.find(m => m.key === f.model)?.label || f.model}
                        </div>
                        {/* Pulsing progress bar */}
                        <div className="w-full mt-2 h-1 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500 animate-pulse rounded-full" style={{ width: `${Math.min(90, ((Date.now() - f.startedAt) / 300))}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gallery */}
        {generatedImages.length > 0 && (
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest font-mono mb-1.5">
              Gallery ({generatedImages.length})
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[...generatedImages].reverse().map(img => (
                <div key={img.id} className="group relative rounded-lg overflow-hidden border border-gray-700/30 bg-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.prompt}
                    className="w-full aspect-square object-cover"
                    loading="lazy"
                  />
                  {/* Hover actions overlay */}
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                    <div className="text-[9px] text-gray-300 font-mono text-center line-clamp-2 mb-1">{img.prompt}</div>
                    <div className="flex gap-1 w-full">
                      <button
                        onClick={() => enterPlacementMode({ type: 'image', name: img.prompt.slice(0, 24), imageUrl: img.url })}
                        className="flex-1 text-[10px] px-2 py-1 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 hover:bg-pink-500/30 transition-colors font-mono"
                      >
                        Place
                      </button>
                      <button
                        onClick={() => enterPlacementMode({ type: 'image', name: img.prompt.slice(0, 24), imageUrl: img.url, imageFrame: true })}
                        className="text-[10px] px-2 py-1 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors font-mono"
                        title="Place with golden frame"
                      >
                        🖼️
                      </button>
                    </div>
                    <button
                      onClick={() => handleUseAsTile(img)}
                      className="w-full text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors font-mono"
                    >
                      Use as tile
                    </button>
                    <button
                      onClick={() => removeGeneratedImage(img.id)}
                      className="w-full text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400/60 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 transition-colors font-mono"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {generatedImages.length === 0 && inFlight.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <div className="text-3xl mb-2">🎨</div>
            <div className="text-xs">No images generated yet</div>
            <div className="text-[10px] mt-1 text-gray-500">Type a prompt and hit Imagine</div>
          </div>
        )}

        {/* Custom ground textures summary */}
        {customGroundPresets.length > 0 && (
          <div className="border-t border-gray-700/30 pt-2">
            <div className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-mono mb-1">
              Custom Tile Textures ({customGroundPresets.length})
            </div>
            <div className="text-[9px] text-gray-500 font-mono">
              Available in World tab → Ground palette
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// WIZARD CONSOLE — Main popup component
// ═══════════════════════════════════════════════════════════════════════════════

interface WizardConsoleProps {
  isOpen: boolean
  onClose: () => void
}

export function WizardConsole({ isOpen, onClose }: WizardConsoleProps) {
  // ─═̷─ Position & size state — persisted to localStorage ─═̷─
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 60, y: 80 }
    try {
      const saved = localStorage.getItem('oasis-wizard-pos')
      return saved ? JSON.parse(saved) : { x: 60, y: 80 }
    } catch { return { x: 60, y: 80 } }
  })
  const [size, setSize] = useState(() => {
    if (typeof window === 'undefined') return { width: 400, height: 560 }
    try {
      const saved = localStorage.getItem('oasis-wizard-size')
      return saved ? JSON.parse(saved) : { width: 400, height: 560 }
    } catch { return { width: 400, height: 560 } }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const resizeStart = useRef({ width: 0, height: 0, x: 0, y: 0 })
  // ░▒▓ Adaptive tabs — measure overflow, downgrade to icon-only when needed ▓▒░
  const tabStripRef = useRef<HTMLDivElement>(null)
  const [showTabLabels, setShowTabLabels] = useState(size.width >= 620)

  // ░▒▓ Persist window geometry to localStorage on drag/resize end ▓▒░
  useEffect(() => {
    if (!isDragging && !isResizing) {
      localStorage.setItem('oasis-wizard-pos', JSON.stringify(position))
      localStorage.setItem('oasis-wizard-size', JSON.stringify(size))
    }
  }, [isDragging, isResizing, position, size])

  // ░▒▓ Tab label overflow detection — try labels at wide sizes, downgrade if overflow ▓▒░
  useEffect(() => { setShowTabLabels(size.width >= 620) }, [size.width])
  useEffect(() => {
    const el = tabStripRef.current
    if (!el || !showTabLabels) return
    // After render with labels: if content overflows, switch to icons only
    requestAnimationFrame(() => {
      if (el.scrollWidth > el.clientWidth + 4) setShowTabLabels(false)
    })
  }, [showTabLabels, size.width])

  // ─═̷─ Wizard state ─═̷─
  const [mode, setMode] = useState<'conjure' | 'craft' | 'world' | 'assets' | 'placed' | 'imagine' | 'settings'>('conjure')
  const [provider, setProvider] = useState<ProviderName>('meshy')
  const [tier, setTier] = useState(PROVIDERS[0].tiers[1]?.id || PROVIDERS[0].tiers[0].id)  // Default: textured (refine)
  const [prompt, setPrompt] = useState('')
  const [isCasting, setIsCasting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // ░▒▓ Character pipeline — A-pose mode for riggable output ▓▒░
  const [characterMode, setCharacterMode] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [showImageInput, setShowImageInput] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null) // thumbnail for dropped files
  const imageFileRef = useRef<HTMLInputElement>(null)

  // ░▒▓ Collapsible conjure sections — Text-to-3D vs Image-to-3D ▓▒░
  type ConjureSection = 'text' | 'image'
  const [conjureExpanded, setConjureExpanded] = useState<ConjureSection>('text')

  // ░▒▓ Image-to-3D section has its own provider/tier/char state ▓▒░
  const [imgProvider, setImgProvider] = useState<ProviderName>('tripo')
  const [imgTier, setImgTier] = useState(PROVIDERS.find(p => p.name === 'tripo')?.tiers[3]?.id || 'premium')  // Default: v3.1
  const [imgCharacterMode, setImgCharacterMode] = useState(false)
  const [imgPrompt, setImgPrompt] = useState('')  // optional prompt hint for image-to-3D

  // ░▒▓ Auto-pipeline — chain rig after conjure completes ▓▒░
  // (Auto-animate removed: library animations handle all dance moves locally)
  const [autoRig, setAutoRig] = useState(false)
  // Same for image section
  const [imgAutoRig, setImgAutoRig] = useState(false)

  // ░▒▓ Convert dropped/selected image file to base64 data URI ▓▒░
  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUri = reader.result as string
      setImageUrl(dataUri)
      setImagePreview(dataUri)
    }
    reader.readAsDataURL(file)
  }, [])

  // ─═̷─ Conjuration engine ─═̷─
  const { conjuredAssets, startConjure, processAsset, deleteAsset, activeCount } = useConjure()
  const updateConjuredAsset = useOasisStore(s => s.updateConjuredAsset)

  // ░▒▓ Rename — PATCH to server + update local store ▓▒░
  const renameAsset = useCallback(async (id: string, displayName: string) => {
    try {
      const res = await fetch(`${OASIS_BASE}/api/conjure/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      })
      if (res.ok) {
        updateConjuredAsset(id, { displayName })
      }
    } catch (err) {
      console.error('[Forge] Rename failed:', err)
    }
  }, [updateConjuredAsset])

  // ─═̷─ Craft engine ─═̷─
  const craftedScenes = useOasisStore(s => s.craftedScenes)
  const addCraftedScene = useOasisStore(s => s.addCraftedScene)
  const updateCraftedScene = useOasisStore(s => s.updateCraftedScene)
  const removeCraftedScene = useOasisStore(s => s.removeCraftedScene)
  const sceneLibrary = useOasisStore(s => s.sceneLibrary)
  const placeLibraryScene = useOasisStore(s => s.placeLibraryScene)
  const deleteFromLibrary = useOasisStore(s => s.deleteFromLibrary)
  const [activeCrafts, setActiveCrafts] = useState(0)
  const craftLoading = activeCrafts > 0
  const [craftAnimated, setCraftAnimated] = useState(false)


  // ─═̷─ Ground texture + paint mode ─═̷─
  const groundPresetId = useOasisStore(s => s.groundPresetId)
  const setGroundPreset = useOasisStore(s => s.setGroundPreset)
  const groundTiles = useOasisStore(s => s.groundTiles)
  const paintMode = useOasisStore(s => s.paintMode)
  const paintBrushPresetId = useOasisStore(s => s.paintBrushPresetId)
  const paintBrushSize = useOasisStore(s => s.paintBrushSize)
  const enterPaintMode = useOasisStore(s => s.enterPaintMode)
  const exitPaintMode = useOasisStore(s => s.exitPaintMode)
  const setPaintBrushSize = useOasisStore(s => s.setPaintBrushSize)
  const clearAllGroundTiles = useOasisStore(s => s.clearAllGroundTiles)
  const customGroundPresets = useOasisStore(s => s.customGroundPresets)

  // ─═̷─ World sky ─═̷─
  const worldSkyBackground = useOasisStore(s => s.worldSkyBackground)
  const setWorldSkyBackground = useOasisStore(s => s.setWorldSkyBackground)
  // ─═̷─ World lights ─═̷─
  const worldLights = useOasisStore(s => s.worldLights)
  const addWorldLight = useOasisStore(s => s.addWorldLight)
  const updateWorldLight = useOasisStore(s => s.updateWorldLight)
  const removeWorldLight = useOasisStore(s => s.removeWorldLight)

  // ─═̷─ Sky background (from SettingsContext) ─═̷─
  const { settings, updateSetting } = useContext(SettingsContext)

  // ─═̷─ Iterative craft state ─═̷─
  const [craftHistory, setCraftHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])

  // ─═̷─ World management ─═̷─
  const exportCurrentWorld = useOasisStore(s => s.exportCurrentWorld)
  const importWorldFromJson = useOasisStore(s => s.importWorldFromJson)
  const activeWorldId = useOasisStore(s => s.activeWorldId)
  const worldRegistry = useOasisStore(s => s.worldRegistry)

  // ─═̷─ Transform controls ─═̷─
  const selectedObjectId = useOasisStore(s => s.selectedObjectId)
  const selectObject = useOasisStore(s => s.selectObject)
  const transformMode = useOasisStore(s => s.transformMode)
  const setTransformMode = useOasisStore(s => s.setTransformMode)
  const setInspectedObject = useOasisStore(s => s.setInspectedObject)
  const setCameraLookAt = useOasisStore(s => s.setCameraLookAt)
  const transforms = useOasisStore(s => s.transforms)

  // ─═̷─ Catalog + placement state ─═̷─
  const worldConjuredAssetIds = useOasisStore(s => s.worldConjuredAssetIds)
  const placeConjuredAssetInWorld = useOasisStore(s => s.placeConjuredAssetInWorld)
  const removeConjuredAssetFromWorld = useOasisStore(s => s.removeConjuredAssetFromWorld)
  const placedCatalogAssets = useOasisStore(s => s.placedCatalogAssets)
  const placeCatalogAsset = useOasisStore(s => s.placeCatalogAsset)
  const removeCatalogAsset = useOasisStore(s => s.removeCatalogAsset)
  const generatedImages = useOasisStore(s => s.generatedImages)
  const [assetCategory, setAssetCategory] = useState<string>('all')
  const [assetSubTab, setAssetSubTab] = useState<'catalog' | 'conjured' | 'crafted' | 'images'>('catalog')
  const [previewAsset, setPreviewAsset] = useState<AssetDefinition | null>(null)
  const [previewConjured, setPreviewConjured] = useState<ConjuredAsset | null>(null)
  const [previewCrafted, setPreviewCrafted] = useState<CraftedScene | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const savedScrollTop = useRef(0)

  // ░▒▓ Catch orphan crafted scenes without thumbnails on mount ▓▒░
  useCraftedThumbnailGenerator()

  // ░▒▓ Catalog thumbnail generator — manual trigger for 100+ GLB renders ▓▒░
  const catalogThumbGen = useCatalogThumbnailGenerator()

  // ░▒▓ Clear preview + exit paint mode when switching tabs ▓▒░
  useEffect(() => {
    setPreviewAsset(null)
    if (mode !== 'world') exitPaintMode()
  }, [mode, exitPaintMode])

  // ─═̷─ Model selector (craft + voice) ─═̷─
  const craftModel = useOasisStore(s => s.craftModel)
  const setCraftModel = useOasisStore(s => s.setCraftModel)
  const voiceModel = useOasisStore(s => s.voiceModel)
  const setVoiceModel = useOasisStore(s => s.setVoiceModel)

  // ─═̷─ VFX settings + preview ─═̷─
  const conjureVfxType = useOasisStore(s => s.conjureVfxType)
  const setConjureVfxType = useOasisStore(s => s.setConjureVfxType)
  const placementVfxType = useOasisStore(s => s.placementVfxType)
  const setPlacementVfxType = useOasisStore(s => s.setPlacementVfxType)
  const placementVfxDuration = useOasisStore(s => s.placementVfxDuration)
  const setPlacementVfxDuration = useOasisStore(s => s.setPlacementVfxDuration)
  const previewPlacementSpell = useOasisStore(s => s.previewPlacementSpell)
  const startConjurePreview = useOasisStore(s => s.startConjurePreview)
  const placementPending = useOasisStore(s => s.placementPending)
  const enterPlacementMode = useOasisStore(s => s.enterPlacementMode)
  const cancelPlacement = useOasisStore(s => s.cancelPlacement)
  // Panel opacity driven by system-level uiOpacity setting (Settings gear menu)
  const opacity = settings.uiOpacity

  // ─═̷─ Collapsible world-tab sections ─═̷─
  type WorldSection = 'sky' | 'ground' | 'lights' | 'terrain'
  const [collapsedSections, setCollapsedSections] = useState<Set<WorldSection>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = JSON.parse(localStorage.getItem('oasis-world-collapsed') || '[]')
      return new Set(stored as WorldSection[])
    } catch { return new Set() }
  })
  const toggleSection = (section: WorldSection) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section); else next.add(section)
      localStorage.setItem('oasis-world-collapsed', JSON.stringify([...next]))
      return next
    })
  }

  // Update tier when provider changes
  const selectedProvider = PROVIDERS.find(p => p.name === provider) || PROVIDERS[0]
  const selectedTier = selectedProvider.tiers.find(t => t.id === tier) || selectedProvider.tiers[0]

  const handleProviderChange = useCallback((newProvider: ProviderName) => {
    setProvider(newProvider)
    const p = PROVIDERS.find(pp => pp.name === newProvider)
    // Default to LAST tier (best quality) when switching providers
    if (p) setTier(p.tiers[p.tiers.length - 1].id)
  }, [])

  const handleImgProviderChange = useCallback((newProvider: ProviderName) => {
    setImgProvider(newProvider)
    const p = PROVIDERS.find(pp => pp.name === newProvider)
    if (p) setImgTier(p.tiers[p.tiers.length - 1].id)
  }, [])

  // Provider objects for image section
  const imgSelectedProvider = PROVIDERS.find(p => p.name === imgProvider) || PROVIDERS[0]
  const imgSelectedTier = imgSelectedProvider.tiers.find(t => t.id === imgTier) || imgSelectedProvider.tiers[0]

  // ░▒▓ Dynamic pricing from admin dashboard ▓▒░
  const { pricing } = usePricing()
  const p = useCallback((key: string, fallback: number = 1) => {
    return pricing[key] ?? fallback
  }, [pricing])
  // Conjure price lookup — e.g. conjure_meshy_refine
  const conjurePrice = useCallback((prov: string, t: string) => {
    return p(getConjurePriceKey(prov, t))
  }, [p])

  // ░▒▓ Animation preset is hardcoded — walk is the universal default ▓▒░
  // Meshy: downloads free walk+run GLBs from rig result. Tripo: animate_retarget with 'walk'.

  // ═══════════════════════════════════════════════════════════════════════════
  // CAST THE SPELL
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════
  // CAST THE SPELL — Text-to-3D
  // ═══════════════════════════════════════════════════════════════════════
  const handleCast = useCallback(async () => {
    if (!prompt.trim() || isCasting) return
    setError(null)
    setIsCasting(true)

    try {
      const options: Record<string, unknown> = {}
      if (characterMode) {
        options.characterMode = true
        options.characterOptions = { poseMode: 'a-pose' as const, topology: 'quad' as const, symmetry: true }
      }
      // ░▒▓ Auto-pipeline flag — backend chains rig after conjure ▓▒░
      if (characterMode && autoRig) {
        options.autoRig = true
      }

      await startConjure(prompt.trim(), provider, tier, Object.keys(options).length > 0 ? options as never : undefined)
      setPrompt('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Conjuration failed')
    } finally {
      setIsCasting(false)
    }
  }, [prompt, isCasting, provider, tier, startConjure, characterMode, autoRig])

  // ═══════════════════════════════════════════════════════════════════════
  // CAST THE SPELL — Image-to-3D
  // ═══════════════════════════════════════════════════════════════════════
  const handleImageCast = useCallback(async () => {
    if (!imageUrl.trim() || isCasting) return
    setError(null)
    setIsCasting(true)

    try {
      const options: Record<string, unknown> = {
        imageUrl: imageUrl.trim(),
      }
      // Optional prompt hint for image-to-3D
      const castPrompt = imgPrompt.trim() || 'image to 3D'
      if (imgCharacterMode) {
        options.characterMode = true
        options.characterOptions = { poseMode: 'a-pose' as const, topology: 'quad' as const, symmetry: true }
      }
      if (imgCharacterMode && imgAutoRig) {
        options.autoRig = true
      }

      await startConjure(castPrompt, imgProvider, imgTier, options as never)
      setImageUrl('')
      setImagePreview(null)
      setImgPrompt('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Conjuration failed')
    } finally {
      setIsCasting(false)
    }
  }, [imageUrl, isCasting, imgProvider, imgTier, imgPrompt, imgCharacterMode, imgAutoRig, startConjure])

  // ═══════════════════════════════════════════════════════════════════════════
  // CRAFT — LLM procedural geometry
  // ═══════════════════════════════════════════════════════════════════════════

  const setCraftingState = useOasisStore(s => s.setCraftingState)

  const handleCraft = useCallback(async () => {
    if (!prompt.trim()) return
    setError(null)
    // Capture prompt and clear immediately — allows firing next craft right away
    const craftPrompt = prompt.trim()
    setPrompt('')
    setActiveCrafts(n => n + 1)
    setCraftingState(true, craftPrompt)
    // ░▒▓ WORLD ISOLATION — capture origin world at craft start ▓▒░
    const originWorldId = useOasisStore.getState().activeWorldId

    // Build iterative context — include previous scene if exists
    const lastScene = craftedScenes[craftedScenes.length - 1]
    const iterativePrompt = lastScene && craftHistory.length > 0
      ? `Previous scene "${lastScene.name}" had ${lastScene.objects.length} objects: ${JSON.stringify(lastScene.objects.slice(0, 5))}...\n\nUser wants: ${craftPrompt}`
      : craftPrompt

    // ░▒▓ STREAMING CRAFT — objects materialize one by one as the LLM thinks ▓▒░
    // 1. Create placeholder scene (triggers VFX, offset, undo)
    // 2. Stream tokens, parse partial JSON, update scene incrementally
    // 3. Finalize: library save, thumbnail, XP, world save
    const sceneId = `craft_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const placeholderScene: CraftedScene = {
      id: sceneId,
      name: 'Crafting...',
      prompt: craftPrompt,
      objects: [],
      position: [0, 0, 0],
      model: craftModel,
      createdAt: new Date().toISOString(),
    }

    try {
      const res = await fetch(`${OASIS_BASE}/api/craft/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: iterativePrompt, model: craftModel, animated: craftAnimated }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      if (!res.body) throw new Error('No stream body')

      // Add placeholder scene to world — VFX plays, position offset calculated.
      // Guard: only add if we're still in the origin world. If the user switched worlds
      // while the fetch was in-flight, don't contaminate the new world with this craft.
      // The isolation block at stream-end will still save the result to the origin world.
      if (useOasisStore.getState().activeWorldId === originWorldId) {
        addCraftedScene(placeholderScene)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let lastObjectCount = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        accumulated += decoder.decode(value, { stream: true })

        // Extract complete objects from the partial JSON stream
        const partial = extractPartialCraftData(accumulated)

        // Update scene name as soon as we parse it
        if (partial.name && partial.name !== 'Crafting...') {
          updateCraftedScene(sceneId, { name: partial.name })
        }

        // New objects found — update the scene so they materialize in the 3D view
        if (partial.objects.length > lastObjectCount) {
          updateCraftedScene(sceneId, { objects: [...partial.objects] })
          lastObjectCount = partial.objects.length
        }
      }

      // ░▒▓ FINALIZE — stream complete, do the post-craft housekeeping ▓▒░
      const finalParsed = extractPartialCraftData(accumulated)
      const finalScene: CraftedScene = {
        id: sceneId,
        name: finalParsed.name || 'Unnamed Scene',
        prompt: craftPrompt,
        objects: finalParsed.objects,
        position: [0, 0, 0],
        createdAt: placeholderScene.createdAt,
        model: craftModel,
      }

      if (finalParsed.objects.length === 0) {
        // LLM returned garbage — remove the placeholder
        useOasisStore.getState().removeCraftedScene(sceneId)
        throw new Error('LLM returned no valid objects')
      }

      // Final update with cleaned data
      updateCraftedScene(sceneId, { name: finalScene.name, objects: finalScene.objects })

      // ░▒▓ WORLD ISOLATION — if user switched worlds mid-craft ▓▒░
      const currentWorldId = useOasisStore.getState().activeWorldId
      if (currentWorldId !== originWorldId) {
        console.log(`[Forge:Craft:Stream] World changed during craft (${originWorldId} → ${currentWorldId}). Moving result to origin.`)
        // Remove from current world's store, save to origin via API
        useOasisStore.getState().removeCraftedScene(sceneId)
        try {
          const { loadWorld, saveWorld } = await import('../../lib/forge/world-persistence')
          const originState = await loadWorld(originWorldId)
          if (originState) {
            // Filter out the placeholder (sceneId) in case it snuck into Supabase
            // during the world switch save, then append the completed final scene.
            const withoutPlaceholder = (originState.craftedScenes || []).filter((s: { id: string }) => s.id !== sceneId)
            await saveWorld({ ...originState, craftedScenes: [...withoutPlaceholder, finalScene] }, originWorldId)
          }
        } catch (saveErr) {
          console.error('[Forge:Craft:Stream] Failed to save to origin world:', saveErr)
        }
      }

      // Update scene library with the FINAL version (not the empty placeholder)
      addToSceneLibrary(finalScene).then(() =>
        getSceneLibrary().then(lib => useOasisStore.setState({ sceneLibrary: lib }))
      )
      // Thumbnail
      generateSingleCraftedThumbnail(finalScene).catch(() => {})
      // XP
      awardXp('CRAFT_SCENE', originWorldId)
      // Save world state
      useOasisStore.getState().saveWorldState()
      // Track conversation for iterative mode
      setCraftHistory(prev => [
        ...prev,
        { role: 'user', content: craftPrompt },
        { role: 'assistant', content: `Created "${finalScene.name}" with ${finalScene.objects.length} primitives` },
      ])

      console.log(`[Forge:Craft:Stream] Done: "${finalScene.name}" — ${finalScene.objects.length} objects streamed in`)

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Craft failed')
      // Clean up placeholder if it exists and has no objects
      const existing = useOasisStore.getState().craftedScenes.find(s => s.id === sceneId)
      if (existing && existing.objects.length === 0) {
        useOasisStore.getState().removeCraftedScene(sceneId)
      }
    } finally {
      setActiveCrafts(n => {
        const next = n - 1
        if (next <= 0) setCraftingState(false)
        return Math.max(0, next)
      })
    }
  }, [prompt, addCraftedScene, updateCraftedScene, craftedScenes, craftHistory, craftModel, setCraftingState])

  // ═══════════════════════════════════════════════════════════════════════════
  // TERRAIN — LLM terrain generation
  // ═══════════════════════════════════════════════════════════════════════════


  // Enter key to cast/craft (Shift+Enter for newline) — terrain has its own inline input in World tab
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (mode === 'craft') handleCraft()
      else handleCast()
    }
  }, [mode, handleCast, handleCraft])

  // Enter key for image section prompt
  const handleImageKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleImageCast()
    }
  }, [handleImageCast])

  // ═══════════════════════════════════════════════════════════════════════════
  // DRAG HANDLERS (same pattern as CuratorStreamPopup)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.resize-handle')) return
    if ((e.target as HTMLElement).closest('button')) return
    if ((e.target as HTMLElement).closest('select')) return
    if ((e.target as HTMLElement).closest('textarea')) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }
    e.preventDefault()
  }, [position])

  const handleDrag = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragStart.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - dragStart.current.y)),
    })
  }, [isDragging, size])

  const handleDragEnd = useCallback(() => setIsDragging(false), [])

  // ═══════════════════════════════════════════════════════════════════════════
  // RESIZE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    setIsResizing(true)
    resizeStart.current = { width: size.width, height: size.height, x: e.clientX, y: e.clientY }
    e.preventDefault()
    e.stopPropagation()
  }, [size])

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const deltaX = e.clientX - resizeStart.current.x
    const deltaY = e.clientY - resizeStart.current.y
    setSize({
      width: Math.max(350, resizeStart.current.width + deltaX),
      height: Math.max(400, resizeStart.current.height + deltaY),
    })
  }, [isResizing])

  const handleResizeEnd = useCallback(() => setIsResizing(false), [])

  // Global mouse events for drag/resize
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDrag)
      document.addEventListener('mouseup', handleDragEnd)
    }
    if (isResizing) {
      document.addEventListener('mousemove', handleResize)
      document.addEventListener('mouseup', handleResizeEnd)
    }
    return () => {
      document.removeEventListener('mousemove', handleDrag)
      document.removeEventListener('mouseup', handleDragEnd)
      document.removeEventListener('mousemove', handleResize)
      document.removeEventListener('mouseup', handleResizeEnd)
    }
  }, [isDragging, isResizing, handleDrag, handleDragEnd, handleResize, handleResizeEnd])

  if (!isOpen) return null

  const forgeColor = '#F97316' // orange-500

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — The portal opens
  // ═══════════════════════════════════════════════════════════════════════════

  return createPortal(
    <div
      data-menu-portal="wizard-console"
      className="fixed z-[9999] rounded-xl border overflow-hidden shadow-2xl flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        backgroundColor: `rgba(0, 0, 0, ${opacity})`,
        borderColor: activeCount > 0 ? `${forgeColor}66` : 'rgba(100, 100, 100, 0.3)',
        boxShadow: activeCount > 0
          ? `0 0 30px ${forgeColor}33, 0 0 60px ${forgeColor}11`
          : '0 0 20px rgba(0, 0, 0, 0.5)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ─═̷─═̷─ HEADER — Draggable ─═̷─═̷─ */}
      <div
        className="px-3 py-2 border-b border-gray-700/50 flex items-center justify-between cursor-move select-none flex-shrink-0"
        onMouseDown={handleDragStart}
        style={{
          background: activeCount > 0
            ? `linear-gradient(135deg, ${forgeColor}22 0%, rgba(0,0,0,0) 100%)`
            : 'rgba(30, 30, 30, 0.5)',
        }}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg">🧙‍♂️</span>
          {size.width >= 420 && <span className="text-sm tracking-widest" style={{ color: forgeColor, fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif", fontWeight: 700, fontVariant: 'small-caps', letterSpacing: '0.15em' }}>Wizard Console</span>}
          {activeCount > 0 && (
            <span className="text-yellow-400 text-xs animate-pulse">&#9679; {activeCount}</span>
          )}
        </div>

        <div className="flex items-center gap-1 min-w-0 flex-1 ml-2 overflow-hidden">
          {/* ░▒▓ Adaptive tab strip — icons always, labels when there's room ▓▒░ */}
          <div ref={tabStripRef} className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1" style={{ scrollbarWidth: 'none' }}>
            {([
              { key: 'conjure', label: 'Conjure', icon: '✨', color: 'orange', title: 'Text-to-3D conjuring' },
              { key: 'craft', label: 'Craft', icon: '⚒️', color: 'blue', title: 'LLM procedural geometry' },
              { key: 'world', label: 'World', icon: '🌍', color: 'emerald', title: 'Sky, ground, terrain' },
              { key: 'assets', label: 'Assets', icon: '📦', color: 'yellow', title: 'Pre-made 3D asset catalog' },
              { key: 'placed', label: 'Placed', icon: '📍', color: 'cyan', title: 'All objects placed in this world' },
              { key: 'imagine', label: 'Imagine', icon: '🎨', color: 'pink', title: 'Text-to-image (Gemini)' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setMode(tab.key)}
                className={`text-xs px-1.5 py-0.5 rounded transition-colors whitespace-nowrap ${
                  mode === tab.key
                    ? `bg-${tab.color}-500/20 text-${tab.color}-400 border border-${tab.color}-500/50`
                    : 'text-gray-300 border border-transparent hover:text-white'
                }`}
                title={tab.title}
                style={mode === tab.key ? {
                  backgroundColor: `rgba(${tab.color === 'orange' ? '249,115,22' : tab.color === 'blue' ? '59,130,246' : tab.color === 'emerald' ? '16,185,129' : tab.color === 'yellow' ? '234,179,8' : tab.color === 'cyan' ? '6,182,212' : '236,72,153'}, 0.2)`,
                  color: `rgb(${tab.color === 'orange' ? '251,146,60' : tab.color === 'blue' ? '96,165,250' : tab.color === 'emerald' ? '52,211,153' : tab.color === 'yellow' ? '250,204,21' : tab.color === 'cyan' ? '34,211,238' : '244,114,182'})`,
                  borderColor: `rgba(${tab.color === 'orange' ? '249,115,22' : tab.color === 'blue' ? '59,130,246' : tab.color === 'emerald' ? '16,185,129' : tab.color === 'yellow' ? '234,179,8' : tab.color === 'cyan' ? '6,182,212' : '236,72,153'}, 0.5)`,
                } : undefined}
              >
                <span>{tab.icon}</span>{showTabLabels && <span className="ml-1">{tab.label}</span>}
              </button>
            ))}
          </div>
          {/* ░▒▓ Fixed controls — NEVER shrink, always visible ▓▒░ */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setMode('settings')}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                mode === 'settings'
                  ? 'bg-gray-500/20 text-gray-300 border border-gray-500/50'
                  : 'text-gray-400 border border-transparent hover:text-gray-300'
              }`}
              title="VFX + Placement Settings"
            >
              &#9881;
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors text-lg leading-none ml-1"
            >
              &#215;
            </button>
          </div>
        </div>
      </div>

      {/* ─═̷─═̷─ PLACEMENT MODE INDICATOR ─═̷─═̷─ */}
      {placementPending && (
        <div className="px-3 py-1.5 border-b border-yellow-700/30 flex items-center justify-between flex-shrink-0 animate-pulse"
          style={{ background: 'rgba(60, 40, 0, 0.3)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-sm">&#9670;</span>
            <span className="text-[10px] text-yellow-300 font-mono">PLACEMENT MODE</span>
            <span className="text-[9px] text-yellow-500/60 font-mono">click ground to place {placementPending.name}</span>
          </div>
          <button
            onClick={() => cancelPlacement()}
            className="text-[9px] text-gray-400 hover:text-red-400 font-mono border border-gray-700/30 rounded px-1.5 py-0.5"
          >
            ESC cancel
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
           ░▒▓█ CONJURE SECTIONS — Text-to-3D + Image-to-3D █▓▒░
           Two collapsible sections, each with own provider/tier/char/pipeline
           ═══════════════════════════════════════════════════════════════════ */}
      {mode === 'conjure' && (
        <div className="border-b border-gray-700/30 flex-shrink-0">

          {/* ░▒▓ TEXT-TO-3D SECTION ▓▒░ */}
          <div>
            <button
              onClick={() => setConjureExpanded(conjureExpanded === 'text' ? 'image' : 'text')}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-orange-500/5 transition-colors cursor-pointer"
              style={{ background: conjureExpanded === 'text' ? 'rgba(249, 115, 22, 0.06)' : 'rgba(20, 20, 20, 0.5)' }}
            >
              <span className="text-[11px] text-orange-300/90 uppercase tracking-wider font-mono font-medium flex items-center gap-1.5">
                <span className={`text-xs text-orange-400/70 transition-transform duration-150 inline-block ${conjureExpanded === 'text' ? 'rotate-90' : ''}`}>&#9654;</span>
                Text to 3D
              </span>
              <span className="text-[9px] text-gray-400 font-mono">
                {selectedProvider.displayName} / {selectedTier.name}
              </span>
            </button>
            {conjureExpanded === 'text' && (
              <div className="px-3 pb-2 space-y-2" style={{ background: 'rgba(20, 20, 20, 0.3)' }}>
                {/* Provider + Tier row */}
                <div className="flex items-center gap-2 pt-1">
                  <select value={provider} onChange={(e) => handleProviderChange(e.target.value as ProviderName)}
                    className="text-[11px] bg-black/60 border border-gray-700 rounded px-2 py-1 text-gray-300 focus:border-orange-500/50 focus:outline-none cursor-pointer">
                    {PROVIDERS.map(p => <option key={p.name} value={p.name}>{p.displayName}</option>)}
                  </select>
                  <select value={tier} onChange={(e) => setTier(e.target.value)}
                    className="text-[11px] bg-black/60 border border-gray-700 rounded px-2 py-1 text-gray-300 focus:border-orange-500/50 focus:outline-none cursor-pointer">
                    {selectedProvider.tiers.map(t => { const cost = conjurePrice(selectedProvider.name, t.id); return <option key={t.id} value={t.id}>{t.name} ({cost} cr)</option> })}
                  </select>
                  <span className="text-[9px] text-orange-400/70 font-mono ml-auto">~{selectedTier.estimatedSeconds}s | {conjurePrice(provider, tier)} cr</span>
                </div>

                {/* Stuff / Character toggle + auto-pipeline */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex rounded overflow-hidden border border-gray-700/40">
                    <button onClick={() => { setCharacterMode(false); setAutoRig(false) }}
                      className={`text-[10px] px-2 py-0.5 font-mono transition-colors ${!characterMode ? 'bg-orange-500/20 text-orange-300' : 'text-gray-400 hover:text-gray-300 bg-black/30'}`}
                      title="Object/stuff mode — standard 3D model">
                      {'\uD83D\uDCE6'} Stuff
                    </button>
                    <button onClick={() => setCharacterMode(true)}
                      className={`text-[10px] px-2 py-0.5 font-mono transition-colors ${characterMode ? 'bg-amber-500/20 text-amber-300' : 'text-gray-400 hover:text-gray-300 bg-black/30'}`}
                      title="Character mode: A-pose, quad topology, symmetric mesh (riggable)">
                      {'\uD83E\uDDCD'} Character
                    </button>
                  </div>
                  {characterMode && (
                    <>
                      <label className="flex items-center gap-1 cursor-pointer" title={`Auto-rig after generation completes (${p('post_rig', 0.75)} cr)`}>
                        <input type="checkbox" checked={autoRig} onChange={(e) => setAutoRig(e.target.checked)}
                          className="w-3 h-3 rounded border-gray-600 bg-black/60 accent-amber-500" />
                        <span className="text-[10px] text-amber-400/70 font-mono">Auto-rig ({p('post_rig', 0.75)} cr)</span>
                      </label>
                    </>
                  )}
                </div>

                {/* Prompt + Cast button */}
                <div className="flex gap-2">
                  <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={handleKeyDown}
                    disabled={isCasting} rows={2}
                    placeholder="a crystal dragon perched on a floating rock..."
                    className="flex-1 text-xs bg-black/60 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-orange-500/50 disabled:opacity-50" />
                  <button onClick={handleCast} disabled={!prompt.trim() || isCasting}
                    className="px-3 py-2 rounded-lg text-sm font-bold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed self-end"
                    style={{ background: `${forgeColor}33`, color: forgeColor, border: `1px solid ${forgeColor}55` }}
                    title={`Costs ${conjurePrice(provider, tier)}${autoRig ? ` + ${p('post_rig', 0.75)} rig` : ''} credits`}>
                    {isCasting ? '...' : characterMode ? (autoRig ? '\uD83E\uDDCD\u2192\u2699' : 'Cast \uD83E\uDDCD') : 'Cast \u2728'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ░▒▓ IMAGE-TO-3D SECTION ▓▒░ */}
          <div className="border-t border-gray-700/20">
            <button
              onClick={() => setConjureExpanded(conjureExpanded === 'image' ? 'text' : 'image')}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-pink-500/5 transition-colors cursor-pointer"
              style={{ background: conjureExpanded === 'image' ? 'rgba(236, 72, 153, 0.06)' : 'rgba(20, 20, 20, 0.5)' }}
            >
              <span className="text-[11px] text-pink-300/90 uppercase tracking-wider font-mono font-medium flex items-center gap-1.5">
                <span className={`text-xs text-pink-400/70 transition-transform duration-150 inline-block ${conjureExpanded === 'image' ? 'rotate-90' : ''}`}>&#9654;</span>
                Image to 3D
                {imageUrl.trim() && <span className="text-[8px] text-pink-400 ml-1">&#9679;</span>}
              </span>
              <span className="text-[9px] text-gray-400 font-mono">
                {imgSelectedProvider.displayName} / {imgSelectedTier.name}
              </span>
            </button>
            {conjureExpanded === 'image' && (
              <div className="px-3 pb-2 space-y-2" style={{ background: 'rgba(20, 20, 20, 0.3)' }}>
                {/* Drop zone / file picker */}
                <div
                  className="flex items-center gap-2 mt-1 cursor-pointer rounded border border-dashed border-pink-700/40 hover:border-pink-500/60 px-2 py-1.5 transition-colors"
                  onClick={() => imageFileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const file = e.dataTransfer.files[0]; if (file) handleImageFile(file) }}
                >
                  {imagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imagePreview} alt="preview" className="w-10 h-10 rounded object-cover border border-pink-500/30" />
                  ) : (
                    <span className="text-pink-500/50 text-lg">&#128247;</span>
                  )}
                  <span className="text-[10px] text-pink-400/60 font-mono flex-1">
                    {imagePreview ? 'Image loaded' : 'Drop image or click to browse'}
                  </span>
                  {imageUrl.trim() && (
                    <button onClick={(e) => { e.stopPropagation(); setImageUrl(''); setImagePreview(null) }}
                      className="text-[10px] text-pink-500 hover:text-pink-300">&#215;</button>
                  )}
                </div>
                <input ref={imageFileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageFile(file) }} />

                {/* URL paste input */}
                <input type="text" value={imageUrl.startsWith('data:') ? '' : imageUrl}
                  onChange={(e) => { setImageUrl(e.target.value); setImagePreview(null) }}
                  placeholder="or paste public image URL..."
                  className="w-full text-[11px] bg-black/60 border border-pink-700/30 rounded px-2 py-1 text-gray-300 placeholder-gray-600 focus:border-pink-500/50 focus:outline-none font-mono" />

                {/* Provider + Tier row */}
                <div className="flex items-center gap-2">
                  <select value={imgProvider} onChange={(e) => handleImgProviderChange(e.target.value as ProviderName)}
                    className="text-[11px] bg-black/60 border border-gray-700 rounded px-2 py-1 text-gray-300 focus:border-pink-500/50 focus:outline-none cursor-pointer">
                    {PROVIDERS.map(p => <option key={p.name} value={p.name}>{p.displayName}</option>)}
                  </select>
                  <select value={imgTier} onChange={(e) => setImgTier(e.target.value)}
                    className="text-[11px] bg-black/60 border border-gray-700 rounded px-2 py-1 text-gray-300 focus:border-pink-500/50 focus:outline-none cursor-pointer">
                    {imgSelectedProvider.tiers.map(t => { const cost = conjurePrice(imgSelectedProvider.name, t.id); return <option key={t.id} value={t.id}>{t.name} ({cost} cr)</option> })}
                  </select>
                  <span className="text-[9px] text-orange-400/70 font-mono ml-auto">~{imgSelectedTier.estimatedSeconds}s | {conjurePrice(imgProvider, imgTier)} cr</span>
                </div>

                {/* Stuff / Character toggle + auto-pipeline */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex rounded overflow-hidden border border-gray-700/40">
                    <button onClick={() => { setImgCharacterMode(false); setImgAutoRig(false) }}
                      className={`text-[10px] px-2 py-0.5 font-mono transition-colors ${!imgCharacterMode ? 'bg-pink-500/20 text-pink-300' : 'text-gray-400 hover:text-gray-300 bg-black/30'}`}
                      title="Object/stuff mode — standard 3D model">
                      {'\uD83D\uDCE6'} Stuff
                    </button>
                    <button onClick={() => setImgCharacterMode(true)}
                      className={`text-[10px] px-2 py-0.5 font-mono transition-colors ${imgCharacterMode ? 'bg-amber-500/20 text-amber-300' : 'text-gray-400 hover:text-gray-300 bg-black/30'}`}
                      title="Character mode: A-pose, quad topology, symmetric mesh (riggable)">
                      {'\uD83E\uDDCD'} Character
                    </button>
                  </div>
                  {imgCharacterMode && (
                    <>
                      <label className="flex items-center gap-1 cursor-pointer" title={`Auto-rig after generation completes (${p('post_rig', 0.75)} cr)`}>
                        <input type="checkbox" checked={imgAutoRig} onChange={(e) => setImgAutoRig(e.target.checked)}
                          className="w-3 h-3 rounded border-gray-600 bg-black/60 accent-amber-500" />
                        <span className="text-[10px] text-amber-400/70 font-mono">Auto-rig ({p('post_rig', 0.75)} cr)</span>
                      </label>
                    </>
                  )}
                </div>

                {/* Optional prompt hint + Cast button */}
                <div className="flex gap-2">
                  <input type="text" value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)}
                    onKeyDown={handleImageKeyDown}
                    placeholder="optional: describe the object..."
                    className="flex-1 text-xs bg-black/60 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-pink-500/50" />
                  <button onClick={handleImageCast} disabled={!imageUrl.trim() || isCasting}
                    className="px-3 py-2 rounded-lg text-sm font-bold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed self-end"
                    style={{ background: '#EC489933', color: '#EC4899', border: '1px solid #EC489955' }}
                    title={`Costs ${conjurePrice(imgProvider, imgTier)}${imgAutoRig ? ` + ${p('post_rig', 0.75)} rig` : ''} credits`}>
                    {isCasting ? '...' : imgCharacterMode ? (imgAutoRig ? '\uD83D\uDCF7\u2192\u2699' : 'Cast \uD83D\uDCF7\uD83E\uDDCD') : 'Cast \uD83D\uDCF7'}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ─═̷─═̷─ CRAFT MODE info bar + model selector + animated toggle ─═̷─═̷─ */}
      {mode === 'craft' && (
        <div className="px-3 py-2 border-b border-gray-700/30 flex items-center justify-between flex-shrink-0"
          style={{ background: 'rgba(20, 20, 20, 0.5)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-400/70 font-mono">LLM craft</span>
            {/* Static / Animated toggle */}
            <button
              onClick={() => setCraftAnimated(!craftAnimated)}
              className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition-all ${
                craftAnimated
                  ? 'border-purple-500/50 bg-purple-500/15 text-purple-300'
                  : 'border-gray-700/30 bg-black/40 text-gray-500 hover:text-gray-400'
              }`}
              title={craftAnimated ? 'Animated mode — LLM will add motion to primitives' : 'Static mode — no animations'}
            >
              {craftAnimated ? 'Animated' : 'Static'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 font-mono">{craftedScenes.length} scene{craftedScenes.length !== 1 ? 's' : ''}</span>
            <select
              value={craftModel}
              onChange={(e) => setCraftModel(e.target.value)}
              className="text-[10px] bg-black/60 border border-blue-700/30 rounded px-1.5 py-0.5 text-blue-300 font-mono cursor-pointer focus:outline-none focus:border-blue-500/50 appearance-none"
              style={{ backgroundImage: 'none' }}
              title="LLM model for crafting + terrain"
            >
              <option value="moonshotai/kimi-k2.5">Kimi K2.5</option>
              <option value="anthropic/claude-sonnet-4-6">Sonnet 4.6</option>
              <option value="anthropic/claude-haiku-4-5">Haiku 4.5</option>
              <option value="z-ai/glm-5">GLM-5</option>
            </select>
          </div>
        </div>
      )}

      {/* Terrain info bar removed — now inline in World tab */}

      {/* Transform controls bar moved to ObjectInspector — R/T/Y hotkeys still work globally */}

      {/* ─═̷─═̷─ CRAFT SPELL INPUT (only in craft mode — conjure has inline inputs) ─═̷─═̷─ */}
      {mode === 'craft' && (
      <div className="px-3 py-2 flex gap-2 flex-shrink-0">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="craft a red house with a blue door and chimney..."
          className="flex-1 text-xs bg-black/60 border border-blue-700/40 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500/50"
        />
        <button
          onClick={handleCraft}
          disabled={!prompt.trim()}
          className="px-3 py-2 rounded-lg text-sm font-bold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed self-end"
          style={{ background: '#3B82F633', color: '#3B82F6', border: '1px solid #3B82F655' }}
          title={`Costs ${p('craft', 0.05)} credits`}
        >
          {activeCrafts > 0 ? `Craft \u2699 (${activeCrafts})` : `Craft \u2699 ${p('craft', 0.05) > 0 ? `(${p('craft', 0.05)} cr)` : ''}`}
        </button>
      </div>
      )}

      {/* Error display */}
      {error && (
        <div className="px-3 pb-1 flex-shrink-0">
          <div className={`text-[10px] rounded px-2 py-1 ${
            error.includes('Insufficient credits')
              ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
              : 'text-red-400 bg-red-500/10 border border-red-500/20'
          }`}>
            {error}
            <button
              onClick={() => setError(null)}
              className={`ml-2 ${error.includes('Insufficient credits') ? 'text-amber-500 hover:text-amber-300' : 'text-red-500 hover:text-red-300'}`}
            >
              &#215;
            </button>
          </div>
        </div>
      )}

      {/* ─══ॐ══─ GALLERY / WORLD / ASSETS / PLACED / SETTINGS ─══ॐ══─ */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
        {mode === 'world' ? (
          <div className="space-y-4">

            {/* ░▒▓█ SKY BACKGROUND — The heavens above █▓▒░ */}
            <div>
              <button onClick={() => toggleSection('sky')} className="w-full flex items-center justify-between px-2.5 py-1.5 -mx-0.5 rounded-md border border-indigo-500/20 bg-indigo-950/40 hover:bg-indigo-900/30 hover:border-indigo-400/30 transition-all duration-150 group cursor-pointer mb-1.5">
                <span className="text-[11px] text-indigo-300/90 uppercase tracking-wider font-mono font-medium flex items-center gap-1.5">
                  <span className={`text-xs text-indigo-400/70 transition-transform duration-150 inline-block ${collapsedSections.has('sky') ? '' : 'rotate-90'}`}>&#9654;</span>
                  Sky Background
                </span>
                <span className="text-[10px] text-indigo-400/50 font-mono">
                  {SKY_BACKGROUNDS.find(s => s.id === worldSkyBackground)?.name || 'Procedural Stars'}
                </span>
              </button>
              {!collapsedSections.has('sky') && (
                <div className="grid grid-cols-2 gap-1.5">
                  {SKY_BACKGROUNDS.map(sky => {
                    const isActive = worldSkyBackground === sky.id
                    return (
                      <button
                        key={sky.id}
                        onClick={() => setWorldSkyBackground(sky.id)}
                        className={`rounded-lg border px-2 py-1.5 transition-all duration-200 text-left ${
                          isActive
                            ? 'border-indigo-500/60 bg-indigo-500/10'
                            : 'border-gray-700/30 bg-black/40 hover:border-indigo-500/30 hover:bg-indigo-500/5'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{sky.path ? (sky.path.endsWith('.exr') ? '\u{1F30C}' : '\u{1F303}') : '\u2728'}</span>
                          <span className={`text-[10px] font-medium ${isActive ? 'text-indigo-300' : 'text-gray-400'}`}>
                            {sky.name}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ░▒▓█ GROUND PAINT — Tile-by-tile ground painting █▓▒░ */}
            <div>
              <button onClick={() => toggleSection('ground')} className="w-full flex items-center justify-between px-2.5 py-1.5 -mx-0.5 rounded-md border border-emerald-500/20 bg-emerald-950/40 hover:bg-emerald-900/30 hover:border-emerald-400/30 transition-all duration-150 group cursor-pointer mb-1.5">
                <span className="text-[11px] text-emerald-300/90 uppercase tracking-wider font-mono font-medium flex items-center gap-1.5">
                  <span className={`text-xs text-emerald-400/70 transition-transform duration-150 inline-block ${collapsedSections.has('ground') ? '' : 'rotate-90'}`}>&#9654;</span>
                  Ground Paint
                </span>
                <span className="text-[10px] text-emerald-400/50 font-mono">
                  {Object.keys(groundTiles).length > 0 ? `${Object.keys(groundTiles).length} tiles` : 'base: '}{GROUND_PRESETS.find(p => p.id === groundPresetId)?.name || 'Grass'}
                </span>
              </button>
              {!collapsedSections.has('ground') && (<>

              {/* Paint mode indicator */}
              {paintMode && (
                <div className="mb-2 p-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[10px] text-emerald-300 font-mono font-bold">
                      {'\u{1F3A8}'} PAINT MODE — {[...GROUND_PRESETS, ...customGroundPresets].find(p => p.id === paintBrushPresetId)?.name}
                    </div>
                    <button
                      onClick={exitPaintMode}
                      className="text-[9px] text-red-400/70 hover:text-red-300 font-mono border border-red-500/20 rounded px-1.5 py-0.5"
                    >
                      Exit
                    </button>
                  </div>
                  {/* Brush size selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-400 font-mono">Brush:</span>
                    {[1, 3, 5].map(size => (
                      <button
                        key={size}
                        onClick={() => setPaintBrushSize(size)}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition-colors ${
                          paintBrushSize === size
                            ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                            : 'text-gray-400 border border-gray-700/30 hover:text-gray-200'
                        }`}
                      >
                        {size}x{size}
                      </button>
                    ))}
                  </div>
                  <div className="text-[8px] text-gray-400 font-mono mt-1">
                    L-click: paint | R-click: erase tile | ESC: exit
                  </div>
                </div>
              )}


              {/* Ground preset palette — click to enter paint mode with that brush */}
              <div className="grid grid-cols-3 gap-2">
                {GROUND_PRESETS.map(preset => {
                  const isPaintBrush = paintMode && paintBrushPresetId === preset.id
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        if (preset.id === 'none') {
                          exitPaintMode()
                        } else {
                          enterPaintMode(preset.id)
                        }
                      }}
                      className={`rounded-lg border p-2 transition-all duration-200 text-left ${
                        isPaintBrush
                          ? 'border-emerald-400/80 bg-emerald-500/20 scale-[1.02] ring-1 ring-emerald-400/40'
                          : 'border-gray-700/30 bg-black/40 hover:border-emerald-500/30 hover:bg-emerald-500/5'
                      }`}
                      title={preset.id === 'none' ? 'Exit paint mode' : `Paint with ${preset.name}`}
                    >
                      <div
                        className="w-full aspect-square rounded-md mb-1.5 border border-white/5 overflow-hidden"
                        style={{ backgroundColor: preset.color }}
                      >
                        {preset.assetName && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={getTextureUrls(preset.assetName).diffuse}
                            alt={preset.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{preset.icon}</span>
                        <span className={`text-[10px] font-medium ${isPaintBrush ? 'text-emerald-300' : 'text-gray-400'}`}>
                          {preset.name}
                        </span>
                      </div>
                    </button>
                  )
                })}
                {/* ░▒▓ Custom textures from Imagine ▓▒░ */}
                {customGroundPresets.map(preset => {
                  const isPaintBrush = paintMode && paintBrushPresetId === preset.id
                  return (
                    <button
                      key={preset.id}
                      onClick={() => enterPaintMode(preset.id)}
                      className={`rounded-lg border p-2 transition-all duration-200 text-left ${
                        isPaintBrush
                          ? 'border-pink-400/80 bg-pink-500/20 scale-[1.02] ring-1 ring-pink-400/40'
                          : 'border-gray-700/30 bg-black/40 hover:border-pink-500/30 hover:bg-pink-500/5'
                      }`}
                      title={`Paint with ${preset.name} (custom)`}
                    >
                      <div className="w-full aspect-square rounded-md mb-1.5 border border-pink-500/10 overflow-hidden bg-gray-800">
                        {preset.customTextureUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={preset.customTextureUrl}
                            alt={preset.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{preset.icon}</span>
                        <span className={`text-[10px] font-medium truncate ${isPaintBrush ? 'text-pink-300' : 'text-gray-400'}`}>
                          {preset.name}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Tile count + clear button */}
              {Object.keys(groundTiles).length > 0 && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[9px] text-gray-400 font-mono">
                    {Object.keys(groundTiles).length} painted tiles
                  </span>
                  <button
                    onClick={clearAllGroundTiles}
                    className="text-[9px] text-red-400/60 hover:text-red-300 font-mono border border-red-500/20 rounded px-1.5 py-0.5"
                  >
                    Clear all tiles
                  </button>
                </div>
              )}
              </>)}
            </div>

            {/* ░▒▓█ LIGHTS — World illumination controls █▓▒░ */}
            <div>
              <button onClick={() => toggleSection('lights')} className="w-full flex items-center justify-between px-2.5 py-1.5 -mx-0.5 rounded-md border border-yellow-500/20 bg-yellow-950/40 hover:bg-yellow-900/30 hover:border-yellow-400/30 transition-all duration-150 group cursor-pointer mb-1.5">
                <span className="text-[11px] text-yellow-300/90 uppercase tracking-wider font-mono font-medium flex items-center gap-1.5">
                  <span className={`text-xs text-yellow-400/70 transition-transform duration-150 inline-block ${collapsedSections.has('lights') ? '' : 'rotate-90'}`}>&#9654;</span>
                  Lights
                </span>
                <span className="text-[10px] text-yellow-400/50 font-mono">
                  {worldLights.length} source{worldLights.length !== 1 ? 's' : ''}
                </span>
              </button>
              {!collapsedSections.has('lights') && (<>

              {/* ── Scene lights: ambient / hemisphere / directional / environment (inline controls) ── */}
              {worldLights.filter(l => l.type === 'ambient' || l.type === 'hemisphere' || l.type === 'directional' || l.type === 'environment').map(light => {
                // For directional: derive azimuth/elevation from position vector
                const pos = light.position || [30, 40, 20]
                const dist = Math.sqrt(pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]) || 50
                const elevation = Math.asin(Math.min(1, Math.max(-1, pos[1] / dist))) * 180 / Math.PI
                const azimuth = ((Math.atan2(pos[0], pos[2]) * 180 / Math.PI) + 360) % 360

                return (
                  <LightTooltipWrap key={light.id} type={light.type} className="relative mb-2">
                  <div className="p-2 rounded-lg border border-gray-700/30 bg-black/30">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{light.type === 'ambient' ? '🌫️' : light.type === 'hemisphere' ? '🌗' : light.type === 'environment' ? '🌐' : '☀️'}</span>
                        <span className="text-[10px] font-medium text-gray-300">
                          {light.type === 'ambient' ? 'Ambient' : light.type === 'hemisphere' ? 'Hemisphere' : light.type === 'environment' ? 'Environment (IBL)' : 'Sun'}
                        </span>
                      </div>
                      <button
                        onClick={() => removeWorldLight(light.id)}
                        className="w-5 h-5 flex items-center justify-center rounded bg-red-500/10 border border-red-500/20 text-red-400/70 hover:bg-red-500/30 hover:text-red-300 hover:border-red-400/40 text-sm font-bold transition-all"
                        title="Remove light"
                      >
                        &#215;
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {/* Color (not for environment — IBL uses preset) */}
                      {light.type !== 'environment' && (
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 font-mono w-10">{light.type === 'hemisphere' ? 'Sky' : 'Color'}</span>
                        <input
                          type="color"
                          value={light.color}
                          onChange={e => updateWorldLight(light.id, { color: e.target.value })}
                          className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent"
                        />
                        <span className="text-[8px] text-gray-400 font-mono">{light.color}</span>
                      </div>
                      )}
                      {/* Ground color (hemisphere only) */}
                      {light.type === 'hemisphere' && (
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-gray-500 font-mono w-10">Gnd</span>
                          <input
                            type="color"
                            value={light.groundColor || '#3a5f0b'}
                            onChange={e => updateWorldLight(light.id, { groundColor: e.target.value })}
                            className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent"
                          />
                          <span className="text-[8px] text-gray-400 font-mono">{light.groundColor || '#3a5f0b'}</span>
                        </div>
                      )}
                      {/* Intensity — per-type max from LIGHT_INTENSITY_MAX */}
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 font-mono w-10">Int</span>
                        <input
                          type="range"
                          min={0}
                          max={LIGHT_INTENSITY_MAX[light.type]}
                          step={LIGHT_INTENSITY_STEP[light.type]}
                          value={light.intensity}
                          onChange={e => updateWorldLight(light.id, { intensity: parseFloat(e.target.value) })}
                          className="flex-1 h-1 accent-yellow-500"
                        />
                        <span className="text-[9px] text-yellow-400/70 font-mono w-8 text-right">{light.intensity.toFixed(1)}</span>
                      </div>
                      {/* Azimuth + Elevation (directional/sun only) */}
                      {light.type === 'directional' && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-500 font-mono w-10">Azim</span>
                            <input
                              type="range"
                              min={0}
                              max={360}
                              step={1}
                              value={Math.round(azimuth)}
                              onChange={e => {
                                const a = parseFloat(e.target.value) * Math.PI / 180
                                const el = Math.round(elevation) * Math.PI / 180
                                const r = 50
                                updateWorldLight(light.id, { position: [
                                  r * Math.cos(el) * Math.sin(a),
                                  r * Math.sin(el),
                                  r * Math.cos(el) * Math.cos(a),
                                ] as [number, number, number] })
                              }}
                              className="flex-1 h-1 accent-orange-500"
                            />
                            <span className="text-[9px] text-orange-400/70 font-mono w-8 text-right">{Math.round(azimuth)}°</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-gray-500 font-mono w-10">Elev</span>
                            <input
                              type="range"
                              min={5}
                              max={90}
                              step={1}
                              value={Math.round(elevation)}
                              onChange={e => {
                                const el = parseFloat(e.target.value) * Math.PI / 180
                                const a = Math.round(azimuth) * Math.PI / 180
                                const r = 50
                                updateWorldLight(light.id, { position: [
                                  r * Math.cos(el) * Math.sin(a),
                                  r * Math.sin(el),
                                  r * Math.cos(el) * Math.cos(a),
                                ] as [number, number, number] })
                              }}
                              className="flex-1 h-1 accent-orange-500"
                            />
                            <span className="text-[9px] text-orange-400/70 font-mono w-8 text-right">{Math.round(elevation)}°</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  </LightTooltipWrap>
                )
              })}

              {/* Add scene light buttons — with styled HTML tooltips */}
              <div className="flex gap-1.5 mb-2 flex-wrap">
                <LightTooltipWrap type="directional" className="relative flex-1">
                  <button
                    onClick={() => addWorldLight('directional')}
                    className="w-full text-[9px] font-mono text-gray-500 hover:text-yellow-300 border border-gray-700/30 hover:border-yellow-500/30 rounded px-2 py-1 transition-colors"
                  >
                    + Sun
                  </button>
                </LightTooltipWrap>
                <LightTooltipWrap type="ambient" className="relative flex-1">
                  <button
                    onClick={() => addWorldLight('ambient')}
                    className="w-full text-[9px] font-mono text-gray-500 hover:text-yellow-300 border border-gray-700/30 hover:border-yellow-500/30 rounded px-2 py-1 transition-colors"
                  >
                    + Ambient
                  </button>
                </LightTooltipWrap>
                <LightTooltipWrap type="hemisphere" className="relative flex-1">
                  <button
                    onClick={() => addWorldLight('hemisphere')}
                    className="w-full text-[9px] font-mono text-gray-500 hover:text-yellow-300 border border-gray-700/30 hover:border-yellow-500/30 rounded px-2 py-1 transition-colors"
                  >
                    + Hemi
                  </button>
                </LightTooltipWrap>
                {!worldLights.some(l => l.type === 'environment') && (
                  <LightTooltipWrap type="environment" className="relative flex-1">
                    <button
                      onClick={() => addWorldLight('environment')}
                      className="w-full text-[9px] font-mono text-gray-500 hover:text-yellow-300 border border-gray-700/30 hover:border-yellow-500/30 rounded px-2 py-1 transition-colors"
                    >
                      + IBL
                    </button>
                  </LightTooltipWrap>
                )}
              </div>

              {/* ── Positional lights: point / spot (3D-placed orbs) ── */}
              <div className="text-[9px] text-gray-400 font-mono mb-1">Place in world:</div>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { type: 'point' as WorldLightType, icon: '💡', label: 'Point', desc: 'Omni glow' },
                  { type: 'spot' as WorldLightType, icon: '🔦', label: 'Spot', desc: 'Cone beam' },
                ]).map(light => (
                  <LightTooltipWrap key={light.type} type={light.type} className="relative">
                    <button
                      onClick={() => addWorldLight(light.type)}
                      className="w-full rounded-lg border border-gray-700/30 bg-black/40 hover:border-yellow-500/40 hover:bg-yellow-500/5 p-2 transition-all duration-200 text-left group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{light.icon}</span>
                        <div>
                          <div className="text-[10px] font-medium text-gray-400 group-hover:text-yellow-300 transition-colors">
                            {light.label}
                          </div>
                          <div className="text-[8px] text-gray-400">{light.desc}</div>
                        </div>
                      </div>
                    </button>
                  </LightTooltipWrap>
                ))}
              </div>

              {/* ── Existing positional lights: inline controls ── */}
              {worldLights.filter(l => l.type === 'point' || l.type === 'spot').map(light => (
                <LightTooltipWrap key={light.id} type={light.type} className="relative mt-1.5">
                <div className="p-2 rounded-lg border border-gray-700/30 bg-black/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{light.type === 'point' ? '💡' : '🔦'}</span>
                      <span className="text-[10px] font-medium text-gray-300">
                        {light.type === 'point' ? 'Point' : 'Spot'}
                      </span>
                      <span className="text-[8px] text-gray-400 font-mono">
                        ({light.position.map(v => Math.round(v)).join(', ')})
                      </span>
                    </div>
                    <button
                      onClick={() => removeWorldLight(light.id)}
                      className="text-[9px] text-red-400/50 hover:text-red-300 font-mono"
                      title="Remove light"
                    >
                      &#215;
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {/* Color */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-500 font-mono w-10">Color</span>
                      <input
                        type="color"
                        value={light.color}
                        onChange={e => updateWorldLight(light.id, { color: e.target.value })}
                        className="w-6 h-5 rounded cursor-pointer border-0 bg-transparent"
                      />
                      <span className="text-[8px] text-gray-400 font-mono">{light.color}</span>
                    </div>
                    {/* Intensity — per-type max from LIGHT_INTENSITY_MAX */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-500 font-mono w-10">Int</span>
                      <input
                        type="range"
                        min={0}
                        max={LIGHT_INTENSITY_MAX[light.type]}
                        step={LIGHT_INTENSITY_STEP[light.type]}
                        value={light.intensity}
                        onChange={e => updateWorldLight(light.id, { intensity: parseFloat(e.target.value) })}
                        className="flex-1 h-1 accent-yellow-500"
                      />
                      <span className="text-[9px] text-yellow-400/70 font-mono w-8 text-right">{light.intensity.toFixed(1)}</span>
                    </div>
                    {/* Spot angle + direction (azimuth/elevation) */}
                    {light.type === 'spot' && (() => {
                      const tgt = light.target || [0, -1, 0]
                      const tLen = Math.sqrt(tgt[0] * tgt[0] + tgt[1] * tgt[1] + tgt[2] * tgt[2]) || 1
                      const spotElev = Math.asin(Math.min(1, Math.max(-1, tgt[1] / tLen))) * 180 / Math.PI
                      const spotAzim = ((Math.atan2(tgt[0], tgt[2]) * 180 / Math.PI) + 360) % 360
                      return (<>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 font-mono w-10">Angle</span>
                        <input
                          type="range"
                          min={5}
                          max={90}
                          step={1}
                          value={light.angle ?? 45}
                          onChange={e => updateWorldLight(light.id, { angle: parseFloat(e.target.value) })}
                          className="flex-1 h-1 accent-orange-500"
                        />
                        <span className="text-[9px] text-orange-400/70 font-mono w-8 text-right">{Math.round(light.angle ?? 45)}°</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 font-mono w-10">Azim</span>
                        <input
                          type="range"
                          min={0}
                          max={360}
                          step={1}
                          value={Math.round(spotAzim)}
                          onChange={e => {
                            const a = parseFloat(e.target.value) * Math.PI / 180
                            const el = Math.round(spotElev) * Math.PI / 180
                            updateWorldLight(light.id, { target: [
                              Math.cos(el) * Math.sin(a),
                              Math.sin(el),
                              Math.cos(el) * Math.cos(a),
                            ] as [number, number, number] })
                          }}
                          className="flex-1 h-1 accent-orange-500"
                        />
                        <span className="text-[9px] text-orange-400/70 font-mono w-8 text-right">{Math.round(spotAzim)}°</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 font-mono w-10">Elev</span>
                        <input
                          type="range"
                          min={-90}
                          max={90}
                          step={1}
                          value={Math.round(spotElev)}
                          onChange={e => {
                            const el = parseFloat(e.target.value) * Math.PI / 180
                            const a = Math.round(spotAzim) * Math.PI / 180
                            updateWorldLight(light.id, { target: [
                              Math.cos(el) * Math.sin(a),
                              Math.sin(el),
                              Math.cos(el) * Math.cos(a),
                            ] as [number, number, number] })
                          }}
                          className="flex-1 h-1 accent-orange-500"
                        />
                        <span className="text-[9px] text-orange-400/70 font-mono w-8 text-right">{Math.round(spotElev)}°</span>
                      </div>
                      </>)
                    })()}
                  </div>
                </div>
                </LightTooltipWrap>
              ))}
              </>)}
            </div>


            {/* ░▒▓█ WORLD IMPORT/EXPORT █▓▒░ */}
            <div className="flex gap-2 pt-2 border-t border-gray-800/50">
              <button
                onClick={async () => {
                  const json = await exportCurrentWorld()
                  if (!json) return
                  const blob = new Blob([json], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  const worldName = worldRegistry.find(w => w.id === activeWorldId)?.name || 'world'
                  a.href = url
                  a.download = `${worldName.replace(/\s+/g, '-').toLowerCase()}.oasis.json`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="text-[10px] text-blue-400/70 hover:text-blue-300 font-mono border border-blue-500/20 rounded px-2 py-0.5"
              >
                Export world
              </button>
              <label
                className="text-[10px] text-blue-400/70 hover:text-blue-300 font-mono border border-blue-500/20 rounded px-2 py-0.5 cursor-pointer"
              >
                Import world
                <input
                  type="file"
                  accept=".json,.oasis.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = async () => {
                      const result = await importWorldFromJson(reader.result as string)
                      if (!result) setError('Failed to import world — invalid format')
                    }
                    reader.readAsText(file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>

          </div>
        ) : mode === 'assets' ? (
          previewAsset ? (
            /* ░▒▓█ 3D PREVIEW — Catalog asset █▓▒░ */
            <ModelPreviewPanel
              asset={previewAsset}
              onBack={() => {
                setPreviewAsset(null)
                requestAnimationFrame(() => {
                  if (scrollRef.current) scrollRef.current.scrollTop = savedScrollTop.current
                })
              }}
              onPlace={(a) => {
                enterPlacementMode({ type: 'catalog', catalogId: a.id, name: a.name, path: a.path, defaultScale: a.defaultScale })
                setPreviewAsset(null)
              }}
              accentColor="#EAB308"
              canvasHeight={400}
            />
          ) : previewConjured ? (
            /* ░▒▓█ 3D PREVIEW — Conjured GLB model █▓▒░ */
            <ModelPreviewPanel
              asset={{
                id: previewConjured.id,
                name: previewConjured.displayName || previewConjured.prompt.slice(0, 40),
                path: previewConjured.glbPath ? `${OASIS_BASE}${previewConjured.glbPath}` : '',
                category: 'props',
                defaultScale: previewConjured.scale ?? 1,
              }}
              onBack={() => {
                setPreviewConjured(null)
                requestAnimationFrame(() => {
                  if (scrollRef.current) scrollRef.current.scrollTop = savedScrollTop.current
                })
              }}
              onPlace={() => {
                enterPlacementMode({
                  type: 'conjured',
                  name: (previewConjured.displayName || previewConjured.prompt).slice(0, 24),
                  path: previewConjured.glbPath ? `${OASIS_BASE}${previewConjured.glbPath}` : undefined,
                  defaultScale: previewConjured.scale ?? 1,
                })
                setPreviewConjured(null)
              }}
              accentColor="#F97316"
              canvasHeight={400}
            />
          ) : previewCrafted ? (
            /* ░▒▓█ 3D PREVIEW — Crafted primitive scene █▓▒░ */
            <CraftedPreviewPanel
              scene={previewCrafted}
              onBack={() => {
                setPreviewCrafted(null)
                requestAnimationFrame(() => {
                  if (scrollRef.current) scrollRef.current.scrollTop = savedScrollTop.current
                })
              }}
              onPlace={(scene) => {
                enterPlacementMode({
                  type: 'crafted',
                  sceneId: scene.id,
                  name: scene.name,
                })
                setPreviewCrafted(null)
              }}
              accentColor="#3B82F6"
              canvasHeight={400}
            />
          ) : (
          <>
            {/* ═══════════════════════════════════════════════════════════════════
                SUB-TAB BAR — Catalog / Conjured / Crafted
                ─═̷─═̷─ Three galleries under one roof ─═̷─═̷─
                ═══════════════════════════════════════════════════════════════════ */}
            <div className="flex items-center gap-1 mb-2">
              {([
                { key: 'catalog' as const, label: 'Catalog', count: ASSET_CATALOG.length, color: 'yellow' },
                { key: 'conjured' as const, label: 'Conjured', count: conjuredAssets.filter(a => a.status === 'ready').length, color: 'orange' },
                { key: 'crafted' as const, label: 'Crafted', count: sceneLibrary.length, color: 'blue' },
                { key: 'images' as const, label: 'Images', count: generatedImages.length, color: 'pink' },
              ]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setAssetSubTab(tab.key)}
                  className={`text-[10px] px-2 py-0.5 rounded font-mono transition-colors ${
                    assetSubTab === tab.key
                      ? `bg-${tab.color}-500/20 text-${tab.color}-300 border border-${tab.color}-500/40`
                      : 'text-gray-400 border border-gray-700/30 hover:text-gray-200 hover:border-gray-600/50'
                  }`}
                  style={assetSubTab === tab.key ? {
                    background: tab.color === 'yellow' ? 'rgba(234,179,8,0.15)' : tab.color === 'orange' ? 'rgba(249,115,22,0.15)' : tab.color === 'pink' ? 'rgba(236,72,153,0.15)' : 'rgba(59,130,246,0.15)',
                    color: tab.color === 'yellow' ? '#FDE047' : tab.color === 'orange' ? '#FB923C' : tab.color === 'pink' ? '#F9A8D4' : '#93C5FD',
                    borderColor: tab.color === 'yellow' ? 'rgba(234,179,8,0.4)' : tab.color === 'orange' ? 'rgba(249,115,22,0.4)' : tab.color === 'pink' ? 'rgba(236,72,153,0.4)' : 'rgba(59,130,246,0.4)',
                  } : {}}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-1 opacity-60">{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* ░▒▓ CATALOG SUB-TAB — Pre-made Quaternius models ▓▒░ */}
            {assetSubTab === 'catalog' && (
              <>
                {/* Category filter pills + generate thumbs button */}
                <div className="flex flex-wrap gap-1 mb-2 items-center">
                  {['all', ...Array.from(new Set(ASSET_CATALOG.map(a => a.category)))].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setAssetCategory(cat)}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition-colors ${
                        assetCategory === cat
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                          : 'text-gray-400 border border-gray-700/30 hover:text-gray-200 hover:border-gray-600/50'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                  <button
                    onClick={() => catalogThumbGen.generate()}
                    disabled={catalogThumbGen.running}
                    className="ml-auto text-[9px] px-1.5 py-0.5 rounded font-mono text-yellow-500/50 border border-yellow-500/20 hover:text-yellow-400 hover:border-yellow-500/40 disabled:opacity-30 transition-colors"
                    title="Render thumbnails for all catalog assets (takes ~1 min)"
                  >
                    {catalogThumbGen.running
                      ? `${catalogThumbGen.done}/${catalogThumbGen.total}`
                      : '\u{1F4F7}'}
                  </button>
                </div>

                {/* Catalog grid — thumbnails with emoji fallback */}
                <div className="grid grid-cols-3 gap-1.5">
                  {ASSET_CATALOG
                    .filter(a => assetCategory === 'all' || a.category === assetCategory)
                    .map(asset => (
                    <button
                      key={asset.id}
                      onClick={() => {
                        if (scrollRef.current) savedScrollTop.current = scrollRef.current.scrollTop
                        setPreviewAsset(asset)
                      }}
                      className="rounded-lg border p-1.5 transition-all duration-200 text-left hover:border-yellow-500/40 hover:bg-yellow-500/5 group"
                      style={{
                        background: 'rgba(15, 15, 15, 0.8)',
                        borderColor: 'rgba(255, 255, 255, 0.06)',
                      }}
                      title={`${asset.name} (${asset.category}) — click to preview`}
                    >
                      <div className="w-full aspect-square rounded bg-black/40 flex items-center justify-center mb-1 overflow-hidden">
                        <AssetThumb
                          src={`${OASIS_BASE}/thumbs/${asset.id}.jpg`}
                          fallback={asset.category === 'enemies' ? '\u{1F916}' : asset.category === 'guns' ? '\u{1F52B}' : asset.category === 'pickups' ? '\u{1F48E}' : asset.category === 'character' ? '\u{1F9D1}' : asset.category === 'nature' ? '\u{1F332}' : asset.category === 'props' ? '\u{1F4E6}' : asset.category === 'scifi' ? '\u{1F680}' : asset.category === 'fantasy' ? '\u{1F9D9}' : asset.category === 'village' ? '\u{1F3E0}' : asset.category === 'avatar' ? '\u{1F9D1}' : '\u{1F3D7}'}
                          alt={asset.name}
                        />
                      </div>
                      <div className="text-[9px] text-gray-400 group-hover:text-gray-200 truncate transition-colors">
                        {asset.name}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ░▒▓ CONJURED SUB-TAB — Text-to-3D creations ▓▒░ */}
            {assetSubTab === 'conjured' && (
              <>
                {conjuredAssets.filter(a => a.status === 'ready').length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <div className="text-3xl mb-2">{'\u{1F52E}'}</div>
                    <div className="text-xs">No conjured assets yet</div>
                    <div className="text-[10px] mt-1 text-gray-500">Use the Conjure tab to create 3D models from text</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {[...conjuredAssets].filter(a => a.status === 'ready').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(asset => (
                      <button
                        key={asset.id}
                        onClick={() => {
                          savedScrollTop.current = scrollRef.current?.scrollTop ?? 0
                          setPreviewConjured(asset)
                        }}
                        className={`rounded-lg border p-1.5 transition-all duration-200 text-left group ${
                          worldConjuredAssetIds.includes(asset.id)
                            ? 'border-orange-500/30 bg-orange-500/5'
                            : 'hover:border-orange-500/40 hover:bg-orange-500/5'
                        }`}
                        style={{
                          background: worldConjuredAssetIds.includes(asset.id) ? undefined : 'rgba(15, 15, 15, 0.8)',
                          borderColor: worldConjuredAssetIds.includes(asset.id) ? undefined : 'rgba(255, 255, 255, 0.06)',
                        }}
                        title={`${asset.displayName || asset.prompt} — click to preview`}
                      >
                        <div className="w-full aspect-square rounded bg-black/40 flex items-center justify-center mb-1 overflow-hidden">
                          <AssetThumb
                            src={asset.thumbnailUrl
                              ? (asset.thumbnailUrl.startsWith('http') ? asset.thumbnailUrl : `${OASIS_BASE}${asset.thumbnailUrl}`)
                              : ''}
                            fallback={'\u{1F52E}'}
                            alt={asset.displayName || asset.prompt}
                          />
                        </div>
                        <div
                          className="text-[9px] text-gray-400 group-hover:text-gray-200 truncate transition-colors cursor-text"
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            const name = window.prompt('Rename asset:', asset.displayName || asset.prompt)
                            if (name && name.trim()) renameAsset(asset.id, name.trim())
                          }}
                          title="Double-click to rename"
                        >
                          {asset.displayName || asset.prompt.slice(0, 30)}
                        </div>
                        <div className="text-[8px] text-gray-400 truncate flex items-center gap-1 flex-wrap">
                          <span>{asset.provider} / {asset.tier}</span>
                          {asset.action === 'rig' && (
                            <span className="px-1 py-px rounded text-[7px] font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30">{'\u2699'} rigged</span>
                          )}
                          {asset.action === 'animate' && (
                            <span className="px-1 py-px rounded text-[7px] font-mono bg-green-500/20 text-green-400 border border-green-500/30">{'\uD83C\uDFC3'} anim</span>
                          )}
                          {asset.characterMode && !asset.action && (
                            <span className="px-1 py-px rounded text-[7px] font-mono bg-purple-500/15 text-purple-400/60">{'\uD83E\uDDCD'}</span>
                          )}
                          {worldConjuredAssetIds.includes(asset.id) && (
                            <span className="text-orange-400/60">placed</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ░▒▓ CRAFTED SUB-TAB — Global scene library (not per-world) ▓▒░ */}
            {assetSubTab === 'crafted' && (
              <>
                {sceneLibrary.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <div className="text-3xl mb-2">{'\u{1F3A8}'}</div>
                    <div className="text-xs">No crafted scenes yet</div>
                    <div className="text-[10px] mt-1 text-gray-500">Use the Craft tab to build scenes from text</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {[...sceneLibrary].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(scene => {
                      const isInWorld = craftedScenes.some(s => s.id === scene.id)
                      return (
                        <button
                          key={scene.id}
                          onClick={() => {
                            savedScrollTop.current = scrollRef.current?.scrollTop ?? 0
                            setPreviewCrafted(scene)
                          }}
                          className={`rounded-lg border p-1.5 transition-all duration-200 text-left group ${
                            isInWorld
                              ? 'border-blue-500/30 bg-blue-500/5'
                              : 'hover:border-blue-500/40 hover:bg-blue-500/5'
                          }`}
                          style={{
                            background: isInWorld ? undefined : 'rgba(15, 15, 15, 0.8)',
                            borderColor: isInWorld ? undefined : 'rgba(255, 255, 255, 0.06)',
                          }}
                          title={`${scene.name} — click to preview`}
                        >
                          <div className="w-full aspect-square rounded bg-black/40 flex items-center justify-center mb-1 overflow-hidden">
                            <AssetThumb
                              src={scene.thumbnailUrl
                                ? (scene.thumbnailUrl.startsWith('http') ? scene.thumbnailUrl : `${OASIS_BASE}${scene.thumbnailUrl}`)
                                : `${OASIS_BASE}/crafted-thumbs/${scene.id}.jpg`}
                              fallback={'\u{1F3A8}'}
                              alt={scene.name}
                            />
                          </div>
                          <div className="text-[9px] text-gray-400 group-hover:text-gray-200 truncate transition-colors">
                            {scene.name}
                          </div>
                          <div className="text-[8px] text-gray-400 truncate">
                            {scene.objects.length} primitives
                            {isInWorld && (
                              <span className="ml-1 text-blue-400/60">placed</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* ░▒▓ IMAGES SUB-TAB — Generated images from Imagine ▓▒░ */}
            {assetSubTab === 'images' && (
              <>
                {generatedImages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <div className="text-3xl mb-2">🎨</div>
                    <div className="text-xs">No generated images yet</div>
                    <div className="text-[10px] mt-1 text-gray-500">Use the Imagine tab to generate images</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    {[...generatedImages].reverse().map(img => {
                      const isPlaced = placedCatalogAssets.some(ca => ca.imageUrl === img.url)
                      return (
                        <div
                          key={img.id}
                          className={`rounded-lg border p-1.5 transition-all duration-200 text-left group cursor-pointer ${
                            isPlaced ? 'border-pink-500/30 bg-pink-500/5' : 'hover:border-pink-500/40 hover:bg-pink-500/5'
                          }`}
                          style={{
                            background: isPlaced ? undefined : 'rgba(15, 15, 15, 0.8)',
                            borderColor: isPlaced ? undefined : 'rgba(255, 255, 255, 0.06)',
                          }}
                        >
                          <div className="w-full aspect-square rounded bg-black/40 flex items-center justify-center mb-1 overflow-hidden relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt={img.prompt} className="w-full h-full object-cover" loading="lazy" />
                            {/* Hover actions */}
                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2">
                              <button
                                onClick={() => enterPlacementMode({ type: 'image', name: img.prompt.slice(0, 24), imageUrl: img.url })}
                                className="w-full text-[10px] px-2 py-1 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30 hover:bg-pink-500/30 transition-colors font-mono"
                              >
                                Place in world
                              </button>
                            </div>
                          </div>
                          <div className="text-[9px] text-gray-400 group-hover:text-gray-200 truncate transition-colors">
                            {img.prompt}
                          </div>
                          <div className="text-[8px] text-gray-400 truncate">
                            {new Date(img.createdAt).toLocaleDateString()}
                            {isPlaced && <span className="ml-1 text-pink-400/60">placed</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
          )

        ) : mode === 'placed' ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-300 uppercase tracking-widest font-mono">
                ── Placed Objects ──
              </span>
              <span className="text-[10px] text-cyan-500/60 font-mono">
                {worldConjuredAssetIds.length + placedCatalogAssets.length + craftedScenes.length + worldLights.length} total
              </span>
            </div>

            {worldConjuredAssetIds.length === 0 && placedCatalogAssets.length === 0 && craftedScenes.length === 0 && worldLights.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <div className="text-3xl mb-2">&#128203;</div>
                <div className="text-xs">No objects placed yet</div>
                <div className="text-[10px] mt-1 text-gray-500">Conjure, craft, or add from the Asset catalog</div>
              </div>
            ) : (
              <div className="space-y-1">
                {/* Conjured assets in world */}
                {worldConjuredAssetIds.map(id => {
                  const asset = conjuredAssets.find(a => a.id === id)
                  if (!asset || asset.status !== 'ready') return null
                  const isSelected = selectedObjectId === id
                  return (
                    <div
                      key={id}
                      className={`rounded-lg border p-2 flex items-center justify-between cursor-pointer transition-all duration-200 ${
                        isSelected ? 'border-blue-500/50 bg-blue-500/10' : 'border-gray-700/20 hover:border-cyan-500/30'
                      }`}
                      style={{ background: isSelected ? undefined : 'rgba(15, 15, 15, 0.8)' }}
                      onClick={() => {
                        if (isSelected) { selectObject(null); setInspectedObject(null) }
                        else {
                          selectObject(id); setInspectedObject(id)
                          const pos = transforms[id]?.position || asset?.position
                          if (pos) setCameraLookAt(pos)
                        }
                      }}
                    >
                      <div>
                        <span className="text-[10px] text-orange-400 font-mono mr-1">&#10024;</span>
                        <span className="text-[11px] text-gray-200">{(asset.displayName || asset.prompt).slice(0, 30)}{(asset.displayName || asset.prompt).length > 30 ? '...' : ''}</span>
                        <span className="text-[9px] text-gray-400 ml-1.5">{asset.provider}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeConjuredAssetFromWorld(id) }}
                        className="text-gray-500 hover:text-red-400 text-xs"
                      >
                        &#10005;
                      </button>
                    </div>
                  )
                })}

                {/* Catalog assets in world */}
                {placedCatalogAssets.map(ca => {
                  const isSelected = selectedObjectId === ca.id
                  return (
                    <div
                      key={ca.id}
                      className={`rounded-lg border p-2 flex items-center justify-between cursor-pointer transition-all duration-200 ${
                        isSelected ? 'border-blue-500/50 bg-blue-500/10' : 'border-gray-700/20 hover:border-cyan-500/30'
                      }`}
                      style={{ background: isSelected ? undefined : 'rgba(15, 15, 15, 0.8)' }}
                      onClick={() => {
                        if (isSelected) { selectObject(null); setInspectedObject(null) }
                        else {
                          selectObject(ca.id); setInspectedObject(ca.id)
                          const pos = transforms[ca.id]?.position || ca.position
                          if (pos) setCameraLookAt(pos)
                        }
                      }}
                    >
                      <div>
                        <span className={`text-[10px] font-mono mr-1 ${ca.imageUrl ? 'text-pink-400' : 'text-yellow-400'}`}>{ca.imageUrl ? '🖼️' : '📦'}</span>
                        <span className="text-[11px] text-gray-200">{ca.name}</span>
                        <span className="text-[9px] text-gray-400 ml-1.5">{ca.imageUrl ? 'image' : 'catalog'}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeCatalogAsset(ca.id) }}
                        className="text-gray-500 hover:text-red-400 text-xs"
                      >
                        &#10005;
                      </button>
                    </div>
                  )
                })}

                {/* Crafted scenes in world */}
                {craftedScenes.map(scene => {
                  const isSelected = selectedObjectId === scene.id
                  return (
                    <div
                      key={scene.id}
                      className={`rounded-lg border p-2 flex items-center justify-between cursor-pointer transition-all duration-200 ${
                        isSelected ? 'border-blue-500/50 bg-blue-500/10' : 'border-gray-700/20 hover:border-cyan-500/30'
                      }`}
                      style={{ background: isSelected ? undefined : 'rgba(15, 15, 15, 0.8)' }}
                      onClick={() => {
                        if (isSelected) { selectObject(null); setInspectedObject(null) }
                        else {
                          selectObject(scene.id); setInspectedObject(scene.id)
                          const pos = transforms[scene.id]?.position || scene.position
                          if (pos) setCameraLookAt(pos)
                        }
                      }}
                    >
                      <div>
                        <span className="text-[10px] text-blue-400 font-mono mr-1">&#9881;</span>
                        <span className="text-[11px] text-gray-200">{scene.name}</span>
                        <span className="text-[9px] text-gray-400 ml-1.5">{scene.objects.length} prims</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeCraftedScene(scene.id) }}
                        className="text-gray-500 hover:text-red-400 text-xs"
                      >
                        &#10005;
                      </button>
                    </div>
                  )
                })}

                {/* World lights */}
                {worldLights.map(light => {
                  const isSelected = selectedObjectId === light.id
                  const emoji = light.type === 'point' ? '💡' : light.type === 'spot' ? '🔦' : light.type === 'directional' ? '☀️' : light.type === 'hemisphere' ? '🌗' : light.type === 'ambient' ? '🌤️' : '🌐'
                  return (
                    <LightTooltipWrap key={light.id} type={light.type} className="relative">
                      <div
                        className={`rounded-lg border p-2 flex items-center justify-between cursor-pointer transition-all duration-200 ${
                          isSelected ? 'border-blue-500/50 bg-blue-500/10' : 'border-gray-700/20 hover:border-cyan-500/30'
                        }`}
                        style={{ background: isSelected ? undefined : 'rgba(15, 15, 15, 0.8)' }}
                        onClick={() => {
                          if (isSelected) { selectObject(null); setInspectedObject(null) }
                          else {
                            selectObject(light.id); setInspectedObject(light.id)
                            if (light.position) setCameraLookAt(light.position)
                          }
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{emoji}</span>
                          <span className="text-[11px] text-gray-200">{light.type}</span>
                          <span className="text-[9px] text-gray-400">int {light.intensity.toFixed(1)}</span>
                          <div className="w-3 h-3 rounded-full border border-gray-700/30" style={{ backgroundColor: light.color }} />
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeWorldLight(light.id) }}
                          className="text-gray-500 hover:text-red-400 text-xs"
                        >
                          &#10005;
                        </button>
                      </div>
                    </LightTooltipWrap>
                  )
                })}
              </div>
            )}
          </>

        ) : mode === 'settings' ? (
          <>
            {/* ─═̷─═̷─ SETTINGS TAB — VFX, placement, opacity ─═̷─═̷─ */}
            <div className="space-y-4">

              {/* ░▒▓ Conjuration VFX ▓▒░ */}
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-mono">Conjuration Effect</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { id: 'random' as const, label: 'Random', desc: 'Different effect each time', icon: '\u{1F3B2}' },
                    { id: 'textswirl' as const, label: 'Text Swirl', desc: 'Prompt tokens orbit and collapse', icon: '\u2728' },
                    { id: 'arcane' as const, label: 'Arcane Circle', desc: 'Sacred geometry + light pillars', icon: '\u26E2' },
                    { id: 'vortex' as const, label: 'Particle Vortex', desc: 'Atom storm converges into form', icon: '\u{1F300}' },
                    { id: 'quantumassembly' as const, label: 'Quantum Assembly', desc: 'Cube wireframe morphs to sphere', icon: '\u269B' },
                    { id: 'primordialcauldron' as const, label: 'Primordial Cauldron', desc: 'Bubbling potion overflows', icon: '\u2697' },
                    { id: 'stellarnursery' as const, label: 'Stellar Nursery', desc: 'Nebula births a star', icon: '\u2B50' },
                    { id: 'chronoforge' as const, label: 'Chrono-Forge', desc: 'Hourglass bends time itself', icon: '\u231B' },
                    { id: 'abyssalemergence' as const, label: 'Abyssal Emergence', desc: 'Dark tentacles from the void', icon: '\u{1F419}' },
                  ]).map(fx => (
                    <button
                      key={fx.id}
                      onClick={() => { setConjureVfxType(fx.id); startConjurePreview(fx.id) }}
                      className={`rounded-lg px-2 py-1.5 text-left transition-all duration-200 border ${
                        conjureVfxType === fx.id
                          ? 'border-orange-500/50 bg-orange-500/10'
                          : 'border-gray-700/30 bg-black/40 hover:border-gray-600/50'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{fx.icon}</span>
                        <span className={`text-[10px] font-medium ${conjureVfxType === fx.id ? 'text-orange-400' : 'text-gray-400'}`}>
                          {fx.label}
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-400 mt-0.5">{fx.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ░▒▓ Placement VFX ▓▒░ */}
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-mono">Placement Spell Effect</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { id: 'random' as PlacementVfxType, label: 'Random', desc: 'Different spell each time', icon: '\u{1F3B2}' },
                    { id: 'runeflash' as PlacementVfxType, label: 'Rune Flash', desc: 'Arcane circle glows on ground', icon: '\u2726' },
                    { id: 'sparkburst' as PlacementVfxType, label: 'Spark Burst', desc: '200 particles shower outward', icon: '\u2604' },
                    { id: 'portalring' as PlacementVfxType, label: 'Portal Ring', desc: 'Glowing ring rises through object', icon: '\u25CE' },
                    { id: 'sigilpulse' as PlacementVfxType, label: 'Sigil Pulse', desc: '3 expanding ripple rings', icon: '\u25C9' },
                    { id: 'quantumcollapse' as PlacementVfxType, label: 'Quantum Collapse', desc: '500 particles collapse from uncertainty', icon: '\u269B' },
                    { id: 'phoenixascension' as PlacementVfxType, label: 'Phoenix Ascension', desc: 'Fire column + wings of light', icon: '\u2748' },
                    { id: 'dimensionalrift' as PlacementVfxType, label: 'Dimensional Rift', desc: 'Void slash tears open space', icon: '\u2301' },
                    { id: 'crystalgenesis' as PlacementVfxType, label: 'Crystal Genesis', desc: 'Crystals erupt and shatter', icon: '\u2B20' },
                    { id: 'meteorimpact' as PlacementVfxType, label: 'Meteor Impact', desc: 'Fireball descends + shockwave', icon: '\u2622' },
                    { id: 'arcanebloom' as PlacementVfxType, label: 'Arcane Bloom', desc: 'Magic flower unfolds with pollen', icon: '\u2740' },
                    { id: 'voidanchor' as PlacementVfxType, label: 'Void Anchor', desc: 'Dark sphere slams + chains lock', icon: '\u2693' },
                    { id: 'stellarforge' as PlacementVfxType, label: 'Stellar Forge', desc: 'Nebula spirals birth a star', icon: '\u2605' },
                  ]).map(fx => (
                    <button
                      key={fx.id}
                      onClick={() => { setPlacementVfxType(fx.id); previewPlacementSpell(fx.id) }}
                      className={`rounded-lg px-2 py-1.5 text-left transition-all duration-200 border ${
                        placementVfxType === fx.id
                          ? 'border-yellow-500/50 bg-yellow-500/10'
                          : 'border-gray-700/30 bg-black/40 hover:border-gray-600/50'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{fx.icon}</span>
                        <span className={`text-[10px] font-medium ${placementVfxType === fx.id ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {fx.label}
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-400 mt-0.5">{fx.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ░▒▓ Placement duration slider ▓▒░ */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Spell Duration</span>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={placementVfxDuration}
                    onChange={(e) => setPlacementVfxDuration(parseFloat(e.target.value))}
                    className="flex-1 h-1 accent-yellow-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-gray-500 font-mono w-8 text-right">{placementVfxDuration.toFixed(1)}s</span>
                </div>
              </div>

              {/* ░▒▓ Panel opacity — driven by system uiOpacity setting ▓▒░ */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono whitespace-nowrap">Panel Opacity</span>
                  <div
                    className="flex-1 h-4 rounded-full bg-gray-800 cursor-pointer relative select-none"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      const rect = e.currentTarget.getBoundingClientRect()
                      const update = (clientX: number) => {
                        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
                        const v = Math.round((0.1 + pct * 0.9) * 20) / 20 // 0.1-1.0 in 0.05 steps
                        updateSetting('uiOpacity', v)
                      }
                      update(e.clientX)
                      const onMove = (ev: MouseEvent) => update(ev.clientX)
                      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
                      document.addEventListener('mousemove', onMove)
                      document.addEventListener('mouseup', onUp)
                    }}
                  >
                    {/* Track fill */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-orange-500/60"
                      style={{ width: `${((opacity - 0.1) / 0.9) * 100}%` }}
                    />
                    {/* Thumb */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-orange-400 border-2 border-orange-300 shadow-md"
                      style={{ left: `calc(${((opacity - 0.1) / 0.9) * 100}% - 6px)` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono w-8 text-right">{Math.round(opacity * 100)}%</span>
                </div>
              </div>

              {/* ░▒▓█ CRAFT MODEL SELECTOR — The silicon tongue █▓▒░ */}
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-mono">Craft / Terrain Model</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {([
                    { id: 'anthropic/claude-sonnet-4-6', label: 'Sonnet 4.6', desc: 'Best balance of speed + quality', icon: '\u2728' },
                    { id: 'anthropic/claude-haiku-4-5', label: 'Haiku 4.5', desc: 'Fast + cheap, good for iteration', icon: '\u26A1' },
                    { id: 'z-ai/glm-5', label: 'GLM-5', desc: 'ZhipuAI frontier model', icon: '\u{1F30F}' },
                    { id: 'moonshotai/kimi-k2.5', label: 'Kimi K2.5', desc: 'Moonshot\'s reasoning model', icon: '\u{1F319}' },
                  ] as const).map(m => (
                    <button
                      key={m.id}
                      onClick={() => setCraftModel(m.id)}
                      className={`rounded-lg px-2 py-1.5 text-left transition-all duration-200 border ${
                        craftModel === m.id
                          ? 'border-blue-500/50 bg-blue-500/10'
                          : 'border-gray-700/30 bg-black/40 hover:border-blue-500/30 hover:bg-blue-500/5'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{m.icon}</span>
                        <span className={`text-[10px] font-medium ${craftModel === m.id ? 'text-blue-300' : 'text-gray-400'}`}>
                          {m.label}
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-400 mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ░▒▓█ VOICE MODEL — Merlin placeholder █▓▒░ */}
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-mono">Voice Model</div>
                <div className="rounded-lg border border-gray-700/30 bg-black/40 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{'\u{1F9D9}'}</span>
                    <div>
                      <div className="text-[11px] text-purple-300/80 font-medium">Merlin v1</div>
                      <div className="text-[9px] text-gray-400">Voice-to-tool pipeline — coming soon</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[9px] text-gray-500 font-mono italic">
                    &quot;Speak thy will and the forge shall obey&quot;
                  </div>
                </div>
              </div>

            </div>
          </>

        ) : mode === 'imagine' ? (
          <ImagineTab />

        ) : mode === 'conjure' ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
                ── Asset Library ({conjuredAssets.length}) ──
              </span>
            </div>

            {conjuredAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <div className="text-3xl mb-2">&#9878;</div>
                <div className="text-xs">No objects conjured yet</div>
                <div className="text-[10px] mt-1 text-gray-500">Type a spell above and cast it</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[...conjuredAssets]
                .filter(asset => {
                  // Hide parent assets when a ready child exists (lineage collapse)
                  // e.g. hide base model when rig is ready, hide rig when animate is ready
                  const hasReadyChild = conjuredAssets.some(
                    c => c.sourceAssetId === asset.id && c.status === 'ready'
                  )
                  return !hasReadyChild
                })
                .sort((a, b) => {
                  // In-progress on tippy top, newest first within each group
                  const aActive = !['ready', 'failed'].includes(a.status) ? 1 : 0
                  const bActive = !['ready', 'failed'].includes(b.status) ? 1 : 0
                  if (bActive !== aActive) return bActive - aActive
                  // Within same group: newest first by createdAt
                  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                }).map(asset => (
                  <GalleryItem
                    key={asset.id}
                    asset={asset}
                    onDelete={deleteAsset}
                    isInWorld={worldConjuredAssetIds.includes(asset.id)}
                    onPlace={(id) => {
                      const a = conjuredAssets.find(c => c.id === id)
                      if (!a || !a.glbPath) return
                      enterPlacementMode({
                        type: 'conjured',
                        name: (a.displayName || a.prompt).slice(0, 24),
                        path: `${OASIS_BASE}${a.glbPath}`,
                        defaultScale: a.scale ?? 1,
                      })
                    }}
                    onRemove={removeConjuredAssetFromWorld}
                    onTexture={(id) => processAsset(id, 'texture').catch((e: Error) => setError(e.message))}
                    onRemesh={(id, quality) => {
                      const preset = REMESH_PRESETS[quality]
                      processAsset(id, 'remesh', { targetPolycount: preset.polycount, topology: 'quad' }).catch((e: Error) => setError(e.message))
                    }}
                    onRig={(id) => processAsset(id, 'rig').catch((e: Error) => setError(e.message))}
                    onRename={renameAsset}
                    pricing={pricing}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
                ── Crafted Scenes ({craftedScenes.length}) ──
              </span>
            </div>

            {/* Craft conversation history */}
            {craftHistory.length > 0 && (
              <div className="mb-2 space-y-1 max-h-32 overflow-y-auto">
                {craftHistory.map((msg, i) => (
                  <div key={i} className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    msg.role === 'user'
                      ? 'text-blue-300/70 bg-blue-500/5'
                      : 'text-green-300/70 bg-green-500/5'
                  }`}>
                    <span className="text-gray-400">{msg.role === 'user' ? 'you' : 'llm'}:</span> {msg.content}
                  </div>
                ))}
              </div>
            )}

            {craftedScenes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <div className="text-3xl mb-2">&#9881;</div>
                <div className="text-xs">No scenes crafted yet</div>
                <div className="text-[10px] mt-1 text-gray-500">Describe a scene and the LLM will build it from primitives</div>
                <div className="text-[10px] mt-1 text-blue-500/40">Iterative: each new craft builds on the last</div>
              </div>
            ) : (
              <div className="space-y-2">
                {craftedScenes.map(scene => (
                  <div
                    key={scene.id}
                    className="rounded-lg border p-2 group transition-all duration-200 hover:border-blue-500/30"
                    style={{
                      background: 'rgba(20, 20, 20, 0.8)',
                      borderColor: 'rgba(59, 130, 246, 0.15)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-blue-300 font-medium">{scene.name}</span>
                      <button
                        onClick={() => removeCraftedScene(scene.id)}
                        className="text-gray-400 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove from world (stays in library)"
                      >
                        &#10005;
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {scene.objects.length} primitive{scene.objects.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ─═̷─═̷─ SCENE LIBRARY — The permanent archive ─═̷─═̷─ */}
            {sceneLibrary.length > 0 && (
              <>
                <div className="flex items-center justify-between mt-4 mb-2">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
                    ── Library ({sceneLibrary.length}) ──
                  </span>
                </div>
                <div className="space-y-1.5">
                  {sceneLibrary.map(scene => {
                    const isInWorld = craftedScenes.some(s => s.id === scene.id)
                    return (
                      <div
                        key={scene.id}
                        className="rounded-lg border p-2 group transition-all duration-200 hover:border-purple-500/30 flex items-center justify-between"
                        style={{
                          background: 'rgba(15, 15, 20, 0.8)',
                          borderColor: isInWorld ? 'rgba(59, 130, 246, 0.2)' : 'rgba(128, 90, 213, 0.15)',
                        }}
                      >
                        <div>
                          <span className="text-[11px] text-purple-300/80 font-medium">{scene.name}</span>
                          <span className="text-[9px] text-gray-400 ml-2">
                            {scene.objects.length} obj{scene.objects.length !== 1 ? 's' : ''}
                          </span>
                          {isInWorld && (
                            <span className="text-[8px] text-blue-400/50 ml-1.5">in world</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => enterPlacementMode({ type: 'library', sceneId: scene.id, name: scene.name })}
                            className="text-[9px] text-emerald-400/70 hover:text-emerald-300 font-mono border border-emerald-500/20 rounded px-1.5 py-0.5"
                            title="Place a copy in current world (click-to-place)"
                          >
                            + place
                          </button>
                          <button
                            onClick={() => deleteFromLibrary(scene.id)}
                            className="text-[9px] text-red-400/50 hover:text-red-400 font-mono"
                            title="Delete permanently from library"
                          >
                            &#10005;
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ─═̷─═̷─ RESIZE HANDLE ─═̷─═̷─ */}
      <div
        className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex-shrink-0"
        onMouseDown={handleResizeStart}
        style={{
          background: `linear-gradient(135deg, transparent 50%, ${forgeColor}44 50%)`,
        }}
      />
    </div>,
    document.body
  )
}

// ▓▓▓▓【W̸I̸Z̸A̸R̸D̸】▓▓▓▓ॐ▓▓▓▓【C̸O̸N̸S̸O̸L̸E̸】▓▓▓▓ॐ▓▓▓▓【F̸O̸R̸G̸E̸】▓▓▓▓
