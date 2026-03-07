'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const PRICE_LABELS: Record<string, { label: string; group: string }> = {
  conjure_meshy_preview: { label: 'Meshy Grey (preview)', group: 'Conjure' },
  conjure_meshy_refine: { label: 'Meshy Textured (refine)', group: 'Conjure' },
  conjure_tripo_turbo: { label: 'Tripo Turbo', group: 'Conjure' },
  conjure_tripo_draft: { label: 'Tripo v2.0', group: 'Conjure' },
  conjure_tripo_standard: { label: 'Tripo v2.5', group: 'Conjure' },
  conjure_tripo_premium: { label: 'Tripo v3.1 (premium)', group: 'Conjure' },
  post_texture: { label: 'Post-process: Texture', group: 'Post-Processing' },
  post_remesh: { label: 'Post-process: Remesh', group: 'Post-Processing' },
  post_rig: { label: 'Post-process: Rig', group: 'Post-Processing' },
  post_animate: { label: 'Post-process: Animate', group: 'Post-Processing' },
  craft: { label: 'LLM Craft', group: 'LLM' },
  terrain: { label: 'LLM Terrain', group: 'LLM' },
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [pricing, setPricing] = useState<Record<string, number>>({})
  const [defaults, setDefaults] = useState<Record<string, number>>({})
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') {
      fetch('/api/admin/pricing')
        .then(r => r.ok ? r.json() : Promise.reject('Forbidden'))
        .then(data => {
          setPricing(data.pricing)
          setDefaults(data.defaults)
          // Initialize editing values
          const edits: Record<string, string> = {}
          for (const key of Object.keys(data.pricing)) {
            edits[key] = String(data.pricing[key])
          }
          setEditing(edits)
          setLoading(false)
        })
        .catch(() => {
          setMessage('Access denied — admin only')
          setLoading(false)
        })
    }
  }, [status, router])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    const updates: Record<string, number> = {}
    let hasChanges = false
    for (const [key, val] of Object.entries(editing)) {
      const num = parseFloat(val)
      if (isNaN(num) || num < 0) {
        setMessage(`Invalid value for ${PRICE_LABELS[key]?.label || key}`)
        setSaving(false)
        return
      }
      if (num !== pricing[key]) {
        updates[key] = num
        hasChanges = true
      }
    }

    if (!hasChanges) {
      setMessage('No changes to save')
      setSaving(false)
      return
    }

    const res = await fetch('/api/admin/pricing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

    if (res.ok) {
      const data = await res.json()
      setPricing(data.pricing)
      setMessage('Pricing updated successfully')
    } else {
      setMessage('Failed to save')
    }
    setSaving(false)
  }

  const handleReset = (key: string) => {
    setEditing(prev => ({ ...prev, [key]: String(defaults[key] ?? 0) }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-500 font-mono text-sm">Loading admin panel...</div>
      </div>
    )
  }

  if (message === 'Access denied — admin only') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-red-400 font-mono text-sm">{message}</div>
      </div>
    )
  }

  // Group pricing items
  const groups = new Map<string, string[]>()
  for (const [key, meta] of Object.entries(PRICE_LABELS)) {
    if (!groups.has(meta.group)) groups.set(meta.group, [])
    groups.get(meta.group)!.push(key)
  }

  return (
    <div className="min-h-screen bg-black text-gray-200 p-6 font-mono">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl text-orange-400 font-bold tracking-wider">
            04515 Admin Dashboard
          </h1>
          <span className="text-[10px] text-gray-600">
            {session?.user?.email}
          </span>
        </div>

        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <div className="bg-gray-900/50 px-4 py-2 border-b border-gray-800 flex items-center justify-between">
            <span className="text-sm text-gray-400">Credit Pricing</span>
            <span className="text-[9px] text-gray-600">1 credit = $1</span>
          </div>

          {Array.from(groups.entries()).map(([groupName, keys]) => (
            <div key={groupName}>
              <div className="px-4 py-1.5 bg-gray-900/30 border-b border-gray-800/50">
                <span className="text-[10px] text-purple-400/70 uppercase tracking-widest">{groupName}</span>
              </div>
              {keys.map(key => {
                const meta = PRICE_LABELS[key]
                const isChanged = editing[key] !== String(pricing[key])
                return (
                  <div key={key} className="px-4 py-2 border-b border-gray-800/30 flex items-center gap-3 hover:bg-gray-900/20">
                    <span className="text-xs text-gray-400 flex-1">{meta.label}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editing[key] ?? '0'}
                      onChange={e => setEditing(prev => ({ ...prev, [key]: e.target.value }))}
                      className={`w-20 text-right text-xs bg-black/60 border rounded px-2 py-1 focus:outline-none ${
                        isChanged
                          ? 'border-orange-500/50 text-orange-300'
                          : 'border-gray-700/30 text-gray-300'
                      }`}
                    />
                    <span className="text-[10px] text-gray-600 w-6">cr</span>
                    {isChanged && (
                      <button
                        onClick={() => handleReset(key)}
                        className="text-[9px] text-gray-600 hover:text-gray-400"
                        title="Reset to default"
                      >
                        reset
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30 disabled:opacity-50 transition-all"
          >
            {saving ? 'Saving...' : 'Save Pricing'}
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 rounded-lg text-sm text-gray-500 border border-gray-700/30 hover:border-gray-600/50 transition-all"
          >
            Back to Oasis
          </button>
          {message && (
            <span className={`text-xs ${message.includes('success') ? 'text-green-400' : 'text-amber-400'}`}>
              {message}
            </span>
          )}
        </div>

        <div className="mt-6 text-[9px] text-gray-700 font-mono">
          Pricing changes take effect within 60 seconds (server cache TTL).
          <br />
          Credits column now supports 0.01 resolution.
        </div>
      </div>
    </div>
  )
}
