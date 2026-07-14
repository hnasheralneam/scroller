// Headless smoke test: boots every level, simulates input for ~20 seconds of
// game time each, exercises update+draw paths, and reports into the DOM.
import { LEVELS } from '../src/levels/index.js';
import { PlayState } from '../src/play.js';
import { input } from '../src/input.js';
import { Boss } from '../src/bosses.js';

const out = [];
const canvas = document.createElement('canvas');
canvas.width = 320;
canvas.height = 240;
const g = canvas.getContext('2d');

function makeGameStub() {
  return {
    coins: 0, totalCoins: 0, lives: 3, power: 'small',
    save: { unlocked: LEVELS.length - 1 },
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
    const water = !!LEVELS[i].def.meta.water;
    for (let f = 0; f < FRAMES; f++) {
      if (water) {
        // swim right with a steady stroke rhythm
        input.held = { right: true, jump: f % 18 < 6 };
        input.pressed = (f % 18 === 0) ? { jump: true } : {};
      } else {
        // simulated input: run right, hop periodically, double-jump sometimes
        input.held = { right: true, jump: f % 45 < 12 };
        input.pressed = (f % 45 === 0 || f % 45 === 8) ? { jump: true } : {};
      }
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
const BOSS_INDICES = LEVELS.map(({ def }, i) => (def.meta.boss ? i : -1)).filter(i => i >= 0);
for (const i of BOSS_INDICES) {
  const gameStub = makeGameStub();
  try {
    const play = new PlayState(gameStub, i);
    const seen = new Set();
    const states = new Set();
    const origAdd = play.addEntity.bind(play);
    play.addEntity = (e) => { seen.add(e.constructor.name); origAdd(e); };
    let frames = 0;
    for (let f = 0; f < 5400 && !gameStub.cleared; f++, frames++) {
      input.held = { left: f % 140 < 70, right: f % 140 >= 70, jump: f % 50 < 10 };
      input.pressed = (f % 50 === 0) ? { jump: true } : {};
      play.player.invuln = 9999; // keep the dummy alive so the boss keeps cycling
      if (play.boss) states.add(play.boss.state);
      if (f > 0 && f % 350 === 0 && play.boss && !play.boss.dying) {
        play.boss.hitInvuln = 0;
        // Force damage through the base implementation so per-boss gating (the
        // Leviathan's shield) can't stall this kill-path check. The gating
        // itself is covered properly in mechanics.js — this test only cares
        // that a boss driven to 0 hp clears the level.
        Boss.prototype.takeHit.call(play.boss, play.ctx());
      }
      play.update();
      if (f % 4 === 0) play.draw(g);
    }
    const attacks = [...seen].filter(n => !NOT_ATTACKS.has(n));
    const attackStates = [...states].filter(s => !['intro', 'idle', 'walk', 'hover', 'float'].includes(s));
    // variety = distinct attack entities + distinct attack states
    const variety = new Set([...attacks, ...attackStates]);
    const ok = variety.size >= 5 && gameStub.cleared;
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
      const isBoss = !!def.meta.boss;
      // the last level of every world must be its boss arena
      const lastOfWorld = i + 1 === LEVELS.length || LEVELS[i + 1].world !== world;
      if (lastOfWorld && !isBoss) issues.push('last level of world is not a boss');
      if (!lastOfWorld && isBoss) issues.push('boss level is not last in world');
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
