// Targeted mechanics test: exercises power states, shooting, glitch mode
// post-processing, hurt/shrink, coins-to-life, and block bumping.
import { PlayState } from '../src/play.js';
import { input } from '../src/input.js';
import { Shellsnail, Snapdragon } from '../src/enemies.js';
import { Particle } from '../src/entities.js';
import { STOMP_BOUNCE } from '../src/constants.js';

const out = [];
const canvas = document.createElement('canvas');
canvas.width = 320; canvas.height = 240;
const g = canvas.getContext('2d');

const game = {
  coins: 0, totalCoins: 0, lives: 3, power: 'small',
  save: { unlocked: 14 }, cleared: false,
  onLevelCleared() { this.cleared = true; },
  onPlayerDied() {},
};

function run(label, fn) {
  try { fn(); out.push(`PASS ${label}`); }
  catch (err) { out.push(`FAIL ${label}: ${err.message}\n${err.stack}`); }
}

function frames(play, n, held = {}) {
  for (let f = 0; f < n; f++) {
    input.held = held; input.pressed = {};
    play.update();
    play.draw(g);
  }
}

run('grow power + shrink on hurt', () => {
  const play = new PlayState(game, 0);
  play.player.setPower('big');
  frames(play, 30);
  if (play.player.h !== 26) throw new Error('big hitbox wrong: ' + play.player.h);
  play.hurtPlayer();
  if (play.player.power !== 'small') throw new Error('did not shrink');
  if (play.player.invuln <= 0) throw new Error('no invulnerability after hit');
  frames(play, 30);
});

run('fire power + shooting', () => {
  game.power = 'fire';
  const play = new PlayState(game, 5);
  frames(play, 10);
  input.held = { shoot: true }; input.pressed = { shoot: true };
  play.update(); play.draw(g);
  const shots = play.entities.filter(e => e.isShot).length;
  if (shots !== 1) throw new Error('expected 1 shot, got ' + shots);
  frames(play, 60);
  game.power = 'small';
});

run('glitch mode post-fx + enemy destruction', () => {
  const play = new PlayState(game, 0);
  play.player.glitchTimer = 600;
  const before = play.entities.filter(e => e.isEnemy).length;
  // drop the player onto the first enemy
  const enemy = play.entities.find(e => e.isEnemy);
  play.player.x = enemy.x; play.player.y = enemy.y - 4;
  frames(play, 20, { right: true });
  const after = play.entities.filter(e => e.isEnemy && !e.dead).length;
  if (after >= before) throw new Error(`enemy not destroyed (${before} -> ${after})`);
  // run glitch out entirely (draws the full post-fx pipeline)
  play.player.glitchTimer = 30;
  frames(play, 40);
  if (play.player.glitchTimer !== 0) throw new Error('glitch timer stuck');
});

run('coins to 1-up', () => {
  const play = new PlayState(game, 0);
  const lives = game.lives;
  play.addCoins(105);
  if (game.lives !== lives + 1) throw new Error('no 1up at 100 coins');
  if (game.coins !== 5) throw new Error('coin remainder wrong: ' + game.coins);
});

run('block bump spawns pickup', () => {
  const play = new PlayState(game, 0);
  // 1-1 has a U block at tx=30,ty=9 (B?U?B) — bump it directly
  play.bumpBlock(30, 9);
  const pickup = play.entities.find(e => e.pickup === 'berry' || e.pickup === 'orb');
  if (!pickup) throw new Error('no pickup spawned from U block');
  frames(play, 40);
});

run('boss takes stomp damage', () => {
  const play = new PlayState(game, 4); // Toad King arena
  frames(play, 5);
  const boss = play.boss;
  const hp = boss.hp;
  boss.squash(play.ctx());
  if (boss.hp !== hp - 1) throw new Error('boss hp unchanged');
  frames(play, 30);
});

