// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// 04515 — Auth Config (NextAuth v5)
// JWT sessions, Google OAuth. Supabase user sync on sign-in.
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { getServerSupabase } from './supabase'
import { FREE_CREDITS } from '@/lib/conjure/types'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    // Middleware uses this to decide: allow or redirect to login
    authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user
      const isOnLogin = request.nextUrl.pathname.startsWith('/login')

      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL('/', request.nextUrl))
        return true
      }

      return isLoggedIn
    },
    // On every sign-in: upsert user to Supabase profiles table
    async signIn({ user, account, profile }) {
      try {
        const sb = getServerSupabase()
        const userId = profile?.sub || user.id
        // Check if user already exists — don't overwrite credits on re-login
        const { data: existing } = await sb.from('profiles').select('id').eq('id', userId).single()
        if (existing) {
          // Returning user — update Google fields only
          // DON'T overwrite avatar_url (user may have uploaded a custom one)
          await sb.from('profiles').update({
            email: user.email,
            name: user.name,
            provider: account?.provider || 'google',
            updated_at: new Date().toISOString(),
          }).eq('id', userId)
        } else {
          // New user — grant free credits
          await sb.from('profiles').insert({
            id: userId,
            email: user.email,
            name: user.name,
            avatar_url: user.image,
            provider: account?.provider || 'google',
            credits: FREE_CREDITS,
            updated_at: new Date().toISOString(),
          })
        }
      } catch (err) {
        // Don't block sign-in if DB is down — graceful degradation
        console.error('[Auth] Supabase user sync failed:', err)
      }
      return true
    },
    // Attach user id to the session so client components can use it
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.id = profile.sub
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})
