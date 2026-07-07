import { TILE, GRAVITY, MAX_FALL } from './constants.js';
import { S } from './sprites.js';
import { moveAndCollide, groundAhead } from './physics.js';
import { Entity, HazardShot, Explosion, LaserBeam, burst } from './entities.js';
import { sfx } from './audio.js';

export class Enemy extends Entity {
  constructor(x, y, w, h) {
    super(x, y, w, h);
    this.isEnemy = true;
    this.harmful = true;
    this.stompable = true;
    this.shootable = true;
    this.animTime = 0;
  }
  // default kill effects
  squash(ctx) {
    this.dead = true;
    sfx.stomp();
    burst(ctx.play, this.cx, this.cy, this.deathColors || ['#888', '#ccc'], 8, 1.8, 26);
  }
  shot(ctx) {
    this.dead = true;
    burst(ctx.play, this.cx, this.cy, this.deathColors || ['#888', '#ccc'], 10, 2.2, 32);
  }
  frame(speed = 12) {
    return ((this.animTime / speed) | 0) % 2;
  }
  drawFacing(g, frames, ox, oy) {
    const f = frames[this.frame()];
    this.drawSprite(g, this.facing >= 0 ? f.r : f.l, ox, oy);
  }
}

// --- World 1: Green Meadows ------------------------------------------------

// Ambles along; stomp it into its shell, then kick the shell to send it
// sliding through other enemies. The shell hurts you if it comes back.
export class Shellsnail extends Enemy {
  constructor(x, y) {
    super(x + 2, y + 7, 12, 9);
    this.facing = -1;
    this.state = 'walk'; // walk -> shell -> slide
    this.timer = 0;
    this.kickGrace = 0;
    this.deathColors = ['#b06a32', '#c2dc86'];
  }
  update(ctx) {
    this.animTime++;
    if (this.kickGrace > 0) this.kickGrace--;
    if (this.state === 'walk') {
      this.vx = 0.35 * this.facing;
    } else if (this.state === 'shell') {
      this.vx = 0;
      if (--this.timer <= 0) { this.state = 'walk'; this.harmful = true; this.h = 9; }
    } else if (this.state === 'slide') {
      this.vx = 3.2 * this.facing;
      if (this.kickGrace === 0) this.harmful = true;
    }
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    const pvx = this.vx;
    moveAndCollide(this, ctx.level);
    if (this.state === 'slide') {
      if (this.hitWall) { // ricochet off walls
        this.facing *= -1;
        this.vx = -pvx;
        sfx.bump();
        burst(ctx.play, this.facing > 0 ? this.x : this.x + this.w, this.cy,
          ['#b06a32', '#cfd6e0'], 4, 1.4, 16);
      }
    } else if (this.hitWall || (this.onGround && !groundAhead(this, ctx.level, this.facing))) {
      this.facing *= -1; // edge-aware: never wander into a pit
    }
    if (this.y > ctx.level.pxHeight + 20) this.dead = true;
  }
  get isSlidingShell() { return this.state === 'slide' && this.kickGrace === 0; }
  kick(ctx) {
    this.state = 'slide';
    this.facing = ctx.player.cx < this.cx ? 1 : -1;
    this.harmful = false; // brief grace so the kick itself never hurts
    this.kickGrace = 12;
    sfx.stomp();
  }
  squash(ctx) {
    if (this.state === 'walk') {
      this.state = 'shell';
      this.timer = 300;
      this.harmful = false;
      this.h = 7;
      this.y += 2;
      sfx.stomp();
      burst(ctx.play, this.cx, this.y, ['#c2dc86'], 5, 1.4, 18);
    } else if (this.state === 'slide') {
      this.state = 'shell';
      this.timer = 300;
      this.harmful = false;
      sfx.stomp();
    } else {
      this.kick(ctx);
    }
  }
  onTouch(ctx) {
    if (this.state === 'shell') this.kick(ctx);
  }
  draw(g, ox, oy) {
    if (this.state === 'walk') {
      this.drawFacing(g, S.snail, ox, oy);
    } else {
      const spin = this.state === 'slide' && (this.animTime / 4 | 0) % 2;
      this.drawSprite(g, spin ? S.shell.l : S.shell.r, ox, oy);
    }
  }
}
// A fat striped bee: bobs in place, rattles as a warning, then charges.
export class Bumblebore extends Enemy {
  constructor(x, y) {
    super(x + 2, y + 4, 12, 9);
    this.baseX = this.x;
    this.baseY = this.y;
    this.state = 'hover';
    this.timer = 0;
    this.cooldown = 60;
    this.facing = -1;
    this.deathColors = ['#ffce3e', '#20242c'];
  }
  update(ctx) {
    this.animTime++;
    const p = ctx.player;
    if (this.cooldown > 0) this.cooldown--;
    if (this.state === 'hover') {
      this.x = this.baseX + Math.sin(this.animTime * 0.02) * 14;
      this.y = this.baseY + Math.sin(this.animTime * 0.08) * 3;
      this.facing = Math.sign(p.cx - this.cx) || this.facing;
      if (this.cooldown === 0 && Math.abs(p.cy - this.cy) < 16 && Math.abs(p.cx - this.cx) < 130) {
        this.state = 'rattle';
        this.timer = 32;
      }
    } else if (this.state === 'rattle') {
      this.x += (Math.random() * 2 - 1) * 1.2; // angry buzz telegraph
      if (--this.timer <= 0) {
        this.state = 'charge';
        this.timer = 46;
        this.facing = Math.sign(p.cx - this.cx) || 1;
        sfx.zap();
      }
    } else if (this.state === 'charge') {
      this.x += 2.8 * this.facing;
      const tx = Math.floor((this.facing > 0 ? this.x + this.w + 1 : this.x - 1) / 16);
      const solidAhead = ctx.level.tileAt(tx, Math.floor(this.cy / 16));
      if (--this.timer <= 0 || solidAhead !== 0) {
        this.state = 'return';
        this.cooldown = 90;
      }
    } else { // drift back home
      this.x += Math.sign(this.baseX - this.x) * Math.min(1, Math.abs(this.baseX - this.x));
      this.y += Math.sign(this.baseY - this.y) * Math.min(1, Math.abs(this.baseY - this.y));
      if (Math.abs(this.baseX - this.x) < 2 && Math.abs(this.baseY - this.y) < 2) this.state = 'hover';
    }
  }
  draw(g, ox, oy) {
    const fast = this.state === 'rattle' || this.state === 'charge';
    const f = S.bee[((this.animTime / (fast ? 2 : 6)) | 0) % 2];
    this.drawSprite(g, this.facing >= 0 ? f.r : f.l, ox, oy);
  }
}

