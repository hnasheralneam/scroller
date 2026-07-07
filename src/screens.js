import { VIEW_W, VIEW_H, WORLDS } from './constants.js';
import { input } from './input.js';
import { S, drawText, drawTextCentered } from './sprites.js';
import { sfx } from './audio.js';
import { LEVELS } from './levels/index.js';
import { music } from './music.js';

export { WorldMapState } from './worldmap.js';

const LAST_LEVEL = LEVELS.length - 1;

function starfield(g, time, color = 'rgba(255,255,255,0.5)') {
  for (let i = 0; i < 40; i++) {
    const x = (i * 53.7) % VIEW_W;
    const y = (i * 37.3 + time * (0.1 + (i % 3) * 0.12)) % VIEW_H;
    g.fillStyle = color;
    g.fillRect(x | 0, y | 0, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
  }
}

// ---------------------------------------------------------------------------
export class TitleState {
  constructor(game) {
    this.game = game;
    this.time = 0;
    music.play('title');
  }
  update() {
    this.time++;
    if (input.justPressed('confirm') || input.justPressed('jump')) {
      sfx.confirm();
      this.game.toWorldMap();
    }
  }
  draw(g) {
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#0a1030');
    grad.addColorStop(1, '#2a1a4a');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    starfield(g, this.time);

    const bob = Math.sin(this.time * 0.05) * 3;
    drawTextCentered(g, 'PIXEL', VIEW_W / 2, 40 + bob, '#ffd23e', 4);
    drawTextCentered(g, 'SCROLLER', VIEW_W / 2, 66 + bob, '#1fb8a6', 4);

    // hero running along the bottom
    const spr = S.playerBig.run[((this.time / 8) | 0) % 2].r;
    g.drawImage(spr, VIEW_W / 2 - spr.width / 2, 112);
    g.fillStyle = '#4a8f3c';
    g.fillRect(0, 140, VIEW_W, 4);

    if ((this.time / 30 | 0) % 2) drawTextCentered(g, 'PRESS ENTER', VIEW_W / 2, 160, '#fff', 2);
    drawTextCentered(g, 'ARROWS/WASD MOVE   Z/SPACE JUMP', VIEW_W / 2, 192, '#9aa4b5');
    drawTextCentered(g, 'JUMP AGAIN IN AIR   X SHOOT', VIEW_W / 2, 204, '#9aa4b5');
    drawTextCentered(g, '7 WORLDS. 7 BOSSES. GOOD LUCK.', VIEW_W / 2, 224, '#6b7382');
  }
}

// ---------------------------------------------------------------------------
export class LevelClearState {
  constructor(game, clearedIndex) {
    this.game = game;
    this.clearedIndex = clearedIndex;
    this.time = 0;
    this.wasBoss = !!LEVELS[clearedIndex].def.meta.boss;
    music.play('map');
  }
  update() {
    this.time++;
    if (this.time > 30 && (input.justPressed('confirm') || input.justPressed('jump'))) {
      sfx.confirm();
      this.game.toWorldMap(Math.min(this.clearedIndex + 1, LAST_LEVEL));
    }
  }
  draw(g) {
    const w = LEVELS[this.clearedIndex].world;
    g.fillStyle = '#101020';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    starfield(g, this.time, 'rgba(255,220,80,0.4)');
    drawTextCentered(g, this.wasBoss ? `WORLD ${w + 1} COMPLETE!` : `LEVEL CLEAR!`, VIEW_W / 2, 70, '#ffd23e', 2);
    if (this.wasBoss) drawTextCentered(g, `${WORLDS[w].name} IS SAFE`, VIEW_W / 2, 96, WORLDS[w].color);
    // after Coatl falls, tease the flooded final world
    if (this.wasBoss && w === WORLDS.length - 2) {
      drawTextCentered(g, 'BUT SOMETHING STIRS IN THE DEEP...', VIEW_W / 2, 110, '#2f7fd4');
    }
    g.drawImage(S.coin[0], VIEW_W / 2 - 26, 116);
    drawText(g, `x${this.game.coins}`, VIEW_W / 2 - 14, 118, '#ffd23e');
    drawTextCentered(g, `LIVES x${this.game.lives}`, VIEW_W / 2, 136, '#fff');
    if ((this.time / 30 | 0) % 2) drawTextCentered(g, 'PRESS ENTER', VIEW_W / 2, 170, '#fff');
  }
}

// ---------------------------------------------------------------------------
export class GameOverState {
  constructor(game) {
    this.game = game;
    this.time = 0;
    music.stop();
  }
  update() {
    this.time++;
    if (this.time > 40 && (input.justPressed('confirm') || input.justPressed('jump'))) {
      this.game.resetSession();
      this.game.toTitle();
    }
  }
  draw(g) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    drawTextCentered(g, 'GAME OVER', VIEW_W / 2, 100, '#e0342c', 3);
    drawTextCentered(g, 'YOUR PROGRESS IS SAVED', VIEW_W / 2, 140, '#9aa4b5');
    if (this.time > 40 && (this.time / 30 | 0) % 2) drawTextCentered(g, 'PRESS ENTER', VIEW_W / 2, 170, '#fff');
  }
}

// ---------------------------------------------------------------------------
export class VictoryState {
  constructor(game) {
    this.game = game;
    this.time = 0;
    this.sparks = [];
    music.play('title');
  }
  update() {
    this.time++;
    if (this.time % 22 === 0) {
      const cx = 40 + Math.random() * (VIEW_W - 80);
      const cy = 30 + Math.random() * 100;
      const color = ['#ffd23e', '#ff5a30', '#00ff88', '#6fd7ff', '#ff00ff'][(Math.random() * 5) | 0];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        this.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6, life: 45, color });
      }
      sfx.coin();
    }
    for (const s of this.sparks) {
      s.x += s.vx; s.y += s.vy; s.vy += 0.03; s.life--;
    }
    this.sparks = this.sparks.filter(s => s.life > 0);
    if (this.time > 120 && (input.justPressed('confirm') || input.justPressed('jump'))) {
      this.game.resetSession();
      this.game.toTitle();
    }
  }
  draw(g) {
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#0a1030');
    grad.addColorStop(1, '#2a1a4a');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    for (const s of this.sparks) {
      g.fillStyle = s.color;
      g.fillRect(s.x | 0, s.y | 0, 2, 2);
    }
    drawTextCentered(g, 'YOU WIN!', VIEW_W / 2, 60, '#ffd23e', 4);
    drawTextCentered(g, 'THE LEVIATHAN SLEEPS AGAIN', VIEW_W / 2, 100, '#2f7fd4');
    drawTextCentered(g, 'ALL 7 WORLDS ARE AT PEACE', VIEW_W / 2, 114, '#fff');
    drawTextCentered(g, `TOTAL COINS COLLECTED: ${this.game.totalCoins}`, VIEW_W / 2, 140, '#ffd23e');
    const spr = S.playerBig.idle.r;
    g.drawImage(spr, VIEW_W / 2 - spr.width / 2, 160);
    if (this.time > 120 && (this.time / 30 | 0) % 2) drawTextCentered(g, 'PRESS ENTER', VIEW_W / 2, 214, '#fff');
  }
}
