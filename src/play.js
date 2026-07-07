import {
  TILE, VIEW_W, VIEW_H, STOMP_BOUNCE, GLITCH_DURATION, INVULN_FRAMES, COINS_PER_LIFE, WORLDS,
} from './constants.js';
import { input } from './input.js';
import { Level } from './level.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { aabb } from './physics.js';
import { S, drawTextCentered } from './sprites.js';
import {
  Coin, PowerPickup, Flag, Checkpoint, FloatingCheckpoint, MovingPlatform, CrumblePlatform, Firebar,
  TextPop, Particle, burst,
} from './entities.js';
import { ENEMY_FACTORY } from './enemies.js';
import { BOSS_FACTORY } from './bosses.js';
import { drawHud } from './hud.js';
import { sfx } from './audio.js';
import { music, WORLD_THEMES } from './music.js';
import { LEVELS } from './levels/index.js';

export class PlayState {
  constructor(game, levelIndex, respawn = null) {
    this.game = game;
    this.levelIndex = levelIndex;
    const { world, def } = LEVELS[levelIndex];
    this.level = new Level(def, world, levelIndex);
    music.play(WORLD_THEMES[world]);
    this.entities = [];
    this.boss = null;
    this.checkpoint = respawn;
    this.clearing = false;
    this.clearTimer = 0;
    this.introTimer = 110;
    this.windTimer = 0;
    this.ambientTimer = 0;
    this.leafTimer = 0;
    this.gustForce = 0; // set by the Storm Bird's gust attack

    for (const sp of this.level.spawns) this.spawnFromChar(sp);

    // boss levels open with a short letterboxed intro instead of the banner
    this.bossIntro = this.boss && !respawn ? 170 : 0;
    if (this.bossIntro) this.introTimer = 0;

    const start = respawn || this.level.playerStart;
    this.player = new Player(start.x, start.y, game.power);
    this.camera = new Camera(this.level);
    this.camera.snapTo(this.player);

    // offscreen scene buffer for glitch post-fx
    this.scene = document.createElement('canvas');
    this.scene.width = VIEW_W;
    this.scene.height = VIEW_H;
    this.sceneCtx = this.scene.getContext('2d');
    this.sceneCtx.imageSmoothingEnabled = false;
  }

  spawnFromChar({ type, x, y }) {
    if (type === 'o') this.addEntity(new Coin(x, y));
    else if (type === 'C') this.addEntity(this.level.meta.water ? new FloatingCheckpoint(x, y) : new Checkpoint(x, y));
    else if (type === 'F') this.addEntity(new Flag(x, y, this.level));
    else if (type === 'M') this.addEntity(new MovingPlatform(x, y, false));
    else if (type === 'V') this.addEntity(new MovingPlatform(x, y, true));
    else if (type === '%') this.addEntity(new CrumblePlatform(x, y));
    else if (type === 'r') this.addEntity(new Firebar(x, y));
    else if (type === 'X') {
      const BossClass = BOSS_FACTORY[this.level.meta.boss];
      if (BossClass) {
        this.boss = new BossClass(x, y);
        this.addEntity(this.boss);
      }
    } else if (ENEMY_FACTORY[type]) {
      this.addEntity(new ENEMY_FACTORY[type](x, y));
    }
  }

  addEntity(e) { this.entities.push(e); }

  get platforms() { return this.entities.filter(e => e.solidPlatform && !e.dead); }

  ctx() { return { level: this.level, player: this.player, play: this, game: this.game }; }