run('stomping a rising boss never hurts the player', () => {
  const play = new PlayState(game, 4);
  frames(play, 5);
  const boss = play.boss, p = play.player;
  const hp = boss.hp;
  boss.hitInvuln = 0;
  boss.vy = -5;                 // boss leaping up
  p.x = boss.cx - p.w / 2;
  p.y = boss.y - p.h + 10;      // already overlapping 10px deep (high closing speed)
  p.vy = 6;
  p.invuln = 0;
  play.handleCollisions(play.ctx());
  if (p.dying) throw new Error('player died from a head stomp');
  if (p.invuln > 0) throw new Error('player was hurt by a head stomp');
  if (boss.hp !== hp - 1) throw new Error('stomp did no damage');
});

run('stomp bounce does not get re-hit by the boss on a later frame', () => {
  // Regression test: a successful stomp used to leave the player's hitbox
  // still overlapping a tall, still-rising boss for a frame or two after the
  // bounce, so the very next frame's non-stomp overlap fell through to
  // hurtPlayer(). Simulate several frames post-stomp with the boss actively
  // closing the gap and assert the player is never damaged.
  const play = new PlayState(game, 4); // Toad King arena
  frames(play, 5);
  const boss = play.boss, p = play.player;
  const hp = boss.hp;
  boss.hitInvuln = 0;
  boss.state = 'leap';
  boss.vy = -5;
  boss.vx = 2; // boss actively closing the horizontal gap too
  p.x = boss.cx - p.w / 2;
  p.y = boss.y - p.h + 2;
  p.vy = 6;
  p.invuln = 0;
  const ctx = play.ctx();
  play.handleCollisions(ctx); // the stomp itself
  if (boss.hp !== hp - 1) throw new Error('stomp did not damage the boss');
  if (p.stompGraceTimer <= 0 || p.stompGraceEntity !== boss) {
    throw new Error('no stomp grace granted after a successful stomp');
  }
  // keep the boss overlapping the player's old position for several frames
  for (let f = 0; f < 8; f++) {
    boss.x = p.x; boss.y = p.y + p.h - 4; // boss re-closes into the player
    play.handleCollisions(ctx);
    if (p.dying || p.invuln > 0) {
      throw new Error(`player was hurt ${f + 1} frame(s) after a clean stomp`);
    }
  }
});

run('shellsnail: stomp -> shell -> kick -> mows enemies', () => {
  const play = new PlayState(game, 0);
  frames(play, 3);
  const snail = play.entities.find(e => e instanceof Shellsnail);
  const ctx = play.ctx();
  snail.squash(ctx);
  if (snail.state !== 'shell' || snail.harmful) throw new Error('stomp did not shell: ' + snail.state);
  play.player.x = snail.x - 20; // kick from the left -> slides right
  snail.onTouch(ctx);
  if (snail.state !== 'slide' || snail.facing !== 1) throw new Error('kick failed');
  // park a victim in its path
  const victim = play.entities.find(e => e instanceof Shellsnail && e !== snail);
  victim.x = snail.x + 6; victim.y = snail.y;
  snail.kickGrace = 0;
  play.handleCollisions(ctx);
  if (!victim.dead) throw new Error('sliding shell did not destroy enemy');
  frames(play, 30);
});

run('snapdragon lunges when approached, stays anchored', () => {
  const play = new PlayState(game, 0);
  frames(play, 3);
  const snap = play.entities.find(e => e instanceof Snapdragon);
  if (snap.harmful) throw new Error('snapdragon harmful while hidden');
  play.player.x = snap.x - 24;
  play.player.y = snap.y;
  let lunged = false;
  for (let f = 0; f < 120 && !lunged; f++) {
    snap.update(play.ctx());
    if (snap.state === 'lunge') lunged = true;
  }
  if (!lunged) throw new Error('snapdragon never lunged, state=' + snap.state);
  if (Math.abs(snap.x - snap.rootX) > 80) throw new Error('snapdragon wandered from root');
  frames(play, 30);
});

