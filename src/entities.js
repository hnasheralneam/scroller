import { TILE, GRAVITY, MAX_FALL } from './constants.js';
import { S, drawText } from './sprites.js';
import { moveAndCollide, aabb } from './physics.js';
import { sfx } from './audio.js';

let tintCanvas = null;
function getTintCanvas(w, h) {
  if (!tintCanvas) {
    tintCanvas = document.createElement('canvas');
  }
  if (tintCanvas.width < w || tintCanvas.height < h) {
    tintCanvas.width = Math.max(tintCanvas.width, w);
    tintCanvas.height = Math.max(tintCanvas.height, h);
  }
  return tintCanvas;
}

export function drawTintedSprite(g, spr, x, y, color, alpha) {
  const temp = getTintCanvas(spr.width, spr.height);
  const tc = temp.getContext('2d');
  tc.clearRect(0, 0, spr.width, spr.height);
  tc.drawImage(spr, 0, 0);
  tc.globalCompositeOperation = 'source-in';
  tc.fillStyle = color;
  tc.fillRect(0, 0, spr.width, spr.height);
  tc.globalCompositeOperation = 'source-over';

  g.drawImage(spr, x, y);
  g.save();
  g.globalAlpha = alpha;
  g.drawImage(temp, 0, 0, spr.width, spr.height, x, y, spr.width, spr.height);
  g.restore();
}

export class Entity {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.dead = false;
    this.isEnemy = false;
    this.harmful = false;
    this.stompable = false;
    this.shootable = false;
    this.pickup = null;
    this.solidPlatform = false;
    this.facing = 1;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  update(ctx) {}
  draw(g, ox, oy) {}
  drawSprite(g, spr, ox, oy, dx = 0, dy = 0) {
    // center sprite horizontally on hitbox, feet-aligned
    g.drawImage(spr, Math.round(this.x + this.w / 2 - spr.width / 2 - ox + dx),
      Math.round(this.y + this.h - spr.height - oy + dy));
  }
  drawSpriteTinted(g, spr, ox, oy, color, alpha, dx = 0, dy = 0) {
    const rx = Math.round(this.x + this.w / 2 - spr.width / 2 - ox + dx);
    const ry = Math.round(this.y + this.h - spr.height - oy + dy);
    drawTintedSprite(g, spr, rx, ry, color, alpha);
  }
}

// ---------------------------------------------------------------------------
// Particles & text pops
// ---------------------------------------------------------------------------
export class Particle extends Entity {
  constructor(x, y, vx, vy, color, life = 40, size = 2, gravity = 0.15) {
    super(x, y, size, size);
    this.vx = vx; this.vy = vy;
    this.color = color; this.life = life; this.gravity = gravity;
  }
  update() {
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    if (--this.life <= 0) this.dead = true;
  }
  draw(g, ox, oy) {
    g.fillStyle = this.color;
    g.fillRect(Math.round(this.x - ox), Math.round(this.y - oy), this.w, this.h);
  }
}

export function burst(play, x, y, colors, n = 10, speed = 2.4, life = 40, gravity = 0.15) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    play.addEntity(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s - 1,
      colors[(Math.random() * colors.length) | 0], life * (0.6 + Math.random() * 0.8), 2, gravity));
  }
}

export class TextPop extends Entity {
  constructor(x, y, text, color = '#fff') {
    super(x, y, 1, 1);
    this.text = text; this.color = color; this.life = 50;
  }
  update() {
    this.y -= 0.5;
    if (--this.life <= 0) this.dead = true;
  }
  draw(g, ox, oy) {
    drawText(g, this.text, Math.round(this.x - ox), Math.round(this.y - oy), this.color);
  }
}

// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------
export class Coin extends Entity {
  constructor(x, y) {
    super(x + 4, y + 3, 8, 10);
    this.pickup = 'coin';
    this.baseY = this.y;
  }
  update(ctx) {
    this.y = this.baseY + Math.sin((ctx.level.time + this.x) * 0.07) * 1.5;
  }
  draw(g, ox, oy) {
    const f = ((performance.now() / 220) | 0) % 2;
    this.drawSprite(g, S.coin[f], ox, oy);
  }
}

