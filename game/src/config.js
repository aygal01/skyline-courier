// Skyline Courier — tuning, world layout and mission definitions.
// One clear job: every number the rest of the game reads, in one place.

export const VIEW = { width: 1280, height: 720 };

// Flight model tuning. Speeds are knots, altitudes are feet, distances are metres.
export const FLIGHT = {
  minSpeed: 55,          // below this the wing stops flying and the nose drops
  maxSpeed: 240,
  cruiseSpeed: 150,
  takeoffSpeed: 70,
  climbRate: 9,          // feet per second per unit of pitch at cruise
  pitchRate: 0.9,        // radians per second of pitch authority
  rollRate: 1.6,         // radians per second of roll authority
  turnRate: 0.55,        // heading change per second at full bank
  throttleAccel: 26,     // knots per second at full throttle
  drag: 0.055,           // speed decay per second
  fuelCapacity: 100,
  fuelBurn: 0.45,        // percent per second at full throttle
  ringFuelBonus: 6,      // fuel added per ring flown
  stallSink: 26,         // feet per second of sink when stalled
  groundEffect: 120,     // feet above ground where the wing feels the cushion
};

// The world: a green valley with a river, a town, and a runway on the flat.
export const WORLD = {
  seed: 20261126,
  runway: {
    x: 0, z: 800,          // centre of the strip, metres
    heading: 0,            // runway points north (+z)
    length: 620, width: 34,
    name: 'SKYLINE FIELD',
  },
  riverBend: 170,          // how far the river meanders sideways, metres
  town: { x: 330, z: 1450, radius: 190 },
  mountainsFar: 5200,      // distance of the painted mountain wall
  groundSpan: 1500,        // how far ahead the ground grid reaches
  groundHalfWidth: 900,    // how wide the ground grid reaches
};

// Three sorties, each with its own ring course and flavour.
export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'MISSION 1 — RING RUN',
    brief: 'Six golden rings over the valley. Thread them all, then bring her home to Runway 36.',
    rings: 6,
    ringRadius: 26,
    ringSpread: 260,
    ringAltMin: 350,
    ringAltMax: 750,
    wind: 0,
    dusk: false,
    timeBonus: 400,
  },
  {
    id: 'canyon-dash',
    name: 'MISSION 2 — CANYON DASH',
    brief: 'Eight rings, lower and tighter, with a crosswind pushing you off line. Stay sharp.',
    rings: 8,
    ringRadius: 22,
    ringSpread: 320,
    ringAltMin: 220,
    ringAltMax: 560,
    wind: 9,
    dusk: false,
    timeBonus: 650,
  },
  {
    id: 'dusk-delivery',
    name: 'MISSION 3 — DUSK DELIVERY',
    brief: 'Last light over the valley. Six rings at dusk, then a precision landing on the numbers.',
    rings: 6,
    ringRadius: 24,
    ringSpread: 280,
    ringAltMin: 300,
    ringAltMax: 640,
    wind: 5,
    dusk: true,
    timeBonus: 800,
  },
];

// Scoring.
export const SCORE = {
  ring: 250,
  ringPerfect: 150,      // extra when the ring is threaded near its centre
  landing: 500,
  landingPerfect: 400,   // extra for touching down in the marked zone, gently
  missionComplete: 1000,
};

// Palette for the two times of day.
export const SKY = {
  day: {
    top: '#2f6fb4', mid: '#7fb2dd', horizon: '#cfe4f2',
    sun: '#fff3c4', cloud: 'rgba(255,255,255,0.92)',
    fog: '#cfe4f2',
  },
  dusk: {
    top: '#2a2350', mid: '#8a4a6b', horizon: '#f2a35e',
    sun: '#ffb347', cloud: 'rgba(255,196,150,0.85)',
    fog: '#e8956a',
  },
};

export const COLOURS = {
  grass: '#5d8a3c', grassLight: '#6f9c46', grassDry: '#8a9a4b',
  forest: '#4a7d38', rock: '#8a8172', snow: '#e8eef2',
  sand: '#c9b078', water: '#3f7fb8', waterDeep: '#2f6394',
  runway: '#33373d', runwayEdge: '#e8e8e8', runwayMark: '#f5f5f5',
  townRoof: '#a4553f', townWall: '#d8c9a8',
  ring: '#ffc93c', ringGlow: 'rgba(255,201,60,0.55)',
  planeBody: '#d8442c', planeTrim: '#f2ede2', planeGlass: '#9fd4e8',
};
