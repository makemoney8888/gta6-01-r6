// The HUD: wanted stars, cash, health, speed, the mission objective, dialogue
// lines and the minimap. It draws on top of the world, in screen space.

import { FONT, PALETTE, VIEW, WANTED, WORLD } from './config.js';

const MINIMAP = { x: VIEW.width - 236, y: 16, width: 220, height: 166 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
}

function drawStars(ctx, x, y, wanted) {
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < WANTED.max; i += 1) {
    ctx.fillStyle = i < wanted ? PALETTE.starOn : PALETTE.starOff;
    ctx.fillText('★', x + i * 26, y);
  }
}

function drawBar(ctx, x, y, w, h, fraction, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = color;
  const inner = Math.max(0, Math.min(1, fraction));
  if (inner > 0) {
    roundRect(ctx, x + 1, y + 1, (w - 2) * inner, h - 2, 3);
    ctx.fill();
  }
}

/** The minimap: roads, water, the player, cars, cops and the mission marker. */
export function drawMinimap(ctx, game) {
  const { x, y, width, height } = MINIMAP;
  const scaleX = width / WORLD.width;
  const scaleY = height / WORLD.height;
  panel(ctx, x - 6, y - 6, width + 12, height + 12);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.fillStyle = '#5d8a4e';
  ctx.fillRect(x, y, width, height);
  // Water along the bottom.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x, y + height * 0.92, width, height * 0.08);
  // Roads.
  ctx.fillStyle = '#3c3f46';
  for (const rx of game.roadX) ctx.fillRect(x + rx * scaleX - 3, y, 6, height);
  for (const ry of game.roadY) ctx.fillRect(x, y + ry * scaleY - 3, width, 6);
  // Spray shop + warehouse.
  ctx.fillStyle = '#ff8c42';
  ctx.fillRect(x + game.city.spray.x * scaleX - 3, y + game.city.spray.y * scaleY - 3, 6, 6);
  ctx.fillStyle = '#9a7bff';
  ctx.fillRect(x + game.city.warehouse.x * scaleX - 3, y + game.city.warehouse.y * scaleY - 3, 6, 6);
  // Mission marker, pulsing.
  const marker = game.missions.state.marker;
  if (marker) {
    const pulse = 3 + Math.sin(game.time * 5) * 1.5;
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.arc(x + marker.x * scaleX, y + marker.y * scaleY, pulse + 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police cars (blue) and foot cops (dark blue dots).
  ctx.fillStyle = '#2b6fd6';
  for (const car of game.police.state.cars) {
    ctx.fillRect(x + car.x * scaleX - 2, y + car.y * scaleY - 2, 4, 4);
  }
  ctx.fillStyle = '#9db8ff';
  for (const cop of game.police.state.cops) {
    ctx.fillRect(x + cop.x * scaleX - 1.5, y + cop.y * scaleY - 1.5, 3, 3);
  }
  // The player: a bright dot with a white ring.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + game.player.x * scaleX, y + game.player.y * scaleY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(x + game.player.x * scaleX, y + game.player.y * scaleY, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // City name, on a chip inside the minimap's top-left corner.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x + 4, y + 4, 66, 16);
  ctx.fillStyle = '#dfe6ee';
  ctx.font = 'bold 10px ' + FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('CORAL BAY', x + 9, y + 12);
  ctx.textBaseline = 'alphabetic';
}

/** Everything else on the HUD, in screen space. */
export function drawHUD(ctx, game) {
  const p = game.player;
  ctx.textBaseline = 'alphabetic';
  // Top-left: wanted stars + cash + health.
  panel(ctx, 12, 12, 250, 108);
  drawStars(ctx, 26, 34, p.wanted);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 20px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.cash}`, 26, 66);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = '12px ' + FONT;
  ctx.fillText('CASH', 26, 84);
  drawBar(ctx, 110, 56, 128, 12, p.health / 100, PALETTE.health);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '12px ' + FONT;
  ctx.fillText(`${Math.ceil(p.health)} HP`, 110, 84);
  // Speed, bottom-right, when driving.
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    panel(ctx, VIEW.width - 150, VIEW.height - 66, 134, 50);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 26px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh}`, VIEW.width - 58, VIEW.height - 30);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = '12px ' + FONT;
    ctx.fillText('km/h', VIEW.width - 26, VIEW.height - 30);
    drawBar(ctx, VIEW.width - 138, VIEW.height - 22, 110, 8, p.car.health / 100, '#7ec8ff');
  }
  // Mission objective, top-centre.
  const m = game.missions.state;
  if (m.status === 'active') {
    const text = `◆ ${m.objective}`;
    ctx.font = 'bold 15px ' + FONT;
    const w = ctx.measureText(text).width + 28;
    panel(ctx, (VIEW.width - w) / 2, 12, w, 34);
    ctx.fillStyle = PALETTE.marker;
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW.width / 2, 35);
    if (m.timer > 0) {
      ctx.fillStyle = m.timer < 20 ? '#ff6b5e' : PALETTE.hudText;
      ctx.font = 'bold 15px ' + FONT;
      ctx.fillText(`${Math.ceil(m.timer)}s`, VIEW.width / 2, 60);
    }
  } else if (m.status === 'none' && game.missions.nextTitle()) {
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.textAlign = 'center';
    ctx.fillText(`Next job: ${game.missions.nextTitle()} — press M to start`, VIEW.width / 2, 30);
  }
  // Dialogue lines, above the bottom edge.
  if (m.lines.length > 0 && m.lineTimer > 0) {
    ctx.font = '15px ' + FONT;
    const widest = Math.max(...m.lines.map((l) => ctx.measureText(l).width));
    const w = Math.min(VIEW.width - 80, widest + 32);
    const h = m.lines.length * 22 + 18;
    panel(ctx, (VIEW.width - w) / 2, VIEW.height - h - 96, w, h);
    ctx.fillStyle = PALETTE.hudText;
    ctx.textAlign = 'center';
    m.lines.forEach((line, i) => {
      ctx.fillText(line, VIEW.width / 2, VIEW.height - h - 96 + 26 + i * 22);
    });
  }
  // Banner (job done, busted warnings, hints).
  if (game.bannerText && game.bannerTimer > 0) {
    ctx.font = 'bold 22px ' + FONT;
    const w = ctx.measureText(game.bannerText).width + 36;
    panel(ctx, (VIEW.width - w) / 2, 96, w, 44);
    ctx.fillStyle = PALETTE.banner;
    ctx.textAlign = 'center';
    ctx.fillText(game.bannerText, VIEW.width / 2, 126);
  }
  // Context hint, bottom-left.
  const hint = p.car ? 'E exit car · F punch · click shoot · P pause' : 'E steal car · F punch · click shoot · Shift run · P pause';
  ctx.font = '13px ' + FONT;
  ctx.fillStyle = 'rgba(244,246,248,0.75)';
  ctx.textAlign = 'left';
  ctx.fillText(hint, 16, VIEW.height - 14);
  drawMinimap(ctx, game);
}
