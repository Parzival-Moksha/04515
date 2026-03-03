// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// 04515 — Auth Middleware
// Protects routes — unauthenticated users get bounced to /login
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

export { auth as middleware } from '@/lib/auth'

export const config = {
  // Protect everything EXCEPT: login page, auth API, static files, favicon, public assets
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon\\.svg|conjured/|catalog/|sky/).*)',
  ],
}
