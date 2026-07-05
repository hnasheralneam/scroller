import { VIEW_W, VIEW_H } from './constants.js';

export class Camera {
  constructor(level) {
    this.level = level;
    this.x = 0;
    this.y = 0;
    this.shakeTimer = 0;
    this.shakeMag = 0;
  }

  snapTo(target) {
    this.x = this.clampX(target.x + target.w / 2 - VIEW_W / 2);
    this.y = this.clampY(target.y + target.h / 2 - VIEW_H / 2);
  }

  clampX(x) { return Math.max(0, Math.min(x, this.level.pxWidth - VIEW_W)); }
  clampY(y) { return Math.max(0, Math.min(y, this.level.pxHeight - VIEW_H)); }

  follow(target) {
    const lookahead = target.facing * 24;
    const goalX = this.clampX(target.x + target.w / 2 + lookahead - VIEW_W / 2);
    const goalY = this.clampY(target.y + target.h / 2 - VIEW_H / 2 - 12);
    this.x += (goalX - this.x) * 0.22;
    this.y += (goalY - this.y) * 0.25;
    if (this.shakeTimer > 0) this.shakeTimer--;
  }

  shake(frames, mag) {
    this.shakeTimer = frames;
    this.shakeMag = mag;
  }

  // Integer render offset (with shake)
  ox() {
    const s = this.shakeTimer > 0 ? (Math.random() * 2 - 1) * this.shakeMag : 0;
    return Math.round(this.x + s);
  }
  oy() {
    const s = this.shakeTimer > 0 ? (Math.random() * 2 - 1) * this.shakeMag : 0;
    return Math.round(this.y + s);
  }
}
