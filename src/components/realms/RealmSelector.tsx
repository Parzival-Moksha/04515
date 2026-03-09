'use client'

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// REALM SELECTOR — The gate between worlds
// Top-center overlay: switch between forge worlds
// +New World creates a new empty forge world and drops you in
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { useState, useRef, useEffect, useCallback } from 'react'
import { useOasisStore } from '../../store/oasisStore'
import type { WorldVisibility } from '@/lib/xp'

const WORLD_ICONS = ['🌍', '🌋', '🏔️', '🌊', '🏜️', '🌌', '🪐', '🌙', '🏰', '⛩️']
const VISIBILITY_OPTIONS: { value: WorldVisibility; icon: string; label: string; desc: string }[] = [
  { value: 'private', icon: '🔒', label: 'Private', desc: 'Only you' },
  { value: 'unlisted', icon: '🔗', label: 'Unlisted', desc: 'Link only' },
  { value: 'public', icon: '🌐', label: 'Public', desc: 'Read-only' },
  { value: 'public_edit', icon: '✏️', label: 'Open Build', desc: 'Anyone edits' },
]
const VISIBILITY_ICONS: Record<WorldVisibility, string> = Object.fromEntries(
  VISIBILITY_OPTIONS.map(o => [o.value, o.icon])
) as Record<WorldVisibility, string>