// Power-up that pops out of a bumped block: 'berry' | 'orb' | 'oneup' | 'glitch'
export class PowerPickup extends Entity {
  constructor(tx, ty, kind) {
    super(tx * TILE + 3, ty * TILE + 3, 10, 10);
    this.kind = kind;
    this.pickup = kind;
    this.emerge = 20; // frames rising out of the block
    this.startY = this.y;
  }
  update(ctx) {
    if (this.emerge > 0) {
      this.emerge--;
      this.y -= 0.8;
      return;
    }
    if (this.kind === 'berry' || this.kind === 'oneup') {
      if (this.vx === 0) this.vx = this.kind === 'oneup' ? 1.0 : 0.6;
      this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
      const pvx = this.vx;
      moveAndCollide(this, ctx.level);
      if (this.hitWall) this.vx = -pvx;
    } else if (this.kind === 'glitch') {
      // bounces around chaotically
      if (this.vx === 0) this.vx = 1.2;
      this.vy = Math.min(this.vy + GRAVITY * 0.7, MAX_FALL);
      const pvx = this.vx;
      moveAndCollide(this, ctx.level);
      if (this.hitWall) this.vx = -pvx;
      if (this.onGround) this.vy = -3.4;
    }
    // orb stays put on its block
  }
  draw(g, ox, oy) {
    let spr;
    if (this.kind === 'berry') spr = S.berry;
    else if (this.kind === 'oneup') spr = S.oneup;
    else if (this.kind === 'orb') spr = S.orb;
    else spr = S.glitchCube[((performance.now() / 90) | 0) % 3];
    this.drawSprite(g, spr, ox, oy);
  }
}

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------
export class Flag extends Entity {
  constructor(x, y, level) {
    // pole extends from spawn tile down to the ground
    super(x + 6, y, 4, 0);
    let ty = Math.floor(y / TILE);
    while (ty < level.h && ![1, 2, 4, 9].includes(level.tileAt(Math.floor(x / TILE), ty))) ty++;
    this.h = ty * TILE - y;
    this.reached = false;
  }
  update(ctx) {
    if (!this.reached && aabb(this, ctx.player)) {
      this.reached = true;
      ctx.play.levelClear();
    }
  }
  draw(g, ox, oy) {
    const x = Math.round(this.x - ox), y = Math.round(this.y - oy);
    g.fillStyle = '#c9d2df';
    g.fillRect(x + 1, y, 2, this.h);
    g.fillStyle = '#e8a820';
    g.fillRect(x - 1, y - 3, 6, 4);
    // flag cloth
    g.fillStyle = this.reached ? '#ffd23e' : '#e0342c';
    const fy = this.reached ? y + 2 : y + 6;
    g.beginPath();
    g.moveTo(x + 3, fy);
    g.lineTo(x + 17, fy + 5);
    g.lineTo(x + 3, fy + 10);
    g.fill();
  }
}

export class Checkpoint extends Entity {
  constructor(x, y) {
    super(x + 5, y, 6, TILE);
    this.active = false;
  }
  update(ctx) {
    if (!this.active && aabb(this, ctx.player)) {
      this.active = true;
      sfx.checkpoint();
      ctx.play.setCheckpoint(this.x - 4, this.y);
    }
  }
  draw(g, ox, oy) {
    const x = Math.round(this.x - ox), y = Math.round(this.y - oy);
    g.fillStyle = '#8792a3';
    g.fillRect(x + 2, y - 8, 2, this.h + 8);
    g.fillStyle = this.active ? '#3ecb5a' : '#666';
    g.beginPath();
    g.moveTo(x + 4, y - 8);
    g.lineTo(x + 13, y - 4);
    g.lineTo(x + 4, y);
    g.fill();
  }
}

// Underwater checkpoint: an unanchored buoy that bobs on the surface, used in
// open-water levels where there's no floor to plant a pole into.
export class FloatingCheckpoint extends Entity {
  constructor(x, y) {
    super(x + 5, y, 6, TILE);
    this.active = false;
    this.baseY = y;
    this.bob = Math.random() * Math.PI * 2;
  }
  update(ctx) {
    this.bob += 0.05;
    this.y = this.baseY + Math.sin(this.bob) * 3;
    if (!this.active && aabb(this, ctx.player)) {
      this.active = true;
      sfx.checkpoint();
      ctx.play.setCheckpoint(this.x - 4, this.baseY);
    }
  }
  draw(g, ox, oy) {
    const x = Math.round(this.x - ox), y = Math.round(this.y - oy);
    // short mast + pennant
    g.fillStyle = '#8792a3';
    g.fillRect(x + 2, y - 6, 2, 12);
    g.fillStyle = this.active ? '#3ecb5a' : '#666';
    g.beginPath();
    g.moveTo(x + 4, y - 6);
    g.lineTo(x + 12, y - 3);
    g.lineTo(x + 4, y);
    g.fill();
    // buoy float riding the surface
    g.fillStyle = this.active ? '#3ecb5a' : '#c85a3e';
    g.fillRect(x - 2, y + 6, 10, 5);
    g.fillStyle = '#e8ecf2';
    g.fillRect(x - 2, y + 8, 10, 1);
  }
}

// ---------------------------------------------------------------------------
// Platforms
// ---------------------------------------------------------------------------
export class MovingPlatform extends Entity {
  constructor(x, y, vertical) {
    super(x, y, TILE * 2, 8);
    this.solidPlatform = true;
    this.vertical = vertical;
    this.origin = vertical ? y : x;
    this.range = TILE * 3;
    this.t = Math.random() * Math.PI * 2;
    this.dx = 0; this.dy = 0;
  }
  update() {
    this.t += 0.022;
    const off = Math.sin(this.t) * this.range;
    if (this.vertical) {
      const ny = this.origin + off;
      this.dy = ny - this.y; this.dx = 0;
      this.y = ny;
    } else {
      const nx = this.origin + off;
      this.dx = nx - this.x; this.dy = 0;
      this.x = nx;
    }
  }
  draw(g, ox, oy) {
    const x = Math.round(this.x - ox), y = Math.round(this.y - oy);
    g.fillStyle = '#b9c2cf';
    g.fillRect(x, y, this.w, 5);
    g.fillStyle = '#6b7382';
    g.fillRect(x, y + 4, this.w, 2);
    g.fillRect(x + 3, y + 5, 3, 3);
    g.fillRect(x + this.w - 6, y + 5, 3, 3);
  }
}

export class CrumblePlatform extends Entity {
  constructor(x, y) {
    super(x, y, TILE, 8);
    this.solidPlatform = true;
    this.state = 'idle'; // idle -> shaking -> falling -> gone
    this.timer = 0;
    this.homeX = x; this.homeY = y;
    this.dx = 0; this.dy = 0;
  }
  trigger() {
    if (this.state === 'idle') { this.state = 'shaking'; this.timer = 28; }
  }
  update(ctx) {
    this.dx = 0; this.dy = 0;
    if (this.state === 'shaking') {
      if (--this.timer <= 0) { this.state = 'falling'; this.solidPlatform = false; this.vy = 0; }
    } else if (this.state === 'falling') {
      this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
      this.y += this.vy;
      if (this.y > ctx.level.pxHeight + 40) { this.state = 'gone'; this.timer = 240; }
    } else if (this.state === 'gone') {
      if (--this.timer <= 0) {
        this.state = 'idle';
        this.solidPlatform = true;
        this.x = this.homeX; this.y = this.homeY;
      }
    }
  }
  draw(g, ox, oy) {
    if (this.state === 'gone') return;
    const sh = this.state === 'shaking' ? (Math.random() * 2 - 1) | 0 : 0;
    const x = Math.round(this.x - ox) + sh, y = Math.round(this.y - oy);
    g.fillStyle = '#a8886a';
    g.fillRect(x, y, this.w, 5);
    g.fillStyle = '#7a5c40';
    g.fillRect(x, y + 4, this.w, 2);
    g.fillRect(x + 2, y + 2, 2, 1);
    g.fillRect(x + 9, y + 3, 3, 1);
  }
}

