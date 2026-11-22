// The heat: wanted stars, police cars that chase and ram, foot cops who chase
// and arrest, and the ways to cool off — hide until it fades, or pay the spray
// shop to wash the car and the record clean.

import { CAR, POLICE, WANTED } from './config.js';
import { makeCar, KIND_POLICE } from './traffic.js';
import { isRoad } from './world.js';

export function createPolice() {
  const state = {
    cars: [],
    cops: [],
    coolTimer: 0,
    spawnTimer: 0,
  };

  /** Raise the wanted level by n stars (capped at 5) and reset the cool-down. */
  function addWanted(player, n) {
    player.wanted = Math.min(WANTED.max, player.wanted + n);
    player.wantedHeat = 1;
    state.coolTimer = 0;
  }

  /** How many police cars / foot cops the current heat calls for. */
  function wantedCounts(wanted) {
    return {
      cars: POLICE.carsByStars[Math.min(wanted, 5)],
      cops: POLICE.copsByStars[Math.min(wanted, 5)],
    };
  }

  /** Spawn a police car on a road a little way from the player. */
  function spawnPoliceCar(player, random, city) {
    const p = city.randomRoadPoint(player, POLICE.spawnDistance);
    const car = makeCar(p.x, p.y, 0, KIND_POLICE, '#2b6fd6');
    car.speed = POLICE.carSpeed * 0.6;
    state.cars.push(car);
    return car;
  }

  /** Spawn a foot cop near the player. */
  function spawnCop(player, random) {
    const angle = random() * Math.PI * 2;
    const dist = 420 + random() * 220;
    state.cops.push({
      x: player.x + Math.cos(angle) * dist,
      y: player.y + Math.sin(angle) * dist,
      angle: 0,
      speed: POLICE.footSpeed,
      arrest: 0,
      color: '#1e3a8a',
    });
  }

  /** Keep the police presence matched to the wanted level. */
  function maintain(player, random, city, dt) {
    state.spawnTimer -= dt;
    if (player.wanted === 0) {
      if (state.cars.length > 0 || state.cops.length > 0) {
        state.cars.length = 0;
        state.cops.length = 0;
      }
      return;
    }
    const want = wantedCounts(player.wanted);
    if (state.spawnTimer <= 0) {
      if (state.cars.length < want.cars) spawnPoliceCar(player, random, city);
      else if (state.cops.length < want.cops) spawnCop(player, random);
      state.spawnTimer = 1.1;
    }
  }

  /** A police car chases the player's car (or the player on foot): steer, ram, damage. */
  function stepPoliceCar(car, dt, player, game) {
    if (car.wrecked) return;
    const target = player.car ?? player;
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    let turn = wantAngle - car.angle;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    const steer = Math.max(-3.2 * dt, Math.min(3.2 * dt, turn * 3));
    car.angle += steer;
    const targetSpeed = dist > 90 ? POLICE.carSpeed : POLICE.carSpeed * 0.75;
    car.speed += Math.max(-POLICE.carAccel * dt, Math.min(POLICE.carAccel * dt, targetSpeed - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.sirenPhase += dt * 6;
    // Ramming: hit the player's car and hurt it; hit the player on foot and hurt them.
    if (dist < POLICE.ramRange) {
      if (player.car) {
        player.car.health -= CAR.ramDamage * dt * 1.2;
        game.events.push({ type: 'crash' });
        if (player.car.health <= 0) {
          player.car.wrecked = true;
          player.car = null;
          game.banner('Your car is wrecked! Bail out and run.');
        }
      } else {
        player.health -= 26 * dt;
        game.events.push({ type: 'hit' });
        const push = 320 * dt;
        player.x += (dx / dist) * push;
        player.y += (dy / dist) * push;
      }
    }
    // Police cars stay on land.
    if (!isRoad(car.x, car.y)) {
      // Off-road they slow down a lot.
      car.speed *= 1 - 0.8 * dt;
    }
  }

  /** A foot cop chases the player; standing close long enough means an arrest. */
  function stepCop(cop, dt, player, game) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    cop.angle = Math.atan2(dy, dx);
    if (player.car) {
      // Cops cannot catch a car: they run at it anyway, then give up and hold position.
      if (dist > 240) {
        cop.x += (dx / dist) * cop.speed * dt;
        cop.y += (dy / dist) * cop.speed * dt;
      }
      cop.arrest = 0;
      return;
    }
    cop.x += (dx / dist) * cop.speed * dt;
    cop.y += (dy / dist) * cop.speed * dt;
    if (dist < 30) {
      cop.arrest += dt;
      if (cop.arrest >= 1.6) {
        game.events.push({ type: 'busted' });
      }
    } else {
      cop.arrest = Math.max(0, cop.arrest - dt * 2);
    }
  }

  /** Cool the heat down when no police are close; the spray shop wipes it at once. */
  function stepCooling(player, dt, game) {
    if (player.wanted === 0) return;
    const near = state.cars.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < WANTED.sightRange)
      || state.cops.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < WANTED.sightRange);
    if (near) {
      state.coolTimer = 0;
      return;
    }
    state.coolTimer += dt;
    if (state.coolTimer > WANTED.coolDown + WANTED.coolPerStar) {
      player.wanted -= 1;
      state.coolTimer = WANTED.coolDown;
      if (player.wanted === 0) game.banner('You lost the heat. Lay low.');
    }
  }

  /** Drive into the spray shop with cash and the heat is gone. */
  function trySprayShop(player, city, game) {
    if (player.wanted === 0) return false;
    const dx = player.x - city.spray.x;
    const dy = player.y - city.spray.y;
    if (dx * dx + dy * dy > 90 * 90) return false;
    if (player.cash < WANTED.sprayCost) {
      game.banner(`Spray shop needs $${WANTED.sprayCost} — you have $${player.cash}.`);
      return false;
    }
    player.cash -= WANTED.sprayCost;
    player.wanted = 0;
    state.cars.length = 0;
    state.cops.length = 0;
    game.banner('New paint, clean record. The heat is off.');
    game.events.push({ type: 'pickup' });
    return true;
  }

  function step(dt, player, random, city, game) {
    maintain(player, random, city, dt);
    for (const car of state.cars) stepPoliceCar(car, dt, player, game);
    for (const cop of state.cops) stepCop(cop, dt, player, game);
    stepCooling(player, dt, game);
    trySprayShop(player, city, game);
  }

  return { state, addWanted, step };
}