export function RealmSelector() {
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showNewWorld, setShowNewWorld] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('🌍')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const activeWorldId = useOasisStore(s => s.activeWorldId)
  const worldRegistry = useOasisStore(s => s.worldRegistry)
  const switchWorld = useOasisStore(s => s.switchWorld)
  const createNewWorld = useOasisStore(s => s.createNewWorld)
  const deleteWorldById = useOasisStore(s => s.deleteWorldById)
  const refreshWorldRegistry = useOasisStore(s => s.refreshWorldRegistry)
  const isViewMode = useOasisStore(s => s.isViewMode)
  const viewingWorldMeta = useOasisStore(s => s.viewingWorldMeta)

  // Visibility state (cached locally, synced from worldRegistry.visibility)
  const [visibilityMap, setVisibilityMap] = useState<Record<string, WorldVisibility>>({})

  // Seed visibility from registry
  useEffect(() => {
    const map: Record<string, WorldVisibility> = {}
    for (const w of worldRegistry) map[w.id] = w.visibility || 'private'
    setVisibilityMap(map)
  }, [worldRegistry])

  // Which world has its visibility dropdown open
  const [visDropdownId, setVisDropdownId] = useState<string | null>(null)

  const setVisibility = useCallback(async (worldId: string, next: WorldVisibility) => {
    const current = visibilityMap[worldId] || 'private'
    setVisDropdownId(null)
    if (next === current) return
    // Optimistic update
    setVisibilityMap(prev => ({ ...prev, [worldId]: next }))
    try {
      await fetch(`/api/worlds/${worldId}/visibility`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: next }),
      })
    } catch {
      // Revert on failure
      setVisibilityMap(prev => ({ ...prev, [worldId]: current }))
    }
  }, [visibilityMap])

  useEffect(() => setMounted(true), [])

  // Close dropdown on outside click
  useEffect(() => {
    if (!expanded) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExpanded(false)
        setShowNewWorld(false)
        setVisDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expanded])

  // Focus name input when "new world" form opens
  useEffect(() => {
    if (showNewWorld && nameInputRef.current) {
      nameInputRef.current.focus()
    }
  }, [showNewWorld])

  // Focus rename input when it opens
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const handleRename = useCallback(async (worldId: string) => {
    const name = renameValue.trim()
    if (!name) { setRenamingId(null); return }
    try {
      await fetch(`/api/worlds/${worldId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      refreshWorldRegistry()
    } catch { /* silent */ }
    setRenamingId(null)
  }, [renameValue, refreshWorldRegistry])

  const handleCreateWorld = () => {
    const name = newName.trim()
    if (!name) return
    createNewWorld(name, newIcon)
    setNewName('')
    setNewIcon('🌍')
    setShowNewWorld(false)
    setExpanded(false)
  }

  // Current world label — show viewed world when in view mode
  const currentWorld = worldRegistry.find(w => w.id === activeWorldId)
  const currentLabel = isViewMode && viewingWorldMeta
    ? { icon: viewingWorldMeta.icon, name: viewingWorldMeta.name, color: '#A855F7' }  // purple for viewing
    : { icon: currentWorld?.icon || '🔥', name: currentWorld?.name || 'The Forge', color: '#F97316' }

  return (
    <div
      ref={dropdownRef}
      className="ui-overlay fixed top-4 left-1/2 -translate-x-1/2 z-[100] select-none"
      style={{ pointerEvents: 'auto' }}
    >
      {/* ─═̷─ Current world indicator ─═̷─ */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="group flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300"
        style={{
          background: 'rgba(0,0,0,0.7)',
          border: `1px solid ${currentLabel.color}44`,
          backdropFilter: 'blur(12px)',
          boxShadow: expanded ? `0 0 20px ${currentLabel.color}33` : 'none',
        }}
        suppressHydrationWarning
      >
        <span className="text-lg" suppressHydrationWarning>{mounted ? currentLabel.icon : '🔥'}</span>
        <span
          className="text-sm font-bold tracking-widest uppercase"
          style={{ color: currentLabel.color }}
          suppressHydrationWarning
        >
          {mounted ? currentLabel.name : 'The Forge'}
        </span>
        <span
          className="text-xs transition-transform duration-200"
          style={{
            color: currentLabel.color,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ▼
        </span>
      </button>

      {/* ─═̷─ Dropdown ─═̷─ */}
      {expanded && (
        <div
          className="mt-1 rounded-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            background: 'rgba(0,0,0,0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(16px)',
            minWidth: '260px',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {/* View mode banner — shows when viewing another user's world */}
          {isViewMode && viewingWorldMeta && (
            <div className="px-4 py-2.5 border-b border-purple-500/20 bg-purple-900/10">
              <div className="flex items-center gap-2">
                {viewingWorldMeta.creator_avatar && (
                  <img src={viewingWorldMeta.creator_avatar} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
                )}
                <div className="text-xs">
                  <span className="text-purple-400">Viewing </span>
                  <span className="text-white font-medium">{viewingWorldMeta.icon} {viewingWorldMeta.name}</span>
                  {viewingWorldMeta.creator_name && (
                    <span className="text-gray-500"> by {viewingWorldMeta.creator_name}</span>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-gray-600 mt-1">Click any of your worlds below to exit</p>
            </div>
          )}

          {/* Explore link */}
          <button
            onClick={() => { window.open('/explore', '_blank'); setExpanded(false) }}
            className="w-full px-4 py-2.5 flex items-center gap-2 text-sm text-purple-400 hover:bg-purple-500/10 transition-colors border-b border-white/5"
          >
            <span>🌐</span>
            <span>Explore Worlds</span>
          </button>

          <div className="px-4 py-2">
            <span className="text-[10px] text-gray-600 uppercase tracking-wider">Your Worlds</span>
          </div>

          {/* FORGE WORLDS from registry */}
          {worldRegistry.map(world => {
            const isActive = activeWorldId === world.id
            const isRenaming = renamingId === world.id
            return (
              <div key={world.id} className="group flex items-center">
                {isRenaming ? (
                  <div className="flex-1 flex items-center gap-2 px-4 py-2">
                    <span className="text-lg">{world.icon}</span>
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(world.id); if (e.key === 'Escape') setRenamingId(null) }}
                      onBlur={() => handleRename(world.id)}
                      className="flex-1 bg-black/50 border border-orange-500/40 rounded px-2 py-1 text-sm text-white focus:outline-none"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => { switchWorld(world.id); setExpanded(false) }}
                    onDoubleClick={(e) => { e.stopPropagation(); setRenamingId(world.id); setRenameValue(world.name) }}
                    className="flex-1 flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 hover:bg-white/5"
                    style={{
                      borderLeft: isActive ? '3px solid #F97316' : '3px solid transparent',
                    }}
                    title="Double-click to rename"
                  >
                    <span className="text-lg">{world.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: isActive ? '#F97316' : '#ccc' }}>
                        {world.name}
                      </div>
                      <div className="text-[10px] text-gray-600">
                        {new Date(world.lastSavedAt).toLocaleDateString()}
                      </div>
                    </div>
                    {isActive && (
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#F97316' }} />
                    )}
                  </button>
                )}
                {/* Rename button */}
                <button
                  onClick={(e) => { e.stopPropagation(); setRenamingId(world.id); setRenameValue(world.name) }}
                  className="opacity-0 group-hover:opacity-70 hover:!opacity-100 px-1.5 py-1 text-xs transition-opacity"
                  title="Rename world"
                >
                  ✏️
                </button>
                {/* Visibility dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setVisDropdownId(visDropdownId === world.id ? null : world.id) }}
                    className="opacity-0 group-hover:opacity-70 hover:!opacity-100 px-1.5 py-1 text-xs transition-opacity"
                    title={`${visibilityMap[world.id] || 'private'} — click to change`}
                  >
                    {VISIBILITY_ICONS[visibilityMap[world.id] || 'private']}
                  </button>
                  {visDropdownId === world.id && (
                    <div
                      className="absolute right-0 top-full mt-1 z-50 rounded-lg overflow-hidden shadow-xl"
                      style={{ background: 'rgba(15,15,15,0.97)', border: '1px solid rgba(255,255,255,0.12)', minWidth: '160px' }}
                      onClick={e => e.stopPropagation()}
                    >
                      {VISIBILITY_OPTIONS.map(opt => {
                        const isActive = (visibilityMap[world.id] || 'private') === opt.value
                        return (
                          <button
                            key={opt.value}
                            onClick={() => setVisibility(world.id, opt.value)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
                              isActive ? 'bg-purple-600/20 text-purple-300' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                            }`}
                          >
                            <span className="text-sm">{opt.icon}</span>
                            <div>
                              <div className="font-medium">{opt.label}</div>
                              <div className="text-[10px] text-gray-600">{opt.desc}</div>
                            </div>
                            {isActive && <span className="ml-auto text-purple-400 text-[10px]">●</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                {/* Delete button (not for default world) */}
                {worldRegistry.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Delete world "${world.name}"?`)) {
                        deleteWorldById(world.id)
                      }
                    }}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 px-2 py-1 text-red-500 text-xs transition-opacity"
                    title="Delete world"
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}

          {/* +NEW WORLD */}
          <div className="border-t border-white/5">
            {showNewWorld ? (
              <div className="p-3 space-y-2">
                {/* Icon picker */}
                <div className="flex gap-1 flex-wrap">
                  {WORLD_ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setNewIcon(icon)}
                      className="w-7 h-7 text-sm rounded transition-all"
                      style={{
                        background: newIcon === icon ? 'rgba(249,115,22,0.3)' : 'transparent',
                        border: newIcon === icon ? '1px solid #F97316' : '1px solid transparent',
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                {/* Name input */}
                <input
                  ref={nameInputRef}
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateWorld(); if (e.key === 'Escape') setShowNewWorld(false) }}
                  placeholder="World name..."
                  className="w-full bg-black/50 border border-orange-500/30 rounded px-2 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/60"
                />
                {/* Create / Cancel */}
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateWorld}
                    disabled={!newName.trim()}
                    className="flex-1 py-1.5 rounded text-xs font-bold transition-all disabled:opacity-30"
                    style={{ background: 'rgba(249,115,22,0.3)', color: '#F97316' }}
                  >
                    Create World
                  </button>
                  <button
                    onClick={() => setShowNewWorld(false)}
                    className="px-3 py-1.5 rounded text-xs text-gray-500 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewWorld(true)}
                className="w-full px-4 py-3 text-center text-sm text-orange-500/60 hover:text-orange-400 hover:bg-white/5 transition-all"
              >
                + New World
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
