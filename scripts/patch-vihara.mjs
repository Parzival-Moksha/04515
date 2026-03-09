// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// Vihara Patch — fix wall rotations + OM text
// km_wall is a flat slab: needs [-PI/2, 0, 0] to stand
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import https from 'https'

const WORLD_ID = 'world-1773026698976-vhara'
const SUPABASE_URL = 'https://sdydklaoulmjppdthqwm.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkeWRrbGFvdWxtanBwZHRocXdtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjUwMTU1NiwiZXhwIjoyMDg4MDc3NTU2fQ.oB8lBB1hU_HJzkkfnmJjX0pn3BJ-GLexFfjMFhN0oek'
const PI2 = Math.PI / 2

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      method,
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
    }
    const req = https.request(`${SUPABASE_URL}${path}`, opts, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }))
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

// ── Fetch current world ──────────────────────────────
const { body: rows } = await request('GET', `/rest/v1/worlds?id=eq.${WORLD_ID}&select=data`)
const worldData = rows[0].data

console.log('Fetched world. Placements:', worldData.catalogPlacements.length)

// ── Fix wall rotations ───────────────────────────────
// km_wall lays flat (face pointing UP). Rotate -PI/2 around X to stand vertical.
// N/S walls run along X-axis → rotation [-PI/2, 0, 0]
// E/W walls run along Z-axis → rotation [-PI/2, PI/2, 0]
const wallFixCount = { ns: 0, ew: 0 }

worldData.catalogPlacements = worldData.catalogPlacements.map(p => {
  if (p.catalogId !== 'km_wall') return p

  const [x, , z] = p.position
  const isEW = Math.abs(Math.abs(x) - 8) < 0.5  // East or West wall (x ≈ ±8)

  if (isEW) {
    wallFixCount.ew++
    return { ...p, rotation: [-PI2, PI2, 0] }
  } else {
    wallFixCount.ns++
    return { ...p, rotation: [-PI2, 0, 0] }
  }
})

console.log(`Fixed walls: ${wallFixCount.ns} N/S + ${wallFixCount.ew} E/W`)

// ── Fix OM text → "OM" (ASCII, 3D font doesn't do Devanagari) ───────────────
let textFixed = 0
worldData.craftedScenes = worldData.craftedScenes.map(scene => ({
  ...scene,
  objects: scene.objects.map(obj => {
    if (obj.type === 'text' && obj.text === 'ॐ') {
      textFixed++
      return { ...obj, text: 'OM', fontSize: 1.8, emissiveIntensity: 3.0 }
    }
    return obj
  })
}))

console.log(`Fixed text primitives: ${textFixed}`)

// ── Also sink the columns slightly — km_column may float ──────────────────
worldData.catalogPlacements = worldData.catalogPlacements.map(p => {
  if (p.catalogId === 'km_column') {
    return { ...p, position: [p.position[0], -0.3, p.position[2]] }
  }
  return p
})

// ── PATCH back to Supabase ───────────────────────────
const now = new Date().toISOString()
worldData.savedAt = now

const { status } = await request(
  'PATCH',
  `/rest/v1/worlds?id=eq.${WORLD_ID}`,
  { data: worldData, updated_at: now }
)

console.log('PATCH status:', status)
if (status === 200 || status === 204) {
  console.log('✅ Vihara patched — walls should now stand vertical')
} else {
  console.log('❌ Patch failed')
}
