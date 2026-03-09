// pricing.ts — Dynamic pricing from Supabase app_config
// Falls back to hardcoded defaults if config unavailable

import { getServerSupabase } from './supabase'

// Hardcoded defaults — used when DB config is missing or on first boot
const DEFAULT_PRICING: Record<string, number> = {
  conjure_meshy_preview: 1,
  conjure_meshy_refine: 1,
  conjure_tripo_turbo: 0.50,
  conjure_tripo_draft: 0.50,
  conjure_tripo_standard: 0.75,
  conjure_tripo_premium: 1,
  post_texture: 0.50,
  post_remesh: 0.25,
  post_rig: 0.75,
  post_animate: 0.25,
  craft: 0.05,   // LLM craft — fallback only; real price set in /admin dashboard
  terrain: 0.05, // LLM terrain — fallback only; real price set in /admin dashboard
  imagine: 0.05, // Gemini text-to-image — fallback only; real price set in /admin dashboard
  free_credits: 3, // Credits granted to new signups
}

// Cache pricing for 60s to avoid hammering DB on every request
let cachedPricing: Record<string, number> | null = null
let cacheExpiry = 0

export async function getPricing(): Promise<Record<string, number>> {
  if (cachedPricing && Date.now() < cacheExpiry) return cachedPricing

  try {
    const { data } = await getServerSupabase()
      .from('app_config')
      .select('value')
      .eq('key', 'pricing')
      .single()

    if (data?.value && typeof data.value === 'object') {
      cachedPricing = { ...DEFAULT_PRICING, ...(data.value as Record<string, number>) }
      cacheExpiry = Date.now() + 60_000
      return cachedPricing
    }
  } catch {
    // DB unavailable — use defaults
  }

  return DEFAULT_PRICING
}

/** Get cost for a specific pricing key. Returns 0 if key not found. */
export async function getPrice(key: string): Promise<number> {
  const pricing = await getPricing()
  return pricing[key] ?? 0
}

/** Get conjure cost for a specific provider + tier combo */
export async function getConjurePrice(provider: string, tier: string): Promise<number> {
  return getPrice(`conjure_${provider}_${tier}`)
}

/** Deduct credits from a user. Returns { success, newBalance } */
export async function deductCredits(
  userId: string,
  amount: number,
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const sb = getServerSupabase()
  const { data: profile } = await sb
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single()

  const current = profile?.credits ?? 0
  if (current < amount) {
    return { success: false, newBalance: current, error: 'Insufficient credits' }
  }

  const newBalance = Math.round((current - amount) * 100) / 100

  const { error } = await sb
    .from('profiles')
    .update({ credits: newBalance })
    .eq('id', userId)
    .gte('credits', amount) // Optimistic concurrency guard

  if (error) {
    return { success: false, newBalance: current, error: error.message }
  }

  return { success: true, newBalance }
}

export { DEFAULT_PRICING }
