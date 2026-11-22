// Three story missions, played in order, plus the free-roam cash pickups.
// A mission is a small state machine: a list of stages, each with a marker,
// a line of dialogue, and a condition that completes it. Finishing pays cash
// and unlocks the next job.

import { MISSIONS } from './config.js';
import { ROAD_X, ROAD_Y, nearestRoadPoint } from './world.js';

export const MISSION_NONE = 'none';
export const MISSION_ACTIVE = 'active';
export const MISSION_DONE = 'done';

const LINES = {
  getawayIntro: [
    'Rook: "Listen, kid. The crew needs a wheelman tonight."',
    'Rook: "Boost any car, pick up Marla at the pier, then lose the tail and bring her to the warehouse."',
  ],
  getawayPickup: 'Marla: "About time. Drive — and don\'t baby the pedal."',
  getawayDrop: 'Marla: "Clean run. The warehouse is yours, driver."',
  pickupIntro: [
    'Rook: "Three packages stashed around town. Grab them all, bring them to the warehouse."',
    'Rook: "Cops love a courier. Keep it quiet — or don\'t. Your call."',
  ],
  pickupGot: (n) => `Package ${n} of 3 secured.`,
  pickupDone: 'Rook: "All three. You\'re earning a name, kid."',
  deliveryIntro: [
    'Marla: "One last job. Hot cargo, fragile, and the whole city between us and the buyer."',
    'Marla: "Two minutes. Scratch the paint and the deal is off — well, mostly off."',
  ],
  deliveryDone: 'Marla: "Delivered. Coral Bay is yours now, driver."',
};