run('kernel never teleports on top of the player', () => {
  const play = new PlayState(game, 19); // ROOT ACCESS (Kernel arena)
  frames(play, 5);
  const boss = play.boss;
  const p = play.player;
  let minDist = Infinity;
  // sweep the player across the whole arena and force many teleports at each spot
  for (let fx = 0.05; fx <= 0.95; fx += 0.1) {
    for (let fy = 0.3; fy <= 0.8; fy += 0.25) {
      p.x = play.level.pxWidth * fx;
      p.y = play.level.pxHeight * fy;
      for (let i = 0; i < 8; i++) {
        boss.teleport(play.ctx());
        const dist = Math.hypot(boss.cx - p.cx, boss.cy - p.cy);
        minDist = Math.min(minDist, dist);
      }
    }
  }
  if (minDist < 56) throw new Error(`boss teleported within ${minDist.toFixed(1)}px of the player (want >=56)`);
});

run('jump: usable short hop, unchanged full jump, tuned stomp bounce', () => {
  // Drives the real player, so this measures player.js rather than a
  // re-simulation of it. A hard velocity clamp used to sit on top of the
  // gravity switch and squash both the short hop (to 0.5 tiles, a 1:7 ratio)
  // and STOMP_BOUNCE (to 1.4px against its tuned ~1.56 tiles).
  const play = new PlayState(game, 0);
  frames(play, 3);
  const p = play.player;

  const settle = () => {
    p.x = play.level.playerStart.x;
    p.y = play.level.playerStart.y;
    p.vx = 0; p.vy = 0;
    for (let f = 0; f < 60; f++) {
      p.invuln = 9999; // ignore the level's enemies entirely
      input.held = {}; input.pressed = {};
      play.update();
    }
    if (!p.onGround) throw new Error('player never settled on the ground');
  };

  // Rise achieved from a standing jump, holding `holdFrames` frames.
  const hop = (holdFrames) => {
    settle();
    const y0 = p.y;
    let peak = y0;
    for (let f = 0; f < 150; f++) {
      p.invuln = 9999;
      input.held = f < holdFrames ? { jump: true } : {};
      input.pressed = f === 0 ? { jump: true } : {};
      play.update();
      peak = Math.min(peak, p.y);
      if (f > 4 && p.onGround) break;
    }
    return y0 - peak;
  };

  // Rise achieved from an external upward impulse with jump not held.
  const impulse = (v) => {
    settle();
    const y0 = p.y;
    let peak = y0;
    p.vy = v;
    for (let f = 0; f < 150; f++) {
      p.invuln = 9999;
      input.held = {}; input.pressed = {};
      play.update();
      peak = Math.min(peak, p.y);
      if (f > 4 && p.onGround) break;
    }
    return y0 - peak;
  };

  const full = hop(999);
  const short = hop(1);
  const ratio = full / short;

  // The full jump must be preserved — every authored gap depends on it.
  if (full < 52 || full > 60) throw new Error(`full jump ${full.toFixed(1)}px, want ~56`);
  // A short hop has to be genuinely usable, not a token 0.5 tiles.
  if (short < 22) throw new Error(`short hop only ${short.toFixed(1)}px (${(short / 16).toFixed(2)} tiles)`);
  // Target band for a tuned platformer is roughly 1:2 .. 1:2.5.
  if (ratio > 2.6) throw new Error(`min:max hop ratio 1:${ratio.toFixed(1)}, want <= 1:2.6`);

  // STOMP_BOUNCE is an external impulse and must reach the height it is tuned
  // for (~1.56 tiles) even with jump released.
  const bounce = impulse(STOMP_BOUNCE);
  if (bounce < 18) throw new Error(`stomp bounce only ${bounce.toFixed(1)}px (${(bounce / 16).toFixed(2)} tiles)`);
});

