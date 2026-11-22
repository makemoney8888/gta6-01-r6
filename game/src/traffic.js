// Traffic cars that drive the road grid and pedestrians who stroll the
// sidewalks. Both are simple and dumb on purpose: cars follow the centreline,
// turn at intersections and brake for the car ahead; pedestrians wander, and
// flee when the player gets violent near them.

import { CAR, PALETTE, PEDS, TRAFFIC, WORLD } from './config.js';
import { nearestIntersection, nearestRoadPoint, ROAD_X, ROAD_Y, isRoad } from './world.js';
import { pick, randInt } from './random.js';

export const KIND_TRAFFIC = 'traffic';
export const KIND_POLICE = 'police';
export const KIND_PLAYER = 'player';

let carId = 0;

export function makeCar(x, y, angle, kind, color) {
  return {
    id: carId++,
    x, y, angle, speed: 0,
    kind,
    color,
    health: CAR.health,
    driver: kind === KIND_PLAYER ? 'player' : kind === KIND_POLICE ? 'police' : 'traffic',
    // Traffic state: which intersection to head for next, and which way along the road.
    target: null,
    vertical: false,
    direction: 1,
    stuck: 0,
    wrecked: false,
    sirenPhase: 0,
  };
}

/** Put a traffic car on a road and give it a first destination. */
export function spawnTrafficCar(random, awayFrom) {
  const x = ROAD_X[randInt(random, 0, ROAD_X.length - 1)];
  const y = ROAD_Y[randInt(random, 0, ROAD_Y.length - 1)];
  const vertical = random() < 0.5;
  const car = makeCar(x, y, vertical ? Math.PI / 2 : 0, KIND_TRAFFIC, pick(random, PALETTE.trafficCar));
  car.vertical = vertical;
  car.direction = random() < 0.5 ? 1 : -1;
  car.target = pickNextIntersection(random, car, awayFrom);
  car.speed = TRAFFIC.speed * 0.7;
  return car;
}

function pickNextIntersection(random, car, awayFrom) {
  // Head for a neighbouring intersection along the current road.
  const step = 400;
  const candidates = [];
  if (car.vertical) {
    candidates.push({ x: car.x, y: car.y + step * car.direction });
    candidates.push({ x: car.x, y: car.y - step * car.direction });
  } else {
    candidates.push({ x: car.x + step * car.direction, y: car.y });
    candidates.push({ x: car.x - step * car.direction, y: car.y });
  }
  const inside = candidates.filter((p) => p.x > 100 && p.x < WORLD.width - 100 && p.y > 100 && p.y < WORLD.height - 500);
  const pickFrom = inside.length > 0 ? inside : candidates;
  return pickFrom[Math.floor(random() * pickFrom.length)];
}

/** Drive one traffic car one step: follow its road, turn at the target, brake for cars ahead. */
export function stepTrafficCar(car, dt, cars, random) {
  if (car.wrecked) {
    car.speed = 0;
    return;
  }
  if (!car.target) car.target = pickNextIntersection(random, car, car);
  const dx = car.target.x - car.x;
  const dy = car.target.y - car.y;
  const dist = Math.hypot(dx, dy);
  const wantAngle = Math.atan2(dy, dx);
  // Steer toward the target, snapped to the road axes.
  let turn = wantAngle - car.angle;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, turn));
  const cruise = TRAFFIC.speed + (car.cruiseJitter ?? 0);
  // Brake when another car is close ahead.
  let blocked = false;
  for (const other of cars) {
    if (other === car || other.wrecked) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 78 && side < 30) {
      blocked = true;
      break;
    }
  }
  const targetSpeed = blocked ? 0 : cruise;
  car.speed += Math.max(-420 * dt, Math.min(300 * dt, targetSpeed - car.speed));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (dist < 26) {
    // Reached the intersection: pick a new road, sometimes turning.
    const at = nearestIntersection(car.x, car.y);
    car.x = at.x;
    car.y = at.y;
    const turnLeft = random() < 0.3;
    const turnRight = !turnLeft && random() < 0.4;
    if (car.vertical) {
      if (turnLeft) { car.vertical = false; car.direction = -1; }
      else if (turnRight) { car.vertical = false; car.direction = 1; }
      else if (random() < 0.08) car.direction *= -1;
    } else {
      if (turnLeft) { car.vertical = true; car.direction = 1; }
      else if (turnRight) { car.vertical = true; car.direction = -1; }
      else if (random() < 0.08) car.direction *= -1;
    }
    car.target = pickNextIntersection(random, car, car);
  }
}

export function makePed(random, x, y) {
  const onRoad = isRoad(x, y);
  return {
    x, y,
    angle: random() * Math.PI * 2,
    speed: PEDS.speed + random() * PEDS.speedJitter,
    color: pick(random, PALETTE.ped),
    state: 'walk',
    fleeX: 0,
    fleeY: 0,
    timer: 1 + random() * 3,
    onRoad,
  };
}

export function spawnPed(random, player) {
  for (let tries = 0; tries < 30; tries += 1) {
    const p = nearestRoadPoint(
      200 + random() * (WORLD.width - 400),
      200 + random() * (WORLD.height - 800),
    );
    // Sidewalk: just off the road edge.
    const x = p.vertical ? p.x + (random() < 0.5 ? -62 : 62) : p.x;
    const y = p.vertical ? p.y : p.y + (random() < 0.5 ? -62 : 62);
    const dx = x - player.x;
    const dy = y - player.y;
    if (dx * dx + dy * dy > 500 * 500) return makePed(random, x, y);
  }
  return makePed(random, 600, 600);
}

/** One pedestrian step: stroll, change direction now and then, run from danger. */
export function stepPed(ped, dt, random, player, danger) {
  ped.timer -= dt;
  if (ped.state === 'flee') {
    const dx = ped.x - danger.x;
    const dy = ped.y - danger.y;
    const d = Math.hypot(dx, dy) || 1;
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * ped.speed * 2.4 * dt;
    ped.y += (dy / d) * ped.speed * 2.4 * dt;
    if (d > 420 || ped.timer <= 0) {
      ped.state = 'walk';
      ped.timer = 1 + random() * 3;
    }
    return;
  }
  if (ped.timer <= 0) {
    ped.angle = random() * Math.PI * 2;
    ped.timer = 1 + random() * 4;
  }
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  // Stay roughly near roads and out of the sea; bounce off the edges.
  if (ped.x < 60 || ped.x > WORLD.width - 60 || ped.y < 60 || ped.y > WORLD.height - 420) {
    ped.angle += Math.PI;
    ped.x = Math.max(60, Math.min(WORLD.width - 60, ped.x));
    ped.y = Math.max(60, Math.min(WORLD.height - 420, ped.y));
  }
  // A violent player nearby scares them off.
  const dx = ped.x - player.x;
  const dy = ped.y - player.y;
  if (player.violent > 0 && dx * dx + dy * dy < 260 * 260) {
    ped.state = 'flee';
    ped.timer = 2.5;
  }
}

/** Two cars overlapping get pushed apart and lose a little speed. */
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.wrecked && b.wrecked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = 44;
      if (d === 0 || d >= min) continue;
      const push = (min - d) / 2 / d;
      a.x -= dx * push;
      a.y -= dy * push;
      b.x += dx * push;
      b.y += dy * push;
      a.speed *= 0.6;
      b.speed *= 0.6;
    }
  }
}
