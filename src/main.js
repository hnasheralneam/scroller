import { VIEW_W, VIEW_H, START_LIVES } from './constants.js';
import { input } from './input.js';
import { loadSave, writeSave } from './save.js';
import { PlayState } from './play.js';
import { TitleState, WorldMapState, LevelClearState, GameOverState, VictoryState } from './screens.js';
import { LEVELS } from './levels/index.js';
import { PauseMenu } from './pausemenu.js';
import { setMusicVolume, setSfxVolume, setMusicDuck } from './audio.js';
import { music } from './music.js';
import { initTouch } from './touch.js';

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
    setMusicVolume(this.save.musicVol);
    setSfxVolume(this.save.sfxVol);
    this.paused = false;
    this.pauseMenu = new PauseMenu(this);
    this.resetSession();
    this.state = new TitleState(this);
    this.fitCanvas();
    window.addEventListener('resize', () => this.fitCanvas());
    window.addEventListener('orientationchange', () => this.fitCanvas());
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.fitCanvas());
    }
  }

  fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    // Calculate the integer scale factor, accounting for device pixel ratio.
    // This ensures the buffer (320x240) scales to an integer multiple of itself
    // when blitted to the canvas, preventing interpolation blur.
    const fit = Math.min(
      window.innerWidth * dpr / VIEW_W, window.innerHeight * dpr / VIEW_H);
    let k = Math.max(1, Math.floor(fit));
    // On low-dpr small screens integer scaling can waste a big chunk of the
    // display; slight nearest-neighbor unevenness beats an unplayably small
    // view, so fall back to fractional scale when the fit is under 70%.
    if (k < fit * 0.7) k = fit;
    // Set canvas internal dimensions to integer multiple of buffer size
    this.canvas.width = Math.round(VIEW_W * k);
    this.canvas.height = Math.round(VIEW_H * k);
    // Set display size to fill window at the calculated scale
    // CSS pixels = device pixels / dpr
    this.canvas.style.width = `${VIEW_W * k / dpr}px`;
    this.canvas.style.height = `${VIEW_H * k / dpr}px`;
    // Ensure the blit destination dimensions are integer multiples of source
    this.bufferScale = k;
    this.screen.imageSmoothingEnabled = false;
  }

  resetSession() {
    this.lives = START_LIVES;
    this.coins = 0;
    this.totalCoins = 0;
    this.power = 'small';
  }

  // How far the world map may be navigated this session. Normally that's the
  // saved progress; the #level= dev shortcut widens it in memory only, so the
  // shortcut can never leak into the player's save.
  get unlockedLevels() {
    return Math.max(this.save.unlocked, this.unlockedOverride ?? 0);
  }

  toTitle() { this.state = new TitleState(this); }
  toWorldMap(cursor) {
    this.state = new WorldMapState(this, cursor !== undefined ? cursor : this.unlockedLevels);
  }

  startLevel(index, respawn = null) {
    this.paused = false;
    this.state = new PlayState(this, index, respawn);
  }

  onLevelCleared(index) {
    this.save.unlocked = Math.max(this.save.unlocked, index + 1);
    writeSave(this.save);
    if (index === LEVELS.length - 1) this.state = new VictoryState(this);
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
      if (!this.paused && input.justPressed('pause')) {
        this.paused = true;
        this.pauseMenu.reset();
        setMusicDuck(0.5);
        input.endFrame();
        return;
      }
      if (this.paused) {
        if (!this.pauseMenu.update()) {
          this.paused = false;
          setMusicDuck(1);
        }
        input.endFrame();
        return;
      }
    } else if (this.paused) {
      this.paused = false;
      setMusicDuck(1);
    }
    this.state.update();
    input.endFrame();
  }

  draw() {
    this.g.imageSmoothingEnabled = false;
    this.g.globalAlpha = 1;
    this.g.globalCompositeOperation = 'source-over';
    this.g.filter = 'none';
    this.g.clearRect(0, 0, VIEW_W, VIEW_H);
    this.state.draw(this.g);
    if (this.paused) this.pauseMenu.draw(this.g);
    this.screen.imageSmoothingEnabled = false;
    // Draw buffer to canvas at integer scale. Canvas dimensions are 320*k by 240*k,
    // so scaling the 320x240 buffer to canvas size is always an integer multiple.
    this.screen.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
  }
}

const game = new Game(document.getElementById('game'));
initTouch(game);

// Dev shortcut: open index.html#level=7 to jump straight into a level
// (combines with #touch, e.g. #level=7&touch)
//
// The unlock is deliberately session-only: it used to be written into
// game.save, which the next writeSave (any level clear, any volume tweak)
// committed permanently — so one #level=34 visit unlocked the whole game for
// good. `unlockedOverride` lives in memory and is never persisted.
const hashLevel = location.hash.match(/level=(\d+)/);
if (hashLevel) {
  const parsed = parseInt(hashLevel[1], 10);
  if (Number.isFinite(parsed)) {
    const idx = Math.max(0, Math.min(LEVELS.length - 1, parsed));
    game.unlockedOverride = idx;
    game.startLevel(idx);
  }
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
