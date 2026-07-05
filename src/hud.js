import { VIEW_W, GLITCH_DURATION } from './constants.js';
import { S, drawText, drawTextCentered } from './sprites.js';

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
  const w = Math.floor(play.levelIndex / 3) + 1;
  const l = (play.levelIndex % 3) + 1;
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

  // boss health
  const boss = play.boss;
  if (boss && !boss.dead) {
    drawTextCentered(g, boss.name, VIEW_W / 2, 20, '#fff');
    const total = boss.maxHp;
    const bw = total * 12;
    const bx = VIEW_W / 2 - bw / 2;
    for (let i = 0; i < total; i++) {
      g.fillStyle = i < boss.hp ? '#ff3344' : '#3a3a44';
      g.fillRect(bx + i * 12, 28, 10, 6);
    }
  }
}
