// Reachability check: BFS over "standable" tiles using a jump envelope
// simulated from the *real* physics constants (mirrors src/player.js's
// gravity/velocity stepping exactly), so this test tracks physics tuning
// instead of relying on hand-guessed tile distances.
// Proves the flag is reachable from the start in every non-boss level.
import { LEVELS } from '../src/levels/index.js';
import { Level } from '../src/level.js';
import {
  TILE, JUMP_VEL, DOUBLE_JUMP_VEL, GRAVITY_UP, GRAVITY_DOWN, MAX_FALL, MAX_RUN,
} from '../src/constants.js';

const SOLID = new Set([1, 2, 3, 4, 8, 9]);
const out = [];

// --- derive the jump envelope from real physics -----------------------
function stepGravity(vy, jumpHeld) {
  const g = vy < 0 && jumpHeld ? GRAVITY_UP : GRAVITY_DOWN;
  return Math.min(vy + g, MAX_FALL);
}
// Trajectory in px (y=0 at launch, negative = up), holding jump throughout;
// `useDouble` fires the second jump the instant the first arc's vy turns
// non-negative (i.e. right at its peak, for maximum combined height).
function simulateTrajectory(useDouble, maxFrames = 220) {
  let y = 0, vy = JUMP_VEL, doubleUsed = false;
  const ys = [0];
  for (let f = 1; f <= maxFrames; f++) {
    if (useDouble && !doubleUsed && vy >= 0) { vy = DOUBLE_JUMP_VEL; doubleUsed = true; }
    vy = stepGravity(vy, true);
    y += vy;
    ys.push(y);
  }
  return ys;
}

function buildEnvelope() {
  const single = simulateTrajectory(false);
  const double = simulateTrajectory(true);

  function maxDxUp(upTiles) {
    const targetY = -upTiles * TILE;
    let bestFrames = -1;
    for (const ys of [single, double]) {
      for (let f = 0; f < ys.length; f++) {
        if (ys[f] <= targetY) { bestFrames = Math.max(bestFrames, f); break; }
      }
    }
    return bestFrames < 0 ? 0 : Math.ceil((bestFrames * MAX_RUN) / TILE);
  }
  // Flat gaps (pits with a same-height landing) need the *full* round-trip
  // airtime of a jump — the distance covered rising to the apex and falling
  // back to launch height — not a token walking step.
  let flatFrames = single.length;
  for (let f = 1; f < single.length; f++) {
    if (single[f] >= 0) { flatFrames = f; break; }
  }
  const maxDxFlat = Math.ceil((flatFrames * MAX_RUN) / TILE);
  function maxDxDown(downTiles) {
    if (downTiles <= 0) return maxDxFlat;
    const targetY = downTiles * TILE;
    for (let f = 0; f < double.length; f++) {
      if (double[f] >= targetY) return Math.ceil((f * MAX_RUN) / TILE);
    }
    return Math.ceil((double.length * MAX_RUN) / TILE);
  }

  const peakSingle = -Math.min(...single) / TILE;
  const peakDouble = -Math.min(...double) / TILE;
  const framesToPeakSingle = single.indexOf(Math.min(...single));
  const framesToPeakDouble = double.indexOf(Math.min(...double));
  out.push(`ENVELOPE: single-jump peak ${peakSingle.toFixed(2)} tiles in ${framesToPeakSingle}f | ` +
    `double-jump peak ${peakDouble.toFixed(2)} tiles in ${framesToPeakDouble}f | flatGapMaxDx=${maxDxFlat} | ` +
    [1, 2, 3, 4, 5, 6].map(t => `up(${t})=${maxDxUp(t)}`).join(' ') + ' | ' +
    [1, 2, 3, 5, 10].map(t => `down(${t})=${maxDxDown(t)}`).join(' '));

  return { maxDxUp, maxDxDown, maxUpTiles: Math.ceil(peakDouble) };
}

const envelope = buildEnvelope();

// --- per-level BFS over standable tiles --------------------------------
for (let i = 0; i < LEVELS.length; i++) {
  const { world, def } = LEVELS[i];
  if (def.meta.boss) { out.push(`SKIP L${i} (boss arena)`); continue; }
  // water levels use swim physics; the headless clear is the reachability proxy
  if (def.meta.water) { out.push(`SKIP L${i} (underwater)`); continue; }
  const lv = new Level(def, world, i);

  // standable ground cells
  const standable = new Set();
  const key = (x, y) => `${x},${y}`;
  for (let ty = 0; ty < lv.h; ty++) {
    for (let tx = 0; tx < lv.w; tx++) {
      const here = lv.tileAt(tx, ty);
      const below = lv.tileAt(tx, ty + 1);
      if ((here === 0) && (SOLID.has(below) || below === 6)) standable.add(key(tx, ty));
    }
  }
  // entity platforms count as standable surfaces
  for (const sp of lv.spawns) {
    const tx = Math.floor(sp.x / 16), ty = Math.floor(sp.y / 16);
    if (sp.type === 'M') for (let d = -3; d <= 4; d++) standable.add(key(tx + d, ty - 1));
    if (sp.type === 'V') for (let d = -3; d <= 3; d++) { standable.add(key(tx, ty + d - 1)); standable.add(key(tx + 1, ty + d - 1)); }
    if (sp.type === '%') standable.add(key(tx, ty - 1));
  }

  const start = [Math.floor(lv.playerStart.x / 16), Math.floor(lv.playerStart.y / 16)];
  const flag = lv.spawns.find(s => s.type === 'F');
  const ftx = Math.floor(flag.x / 16), fty = Math.floor(flag.y / 16);

  function bfsFrom(origin) {
    const seenX = new Set([key(...origin)]);
    const queue = [origin];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (let dy = -envelope.maxUpTiles; dy < lv.h; dy++) {
        const maxDx = dy < 0 ? envelope.maxDxUp(-dy) : envelope.maxDxDown(dy);
        for (let dx = -maxDx; dx <= maxDx; dx++) {
          const k = key(x + dx, y + dy);
          if (!seenX.has(k) && standable.has(k)) { seenX.add(k); queue.push([x + dx, y + dy]); }
        }
      }
    }
    return seenX;
  }

  const seen = bfsFrom(start);
  const reached = [...seen].some(k => {
    const [sx, sy] = k.split(',').map(Number);
    return Math.abs(sx - ftx) <= 1 && sy >= fty - 1;
  });

  if (!reached) {
    // Real frontier: the actually-reachable cell closest to the flag.
    let frontier = null, frontierDist = Infinity;
    for (const k of seen) {
      const [sx, sy] = k.split(',').map(Number);
      const d = Math.abs(sx - ftx) + Math.abs(sy - fty);
      if (d < frontierDist) { frontierDist = d; frontier = [sx, sy]; }
    }
    // Forward-BFS from the flag too (edges are directional up/down, so this
    // is only a rough "what's nearby on that side" hint, not a true reverse
    // reachability check) — still useful to see how large each island is.
    const seenFlag = bfsFrom([ftx, fty]);
    out.push(`REACH-FAIL L${i} ${def.name} (start-side ${seen.size} / flag-side ${seenFlag.size} cells) — ` +
      `frontier (${frontier[0]},${frontier[1]}), flag at (${ftx},${fty})`);
  } else {
    out.push(`REACH-OK L${i} ${def.name} (${seen.size} cells explored)`);
  }
}

document.body.innerText = out.join('\n');
document.title = out.some(l => l.includes('FAIL')) ? 'FAIL' : 'ALLPASS';
