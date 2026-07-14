import {
  GRAVITY_UP, GRAVITY_DOWN, MAX_FALL, RUN_ACCEL, RUN_DECEL, SKID_DECEL, AIR_ACCEL, MAX_RUN,
  JUMP_VEL, DOUBLE_JUMP_VEL, COYOTE_FRAMES, JUMP_BUFFER_FRAMES,
  GLITCH_DURATION, INVULN_FRAMES,
  WATER_GRAVITY, WATER_MAX_SINK, WATER_MAX_RISE, SWIM_VEL, WATER_RUN_MULT,
  WATER_ACCEL, WATER_DIVE_MAX,
  TILE, SOLID_TILES, T_PLATFORM,
} from './constants.js';
import { input } from './input.js';
import { moveAndCollide, stepPlayerGravity, overlapsSolid } from './physics.js';
import { S } from './sprites.js';
import { PlayerShot, Particle } from './entities.js';
import { sfx } from './audio.js';

const SMALL_H = 14;
const BIG_H = 26;
// Ceiling on wind/gust push, and how fast it bleeds away once the force stops.
const MAX_EXTERNAL = 3.0;
const EXTERNAL_DECAY = 0.88;

export class Player {
  constructor(x, y, power = 'small') {
    this.w = 10;
    this.h = power === 'small' ? SMALL_H : BIG_H;
    this.x = x + 3;
    this.y = y + 16 - this.h;
    this.vx = 0; this.vy = 0;
    this.extVx = 0; // wind / gust push, integrated apart from vx
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
    this.squashTimer = 0;
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
    // Captured before any collision zeroes vy, so landing feedback can scale
    // with how hard the player actually hit. Ground state is sampled here too:
    // moveAndCollide's own justLanded misses landings onto moving platforms,
    // which are resolved further down in the ride loop.
    const wasOnGround = this.onGround;
    const impactVy = this.vy;
    const prevFeet = this.y + this.h; // feet before this frame's movement

    if (this.squashTimer > 0) this.squashTimer--;

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

    // --- external horizontal forces (wind, boss gusts) ---
    //
    // These are integrated separately from the player's own run velocity and
    // recombined at move time. Adding them straight onto vx (as this used to)
    // was wrong twice over:
    //
    //   * The MAX_RUN clamp above runs first, so holding *any* direction
    //     re-clamped vx to +-2.5 and wiped the accumulated push. Bracing
    //     against a gust worked exactly as well as leaning into it, which is
    //     the opposite of what the comment here promised.
    //   * With no direction held there is no air friction, so nothing bounded
    //     them: wind integrates its sine to a standing offset of up to
    //     2*wind/0.013 ~ 12px/frame, well past MAX_RUN itself.
    //
    // Kept separate, a brace genuinely subtracts from the push, and the sum
    // stays bounded.
    let force = 0;
    if (level.meta.wind && !this.onGround) {
      force += Math.sin(level.time * 0.013) * level.meta.wind;
    }
    if (play.gustForce) force += play.gustForce * (this.onGround ? 0.5 : 1);
    if (force !== 0) {
      this.extVx = Math.max(-MAX_EXTERNAL, Math.min(MAX_EXTERNAL, this.extVx + force));
    } else {
      this.extVx *= EXTERNAL_DECAY; // bleed off once the wind or gust stops
      if (Math.abs(this.extVx) < 0.02) this.extVx = 0;
    }

    // --- jumping ---
    if (this.onGround) { this.coyote = COYOTE_FRAMES; this.jumps = 0; }
    else if (this.coyote > 0) this.coyote--;

    if (input.justPressed('jump')) this.jumpBuffer = JUMP_BUFFER_FRAMES;
    else if (this.jumpBuffer > 0) this.jumpBuffer--;

    // Down+Jump drops through a one-way platform. This has to be decided
    // *before* the jump fires. The old code passed
    // `dropThrough: isHeld('down') && justPressed('jump')` down to
    // moveAndCollide, but that same justPressed had already triggered the jump
    // a few lines earlier, so vy was negative by then — and moveAndCollide only
    // consults dropThrough while vy > 0. The flag was never once observed, and
    // Down+Jump on a platform simply jumped.
    const dropping = !water && this.jumpBuffer > 0 && input.isHeld('down') &&
                     this.onGround && this.standingOnOneWay(level);
    if (dropping) {
      this.jumpBuffer = 0;
      this.coyote = 0; // no coyote-jumping back up off a platform just left
    }

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
      this.moveWithExternal(level, { dropThrough: input.isHeld('down') });
    } else {
    if (this.jumpBuffer > 0 && !dropping) {
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
    this.vy = stepPlayerGravity(this.vy, input.isHeld('jump'));
    this.moveWithExternal(level, { dropThrough: dropping });
    }

    // head bump on blocks
    if (this.headBumpTile) play.bumpBlock(this.headBumpTile.tx, this.headBumpTile.ty);

    // --- ride solid platform entities ---
    for (const p of play.platforms) {
      if (p.dead || !p.solidPlatform) continue;
      const overX = this.x + this.w > p.x + 2 && this.x < p.x + p.w - 2;
      const feet = this.y + this.h;
      // Landing on a platform requires having been above it last frame. The
      // only gate here used to be "not rising", which is true at the apex of a
      // jump too — so jumping up through a platform from underneath, if the
      // apex happened to fall inside the 10px band, yanked the player up onto
      // it. Compare against the platform's *previous* top, since it moves too.
      const prevTop = p.y - (p.dy || 0);
      const wasAbove = prevFeet <= prevTop + 1;
      if (overX && wasAbove && this.vy >= (p.dy || 0) - 0.01 &&
          feet >= p.y - 1 && feet <= p.y + 9) {
        this.y = p.y - this.h;
        this.vy = 0;
        this.onGround = true;
        this.jumps = 0;
        // Carry the rider, but not through a wall: this was an unchecked
        // `this.x += p.dx`, so a horizontal platform would shove the player
        // clean into solid tiles.
        const carry = p.dx || 0;
        if (carry) {
          const oldX = this.x;
          this.x += carry;
          if (overlapsSolid(this, level)) this.x = oldX;
        }
        if (p.trigger) p.trigger();
      }
    }

    // --- landing ---
    if (!wasOnGround && this.onGround && !water) this.land(play, impactVy);

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

  // Is the player standing on a one-way platform (and not also on something
  // solid, which would win)?
  standingOnOneWay(level) {
    const ty = Math.floor((this.y + this.h + 1) / TILE);
    const tx0 = Math.floor((this.x + 1) / TILE);
    const tx1 = Math.floor((this.x + this.w - 1) / TILE);
    let found = false;
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = level.tileAt(tx, ty);
      if (SOLID_TILES.has(t)) return false;
      if (t === T_PLATFORM) found = true;
    }
    return found;
  }