export function createMissions(random) {
  const state = {
    index: 0, // which mission of MISSIONS is current (3 = all done)
    status: MISSION_NONE,
    stage: 0,
    timer: 0,
    marker: null,
    objective: '',
    lines: [],
    lineTimer: 0,
    packages: [],
    collected: 0,
    failed: false,
  };

  function currentDef() {
    return MISSIONS[state.index] ?? null;
  }

  function setObjective(text) {
    state.objective = text;
  }

  function say(lines) {
    state.lines = Array.isArray(lines) ? lines : [lines];
    state.lineTimer = 4.5;
  }

  function start() {
    const def = currentDef();
    if (!def) return false;
    state.status = MISSION_ACTIVE;
    state.stage = 0;
    state.failed = false;
    state.timer = def.timeLimit;
    state.collected = 0;
    state.packages = [];
    if (def.id === 'getaway') {
      state.marker = { x: ROAD_X[3], y: 2160, label: 'Pier — pick up Marla' };
      setObjective('Steal a car, then pick up Marla at the pier');
      say(LINES.getawayIntro);
    } else if (def.id === 'pickup') {
      const spots = [
        { x: ROAD_X[1], y: ROAD_Y[3] },
        { x: ROAD_X[6], y: ROAD_Y[0] },
        { x: ROAD_X[2], y: ROAD_Y[4] },
      ];
      state.packages = spots.map((p, i) => ({ ...p, taken: false, label: `Package ${i + 1}` }));
      state.marker = { ...spots[0], label: 'Package 1' };
      setObjective('Collect 3 packages, then deliver them to the warehouse');
      say(LINES.pickupIntro);
    } else if (def.id === 'delivery') {
      state.marker = { x: ROAD_X[6], y: ROAD_Y[4], label: 'Buyer — across town' };
      setObjective('Drive the hot cargo to the buyer across town');
      say(LINES.deliveryIntro);
    }
    return true;
  }

  function complete(game) {
    const def = currentDef();
    state.status = MISSION_DONE;
    state.marker = null;
    state.objective = '';
    if (def) {
      game.player.cash += def.reward;
      game.banner(`Job done! +$${def.reward}`);
      say(def.id === 'getaway' ? LINES.getawayDrop : def.id === 'pickup' ? LINES.pickupDone : LINES.deliveryDone);
    }
    state.index += 1;
    state.lineTimer = 5;
  }

  function fail(game, reason) {
    state.status = MISSION_NONE;
    state.failed = true;
    state.marker = null;
    state.objective = '';
    game.banner(reason);
    say('Rook: "Job blown. Come back when you\'re ready to try again."');
  }

  /** One step of the active mission; returns true while it is running. */
  function step(dt, game) {
    if (state.lineTimer > 0) state.lineTimer -= dt;
    if (state.status !== MISSION_ACTIVE) return false;
    const def = currentDef();
    state.timer -= dt;
    if (state.timer <= 0) {
      fail(game, 'Out of time — the job fell through.');
      return false;
    }
    const p = game.player;
    if (def.id === 'getaway') {
      if (state.stage === 0) {
        // Reach the pier (in a car, ideally — on foot counts, slowly).
        const d = Math.hypot(p.x - state.marker.x, p.y - state.marker.y);
        if (d < 70) {
          state.stage = 1;
          state.marker = { x: game.city.warehouse.x, y: game.city.warehouse.y, label: 'Warehouse — drop off Marla' };
          setObjective('Drive Marla to the warehouse');
          say(LINES.getawayPickup);
          game.events.push({ type: 'pickup' });
        }
      } else if (state.stage === 1) {
        const d = Math.hypot(p.x - state.marker.x, p.y - state.marker.y);
        if (d < 80 && p.car) {
          complete(game);
        } else if (d < 80) {
          setObjective('You need a car to finish the drop-off!');
        }
      }
    } else if (def.id === 'pickup') {
      const next = state.packages.find((pkg) => !pkg.taken);
      if (next) {
        state.marker = { ...next, label: `Package ${state.collected + 1}` };
        const d = Math.hypot(p.x - next.x, p.y - next.y);
        if (d < 46) {
          next.taken = true;
          state.collected += 1;
          game.events.push({ type: 'pickup' });
          say(LINES.pickupGot(state.collected));
          if (state.collected === 3) {
            state.marker = { x: game.city.warehouse.x, y: game.city.warehouse.y, label: 'Warehouse — deliver' };
            setObjective('Deliver the packages to the warehouse');
          }
        }
      } else {
        const d = Math.hypot(p.x - game.city.warehouse.x, p.y - game.city.warehouse.y);
        if (d < 80) complete(game);
      }
    } else if (def.id === 'delivery') {
      const d = Math.hypot(p.x - state.marker.x, p.y - state.marker.y);
      if (d < 80) {
        if (p.car && p.car.health > 40) complete(game);
        else if (!p.car) setObjective('You lost the car! Get a car to the buyer.');
        else setObjective('The cargo is too damaged — this run is blown.');
      }
      // Smashing the cargo car hard can blow the job early.
      if (p.car && p.car.health <= 25) {
        fail(game, 'The cargo is smashed — the buyer walked away.');
        return false;
      }
    }
    return true;
  }

  /** The next mission's title for the title screen / HUD, or null when done. */
  function nextTitle() {
    const def = currentDef();
    return def ? `${def.title} — $${def.reward}` : null;
  }

  return { state, start, step, nextTitle, currentDef };
}

/** Cash pickups scattered around the city for free roam. */
export function createPickups(random, count) {
  const pickups = [];
  for (let i = 0; i < count; i += 1) {
    const p = nearestRoadPoint(
      240 + random() * 2700,
      240 + random() * 1700,
    );
    pickups.push({
      x: p.x + (random() < 0.5 ? -70 : 70) * (p.vertical ? 1 : 0) + (random() - 0.5) * 40,
      y: p.y + (random() < 0.5 ? -70 : 70) * (p.vertical ? 0 : 1) + (random() - 0.5) * 40,
      amount: 25 + Math.floor(random() * 4) * 25,
      taken: false,
      bob: random() * Math.PI * 2,
    });
  }
  return pickups;
}
