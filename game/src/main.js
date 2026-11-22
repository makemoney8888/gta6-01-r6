// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between four screens: title, play, paused and game over.
//
// ?seed=N fixes the city. ?shot=start|chase|mission|street (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
//
// The whole simulation lives in createGame so the shot stager can build the
// same game and drive it forward with a fake input.
import { BEACH, CAR, PALETTE, PLAYER, SAVE_KEY, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, STEP, VIEW, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createCity, isRoad, isWater, ROAD_X, ROAD_Y } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_PAUSE, ACTION_PUNCH, ACTION_SHOOT, createInput } from './input.js';
import { createPolice } from './police.js';
import { createMissions, createPickups, MISSION_ACTIVE } from './missions.js';
import { createAudio } from './audio.js';
import { KIND_PLAYER, KIND_TRAFFIC, makeCar, separateCars, spawnPed, spawnTrafficCar, stepPed, stepTrafficCar } from './traffic.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

/** The camera the renderer uses, recomputed here so the mouse can aim in world space. */
export function cameraFor(player) {
  return {
    x: Math.max(0, Math.min(WORLD.width - VIEW.width, player.x - VIEW.width / 2)),
    y: Math.max(0, Math.min(WORLD.height - VIEW.height, player.y - VIEW.height / 2)),
  };
}