// A flower that looks decorative — until you get close and it lunges.
// Anchored to its root: it never chases you off its tile.
export class Snapdragon extends Enemy {
  constructor(x, y) {
    super(x + 3, y + 4, 10, 12);
    this.rootX = this.x;
    this.rootY = this.y;
    this.stompable = false;
    this.harmful = false; // harmless while disguised
    this.state = 'hidden';
    this.timer = 0;
    this.deathColors = ['#e0559a', '#4a9e3c'];
  }
  update(ctx) {
    this.animTime++;
    const p = ctx.player;
    const dist = Math.hypot(p.cx - this.cx, p.cy - this.cy);
    if (this.state === 'hidden') {
      if (dist < 46) {
        this.state = 'rear';
        this.timer = 16;
        sfx.bump();
      }
    } else if (this.state === 'rear') {
      if (--this.timer <= 0) {
        this.state = 'lunge';
        this.harmful = true;
        this.facing = Math.sign(p.cx - this.cx) || 1;
        this.vy = -3.0;
        this.vx = 0.9 * this.facing;
      }
    } else if (this.state === 'lunge') {
      this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
      moveAndCollide(this, ctx.level);
      if (this.onGround && this.vy === 0) {
        this.state = 'retreat';
        this.timer = 30;
        this.vx = 0;
      }
    } else if (this.state === 'retreat') {
      // crawl back to the root, then hide again
      const dx = this.rootX - this.x;
      this.x += Math.sign(dx) * Math.min(0.6, Math.abs(dx));
      if (--this.timer <= 0 && Math.abs(dx) < 2) {
        this.x = this.rootX;
        this.y = this.rootY;
        this.state = 'hidden';
        this.harmful = false;
      }
    }
  }
  draw(g, ox, oy) {
    if (this.state === 'hidden') {
      // subtle sway is the only tell
      const sway = Math.sin(this.animTime * 0.04) > 0.6 ? 1 : 0;
      this.drawSprite(g, S.snapIdle.r, ox, oy, sway, 0);
    } else if (this.state === 'rear') {
      const sh = ((Math.random() * 2 - 1) * 1.5) | 0;
      this.drawSprite(g, S.snapIdle.r, ox, oy, sh, -2);
    } else {
      this.drawFacing(g, [S.snapLunge, S.snapLunge], ox, oy);
    }
  }
}

