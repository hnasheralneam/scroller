import {
  GRAVITY_UP, GRAVITY_DOWN, MAX_FALL, RUN_ACCEL, RUN_DECEL, SKID_DECEL, AIR_ACCEL, MAX_RUN,
  JUMP_VEL, DOUBLE_JUMP_VEL, COYOTE_FRAMES, JUMP_BUFFER_FRAMES,
  GLITCH_DURATION, INVULN_FRAMES,
  WATER_GRAVITY, WATER_MAX_SINK, WATER_MAX_RISE, SWIM_VEL, WATER_RUN_MULT,
  WATER_ACCEL, WATER_DIVE_MAX,
} from './constants.js';
import { input } from './input.js';
import { moveAndCollide } from './physics.js';
import { S } from './sprites.js';
import { PlayerShot, Particle } from './entities.js';
import { sfx } from './audio.js';

const SMALL_H = 14;
const BIG_H = 26;

export class Player {
  constructor(x, y, power = 'small') {
    this.w = 10;
    this.h = power === 'small' ? SMALL_H : BIG_H;
    this.x = x + 3;
    this.y = y + 16 - this.h;
    this.vx = 0; this.vy = 0;
    this.power = power;
    this.facing = 1;
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumps = 0;
    this.glitchTimer = 0;
    this.invuln = 0;
    this.stompGraceEntity = null;
    this.stompGraceTimer = 0;
    this.shootCooldown = 0;
    this.dying = false;
    this.deathTimer = 0;
    this.animTime = 0;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  setPower(power) {
    const feet = this.y + this.h;
    this.power = power;
    this.h = power === 'small' ? SMALL_H : BIG_H;
    this.y = feet - this.h;
  }

  update(ctx) {
    const { level, play } = ctx;

    if (this.dying) {
      this.deathTimer++;
      this.vy = Math.min(this.vy + GRAVITY_DOWN * 0.6, MAX_FALL);
      this.y += this.vy;
      if (this.deathTimer > 90) play.playerDied();
      return;
    }

    const water = !!level.meta.water;

    // --- horizontal input ---
    const left = input.isHeld('left'), right = input.isHeld('right');
    const dir = right && !left ? 1 : left && !right ? -1 : 0;
    const maxRun = water ? MAX_RUN * WATER_RUN_MULT : MAX_RUN;
    if (dir !== 0) {
      const skidding = this.onGround && dir * this.vx < -1;
      let accel = (this.onGround ? RUN_ACCEL : AIR_ACCEL) + (skidding ? SKID_DECEL : 0);
      if (water) accel *= WATER_RUN_MULT;
      this.vx = Math.max(-maxRun, Math.min(maxRun, this.vx + dir * accel));
      this.facing = dir;
      if (skidding && level.time % 3 === 0) {
        play.addEntity(new Particle(this.x + (dir > 0 ? 0 : this.w), this.y + this.h - 2,
          -dir * (0.5 + Math.random()), -0.8 - Math.random(), '#cfd6e0', 16, 2, 0.1));
      }
    } else if (this.onGround) {
      if (this.vx > 0) this.vx = Math.max(0, this.vx - RUN_DECEL);
      else this.vx = Math.min(0, this.vx + RUN_DECEL);
    }

    // wind (sky levels)
    if (level.meta.wind && !this.onGround) {
      this.vx += Math.sin(level.time * 0.013) * level.meta.wind;
    }
    // boss gust attacks push hard; brace by moving against it
    if (play.gustForce) this.vx += play.gustForce * (this.onGround ? 0.5 : 1);

    // --- jumping ---
    if (this.onGround) { this.coyote = COYOTE_FRAMES; this.jumps = 0; }
    else if (this.coyote > 0) this.coyote--;

    if (input.justPressed('jump')) this.jumpBuffer = JUMP_BUFFER_FRAMES;
    else if (this.jumpBuffer > 0) this.jumpBuffer--;

    if (water) {
      // swim stroke: always available, no coyote/double-jump bookkeeping
      if (this.jumpBuffer > 0) {
        this.vy = SWIM_VEL;
        this.jumpBuffer = 0;
        this.coyote = 0;
        sfx.swim();
        for (let i = 0; i < 4; i++) {
          play.addEntity(new Particle(this.cx + (Math.random() - 0.5) * 6, this.y + this.h,
            (Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 0.6, '#bfe6ff', 24, 2, -0.05));
        }
      }
      // ambient bubbles while moving
      if (level.time % 26 === 0 && (Math.abs(this.vx) > 0.3 || Math.abs(this.vy) > 0.3)) {
        play.addEntity(new Particle(this.cx, this.y + 2,
          (Math.random() - 0.5) * 0.3, -0.4, '#dff4ff', 30, 1, -0.02));
      }
      // hold down to actively swim downward — a faster accel and a higher
      // terminal cap than the slow buoyant passive sink.
      const diving = input.isHeld('down');
      this.vy = Math.min(this.vy + (diving ? WATER_ACCEL : WATER_GRAVITY),
                         diving ? WATER_DIVE_MAX : WATER_MAX_SINK);
      if (this.vy < WATER_MAX_RISE) this.vy = WATER_MAX_RISE;
      moveAndCollide(this, level, { dropThrough: input.isHeld('down') && input.justPressed('jump') });
    } else {
    if (this.jumpBuffer > 0) {
      if (this.onGround || this.coyote > 0) {
        this.vy = JUMP_VEL;
        this.jumps = 1;
        this.coyote = 0;
        this.jumpBuffer = 0;
        sfx.jump();
      } else if (this.jumps < 2 && input.justPressed('jump')) {
        this.vy = DOUBLE_JUMP_VEL;
        this.jumps = 2;
        this.jumpBuffer = 0;
        sfx.doubleJump();
        for (let i = 0; i < 6; i++) {
          play.addEntity(new Particle(this.cx, this.y + this.h,
            (Math.random() - 0.5) * 2, 0.5 + Math.random(), '#dfe8f4', 18, 2, 0.02));
        }
      }
    }
    // Variable jump height is handled entirely by the gravity switch below:
    // releasing jump swaps GRAVITY_UP (0.40) for GRAVITY_DOWN (0.85) mid-rise,
    // which cuts the hop to ~1.8 tiles against a ~3.5 tile full jump — a 1:2
    // ratio, right where a platformer wants to be.
    //
    // There used to be a hard velocity clamp here as well (`if (!held && vy <
    // -2.0) vy = -2.0`), a second, redundant mechanism fighting the first. It
    // took the min hop down to 0.5 tiles (a 1:7 ratio — jumps read as binary,
    // with no usable short hop), and because it ran on the frame *after* an
    // impulse was applied it also silently destroyed STOMP_BOUNCE: the tuned
    // -6.5 (~1.56 tiles, per constants.js) was clamped to -2.0 and bounced
    // 1.4px. Deleting the clamp restores both. See test/mechanics.js.

    // --- gravity & tile collision (light going up, heavy coming down) ---
    const grav = this.vy < 0 && input.isHeld('jump') ? GRAVITY_UP : GRAVITY_DOWN;
    this.vy = Math.min(this.vy + grav, MAX_FALL);
    moveAndCollide(this, level, { dropThrough: input.isHeld('down') && input.justPressed('jump') });
    }

    // head bump on blocks
    if (this.headBumpTile) play.bumpBlock(this.headBumpTile.tx, this.headBumpTile.ty);

    // --- ride solid platform entities ---
    for (const p of play.platforms) {
      if (p.dead || !p.solidPlatform) continue;
      const overX = this.x + this.w > p.x + 2 && this.x < p.x + p.w - 2;
      const feet = this.y + this.h;
      if (overX && this.vy >= (p.dy || 0) - 0.01 && feet >= p.y - 1 && feet <= p.y + 9) {
        this.y = p.y - this.h;
        this.vy = 0;
        this.onGround = true;
        this.jumps = 0;
        this.x += p.dx || 0;
        if (p.trigger) p.trigger();
      }
    }

    // --- shooting ---
    if (this.shootCooldown > 0) this.shootCooldown--;
    if (this.power === 'fire' && input.justPressed('shoot') && this.shootCooldown === 0) {
      const alive = play.entities.filter(e => e.isShot && !e.dead).length;
      if (alive < 2) {
        play.addEntity(new PlayerShot(this.cx + this.facing * 6, this.y + 6, this.facing));
        this.shootCooldown = 14;
        sfx.shoot();
      }
    }

    // --- timers ---
    if (this.invuln > 0) this.invuln--;
    if (this.stompGraceTimer > 0) {
      this.stompGraceTimer--;
      if (this.stompGraceTimer === 0) this.stompGraceEntity = null;
    }
    if (this.glitchTimer > 0) {
      this.glitchTimer--;
      if (this.glitchTimer === 0) sfx.glitchEnd();
    }

    // --- hazards & falling out ---
    const hazard = level.hazardAt(this);
    if (hazard === 'lava') play.killPlayer();
    else if (hazard === 'spike' && this.glitchTimer <= 0) play.hurtPlayer();
    if (this.y > level.pxHeight + 24) play.killPlayer();

    this.animTime += Math.abs(this.vx) > 0.3 ? 1 : 0;
  }

  startDeath() {
    this.dying = true;
    this.deathTimer = 0;
    this.vx = 0;
    this.vy = -5.2;
    sfx.die();
  }

  spriteSet() {
    if (this.glitchTimer > 0) {
      const variants = this.power === 'small' ? S.glitchSmall : S.glitchBig;
      // in the last 3 seconds, flicker back to normal as a warning
      if (this.glitchTimer < 180 && (this.glitchTimer / 8 | 0) % 2 === 0) {
        return this.power === 'small' ? S.playerSmall : this.power === 'fire' ? S.playerFire : S.playerBig;
      }
      return variants[((performance.now() / 70) | 0) % variants.length];
    }
    if (this.power === 'small') return S.playerSmall;
    if (this.power === 'fire') return S.playerFire;
    return S.playerBig;
  }

  draw(g, ox, oy, gameTime) {
    if (this.invuln > 0 && this.glitchTimer <= 0 && (this.invuln / 3 | 0) % 2 === 0 && !this.dying) return;
    const set = this.spriteSet();
    let spr;
    if (this.dying) spr = set.jump;
    else if (!this.onGround) spr = set.jump;
    else if (Math.abs(this.vx) > 0.3) spr = set.run[((this.animTime / 7) | 0) % 2];
    else spr = set.idle;
    const img = this.facing >= 0 ? spr.r : spr.l;
    const dx = Math.round(this.x + this.w / 2 - img.width / 2 - ox);
    const dy = Math.round(this.y + this.h - img.height - oy);
    if (this.dying) {
      // tumble as we fall
      g.save();
      g.translate(dx + img.width / 2, dy + img.height / 2);
      g.rotate(this.deathTimer * 0.15);
      g.drawImage(img, -img.width / 2, -img.height / 2);
      g.restore();
    } else {
      g.drawImage(img, dx, dy);
    }
    // glitch mode: ghost trail
    if (this.glitchTimer > 0 && !this.dying) {
      g.globalAlpha = 0.3;
      g.drawImage(img, dx - this.facing * 4, dy);
      g.globalAlpha = 1;
    }
  }
}
