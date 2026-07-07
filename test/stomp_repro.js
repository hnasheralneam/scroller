// Reproduction check for the "stomp on a jumping boss also hurts you" bug:
// runs a full, real Toad King fight with realistic input (approach, jump,
// land stomps whenever airborne above the boss) and asserts the player is
// never hurt by contact immediately following a frame where the boss lost HP
// from a stomp (the exact "damaged as well as them" complaint).
import { PlayState } from '../src/play.js';
import { input } from '../src/input.js';

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

const play = new PlayState(game, 4); // Toad King arena
let framesSinceStomp = Infinity;
let stompCount = 0;
let violation = null;
const GRACE_WINDOW = 15; // frames within which a hurt right after a stomp is suspect

for (let f = 0; f < 3000 && !game.cleared && !violation; f++) {
  const boss = play.boss;
  const p = play.player;
  const towardBoss = boss ? Math.sign(boss.cx - p.cx) : 1;
  input.held = {
    left: towardBoss < 0,
    right: towardBoss >= 0,
    jump: !p.onGround || f % 20 < 3, // keep hopping to attempt stomps
  };
  input.pressed = (p.onGround && f % 20 === 0) ? { jump: true } : {};

  const hpBefore = boss ? boss.hp : 0;
  const invulnBefore = p.invuln;
  play.update();
  if (f % 5 === 0) play.draw(g);

  if (boss && boss.hp < hpBefore) { framesSinceStomp = 0; stompCount++; }
  else framesSinceStomp++;

  if (p.invuln > invulnBefore && framesSinceStomp <= GRACE_WINDOW) {
    violation = `player hurt ${framesSinceStomp} frame(s) after a stomp landed (f=${f}, stomp #${stompCount})`;
  }
}

out.push(violation
  ? `FAIL: ${violation}`
  : `PASS: full fight ran to frame-limit or clear (cleared=${game.cleared}), ${stompCount} stomps landed, none followed by a hurt within ${GRACE_WINDOW}f`);
document.body.innerText = out.join('\n');
document.title = out.some(l => l.startsWith('FAIL')) ? 'FAIL' : 'ALLPASS';
