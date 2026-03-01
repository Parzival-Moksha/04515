// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
// 04515 — Scene Constants
// Configuration data for the 3D visualization
// ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

import type { OasisSettings, AssetDefinition } from './types'

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════

export const defaultSettings: OasisSettings = {
  bloomEnabled: true,
  vignetteEnabled: true,
  chromaticEnabled: false,
  showOrbitTarget: true,      // Show orbit pivot sphere
  skyBackground: 'night007',
  uiOpacity: 0.95,
  // ─═̷─═̷─⚡ FPS COUNTER ─═̷─═̷─⚡
  fpsCounterEnabled: true,
  fpsCounterFontSize: 14,
  // ─═̷─═̷─🪟 WINDOW OPACITY ─═̷─═̷─🪟
  streamOpacity: 0.9,
  // ─═̷─═̷─🎮 QUAKE FPS CONTROLS ─═̷─═̷─🎮
  controlMode: 'orbit',       // Default to orbit mode (classic behavior)
  mouseSensitivity: 1.0,      // FPS mouse sensitivity (0.1-2.0)
  moveSpeed: 10,              // FPS movement speed (1-20)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKY BACKGROUNDS - Night sky panoramas
// ═══════════════════════════════════════════════════════════════════════════════

export const SKY_BACKGROUNDS = [
  { id: 'stars', name: 'Procedural Stars', path: null },
  { id: 'night001', name: 'Night Sky 001', path: '/hdri/NightSkyHDRI001_4K_TONEMAPPED.jpg' },
  { id: 'night004', name: 'Night Sky 004', path: '/hdri/NightSkyHDRI004_4K_TONEMAPPED.jpg' },
  { id: 'night007', name: 'Night Sky 007', path: '/hdri/NightSkyHDRI007_4K_TONEMAPPED.jpg' },
  { id: 'night008', name: 'Night Sky 008', path: '/hdri/NightSkyHDRI008_4K_TONEMAPPED.jpg' },
  // ─═̷─═̷─ drei built-in presets (CDN-hosted 1k HDRIs) ─═̷─═̷─
  { id: 'city', name: 'City (Potsdamer Platz)', path: null, preset: 'city' },
  { id: 'dawn', name: 'Dawn', path: null, preset: 'dawn' },
  { id: 'forest', name: 'Forest', path: null, preset: 'forest' },
  { id: 'sunset', name: 'Sunset (Venice)', path: null, preset: 'sunset' },
  { id: 'park', name: 'Park', path: null, preset: 'park' },
  { id: 'night_preset', name: 'Night (Dikhololo)', path: null, preset: 'night' },
  { id: 'studio', name: 'Studio', path: null, preset: 'studio' },
  { id: 'warehouse', name: 'Warehouse', path: null, preset: 'warehouse' },
  { id: 'apartment', name: 'Apartment (Lobby)', path: null, preset: 'apartment' },
  { id: 'lobby', name: 'Lobby (St Fagans)', path: null, preset: 'lobby' },
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET CATALOG - All available 3D models for the explorer
// 108 GLTF assets from Quaternius Cyberpunk Kit + Sci-Fi Essentials Kit
// ═══════════════════════════════════════════════════════════════════════════════

export const ASSET_CATALOG: AssetDefinition[] = [
  // ─═̷─═̷─🏗️─═̷─═̷─ PLATFORMS (Cyberpunk Kit) ─═̷─═̷─🏗️─═̷─═̷─
  { id: 'antenna1', name: 'Antenna 1', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Antenna_1.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'antenna2', name: 'Antenna 2', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Antenna_2.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'ac', name: 'AC Unit', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/AC.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'ac_side', name: 'AC Side', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/AC_Side.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'ac_stacked', name: 'AC Stacked', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/AC_Stacked.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'cable_long', name: 'Cable Long', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Cable_Long.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'cable_small', name: 'Cable Small', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Cable_Small.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'cable_thick', name: 'Cable Thick', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Cable_Thick.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'computer', name: 'Computer', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Computer.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'computer_large', name: 'Computer Large', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Computer_Large.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'door', name: 'Door', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Door.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'fence', name: 'Fence', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Fence.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'light_square', name: 'Light Square', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Light_Square.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'light_street1', name: 'Street Light 1', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Light_Street_1.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'light_street2', name: 'Street Light 2', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Light_Street_2.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'pipe1', name: 'Pipe 1', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Pipe_1.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'pipe2', name: 'Pipe 2', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Pipe_2.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'pipe_corner', name: 'Pipe Corner', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Pipe_Corner.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'pipe_corner2', name: 'Pipe Corner 2', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Pipe_Corner_2.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'platform_1x1', name: 'Platform 1x1', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Platform_1x1_Empty.gltf', category: 'platforms', defaultScale: 1 },
  { id: 'platform_2x1', name: 'Platform 2x1', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Platform_2x1_Empty.gltf', category: 'platforms', defaultScale: 1 },
  { id: 'platform_2x2', name: 'Platform 2x2', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Platform_2x2.gltf', category: 'platforms', defaultScale: 1 },
  { id: 'platform_2x2_empty', name: 'Platform 2x2 Empty', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Platform_2x2_Empty.gltf', category: 'platforms', defaultScale: 1 },
  { id: 'platform_4x1', name: 'Platform 4x1', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Platform_4x1.gltf', category: 'platforms', defaultScale: 1 },
  { id: 'platform_4x1_empty', name: 'Platform 4x1 Empty', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Platform_4x1_Empty.gltf', category: 'platforms', defaultScale: 1 },
  { id: 'platform_4x2', name: 'Platform 4x2', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Platform_4x2.gltf', category: 'platforms', defaultScale: 1 },
  { id: 'platform_4x4', name: 'Platform 4x4', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Platform_4x4.gltf', category: 'platforms', defaultScale: 1 },
  { id: 'platform_4x4_empty', name: 'Platform 4x4 Empty', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Platform_4x4_Empty.gltf', category: 'platforms', defaultScale: 1 },
  { id: 'rail_corner', name: 'Rail Corner', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Rail_Corner.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'rail_corner2', name: 'Rail Corner 2', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Rail_Corner_2.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'rail_long', name: 'Rail Long', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Rail_Long.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'rail_short', name: 'Rail Short', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Rail_Short.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'sign1', name: 'Sign 1', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Sign_1.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'sign2', name: 'Sign 2', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Sign_2.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'sign3', name: 'Sign 3', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Sign_3.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'sign4', name: 'Sign 4', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Sign_4.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'sign_corner1', name: 'Sign Corner 1', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Sign_Corner_1.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'sign_corner2', name: 'Sign Corner 2', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Sign_Corner_2.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'sign_corner3', name: 'Sign Corner 3', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Sign_Corner_3.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'sign_corner3_fenced', name: 'Sign Corner Fenced', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Sign_Corner_3_Fenced.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'sign_corner_hazard', name: 'Sign Hazard', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Sign_Corner_Hazard.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'sign_corner_small1', name: 'Sign Small 1', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Sign_Corner_Small1.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'sign_corner_small2', name: 'Sign Small 2', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Sign_Corner_Small2.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'sign_small1', name: 'Sign Mini 1', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Sign_Small_1.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'sign_small2', name: 'Sign Mini 2', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Sign_Small_2.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'sign_small3', name: 'Sign Mini 3', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Sign_Small_3.gltf', category: 'platforms', defaultScale: 1.5 },
  { id: 'support', name: 'Support', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Support.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'support_long', name: 'Support Long', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Support_Long.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'support_short', name: 'Support Short', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/Support_Short.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'tv1', name: 'TV 1', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/TV_1.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'tv2', name: 'TV 2', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/TV_2.gltf', category: 'platforms', defaultScale: 2 },
  { id: 'tv3', name: 'TV 3', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Platforms/TV_3.gltf', category: 'platforms', defaultScale: 2 },

  // ─═̷─═̷─🤖─═̷─═̷─ ENEMIES (Cyberpunk Kit) ─═̷─═̷─🤖─═̷─═̷─
  { id: 'enemy_2legs', name: '2-Leg Robot', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Enemies/Enemy_2Legs.gltf', category: 'enemies', defaultScale: 1.5 },
  { id: 'enemy_2legs_gun', name: '2-Leg Robot (Gun)', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Enemies/Enemy_2Legs_Gun.gltf', category: 'enemies', defaultScale: 1.5 },
  { id: 'enemy_flying', name: 'Flying Enemy', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Enemies/Enemy_Flying.gltf', category: 'enemies', defaultScale: 1.5 },
  { id: 'enemy_flying_gun', name: 'Flying Enemy (Gun)', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Enemies/Enemy_Flying_Gun.gltf', category: 'enemies', defaultScale: 1.5 },
  { id: 'enemy_large', name: 'Large Robot', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Enemies/Enemy_Large.gltf', category: 'enemies', defaultScale: 1.5 },
  { id: 'enemy_large_gun', name: 'Large Robot (Gun)', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Enemies/Enemy_Large_Gun.gltf', category: 'enemies', defaultScale: 1.5 },
  { id: 'turret_cannon', name: 'Turret Cannon', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Enemies/Turret_Cannon.gltf', category: 'enemies', defaultScale: 1.5 },
  { id: 'turret_gun', name: 'Turret Gun', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Enemies/Turret_Gun.gltf', category: 'enemies', defaultScale: 1.5 },
  { id: 'turret_double', name: 'Turret Double', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Enemies/Turret_GunDouble.gltf', category: 'enemies', defaultScale: 1.5 },
  { id: 'turret_teleporter', name: 'Turret Teleporter', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Enemies/Turret_Teleporter.gltf', category: 'enemies', defaultScale: 1.5 },
  // Sci-Fi Essentials Enemies
  { id: 'enemy_eyedrone', name: 'Eye Drone', path: '/models/scifi-essentials/Enemy_EyeDrone.gltf', category: 'enemies', defaultScale: 1.5 },
  { id: 'enemy_quadshell', name: 'Quad Shell', path: '/models/scifi-essentials/Enemy_QuadShell.gltf', category: 'enemies', defaultScale: 1.5 },
  { id: 'enemy_trilobite', name: 'Trilobite', path: '/models/scifi-essentials/Enemy_Trilobite.gltf', category: 'enemies', defaultScale: 1.5 },

  // ─═̷─═̷─💎─═̷─═̷─ PICKUPS (Cyberpunk Kit) ─═̷─═̷─💎─═̷─═̷─
  { id: 'board', name: 'Collectible Board', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Pickups and Objects/Collectible_Board.gltf', category: 'pickups', defaultScale: 2 },
  { id: 'gear', name: 'Collectible Gear', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Pickups and Objects/Collectible_Gear.gltf', category: 'pickups', defaultScale: 3 },
  { id: 'lever', name: 'Lever', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Pickups and Objects/Lever.gltf', category: 'pickups', defaultScale: 2 },
  { id: 'lootbox', name: 'Lootbox', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Pickups and Objects/Lootbox.gltf', category: 'pickups', defaultScale: 2.5 },
  { id: 'health', name: 'Health Pickup', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Pickups and Objects/Pickup_Health.gltf', category: 'pickups', defaultScale: 2 },
  { id: 'heart', name: 'Heart Pickup', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Pickups and Objects/Pickup_Heart.gltf', category: 'pickups', defaultScale: 2 },
  { id: 'pickup_tank', name: 'Tank Pickup', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Pickups and Objects/Pickup_Tank.gltf', category: 'pickups', defaultScale: 2 },
  { id: 'tank', name: 'Tank', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Pickups and Objects/Tank.gltf', category: 'pickups', defaultScale: 2 },

  // ─═̷─═̷─🧑─═̷─═̷─ CHARACTER ─═̷─═̷─🧑─═̷─═̷─
  { id: 'character', name: 'Character', path: '/models/cyberpunk/Cyberpunk Game Kit - Quaternius/Character/Character.gltf', category: 'character', defaultScale: 1.5 },

  // ─═̷─═̷─🔫─═̷─═̷─ GUNS (Sci-Fi Essentials) ─═̷─═̷─🔫─═̷─═̷─
  { id: 'gun_pistol', name: 'Pistol', path: '/models/scifi-essentials/Gun_Pistol.gltf', category: 'guns', defaultScale: 2 },
  { id: 'gun_revolver', name: 'Revolver', path: '/models/scifi-essentials/Gun_Revolver.gltf', category: 'guns', defaultScale: 2 },
  { id: 'gun_rifle', name: 'Rifle', path: '/models/scifi-essentials/Gun_Rifle.gltf', category: 'guns', defaultScale: 2 },
  { id: 'gun_smg', name: 'SMG', path: '/models/scifi-essentials/Gun_SMG_Ammo.gltf', category: 'guns', defaultScale: 2 },
  { id: 'gun_sniper', name: 'Sniper', path: '/models/scifi-essentials/Gun_Sniper.gltf', category: 'guns', defaultScale: 2 },
  { id: 'gun_sniper_ammo', name: 'Sniper Ammo', path: '/models/scifi-essentials/Gun_Sniper_Ammo.gltf', category: 'guns', defaultScale: 2 },

  // ─═̷─═̷─📦─═̷─═̷─ PROPS (Sci-Fi Essentials) ─═̷─═̷─📦─═̷─═̷─
  { id: 'prop_ammo', name: 'Ammo Box', path: '/models/scifi-essentials/Prop_Ammo.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_ammo_closed', name: 'Ammo Box Closed', path: '/models/scifi-essentials/Prop_Ammo_Closed.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_ammo_small', name: 'Ammo Small', path: '/models/scifi-essentials/Prop_Ammo_Small.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_barrel1', name: 'Barrel 1', path: '/models/scifi-essentials/Prop_Barrel1.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_barrel2_closed', name: 'Barrel 2 Closed', path: '/models/scifi-essentials/Prop_Barrel2_Closed.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_barrel2_open', name: 'Barrel 2 Open', path: '/models/scifi-essentials/Prop_Barrel2_Open.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_chair', name: 'Chair', path: '/models/scifi-essentials/Prop_Chair.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_chest', name: 'Chest', path: '/models/scifi-essentials/Prop_Chest.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_crate', name: 'Crate', path: '/models/scifi-essentials/Prop_Crate.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_crate_large', name: 'Crate Large', path: '/models/scifi-essentials/Prop_Crate_Large.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_crate_tarp', name: 'Crate Tarp', path: '/models/scifi-essentials/Prop_Crate_Tarp.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_crate_tarp_large', name: 'Crate Tarp Large', path: '/models/scifi-essentials/Prop_Crate_Tarp_Large.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_desk_l', name: 'Desk L', path: '/models/scifi-essentials/Prop_Desk_L.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_desk_medium', name: 'Desk Medium', path: '/models/scifi-essentials/Prop_Desk_Medium.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_desk_small', name: 'Desk Small', path: '/models/scifi-essentials/Prop_Desk_Small.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_grenade', name: 'Grenade', path: '/models/scifi-essentials/Prop_Grenade.gltf', category: 'props', defaultScale: 3 },
  { id: 'prop_healthpack', name: 'Health Pack', path: '/models/scifi-essentials/Prop_HealthPack.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_healthpack_tube', name: 'Health Tube', path: '/models/scifi-essentials/Prop_HealthPack_Tube.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_keycard', name: 'Keycard', path: '/models/scifi-essentials/Prop_KeyCard.gltf', category: 'props', defaultScale: 3 },
  { id: 'prop_locker', name: 'Locker', path: '/models/scifi-essentials/Prop_Locker.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_mine', name: 'Mine', path: '/models/scifi-essentials/Prop_Mine.gltf', category: 'props', defaultScale: 3 },
  { id: 'prop_mug', name: 'Mug', path: '/models/scifi-essentials/Prop_Mug.gltf', category: 'props', defaultScale: 3 },
  { id: 'prop_satellite', name: 'Satellite Dish', path: '/models/scifi-essentials/Prop_SatelliteDish.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_shelves_thin_short', name: 'Shelves Thin Short', path: '/models/scifi-essentials/Prop_Shelves_ThinShort.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_shelves_thin_tall', name: 'Shelves Thin Tall', path: '/models/scifi-essentials/Prop_Shelves_ThinTall.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_shelves_wide_short', name: 'Shelves Wide Short', path: '/models/scifi-essentials/Prop_Shelves_WideShort.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_shelves_wide_tall', name: 'Shelves Wide Tall', path: '/models/scifi-essentials/Prop_Shelves_WideTall.gltf', category: 'props', defaultScale: 2 },
  { id: 'prop_syringe', name: 'Syringe', path: '/models/scifi-essentials/Prop_Syringe.gltf', category: 'props', defaultScale: 3 },

  // ─═̷─═̷─🌲─═̷─═̷─ NATURE ─═̷─═̷─🌲─═̷─═̷─
  // ⚠️ 4K textures are WAY too heavy for real-time (500MB+ = 1-2 FPS)
  // Need low-poly nature assets instead - Kenney or similar
]

// ▓▓▓▓【0̸4̸5̸1̸5̸】▓▓▓▓ॐ▓▓▓▓【C̸O̸N̸S̸T̸A̸N̸T̸S̸】▓▓▓▓
