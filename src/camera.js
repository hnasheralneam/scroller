import { VIEW_W, VIEW_H } from './constants.js';

const LOOKAHEAD = 24;        // px ahead of the player, in their facing
const LOOKAHEAD_LERP = 0.05; // how fast the lookahead swings on a turn
const DEADZONE_X = 6;        // goal delta tolerated before the camera moves
const FOLLOW_X = 0.22;
const FOLLOW_Y = 0.25;
// How far the player may drift vertically, while airborne, before the camera
// starts tracking them. Sized so a full jump (~3.5 tiles) doesn't move it but
// a real fall or climb does.
const Y_WINDOW = 64;

export class Camera {
  constructor(level) {
    this.level = level;
    this.x = 0;
    this.y = 0;
    this.look = 0;
    this.goalY = 0;
    this.shakeTimer = 0;
    this.shakeMag = 0;
    // Shake offset, sampled once per frame by tick(). Every layer that renders
    // this frame must read the *same* offset, or the tilemap tears away from
    // the entities drawn on top of it.
    this.sx = 0;
    this.sy = 0;
  }

  snapTo(target) {
    this.look = target.facing * LOOKAHEAD;
    this.x = this.clampX(target.x + target.w / 2 - VIEW_W / 2);
    this.y = this.clampY(target.y + target.h / 2 - VIEW_H / 2);
    this.goalY = this.y;
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
    // `facing` flips between -1 and 1 the instant a direction is tapped, so
    // using it raw whipped the goal 48px across and the camera yo-yoed after
    // it. Ease the lookahead instead of the position it produces.
    this.look += (target.facing * LOOKAHEAD - this.look) * LOOKAHEAD_LERP;

    // Horizontal: a small deadzone so tiny corrections don't keep the camera
    // permanently creeping. Movement past it is still fully smoothed.
    const goalX = this.clampX(target.x + target.w / 2 + this.look - VIEW_W / 2);
    const dx = goalX - this.x;
    if (Math.abs(dx) > DEADZONE_X) {
      this.x += (dx - Math.sign(dx) * DEADZONE_X) * FOLLOW_X;
    }

    // Vertical: re-anchor on the ground, and while airborne only track once
    // the player leaves a window around the current view. Following y
    // unconditionally meant the camera rose and fell ~56px on every single
    // jump. (Invisible while every level is exactly one screen tall — clampY
    // pins y to 0 — but load-bearing the moment a level is taller.)
    const goalY = this.clampY(target.y + target.h / 2 - VIEW_H / 2 - 12);
    if (target.onGround) {
      this.goalY = goalY;
    } else {
      // Drag the anchor by only the amount the player has exceeded the window,
      // so it eases along with them rather than snapping the moment they cross.
      const dy = goalY - this.goalY;
      if (Math.abs(dy) > Y_WINDOW) this.goalY += dy - Math.sign(dy) * Y_WINDOW;
    }
    this.y += (this.clampY(this.goalY) - this.y) * FOLLOW_Y;
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
