// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// 04515 — Auth Config (NextAuth v5)
// JWT sessions, Google OAuth. Supabase user sync on sign-in.
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { getServerSupabase } from './supabase'

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
        await sb.from('profiles').upsert({
          id: profile?.sub || user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.image,
          provider: account?.provider || 'google',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })
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
