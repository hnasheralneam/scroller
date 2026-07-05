# Pixel Scroller

A Mario-style side-scrolling platformer in vanilla JavaScript + HTML5 Canvas.
No dependencies, no build step, no assets — all pixel art and sound effects are
generated in code.

## Run

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

(Any static file server works; ES modules can't load over `file://`.)

## Controls

| Action | Keys |
|---|---|
| Move | Arrow keys or A/D |
| Jump | Z / Space / Up / W (press again in mid-air to double jump) |
| Shoot (with Spark power) | X / K / Shift |
| Drop through platform | Down + Jump |
| Confirm | Enter |
| Pause | Esc / P |

## The game

**5 worlds × 3 levels** (2 regular + 1 boss arena each), in difficulty order:

1. **Green Meadows** — blobs and hoppers. Boss: **Toad King**
2. **Crystal Caverns** — dark (light radius around you), bats, falling stalactites, spike-crawlers. Boss: **Crystal Golem**
3. **Sky Islands** — wind gusts, bottomless pits, cloud turrets. Boss: **Storm Bird**
4. **The Mainframe** — matrix rain, patrol drones, firewall lasers, proximity mines. Boss: **The Kernel**
5. **Molten Keep** — lava, firebars, crumbling bridges, fire imps. Boss: **Flame King** (two phases)

**Power-ups:**
- **Berry** — grow big (take one extra hit)
- **Spark Orb** — throw bouncing spark projectiles
- **Green Berry** — 1-up (also granted every 100 coins)
- **Glitch Cube** — GLITCH MODE: 10 seconds invincible, destroy enemies on
  contact, while the whole screen corrupts (hidden in special blocks — chase
  the bouncing cube!)

Checkpoints (small flags) save your respawn point within a level. Progress
(unlocked levels) is saved in localStorage and survives game over.

## Dev notes

- `index.html#level=N` jumps straight into level N (0–14).
- `test/headless.html`, `test/mechanics.html`, `test/reach.html` are headless
  test pages; dump their DOM with a headless browser to run the smoke tests,
  mechanics tests, and flag-reachability checks.
- Level maps are sparse ASCII placements in `src/levels/world*.js`
  (see the legend in `src/level.js`).
