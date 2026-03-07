'use client'

// Ready Player Me Avatar Creator — iframe-based avatar design
// User designs their avatar, RPM returns a GLB URL, we save it to profile

import { useState, useRef, useEffect, useCallback, useContext } from 'react'
import { createPortal } from 'react-dom'
import { SettingsContext } from '../scene-lib'

const RPM_SUBDOMAIN = 'the-oasis'
const RPM_URL = `https://${RPM_SUBDOMAIN}.readyplayer.me/avatar?frameApi`

interface AvatarCreatorProps {
  onAvatarReady: (glbUrl: string) => void
  onClose: () => void
}

export function AvatarCreator({ onAvatarReady, onClose }: AvatarCreatorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loading, setLoading] = useState(true)
  const { settings } = useContext(SettingsContext)

  const handleMessage = useCallback((event: MessageEvent) => {
    // RPM sends messages from its iframe
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data

      // RPM frame API events
      if (data.source === 'readyplayerme') {
        if (data.eventName === 'v1.frame.ready') {
          // Frame is loaded — send config
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({
              target: 'readyplayerme',
              type: 'setup',
              data: {
                bodyType: 'fullbody',
                quickStart: false,
              },
            }),
            '*'
          )
          setLoading(false)
        }

        if (data.eventName === 'v1.avatar.exported') {
          // Avatar created! data.data.url contains the GLB URL
          const glbUrl = data.data?.url
          if (glbUrl && typeof glbUrl === 'string') {
            // Append render params for better quality
            const finalUrl = glbUrl.endsWith('.glb') ? glbUrl : `${glbUrl}.glb`
            onAvatarReady(finalUrl)
          }
        }
      }
    } catch {
      // Not a JSON message or not from RPM — ignore
    }
  }, [onAvatarReady])

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

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

        {/* Loading overlay */}
        {loading && (
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
            <div style={{ color: '#A855F7', fontSize: 14, fontFamily: 'monospace' }}>
              Loading avatar creator...
            </div>
          </div>
        )}

        {/* RPM iframe */}
        <iframe
          ref={iframeRef}
          src={RPM_URL}
          style={{
            width: '100%',
            height: 'calc(100% - 44px)',
            border: 'none',
          }}
          allow="camera *; microphone *; clipboard-write"
          title="Ready Player Me Avatar Creator"
        />
      </div>
    </div>,
    document.body
  )
}