run('landing produces feedback, scaled by impact', () => {
  // physics.js has always computed a justLanded flag and nothing ever read it
  // for the player: landing had no dust, no squash, no sound.
  const play = new PlayState(game, 0);
  frames(play, 3);
  const p = play.player;

  const drop = (fromPx) => {
    p.x = play.level.playerStart.x;
    p.y = play.level.playerStart.y;
    p.vx = 0; p.vy = 0;
    for (let f = 0; f < 60; f++) { p.invuln = 9999; input.held = {}; input.pressed = {}; play.update(); }
    const groundY = p.y;
    p.y = groundY - fromPx;
    p.vy = 0;
    p.squashTimer = 0;
    const before = play.entities.filter(e => e instanceof Particle).length;
    for (let f = 0; f < 90; f++) {
      p.invuln = 9999; input.held = {}; input.pressed = {};
      play.update();
      if (p.onGround && f > 0) break;
    }
    return {
      dust: play.entities.filter(e => e instanceof Particle).length - before,
      squash: p.squashTimer,
    };
  };

  // A hard fall kicks up dust and squashes.
  const hard = drop(120);
  if (hard.dust <= 0) throw new Error('a hard landing produced no dust');
  if (hard.squash <= 0) throw new Error('a hard landing produced no squash');

  // Stepping off a 1px lip is not a landing and must stay silent.
  const tiny = drop(1);
  if (tiny.dust !== 0) throw new Error(`a 1px step produced ${tiny.dust} dust particles`);
  if (tiny.squash !== 0) throw new Error('a 1px step produced a squash');
});

run('particles render in their own color', () => {
  // Particle.draw used to fillRect with no fillStyle, so every burst painted in
  // whatever color leaked from the previous draw call and every palette passed
  // to burst() was dead data. Poison fillStyle first to catch a regression.
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const cg = c.getContext('2d');
  cg.fillStyle = '#ffe14a'; // the leaked lava yellow that used to win

  const read = (x, y) => {
    const d = cg.getImageData(x, y, 1, 1).data;
    return '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
  };

  new Particle(4, 4, 0, 0, '#ff00ff', 40, 2, 0).draw(cg, 0, 0);
  if (read(4, 4) !== '#ff00ff') throw new Error(`painted ${read(4, 4)}, want #ff00ff`);

  new Particle(20, 20, 0, 0, '#00ff88', 40, 2, 0).draw(cg, 0, 0);
  if (read(20, 20) !== '#00ff88') throw new Error(`painted ${read(20, 20)}, want #00ff88`);
});

run('camera shake is sampled once per frame for every layer', () => {
  // ox()/oy() used to roll Math.random() per call, and play.js and level.js
  // each call them separately — so the tilemap and the entities on top of it
  // shook by different offsets and visibly tore apart.
  const play = new PlayState(game, 4);
  frames(play, 5);
  play.camera.shake(30, 6);
  play.camera.tick();
  const a = [play.camera.ox(), play.camera.oy()];
  const b = [play.camera.ox(), play.camera.oy()];
  if (a[0] !== b[0] || a[1] !== b[1]) {
    throw new Error(`offsets differ within a frame: ${a} vs ${b}`);
  }
  // ...and it must actually decay, even when follow() is never called.
  const before = play.camera.shakeTimer;
  play.camera.tick();
  if (play.camera.shakeTimer !== before - 1) throw new Error('shake timer did not decay in tick()');
});

run('leviathan shield blocks damage until the pearl stun', () => {
  // This is the mechanic that a `window.location.href.includes('test')`
  // backdoor in takeHit used to switch off — which meant the shield and the
  // whole pearl puzzle were never actually exercised by any test.
  const play = new PlayState(game, 34); // LEVIATHAN'S TRENCH
  frames(play, 5);
  const boss = play.boss;
  const ctx = play.ctx();
  const hp = boss.hp;

  // Shielded and swimming: hits bounce off.
  boss.shieldActive = true;
  boss.state = 'swim';
  boss.hitInvuln = 0;
  if (boss.takeHit(ctx) !== false) throw new Error('shielded hit was accepted');
  if (boss.hp !== hp) throw new Error('shielded hit dealt damage');

  // A pearl popped during the vortex is the one honest way through.
  boss.state = 'vortex';
  boss.pearlExplode(ctx);
  if (boss.state !== 'stunned') throw new Error('pearl did not stun during vortex');
  boss.hitInvuln = 0;
  if (boss.takeHit(ctx) !== true) throw new Error('hit refused while stunned');
  if (boss.hp !== hp - 1) throw new Error('stunned hit dealt no damage');
  if (!boss.shieldActive) throw new Error('shield did not re-arm after the hit');
});

document.body.innerText = out.join('\n');
document.title = out.some(l => l.startsWith('FAIL')) ? 'FAIL' : 'ALLPASS';