export function createGame(seedValue) {
  const random = createRandom(seedValue);
  const city = createCity(random);
  const police = createPolice();
  const missions = createMissions(random);
  const audio = createAudio();

  const player = {
    x: ROAD_X[3],
    y: ROAD_Y[2],
    angle: 0,
    health: PLAYER.health,
    cash: 0,
    wanted: 0,
    wantedHeat: 0,
    car: null,
    punchCooldown: 0,
    shootCooldown: 0,
    violent: 0,
    invulnerable: 0,
  };

  const game = {
    seed: seedValue,
    random,
    city,
    roadX: ROAD_X,
    roadY: ROAD_Y,
    player,
    police,
    missions,
    audio,
    cars: [],
    peds: [],
    pickups: [],
    bullets: [],
    time: 0,
    events: [],
    bannerText: '',
    bannerTimer: 0,
    bestCash: 0,
    overReason: '',
    aim: false,
    reset,
    step,
    banner,
    save,
    load,
  };

  function banner(text) {
    game.bannerText = text;
    game.bannerTimer = 3.5;
  }

  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: player.cash,
        missionsDone: missions.state.index,
        bestCash: game.bestCash,
      }));
    } catch {
      // Storage can be off (private windows): progress then lasts this visit only.
    }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.cash === 'number') player.cash = data.cash;
      if (typeof data.missionsDone === 'number') missions.state.index = Math.min(3, data.missionsDone);
      if (typeof data.bestCash === 'number') game.bestCash = data.bestCash;
    } catch {
      // A corrupt save is ignored; the game starts fresh.
    }
  }

  function reset() {
    player.x = ROAD_X[3];
    player.y = ROAD_Y[2];
    player.angle = 0;
    player.health = PLAYER.health;
    player.wanted = 0;
    player.wantedHeat = 0;
    player.car = null;
    player.punchCooldown = 0;
    player.shootCooldown = 0;
    player.violent = 0;
    player.invulnerable = 0;
    game.cars = [];
    game.peds = [];
    game.bullets = [];
    game.events = [];
    game.time = 0;
    game.bannerText = '';
    game.bannerTimer = 0;
    game.overReason = '';
    police.state.cars.length = 0;
    police.state.cops.length = 0;
    missions.state.status = 'none';
    missions.state.stage = 0;
    missions.state.marker = null;
    missions.state.objective = '';
    missions.state.lines = [];
    missions.state.lineTimer = 0;
    missions.state.packages = [];
    missions.state.collected = 0;
    for (let i = 0; i < 16; i += 1) {
      const car = spawnTrafficCar(random, player);
      car.cruiseJitter = (random() - 0.5) * 90;
      game.cars.push(car);
    }
    for (let i = 0; i < 26; i += 1) game.peds.push(spawnPed(random, player));
    game.pickups = createPickups(random, 12);
  }

  /** The nearest car within `range` of the player, or null. */
  function nearestCar(range) {
    let best = null;
    let bestD = range;
    for (const car of game.cars) {
      if (car.wrecked) continue;
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (player.car) {
      const d = 0;
      if (d < bestD) best = player.car;
    }
    return best;
  }

  function enterCar() {
    const car = nearestCar(64);
    if (!car) return;
    if (car.kind === KIND_TRAFFIC) {
      // Stealing a car is a crime: the heat notices.
      car.kind = KIND_PLAYER;
      car.color = PALETTE.playerCar;
      car.driver = 'player';
      police.addWanted(player, 1);
      banner('Car stolen! The heat is on.');
      audio.mission();
    }
    player.car = car;
    player.x = car.x;
    player.y = car.y;
    game.cars = game.cars.filter((c) => c !== car);
  }

  function exitCar() {
    const car = player.car;
    if (!car) return;
    player.car = null;
    car.speed = 0;
    player.x = car.x - Math.sin(car.angle) * 40;
    player.y = car.y + Math.cos(car.angle) * 40;
    player.angle = car.angle;
    game.cars.push(car);
  }

  function punch() {
    if (player.punchCooldown > 0) return;
    player.punchCooldown = PLAYER.punchCooldown;
    player.violent = 1.2;
    audio.punch();
    const reach = PLAYER.punchRange;
    // A cop takes the hit and goes down.
    for (let i = police.state.cops.length - 1; i >= 0; i -= 1) {
      const cop = police.state.cops[i];
      if (Math.hypot(cop.x - player.x, cop.y - player.y) < reach + 12) {
        police.state.cops.splice(i, 1);
        police.addWanted(player, 1);
        banner('You decked a cop! That will cost you.');
        return;
      }
    }
    // A pedestrian gets scared off (and drops some cash).
    for (const ped of game.peds) {
      if (Math.hypot(ped.x - player.x, ped.y - player.y) < reach + 10) {
        ped.state = 'flee';
        ped.timer = 3;
        player.cash += 10;
        police.addWanted(player, 1);
        return;
      }
    }
    // Punching a car dents it.
    for (const car of game.cars) {
      if (Math.hypot(car.x - player.x, car.y - player.y) < reach + 22) {
        car.health -= PLAYER.punchDamage;
        if (car.health <= 0) car.wrecked = true;
        return;
      }
    }
  }

  function shoot(cam, mouse) {
    if (player.shootCooldown > 0 || player.car) return;
    player.shootCooldown = PLAYER.shootCooldown;
    player.violent = 1.5;
    const wx = mouse.x + cam.x;
    const wy = mouse.y + cam.y;
    const angle = Math.atan2(wy - player.y, wx - player.x);
    player.angle = angle;
    game.bullets.push({
      x: player.x + Math.cos(angle) * 20,
      y: player.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * PLAYER.bulletSpeed,
      vy: Math.sin(angle) * PLAYER.bulletSpeed,
      life: 0.9,
    });
    audio.shoot();
    police.addWanted(player, 1);
  }

  function stepPlayerOnFoot(dt, dir, input, cam, mouse) {
    const running = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    player.x += dir.x * speed * dt;
    player.y += dir.y * speed * dt;
    if (dir.x !== 0 || dir.y !== 0) player.angle = Math.atan2(dir.y, dir.x);
    city.collideCircle(player, PLAYER.radius);
    city.clampToLand(player, PLAYER.radius);
    // Aim at the mouse (already in logical view coordinates).
    const wx = mouse.x + cam.x;
    const wy = mouse.y + cam.y;
    player.angle = Math.atan2(wy - player.y, wx - player.x);
    game.aim = true;
    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    if (player.shootCooldown > 0) player.shootCooldown -= dt;
    if (player.violent > 0) player.violent -= dt;
    if (player.invulnerable > 0) player.invulnerable -= dt;
    // Pick up cash.
    for (const pk of game.pickups) {
      if (pk.taken) continue;
      if (Math.hypot(pk.x - player.x, pk.y - player.y) < 30) {
        pk.taken = true;
        player.cash += pk.amount;
        audio.coin();
        banner(`+$${pk.amount} found on the street.`);
      }
    }
    // Slow health recovery while nobody is looking for you (not from death).
    if (player.wanted === 0 && player.health > 0 && player.health < PLAYER.health) {
      player.health = Math.min(PLAYER.health, player.health + 2.5 * dt);
    }
  }

  function stepPlayerDriving(dt, dir) {
    const car = player.car;
    game.aim = false;
    const onRoad = isRoad(car.x, car.y);
    const throttle = -dir.y; // W / Up is forward.
    const steering = dir.x;
    if (throttle > 0) car.speed += CAR.accel * dt;
    else if (throttle < 0) {
      if (car.speed > 5) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    }
    // Steering bites harder the faster the car goes, and not at all standing still.
    const steerAuthority = Math.min(1, Math.abs(car.speed) / 120);
    car.angle += steering * CAR.turnRate * steerAuthority * dt * Math.sign(car.speed || 1);
    const drag = onRoad ? CAR.drag : CAR.offRoadDrag;
    car.speed -= car.speed * drag * dt;
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const hitBuilding = city.collideCircle(car, 24);
    if (hitBuilding && Math.abs(car.speed) > 120) {
      car.health -= 6;
      car.speed *= 0.45;
      audio.crash();
      game.events.push({ type: 'crash' });
    } else if (hitBuilding) {
      car.speed *= 0.7;
    }
    city.clampToLand(car, 26);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    if (car.health <= 0 && !car.wrecked) {
      car.wrecked = true;
      car.speed = 0;
      banner('Your car is wrecked! Bail out and run.');
      exitCar();
    }
    // Running over a pedestrian is a crime.
    for (const ped of game.peds) {
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30) {
        ped.state = 'flee';
        ped.timer = 3;
        ped.x += Math.cos(car.angle) * 60;
        ped.y += Math.sin(car.angle) * 60;
        if (player.invulnerable <= 0) {
          police.addWanted(player, 1);
          player.invulnerable = 1.5;
          audio.crash();
        }
      }
    }
  }

  function stepBullets(dt) {
    for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
      const b = game.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || isWater(b.x, b.y);
      // Buildings stop bullets.
      if (!dead) {
        for (const bd of city.buildings) {
          if (b.x > bd.x && b.x < bd.x + bd.width && b.y > bd.y && b.y < bd.y + bd.height) {
            dead = true;
            break;
          }
        }
      }
      // Cops and pedestrians get hit.
      if (!dead) {
        for (let j = police.state.cops.length - 1; j >= 0; j -= 1) {
          const cop = police.state.cops[j];
          if (Math.hypot(cop.x - b.x, cop.y - b.y) < 14) {
            police.state.cops.splice(j, 1);
            police.addWanted(player, 1);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of game.peds) {
          if (Math.hypot(ped.x - b.x, ped.y - b.y) < 13) {
            ped.state = 'flee';
            ped.timer = 3;
            police.addWanted(player, 1);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of [...game.cars, ...police.state.cars]) {
          if (Math.hypot(car.x - b.x, car.y - b.y) < 28) {
            car.health -= PLAYER.bulletDamage;
            if (car.health <= 0) car.wrecked = true;
            dead = true;
            break;
          }
        }
      }
      if (dead) game.bullets.splice(i, 1);
    }
  }

  function step(dt, input, extraActions = 0) {
    game.time += dt;
    if (game.bannerTimer > 0) game.bannerTimer -= dt;
    const cam = cameraFor(player);
    // The mouse arrives in CSS pixels; convert to logical view coordinates
    // when the renderer is attached (a real browser window), else use it raw
    // (the screenshot stager already works in logical coordinates).
    const mouse = game.toLogical
      ? game.toLogical(input.mouse.x, input.mouse.y)
      : { x: input.mouse.x, y: input.mouse.y };
    const dir = input.direction();
    // Actions arrive both from this frame's input and from the loop, which
    // already took them once to handle start/pause (see runGame).
    const actions = input.takeActions() | extraActions;

    if (actions & ACTION_INTERACT) {
      if (player.car) exitCar();
      else enterCar();
    }
    if (actions & ACTION_PUNCH && !player.car) punch();
    if (actions & ACTION_SHOOT && !player.car) shoot(cam, mouse);

    if (player.car) stepPlayerDriving(dt, dir);
    else stepPlayerOnFoot(dt, dir, input, cam, mouse);

    for (const car of game.cars) stepTrafficCar(car, dt, [...game.cars, ...(player.car ? [player.car] : []), ...police.state.cars], random);
    separateCars([...game.cars, ...(player.car ? [player.car] : []), ...police.state.cars]);
    for (const ped of game.peds) stepPed(ped, dt, random, player, player);
    police.step(dt, player, random, city, game);
    missions.step(dt, game);
    stepBullets(dt);

    // Traffic respawns far away so the streets never empty out.
    if (game.cars.length < 14) {
      const car = spawnTrafficCar(random, player);
      car.cruiseJitter = (random() - 0.5) * 90;
      game.cars.push(car);
    }
    if (game.peds.length < 24) game.peds.push(spawnPed(random, player));

    // Sound follows the drive and the siren.
    audio.setEngine(player.car ? player.car.speed : 0, CAR.maxSpeed, !!player.car);
    audio.setSiren(player.wanted > 0, dt);

    // Event reactions (sounds, banners, game over).
    for (const event of game.events) {
      if (event.type === 'crash') audio.crash();
      else if (event.type === 'hit') audio.hurt();
      else if (event.type === 'pickup') audio.pickup();
      else if (event.type === 'busted') game.overReason = 'busted';
    }
    game.events.length = 0;

    if (player.health <= 0) game.overReason = 'wasted';
    if (player.cash > game.bestCash) game.bestCash = player.cash;
  }

  load();
  reset();
  return game;
}