  // Move with wind/gust folded in, then split it back out.
  //
  // `vx` holds only the player's own run velocity, so next frame's accel,
  // friction and skid logic all reason about what the player is doing rather
  // than about whatever the weather added.
  moveWithExternal(level, opts) {
    const inputVx = this.vx;
    this.vx = inputVx + this.extVx;
    moveAndCollide(this, level, opts);
    if (this.hitWall) {
      // Braced against a wall: kill the push rather than let it keep building
      // against geometry that isn't going to move.
      this.vx = 0;
      this.extVx = 0;
    } else {
      this.vx = inputVx;
    }
  }

  // Touchdown feedback, scaled by impact speed. physics.js computed a
  // justLanded flag for this from the start and nothing ever read it, so
  // landing had no dust, no squash, no sound — the fall just stopped.
  land(play, impactVy) {
    const MIN_IMPACT = 2.6; // below this it's a step down, not a landing
    if (impactVy < MIN_IMPACT) return;
    const power = Math.min(1, (impactVy - MIN_IMPACT) / (MAX_FALL - MIN_IMPACT));

    this.squashTimer = 3 + Math.round(power * 4);
    sfx.land(power);

    const n = 2 + Math.round(power * 4);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1; // kick dust out from both feet
      play.addEntity(new Particle(
        this.cx + side * (1 + Math.random() * this.w * 0.5), this.y + this.h - 1,
        side * (0.3 + Math.random() * (0.5 + power)), -0.2 - Math.random() * 0.7,
        '#cfd6e0', 12 + Math.random() * 12, 2, 0.1));
    }
    if (power > 0.75) play.camera.shake(3, 1.1);
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
    } else if (this.squashTimer > 0) {
      // Landing squash. Whole-pixel only: the sprites are pixel art and a
      // fractional scale would resample them into mush. 2px down / 2px out for
      // the first half of the timer, 1px for the second, so it eases out.
      const k = this.squashTimer > 3 ? 2 : 1;
      g.drawImage(img, dx - k, dy + k * 2, img.width + k * 2, img.height - k * 2);
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