  // -------------------------------------------------------------------------
  update() {
    this.level.update();
    if (this.bossIntro > 0) {
      // cinematic hold: world keeps animating, nothing moves yet
      if (this.bossIntro < 160 && (input.justPressed('confirm') || input.justPressed('jump'))) {
        this.bossIntro = Math.min(this.bossIntro, 8);
      }
      if (--this.bossIntro === 0) {
        music.play('boss');
        sfx.roar();
      }
      return;
    }
    if (this.introTimer > 0) this.introTimer--;

    if (this.clearing) {
      // let particles finish, then hand off
      for (const e of this.entities) if (e instanceof Particle) e.update(this.ctx());
      this.entities = this.entities.filter(e => !e.dead);
      if (--this.clearTimer <= 0) this.game.onLevelCleared(this.levelIndex);
      return;
    }

    const ctx = this.ctx();
    this.player.update(ctx);

    // cull far-offscreen check + update entities
    for (const e of this.entities) {
      if (e.dead) continue;
      // only activate enemies near the camera (a bit beyond both edges)
      if (e.isEnemy && !e.isBoss) {
        const dx = e.cx - (this.camera.x + VIEW_W / 2);
        if (Math.abs(dx) > VIEW_W * 0.85) continue;
      }
      e.update(ctx);
    }

    if (!this.player.dying) this.handleCollisions(ctx);

    this.entities = this.entities.filter(e => !e.dead);
    this.camera.follow(this.player);

    // boss arena ambience: slow drifting motes in the boss's colors
    if (this.boss && !this.boss.dead && ++this.ambientTimer % 14 === 0) {
      const cols = this.boss.deathColors || ['#fff'];
      this.addEntity(new Particle(
        this.camera.x + Math.random() * VIEW_W, this.camera.y - 4,
        (Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.5,
        cols[(Math.random() * cols.length) | 0], 90, 1, 0.002));
    }

    // wind streaks (sky levels)
    if (this.level.meta.wind && ++this.windTimer % 6 === 0) {
      const dir = Math.sin(this.level.time * 0.013);
      this.addEntity(new Particle(
        this.camera.x + Math.random() * VIEW_W, this.camera.y + Math.random() * VIEW_H,
        dir * 3, 0, 'rgba(255,255,255,0.5)', 30, 1, 0));
    }

    // falling leaves (jungle levels): slow drift, sideways push varies over time
    if (this.level.world === 5 && ++this.leafTimer % 20 === 0) {
      const drift = Math.sin(this.level.time * 0.02) * 0.5 + (Math.random() - 0.5) * 0.3;
      this.addEntity(new Particle(
        this.camera.x + Math.random() * VIEW_W, this.camera.y - 4,
        drift, 0.4 + Math.random() * 0.3,
        Math.random() < 0.5 ? '#4ec26a' : '#2f8a44', 110, 2, 0.001));
    }
  }

  handleCollisions(ctx) {
    const p = this.player;
    const glitching = p.glitchTimer > 0;

    for (const e of this.entities) {
      if (e.dead) continue;

      // pickups
      if (e.pickup && aabb(p, e)) {
        this.collectPickup(e);
        continue;
      }

      // enemies (touch); standing on a solid-platform enemy is safe.
      if (e.isEnemy && aabb(p, e)) {
        if (glitching && !e.isBoss) {
          e.dead = true;
          burst(this, e.cx, e.cy, ['#00ff88', '#ff00ff', '#ffff00', '#00ffff'], 14, 2.8, 34);
          sfx.explode();
          continue;
        }
        // Compare previous-frame positions so high closing speed (falling player
        // + rising boss) still reads as a stomp; falling onto the upper half
        // of a tall enemy also counts.
        const evy = e.vy || 0;
        const prevFeet = p.y + p.h - p.vy;
        const prevTop = e.y - evy;
        const stomping = (p.vy - evy) > 0 &&
          (prevFeet <= prevTop + 6 || (p.vy > 0 && p.cy < e.cy));
        if (e.stompable && stomping && !glitching) {
          e.squash(ctx);
          // Snap clear of the enemy's hitbox immediately (a tall, still-moving
          // boss can otherwise re-overlap the player before the bounce lifts
          // them clear, turning a clean stomp into a bogus hit next frame) and
          // grant a brief grace against further contact with this entity.
          p.y = e.y - p.h - 1;
          p.stompGraceEntity = e;
          p.stompGraceTimer = 10;
          p.vy = input.isHeld('jump') ? STOMP_BOUNCE - 1.4 : STOMP_BOUNCE;
          p.jumps = 1;
          sfx.bounce();
        } else if (e.harmful && !glitching &&
            !(p.stompGraceEntity === e && p.stompGraceTimer > 0) &&
            !(e.solidPlatform && p.onGround && p.vy >= -0.01 && prevFeet <= e.y + 9)) {
          this.hurtPlayer();
        } else if (e.onTouch && !glitching) {
          e.onTouch(ctx); // e.g. kicking an idle snail shell
        }
        continue;
      }

      // harmful projectiles / hazards
      if (e.harmful && !e.isEnemy && aabb(p, e)) {
        if (glitching) {
          if (!(e.w > 60)) { // beams survive; small shots get corrupted
            e.dead = true;
            burst(this, e.cx, e.cy, ['#00ff88', '#ff00ff'], 6, 2, 20);
          }
        } else {
          this.hurtPlayer();
        }
      }
    }

    // sliding snail shells plow through other enemies
    for (const shell of this.entities) {
      if (!shell.isSlidingShell || shell.dead) continue;
      for (const e of this.entities) {
        if (e === shell || !e.isEnemy || e.dead || e.isBoss) continue;
        if (aabb(shell, e)) {
          e.dead = true;
          burst(this, e.cx, e.cy, e.deathColors || ['#888'], 10, 2.2, 30);
          sfx.stomp();
        }
      }
    }

    // player shots vs enemies
    for (const shot of this.entities) {
      if (!shot.isShot || shot.dead) continue;
      for (const e of this.entities) {
        if (!e.isEnemy || e.dead) continue;
        if (aabb(shot, e)) {
          shot.dead = true;
          if (e.shootable) e.shot(ctx);
          else {
            burst(this, shot.cx, shot.cy, ['#ffb020'], 4, 1.4, 16);
            sfx.bump();
          }
          break;
        }
      }
    }
  }

  collectPickup(e) {
    e.dead = true;
    const p = this.player;
    if (e.pickup === 'coin') {
      this.addCoins(1);
      sfx.coin();
    } else if (e.pickup === 'berry') {
      const wasSmall = p.power === 'small';
      if (wasSmall) p.setPower('big');
      else this.addCoins(5);
      sfx.powerup();
      this.addEntity(new TextPop(e.cx - 8, e.y - 6, wasSmall ? 'GROW!' : '+5', '#ffd23e'));
    } else if (e.pickup === 'orb') {
      if (p.power !== 'fire') { p.setPower('fire'); this.addEntity(new TextPop(e.cx - 10, e.y - 6, 'SPARK!', '#ff8c1a')); }
      else this.addCoins(5);
      sfx.powerup();
    } else if (e.pickup === 'oneup') {
      this.game.lives++;
      sfx.oneUp();
      this.addEntity(new TextPop(e.cx - 6, e.y - 6, '1UP!', '#3ecb5a'));
    } else if (e.pickup === 'glitch') {
      p.glitchTimer = GLITCH_DURATION;
      sfx.glitch();
      this.addEntity(new TextPop(e.cx - 20, e.y - 6, 'GLITCH MODE!', '#00ff88'));
    }
  }

  addCoins(n) {
    this.game.coins += n;
    this.game.totalCoins += n;
    while (this.game.coins >= COINS_PER_LIFE) {
      this.game.coins -= COINS_PER_LIFE;
      this.game.lives++;
      sfx.oneUp();
      this.addEntity(new TextPop(this.player.cx - 6, this.player.y - 10, '1UP!', '#3ecb5a'));
    }
  }

  bumpBlock(tx, ty) {
    const result = this.level.bumpTile(tx, ty, this.player.power);
    if (!result) return;
    const px = tx * TILE + TILE / 2, py = ty * TILE;
    if (result.type === 'coin') {
      this.addCoins(1);
      sfx.coin();
      burst(this, px, py - 4, ['#ffd23e', '#fff7d0'], 6, 1.6, 20, 0.1);
      this.addEntity(new Particle(px - 4, py - 12, 0, -2.4, '#ffd23e', 20, 4, 0.12));
    } else if (result.type === 'power') {
      const kind = this.player.power === 'small' ? 'berry' : 'orb';
      this.addEntity(new PowerPickup(tx, ty - 1, kind));
      sfx.powerup();
    } else if (result.type === 'glitch') {
      this.addEntity(new PowerPickup(tx, ty - 1, 'glitch'));
      sfx.glitch();
    } else if (result.type === 'oneup') {
      this.addEntity(new PowerPickup(tx, ty - 1, 'oneup'));
      sfx.powerup();
    } else if (result.type === 'break') {
      sfx.breakBlock();
      burst(this, px, py + TILE / 2, ['#c8703a', '#8a4a22'], 8, 2.2, 30);
    } else if (result.type === 'bump') {
      sfx.bump();
    }
    // knock enemies standing on the bumped tile
    for (const e of this.entities) {
      if (e.isEnemy && !e.isBoss && !e.dead &&
          Math.abs((e.y + e.h) - ty * TILE) < 3 &&
          e.cx > tx * TILE - 4 && e.cx < (tx + 1) * TILE + 4) {
        e.dead = true;
        burst(this, e.cx, e.cy, e.deathColors || ['#888'], 8, 2, 26);
        sfx.stomp();
      }
    }
  }

  setCheckpoint(x, y) {
    this.checkpoint = { x, y: y - 4 };
  }

  hurtPlayer() {
    const p = this.player;
    if (p.invuln > 0 || p.glitchTimer > 0 || p.dying || this.clearing) return;
    if (p.power === 'fire') {
      p.setPower('big');
      p.invuln = INVULN_FRAMES;
      sfx.hurt();
    } else if (p.power === 'big') {
      p.setPower('small');
      p.invuln = INVULN_FRAMES;
      sfx.hurt();
    } else {
      this.killPlayer();
    }
  }

  killPlayer() {
    if (!this.player.dying && !this.clearing) this.player.startDeath();
  }

  playerDied() {
    this.game.onPlayerDied(this.levelIndex, this.checkpoint);
  }

  levelClear() {
    if (this.clearing || this.player.dying) return;
    this.clearing = true;
    this.clearTimer = 150;
    this.game.power = this.player.power;
    sfx.flag();
  }

  bossDefeated() {
    this.levelClear();
  }

  // -------------------------------------------------------------------------
  draw(g) {
    const glitching = this.player.glitchTimer > 0;
    const t = glitching ? this.sceneCtx : g;

    this.level.drawBackground(t, this.camera);
    this.level.draw(t, this.camera);
    const ox = this.camera.ox(), oy = this.camera.oy();
    for (const e of this.entities) if (!e.dead && !(e instanceof Particle)) e.draw(t, ox, oy);
    this.player.draw(t, ox, oy, this.level.time);
    for (const e of this.entities) if (!e.dead && e instanceof Particle) e.draw(t, ox, oy);

    // underwater cast: translucent blue wash over the whole scene
    if (this.level.meta.water) {
      t.fillStyle = 'rgba(30,90,170,0.18)';
      t.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // caverns darkness
    if (this.level.meta.dark && !glitching) {
      const px = this.player.cx - ox, py = this.player.cy - oy;
      const grad = t.createRadialGradient(px, py, 34, px, py, 130);
      grad.addColorStop(0, 'rgba(4,4,12,0)');
      grad.addColorStop(1, 'rgba(4,4,12,0.88)');
      t.fillStyle = grad;
      t.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // glitch post-processing: scanline displacement + invert pulses
    if (glitching) {
      const time = this.level.time;
      for (let y = 0; y < VIEW_H; y += 8) {
        const shift = Math.random() < 0.25 ? ((Math.random() * 7 - 3) | 0) : 0;
        g.drawImage(this.scene, 0, y, VIEW_W, 8, shift, y, VIEW_W, 8);
      }
      if (time % 50 < 5 || (this.player.glitchTimer < 90 && time % 20 < 3)) {
        g.globalCompositeOperation = 'difference';
        g.fillStyle = '#fff';
        g.fillRect(0, 0, VIEW_W, VIEW_H);
        g.globalCompositeOperation = 'source-over';
      }
      // stray corrupted pixels
      for (let i = 0; i < 14; i++) {
        g.fillStyle = ['#00ff88', '#ff00ff', '#ffff00'][(Math.random() * 3) | 0];
        g.fillRect((Math.random() * VIEW_W) | 0, (Math.random() * VIEW_H) | 0, 2, 2);
      }
    }

    drawHud(g, this.game, this);

    if (this.introTimer > 0) {
      const w = LEVELS[this.levelIndex].world, l = LEVELS[this.levelIndex].li + 1;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(0, 96, VIEW_W, 46);
      drawTextCentered(g, `WORLD ${w + 1}-${l}`, VIEW_W / 2, 106, '#fff', 2);
      drawTextCentered(g, WORLDS[w].name, VIEW_W / 2, 126, WORLDS[w].color);
    }

    if (this.bossIntro > 0 && this.boss) {
      const w = LEVELS[this.levelIndex].world;
      // letterbox bars slide in over the first ~20 frames
      const slide = Math.min(1, (170 - this.bossIntro) / 20);
      const barH = Math.round(30 * slide);
      g.fillStyle = '#000';
      g.fillRect(0, 0, VIEW_W, barH);
      g.fillRect(0, VIEW_H - barH, VIEW_W, barH);
      if (this.bossIntro < 150) {
        // name card slides in from the right
        const t = Math.min(1, (150 - this.bossIntro) / 25);
        const nx = VIEW_W / 2 + (1 - t) * 130;
        drawTextCentered(g, this.boss.name, nx, 104, WORLDS[w].color, 3);
        if (this.bossIntro < 120) {
          drawTextCentered(g, 'VS', nx, 88, '#fff');
          if ((this.bossIntro / 20 | 0) % 2) {
            drawTextCentered(g, 'ENTER TO FIGHT', VIEW_W / 2, 136, '#9aa4b5');
          }
        }
      }
    }

    if (this.clearing) {
      drawTextCentered(g, this.boss ? 'BOSS DEFEATED!' : 'LEVEL CLEAR!', VIEW_W / 2, 100, '#ffd23e', 2);
    }
  }
}
