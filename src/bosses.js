import { TILE, GRAVITY, MAX_FALL, SOLID_TILES } from './constants.js';
import { S } from './sprites.js';
import { moveAndCollide, groundAhead } from './physics.js';
import {
  HazardShot, Shockwave, LightningColumn, LaserBeam, EruptColumn, FireTrail, Particle, burst,
} from './entities.js';
import { Enemy, Drone, GlitchMine } from './enemies.js';
import { sfx } from './audio.js';

export class Boss extends Enemy {
  constructor(x, y, w, h, hp, name) {
    super(x, y, w, h);
    this.isBoss = true;
    this.hp = hp;
    this.maxHp = hp;
    this.name = name;
    this.hitInvuln = 0;
    this.dying = false;
    this.dieTimer = 0;
    this.state = 'intro';
    this.timer = 60;
    this.attackNo = 0;
    // Multi-phase support: thresholds are hp values; crossing one advances
    // the phase (with a roar + flash) and calls onPhaseChange.
    this.phase = 1;
    this.phaseThresholds = [];
    this.phaseFlash = 0;
    this.auraColor = 'rgba(255,255,255,0.22)';
  }

  takeHit(ctx) {
    if (this.hitInvuln > 0 || this.dying) return false;
    this.hp--;
    this.hitInvuln = 70;
    sfx.bossHit();
    burst(ctx.play, this.cx, this.cy, ['#fff', '#ffe14a'], 8, 2.4, 26);
    if (this.hp <= 0) {
      this.dying = true;
      this.dieTimer = 110;
      this.harmful = false;
      this.stompable = false;
      this.shootable = false;
      ctx.play.gustForce = 0;
      sfx.bossDie();
    } else {
      const next = this.phaseThresholds[this.phase - 1];
      if (next !== undefined && this.hp <= next) {
        this.phase++;
        this.phaseFlash = 45;
        sfx.roar();
        ctx.play.camera.shake(20, 3);
        burst(ctx.play, this.cx, this.cy, this.deathColors || ['#fff'], 20, 3, 40);
        this.onPhaseChange(ctx);
      }
    }
    return true;
  }

  onPhaseChange(ctx) {} // per-boss hook

  // Pulsing aura for phase 2+ (and a white flash right after a phase shift).
  drawAura(g, ox, oy) {
    if (this.phase <= 1 && this.phaseFlash <= 0) return;
    // smooth breathing glow — a sine-driven alpha pulse rather than a hard
    // on/off toggle (the old toggle read as a color-flicker glitch).
    const pulse = 0.55 + 0.45 * Math.sin(this.animTime * 0.12);
    g.globalAlpha = this.phaseFlash > 0 ? 1 : pulse;
    g.fillStyle = this.phaseFlash > 0 ? 'rgba(255,255,255,0.5)' : this.auraColor;
    // Round the sprite origin once and offset by a constant so the aura edge is
    // locked a fixed 3px outside the identically-rounded sprite (independent
    // rounding of x-ox vs. the sprite made the border shimmer by a pixel).
    const rx = Math.round(this.x - ox), ry = Math.round(this.y - oy);
    g.fillRect(rx - 3, ry - 3, this.w + 6, this.h + 6);
    g.globalAlpha = 1;
  }

  squash(ctx) { this.takeHit(ctx); }
  shot(ctx) { this.takeHit(ctx); }

  updateDying(ctx) {
    this.dieTimer--;
    if (this.dieTimer % 12 === 0) {
      burst(ctx.play, this.x + Math.random() * this.w, this.y + Math.random() * this.h,
        ['#ff8c1a', '#ffe14a', '#fff'], 8, 2.4, 30);
      sfx.explode();
      ctx.play.camera.shake(8, 2);
    }
    if (this.dieTimer <= 0) {
      this.dead = true;
      burst(ctx.play, this.cx, this.cy, ['#fff', '#ffe14a', '#ff8c1a'], 24, 3.4, 50);
      ctx.play.bossDefeated();
    }
  }

  tick() {
    this.animTime++;
    if (this.hitInvuln > 0) this.hitInvuln--;
    if (this.phaseFlash > 0) this.phaseFlash--;
  }

  skipDraw() {
    return (this.hitInvuln > 0 && (this.hitInvuln / 3 | 0) % 2 === 0) ||
           (this.dying && (this.dieTimer / 4 | 0) % 2 === 0);
  }
}

// Mini-toad spat out by the Toad King. One stomp, hops toward the player.
export class Toadlet extends Enemy {
  constructor(x, y, vx) {
    super(x, y, 10, 7);
    this.isToadlet = true;
    this.vx = vx;
    this.vy = -4;
    this.timer = 50;
    this.deathColors = ['#4ea83e', '#c0392b'];
  }
  update(ctx) {
    this.animTime++;
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    if (this.onGround) {
      this.vx = 0;
      if (--this.timer <= 0) {
        this.timer = 55;
        this.facing = Math.sign(ctx.player.cx - this.cx) || 1;
        if (groundAhead(this, ctx.level, this.facing)) {
          this.vy = -3.6;
          this.vx = 1.0 * this.facing;
        }
      }
    }
    moveAndCollide(this, ctx.level);
    if (this.y > ctx.level.pxHeight + 20) this.dead = true;
  }
  draw(g, ox, oy) {
    const f = this.onGround ? S.toadlet[0] : S.toadlet[1];
    this.drawSprite(g, this.facing >= 0 ? f.r : f.l, ox, oy);
  }
}

