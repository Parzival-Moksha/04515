// POST /api/profile/avatar3d — save 3D avatar GLB from Avaturn
// Accepts: { url: string, urlType: 'dataURL' | 'httpURL' }
// dataURL → decode base64, save to disk, store local path
// httpURL → store the URL directly

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getServerSupabase } from '@/lib/supabase'
import path from 'path'
import fs from 'fs/promises'

const MAX_GLB_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { url, urlType } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing avatar URL' }, { status: 400 })
    }

    let avatar3dUrl: string

    if (urlType === 'dataURL' && url.startsWith('data:')) {
      // Data URL — decode and save GLB to disk
      const matches = url.match(/^data:([^;]+);base64,(.+)$/)
      if (!matches) {
        return NextResponse.json({ error: 'Invalid data URL format' }, { status: 400 })
      }

      const base64Data = matches[2]
      const buffer = Buffer.from(base64Data, 'base64')

      if (buffer.length > MAX_GLB_SIZE) {
        return NextResponse.json({ error: 'Avatar GLB too large (max 10MB)' }, { status: 400 })
      }

      // Save to public/avatars/{userId}_3d.glb
      const avatarDir = path.join(process.cwd(), 'public', 'avatars')
      await fs.mkdir(avatarDir, { recursive: true })

      const filename = `${session.user.id}_3d.glb`
      await fs.writeFile(path.join(avatarDir, filename), buffer)

      avatar3dUrl = `/avatars/${filename}`
      console.log(`[Avatar3D] Saved ${filename} (${(buffer.length / 1024).toFixed(0)}KB) for user ${session.user.id}`)
    } else if (url.startsWith('https://')) {
      // HTTP URL — store directly (Avaturn CDN or similar)
      avatar3dUrl = url.slice(0, 2000)
    } else {
      return NextResponse.json({ error: 'Invalid avatar URL type' }, { status: 400 })
    }

    // Update DB
    await getServerSupabase()
      .from('profiles')
      .update({ avatar_3d_url: avatar3dUrl, updated_at: new Date().toISOString() })
      .eq('id', session.user.id)

    return NextResponse.json({ avatar_3d_url: avatar3dUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Avatar3D] Error:', msg)
    return NextResponse.json({ error: 'Failed to save 3D avatar' }, { status: 500 })
  }
}