function runShot(name) {
  const game = createGame(seed);
  const renderer = createRenderer(canvas);
  const scene = stageShot(name, game);
  window.__game = { state: scene.screen, world: game };
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const game = createGame(seed);
  const renderer = createRenderer(canvas);
  // Wire the renderer's coordinate transform into the game so mouse aim
  // lands where the player points, whatever the window size or pixel ratio.
  game.toLogical = renderer.toLogical;
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let prevM = false;
  // One-shot actions the loop already took for start/pause handling, kept
  // for the next simulation step so E / F / click are not eaten (see step()).
  let pendingActions = 0;

  window.__game = { state: screen, world: game };

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    game.reset();
    // Keep the saved cash and mission progress across restarts.
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (typeof data.cash === 'number') game.player.cash = data.cash;
        if (typeof data.missionsDone === 'number') game.missions.state.index = Math.min(3, data.missionsDone);
      }
    } catch {
      // Ignore a bad save.
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    window.__game.state = screen;
    pendingActions = 0;
    announce('Playing. Steal a car, run the jobs, dodge the law.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    window.__game.state = screen;
    if (game.overReason === 'busted') {
      game.player.cash = Math.floor(game.player.cash / 2);
    }
    game.save();
    announce(game.overReason === 'busted' ? 'Busted. Half your cash is gone.' : 'Wasted. Press Space to run it back.');
  }

  function handleActions() {
    const actions = input.takeActions();
    // Keep the gameplay actions for the simulation step below; this function
    // only handles start / pause itself.
    pendingActions |= actions & (ACTION_INTERACT | ACTION_PUNCH | ACTION_SHOOT);
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      game.audio.unlock();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      window.__game.state = screen;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      window.__game.state = screen;
      announce('Playing.');
    }
    // M starts the next job (edge-triggered, only while playing).
    const mDown = input.isDown('KeyM');
    if (mDown && !prevM && screen === SCREEN_PLAY && game.missions.state.status !== MISSION_ACTIVE) {
      if (game.missions.start()) {
        game.audio.mission();
        announce(`Job started: ${game.missions.currentDef().title}.`);
      }
    }
    prevM = mDown;
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title screen shows the city alive: traffic and pedestrians move.
      game.step(STEP, {
        direction: () => ({ x: 0, y: 0 }),
        takeActions: () => 0,
        isDown: () => false,
        mouse: { x: 640, y: 300, down: false },
      });
      return;
    }
    game.step(STEP, input, pendingActions);
    pendingActions = 0;
    if (game.overReason !== '') endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      window.__game.state = screen;
      announce('Paused.');
    }
  });

  // Save every few seconds while playing so a closed tab keeps the cash.
  window.setInterval(() => {
    if (screen === SCREEN_PLAY) game.save();
  }, 5000);

  announce('Coral Bay Heat. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