// ---------------------------------------------------------------------------
// World 1 boss: Toad King — leaps, tongue lash, spits toadlets, enrages.
// ---------------------------------------------------------------------------
export class ToadKing extends Boss {
  constructor(x, y) {
    super(x, y - 14, 28, 28, 4, 'TOAD KING');
    this.deathColors = ['#4ea83e', '#ffd23e'];
    this.phaseThresholds = [2];
    this.auraColor = 'rgba(78,168,62,0.3)';
    this.chained = 0;
  }
  update(ctx) {
    this.tick();
    if (this.dying) return this.updateDying(ctx);
    const p = ctx.player;
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    const enraged = this.phase >= 2;

    if (this.state === 'intro' || this.state === 'idle') {
      this.state = 'idle';
      this.vx = 0;
      this.facing = Math.sign(p.cx - this.cx) || 1;
      if (--this.timer <= 0) {
        this.attackNo++;
        const toadlets = ctx.play.entities.filter(e => e.isToadlet && !e.dead).length;
        if ((enraged || this.hp <= 3) && toadlets === 0 && this.attackNo % 3 === 0) {
          this.state = 'spit';
          this.timer = 34;
          sfx.warn();
        } else if (this.attackNo % 2 === 0) {
          this.state = 'tongueWarn';
          this.timer = 30;
          sfx.warn();
        } else {
          this.leap(p, enraged);
        }
      }
    } else if (this.state === 'spit') {
      if (--this.timer <= 0) {
        for (const dir of [-1, 1]) {
          ctx.play.addEntity(new Toadlet(this.cx - 5, this.y + 4, dir * 1.6));
        }
        if (enraged) ctx.play.addEntity(new Toadlet(this.cx - 5, this.y + 2, (Math.sign(p.cx - this.cx) || 1) * 2.2));
        sfx.bounce();
        burst(ctx.play, this.cx, this.y + 8, ['#4ea83e'], 6, 1.6, 20);
        this.state = 'idle';
        this.timer = 60;
      }
    } else if (this.state === 'tongueWarn') {
      this.vx = 0;
      if (--this.timer <= 0) {
        // pink tongue lash at mouth height, toward the player
        const dir = this.facing;
        const len = TILE * 7;
        const tx = dir > 0 ? this.x + this.w - 4 : this.x + 4 - len;
        ctx.play.addEntity(new LaserBeam(tx, this.y + 10, len,
          { warn: 8, fire: 28, color: '#e0559a', thickness: 8 }));
        // enraged: a second lash guards its back
        if (enraged) {
          const bx = dir > 0 ? this.x + 4 - len : this.x + this.w - 4;
          ctx.play.addEntity(new LaserBeam(bx, this.y + 10, len,
            { warn: 22, fire: 28, color: '#e0559a', thickness: 8 }));
        }
        this.state = 'tongue';
        this.timer = 44;
      }
    } else if (this.state === 'tongue') {
      this.vx = 0;
      if (--this.timer <= 0) { this.state = 'idle'; this.timer = enraged ? 30 : 55; }
    }

    moveAndCollide(this, ctx.level);

    if (this.state === 'leap' && this.onGround) {
      ctx.play.camera.shake(14, 3);
      sfx.stomp();
      ctx.play.addEntity(new Shockwave(this.x - 6, this.y + this.h, -1));
      ctx.play.addEntity(new Shockwave(this.x + this.w - 4, this.y + this.h, 1));
      if (enraged && this.chained < (this.hp === 1 ? 2 : 1)) {
        this.chained++;           // enrage: chained follow-up hops
        this.leap(p, true);
      } else {
        this.chained = 0;
        this.state = 'idle';
        this.timer = enraged ? 28 : 55;
        this.vx = 0;
      }
    }
  }
  leap(p, enraged) {
    this.state = 'leap';
    this.vy = -5.4;
    this.vx = (Math.sign(p.cx - this.cx) || 1) * (enraged ? 2.1 : 1.5);
    sfx.bounce();
  }
  draw(g, ox, oy) {
    if (this.skipDraw()) return;
    this.drawAura(g, ox, oy);
    const spr = this.facing >= 0 ? S.toadking.r : S.toadking.l;
    // telegraphs: crouch shiver for spit, mouth flash for tongue
    const jx = (this.state === 'tongueWarn' || this.state === 'spit') && (this.animTime / 3 | 0) % 2 ? 1 : 0;
    this.drawSprite(g, spr, ox, oy, jx, 0);
    if (this.state === 'tongueWarn' && (this.animTime / 4 | 0) % 2) {
      g.fillStyle = '#e0559a';
      g.fillRect(Math.round(this.facing > 0 ? this.x + this.w - 6 - ox : this.x + 2 - ox),
        Math.round(this.y + 10 - oy), 4, 6);
    }
  }
}

// ---------------------------------------------------------------------------
// World 2 boss: Crystal Golem — volleys, slam, crystal wave, spin charge.
// Armored except when its core is exposed (after slam or a wall crash).
// ---------------------------------------------------------------------------
export class CrystalGolem extends Boss {
  constructor(x, y) {
    super(x, y - 14, 26, 28, 5, 'CRYSTAL GOLEM');
    this.stompable = false;
    this.shootable = false;
    this.exposed = 0;
    this.deathColors = ['#8a7fb8', '#4affd7'];
    this.phaseThresholds = [2];
    this.auraColor = 'rgba(74,255,215,0.28)';
  }
  expose(frames) {
    this.exposed = frames;
    this.stompable = true;
    this.shootable = true;
  }
  update(ctx) {
    this.tick();
    if (this.dying) return this.updateDying(ctx);
    const p = ctx.player;
    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);

    if (this.exposed > 0) {
      this.exposed--;
      this.vx = 0;
      if (this.exposed === 0) { this.stompable = false; this.shootable = false; }
      moveAndCollide(this, ctx.level);
      return;
    }

