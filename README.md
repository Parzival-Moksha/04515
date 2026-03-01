# 04515 — The Oasis

**Conjure 3D worlds from text. Build. Paint. Persist.**

A standalone 3D world builder with AI-powered text-to-3D conjuring, terrain painting, procedural terrain generation, and full world persistence. Built with Next.js 14 + React Three Fiber + Three.js + Zustand.

## Quick Start

```bash
git clone https://github.com/Parzival-Moksha/04515.git
cd 04515
pnpm install
```

Create a `.env` file with at least one API key:

```env
MESHY_API_KEY=your_key_here       # meshy.ai — text-to-3D + rigging + animation
TRIPO_API_KEY=your_key_here       # tripo3d.ai — text-to-3D (fast)
OPENROUTER_API_KEY=your_key_here  # openrouter.ai — LLM craft + terrain generation
```

Then run:

```bash
pnpm dev
```

Open [http://localhost:4515](http://localhost:4515)

## What You Can Do

- **Conjure** — Type a prompt, get a 3D model. Multiple providers (Meshy, Tripo, Rodin) with different quality tiers.
- **Animate** — Rig and animate conjured characters. Walk cycles, idle animations, custom motion.
- **Paint** — Paint ground textures tile-by-tile with real-time brush. Grass, stone, sand, lava, and more.
- **Terrain** — Describe a landscape in natural language, get procedural terrain with height maps and vertex-colored biomes.
- **Craft** — LLM-powered scene generation. Describe a scene, get procedural geometry.
- **Build** — Place, move, rotate, scale any object. 100+ built-in cyberpunk assets. Full transform gizmos.
- **Light** — Add point lights, spotlights, hemisphere lights. Full color, intensity, shadow control.
- **Persist** — Every change autosaves. Create multiple worlds, switch between them.
- **Sky** — 16 sky environments: 4 local HDRIs + 10 drei presets (dawn, sunset, forest, city, etc.)

## Controls

| Key | Action |
|-----|--------|
| WASD | Move camera |
| Mouse drag | Look around |
| Scroll | Zoom |
| W / E / R | Translate / Rotate / Scale (when object selected) |
| Escape | Deselect / Cancel placement |
| Delete | Remove selected object |
| Right-click ground | Send animated character to position (RTS-style) |

## Architecture

```
src/
  components/
    Scene.tsx              — Main R3F canvas, sky, post-processing
    forge/
      WizardConsole.tsx    — The command center (conjure, craft, assets, settings)
      WorldObjects.tsx     — Renders all placed objects + placement system
      ConjuredObject.tsx   — Individual GLB renderer with spawn VFX
  store/
    oasisStore.ts          — Zustand state (worlds, assets, UI)
  lib/
    conjure/               — Provider clients (Meshy, Tripo, Rodin) + registry
    forge/                 — World persistence, terrain generator
  app/
    api/                   — Next.js API routes (conjure, craft, terrain, worlds)
data/
  conjured-registry.json   — Asset metadata (GLB paths, providers, thumbnails)
  worlds/                  — World save files (JSON per world)
  scene-library.json       — Saved crafted scenes
public/
  conjured/                — Runtime-generated GLB files
  models/                  — Built-in asset library (Quaternius Cyberpunk Kit)
  hdri/                    — Sky environment textures
  textures/                — Ground painting textures
```

## Requirements

- Node.js 18+
- pnpm (recommended) or npm
- At least one API key (Meshy, Tripo, or OpenRouter)

## API Keys

| Provider | What For | Get Key |
|----------|----------|---------|
| [Meshy](https://meshy.ai) | Text-to-3D, image-to-3D, rigging, animation | Dashboard > API Keys |
| [Tripo](https://tripo3d.ai) | Text-to-3D, image-to-3D (fast) | Dashboard > API |
| [OpenRouter](https://openrouter.ai) | LLM craft + terrain generation | Dashboard > Keys |

You need at least one 3D provider key (Meshy or Tripo) to conjure. OpenRouter enables terrain and craft features.

## Default World

The repo ships with a showcase world (`forge-default`) containing:
- Oasis logo (image-to-3D)
- Walking character (animated, right-click to move)
- Maitreya shrine, Pixie Amazon, Moana boat
- Cyberpunk street lights
- Painted stone/grass circular plaza
- Venice sunset sky

## License

MIT

---

Built by [Parzival-Moksha](https://github.com/Parzival-Moksha) with vibes, sweat, and Claude.