// --- World 2: Crystal Caverns ----------------------------------------------
export class Bat extends Enemy {
  constructor(x, y) {
    super(x + 2, y + 4, 12, 6);
    this.baseY = this.y;
    this.baseX = this.x;
    this.t = Math.random() * Math.PI * 2;
    this.deathColors = ['#8a5adf', '#5c3a9e'];
  }
  update(ctx) {
    this.animTime++;
    this.t += 0.035;
    this.x = this.baseX + Math.sin(this.t) * 44;
    this.y = this.baseY + Math.sin(this.t * 2.3) * 12;
    this.facing = Math.cos(this.t) >= 0 ? 1 : -1;
  }
  draw(g, ox, oy) { this.drawFacing(g, S.bat, ox, oy); }
}

export class Stalactite extends Enemy {
  constructor(x, y) {
    super(x + 4, y, 8, 12);
    this.stompable = false;
    this.harmful = false; // harmless while hanging
    this.state = 'hang';
    this.shake = 0;
    this.deathColors = ['#b9c2cf', '#8792a3'];
  }
  update(ctx) {
    const p = ctx.player;
    if (this.state === 'hang') {
      if (Math.abs(p.cx - this.cx) < 14 && p.y > this.y) {
        this.state = 'shake';
        this.shake = 18;
      }
    } else if (this.state === 'shake') {
      if (--this.shake <= 0) { this.state = 'fall'; this.harmful = true; }
    } else {
      this.vy = Math.min(this.vy + GRAVITY * 1.3, 7);
      moveAndCollide(this, ctx.level);
      if (this.onGround) {
        this.dead = true;
        sfx.breakBlock();
        burst(ctx.play, this.cx, this.y + this.h, this.deathColors, 8, 1.6, 24);
      }
    }
  }
  draw(g, ox, oy) {
    const sh = this.state === 'shake' ? ((Math.random() * 2 - 1) * 1.5) | 0 : 0;
    g.drawImage(S.stalactite, Math.round(this.x - 0 - ox) + sh, Math.round(this.y - oy));
  }
}

export class Crawler extends Enemy {
  constructor(x, y) {
    super(x + 2, y + 9, 12, 7);
    this.facing = -1;
    this.stompable = false; // spiky!
    this.deathColors = ['#5c3a3a', '#cfd6e0'];
  }
  update(ctx) {
    this.animTime++;
    this.vx = 0.5 * this.facing;
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    moveAndCollide(this, ctx.level);
    if (this.hitWall || (this.onGround && !groundAhead(this, ctx.level, this.facing))) {
      this.facing *= -1;
    }
  }
  draw(g, ox, oy) { this.drawFacing(g, S.crawler, ox, oy); }
}

// --- World 3: Sky Islands --------------------------------------------------
export class Puff extends Enemy {
  constructor(x, y) {
    super(x + 3, y + 4, 10, 7);
    this.t = Math.random() * Math.PI * 2;
    this.deathColors = ['#f4f7ff', '#c9d4ea'];
  }
  update(ctx) {
    this.animTime++;
    this.t += 0.03;
    const p = ctx.player;
    const dx = p.cx - this.cx, dy = p.cy - this.cy;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 150) {
      this.x += (dx / d) * 0.35;
      this.y += (dy / d) * 0.25;
      this.facing = Math.sign(dx) || 1;
    }
    this.y += Math.sin(this.t) * 0.4;
  }
  draw(g, ox, oy) { this.drawFacing(g, S.puff, ox, oy); }
}

