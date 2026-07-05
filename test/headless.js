// Headless smoke test: boots every level, simulates input for ~20 seconds of
// game time each, exercises update+draw paths, and reports into the DOM.
import { LEVELS } from '../src/levels/index.js';
import { PlayState } from '../src/play.js';
import { input } from '../src/input.js';

const out = [];
const canvas = document.createElement('canvas');
canvas.width = 320;
canvas.height = 240;
const g = canvas.getContext('2d');

function makeGameStub() {
  return {
    coins: 0, totalCoins: 0, lives: 3, power: 'small',
    save: { unlocked: 14 },
    cleared: false, died: 0,
    onLevelCleared() { this.cleared = true; },
    onPlayerDied() { this.died++; },
  };
}

for (let i = 0; i < LEVELS.length; i++) {
  const gameStub = makeGameStub();
  const label = `L${i} (${LEVELS[i].def.name})`;
  try {
    let play = new PlayState(gameStub, i);
    let maxX = 0;
    const FRAMES = 1200;
    for (let f = 0; f < FRAMES; f++) {
      // simulated input: run right, hop periodically, double-jump sometimes
      input.held = { right: true, jump: f % 45 < 12 };
      input.pressed = (f % 45 === 0 || f % 45 === 8) ? { jump: true } : {};
      if (gameStub.cleared) break;
      if (gameStub.died > 0) {
        // respawn like the real Game does
        gameStub.power = 'small';
        gameStub.died = 0;
        play = new PlayState(gameStub, i, play.checkpoint);
      }
      play.update();
      if (f % 3 === 0) play.draw(g);
      maxX = Math.max(maxX, play.player.x);
    }
    const pct = Math.round(100 * maxX / play.level.pxWidth);
    out.push(`PASS ${label}: progress ${pct}% coins=${gameStub.coins} cleared=${gameStub.cleared}`);
  } catch (err) {
    out.push(`FAIL ${label}: ${err.message}\n${err.stack}`);
  }
}

// Boss fights: run each arena, damage the boss periodically, and assert the
// state machine spawns a variety of attack entities and the kill path works.
const NOT_ATTACKS = new Set(['Particle', 'TextPop', 'PlayerShot', 'Coin', 'PowerPickup',
  'Flag', 'Checkpoint', 'MovingPlatform', 'CrumblePlatform', 'Firebar']);
for (const i of [2, 5, 8, 11, 14]) {
  const gameStub = makeGameStub();
  try {
    const play = new PlayState(gameStub, i);
    const seen = new Set();
    const states = new Set();
    const origAdd = play.addEntity.bind(play);
    play.addEntity = (e) => { seen.add(e.constructor.name); origAdd(e); };
    let frames = 0;
    for (let f = 0; f < 4200 && !gameStub.cleared; f++, frames++) {
      input.held = { left: f % 140 < 70, right: f % 140 >= 70, jump: f % 50 < 10 };
      input.pressed = (f % 50 === 0) ? { jump: true } : {};
      play.player.invuln = 9999; // keep the dummy alive so the boss keeps cycling
      if (play.boss) states.add(play.boss.state);
      if (f > 0 && f % 500 === 0 && play.boss && !play.boss.dying) {
        play.boss.hitInvuln = 0;
        play.boss.takeHit(play.ctx());
      }
      play.update();
      if (f % 4 === 0) play.draw(g);
    }
    const attacks = [...seen].filter(n => !NOT_ATTACKS.has(n));
    const attackStates = [...states].filter(s => !['intro', 'idle', 'walk', 'hover', 'float'].includes(s));
    // variety = distinct attack entities + distinct attack states
    const variety = new Set([...attacks, ...attackStates]);
    const ok = variety.size >= 4 && gameStub.cleared;
    out.push(`${ok ? 'BOSS-OK' : 'BOSS-FAIL'} L${i} (${LEVELS[i].def.name}): ` +
      `cleared=${gameStub.cleared} in ${frames}f, variety=[${[...variety].join(', ')}]`);
  } catch (err) {
    out.push(`BOSS-FAIL L${i}: ${err.message}\n${err.stack}`);
  }
}

// Static level-data sanity checks
import('../src/level.js').then(({ Level }) => {
  for (let i = 0; i < LEVELS.length; i++) {
    const { world, def } = LEVELS[i];
    try {
      const lv = new Level(def, world, i);
      const issues = [];
      if (def.map.length !== 15) issues.push(`height=${def.map.length}`);
      const widths = new Set(def.map.map(r => r.length));
      if (widths.size !== 1) issues.push(`ragged widths ${[...widths]}`);
      const isBoss = i % 3 === 2;
      if (isBoss && !def.meta.boss) issues.push('boss level missing meta.boss');
      if (isBoss && !lv.spawns.some(s => s.type === 'X')) issues.push('missing X spawn');
      if (!isBoss && !lv.spawns.some(s => s.type === 'F')) issues.push('missing flag');
      // player start must have solid footing within 4 tiles below
      const ptx = Math.floor(lv.playerStart.x / 16), pty = Math.floor(lv.playerStart.y / 16);
      let footing = false;
      for (let dy = 1; dy <= 4; dy++) if (lv.tileAt(ptx, pty + dy) === 1) footing = true;
      if (!footing) issues.push('no footing under P');
      out.push(issues.length ? `DATA-FAIL L${i}: ${issues.join(', ')}` : `DATA-OK L${i} ${def.name} ${lv.w}x${lv.h}`);
    } catch (err) {
      out.push(`DATA-FAIL L${i}: ${err.message}`);
    }
  }
  document.body.innerText = out.join('\n');
  document.title = out.some(l => l.includes('FAIL')) ? 'FAIL' : 'ALLPASS';
});
