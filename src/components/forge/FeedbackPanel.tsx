'use client'

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// ANORAK 0.0.1 — Feedback Portal
// Bug reports + feature requests. Public. +10 XP per submission.
// "The community shapes the engine."
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { useState, useRef, useEffect, useCallback, useContext } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { SettingsContext } from '../scene-lib'
import { awardXp } from '@/hooks/useXp'

interface FeedbackItem {
  id: number
  user_id: string
  user_name: string
  user_avatar: string | null
  type: 'bug' | 'feature'
  title: string
  body: string | null
  status: 'open' | 'shipped' | 'wontfix'
  upvotes: number
  created_at: string
}

type Tab = 'list' | 'submit'
type FilterType = 'all' | 'bug' | 'feature'

const DEFAULT_POS = { x: 16, y: 320 }
const ADMIN_ID = process.env.NEXT_PUBLIC_ADMIN_USER_ID || ''
const STATUS_CYCLE: ('open' | 'shipped' | 'wontfix')[] = ['open', 'shipped', 'wontfix']

export function FeedbackPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.id === ADMIN_ID
  const { settings } = useContext(SettingsContext)
  const [tab, setTab] = useState<Tab>('list')
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(false)

  // Submit form state
  const [submitType, setSubmitType] = useState<'bug' | 'feature'>('bug')
  const [submitTitle, setSubmitTitle] = useState('')
  const [submitBody, setSubmitBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Dragging
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_POS
    try {
      const saved = localStorage.getItem('oasis-feedback-pos')
      return saved ? JSON.parse(saved) : DEFAULT_POS
    } catch { return DEFAULT_POS }
  })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    if ((e.target as HTMLElement).closest('input')) return
    if ((e.target as HTMLElement).closest('textarea')) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }
  }, [position])

  const handleDrag = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    const newPos = { x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }
    setPosition(newPos)
    localStorage.setItem('oasis-feedback-pos', JSON.stringify(newPos))
  }, [isDragging])

  const handleDragEnd = useCallback(() => setIsDragging(false), [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDrag)
      document.addEventListener('mouseup', handleDragEnd)
    }
    return () => {
      document.removeEventListener('mousemove', handleDrag)
      document.removeEventListener('mouseup', handleDragEnd)
    }
  }, [isDragging, handleDrag, handleDragEnd])

  // Fetch feedback
  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('type', filter)
      const res = await fetch(`/api/feedback?${params}`)
      const data = await res.json()
      setItems(data.items || [])
    } catch {} finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    if (isOpen) fetchItems()
  }, [isOpen, fetchItems])

  const handleSubmit = async () => {
    if (!submitTitle.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: submitType,
          title: submitTitle.trim(),
          body: submitBody.trim() || null,
        }),
      })
      if (res.ok) {
        setSubmitSuccess(true)
        setSubmitTitle('')
        setSubmitBody('')
        // Award XP client-side (shows float)
        awardXp('SUBMIT_FEEDBACK')
        // Refresh list
        setTimeout(() => {
          setTab('list')
          setSubmitSuccess(false)
          fetchItems()
        }, 1500)
      }
    } catch (err) {
      console.error('[Anorak] Submit failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSetStatus = async (itemId: number, currentStatus: string) => {
    if (!isAdmin) return
    const nextIdx = (STATUS_CYCLE.indexOf(currentStatus as typeof STATUS_CYCLE[number]) + 1) % STATUS_CYCLE.length
    const nextStatus = STATUS_CYCLE[nextIdx]
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, status: nextStatus }),
      })
      if (res.ok) {
        setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: nextStatus } : it))
      }
    } catch {}
  }

  if (!isOpen || typeof document === 'undefined') return null

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    } catch { return '' }
  }

  const statusColors: Record<string, string> = {
    open: 'text-yellow-400',
    shipped: 'text-green-400',
    wontfix: 'text-gray-500',
  }

  return createPortal(
    <div
      data-menu-portal="feedback-panel"
      className="fixed z-[9996] rounded-xl flex flex-col"
      style={{
        left: position.x,
        top: position.y,
        width: 360,
        height: 480,
        backgroundColor: `rgba(0, 0, 0, ${settings.uiOpacity})`,
        border: '1px solid rgba(249,115,22,0.3)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}
    >
      {/* Header */}
      <div
        onMouseDown={handleDragStart}
        className="flex items-center justify-between px-3 py-2 border-b border-white/10 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-orange-400">
            🔮 Anorak
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setTab('list')}
              className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${tab === 'list' ? 'bg-orange-500/20 text-orange-300' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Feed
            </button>
            <button
              onClick={() => { setTab('submit'); setSubmitSuccess(false) }}
              className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${tab === 'submit' ? 'bg-orange-500/20 text-orange-300' : 'text-gray-400 hover:text-gray-200'}`}
            >
              + Submit
            </button>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xs cursor-pointer">
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'list' && (
          <>
            {/* Filter row */}
            <div className="flex gap-1 px-3 py-2 border-b border-white/5">
              {(['all', 'bug', 'feature'] as FilterType[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-0.5 rounded text-[10px] cursor-pointer ${filter === f ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  {f === 'all' ? 'All' : f === 'bug' ? '🐛 Bugs' : '✨ Features'}
                </button>
              ))}
            </div>

            {/* Items */}
            <div className="px-3 py-2 space-y-2">
              {loading && items.length === 0 && (
                <p className="text-center text-gray-400 text-xs mt-4">Loading...</p>
              )}
              {!loading && items.length === 0 && (
                <p className="text-center text-gray-400 text-xs mt-4">
                  No feedback yet. Be the first!
                </p>
              )}
              {items.map(item => (
                <div
                  key={item.id}
                  className="rounded-lg p-2.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs mt-0.5">
                      {item.type === 'bug' ? '🐛' : '✨'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white font-medium leading-tight">{item.title}</p>
                      {item.body && (
                        <p className="text-[10px] text-gray-300 mt-1 line-clamp-2">{item.body}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[9px] text-gray-400">{item.user_name}</span>
                        <span className="text-[9px] text-gray-500">{formatDate(item.created_at)}</span>
                        {isAdmin ? (
                          <button
                            onClick={() => handleSetStatus(item.id, item.status)}
                            className={`text-[9px] font-medium cursor-pointer hover:underline ${statusColors[item.status] || 'text-gray-500'}`}
                            title="Click to cycle: open → shipped → wontfix"
                          >
                            {item.status} ⟳
                          </button>
                        ) : (
                          <span className={`text-[9px] font-medium ${statusColors[item.status] || 'text-gray-500'}`}>
                            {item.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'submit' && (
          <div className="px-4 py-4 space-y-3">
            {submitSuccess ? (
              <div className="text-center py-8">
                <p className="text-green-400 font-medium text-sm">Submitted! +10 XP</p>
                <p className="text-gray-400 text-xs mt-1">Thanks for shaping the Oasis.</p>
              </div>
            ) : (
              <>
                {/* Type selector */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSubmitType('bug')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      submitType === 'bug'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:text-gray-200'
                    }`}
                  >
                    🐛 Bug Report
                  </button>
                  <button
                    onClick={() => setSubmitType('feature')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      submitType === 'feature'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-white/5 text-gray-400 border border-white/10 hover:text-gray-200'
                    }`}
                  >
                    ✨ Feature Request
                  </button>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-[10px] text-gray-300 uppercase tracking-wider mb-1">
                    {submitType === 'bug' ? 'What broke?' : 'What would you love?'}
                  </label>
                  <input
                    value={submitTitle}
                    onChange={e => setSubmitTitle(e.target.value)}
                    maxLength={100}
                    placeholder={submitType === 'bug' ? 'Describe the bug...' : 'Describe the feature...'}
                    className="w-full px-3 py-2 rounded-lg text-white text-xs outline-none placeholder-gray-600"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}
                    autoFocus
                  />
                </div>

                {/* Body */}
                <div>
                  <label className="block text-[10px] text-gray-300 uppercase tracking-wider mb-1">
                    Details <span className="text-gray-500">(optional)</span>
                  </label>
                  <textarea
                    value={submitBody}
                    onChange={e => setSubmitBody(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder="Steps to reproduce, context, ideas..."
                    className="w-full px-3 py-2 rounded-lg text-white text-xs outline-none resize-none placeholder-gray-600"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!submitTitle.trim() || submitting}
                  className="w-full py-2.5 rounded-lg text-white text-xs font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ background: submitTitle.trim() ? 'linear-gradient(135deg, #EA580C, #C2410C)' : 'rgba(255,255,255,0.1)' }}
                >
                  {submitting ? 'Submitting...' : `Submit ${submitType === 'bug' ? 'Bug Report' : 'Feature Request'} (+10 XP)`}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
