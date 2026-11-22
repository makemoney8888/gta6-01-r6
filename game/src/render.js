// The renderer: a camera that follows the player, the city painted in layers
// (ground, beach, roads, parks, buildings, cars, people, bullets, effects),
// then the HUD, then the title / pause / game-over screens.

import { BEACH, FONT, GRID, PALETTE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_TITLE, TITLE_FONT, VIEW, WORLD } from './config.js';
import { ROAD_X, ROAD_Y } from './world.js';
import { drawHUD } from './hud.js';

export { SCREEN_OVER, SCREEN_PAUSED, SCREEN_TITLE };
export const SCREEN_PLAY = 'play';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    offsetX = (canvas.width - VIEW.width * scale) / 2;
    offsetY = (canvas.height - VIEW.height * scale) / 2;
  }

  window.addEventListener('resize', resize);
  resize();

  function drawGround(cam) {
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(cam.x - 40, cam.y - 40, VIEW.width + 80, VIEW.height + 80);
    // Mow stripes for a little texture.
    ctx.fillStyle = PALETTE.grassDark;
    const stripe = 160;
    const startY = Math.floor(cam.y / stripe) * stripe;
    for (let y = startY; y < cam.y + VIEW.height + stripe; y += stripe * 2) {
      ctx.fillRect(cam.x - 40, y, VIEW.width + 80, stripe);
    }
    // Beach sand and sea.
    if (cam.y + VIEW.height > BEACH.sandY) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(cam.x - 40, BEACH.sandY, VIEW.width + 80, BEACH.waterY - BEACH.sandY);
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(cam.x - 40, BEACH.waterY, VIEW.width + 80, WORLD.height - BEACH.waterY + 80);
      // Gentle wave lines.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i += 1) {
        const wy = BEACH.waterY + 26 + i * 34;
        ctx.beginPath();
        for (let x = cam.x - 40; x < cam.x + VIEW.width + 80; x += 24) {
          const yy = wy + Math.sin(x * 0.02 + i * 2) * 4;
          if (x === cam.x - 40) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    }
  }

  function drawRoads(cam) {
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROAD_X) {
      if (rx + GRID.halfRoad < cam.x || rx - GRID.halfRoad > cam.x + VIEW.width) continue;
      ctx.fillRect(rx - GRID.halfRoad, cam.y - 40, GRID.roadWidth, VIEW.height + 80);
    }
    for (const ry of ROAD_Y) {
      if (ry + GRID.halfRoad < cam.y || ry - GRID.halfRoad > cam.y + VIEW.height) continue;
      ctx.fillRect(cam.x - 40, ry - GRID.halfRoad, VIEW.width + 80, GRID.roadWidth);
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const rx of ROAD_X) {
      if (rx < cam.x || rx > cam.x + VIEW.width) continue;
      const startY = Math.floor(cam.y / 48) * 48;
      for (let y = startY; y < cam.y + VIEW.height; y += 48) {
        if (ROAD_Y.some((ry) => Math.abs(y - ry) < GRID.halfRoad + 10)) continue;
        ctx.fillRect(rx - 2, y, 4, 24);
      }
    }
    for (const ry of ROAD_Y) {
      if (ry < cam.y || ry > cam.y + VIEW.height) continue;
      const startX = Math.floor(cam.x / 48) * 48;
      for (let x = startX; x < cam.x + VIEW.width; x += 48) {
        if (ROAD_X.some((rx) => Math.abs(x - rx) < GRID.halfRoad + 10)) continue;
        ctx.fillRect(x, ry - 2, 24, 4);
      }
    }
  }

  function drawParksAndTrees(cam, city) {
    for (const park of city.parks) {
      if (park.x > cam.x + VIEW.width || park.x + park.width < cam.x || park.y > cam.y + VIEW.height || park.y + park.height < cam.y) continue;
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.width, park.height);
    }
    for (const tree of city.trees) {
      if (tree.x < cam.x - 20 || tree.x > cam.x + VIEW.width + 20 || tree.y < cam.y - 20 || tree.y > cam.y + VIEW.height + 20) continue;
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(tree.x - 2, tree.y - 2, 4, 8);
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(tree.x, tree.y - 6, tree.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBuildings(cam, city) {
    for (const b of city.buildings) {
      if (b.x > cam.x + VIEW.width || b.x + b.width < cam.x || b.y > cam.y + VIEW.height || b.y + b.height < cam.y) continue;
      // Shadow, offset down-right.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 7, b.y + 9, b.width, b.height);
      ctx.fillStyle = b.color;
      ctx.globalAlpha = b.shade;
      ctx.fillRect(b.x, b.y, b.width, b.height);
      ctx.globalAlpha = 1;
      // Roof edge.
      ctx.fillStyle = PALETTE.buildingRoof;
      ctx.fillRect(b.x, b.y, b.width, 6);
      // Windows.
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      const cols = Math.floor(b.width / 26);
      const rows = Math.floor(b.height / 26);
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if ((c * 7 + r * 3 + Math.floor(b.x)) % 5 === 0) continue;
          ctx.fillRect(b.x + 8 + c * 26, b.y + 12 + r * 26, 12, 12);
        }
      }
    }
  }

  function drawCarShape(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const len = 52;
    const wid = 26;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -wid / 2, len, wid, 7);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,28,40,0.85)';
    ctx.beginPath();
    ctx.roundRect(-8, -wid / 2 + 4, 18, wid - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.7)';
    ctx.fillRect(8, -wid / 2 + 5, 5, wid - 10);
    // Headlights.
    ctx.fillStyle = '#fff8c9';
    ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 5);
    ctx.fillRect(len / 2 - 3, wid / 2 - 8, 3, 5);
    // Police light bar, flashing red/blue.
    if (car.kind === 'police') {
      const phase = Math.floor(car.sirenPhase) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2d2d' : '#2b6fd6';
      ctx.fillRect(-4, -wid / 2 + 1, 8, 6);
      ctx.fillStyle = phase ? '#2b6fd6' : '#ff2d2d';
      ctx.fillRect(-4, wid / 2 - 7, 8, 6);
    }
    if (car.wrecked) {
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-len / 2 + 4, -wid / 2 + 4);
      ctx.lineTo(len / 2 - 4, wid / 2 - 4);
      ctx.moveTo(len / 2 - 4, -wid / 2 + 4);
      ctx.lineTo(-len / 2 + 4, wid / 2 - 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, radius, isCop) {
    ctx.save();
    ctx.translate(x, y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(1, 3, radius, radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick.
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    ctx.stroke();
    if (isCop) {
      ctx.fillStyle = '#dfe8ff';
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMarker(game) {
    const marker = game.missions.state.marker;
    if (!marker) return;
    const pulse = 1 + Math.sin(game.time * 5) * 0.12;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.scale(pulse, pulse);
    // A diamond pin above the ground.
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(12, -18);
    ctx.lineTo(0, -2);
    ctx.lineTo(-12, -18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a5b00';
    ctx.beginPath();
    ctx.arc(0, -19, 4, 0, Math.PI * 2);
    ctx.fill();
    // Ring on the ground.
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // Label, clear of the dialogue panel below.
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const w = ctx.measureText(marker.label).width + 14;
    ctx.fillRect(marker.x - w / 2, marker.y - 84, w, 20);
    ctx.fillStyle = '#fff';
    ctx.fillText(marker.label, marker.x, marker.y - 70);
  }

  function drawPickups(cam, game) {
    for (const pk of game.pickups) {
      if (pk.taken) continue;
      if (pk.x < cam.x - 30 || pk.x > cam.x + VIEW.width + 30 || pk.y < cam.y - 30 || pk.y > cam.y + VIEW.height + 30) continue;
      const bob = Math.sin(game.time * 3 + pk.bob) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5b00';
      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
    for (const pkg of game.missions.state.packages) {
      if (pkg.taken) continue;
      if (pkg.x < cam.x - 30 || pkg.x > cam.x + VIEW.width + 30 || pkg.y < cam.y - 30 || pkg.y > cam.y + VIEW.height + 30) continue;
      ctx.save();
      ctx.translate(pkg.x, pkg.y);
      ctx.fillStyle = '#8a5a2b';
      ctx.fillRect(-10, -10, 20, 20);
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 2;
      ctx.strokeRect(-10, -10, 20, 20);
      ctx.restore();
    }
  }

  function drawWorld(game) {
    const p = game.player;
    const cam = {
      x: Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2)),
      y: Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2)),
    };
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawGround(cam);
    drawRoads(cam);
    drawParksAndTrees(cam, game.city);
    // Spray shop + warehouse pads.
    ctx.fillStyle = '#ff8c42';
    ctx.fillRect(game.city.spray.x - 46, game.city.spray.y - 46, 92, 92);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('SPRAY', game.city.spray.x, game.city.spray.y + 4);
    ctx.fillStyle = '#9a7bff';
    ctx.fillRect(game.city.warehouse.x - 46, game.city.warehouse.y - 46, 92, 92);
    ctx.fillStyle = '#fff';
    ctx.fillText('WAREHOUSE', game.city.warehouse.x, game.city.warehouse.y + 4);
    drawBuildings(cam, game.city);
    drawMarker(game);
    drawPickups(cam, game);
    // Cars: traffic + police + the player's car.
    const cars = [...game.cars, ...game.police.state.cars];
    if (p.car) cars.push(p.car);
    for (const car of cars) {
      if (car.x < cam.x - 60 || car.x > cam.x + VIEW.width + 60 || car.y < cam.y - 60 || car.y > cam.y + VIEW.height + 60) continue;
      drawCarShape(car);
    }
    // Pedestrians and foot cops.
    for (const ped of game.peds) {
      if (ped.x < cam.x - 30 || ped.x > cam.x + VIEW.width + 30 || ped.y < cam.y - 30 || ped.y > cam.y + VIEW.height + 30) continue;
      drawPerson(ped.x, ped.y, ped.angle, ped.color, 10, false);
    }
    for (const cop of game.police.state.cops) {
      if (cop.x < cam.x - 30 || cop.x > cam.x + VIEW.width + 30 || cop.y < cam.y - 30 || cop.y > cam.y + VIEW.height + 30) continue;
      drawPerson(cop.x, cop.y, cop.angle, cop.color, 11, true);
      if (cop.arrest > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('ARRESTING…', cop.x, cop.y - 22);
      }
    }
    // Bullets.
    ctx.fillStyle = '#ffe66d';
    for (const b of game.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // The player on foot (hidden while driving).
    if (!p.car) {
      drawPerson(p.x, p.y, p.angle, PALETTE.player, 13, false);
      // Aim line toward the mouse.
      if (game.aim) {
        ctx.strokeStyle = 'rgba(255,210,62,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(p.angle) * 46, p.y + Math.sin(p.angle) * 46);
        ctx.stroke();
      }
    }
    ctx.restore();
    return cam;
  }

  function drawTitle(game) {
    ctx.fillStyle = 'rgba(8, 12, 20, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23e';
    ctx.font = TITLE_FONT;
    ctx.fillText('CORAL BAY HEAT', VIEW.width / 2, 190);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('Steal cars. Outrun the law. Run the jobs.', VIEW.width / 2, 236);
    ctx.font = '16px ' + FONT;
    ctx.fillStyle = '#dfe6ee';
    const lines = [
      'WASD / arrows — move or drive · E — steal / exit car · F — punch · Click — shoot',
      'Shift — run · M — start the next job · P / Esc — pause',
      'Lose the heat by hiding, or pay $200 at the Spray Shop.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 300 + i * 28));
    const next = game.missions.nextTitle();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 18px ' + FONT;
    ctx.fillText(next ? `Next job: ${next}` : 'All jobs complete — free roam!', VIEW.width / 2, 408);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText(game.bestCash > 0 ? `Best cash: $${game.bestCash}   ·   Press SPACE to play` : 'Press SPACE to play', VIEW.width / 2, 470);
    ctx.font = '14px ' + FONT;
    ctx.fillStyle = '#aeb6c2';
    ctx.fillText('Progress saves in this browser.', VIEW.width / 2, 510);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8, 12, 20, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = TITLE_FONT;
    ctx.fillText('PAUSED', VIEW.width / 2, 300);
    ctx.font = '18px ' + FONT;
    ctx.fillText('Press P or Esc to keep playing', VIEW.width / 2, 350);
  }

  function drawOver(game) {
    ctx.fillStyle = 'rgba(20, 6, 8, 0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b5e';
    ctx.font = TITLE_FONT;
    ctx.fillText(game.overReason === 'busted' ? 'BUSTED!' : 'WASTED!', VIEW.width / 2, 260);
    ctx.fillStyle = '#fff';
    ctx.font = '20px ' + FONT;
    ctx.fillText(
      game.overReason === 'busted'
        ? 'The Coral Bay PD hauled you in. Bail is steep — half your cash is gone.'
        : 'You went down hard on the streets of Coral Bay.',
      VIEW.width / 2, 316,
    );
    ctx.font = '18px ' + FONT;
    ctx.fillText(`Cash: $${game.player.cash}   ·   Jobs done: ${game.missions.state.index} of 3`, VIEW.width / 2, 360);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText('Press SPACE to run it back', VIEW.width / 2, 420);
  }

  /** Draw the game in its current screen. */
  function draw(game, screen) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    drawWorld(game);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHUD(ctx, game);
    if (screen === SCREEN_TITLE) drawTitle(game);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(game);
  }

  /** CSS pixels on the canvas element -> logical 1280x720 view coordinates. */
  function toLogical(cssX, cssY) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    return { x: (cssX * dpr - offsetX) / scale, y: (cssY * dpr - offsetY) / scale };
  }

  return { draw, resize, toLogical };
}
