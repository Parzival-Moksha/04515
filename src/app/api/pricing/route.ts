// Public pricing endpoint — returns current prices for authenticated users
// Client components use this to show credit costs in real-time

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getPricing } from '@/lib/pricing'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pricing = await getPricing()
  return NextResponse.json({ pricing })
}