export class CloudTurret extends Enemy {
  constructor(x, y) {
    super(x + 1, y + 4, 14, 10);
    this.timer = 80 + Math.random() * 60;
    this.deathColors = ['#eef2fb', '#40485c'];
  }
  update(ctx) {
    this.animTime++;
    const p = ctx.player;
    if (--this.timer <= 0) {
      this.timer = 150;
      const dx = p.cx - this.cx;
      if (Math.abs(dx) < 150 && Math.abs(p.cy - this.cy) < 120) {
        const vx = Math.max(-2, Math.min(2, dx / 60));
        ctx.play.addEntity(new HazardShot(this.cx - 2, this.y + 4, vx, -3.2,
          { gravity: 0.12, sprite: 'spark', life: 300 }));
        sfx.shoot();
      }
    }
  }
  draw(g, ox, oy) { this.drawSprite(g, S.cloudTurret, ox, oy); }
}

// --- World 4: The Mainframe ------------------------------------------------
export class Drone extends Enemy {
  constructor(x, y) {
    super(x + 2, y + 4, 12, 8);
    this.baseX = this.x;
    this.state = 'patrol';
    this.timer = 0;
    this.cooldown = 0;
    this.facing = 1;
    this.deathColors = ['#9aa4b5', '#39ff7a'];
  }
  update(ctx) {
    this.animTime++;
    const p = ctx.player;
    if (this.cooldown > 0) this.cooldown--;
    if (this.state === 'patrol') {
      this.x += 0.55 * this.facing;
      if (this.x > this.baseX + 40 || this.x < this.baseX - 40) this.facing *= -1;
      if (this.cooldown === 0 && Math.abs(p.cy - this.cy) < 22 && Math.abs(p.cx - this.cx) < 130) {
        this.state = 'aim';
        this.timer = 26;
        this.facing = Math.sign(p.cx - this.cx) || 1;
      }
    } else if (this.state === 'aim') {
      if (--this.timer <= 0) { this.state = 'dash'; this.timer = 38; sfx.zap(); }
    } else {
      this.x += 3 * this.facing;
      if (--this.timer <= 0) { this.state = 'patrol'; this.cooldown = 90; this.baseX = this.x; }
    }
  }
  draw(g, ox, oy) {
    if (this.state === 'aim' && (this.timer / 3 | 0) % 2) {
      g.fillStyle = 'rgba(255,50,50,0.5)';
      g.fillRect(Math.round(this.x - 2 - ox), Math.round(this.y - 2 - oy), this.w + 4, this.h + 4);
    }
    this.drawFacing(g, S.drone, ox, oy);
  }
}

export class FirewallTurret extends Enemy {
  constructor(x, y) {
    super(x + 3, y + 4, 10, 12);
    this.timer = 60 + Math.random() * 80;
    this.deathColors = ['#2c3c50', '#ff3344'];
  }
  update(ctx) {
    this.animTime++;
    if (--this.timer <= 0) {
      this.timer = 190;
      // fire a beam toward the player's side, spanning to the nearest wall
      const dir = Math.sign(ctx.player.cx - this.cx) || 1;
      let len = 0;
      const ty = Math.floor((this.y + 5) / TILE);
      let tx = Math.floor(this.cx / TILE) + dir;
      while (len < 9 && ctx.level.tileAt(tx, ty) === 0) { len++; tx += dir; }
      if (len > 0) {
        const px = dir > 0 ? this.x + this.w : this.x - len * TILE;
        ctx.play.addEntity(new LaserBeam(px, this.y + 3, len * TILE, { warn: 45, fire: 35 }));
      }
    }
  }
  draw(g, ox, oy) { this.drawSprite(g, S.firewall, ox, oy); }
}

export class GlitchMine extends Enemy {
  constructor(x, y, fuse = 0) {
    super(x + 4, y + 4, 8, 8);
    this.harmful = false;
    this.stompable = false;
    this.state = 'idle';
    this.timer = 0;
    this.deathColors = ['#39ff7a', '#1f8a44'];
    if (fuse > 0) { this.state = 'armed'; this.timer = fuse; } // boss-spawned: timed
  }
  update(ctx) {
    this.animTime++;
    const p = ctx.player;
    if (this.state === 'idle') {
      if (Math.hypot(p.cx - this.cx, p.cy - this.cy) < 44) {
        this.state = 'armed';
        this.timer = 40;
        sfx.bump();
      }
    } else if (this.state === 'armed') {
      if (--this.timer <= 0) {
        this.dead = true;
        ctx.play.addEntity(new Explosion(this.cx, this.cy, 24));
        sfx.explode();
      }
    }
  }
  shot(ctx) {
    this.dead = true;
    burst(ctx.play, this.cx, this.cy, this.deathColors, 8, 2, 28);
  }
  draw(g, ox, oy) {
    const fast = this.state === 'armed';
    const f = ((this.animTime / (fast ? 3 : 20)) | 0) % 2;
    this.drawSprite(g, S.mine[f], ox, oy);
  }
}

