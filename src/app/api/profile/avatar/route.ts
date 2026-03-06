// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// 04515 — Avatar Upload API
// POST /api/profile/avatar — save profile pic to disk, update DB
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getServerSupabase } from '@/lib/supabase'
import path from 'path'
import fs from 'fs/promises'

const MAX_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('avatar') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, WebP, or GIF.' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 2MB)' }, { status: 400 })
    }

    // Determine extension
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png',
      'image/webp': 'webp', 'image/gif': 'gif',
    }
    const ext = extMap[file.type] || 'jpg'
    const filename = `${session.user.id}.${ext}`

    // Ensure avatars directory exists
    const avatarDir = path.join(process.cwd(), 'public', 'avatars')
    await fs.mkdir(avatarDir, { recursive: true })

    // Clean up any previous avatar with different extension
    for (const e of ['jpg', 'png', 'webp', 'gif']) {
      if (e !== ext) {
        const old = path.join(avatarDir, `${session.user.id}.${e}`)
        await fs.unlink(old).catch(() => {})
      }
    }

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(path.join(avatarDir, filename), buffer)

    // Update DB
    const avatarUrl = `/avatars/${filename}`
    await getServerSupabase()
      .from('profiles')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', session.user.id)

    console.log(`[Avatar] Saved ${filename} for user ${session.user.id}`)
    return NextResponse.json({ avatar_url: avatarUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Avatar] Upload error:', msg)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
