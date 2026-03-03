// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// 04515 — Stripe Checkout Session
// POST /api/stripe/checkout — creates a Stripe checkout session for a credit pack
// Redirects user to Stripe-hosted payment page, returns on success/cancel.
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getStripe } from '@/lib/stripe'
import { CREDIT_PACKS } from '@/lib/conjure/types'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const packId = body.packId as string

    const pack = CREDIT_PACKS.find(p => p.id === packId)
    if (!pack) {
      return NextResponse.json({ error: 'Invalid pack' }, { status: 400 })
    }

    const stripe = getStripe()
    const origin = process.env.NEXTAUTH_URL || 'http://localhost:4515'

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: session.user.email ?? undefined,
      metadata: {
        userId: session.user.id,
        packId: pack.id,
        credits: String(pack.credits),
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: pack.priceUsd,
            product_data: {
              name: `${pack.credits} Forge Credits`,
              description: `${pack.credits} credits for 3D conjuring on The Oasis`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/?credits=success`,
      cancel_url: `${origin}/?credits=cancelled`,
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Stripe] Checkout error:', msg)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