// ---------------------------------------------------------------------------
// Projectiles
// ---------------------------------------------------------------------------
export class PlayerShot extends Entity {
  constructor(x, y, dir) {
    super(x, y, 5, 5);
    this.vx = 3.4 * dir;
    this.life = 240;
    this.isShot = true;
  }
  update(ctx) {
    this.vy = Math.min(this.vy + GRAVITY * 0.8, MAX_FALL);
    const pvx = this.vx;
    moveAndCollide(this, ctx.level);
    if (this.onGround) this.vy = -2.8;
    if (this.hitWall || pvx === 0 || --this.life <= 0) {
      this.dead = true;
      burst(ctx.play, this.cx, this.cy, ['#ffb020', '#fff2a0'], 4, 1.2, 20);
    }
  }
  draw(g, ox, oy) {
    this.drawSprite(g, S.spark, ox, oy);
  }
}

// Generic harmful enemy projectile.
export class HazardShot extends Entity {
  constructor(x, y, vx, vy, { gravity = 0, sprite = 'fireball', life = 400, dieOnTiles = true } = {}) {
    super(x, y, 5, 5);
    this.harmful = true;
    this.vx = vx; this.vy = vy;
    this.gravity = gravity;
    this.sprite = sprite;
    this.life = life;
    this.dieOnTiles = dieOnTiles;
  }
  update(ctx) {
    this.vy = Math.min(this.vy + this.gravity, MAX_FALL);
    if (this.dieOnTiles) {
      moveAndCollide(this, ctx.level);
      if (this.hitWall || this.onGround || this.hitCeiling) this.dead = true;
    } else {
      this.x += this.vx;
      this.y += this.vy;
    }
    if (--this.life <= 0 || this.y > ctx.level.pxHeight + 40) this.dead = true;
  }
  draw(g, ox, oy) {
    this.drawSprite(g, S[this.sprite] || S.fireball, ox, oy);
  }
}

// Ground shockwave (boss attack) — jump over it.
export class Shockwave extends Entity {
  constructor(x, y, dir) {
    super(x, y - 8, 10, 8);
    this.harmful = true;
    this.dir = dir;
    this.life = 110;
  }
  update(ctx) {
    this.x += this.dir * 2.2;
    // hug the ground
    this.vy = 3; this.vx = 0;
    moveAndCollide(this, ctx.level);
    if (this.hitWall || --this.life <= 0) this.dead = true;
  }
  draw(g, ox, oy) {
    const x = Math.round(this.x - ox), y = Math.round(this.y - oy);
    const f = ((performance.now() / 80) | 0) % 2;
    g.fillStyle = f ? '#ffe14a' : '#ff8c1a';
    g.fillRect(x, y + 2, this.w, 6);
    g.fillRect(x + 2, y, this.w - 4, 2);
  }
}

// Telegraphed lightning column: warns, then strikes.
export class LightningColumn extends Entity {
  constructor(x, level) {
    super(x, 0, 12, level.pxHeight);
    this.warn = 45;
    this.strike = 0;
  }
  update(ctx) {
    if (this.warn > 0) {
      if (--this.warn === 0) { this.strike = 16; this.harmful = true; sfx.zap(); }
    } else if (this.strike > 0) {
      if (--this.strike === 0) this.dead = true;
    }
  }
  draw(g, ox, oy) {
    const x = Math.round(this.x - ox);
    if (this.warn > 0) {
      if ((this.warn / 4 | 0) % 2) {
        g.fillStyle = 'rgba(255,255,120,0.35)';
        g.fillRect(x + 4, 0, 4, this.h);
      }
    } else {
      g.fillStyle = '#fff';
      g.fillRect(x + 3, 0, 6, this.h);
      g.fillStyle = '#ffe14a';
      g.fillRect(x, 0, 12, this.h);
      g.fillStyle = '#fff';
      g.fillRect(x + 5, 0, 2, this.h);
    }
  }
}