// --- World 5: Molten Keep --------------------------------------------------
export class FireImp extends Enemy {
  constructor(x, y) {
    super(x + 3, y + 6, 10, 10);
    this.facing = -1;
    this.timer = 70 + Math.random() * 60;
    this.deathColors = ['#e04a30', '#ffd23e'];
  }
  update(ctx) {
    this.animTime++;
    this.vx = 0.35 * this.facing;
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    moveAndCollide(this, ctx.level);
    if (this.hitWall || (this.onGround && !groundAhead(this, ctx.level, this.facing))) {
      this.facing *= -1;
    }
    const p = ctx.player;
    if (--this.timer <= 0) {
      this.timer = 130;
      if (Math.abs(p.cx - this.cx) < 150) {
        this.facing = Math.sign(p.cx - this.cx) || 1;
        ctx.play.addEntity(new HazardShot(this.cx, this.y, this.facing * 1.4, -3.4,
          { gravity: 0.14, sprite: 'fireball', life: 300 }));
        sfx.shoot();
      }
    }
  }
  draw(g, ox, oy) { this.drawFacing(g, S.imp, ox, oy); }
}

export class LavaBubble extends Enemy {
  constructor(x, y) {
    super(x + 4, y + 8, 8, 8);
    this.stompable = false;
    this.shootable = false;
    this.homeY = this.y;
    this.timer = Math.random() * 150;
    this.state = 'wait';
  }
  update(ctx) {
    this.animTime++;
    if (this.state === 'wait') {
      if (--this.timer <= 0) {
        this.state = 'leap';
        this.vy = -6.8;
        sfx.bounce();
      }
    } else {
      this.vy += GRAVITY;
      this.y += this.vy;
      if (this.vy > 0 && this.y >= this.homeY) {
        this.y = this.homeY;
        this.state = 'wait';
        this.timer = 140;
      }
    }
  }
  draw(g, ox, oy) {
    if (this.state === 'wait') return; // hidden in the lava
    const f = ((this.animTime / 6) | 0) % 2;
    const img = S.flame[f];
    g.save();
    if (this.vy > 0) { // falling: flip upside down
      g.translate(this.cx - ox, this.cy - oy);
      g.rotate(Math.PI);
      g.drawImage(img, -img.width / 2, -img.height / 2);
    } else {
      this.drawSprite(g, img, ox, oy);
    }
    g.restore();
  }
}

// --- World 6: Jungle Ruins -------------------------------------------------
// A poison dart frog: sits still, then hops toward the player in short arcs.
export class DartFrog extends Enemy {
  constructor(x, y) {
    super(x + 3, y + 9, 10, 7);
    this.facing = -1;
    this.timer = 40 + Math.random() * 60;
    this.deathColors = ['#2fae7a', '#e8c85a'];
  }
  update(ctx) {
    this.animTime++;
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    if (this.onGround) {
      this.vx = 0;
      if (--this.timer <= 0) {
        this.timer = 70 + Math.random() * 40;
        this.facing = Math.sign(ctx.player.cx - this.cx) || this.facing;
        if (groundAhead(this, ctx.level, this.facing)) {
          this.vy = -4.2;
          this.vx = 1.3 * this.facing;
        }
      }
    }
    moveAndCollide(this, ctx.level);
    if (this.hitWall) this.vx = 0;
    if (this.y > ctx.level.pxHeight + 20) this.dead = true;
  }
  draw(g, ox, oy) {
    const f = this.onGround ? S.dfrog[0] : S.dfrog[1];
    this.drawSprite(g, this.facing >= 0 ? f.r : f.l, ox, oy);
  }
}

