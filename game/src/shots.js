// The screenshot scenes behind ?shot=start|chase|mission|street. Each one sets
// up a real game state — a car, a wanted level, an active mission — and then
// plays the real rules forward for a few seconds, so the frame is what a short
// game really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { ROAD_X, ROAD_Y } from './world.js';
import { makeCar, KIND_PLAYER } from './traffic.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** A fake input that holds one driving direction, for staging scenes. */
function shotInput(dirX, dirY) {
  return {
    direction: () => ({ x: dirX, y: dirY }),
    takeActions: () => 0,
    isDown: () => false,
    mouse: { x: 640, y: 300, down: false },
  };
}

function driveNorth(game, seconds) {
  const input = shotInput(0, -1);
  for (let i = 0; i < seconds / STEP; i += 1) game.step(STEP, input);
}

function idle(game, seconds) {
  const input = shotInput(0, 0);
  for (let i = 0; i < seconds / STEP; i += 1) game.step(STEP, input);
}

/** Put the player in a car on a road, facing the given angle. */
function giveCar(game, x, y, angle) {
  const car = makeCar(x, y, angle, KIND_PLAYER, '#e8443a');
  car.speed = 0;
  game.player.car = car;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  return car;
}

/** Pull the police cars in close behind the player's car so the chase reads on screen. */
function closeTheChase(game) {
  const p = game.player;
  // The drive may have wrecked the car (police rams): hand back a fresh one.
  if (!p.car) {
    giveCar(game, p.x, p.y, p.angle);
  }
  p.car.health = 100;
  p.car.wrecked = false;
  p.health = 100;
  game.bannerText = '';
  game.bannerTimer = 0;
  const behind = { x: -Math.cos(p.angle), y: -Math.sin(p.angle) };
  const side = { x: -Math.sin(p.angle), y: Math.cos(p.angle) };
  game.police.state.cars.forEach((car, i) => {
    const back = 140 + i * 70;
    const off = (i - 1) * 55;
    car.x = p.x + behind.x * back + side.x * off;
    car.y = p.y + behind.y * back + side.y * off;
    car.angle = p.angle;
    car.speed = 460;
  });
}

/**
 * Set `game` to the named scene (start, chase, mission, street; any other name
 * is start) and return the screen to draw over it.
 */
export function stageShot(name, game) {
  game.reset();
  if (name === 'chase') {
    // The cover: a police chase, three stars, a mission running.
    giveCar(game, ROAD_X[3], ROAD_Y[2] + 120, -Math.PI / 2);
    game.missions.start();
    game.police.addWanted(game.player, 3);
    driveNorth(game, 7);
    // Frame the chase mid-map: cut back to a downtown stretch at speed.
    if (!game.player.car) giveCar(game, ROAD_X[3], ROAD_Y[2] + 120, -Math.PI / 2);
    const car = game.player.car;
    car.x = ROAD_X[3];
    car.y = ROAD_Y[2] + 120;
    car.angle = -Math.PI / 2;
    car.speed = 380;
    car.health = 100;
    car.wrecked = false;
    game.player.x = car.x;
    game.player.y = car.y;
    game.player.angle = car.angle;
    game.player.health = 100;
    game.bannerText = '';
    game.bannerTimer = 0;
    closeTheChase(game);
    driveNorth(game, 0.3);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // The first job: driving south to the pier to pick up Marla.
    giveCar(game, ROAD_X[3], 1850, Math.PI / 2);
    game.missions.start();
    driveNorth(game, 0.8);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'street') {
    // On foot on the beach, the sea behind, pedestrians strolling nearby.
    game.player.x = ROAD_X[4] - 180;
    game.player.y = 2120;
    game.player.angle = Math.PI / 2;
    // Pull a few pedestrians down to the sand so the scene has life.
    game.peds.slice(0, 4).forEach((ped, i) => {
      ped.x = ROAD_X[4] - 320 + i * 130;
      ped.y = 2100 + (i % 2) * 50;
      ped.angle = Math.PI / 2;
    });
    idle(game, 3);
    return { screen: SCREEN_PLAY };
  }
  // The title screen over a living city.
  idle(game, 5);
  return { screen: SCREEN_TITLE };
}

export { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE };
