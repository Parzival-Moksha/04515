// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// OASIS - Next.js Configuration
// The 3D engine where words become matter
// ─═̷─═̷─🔥─═̷─═̷─ Standalone mode — no longer nested in Parzival monorepo ─═̷─═̷─🔥─═̷─═̷─
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile Three.js packages
  transpilePackages: ['three'],

  // Allow loading models from external sources if needed
  images: {
    unoptimized: true,
  },

  // Expose empty basePath to client code — root-served, no /oasis prefix
  env: {
    NEXT_PUBLIC_BASE_PATH: '',
  },
}

export default nextConfig