// A howler that swings on a vine in a pendulum arc and lobs fruit downward.
export class Howler extends Enemy {
  constructor(x, y) {
    super(x + 2, y + 4, 12, 9);
    this.pivotX = this.x;
    this.pivotY = this.y - TILE;      // vine anchor above
    this.radius = TILE * 2.2;
    this.t = Math.random() * Math.PI * 2;
    this.timer = 80 + Math.random() * 60;
    this.deathColors = ['#8a5a2b', '#e0b088'];
  }
  update(ctx) {
    this.animTime++;
    this.t += 0.03;
    const swing = Math.sin(this.t) * 0.9; // pendulum angle
    this.x = this.pivotX + Math.sin(swing) * this.radius;
    this.y = this.pivotY + Math.cos(swing) * this.radius;
    this.facing = Math.cos(this.t) >= 0 ? 1 : -1;
    const p = ctx.player;
    if (--this.timer <= 0) {
      this.timer = 150;
      if (Math.abs(p.cx - this.cx) < 130 && p.cy > this.cy) {
        ctx.play.addEntity(new HazardShot(this.cx, this.y + this.h,
          Math.sign(p.cx - this.cx) * 0.6, 0.4,
          { gravity: 0.16, sprite: 'dart', life: 260 }));
        sfx.shoot();
      }
    }
  }
  draw(g, ox, oy) {
    // draw the vine tether
    g.strokeStyle = '#2f8a44';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(Math.round(this.pivotX + this.w / 2 - ox), Math.round(this.pivotY - oy));
    g.lineTo(Math.round(this.cx - ox), Math.round(this.y - oy));
    g.stroke();
    const f = S.howler[((this.animTime / 8) | 0) % 2];
    this.drawSprite(g, this.facing >= 0 ? f.r : f.l, ox, oy);
  }
}

// A carved serpent idol embedded in the ruins: fires aimed venom darts.
export class IdolTurret extends Enemy {
  constructor(x, y) {
    super(x + 2, y + 2, 12, 14);
    this.stompable = false;
    this.solidPlatform = true; // carved stone — the player can stand on top of it
    this.timer = 70 + Math.random() * 70;
    this.flash = 0;
    this.deathColors = ['#8a9a6a', '#1fb8a6'];
  }
  update(ctx) {
    this.animTime++;
    if (this.flash > 0) this.flash--;
    const p = ctx.player;
    if (--this.timer <= 0) {
      this.timer = 150;
      const dx = p.cx - this.cx, dy = p.cy - this.cy;
      if (Math.hypot(dx, dy) < 170) {
        const d = Math.hypot(dx, dy) || 1;
        this.facing = Math.sign(dx) || 1;
        this.flash = 20;
        ctx.play.addEntity(new HazardShot(this.cx - 2, this.cy - 2,
          (dx / d) * 1.9, (dy / d) * 1.9,
          { sprite: 'dart', life: 280 }));
        sfx.shoot();
      }
    }
  }
  draw(g, ox, oy) {
    this.drawSprite(g, S.idol, ox, oy);
    if (this.flash > 0 && (this.flash / 3 | 0) % 2) {
      g.fillStyle = '#b6e05a';
      g.fillRect(Math.round(this.cx - 2 - ox), Math.round(this.cy - 3 - oy), 4, 4);
    }
  }
}

// --- World 7: Sunken Depths (all gravity-free swimmers) ---------------------

// Sine-swims back and forth; puffs up spiky when the player gets close, and
// can't be stomped while inflated.
export class Pufferfish extends Enemy {
  constructor(x, y) {
    super(x + 3, y + 5, 10, 6);
    this.baseY = this.y;
    this.t = Math.random() * Math.PI * 2;
    this.facing = -1;
    this.inflated = 0;
    this.deathColors = ['#e8a13c', '#f4d488'];
  }
  update(ctx) {
    this.animTime++;
    this.t += 0.04;
    const p = ctx.player;
    const near = Math.hypot(p.cx - this.cx, p.cy - this.cy) < 56;
    if (near && this.inflated === 0) { this.inflated = 90; sfx.bump(); }
    if (this.inflated > 0) {
      this.inflated--;
      this.stompable = false;
      this.x += 0.15 * this.facing;
    } else {
      this.stompable = true;
      this.x += 0.5 * this.facing;
    }
    this.y = this.baseY + Math.sin(this.t) * 10;
    // turn around at walls
    const tx = Math.floor((this.cx + this.facing * 10) / 16);
    if (ctx.level.tileAt(tx, Math.floor(this.cy / 16)) !== 0) this.facing *= -1;
  }
  draw(g, ox, oy) {
    this.drawFacing(g, this.inflated > 0 ? S.pufferBig : S.puffer, ox, oy);
  }
}

