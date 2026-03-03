// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// 04515 — Stripe Webhook
// POST /api/stripe/webhook — handles checkout.session.completed
// Verifies signature, credits the user's Supabase profile.
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(req: Request) {
  const stripe = getStripe()
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[Stripe] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Stripe] Webhook signature verification failed:', msg)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId = session.metadata?.userId
    const credits = parseInt(session.metadata?.credits ?? '0', 10)

    if (!userId || credits <= 0) {
      console.error('[Stripe] Webhook missing metadata:', { userId, credits })
      return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 })
    }

    // Credit the user — atomic increment via RPC or read-then-write
    const sb = getServerSupabase()
    const { data: profile } = await sb
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single()

    const currentCredits = profile?.credits ?? 0
    const { error: updateError } = await sb
      .from('profiles')
      .update({ credits: currentCredits + credits, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (updateError) {
      console.error('[Stripe] Credit update failed:', updateError.message)
      return NextResponse.json({ error: 'Credit update failed' }, { status: 500 })
    }

    console.log(`[Stripe] ✓ Credited ${credits} to user ${userId} (${currentCredits} → ${currentCredits + credits})`)
  }

  return NextResponse.json({ received: true })
}
