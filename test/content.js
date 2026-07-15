// Content invariants across all authored levels.
//
// These are rules the level data already follows almost everywhere — the point
// is to make the exceptions loud instead of shipping them. Every failure here
// was a real bug found by hand-parsing the maps; the check is the fix.
//
// Deliberately does NOT re-check what test/headless.js already validates
// (map height bounds, ragged widths, X/F/P presence, footing under P).
import { LEVELS } from '../src/levels/index.js';
import { Level } from '../src/level.js';
import { TILE_CHARS, BLOCK_CHARS, SPAWN_CHARS } from '../src/level.js';
import { TILE, VIEW_H } from '../src/constants.js';
import { ENEMY_FACTORY } from '../src/enemies.js';

const out = [];
let failures = 0;

function check(name, cond, detail = '') {
  if (cond) {
    out.push(`PASS ${name}`);
  } else {
    failures++;
    out.push(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const isBossLevel = def => !!(def.meta && def.meta.boss);
const label = (world, li, def) => `${world + 1}-${li + 1} ${def.name}`;

// --- 1. every non-boss level has a checkpoint ------------------------------
// Dying without one sends you back to the level start; every non-boss level
// bar 6-1 already places exactly one.
{
  const missing = [];
  for (const { world, li, def } of LEVELS) {
    if (isBossLevel(def)) continue;
    const lv = new Level(def, world, li);
    if (!lv.spawns.some(s => s.type === 'C')) missing.push(label(world, li, def));
  }
  check('every non-boss level has a checkpoint', missing.length === 0, missing.join(', '));
}

// --- 2. every non-boss level has a power block -----------------------------
// main.js resets power to 'small' on every death, including checkpoint
// respawns — a level with no 'U' offers no way back to a powered state.
{
  const missing = [];
  for (const { world, li, def } of LEVELS) {
    if (isBossLevel(def)) continue;
    const lv = new Level(def, world, li);
    const hasPower = [...lv.contents.values()].includes('power');
    if (!hasPower) missing.push(label(world, li, def));
  }
  check('every non-boss level has a power block', missing.length === 0, missing.join(', '));
}

// --- 3. no unregistered map characters -------------------------------------
// Level's constructor silently skips any char it doesn't recognise, so a typo
// (or a new enemy added without registering its letter) vanishes at load with
// no warning.
{
  const known = new Set([
    '.', ' ',
    ...Object.keys(TILE_CHARS),
    ...Object.keys(BLOCK_CHARS),
    ...SPAWN_CHARS,
  ]);
  const bad = [];
  for (const { world, li, def } of LEVELS) {
    const seen = new Set();
    def.map.forEach((row, ty) => {
      for (const ch of row) {
        if (!known.has(ch) && !seen.has(ch)) {
          seen.add(ch);
          bad.push(`${label(world, li, def)}: '${ch}' (row ${ty})`);
        }
      }
    });
  }
  check('no unregistered map characters', bad.length === 0, bad.join(', '));
}

// --- 4. the spawn registries agree -----------------------------------------
// An enemy in ENEMY_FACTORY but not in SPAWN_CHARS never spawns; a letter in
// SPAWN_CHARS with no handler is a silent no-op. Both fail quietly today.
{
  const SPECIAL = new Set(['P', 'C', 'F', 'o', 'M', 'V', '%', 'X', 'r']);
  const unreachable = Object.keys(ENEMY_FACTORY).filter(c => !SPAWN_CHARS.has(c));
  check('every ENEMY_FACTORY letter is in SPAWN_CHARS', unreachable.length === 0,
    unreachable.join(', '));

  const unhandled = [...SPAWN_CHARS].filter(c => !ENEMY_FACTORY[c] && !SPECIAL.has(c));
  check('every SPAWN_CHARS letter has a handler', unhandled.length === 0,
    unhandled.join(', '));
}

// --- 5. floorYAt finds the floor, not the ceiling --------------------------
// Bosses anchor erupting columns, floor beams and dive-crash checks with
// floorYAt. Nearly every arena is roofed with brick (BR(n) => T_BRICK, which is
// solid), so a query that scans from the top of the level finds the *ceiling*
// and vents geysers out of the sky. Asked from mid-arena, every column must
// report a surface somewhere below the roof.
//
// (Note "below the roof", not "near the ground": a Q block hanging at row 7 is
// a legitimate standable surface and floorYAt is right to report it. The Kernel
// deliberately rides its floor beam on whatever is under the player.)
const ROOF_Y = 2 * TILE;
{
  const bad = [];
  for (const { world, li, def } of LEVELS) {
    if (!isBossLevel(def)) continue;
    const lv = new Level(def, world, li);
    for (const fx of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const x = lv.pxWidth * fx;
      const y = lv.floorYAt(x, lv.pxHeight / 2); // query from mid-arena
      if (y <= ROOF_Y) bad.push(`${label(world, li, def)} @x=${x.toFixed(0)} -> y=${y}`);
    }
  }
  check('boss arenas never anchor an attack to the roof', bad.length === 0, bad.join(', '));
}

// Where the bosses actually query from — their own feet, near the floor — the
// answer must be the real ground.
{
  const bad = [];
  for (const { world, li, def } of LEVELS) {
    if (!isBossLevel(def)) continue;
    const lv = new Level(def, world, li);
    for (let tx = 1; tx < lv.w - 1; tx++) {
      const y = lv.floorYAt(tx * TILE, lv.pxHeight - 3 * TILE);
      if (y >= lv.pxHeight) bad.push(`${label(world, li, def)} @tx=${tx} has no floor`);
    }
  }
  check('every boss arena column has a floor underfoot', bad.length === 0,
    bad.slice(0, 4).join(', '));
}

// Sanity: the query must actually find the brick roof when asked from the top,
// which is exactly why callers have to pass a sensible fromY.
{
  const arena = LEVELS.find(l => isBossLevel(l.def));
  const lv = new Level(arena.def, arena.world, arena.li);
  const fromTop = lv.floorYAt(lv.pxWidth / 2, 0);
  const fromMid = lv.floorYAt(lv.pxWidth / 2, lv.pxHeight / 2);
  check('floorYAt(x, 0) finds the roof — hence the required fromY',
    fromTop < fromMid, `fromTop=${fromTop} fromMid=${fromMid}`);
}

// --- 6. the vertical axis is actually used ---------------------------------
// mk() takes a height and camera.clampY works, but for a long time every level
// used the 15-tile default, so pxHeight === VIEW_H, camera.y was pinned at 0
// and all the vertical camera logic was dead. If this ever goes back to zero,
// that capability has silently rotted again.
{
  const tall = LEVELS.filter(({ def }) => def.map.length > VIEW_H / TILE);
  check('at least one level uses the vertical axis', tall.length > 0);

  // And a tall level must genuinely scroll: y clamps to pxHeight - VIEW_H.
  const bad = tall.filter(({ world, li, def }) => {
    const lv = new Level(def, world, li);
    return lv.pxHeight - VIEW_H <= 0;
  }).map(({ world, li, def }) => label(world, li, def));
  check('tall levels can scroll vertically', bad.length === 0, bad.join(', '));
}

// --- report ----------------------------------------------------------------
document.title = failures === 0 ? 'ALLPASS' : 'FAIL';
document.body.textContent =
  out.join('\n') + `\n\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'}`;
document.body.style.whiteSpace = 'pre';
