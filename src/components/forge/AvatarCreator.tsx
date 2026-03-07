'use client'

// Avaturn Avatar Creator — SDK-managed iframe for avatar design
// User designs their avatar, Avaturn returns a GLB URL, we save it to profile
// Replaced Ready Player Me (shut down Jan 31, 2026) with Avaturn (free, unlimited)

import { useState, useRef, useEffect, useContext } from 'react'
import { createPortal } from 'react-dom'
import { SettingsContext } from '../scene-lib'
import { AvaturnSDK } from '@avaturn/sdk'

// Demo subdomain works without API key — register at developer.avaturn.me for production
const AVATURN_URL = 'https://demo.avaturn.dev'

interface AvatarCreatorProps {
  onAvatarReady: (glbUrl: string) => void
  onClose: () => void
}

export function AvatarCreator({ onAvatarReady, onClose }: AvatarCreatorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sdkRef = useRef<AvaturnSDK | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { settings } = useContext(SettingsContext)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const sdk = new AvaturnSDK()
    sdkRef.current = sdk

    sdk.init(container, {
      url: AVATURN_URL,
      iframeClassName: 'avaturn-iframe',
    }).then(() => {
      setLoading(false)

      sdk.on('export', (data) => {
        // data.url is either a dataURL (base64) or httpURL
        // data.urlType tells us which
        if (data.url) {
          onAvatarReady(data.url)
        }
      })

      sdk.on('error', (data) => {
        console.error('[Avaturn] Error:', data.type, data.message)
        setError(data.message || 'Avatar creator error')
      })
    }).catch((err) => {
      console.error('[Avaturn] Init failed:', err)
      setError('Failed to load avatar creator')
      setLoading(false)
    })

    return () => {
      sdk.destroy()
      sdkRef.current = null
    }
  // onAvatarReady is stable (useCallback in parent), safe to include
  }, [onAvatarReady])

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.8)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: '90vw',
          maxWidth: 900,
          height: '85vh',
          borderRadius: 16,
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid rgba(168,85,247,0.4)',
          boxShadow: '0 0 60px rgba(168,85,247,0.2)',
          backgroundColor: `rgba(10, 5, 20, ${settings.uiOpacity})`,
          display: 'flex',
          flexDirection: 'column' as const,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(0,0,0,0.5)',
          flexShrink: 0,
        }}>
          <span style={{ color: '#A855F7', fontWeight: 'bold', fontSize: 14, letterSpacing: '0.1em' }}>
            CREATE YOUR AVATAR
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Close
          </button>
        </div>

        {/* Loading / Error overlay */}
        {(loading || error) && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            background: 'rgba(0,0,0,0.6)',
            top: 44,
          }}>
            <div style={{ color: error ? '#EF4444' : '#A855F7', fontSize: 14, fontFamily: 'monospace', textAlign: 'center' }}>
              {error || 'Loading avatar creator...'}
              {error && (
                <button
                  onClick={onClose}
                  style={{
                    display: 'block',
                    margin: '12px auto 0',
                    padding: '6px 16px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 6,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        )}

        {/* Avaturn SDK container — SDK manages its own iframe inside this div */}
        <div
          ref={containerRef}
          style={{ flex: 1, width: '100%', position: 'relative' }}
        />
      </div>

      {/* Global styles for the Avaturn iframe */}
      <style>{`
        .avaturn-iframe {
          width: 100% !important;
          height: 100% !important;
          border: none !important;
        }
      `}</style>
    </div>,
    document.body
  )
}
