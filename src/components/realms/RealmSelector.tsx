'use client'

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// REALM SELECTOR — The gate between worlds
// Top-center overlay: switch between forge worlds
// +New World creates a new empty forge world and drops you in
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { useState, useRef, useEffect } from 'react'
import { useOasisStore } from '../../store/oasisStore'

const WORLD_ICONS = ['🌍', '🌋', '🏔️', '🌊', '🏜️', '🌌', '🪐', '🌙', '🏰', '⛩️']

export function RealmSelector() {
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showNewWorld, setShowNewWorld] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('🌍')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const activeWorldId = useOasisStore(s => s.activeWorldId)
  const worldRegistry = useOasisStore(s => s.worldRegistry)
  const switchWorld = useOasisStore(s => s.switchWorld)
  const createNewWorld = useOasisStore(s => s.createNewWorld)
  const deleteWorldById = useOasisStore(s => s.deleteWorldById)

  useEffect(() => setMounted(true), [])

  // Close dropdown on outside click
  useEffect(() => {
    if (!expanded) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExpanded(false)
        setShowNewWorld(false)
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

  const handleCreateWorld = () => {
    const name = newName.trim()
    if (!name) return
    createNewWorld(name, newIcon)
    setNewName('')
    setNewIcon('🌍')
    setShowNewWorld(false)
    setExpanded(false)
  }

  // Current world label
  const currentWorld = worldRegistry.find(w => w.id === activeWorldId)
  const currentLabel = { icon: currentWorld?.icon || '🔥', name: currentWorld?.name || 'The Forge', color: '#F97316' }

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
          <div className="px-4 py-2">
            <span className="text-[10px] text-gray-600 uppercase tracking-wider">Forge Worlds</span>
          </div>

          {/* FORGE WORLDS from registry */}
          {worldRegistry.map(world => {
            const isActive = activeWorldId === world.id
            return (
              <div key={world.id} className="group flex items-center">
                <button
                  onClick={() => { switchWorld(world.id); setExpanded(false) }}
                  className="flex-1 flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 hover:bg-white/5"
                  style={{
                    borderLeft: isActive ? '3px solid #F97316' : '3px solid transparent',
                  }}
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