// Drifts slowly upward, wraps back to the bottom; stings on touch, shoot-only.
export class Jellyfish extends Enemy {
  constructor(x, y) {
    super(x + 3, y + 4, 10, 10);
    this.stompable = false;
    this.baseX = this.x;
    this.startY = this.y;
    this.t = Math.random() * Math.PI * 2;
    this.deathColors = ['#d48ae8', '#f4e0ff'];
  }
  update(ctx) {
    this.animTime++;
    this.t += 0.03;
    this.y -= 0.35;
    this.x = this.baseX + Math.sin(this.t) * 8;
    if (this.y < -16) this.y = Math.min(this.startY + 40, ctx.level.pxHeight - 24);
  }
  draw(g, ox, oy) { this.drawSprite(g, S.jelly[this.frame(10)], ox, oy); }
}

// Patrols a lane, then telegraphs and lunges at the player. Stompable.
export class Snapperfish extends Enemy {
  constructor(x, y) {
    super(x + 2, y + 5, 12, 7);
    this.baseX = this.x;
    this.state = 'patrol';
    this.timer = 0;
    this.cooldown = 0;
    this.facing = 1;
    this.deathColors = ['#4a9ad4', '#e8ecf4'];
  }
  update(ctx) {
    this.animTime++;
    const p = ctx.player;
    if (this.cooldown > 0) this.cooldown--;
    if (this.state === 'patrol') {
      this.x += 0.6 * this.facing;
      if (this.x > this.baseX + 44 || this.x < this.baseX - 44) this.facing *= -1;
      if (this.cooldown === 0 && Math.abs(p.cx - this.cx) < 110 && Math.abs(p.cy - this.cy) < 60) {
        this.state = 'aim';
        this.timer = 24;
        const d = Math.hypot(p.cx - this.cx, p.cy - this.cy) || 1;
        this.lungeVx = ((p.cx - this.cx) / d) * 2.6;
        this.lungeVy = ((p.cy - this.cy) / d) * 2.6;
        this.facing = Math.sign(p.cx - this.cx) || 1;
      }
    } else if (this.state === 'aim') {
      if (--this.timer <= 0) { this.state = 'lunge'; this.timer = 34; sfx.zap(); }
    } else {
      this.x += this.lungeVx;
      this.y += this.lungeVy;
      // stop at walls
      if (ctx.level.tileAt(Math.floor(this.cx / 16), Math.floor(this.cy / 16)) !== 0) this.timer = 0;
      if (--this.timer <= 0) { this.state = 'patrol'; this.cooldown = 100; this.baseX = this.x; }
    }
  }
  draw(g, ox, oy) {
    if (this.state === 'aim' && (this.timer / 3 | 0) % 2) {
      g.fillStyle = 'rgba(255,80,80,0.45)';
      g.fillRect(Math.round(this.x - 2 - ox), Math.round(this.y - 2 - oy), this.w + 4, this.h + 4);
    }
    this.drawFacing(g, S.snapper, ox, oy);
  }
}

// Static spiked mine anchored to the reef: shoot-only.
export class Urchin extends Enemy {
  constructor(x, y) {
    super(x + 3, y + 5, 10, 10);
    this.stompable = false;
    this.t = Math.random() * Math.PI * 2;
    this.deathColors = ['#3a2c50', '#d44a6a'];
  }
  update() {
    this.animTime++;
    this.t += 0.05;
  }
  draw(g, ox, oy) {
    const pulse = Math.sin(this.t) > 0.6 ? 1 : 0;
    this.drawSprite(g, S.urchin, ox, oy - pulse);
  }
}

export const ENEMY_FACTORY = {
  b: Shellsnail, h: Bumblebore, n: Snapdragon,
  a: Bat, s: Stalactite, k: Crawler,
  p: Puff, t: CloudTurret,
  d: Drone, f: FirewallTurret, g: GlitchMine,
  i: FireImp, l: LavaBubble,
  e: DartFrog, w: Howler, j: IdolTurret,
  q: Pufferfish, y: Jellyfish, z: Snapperfish, u: Urchin,
};