    if (this.state === 'intro' || this.state === 'walk') {
      this.state = 'walk';
      this.facing = Math.sign(p.cx - this.cx) || 1;
      this.vx = 0.4 * this.facing;
      // Hop over ledges / cover pillars when blocked so the golem can traverse
      // the whole arena instead of getting pinned against a step.
      if (this.hitWall && this.onGround) this.vy = -6.5;
      if (--this.timer <= 0) {
        this.attackNo++;
        const pick = this.attackNo % (this.phase >= 2 ? 5 : 4);
        if (pick === 4) {
          // phase 2: boulder toss — heavy shards lobbed to both sides while
          // tremor waves roll out along the floor
          this.state = 'boulder';
          this.timer = 46;
          this.vx = 0;
          for (const dir of [-1, 1]) {
            for (let i = 0; i < 2; i++) {
              ctx.play.addEntity(new HazardShot(this.cx, this.y + 2,
                dir * (0.8 + i * 0.9), -4.4 + i * 0.8, { gravity: 0.11, sprite: 'shard', life: 340 }));
            }
          }
          ctx.play.addEntity(new Shockwave(this.x - 6, this.y + this.h, -1));
          ctx.play.addEntity(new Shockwave(this.x + this.w - 4, this.y + this.h, 1));
          ctx.play.camera.shake(10, 2);
          sfx.explode();
        } else if (pick === 1) {
          // shard volley
          this.state = 'volley';
          this.timer = 40;
          this.vx = 0;
          const dir = this.facing;
          const count = this.phase >= 2 ? 5 : 3;
          for (let i = 0; i < count; i++) {
            ctx.play.addEntity(new HazardShot(this.cx, this.y + 4,
              dir * (1 + i * 0.5), -3 - i * 0.6, { gravity: 0.13, sprite: 'shard', life: 300 }));
          }
          sfx.shoot();
        } else if (pick === 2) {
          this.state = 'slamRise';
          this.vy = -6.2;
          this.vx = (Math.sign(p.cx - this.cx) || 1) * 1.2;
        } else if (pick === 3) {
          // crystal wave: eruptions march toward the player
          this.state = 'wave';
          this.timer = 40;
          this.vx = 0;
          const dir = Math.sign(p.cx - this.cx) || 1;
          const groundY = ctx.level.pxHeight - 3 * TILE;
          for (let i = 0; i < 6; i++) {
            const ex = this.cx + dir * (26 + i * 26);
            if (ex < 8 || ex > ctx.level.pxWidth - 8) break;
            ctx.play.addEntity(new EruptColumn(ex, groundY, 30,
              { warn: 26 + i * 9, active: 40, style: 'crystal' }));
          }
          sfx.breakBlock();
        } else {
          // spin charge across the arena
          this.state = 'spinWarn';
          this.timer = 32;
          this.vx = 0;
          sfx.warn();
        }
      }
    } else if (this.state === 'volley' || this.state === 'wave' || this.state === 'boulder') {
      this.vx = 0;
      if (--this.timer <= 0) { this.state = 'walk'; this.timer = this.phase >= 2 ? 85 : 110; }
    } else if (this.state === 'spinWarn') {
      this.vx = 0;
      if (--this.timer <= 0) {
        this.state = 'spin';
        this.facing = Math.sign(p.cx - this.cx) || 1;
        sfx.roar();
      }
    } else if (this.state === 'spin') {
      this.vx = (this.phase >= 2 ? 3.6 : 3.1) * this.facing;
    }

    moveAndCollide(this, ctx.level);

    if (this.state === 'spin' && this.hitWall) {
      // crashed into a wall — dizzy, core exposed
      this.state = 'walk';
      this.timer = 130;
      ctx.play.camera.shake(16, 3);
      sfx.explode();
      burst(ctx.play, this.cx + this.facing * 12, this.cy, ['#8a7fb8', '#fff'], 12, 2.6, 30);
      this.expose(120);
    }
    if (this.state === 'slamRise' && this.justLanded) {
      this.state = 'walk';
      this.timer = 130;
      this.vx = 0;
      ctx.play.camera.shake(16, 3);
      sfx.explode();
      for (let i = 0; i < 3; i++) {
        const sx = p.cx + (Math.random() - 0.5) * 90;
        ctx.play.addEntity(new HazardShot(sx, ctx.play.camera.y - 8, 0, 1.5,
          { gravity: 0.12, sprite: 'shard', life: 300 }));
      }
      this.expose(140);
    }
  }
  draw(g, ox, oy) {
    if (this.skipDraw()) return;
    this.drawAura(g, ox, oy);
    const set = this.exposed > 0 ? S.golemOpen : S.golem;
    const jx = (this.state === 'spinWarn' && (this.animTime / 3 | 0) % 2) ? 1 : 0;
    const roll = this.state === 'spin' ? (this.animTime / 3 | 0) % 2 : 0;
    this.drawSprite(g, this.facing >= 0 ? set.r : set.l, ox, oy, jx, roll);
    if (this.exposed > 0 && (this.animTime / 6 | 0) % 2) {
      g.fillStyle = 'rgba(74,255,215,0.5)';
      g.fillRect(Math.round(this.x + 6 - ox), Math.round(this.y + 8 - oy), this.w - 12, 8);
    }
  }
}

