// Admin XP Awards API — GET/PATCH dynamic XP config
// Protected by ADMIN_USER_ID check (mirrors /api/admin/pricing)

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getServerSupabase } from '@/lib/supabase'
import { DEFAULT_XP_AWARDS } from '@/lib/xp'

const ADMIN_USER_ID = process.env.ADMIN_USER_ID || ''

async function isAdmin() {
  const session = await auth()
  return session?.user?.id === ADMIN_USER_ID && !!ADMIN_USER_ID
}

// GET — return current XP awards config
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data } = await getServerSupabase()
    .from('app_config')
    .select('value, updated_at')
    .eq('key', 'xp_awards')
    .single()

  return NextResponse.json({
    xpAwards: data?.value ?? DEFAULT_XP_AWARDS,
    defaults: DEFAULT_XP_AWARDS,
    updatedAt: data?.updated_at ?? null,
  })
}

// PATCH — update XP awards config (partial update, merges with existing)
export async function PATCH(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Validate all values are non-negative integers
  const updates: Record<string, number> = {}
  for (const [key, val] of Object.entries(body)) {
    if (typeof val !== 'number' || val < 0 || !Number.isInteger(val)) {
      return NextResponse.json({ error: `Invalid value for ${key}: must be a non-negative integer` }, { status: 400 })
    }
    updates[key] = val
  }

  // Read current, merge, write
  const sb = getServerSupabase()
  const { data: existing } = await sb
    .from('app_config')
    .select('value')
    .eq('key', 'xp_awards')
    .single()

  const merged = { ...(existing?.value as Record<string, number> || DEFAULT_XP_AWARDS), ...updates }

  const { error } = await sb
    .from('app_config')
    .upsert({
      key: 'xp_awards',
      value: merged,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    return NextResponse.json({ error: 'Failed to update XP awards' }, { status: 500 })
  }

  return NextResponse.json({ xpAwards: merged })
}
