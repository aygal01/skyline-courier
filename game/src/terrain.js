// Skyline Courier — the valley: terrain heights, the river, the runway, the town,
// the ring courses and the clouds. Everything here is pure and seeded, so the
// same seed always builds the same valley.

import { COLOURS, WORLD } from './config.js';
import { fbm2, hash2, makeRng, range, rangeInt } from './random.js';

const SEED = WORLD.seed;
const RW = WORLD.runway;

// The river snakes north through the valley.
export function riverX(z) {
  return WORLD.riverBend * Math.sin(z * 0.0011) + 60 * Math.sin(z * 0.0027 + 1.7);
}

function smoothstep(a, b, t) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

// Distance from (x, z) to the runway rectangle, in metres (0 when inside it).
function runwayDistance(x, z) {
  const dx = Math.max(0, Math.abs(x - RW.x) - RW.width / 2);
  const dz = Math.max(0, Math.abs(z - RW.z) - RW.length / 2);
  return Math.hypot(dx, dz);
}

// Terrain height in metres above sea level at world (x, z).
export function heightAt(x, z) {
  let h = fbm2(x, z, 420, SEED) * 55 + fbm2(x, z, 1150, SEED + 7) * 95;

  // Mountains rise around the valley's edges — mostly to the sides and far
  // north, so the ring course down the middle stays flyable.
  const r = Math.hypot(x / 1300, (z - 1400) / 2800);
  h += smoothstep(0.72, 1.35, r) * 430;

  // The river carves a channel and the water sits at 2 m.
  const dRiver = Math.abs(x - riverX(z));
  h -= smoothstep(190, 45, dRiver) * 20;
  if (dRiver < 26) return 2;

  // The runway sits on flat ground.
  const dRw = runwayDistance(x, z);
  h = h * smoothstep(30, 160, dRw);

  // The town sits on a gentle rise.
  const dTown = Math.hypot(x - WORLD.town.x, z - WORLD.town.z);
  h = h * smoothstep(40, 220, dTown) + 6 * (1 - smoothstep(40, 220, dTown));

  return Math.max(2, h);
}

// Is (x, z) on the runway strip?
export function onRunway(x, z) {
  return Math.abs(x - RW.x) <= RW.width / 2 + 4 && Math.abs(z - RW.z) <= RW.length / 2 + 4;
}

// Is (x, z) over the river?
export function overRiver(x, z) {
  return Math.abs(x - riverX(z)) < 26;
}

// Ground colour at a point, given its height.
export function groundColour(x, z, h) {
  if (overRiver(x, z)) return h < 4 ? COLOURS.water : COLOURS.waterDeep;
  if (onRunway(x, z)) return COLOURS.runway;
  const dRw = runwayDistance(x, z);
  if (dRw < 8) return COLOURS.sand; // grass strip beside the runway
  const dTown = Math.hypot(x - WORLD.town.x, z - WORLD.town.z);
  if (dTown < WORLD.town.radius * 0.55) return '#9a8f6a'; // town ground
  if (h > 300) return COLOURS.snow;
  if (h > 180) return COLOURS.rock;
  // Patchwork fields: deterministic per cell.
  const cell = hash2(Math.floor(x / 260), Math.floor(z / 260), SEED + 55);
  if (cell < 0.22) return COLOURS.grassDry;
  if (cell < 0.45) return COLOURS.forest;
  if (cell < 0.52) return COLOURS.grassLight;
  return COLOURS.grass;
}

// A ring course for one mission: rings strung along a gentle S-curve north from
// the runway, each at its own altitude above the ground beneath it, then the
// course turns back home. Altitudes are above local terrain, so a ring never
// ends up buried in the hillside as the valley rises.
export function generateRings(mission) {
  const rng = makeRng(SEED + mission.rings * 131 + mission.ringRadius);
  const rings = [];
  const startZ = RW.z + RW.length / 2 + 320;
  for (let i = 0; i < mission.rings; i++) {
    const t = i / Math.max(1, mission.rings - 1);
    const z = startZ + 260 + i * 330;
    const x = Math.sin(t * Math.PI * 1.6) * mission.ringSpread + range(rng, -50, 50);
    const y = heightAt(x, z) + range(rng, mission.ringAltMin, mission.ringAltMax) * 0.3048;
    rings.push({ x, y, z, radius: mission.ringRadius, passed: false, perfect: false });
  }
  return rings;
}

// Town buildings: flat-roofed blocks with warm roofs, deterministic per seed.
export function generateTown() {
  const rng = makeRng(SEED + 777);
  const buildings = [];
  for (let i = 0; i < 46; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * WORLD.town.radius;
    const x = WORLD.town.x + Math.cos(a) * r;
    const z = WORLD.town.z + Math.sin(a) * r * 0.8;
    if (overRiver(x, z)) continue;
    buildings.push({
      x, z,
      w: range(rng, 18, 42),
      d: range(rng, 18, 42),
      h: range(rng, 10, 34),
      roof: rng() < 0.6,
      shade: rangeInt(rng, 0, 2),
    });
  }
  return buildings;
}

// Clouds: soft billboards drifting high above the valley.
export function generateClouds() {
  const rng = makeRng(SEED + 4242);
  const clouds = [];
  for (let i = 0; i < 22; i++) {
    clouds.push({
      x: range(rng, -1600, 1600),
      y: range(rng, 380, 620),
      z: range(rng, 200, 4200),
      s: range(rng, 60, 170),
      puffs: rangeInt(rng, 3, 5),
    });
  }
  return clouds;
}

// Far mountain silhouettes painted on the horizon, one ridge per layer.
export function mountainRidge(layer, seedOffset) {
  const points = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const peak = 60 + fbm2(t * 9000, layer * 777, 900, SEED + seedOffset) * 90;
    points.push({ t, peak: Math.max(18, peak) });
  }
  return points;
}