// ---------------------------------------------------------------------------
// World 3 boss: Storm Bird — dives, lightning, feather fans, gusts.
// ---------------------------------------------------------------------------
export class StormBird extends Boss {
  constructor(x, y) {
    super(x, y, 28, 20, 6, 'STORM BIRD');
    this.stompable = false;
    this.hoverY = y - 60;
    this.boltTimer = 110;
    this.deathColors = ['#5a8ad0', '#ffd23e'];
    this.phaseThresholds = [3];
    this.auraColor = 'rgba(255,225,74,0.28)';
  }
  update(ctx) {
    this.tick();
    if (this.dying) return this.updateDying(ctx);
    const p = ctx.player;

    if (this.state === 'intro') { this.state = 'hover'; this.timer = 90; }

    if (this.state === 'hover') {
      const gx = p.cx - this.w / 2;
      this.x += Math.sign(gx - this.x) * Math.min(1.4, Math.abs(gx - this.x) * 0.04);
      this.y += (this.hoverY + Math.sin(this.animTime * 0.06) * 8 - this.y) * 0.08;
      this.facing = Math.sign(p.cx - this.cx) || 1;
      if (--this.boltTimer <= 0) {
        this.boltTimer = Math.max(90, 160 - (this.maxHp - this.hp) * 25);
        ctx.play.addEntity(new LightningColumn(p.cx - 6, ctx.level));
      }
      if (--this.timer <= 0) {
        this.attackNo++;
        const pick = this.attackNo % (this.phase >= 2 ? 5 : 4);
        if (pick === 4) { this.state = 'squall'; this.timer = 40; sfx.warn(); }
        else if (pick === 1 || pick === 3) this.startDive(p);
        else if (pick === 2) { this.state = 'feather'; this.timer = 34; sfx.warn(); }
        else { this.state = 'gust'; this.timer = 110; sfx.roar(); }
      }
    } else if (this.state === 'squall') {
      // phase 2: a full ring of feathers while the wind keeps pushing
      this.y += (this.hoverY - 8 - this.y) * 0.1;
      if (this.timer === 20) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.4;
          ctx.play.addEntity(new HazardShot(this.cx, this.cy,
            Math.cos(a) * 2.1, Math.sin(a) * 2.1, { sprite: 'feather', life: 240 }));
        }
        sfx.shoot();
      }
      if (--this.timer <= 0) { this.state = 'hover'; this.timer = 70; }
    } else if (this.state === 'feather') {
      this.facing = Math.sign(p.cx - this.cx) || 1;
      if (this.timer === 17) {
        // fan of feathers aimed at the player
        const base = Math.atan2(p.cy - this.cy, p.cx - this.cx);
        for (let i = -1.5; i <= 1.5; i++) {
          const a = base + i * 0.24;
          ctx.play.addEntity(new HazardShot(this.cx, this.cy,
            Math.cos(a) * 2.3, Math.sin(a) * 2.3, { sprite: 'feather', life: 240 }));
        }
        sfx.shoot();
      }
      if (--this.timer <= 0) { this.state = 'hover'; this.timer = 80; }
    } else if (this.state === 'gust') {
      // hover high, flap hard: pushes the player toward the arena edge
      const cxGoal = ctx.level.pxWidth / 2 - this.w / 2;
      this.x += (cxGoal - this.x) * 0.08;
      this.y += (this.hoverY - 14 - this.y) * 0.1;
      const dir = Math.sign(p.cx - this.cx) || 1;
      ctx.play.gustForce = dir * 0.13;
      if (this.animTime % 3 === 0) {
        ctx.play.addEntity(new Particle(
          this.cx - dir * 20, this.y + 10 + Math.random() * 30,
          dir * (2.5 + Math.random() * 2), (Math.random() - 0.5) * 0.6,
          'rgba(240,248,255,0.8)', 24, 1, 0));
      }
      if (--this.timer <= 0) {
        ctx.play.gustForce = 0;
        this.state = 'hover';
        this.timer = 90;
      }
    } else if (this.state === 'dive') {
      this.x += this.vx;
      this.y += this.vy;
      // crash when the tile under the beak is solid (works on any terrace)
      const tx = Math.floor(this.cx / TILE);
      const ty = Math.floor((this.y + this.h) / TILE);
      if (SOLID_TILES.has(ctx.level.tileAt(tx, ty)) || this.y + this.h >= ctx.level.pxHeight - 3 * TILE) {
        this.y = ty * TILE - this.h;
        this.state = 'stunned';
        this.timer = 120;
        this.stompable = true;
        this.harmful = false;
        ctx.play.camera.shake(12, 2);
        sfx.stomp();
        burst(ctx.play, this.cx, this.y + this.h, ['#dfe8f4', '#5a8ad0'], 8, 2, 24);
      }
      if (this.x < 0 || this.x + this.w > ctx.level.pxWidth) {
        this.state = 'hover';
        this.timer = 80;
      }
    } else if (this.state === 'stunned') {
      if (--this.timer <= 0) {
        this.state = 'hover';
        this.timer = 100;
        this.stompable = false;
        this.harmful = true;
      }
    }
  }
  startDive(p) {
    this.state = 'dive';
    const dx = p.cx - this.cx, dy = (p.y + p.h) - (this.y + this.h);
    const d = Math.hypot(dx, dy) || 1;
    this.vx = (dx / d) * 3.6;
    this.vy = (dy / d) * 3.6;
    sfx.roar();
  }
  squash(ctx) {
    if (this.takeHit(ctx)) {
      this.state = 'hover';
      this.timer = 90;
      this.stompable = false;
      this.harmful = true;
    }
  }
  draw(g, ox, oy) {
    if (this.skipDraw()) return;
    if (this.state === 'stunned') {
      const spr = this.facing >= 0 ? S.bird[1].r : S.bird[1].l;
      this.drawSprite(g, spr, ox, oy);
      g.fillStyle = '#ffe14a';
      const a = this.animTime * 0.15;
      g.fillRect(Math.round(this.cx + Math.cos(a) * 12 - ox), Math.round(this.y - 6 + Math.sin(a) * 3 - oy), 3, 3);
      g.fillRect(Math.round(this.cx + Math.cos(a + 3) * 12 - ox), Math.round(this.y - 6 + Math.sin(a + 3) * 3 - oy), 3, 3);
    } else {
      this.drawAura(g, ox, oy);
      const speed = this.state === 'gust' || this.state === 'squall' ? 4 : 8;
      const f = S.bird[(this.animTime / speed | 0) % 2];
      this.drawSprite(g, this.facing >= 0 ? f.r : f.l, ox, oy);
    }
  }
}

