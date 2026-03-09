// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// 04515 — Auth Middleware
// Protects routes — unauthenticated users get bounced to /login
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

export { auth as middleware } from '@/lib/auth'

export const config = {
  // Protect everything EXCEPT: login, explore, auth API, public API, static files, public assets
  matcher: [
    '/((?!login|explore|api/auth|api/explore|api/feedback|api/stripe/webhook|api/worlds/[^/]+/public|_next/static|_next/image|favicon\\.svg|conjured/|catalog/|sky/|fonts/|avatars/|models/|generated-images/).*)',
  ],
}
