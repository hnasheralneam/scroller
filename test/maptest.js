// World map smoke test: constructs WorldMapState, steps the cursor right ten
// times with scripted input, and runs update+draw each frame.
import { WorldMapState } from '../src/screens.js';
import { LEVELS } from '../src/levels/index.js';
import { input } from '../src/input.js';

const out = [];
const canvas = document.createElement('canvas');
canvas.width = 320;
canvas.height = 240;
const g = canvas.getContext('2d');

const game = {
  save: { unlocked: LEVELS.length - 1 },
  started: -1,
  startLevel(i) { this.started = i; },
  toTitle() {},
};

let pass = true;
try {
  const map = new WorldMapState(game, 0);
  if (map.cursor !== 0) throw new Error(`start cursor ${map.cursor}`);
  let presses = 0;
  for (let f = 0; f < 400; f++) {
    // tap right every 30 frames, ten times total
    input.held = {};
    input.pressed = (f % 30 === 0 && presses < 10) ? (presses++, { right: true }) : {};
    map.update();
    map.draw(g);
  }
  if (map.cursor !== 10) throw new Error(`cursor ${map.cursor}, expected 10`);
  // walk back once
  input.pressed = { left: true };
  for (let f = 0; f < 40; f++) { map.update(); map.draw(g); input.pressed = {}; }
  if (map.cursor !== 9) throw new Error(`cursor ${map.cursor}, expected 9 after left`);
  // world jump down, then confirm starts the level
  input.pressed = { down: true };
  map.update(); map.draw(g);
  input.pressed = {};
  const jumped = map.cursor;
  if (LEVELS[jumped].li !== 0) throw new Error(`down jump landed at li ${LEVELS[jumped].li}`);
  input.pressed = { confirm: true };
  map.update();
  input.pressed = {};
  if (game.started !== jumped) throw new Error(`startLevel got ${game.started}, expected ${jumped}`);
  out.push(`PASS cursor walk + world jump + confirm (started L${game.started})`);
} catch (e) {
  pass = false;
  out.push(`FAIL ${e.message}\n${e.stack}`);
}

document.title = pass ? 'ALLPASS' : 'FAIL';
document.body.textContent = out.join('\n');