// ---------------------------------------------------------------------------
// World 4 boss: The Kernel — teleports; sweeping lasers, bit barrage,
// data mines, drones; vulnerable when it overheats.
// ---------------------------------------------------------------------------
export class Kernel extends Boss {
  constructor(x, y) {
    super(x, y, 28, 28, 7, 'THE KERNEL');
    this.stompable = false;
    this.shootable = false;
    this.homeY = y;
    this.deathColors = ['#39ff7a', '#101820'];
    this.phaseThresholds = [4];
    this.auraColor = 'rgba(57,255,122,0.3)';
  }
  teleport(ctx) {
    burst(ctx.play, this.cx, this.cy, ['#39ff7a', '#fff'], 12, 2.6, 24, 0.02);
    // Never reappear on top of the player: score every candidate spot by
    // distance from them and only pick among the ones that land clear.
    const p = ctx.player;
    const SAFE_DIST = 56;
    const spots = [];
    for (const fx of [0.18, 0.5, 0.82]) {
      for (const fy of [0.25, 0.42]) {
        const x = ctx.level.pxWidth * fx - this.w / 2;
        const y = ctx.level.pxHeight * fy;
        const dist = Math.hypot(x + this.w / 2 - p.cx, y + this.h / 2 - p.cy);
        spots.push({ x, y, dist });
      }
    }
    const safe = spots.filter(s => s.dist >= SAFE_DIST);
    const pool = safe.length ? safe : [spots.reduce((a, b) => (b.dist > a.dist ? b : a))];
    const chosen = pool[(Math.random() * pool.length) | 0];
    this.x = chosen.x;
    this.y = chosen.y;
    burst(ctx.play, this.cx, this.cy, ['#39ff7a', '#fff'], 12, 2.6, 24, 0.02);
    sfx.glitch();
  }
  update(ctx) {
    this.tick();
    if (this.dying) return this.updateDying(ctx);
    const p = ctx.player;

    if (this.state === 'intro') { this.state = 'float'; this.timer = 80; }

    if (this.state === 'float') {
      this.y += Math.sin(this.animTime * 0.05) * 0.3;
      if (--this.timer <= 0) {
        this.attackNo++;
        if (this.attackNo % 4 === 0) {
          this.state = 'overheat';
          this.timer = this.phase >= 2 ? 120 : 150;
          this.stompable = true;
          this.shootable = true;
          this.harmful = false;
          sfx.zap();
        } else if (this.phase >= 2 && this.attackNo % 4 === 2) {
          // phase 2: surge — rapid teleport chain, firing a spread each blink
          this.state = 'surge';
          this.timer = 90;
          sfx.warn();
        } else {
          this.teleport(ctx);
          const pick = this.attackNo % 3;
          if (pick === 1) {
            // static beam at the player's feet + a beam sweeping down from above
            ctx.play.addEntity(new LaserBeam(0, p.y + p.h - 8, ctx.level.pxWidth,
              { warn: 55, fire: 30 }));
            ctx.play.addEntity(new LaserBeam(0, ctx.play.camera.y + 26, ctx.level.pxWidth,
              { warn: 55, fire: 90, drift: 0.9 }));
            // phase 2: a third beam rises from the floor
            if (this.phase >= 2) {
              ctx.play.addEntity(new LaserBeam(0, ctx.level.pxHeight - 3 * TILE - 10, ctx.level.pxWidth,
                { warn: 75, fire: 90, drift: -0.9 }));
            }
          } else if (pick === 2) {
            // bit barrage: 5 aimed shots in a spread
            const base = Math.atan2(p.cy - this.cy, p.cx - this.cx);
            for (let i = -2; i <= 2; i++) {
              const a = base + i * 0.18;
              ctx.play.addEntity(new HazardShot(this.cx, this.cy,
                Math.cos(a) * 2.0, Math.sin(a) * 2.0, { sprite: 'bit', life: 260 }));
            }
            sfx.shoot();
          } else {
            // data mines materialize mid-air and self-detonate
            const drones = ctx.play.entities.filter(e => e instanceof Drone && !e.dead).length;
            if (drones < 2 && this.hp <= 3) {
              ctx.play.addEntity(new Drone(this.cx - 8, this.y + this.h));
            }
            for (let i = 0; i < 3; i++) {
              const mx = 30 + Math.random() * (ctx.level.pxWidth - 60);
              const my = 60 + Math.random() * 90;
              const mine = new GlitchMine(mx, my, 95);
              ctx.play.addEntity(mine);
              burst(ctx.play, mx + 8, my + 8, ['#39ff7a'], 6, 1.6, 18, 0);
            }
            sfx.glitch();
          }
          this.state = 'float';
          this.timer = Math.max(65, 115 - (this.maxHp - this.hp) * 12);
        }
      }
    } else if (this.state === 'surge') {
      this.timer--;
      if (this.timer % 30 === 0) {
        this.teleport(ctx);
        const base = Math.atan2(p.cy - this.cy, p.cx - this.cx);
        for (let i = -1; i <= 1; i++) {
          const a = base + i * 0.22;
          ctx.play.addEntity(new HazardShot(this.cx, this.cy,
            Math.cos(a) * 2.2, Math.sin(a) * 2.2, { sprite: 'bit', life: 220 }));
        }
        sfx.shoot();
      }
      if (this.timer <= 0) { this.state = 'float'; this.timer = 80; }
    } else if (this.state === 'overheat') {
      this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
      moveAndCollide(this, ctx.level);
      if (--this.timer <= 0) this.recover(ctx);
    }
  }
  recover(ctx) {
    this.state = 'float';
    this.timer = 90;
    this.stompable = false;
    this.shootable = false;
    this.harmful = true;
    this.vy = 0;
    this.y = this.homeY;
    this.teleport(ctx);
  }
  squash(ctx) {
    if (this.takeHit(ctx) && this.hp > 0) this.recover(ctx);
  }
  shot(ctx) { this.squash(ctx); }
  draw(g, ox, oy) {
    if (this.skipDraw()) return;
    this.drawAura(g, ox, oy);
    const spr = this.state === 'overheat' ? S.kernelHot : S.kernel;
    const jx = this.state === 'overheat' ? 0 : ((Math.random() * 2 - 1) * 1.2) | 0;
    this.drawSprite(g, spr, ox, oy, jx, 0);
  }
}

// ---------------------------------------------------------------------------
// World 5 boss: Flame King — spreads, lava waves, flame pillars, and a
// burning dash. Two phases.
// ---------------------------------------------------------------------------
export class FlameKing extends Boss {
  constructor(x, y) {
    super(x, y - 14, 28, 28, 8, 'FLAME KING');
    this.attackTimer = 100;
    this.emberTimer = 40;
    this.trailTimer = 0;
    this.phaseThresholds = [4];
    this.auraColor = 'rgba(255,140,26,0.25)';
    this.deathColors = ['#e33e1c', '#ffe14a'];
  }
  update(ctx) {
    this.tick();
    if (this.dying) return this.updateDying(ctx);
    const p = ctx.player;

    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);

