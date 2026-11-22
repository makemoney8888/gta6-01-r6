// Coral Bay Heat — every tuning number, colour and screen name in one place.
// The world is a fixed 3200 x 2400 open city; the renderer shows a 1280 x 720
// window of it through a camera that follows the player.

export const STEP = 1 / 60;

export const WORLD = { width: 3200, height: 2400 };
export const VIEW = { width: 1280, height: 720 };

/** City grid: roads every 400 px, 96 px wide, starting 200 px from the edge. */
export const GRID = { spacing: 400, first: 200, roadWidth: 96, halfRoad: 48 };
/** The beach: sand from this y, water from this y, down to the world's edge. */
export const BEACH = { sandY: 2040, waterY: 2220 };

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  runSpeed: 330,
  health: 100,
  punchRange: 34,
  punchDamage: 25,
  punchCooldown: 0.35,
  shootCooldown: 0.28,
  bulletSpeed: 780,
  bulletDamage: 34,
  arrestTime: 1.6,
};

export const CAR = {
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 170,
  turnRate: 2.5,
  drag: 0.55,
  offRoadDrag: 1.9,
  length: 52,
  width: 26,
  health: 100,
  ramDamage: 14,
};

export const TRAFFIC = { count: 16, speed: 165, speedJitter: 45 };
export const PEDS = { count: 26, speed: 55, speedJitter: 30 };

export const WANTED = {
  max: 5,
  /** Seconds with no police close by before the heat starts falling. */
  coolDown: 7,
  /** Seconds per star lost once cooling. */
  coolPerStar: 4,
  sprayCost: 200,
  /** How far a cop must be to count as "not seen". */
  sightRange: 620,
};

export const POLICE = {
  carSpeed: 520,
  carAccel: 480,
  footSpeed: 265,
  spawnDistance: 700,
  ramRange: 46,
  /** Cars the chase keeps on the road, by wanted level (index = stars). */
  carsByStars: [0, 1, 2, 3, 4, 5],
  copsByStars: [0, 1, 1, 2, 3, 4],
};

/** Missions pay out in cash; the save keeps cash and which are done. */
export const MISSIONS = [
  { id: 'getaway', title: 'Getaway Driver', reward: 400, timeLimit: 100 },
  { id: 'pickup', title: 'The Pickup', reward: 600, timeLimit: 150 },
  { id: 'delivery', title: 'Hot Delivery', reward: 900, timeLimit: 120 },
];

export const SAVE_KEY = 'coral-bay-heat.save.v1';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export const PALETTE = {
  grass: '#7fae62',
  grassDark: '#74a158',
  sand: '#e8d39a',
  water: '#2f7fb8',
  waterDeep: '#256b9e',
  road: '#3c3f46',
  roadEdge: '#2e3138',
  lane: '#d8c95a',
  sidewalk: '#9aa0a8',
  building: ['#c96f4a', '#d9a05b', '#7d9bb5', '#b56a7a', '#8fae7d', '#a98fc4', '#cf8f5f', '#6f9a8f'],
  buildingRoof: '#00000022',
  park: '#5d9b4e',
  tree: '#2f6b2a',
  player: '#ffd23e',
  playerCar: '#e8443a',
  policeCar: '#2b6fd6',
  policeLight: '#ff2d2d',
  trafficCar: ['#e8e8e8', '#4a7ec2', '#c25a4a', '#5aa86b', '#d9c25a', '#8a6fc2', '#e07a2e'],
  ped: ['#f2f2f2', '#7ec8e3', '#e38a7e', '#a8e39a', '#e3d27e', '#c99ae3'],
  cop: '#1e3a8a',
  hudBg: 'rgba(12, 16, 24, 0.72)',
  hudText: '#f4f6f8',
  hudMuted: '#aeb6c2',
  starOn: '#ffd23e',
  starOff: '#5a6270',
  cash: '#7ee787',
  health: '#ff5a4e',
  marker: '#ffcf3d',
  banner: '#ffd23e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const TITLE_FONT = 'bold 64px system-ui, sans-serif';
