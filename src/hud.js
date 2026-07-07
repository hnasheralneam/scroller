import { VIEW_W, GLITCH_DURATION } from './constants.js';
import { S, drawText, drawTextCentered } from './sprites.js';
import { LEVELS } from './levels/index.js';

export function drawHud(g, game, play) {
  // top bar backdrop
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 0, VIEW_W, 14);

  // coins
  g.drawImage(S.coin[0], 4, 3);
  drawText(g, `x${game.coins}`, 15, 5, '#ffd23e');

  // lives
  const px = 52;
  const head = S.playerSmall.idle.r;
  g.drawImage(head, 2, 0, 10, 9, px, 3, 10, 9);
  drawText(g, `x${game.lives}`, px + 13, 5, '#fff');

  // world - level
  const w = LEVELS[play.levelIndex].world + 1;
  const l = LEVELS[play.levelIndex].li + 1;
  drawTextCentered(g, `${w}-${l}`, VIEW_W / 2, 5, '#fff');

  // power state
  const p = play.player;
  if (p.power === 'big') g.drawImage(S.berry, 208, 3, 8, 8);
  else if (p.power === 'fire') g.drawImage(S.orb, 208, 3, 8, 8);

  // glitch timer bar
  if (p.glitchTimer > 0) {
    const frac = p.glitchTimer / GLITCH_DURATION;
    g.fillStyle = '#111';
    g.fillRect(228, 4, 60, 6);
    const hue = (performance.now() / 4) % 360;
    g.fillStyle = p.glitchTimer < 180 ? '#ff3344' : `hsl(${hue},100%,60%)`;
    g.fillRect(229, 5, Math.max(1, 58 * frac), 4);
  }

  // boss health: bordered bar with per-hp tick marks; flashes white on a
  // fresh hit and shifts color as the boss changes phase.
  const boss = play.boss;
  if (boss && !boss.dead && !play.bossIntro) {
    drawTextCentered(g, boss.name, VIEW_W / 2, 19, '#fff');
    const bw = 110, bh = 8;
    const bx = VIEW_W / 2 - bw / 2, by = 28;
    g.fillStyle = '#0a0a12';
    g.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    g.strokeStyle = '#e8ecf4';
    g.strokeRect(bx - 1.5, by - 1.5, bw + 3, bh + 3);
    const frac = boss.hp / boss.maxHp;
    const justHit = boss.hitInvuln > 58;
    const phaseCols = ['#ff3344', '#ff8c1a', '#ff00ff'];
    g.fillStyle = justHit ? '#fff' : phaseCols[Math.min(boss.phase - 1, 2)];
    g.fillRect(bx, by, Math.round(bw * frac), bh);
    // tick marks per hp
    g.fillStyle = 'rgba(10,10,18,0.6)';
    for (let i = 1; i < boss.maxHp; i++) {
      g.fillRect(bx + Math.round((bw * i) / boss.maxHp), by, 1, bh);
    }
  }
}
