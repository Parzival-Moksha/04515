// Admin Pricing API — GET/PATCH dynamic pricing config
// Protected by ADMIN_USER_ID check

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getServerSupabase } from '@/lib/supabase'
import { DEFAULT_PRICING } from '@/lib/pricing'

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || ''

async function isAdmin() {
  const session = await auth()
  return session?.user?.id === ADMIN_USER_ID && !!ADMIN_USER_ID
}

// GET — return current pricing config
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data } = await getServerSupabase()
    .from('app_config')
    .select('value, updated_at')
    .eq('key', 'pricing')
    .single()

  return NextResponse.json({
    pricing: data?.value ?? DEFAULT_PRICING,
    defaults: DEFAULT_PRICING,
    updatedAt: data?.updated_at ?? null,
  })
}

// PATCH — update pricing config (partial update, merges with existing)
export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Validate all values are positive numbers
  const updates: Record<string, number> = {}
  for (const [key, val] of Object.entries(body)) {
    if (typeof val !== 'number' || val < 0) {
      return NextResponse.json({ error: `Invalid value for ${key}: must be a non-negative number` }, { status: 400 })
    }
    updates[key] = Math.round(val * 100) / 100
  }

  // Read current, merge, write
  const sb = getServerSupabase()
  const { data: existing } = await sb
    .from('app_config')
    .select('value')
    .eq('key', 'pricing')
    .single()

  const merged = { ...(existing?.value as Record<string, number> || DEFAULT_PRICING), ...updates }

  const { error } = await sb
    .from('app_config')
    .upsert({
      key: 'pricing',
      value: merged,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    return NextResponse.json({ error: 'Failed to update pricing' }, { status: 500 })
  }

  return NextResponse.json({ pricing: merged })
}
