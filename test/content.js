// Content invariants across all authored levels.
//
// These are rules the level data already follows almost everywhere — the point
// is to make the exceptions loud instead of shipping them. Every failure here
// was a real bug found by hand-parsing the maps; the check is the fix.
//
// Deliberately does NOT re-check what test/headless.js already validates
// (map height, ragged widths, X/F/P presence, footing under P).
import { LEVELS } from '../src/levels/index.js';
import { Level } from '../src/level.js';
import { TILE_CHARS, BLOCK_CHARS, SPAWN_CHARS } from '../src/level.js';
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

// --- report ----------------------------------------------------------------
document.title = failures === 0 ? 'ALLPASS' : 'FAIL';
document.body.textContent =
  out.join('\n') + `\n\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'}`;
document.body.style.whiteSpace = 'pre';
