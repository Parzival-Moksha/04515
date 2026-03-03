// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// 04515 — Profile API
// GET /api/profile — returns credits, xp, level from Supabase
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getServerSupabase } from '@/lib/supabase'
import { FREE_CREDITS } from '@/lib/conjure/types'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await getServerSupabase()
      .from('profiles')
      .select('credits, xp, level, wallet_address')
      .eq('id', session.user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ credits: FREE_CREDITS, xp: 0, level: 1, wallet_address: null })
    }

    return NextResponse.json(data)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Profile] GET error:', msg)
    return NextResponse.json({ credits: FREE_CREDITS, xp: 0, level: 1, wallet_address: null })
  }
}
