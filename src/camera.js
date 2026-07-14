import { VIEW_W, VIEW_H } from './constants.js';

export class Camera {
  constructor(level) {
    this.level = level;
    this.x = 0;
    this.y = 0;
    this.shakeTimer = 0;
    this.shakeMag = 0;
    // Shake offset, sampled once per frame by tick(). Every layer that renders
    // this frame must read the *same* offset, or the tilemap tears away from
    // the entities drawn on top of it.
    this.sx = 0;
    this.sy = 0;
  }

  snapTo(target) {
    this.x = this.clampX(target.x + target.w / 2 - VIEW_W / 2);
    this.y = this.clampY(target.y + target.h / 2 - VIEW_H / 2);
  }

  clampX(x) { return Math.max(0, Math.min(x, this.level.pxWidth - VIEW_W)); }
  clampY(y) { return Math.max(0, Math.min(y, this.level.pxHeight - VIEW_H)); }

  // Advance per-frame camera state. Called unconditionally, before any of
  // PlayState.update's early returns — follow() is skipped during the boss
  // intro and the level-clear hold, and decaying the shake in there left a
  // boss-death shake running at full magnitude for the whole clear sequence.
  tick() {
    if (this.shakeTimer > 0) {
      this.shakeTimer--;
      this.sx = (Math.random() * 2 - 1) * this.shakeMag;
      this.sy = (Math.random() * 2 - 1) * this.shakeMag;
    } else {
      this.sx = 0;
      this.sy = 0;
    }
  }

  follow(target) {
    const lookahead = target.facing * 24;
    const goalX = this.clampX(target.x + target.w / 2 + lookahead - VIEW_W / 2);
    const goalY = this.clampY(target.y + target.h / 2 - VIEW_H / 2 - 12);
    this.x += (goalX - this.x) * 0.22;
    this.y += (goalY - this.y) * 0.25;
  }

  shake(frames, mag) {
    this.shakeTimer = frames;
    this.shakeMag = mag;
  }

  // Integer render offset (with this frame's shake). Pure reads — safe to call
  // from every layer.
  ox() { return Math.round(this.x + this.sx); }
  oy() { return Math.round(this.y + this.sy); }
}
