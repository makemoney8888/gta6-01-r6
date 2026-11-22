# Coral Bay Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/makemoney8888/gta6-01-r6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/makemoney8888/gta6-01-r6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A top-down 2D open-world crime game set in **Coral Bay**, a sun-soaked coastal
city. Steal cars, outrun the Coral Bay PD, and run jobs for the crew — all in
plain canvas + ES modules, no build step, no network requests, no libraries.

## Play

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit
http://localhost:8080). No install, no server-side code.

## The city

A 3200 × 2400 open world: a grid of streets with lane markings, blocks of
buildings and parks, a beach and the sea along the south edge, and a pier.
Traffic cars drive the grid, pedestrians stroll the sidewalks, and the world
keeps moving behind the title screen.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, or steer and drive in a car |
| Shift | Run |
| E | Steal the nearest car / exit your car |
| F | Punch |
| Click | Shoot toward the mouse |
| M | Start the next job |
| P / Esc | Pause |
| Space | Start / restart |

## Wanted level

Stealing a car, hitting a pedestrian, punching a cop or firing a shot raises
your wanted level (1–5 stars). Police cars chase and ram you; foot cops chase
and arrest you if they hold you for ~1.6 s. Lose the heat by staying out of
sight until it cools off, or drive into the **Spray Shop** and pay $200 for a
new paint job and a clean record.

## Missions

Three story jobs, played in order (press **M** to start the next one):

1. **Getaway Driver** — boost a car, pick up Marla at the pier, deliver her to
   the warehouse before the clock runs out. **$400**
2. **The Pickup** — collect three packages stashed around town and bring them
   to the warehouse. **$600**
3. **Hot Delivery** — drive fragile cargo across town in two minutes without
   smashing it up. **$900**

Cash pickups are scattered around the city for free roam. Cash, jobs done and
best cash save to `localStorage` in your browser.

## Sound

All sound is synthesized with WebAudio — engine hum that follows your speed,
a two-tone police siren while the heat is on, and blips for pickups, shots,
punches and crashes. No audio files.

## Files

- `game/index.html` — the page shell (loads `src/main.js`)
- `game/src/config.js` — tuning, palette, screen names
- `game/src/random.js` — seeded RNG (mulberry32)
- `game/src/input.js` — keyboard + mouse
- `game/src/world.js` — city generation and collision
- `game/src/traffic.js` — traffic cars and pedestrians
- `game/src/police.js` — wanted level, police cars and foot cops
- `game/src/missions.js` — the three story jobs and cash pickups
- `game/src/hud.js` — HUD and minimap
- `game/src/render.js` — camera, city, cars, people, screens
- `game/src/audio.js` — synthesized WebAudio sound
- `game/src/shots.js` — the `?shot=` screenshot scenes
- `game/src/main.js` — boot, game loop and the simulation
- `main.ts` — copies `game/` + `screenshots/` to the output dir and writes
  `dossier.json` (Node 22, standard library only)
