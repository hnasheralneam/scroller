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

**7 worlds × 5 levels** (4 regular + 1 boss arena each), in difficulty order:

1. **Green Meadows** — blobs and hoppers. Boss: **Toad King**
2. **Crystal Caverns** — dark (light radius around you), bats, falling stalactites, spike-crawlers. Boss: **Crystal Golem**
3. **Sky Islands** — wind gusts, bottomless pits, cloud turrets. Boss: **Storm Bird**
4. **The Mainframe** — matrix rain, patrol drones, firewall lasers, proximity mines. Boss: **The Kernel**
5. **Molten Keep** — lava, firebars, crumbling bridges, fire imps. Boss: **Flame King**
6. **Jungle Ruins** — dart frogs, howlers, idol turrets. Boss: **Coatl**
7. **Sunken Depths** — fully underwater (swim physics!), pufferfish, jellyfish, snapperfish, urchins. Boss: **Abyssal Leviathan**

Every boss is a multi-phase fight with an intro sequence and its own attack
patterns. Between levels you travel a Mario-style scrolling world map. Each
world has its own procedurally generated chiptune track — pause (Esc / P) to
adjust music and SFX volume; the settings are saved with your progress.

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

- `index.html#level=N` jumps straight into level N (0–34). The unlock it grants
  is session-only and is never written to the save.
- Level maps are sparse ASCII placements in `src/levels/world*.js`
  (see the legend in `src/level.js`).

## Tests

```sh
./test/run.sh          # PORT=9000 ./test/run.sh to use another port
```

Needs only `python3` and a `chromium` binary — no node, no install step. It
serves the repo, opens each page in headless Chromium, and reads the pass/fail
verdict each one writes to `document.title`. Every page also runs standalone in
a normal browser if you'd rather read the output directly.

| Page | Covers |
|---|---|
| `boot.html` | boots `main.js` for 300 real frames; asserts no errors |
| `headless.html` | every level driven ~20s, plus every boss arena to a kill; static level-data checks |
| `reach.html` | BFS-proves the flag is reachable, using a jump envelope simulated from the real physics constants |
| `mechanics.html` | power states, shooting, glitch FX, stomps, shells, boss gating, particle color, camera shake |
| `content.html` | content invariants: checkpoints, power blocks, registered map chars, spawn-registry agreement |
| `input.html` | keyboard ref-counting, focus loss, pause-menu navigation |
| `save.html` | save coercion, clamping, corrupt/absent data |
| `music.html` | scheduler backlog handling and recovery |
| `maptest.html` | world-map cursor stepping |
| `stomp_repro.html` | regression: stomping a rising boss must never hurt the player |
| `touch.html` | synthetic pointer events against the touch overlay |
