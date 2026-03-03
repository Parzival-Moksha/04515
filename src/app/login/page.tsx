'use client'

// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// 04515 — Login Gate
// The door to the Oasis. Google OAuth for now, wallet connect later.
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { signIn, useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import Image from 'next/image'

function LoginContent() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const error = searchParams.get('error')
  const { status } = useSession()
  const router = useRouter()

  // Client-side redirect if already authenticated
  // (Belt-and-suspenders with middleware — middleware should catch this,
  //  but NextAuth v5 beta has edge cases with static pages)
  useEffect(() => {
    if (status === 'authenticated') router.replace('/')
  }, [status, router])

  if (status === 'authenticated') return null

  return (
    <main className="w-full h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-8 max-w-sm w-full px-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/favicon.svg"
            alt="Oasis"
            width={80}
            height={80}
            className="opacity-90"
          />
          <h1 className="text-3xl font-bold tracking-wider text-white"
            style={{ fontFamily: "'Courier New', monospace", textShadow: '0 0 20px rgba(168, 85, 247, 0.5)' }}>
            THE OASIS
          </h1>
          <p className="text-gray-500 text-sm text-center">
            Text-to-3D world builder
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="w-full p-3 border border-red-500/50 rounded bg-red-500/10 text-red-400 text-sm text-center">
            {error === 'OAuthSignin' ? 'Could not start sign-in. Check OAuth config.' :
             error === 'OAuthCallback' ? 'Sign-in callback failed.' :
             error === 'OAuthAccountNotLinked' ? 'Email already linked to another account.' :
             'Something went wrong. Try again.'}
          </div>
        )}

        {/* Sign in buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => signIn('google', { callbackUrl })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded border border-gray-700 bg-gray-900 hover:bg-gray-800 hover:border-gray-500 transition-all text-white text-sm cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Wallet connect placeholder — coming soon */}
          <button
            disabled
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded border border-gray-800 bg-gray-950 text-gray-600 text-sm cursor-not-allowed"
            title="Coming soon — Base wallet connect"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="6" width="20" height="12" rx="2"/>
              <path d="M16 12h.01"/>
            </svg>
            Connect Wallet (coming soon)
          </button>
        </div>

        {/* Footer */}
        <p className="text-gray-700 text-xs text-center">
          04515.xyz
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="w-full h-screen bg-black flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    }>
      <LoginContent />
    </Suspense>
  )
}
