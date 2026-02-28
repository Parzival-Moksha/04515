// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// THE FORGE — Thumbnail Upload Route
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
//
//   PUT /api/conjure/[id]/thumbnail — Upload a generated JPEG thumbnail
//   Body: multipart/form-data with 'thumbnail' file field
//
//   The client renders the GLB offscreen and sends the JPEG here.
//   We save it to public/conjured/{id}_thumb.jpg and update the registry.
//
// ░▒▓█ A face for every creation █▓▒░
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import { NextResponse } from 'next/server'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { getAssetById, updateAsset } from '@/lib/conjure/registry'

function ensureConjuredDir(): string {
  const dir = join(process.cwd(), 'public', 'conjured')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const asset = getAssetById(id)
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('thumbnail') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No thumbnail file provided' }, { status: 400 })
    }

    // ░▒▓ Save the JPEG to public/conjured/ ▓▒░
    const dir = ensureConjuredDir()
    const filename = `${id}_thumb.jpg`
    const destPath = join(dir, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    writeFileSync(destPath, buffer)

    // ░▒▓ Update registry with local path ▓▒░
    const thumbnailUrl = `/conjured/${filename}`
    updateAsset(id, { thumbnailUrl })

    console.log(`[Forge:Thumbs] Saved thumbnail for ${id} (${(buffer.length / 1024).toFixed(0)} KB)`)

    return NextResponse.json({ thumbnailUrl })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[Forge] PUT thumbnail error:', errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
