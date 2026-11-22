// The city of Coral Bay: a road grid, blocks of buildings and parks, and a beach
// with water along the south edge. Pure data and geometry — no drawing, no input.
// Everything the simulation needs to ask the city lives here: is this a road,
// is this water, does a circle hit a building, where is the nearest road point.

import { BEACH, GRID, PALETTE, WORLD } from './config.js';
import { pick, randInt } from './random.js';

export const ROAD_X = [];
export const ROAD_Y = [];
for (let x = GRID.first; x < WORLD.width; x += GRID.spacing) ROAD_X.push(x);
for (let y = GRID.first; y < WORLD.height - 360; y += GRID.spacing) ROAD_Y.push(y);

function nearestLine(value, lines) {
  let best = lines[0];
  let bestD = Math.abs(value - best);
  for (const line of lines) {
    const d = Math.abs(value - line);
    if (d < bestD) {
      bestD = d;
      best = line;
    }
  }
  return best;
}

/** True when the point is on a road (either a vertical or a horizontal street). */
export function isRoad(x, y) {
  if (y > BEACH.sandY) return false;
  for (const rx of ROAD_X) if (Math.abs(x - rx) <= GRID.halfRoad) return true;
  for (const ry of ROAD_Y) if (Math.abs(y - ry) <= GRID.halfRoad) return true;
  return false;
}

/** True on sand or in the sea. */
export function isBeach(x, y) {
  return y >= BEACH.sandY;
}

/** True in the sea (not swimmable — it is the map's edge). */
export function isWater(x, y) {
  return y >= BEACH.waterY;
}

/** The closest point on a road centreline to (x, y). */
export function nearestRoadPoint(x, y) {
  const rx = nearestLine(x, ROAD_X);
  const ry = nearestLine(y, ROAD_Y);
  const dx = Math.abs(x - rx);
  const dy = Math.abs(y - ry);
  if (dx <= dy) return { x: rx, y, vertical: true };
  return { x, y: ry, vertical: false };
}

/** The closest road intersection to (x, y). */
export function nearestIntersection(x, y) {
  return { x: nearestLine(x, ROAD_X), y: nearestLine(y, ROAD_Y) };
}

export function createCity(random) {
  const buildings = [];
  const parks = [];
  const trees = [];
  const blockMinX = GRID.first + GRID.halfRoad;
  const blockMaxY = BEACH.sandY - GRID.halfRoad;

  // One block per grid cell between neighbouring roads.
  for (let gx = 0; gx < ROAD_X.length - 1; gx += 1) {
    for (let gy = 0; gy < ROAD_Y.length - 1; gy += 1) {
      const x0 = ROAD_X[gx] + GRID.halfRoad + 14;
      const y0 = ROAD_Y[gy] + GRID.halfRoad + 14;
      const x1 = ROAD_X[gx + 1] - GRID.halfRoad - 14;
      const y1 = ROAD_Y[gy + 1] - GRID.halfRoad - 14;
      if (y1 > blockMaxY) continue;
      const roll = random();
      if (roll < 0.16) {
        // A park: grass and a scatter of palm trees.
        parks.push({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
        const treeCount = 5 + Math.floor(random() * 6);
        for (let i = 0; i < treeCount; i += 1) {
          trees.push({
            x: x0 + 20 + random() * (x1 - x0 - 40),
            y: y0 + 20 + random() * (y1 - y0 - 40),
            r: 9 + random() * 5,
          });
        }
        continue;
      }
      // A built block: one big building, or two/three smaller ones.
      const count = random() < 0.45 ? 1 : random() < 0.7 ? 2 : 3;
      const bw = (x1 - x0) / (count === 1 ? 1 : 2);
      const bh = (y1 - y0) / (count === 3 ? 2 : 1);
      for (let i = 0; i < count; i += 1) {
        const col = count === 1 ? 0 : i % 2;
        const row = count === 3 ? Math.floor(i / 2) : 0;
        const bx = x0 + col * bw + 8;
        const by = y0 + row * bh + 8;
        const w = bw - 16 - (count > 1 ? random() * 30 : 0);
        const h = bh - 16 - (count > 1 ? random() * 30 : 0);
        if (w < 40 || h < 40) continue;
        buildings.push({
          x: bx,
          y: by,
          width: w,
          height: h,
          color: pick(random, PALETTE.building),
          shade: 0.85 + random() * 0.3,
        });
      }
    }
  }

  // The spray shop (lose the heat here) and the mission warehouse, both on roads.
  const spray = { x: ROAD_X[1], y: ROAD_Y[2], label: 'Spray Shop' };
  const warehouse = { x: ROAD_X[5], y: ROAD_Y[1], label: 'Warehouse' };
  const pier = { x: ROAD_X[3], y: BEACH.waterY - 60, label: 'Pier' };

  /** Push a circle out of every building it overlaps; returns true on a hit. */
  function collideCircle(entity, radius) {
    let hit = false;
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(entity.x, b.x + b.width));
      const cy = Math.max(b.y, Math.min(entity.y, b.y + b.height));
      const dx = entity.x - cx;
      const dy = entity.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= radius * radius) continue;
      hit = true;
      if (d2 === 0) {
        entity.y = b.y - radius;
        continue;
      }
      const d = Math.sqrt(d2);
      const push = (radius - d) / d;
      entity.x += dx * push;
      entity.y += dy * push;
    }
    return hit;
  }

  /** Keep a point inside the drivable/walkable world (never in the sea). */
  function clampToLand(entity, radius) {
    entity.x = Math.max(radius + 8, Math.min(WORLD.width - radius - 8, entity.x));
    entity.y = Math.max(radius + 8, Math.min(BEACH.waterY - radius - 6, entity.y));
  }

  /** A random road point, away from the given point by at least `minAway`. */
  function randomRoadPoint(awayFrom, minAway) {
    for (let tries = 0; tries < 40; tries += 1) {
      const p = {
        x: ROAD_X[randInt(random, 0, ROAD_X.length - 1)],
        y: ROAD_Y[randInt(random, 0, ROAD_Y.length - 1)],
      };
      const dx = p.x - awayFrom.x;
      const dy = p.y - awayFrom.y;
      if (dx * dx + dy * dy >= minAway * minAway) return p;
    }
    return { x: ROAD_X[0], y: ROAD_Y[0] };
  }

  return { buildings, parks, trees, spray, warehouse, pier, collideCircle, clampToLand, randomRoadPoint };
}