    if (this.state === 'dashWarn') {
      this.vx = 0;
      if (--this.timer <= 0) {
        this.state = 'dash';
        this.timer = 75;
        this.facing = Math.sign(p.cx - this.cx) || 1;
        sfx.roar();
      }
    } else if (this.state === 'dash') {
      this.vx = 3.4 * this.facing;
      if (++this.trailTimer % 4 === 0 && this.onGround) {
        ctx.play.addEntity(new FireTrail(this.cx - 7, this.y + this.h, 190));
      }
      if (--this.timer <= 0 || this.hitWall) {
        this.state = 'walk';
        this.attackTimer = this.phase === 2 ? 70 : 110;
        this.vx = 0;
      }
    } else if (this.state === 'nova') {
      this.vx = 0;
      if (--this.timer <= 0) { this.state = 'walk'; this.attackTimer = 70; }
    } else {
      // default: stalk the player
      this.state = 'walk';
      const speed = this.phase === 2 ? 0.85 : 0.5;
      this.facing = Math.sign(p.cx - this.cx) || 1;
      this.vx = speed * this.facing;

      if (--this.attackTimer <= 0) {
        this.attackTimer = this.phase === 2 ? 75 : 120;
        this.attackNo++;
        const pick = this.attackNo % (this.phase >= 2 ? 5 : 4);
        if (pick === 4) {
          // phase 2: fire nova — a ring of fireballs bursting outward
          this.state = 'nova';
          this.timer = 40;
          this.vx = 0;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.play.addEntity(new HazardShot(this.cx, this.cy,
              Math.cos(a) * 1.9, Math.sin(a) * 1.9 - 0.6,
              { gravity: 0.05, sprite: 'fireball', life: 260 }));
          }
          ctx.play.camera.shake(10, 2);
          sfx.explode();
        } else if (pick === 1) {
          // 3-way fireball spread
          for (const [vx, vy] of [[1.8, -2.2], [1.2, -3.2], [0.5, -3.8]]) {
            ctx.play.addEntity(new HazardShot(this.cx, this.y + 6, vx * this.facing, vy,
              { gravity: 0.12, sprite: 'fireball', life: 320 }));
          }
          sfx.shoot();
        } else if (pick === 2) {
          // lava waves both directions
          ctx.play.addEntity(new Shockwave(this.x - 6, this.y + this.h, -1));
          ctx.play.addEntity(new Shockwave(this.x + this.w - 4, this.y + this.h, 1));
          ctx.play.camera.shake(10, 2);
          sfx.stomp();
        } else if (pick === 3) {
          // flame pillars marching toward the player
          const dir = Math.sign(p.cx - this.cx) || 1;
          const groundY = ctx.level.pxHeight - 3 * TILE;
          for (let i = 0; i < 5; i++) {
            const ex = this.cx + dir * (28 + i * 30);
            if (ex < 8 || ex > ctx.level.pxWidth - 8) break;
            ctx.play.addEntity(new EruptColumn(ex, groundY, 34,
              { warn: 28 + i * 10, active: 42, style: 'fire' }));
          }
          sfx.shoot();
        } else {
          this.state = 'dashWarn';
          this.timer = 36;
          sfx.warn();
        }
      }
    }

    moveAndCollide(this, ctx.level);

    if (this.phase >= 2 && --this.emberTimer <= 0) {
      this.emberTimer = 60;
      const ex = p.cx + (Math.random() - 0.5) * 120;
      ctx.play.addEntity(new HazardShot(ex, ctx.play.camera.y - 8, 0, 1.2,
        { gravity: 0.1, sprite: 'fireball', life: 320 }));
    }
  }
  draw(g, ox, oy) {
    if (this.skipDraw()) return;
    const spr = this.facing >= 0 ? S.flameking.r : S.flameking.l;
    if (this.phase >= 2 || this.state === 'dashWarn' || this.state === 'dash') {
      g.globalAlpha = 0.55 + 0.45 * Math.sin(this.animTime * 0.12);
      g.fillStyle = 'rgba(255,140,26,0.25)';
      const rx = Math.round(this.x - ox), ry = Math.round(this.y - oy);
      g.fillRect(rx - 3, ry - 3, this.w + 6, this.h + 6);
      g.globalAlpha = 1;
    }
    const jx = this.state === 'dashWarn' && (this.animTime / 3 | 0) % 2 ? 1 : 0;
    this.drawSprite(g, spr, ox, oy, jx, 0);
  }
}

// ---------------------------------------------------------------------------
// World 6 boss: Coatl — a coiled feathered serpent idol come to life.
// Slithers and leaps, spits venom, raises whipping vines, and in its second
// phase coil-charges and lashes with its tail. Two phases.
// ---------------------------------------------------------------------------
export class Coatl extends Boss {
  constructor(x, y) {
    super(x, y - 14, 28, 28, 9, 'COATL');
    this.attackTimer = 90;
    this.chained = 0;
    this.rainTimer = 60;
    this.phaseThresholds = [6, 3];
    this.auraColor = 'rgba(31,184,166,0.25)';
    this.deathColors = ['#1fb8a6', '#e0a838'];
  }
  update(ctx) {
    this.tick();
    if (this.dying) return this.updateDying(ctx);
    const p = ctx.player;

    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);

    if (this.state === 'leapWarn') {
      this.vx = 0;
      if (--this.timer <= 0) this.leap(p);
    } else if (this.state === 'leap') {
      // airborne — landing handled after moveAndCollide
    } else if (this.state === 'dashWarn') {
      this.vx = 0;
      if (--this.timer <= 0) {
        this.state = 'dash';
        this.timer = 70;
        this.facing = Math.sign(p.cx - this.cx) || 1;
        sfx.roar();
      }
    } else if (this.state === 'dash') {
      this.vx = 3.5 * this.facing;
      if (--this.timer <= 0 || this.hitWall) {
        this.state = 'slither';
        this.attackTimer = this.phase >= 2 ? 65 : 105;
        this.vx = 0;
      }
    } else if (this.state === 'lashWarn') {
      this.vx = 0;
      if (--this.timer <= 0) {
        const dir = this.facing;
        const len = TILE * 8;
        const tx = dir > 0 ? this.x + this.w - 4 : this.x + 4 - len;
        ctx.play.addEntity(new LaserBeam(tx, this.y + this.h - 8, len,
          { warn: 10, fire: 30, color: '#e0a838', thickness: 7 }));
        this.state = 'lash';
        this.timer = 40;
        sfx.roar();
      }
    } else if (this.state === 'lash') {
      this.vx = 0;
      if (--this.timer <= 0) { this.state = 'slither'; this.attackTimer = this.phase >= 2 ? 55 : 90; }
    } else {
      // default: slither toward the player
      this.state = 'slither';
      const speed = this.phase >= 2 ? 0.8 : 0.5;
      this.facing = Math.sign(p.cx - this.cx) || 1;
      this.vx = speed * this.facing;

      if (--this.attackTimer <= 0) {
        this.attackTimer = this.phase >= 3 ? 55 : this.phase >= 2 ? 70 : 115;
        this.attackNo++;
        // phase 1 rotates 3 attacks; phase 2 unlocks dash + tail lash
        const pick = this.attackNo % (this.phase >= 2 ? 5 : 3);
        if (pick === 0) {
          // 3-way venom spit
          for (const [vx, vy] of [[1.9, -2.0], [1.3, -3.0], [0.6, -3.6]]) {
            ctx.play.addEntity(new HazardShot(this.cx, this.y + 6, vx * this.facing, vy,
              { gravity: 0.14, sprite: 'dart', life: 320 }));
          }
          sfx.shoot();
        } else if (pick === 1) {
          // whipping vines march toward the player
          const dir = Math.sign(p.cx - this.cx) || 1;
          const groundY = ctx.level.pxHeight - 3 * TILE;
          for (let i = 0; i < 5; i++) {
            const ex = this.cx + dir * (28 + i * 30);
            if (ex < 8 || ex > ctx.level.pxWidth - 8) break;
            ctx.play.addEntity(new EruptColumn(ex, groundY, 40,
              { warn: 26 + i * 10, active: 44, style: 'vine' }));
          }
          sfx.shoot();
        } else if (pick === 3) {
          // coil-charge dash across the arena
          this.state = 'dashWarn';
          this.timer = 34;
        } else if (pick === 4) {
          // tail lash: a long low beam raking the arena floor
          this.state = 'lashWarn';
          this.timer = 30;
        } else {
          // slam leap: tremor shockwaves on landing
          this.state = 'leapWarn';
          this.timer = 26;
        }
      }
    }