// Telegraphed laser beam (horizontal). Used by firewall turrets, the Kernel
// (with vertical `drift` to sweep), and the Toad King's tongue (via `color`).
export class LaserBeam extends Entity {
  constructor(x, y, w, { warn = 50, fire = 40, color = '#ff3344', thickness = 6, drift = 0 } = {}) {
    super(x, y, w, thickness);
    this.warn = warn;
    this.fire = fire;
    this.color = color;
    this.drift = drift;
  }
  update() {
    if (this.warn > 0) {
      if (--this.warn === 0) { this.harmful = true; sfx.zap(); }
    } else {
      this.y += this.drift;
      if (--this.fire <= 0) this.dead = true;
    }
  }
  draw(g, ox, oy) {
    const x = Math.round(this.x - ox), y = Math.round(this.y - oy);
    if (this.warn > 0) {
      if ((this.warn / 4 | 0) % 2) {
        g.globalAlpha = 0.45;
        g.fillStyle = this.color;
        g.fillRect(x, y + ((this.h / 2) | 0) - 1, this.w, 2);
        g.globalAlpha = 1;
      }
    } else {
      g.fillStyle = this.color;
      g.fillRect(x, y, this.w, this.h);
      g.fillStyle = '#fff';
      g.fillRect(x, y + ((this.h / 2) | 0) - 1, this.w, 2);
    }
  }
}

// Telegraphed ground eruption: blinking base marker, then a harmful column
// rises and retracts. style: 'fire' | 'crystal'.
export class EruptColumn extends Entity {
  constructor(x, groundY, height, { warn = 40, active = 45, style = 'fire' } = {}) {
    super(x, groundY, 12, 0);
    this.groundY = groundY;
    this.maxH = height;
    this.warn = warn;
    this.active = active;
    this.style = style;
    this.rise = 0;
  }
  update() {
    if (this.warn > 0) {
      if (--this.warn === 0) {
        this.harmful = true;
        this.style === 'crystal' ? sfx.breakBlock() : sfx.shoot();
      }
      return;
    }
    if (this.active > 0) {
      this.active--;
      this.rise = this.active < 8 ? this.active / 8 : Math.min(1, this.rise + 0.18);
      this.h = Math.max(1, Math.round(this.maxH * this.rise));
      this.y = this.groundY - this.h;
    } else {
      this.dead = true;
    }
  }
  draw(g, ox, oy) {
    const bx = Math.round(this.x - ox);
    const gy = Math.round(this.groundY - oy);
    if (this.warn > 0) {
      if ((this.warn / 4 | 0) % 2) {
        g.fillStyle = this.style === 'crystal' ? 'rgba(180,140,255,0.65)' :
        this.style === 'geyser' ? 'rgba(191,230,255,0.7)' : 'rgba(255,140,26,0.65)';
        g.fillRect(bx, gy - 3, this.w, 3);
      }
      return;
    }
    const h = this.h;
    if (h <= 1) return;
    if (this.style === 'crystal') {
      g.fillStyle = '#7a5adf';
      g.fillRect(bx + 1, gy - h, this.w - 2, h);
      g.fillStyle = '#b48cff';
      g.fillRect(bx + 3, gy - h, 2, h);
      g.fillRect(bx + 3, gy - h - 3, this.w - 6, 3);
      g.fillStyle = '#fff';
      g.fillRect(bx + 5, gy - h + 2, 1, Math.max(1, h - 6));
    } else if (this.style === 'vine') {
      // a whipping thorned vine lashing up from the floor
      const wig = Math.sin(performance.now() / 90 + this.x) * 2;
      g.fillStyle = '#2f8a44';
      g.fillRect(bx + 4 + Math.round(wig * 0.3), gy - h, 4, h);
      g.fillStyle = '#4ec26a';
      g.fillRect(bx + 5 + Math.round(wig * 0.5), gy - h, 2, h);
      // thorns / leaves alternating up the stalk
      g.fillStyle = '#1c5a2e';
      for (let i = 4; i < h; i += 6) {
        const side = (i / 6) % 2 ? 1 : -1;
        g.fillRect(bx + 6 + side * 3, gy - i, 3, 2);
      }
      // barbed tip
      g.fillStyle = '#8ad98a';
      g.fillRect(bx + 4 + Math.round(wig), gy - h - 3, 4, 4);
    } else if (this.style === 'geyser') {
      // churning column of water and foam
      const f = ((performance.now() / 60) | 0) % 2;
      g.fillStyle = '#4a9ad4';
      g.fillRect(bx + 1, gy - h, this.w - 2, h);
      g.fillStyle = f ? '#bfe6ff' : '#dff4ff';
      g.fillRect(bx + 3, gy - h + 2, this.w - 6, Math.max(1, h - 4));
      g.fillStyle = '#f4fbff';
      g.fillRect(bx + 2, gy - h - (f ? 3 : 1), this.w - 4, 3);
    } else {
      const f = ((performance.now() / 60) | 0) % 2;
      g.fillStyle = '#e33e1c';
      g.fillRect(bx + 1, gy - h, this.w - 2, h);
      g.fillStyle = f ? '#ff8c1a' : '#ffe14a';
      g.fillRect(bx + 3, gy - h + 2, this.w - 6, Math.max(1, h - 4));
      g.fillStyle = '#ffe14a';
      g.fillRect(bx + 4, gy - h - (f ? 3 : 1), 4, 3);
    }
  }
}

