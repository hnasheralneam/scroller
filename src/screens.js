import { VIEW_W, VIEW_H, WORLDS } from './constants.js';
import { input } from './input.js';
import { S, drawText, drawTextCentered } from './sprites.js';
import { sfx } from './audio.js';

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
    drawTextCentered(g, '5 WORLDS. 5 BOSSES. GOOD LUCK.', VIEW_W / 2, 224, '#6b7382');
  }
}

// ---------------------------------------------------------------------------
export class WorldMapState {
  constructor(game, cursor = 0) {
    this.game = game;
    this.cursor = Math.min(cursor, game.save.unlocked, 14);
    this.time = 0;
  }
  update() {
    this.time++;
    const max = Math.min(this.game.save.unlocked, 14);
    if (input.justPressed('right') && this.cursor < max) { this.cursor++; sfx.select(); }
    if (input.justPressed('left') && this.cursor > 0) { this.cursor--; sfx.select(); }
    if (input.justPressed('down') && this.cursor + 3 <= max) { this.cursor += 3; sfx.select(); }
    if (input.justPressed('up') && this.cursor - 3 >= 0) { this.cursor -= 3; sfx.select(); }
    if (input.justPressed('confirm') || input.justPressed('jump')) {
      sfx.confirm();
      this.game.startLevel(this.cursor);
    }
  }
  draw(g) {
    g.fillStyle = '#101020';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    starfield(g, this.time, 'rgba(255,255,255,0.25)');
    drawTextCentered(g, 'SELECT LEVEL', VIEW_W / 2, 10, '#fff', 2);

    const max = Math.min(this.game.save.unlocked, 14);
    for (let w = 0; w < 5; w++) {
      const y = 32 + w * 38;
      const worldUnlocked = max >= w * 3;
      drawText(g, WORLDS[w].name, 16, y, worldUnlocked ? WORLDS[w].color : '#3a3a44');
      for (let l = 0; l < 3; l++) {
        const idx = w * 3 + l;
        const x = 190 + l * 40;
        const unlocked = idx <= max;
        const isBoss = l === 2;
        // node
        g.fillStyle = unlocked ? (isBoss ? '#8a2030' : '#2a4a6a') : '#22222c';
        g.fillRect(x, y - 4, 28, 16);
        g.fillStyle = unlocked ? (isBoss ? '#ff5a30' : '#6fd7ff') : '#3a3a44';
        g.fillRect(x + 1, y - 3, 26, 14);
        drawTextCentered(g, isBoss ? 'B' : `${l + 1}`, x + 14, y + 1, unlocked ? '#101020' : '#55555c');
        if (idx === this.cursor) {
          g.strokeStyle = (this.time / 15 | 0) % 2 ? '#fff' : '#ffd23e';
          g.strokeRect(x - 1.5, y - 6.5, 31, 21);
        }
      }
    }
    drawTextCentered(g, 'ENTER TO PLAY', VIEW_W / 2, 226, '#9aa4b5');
  }
}

// ---------------------------------------------------------------------------
export class LevelClearState {
  constructor(game, clearedIndex) {
    this.game = game;
    this.clearedIndex = clearedIndex;
    this.time = 0;
    this.wasBoss = clearedIndex % 3 === 2;
  }
  update() {
    this.time++;
    if (this.time > 30 && (input.justPressed('confirm') || input.justPressed('jump'))) {
      sfx.confirm();
      this.game.toWorldMap(Math.min(this.clearedIndex + 1, 14));
    }
  }
  draw(g) {
    const w = Math.floor(this.clearedIndex / 3);
    g.fillStyle = '#101020';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    starfield(g, this.time, 'rgba(255,220,80,0.4)');
    drawTextCentered(g, this.wasBoss ? `WORLD ${w + 1} COMPLETE!` : `LEVEL CLEAR!`, VIEW_W / 2, 70, '#ffd23e', 2);
    if (this.wasBoss) drawTextCentered(g, `${WORLDS[w].name} IS SAFE`, VIEW_W / 2, 96, WORLDS[w].color);
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
    drawTextCentered(g, 'THE FLAME KING HAS FALLEN', VIEW_W / 2, 100, '#ff5a30');
    drawTextCentered(g, 'ALL 5 WORLDS ARE AT PEACE', VIEW_W / 2, 114, '#fff');
    drawTextCentered(g, `TOTAL COINS COLLECTED: ${this.game.totalCoins}`, VIEW_W / 2, 140, '#ffd23e');
    const spr = S.playerBig.idle.r;
    g.drawImage(spr, VIEW_W / 2 - spr.width / 2, 160);
    if (this.time > 120 && (this.time / 30 | 0) % 2) drawTextCentered(g, 'PRESS ENTER', VIEW_W / 2, 214, '#fff');
  }
}