    moveAndCollide(this, ctx.level);

    // phase 3 desperation: venom rains from the canopy
    if (this.phase >= 3 && --this.rainTimer <= 0) {
      this.rainTimer = 55;
      const ex = p.cx + (Math.random() - 0.5) * 110;
      ctx.play.addEntity(new HazardShot(ex, ctx.play.camera.y - 8, 0, 1.3,
        { gravity: 0.1, sprite: 'dart', life: 300 }));
    }

    if (this.state === 'leap' && this.onGround) {
      ctx.play.camera.shake(14, 3);
      sfx.stomp();
      ctx.play.addEntity(new Shockwave(this.x - 6, this.y + this.h, -1));
      ctx.play.addEntity(new Shockwave(this.x + this.w - 4, this.y + this.h, 1));
      if (this.phase >= 2 && this.chained < (this.phase >= 3 ? 2 : 1)) {
        this.chained++;
        this.leap(p);
      } else {
        this.chained = 0;
        this.state = 'slither';
        this.attackTimer = this.phase >= 2 ? 50 : 90;
        this.vx = 0;
      }
    }
  }
  leap(p) {
    this.state = 'leap';
    this.vy = -5.6;
    this.vx = (Math.sign(p.cx - this.cx) || 1) * (this.phase >= 2 ? 2.0 : 1.4);
    sfx.bounce();
  }
  draw(g, ox, oy) {
    if (this.skipDraw()) return;
    const spr = this.facing >= 0 ? S.coatl.r : S.coatl.l;
    if (this.phase >= 2 || this.state === 'dash' || this.state === 'dashWarn') {
      g.globalAlpha = 0.55 + 0.45 * Math.sin(this.animTime * 0.12);
      g.fillStyle = 'rgba(31,184,166,0.25)';
      const rx = Math.round(this.x - ox), ry = Math.round(this.y - oy);
      g.fillRect(rx - 3, ry - 3, this.w + 6, this.h + 6);
      g.globalAlpha = 1;
    }
    const jx = (this.state === 'leapWarn' || this.state === 'dashWarn' || this.state === 'lashWarn') &&
      (this.animTime / 3 | 0) % 2 ? 1 : 0;
    this.drawSprite(g, spr, ox, oy, jx, 0);
    if (this.state === 'lashWarn' && (this.animTime / 4 | 0) % 2) {
      g.fillStyle = '#e0a838';
      g.fillRect(Math.round(this.facing > 0 ? this.x + this.w - 6 - ox : this.x + 2 - ox),
        Math.round(this.y + this.h - 8 - oy), 4, 6);
    }
  }
}