// Burning strip left on the ground by the Flame King's dash.
export class FireTrail extends Entity {
  constructor(x, y, life = 180) {
    super(x, y - 7, 14, 7);
    this.harmful = true;
    this.life = life;
    this.maxLife = life;
  }
  update() {
    if (--this.life <= 0) this.dead = true;
  }
  draw(g, ox, oy) {
    // sputter out near the end
    if (this.life < 40 && (this.life / 4 | 0) % 2) return;
    const x = Math.round(this.x - ox), y = Math.round(this.y - oy);
    const f = ((performance.now() / 70) | 0 + (this.x | 0)) % 2;
    g.fillStyle = '#e33e1c';
    g.fillRect(x, y + 3, this.w, 4);
    g.fillStyle = f ? '#ff8c1a' : '#ffe14a';
    g.fillRect(x + 2, y + 1, 3, 5);
    g.fillRect(x + 8, y + (f ? 0 : 2), 3, 6);
  }
}

// Expanding explosion (glitch mines)
export class Explosion extends Entity {
  constructor(x, y, radius = 22) {
    super(x - radius, y - radius, radius * 2, radius * 2);
    this.harmful = true;
    this.life = 22;
    this.maxLife = 22;
    this.radius = radius;
  }
  update() {
    if (--this.life <= 0) this.dead = true;
  }
  draw(g, ox, oy) {
    const t = 1 - this.life / this.maxLife;
    const r = this.radius * (0.4 + t * 0.6);
    g.fillStyle = this.life % 4 < 2 ? '#ffe14a' : '#ff8c1a';
    g.beginPath();
    g.arc(this.cx - ox, this.cy - oy, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(this.cx - ox, this.cy - oy, r * 0.45, 0, Math.PI * 2);
    g.fill();
  }
}

// Rotating firebar hazard around a pivot tile.
export class Firebar extends Entity {
  constructor(x, y) {
    super(x + 5, y + 5, 6, 6); // pivot
    this.angle = Math.random() * Math.PI * 2;
    this.balls = 4;
    this.spacing = 11;
    this.speed = 0.03;
  }
  update(ctx) {
    this.angle += this.speed;
    // harm is checked manually against each ball
    const p = ctx.player;
    if (p.glitchTimer > 0 || p.invuln > 0 || p.dying) return;
    for (let i = 1; i <= this.balls; i++) {
      const bx = this.cx + Math.cos(this.angle) * i * this.spacing;
      const by = this.cy + Math.sin(this.angle) * i * this.spacing;
      if (bx > p.x - 3 && bx < p.x + p.w + 3 && by > p.y - 3 && by < p.y + p.h + 3) {
        ctx.play.hurtPlayer();
        return;
      }
    }
  }
  draw(g, ox, oy) {
    for (let i = 1; i <= this.balls; i++) {
      const bx = this.cx + Math.cos(this.angle) * i * this.spacing - ox;
      const by = this.cy + Math.sin(this.angle) * i * this.spacing - oy;
      g.drawImage(S.fireball, Math.round(bx - 2), Math.round(by - 2));
    }
    g.fillStyle = '#8792a3';
    g.fillRect(Math.round(this.x - ox), Math.round(this.y - oy), 6, 6);
  }
}
