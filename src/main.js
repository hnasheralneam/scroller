import { VIEW_W, VIEW_H, START_LIVES } from './constants.js';
import { input } from './input.js';
import { loadSave, writeSave } from './save.js';
import { PlayState } from './play.js';
import { TitleState, WorldMapState, LevelClearState, GameOverState, VictoryState } from './screens.js';
import { drawTextCentered } from './sprites.js';

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.screen = canvas.getContext('2d');
    // All game code draws into a fixed 320x240 buffer; each frame it is
    // blitted to the display canvas at an integer *device pixel* scale so
    // pixels stay crisp regardless of display scaling.
    this.buffer = document.createElement('canvas');
    this.buffer.width = VIEW_W;
    this.buffer.height = VIEW_H;
    this.g = this.buffer.getContext('2d');
    this.g.imageSmoothingEnabled = false;
    this.save = loadSave();
    this.paused = false;
    this.resetSession();
    this.state = new TitleState(this);
    this.fitCanvas();
    window.addEventListener('resize', () => this.fitCanvas());
  }

  fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const k = Math.max(1, Math.floor(Math.min(
      window.innerWidth * dpr / VIEW_W, window.innerHeight * dpr / VIEW_H)));
    this.canvas.width = VIEW_W * k;
    this.canvas.height = VIEW_H * k;
    this.canvas.style.width = `${VIEW_W * k / dpr}px`;
    this.canvas.style.height = `${VIEW_H * k / dpr}px`;
    this.screen.imageSmoothingEnabled = false;
  }

  resetSession() {
    this.lives = START_LIVES;
    this.coins = 0;
    this.totalCoins = 0;
    this.power = 'small';
  }

  toTitle() { this.state = new TitleState(this); }
  toWorldMap(cursor) {
    this.state = new WorldMapState(this, cursor !== undefined ? cursor : this.save.unlocked);
  }

  startLevel(index, respawn = null) {
    this.paused = false;
    this.state = new PlayState(this, index, respawn);
  }

  onLevelCleared(index) {
    this.save.unlocked = Math.max(this.save.unlocked, index + 1);
    writeSave(this.save);
    if (index === 14) this.state = new VictoryState(this);
    else this.state = new LevelClearState(this, index);
  }

  onPlayerDied(levelIndex, checkpoint) {
    this.lives--;
    this.power = 'small';
    if (this.lives < 0) this.state = new GameOverState(this);
    else this.startLevel(levelIndex, checkpoint);
  }

  update() {
    if (this.state instanceof PlayState) {
      if (input.justPressed('pause')) this.paused = !this.paused;
      if (this.paused) { input.endFrame(); return; }
    } else {
      this.paused = false;
    }
    this.state.update();
    input.endFrame();
  }

  draw() {
    this.g.imageSmoothingEnabled = false;
    this.state.draw(this.g);
    if (this.paused) {
      this.g.fillStyle = 'rgba(0,0,0,0.6)';
      this.g.fillRect(0, 0, VIEW_W, VIEW_H);
      drawTextCentered(this.g, 'PAUSED', VIEW_W / 2, 110, '#fff', 3);
      drawTextCentered(this.g, 'ESC TO RESUME', VIEW_W / 2, 140, '#9aa4b5');
    }
    this.screen.imageSmoothingEnabled = false;
    this.screen.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
  }
}

const game = new Game(document.getElementById('game'));

// Dev shortcut: open index.html#level=7 to jump straight into a level (0-14)
const hashLevel = location.hash.match(/^#level=(\d+)$/);
if (hashLevel) {
  const idx = Math.min(14, parseInt(hashLevel[1], 10));
  game.save.unlocked = Math.max(game.save.unlocked, idx);
  game.startLevel(idx);
}

// Fixed 60Hz update, rAF render
const STEP = 1000 / 60;
let acc = 0;
let last = performance.now();
function frame(now) {
  acc += Math.min(now - last, 100);
  last = now;
  while (acc >= STEP) {
    game.update();
    acc -= STEP;
  }
  game.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