// Final boss: a sea serpent that swims figure-eights through the flooded
// arena. Bubble volleys, a vortex that drags the player in, urchin mines,
// and from phase 2 a telegraphed charge sweep that leaves its head stunned
// and stompable. Phase 3 adds geysers erupting from the arena floor.
export class AbyssalLeviathan extends Boss {
  constructor(x, y) {
    super(x, y, 30, 26, 10, 'ABYSSAL LEVIATHAN');
    this.stompable = false;
    this.cx0 = x;      // orbit center, set properly on first update
    this.cy0 = y - 40;
    this.t = 0;
    this.deathColors = ['#2f7fd4', '#54e0c8'];
    this.phaseThresholds = [7, 3];
    this.auraColor = 'rgba(84,224,200,0.28)';
    this.orbitInit = false;
    this.geyserTimer = 0;
  }
  onPhaseChange(ctx) {
    if (this.phase === 3) this.geyserTimer = 90;
    this.state = 'swim';
    this.timer = 50;
    ctx.play.gustForce = 0;
  }
  swimOrbit(speed) {
    // figure-eight (Lissajous) path around the arena center
    this.t += speed;
    this.x = this.cx0 + Math.sin(this.t) * 70 - this.w / 2;
    this.y = this.cy0 + Math.sin(this.t * 2) * 28 - this.h / 2;
    this.facing = Math.cos(this.t) >= 0 ? 1 : -1;
  }
  update(ctx) {
    this.tick();
    if (this.dying) return this.updateDying(ctx);
    const p = ctx.player;
    const lv = ctx.level;

    if (!this.orbitInit) {
      this.orbitInit = true;
      this.cx0 = lv.pxWidth / 2;
      this.cy0 = lv.pxHeight / 2 - 12;
    }

    // phase 3: periodic floor geysers at the arena edges
    if (this.phase >= 3 && --this.geyserTimer <= 0) {
      this.geyserTimer = 150;
      const gx = Math.random() < 0.5 ? 3 * TILE : lv.pxWidth - 4 * TILE;
      ctx.play.addEntity(new EruptColumn(gx, lv.pxHeight - 2 * TILE, 6 * TILE, { warn: 50, style: 'geyser' }));
      sfx.warn();
    }

    if (this.state === 'intro') { this.state = 'swim'; this.timer = 80; }

    if (this.state === 'swim') {
      this.swimOrbit(0.022 + (this.phase - 1) * 0.006);
      if (--this.timer <= 0) {
        this.attackNo++;
        const pick = this.attackNo % (this.phase >= 2 ? 4 : 3);
        if (pick === 1) { this.state = 'volley'; this.timer = 40; sfx.warn(); }
        else if (pick === 2) { this.state = 'vortex'; this.timer = 130; sfx.roar(); }
        else if (pick === 3) { this.state = 'chargeWarn'; this.timer = 46; sfx.warn(); }
        else { this.state = 'mines'; this.timer = 36; sfx.warn(); }
      }
    } else if (this.state === 'volley') {
      // spread of bubbles aimed at the player
      this.swimOrbit(0.012);
      if (this.timer === 20) {
        const base = Math.atan2(p.cy - this.cy, p.cx - this.cx);
        const n = this.phase >= 2 ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.28;
          ctx.play.addEntity(new HazardShot(this.cx, this.cy,
            Math.cos(a) * 1.9, Math.sin(a) * 1.9, { sprite: 'bubble', life: 260, dieOnTiles: false }));
        }
        sfx.shoot();
      }
      if (--this.timer <= 0) { this.state = 'swim'; this.timer = 80; }
    } else if (this.state === 'vortex') {
      // hold near center and drag the player toward the maw
      this.x += (this.cx0 - this.w / 2 - this.x) * 0.06;
      this.y += (this.cy0 - this.h / 2 - this.y) * 0.06;
      this.facing = Math.sign(p.cx - this.cx) || 1;
      const dir = Math.sign(this.cx - p.cx) || 1;
      ctx.play.gustForce = dir * 0.11;
      if (this.animTime % 4 === 0) {
        ctx.play.addEntity(new Particle(
          p.cx - dir * 30 + (Math.random() - 0.5) * 20, p.cy + (Math.random() - 0.5) * 30,
          dir * (1.8 + Math.random()), (Math.random() - 0.5) * 0.4,
          'rgba(191,230,255,0.7)', 22, 1, 0));
      }
      if (--this.timer <= 0) {
        ctx.play.gustForce = 0;
        this.state = 'swim';
        this.timer = 70;
      }
    } else if (this.state === 'mines') {
      // release drifting urchin mines
      if (this.timer === 18) {
        const n = this.phase >= 3 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const mx = this.cx - 8 + (i - (n - 1) / 2) * 40;
          const my = Math.min(lv.pxHeight - 3 * TILE, this.cy + 20);
          ctx.play.addEntity(new LeviMine(mx, my));
        }
        sfx.shoot();
      }
      this.swimOrbit(0.012);
      if (--this.timer <= 0) { this.state = 'swim'; this.timer = 90; }
    } else if (this.state === 'chargeWarn') {
      // line up at one side, flashing, then sweep across
      const side = p.cx < lv.pxWidth / 2 ? lv.pxWidth - 3 * TILE - this.w : 3 * TILE;
      this.x += (side - this.x) * 0.1;
      this.y += (p.cy - this.h / 2 - this.y) * 0.08;
      this.facing = Math.sign(p.cx - this.cx) || 1;
      if (--this.timer <= 0) {
        this.state = 'charge';
        this.timer = 90;
        this.chargeVx = this.facing * 3.4;
        sfx.roar();
      }
    } else if (this.state === 'charge') {
      this.x += this.chargeVx;
      this.y += Math.sin(this.animTime * 0.2) * 0.8;
      if (this.animTime % 3 === 0) {
        ctx.play.addEntity(new Particle(this.cx - this.facing * 14, this.cy + (Math.random() - 0.5) * 16,
          -this.facing * 1.2, (Math.random() - 0.5) * 0.6, '#bfe6ff', 20, 2, -0.02));
      }
      if (this.x < 2 * TILE || this.x + this.w > lv.pxWidth - 2 * TILE || --this.timer <= 0) {
        // slams the wall: head stunned and stompable
        this.state = 'stunned';
        this.timer = 130;
        this.stompable = true;
        this.harmful = false;
        ctx.play.camera.shake(14, 3);
        sfx.stomp();
        burst(ctx.play, this.cx, this.cy, ['#bfe6ff', '#2f7fd4'], 10, 2.2, 28);
      }
    } else if (this.state === 'stunned') {
      this.y += Math.sin(this.animTime * 0.08) * 0.3;
      if (--this.timer <= 0) {
        this.state = 'swim';
        this.timer = 90;
        this.stompable = false;
        this.harmful = true;
        // re-sync the orbit to the current position
        this.t = 0;
      }
    }
  }
  squash(ctx) {
    if (this.takeHit(ctx)) {
      this.state = 'swim';
      this.timer = 90;
      this.stompable = false;
      this.harmful = true;
      this.t = 0;
    }
  }
  draw(g, ox, oy) {
    if (this.skipDraw()) return;
    this.drawAura(g, ox, oy);
    const spr = this.facing >= 0 ? S.leviathan.r : S.leviathan.l;
    const jx = (this.state === 'chargeWarn' || this.state === 'volley') &&
      (this.animTime / 3 | 0) % 2 ? 1 : 0;
    this.drawSprite(g, spr, ox, oy, jx, 0);
    if (this.state === 'stunned') {
      g.fillStyle = '#ffe14a';
      const a = this.animTime * 0.15;
      g.fillRect(Math.round(this.cx + Math.cos(a) * 14 - ox), Math.round(this.y - 6 + Math.sin(a) * 3 - oy), 3, 3);
    }
  }
}

// A drifting spiked mine dropped by the Leviathan: sinks slowly, pops after a
// while or when shot.
export class LeviMine extends Enemy {
  constructor(x, y) {
    super(x, y, 10, 10);
    this.stompable = false;
    this.life = 420;
    this.t = Math.random() * Math.PI * 2;
    this.deathColors = ['#3a2c50', '#d44a6a'];
  }
  update(ctx) {
    this.animTime++;
    this.t += 0.04;
    this.y += 0.15;
    this.x += Math.sin(this.t) * 0.3;
    if (--this.life <= 0 || this.y > ctx.level.pxHeight - 2 * TILE) {
      this.dead = true;
      burst(ctx.play, this.cx, this.cy, this.deathColors, 8, 1.8, 24);
    }
  }
  draw(g, ox, oy) {
    const pulse = (this.animTime / 8 | 0) % 2;
    this.drawSprite(g, S.urchin, ox, oy - pulse);
  }
}

export const BOSS_FACTORY = {
  toadking: ToadKing,
  golem: CrystalGolem,
  bird: StormBird,
  kernel: Kernel,
  flameking: FlameKing,
  coatl: Coatl,
  leviathan: AbyssalLeviathan,
};
