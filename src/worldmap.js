// Mario-style scrolling world map: a serpentine path of level nodes winding
// down through themed bands, one per world.
import { VIEW_W, VIEW_H, WORLDS } from './constants.js';
import { input } from './input.js';
import { S, drawText, drawTextCentered } from './sprites.js';
import { sfx } from './audio.js';
import { LEVELS, WORLD_STARTS } from './levels/index.js';
import { music } from './music.js';

const LAST_LEVEL = LEVELS.length - 1;
const BAND_H = 56;       // vertical space per world
const PAD_TOP = 34;      // headroom above the first band
const SPACING = 40;      // horizontal step between nodes
const X_MARGIN = 48;     // path start x in world 0
const WALK_FRAMES = 22;

function worldLevelCount(w) {
  const start = WORLD_STARTS[w];
  return (w + 1 < WORLD_STARTS.length ? WORLD_STARTS[w + 1] : LEVELS.length) - start;
}

// One node per level. Bands alternate direction; each world's first node sits
// directly below the previous world's last node so the connector is vertical.
function buildNodes() {
  const nodes = [];
  let x = X_MARGIN;
  let dir = 1;
  for (let w = 0; w < WORLDS.length; w++) {
    const count = worldLevelCount(w);
    const baseY = PAD_TOP + w * BAND_H + BAND_H / 2 + 6;
    for (let l = 0; l < count; l++) {
      const idx = WORLD_STARTS[w] + l;
      nodes.push({
        x: x + dir * l * SPACING,
        y: baseY + Math.round(Math.sin(idx * 1.7) * 5),
        world: w,
        li: l,
        boss: !!LEVELS[idx].def.meta.boss,
      });
    }
    x += dir * (count - 1) * SPACING;
    dir = -dir;
  }
  return nodes;
}

export class WorldMapState {
  constructor(game, cursor = 0) {
    this.game = game;
    this.cursor = Math.min(cursor, game.save.unlocked, LAST_LEVEL);
    this.time = 0;
    this.nodes = buildNodes();
    this.mapH = PAD_TOP + WORLDS.length * BAND_H + 30;
    // walk animation state: sliding from `walkFrom` toward `cursor`
    this.walkFrom = -1;
    this.walkT = 0;
    this.buffered = 0;
    this.camY = this.clampCam(this.nodes[this.cursor].y - VIEW_H / 2);
    music.play('map');
  }
  clampCam(y) {
    return Math.max(0, Math.min(y, this.mapH - VIEW_H));
  }
  startWalk(target) {
    this.walkFrom = this.cursor;
    this.cursor = target;
    this.walkT = 0;
    sfx.select();
  }
  update() {
    this.time++;
    const max = Math.min(this.game.save.unlocked, LAST_LEVEL);

    if (this.walkFrom >= 0) {
      // buffer one step of input while walking
      if (input.justPressed('right')) this.buffered = 1;
      if (input.justPressed('left')) this.buffered = -1;
      if (++this.walkT >= WALK_FRAMES) {
        this.walkFrom = -1;
        const b = this.buffered;
        this.buffered = 0;
        const next = this.cursor + b;
        if (b && next >= 0 && next <= max) this.startWalk(next);
      }
    } else {
      if (input.justPressed('right') && this.cursor < max) this.startWalk(this.cursor + 1);
      else if (input.justPressed('left') && this.cursor > 0) this.startWalk(this.cursor - 1);
      else if (input.justPressed('down')) {
        const w = LEVELS[this.cursor].world;
        if (w + 1 < WORLD_STARTS.length && WORLD_STARTS[w + 1] <= max) {
          this.cursor = WORLD_STARTS[w + 1]; sfx.select();
        }
      } else if (input.justPressed('up')) {
        const w = LEVELS[this.cursor].world;
        if (w > 0) { this.cursor = WORLD_STARTS[w - 1]; sfx.select(); }
      }
      if (input.justPressed('confirm') || input.justPressed('jump')) {
        sfx.confirm();
        this.game.startLevel(this.cursor);
        return;
      }
    }

    const target = this.clampCam(this.playerPos().y - VIEW_H / 2);
    this.camY += (target - this.camY) * 0.12;
  }
  // player position on the map (mid-walk it slides between nodes)
  playerPos() {
    const to = this.nodes[this.cursor];
    if (this.walkFrom < 0) return to;
    const from = this.nodes[this.walkFrom];
    const t = this.walkT / WALK_FRAMES;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  }
  draw(g) {
    g.fillStyle = '#0c0e1c';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    const cam = Math.round(this.camY);
    const max = Math.min(this.game.save.unlocked, LAST_LEVEL);

    for (let w = 0; w < WORLDS.length; w++) this.drawBand(g, w, cam, max >= WORLD_STARTS[w]);
    this.drawPath(g, cam, max);
    this.drawNodes(g, cam, max);
    this.drawPlayer(g, cam);
    this.drawLabels(g);
  }
  drawBand(g, w, cam, unlocked) {
    const top = PAD_TOP + w * BAND_H - cam;
    if (top > VIEW_H || top + BAND_H < 0) return;
    const c = WORLDS[w].color;
    g.globalAlpha = unlocked ? 0.16 : 0.06;
    g.fillStyle = c;
    g.fillRect(0, top, VIEW_W, BAND_H);
    g.globalAlpha = unlocked ? 0.5 : 0.15;
    // cheap per-world motifs in the band's own accent
    if (w === 0) { // meadow: hills + sun
      g.fillStyle = c;
      for (let i = 0; i < 5; i++) {
        const hx = 20 + i * 70, hh = 10 + (i % 3) * 4;
        const cx = Math.round(hx);
        const y = Math.round(top + BAND_H);
        g.fillRect(cx - 22, y - Math.round(hh * 0.3), 44, Math.round(hh * 0.3));
        g.fillRect(cx - 15, y - Math.round(hh * 0.7), 30, Math.round(hh * 0.7));
        g.fillRect(cx - 8, y - hh, 16, hh);
      }
      const sx = 284, sy = Math.round(top + 12);
      g.fillStyle = '#ffd23e';
      g.fillRect(sx - 3, sy - 6, 6, 12);
      g.fillRect(sx - 5, sy - 5, 10, 10);
      g.fillRect(sx - 6, sy - 3, 12, 6);
    } else if (w === 1) { // caverns: crystal spikes from floor and ceiling
      g.fillStyle = c;
      for (let i = 0; i < 9; i++) {
        const cx = Math.round(12 + i * 36), h = 8 + (i * 5) % 10, up = i % 2 === 0;
        const by = Math.round(up ? top + BAND_H : top);
        for (let dy = 0; dy < h; dy++) {
          const width = Math.max(1, Math.round(8 * (1 - dy / h)));
          const x = cx - Math.floor(width / 2);
          const y = up ? by - dy - 1 : by + dy;
          g.fillRect(x, y, width, 1);
        }
      }
    } else if (w === 2) { // sky: puffy cloud blobs
      g.fillStyle = '#eef6ff';
      for (let i = 0; i < 5; i++) {
        const cx = 24 + i * 64, cy = top + 10 + (i % 3) * 16;
        g.fillRect(cx, cy, 22, 5);
        g.fillRect(cx + 4, cy - 3, 13, 3);
      }
    } else if (w === 3) { // mainframe: terminal grid
      g.fillStyle = c;
      for (let x = 8; x < VIEW_W; x += 32) {
        g.fillRect(x, top + 2, 1, BAND_H - 4);
      }
      for (let y = 8; y < BAND_H; y += 16) {
        g.fillRect(0, top + y, VIEW_W, 1);
      }
    } else if (w === 4) { // molten: lava pool + embers
      g.fillStyle = c;
      g.fillRect(0, top + BAND_H - 7, VIEW_W, 7);
      g.fillStyle = '#ffb040';
      for (let i = 0; i < 8; i++) {
        const ex = 18 + i * 38;
        const ey = top + BAND_H - 12 - ((i * 13 + ((this.time / 4) | 0)) % 30);
        g.fillRect(ex, ey, 2, 2);
      }
    } else if (w === 5) { // jungle: canopy scallops + vines
      g.fillStyle = c;
      for (let i = 0; i < 11; i++) {
        const cx = Math.round(14 + i * 30), cy = Math.round(top);
        for (let dy = 0; dy < 14; dy++) {
          const width = Math.round(2 * Math.sqrt(14 * 14 - dy * dy));
          g.fillRect(cx - Math.floor(width / 2), cy + dy, width, 1);
        }
      }
      g.fillRect(40, top, 2, 26); g.fillRect(170, top, 2, 34); g.fillRect(276, top, 2, 22);
    } else { // depths: waterline + rising bubbles
      g.fillStyle = c;
      g.fillRect(0, top + 3, VIEW_W, 2);
      for (let i = 0; i < 7; i++) {
        const bx = Math.round(24 + i * 44);
        const by = Math.round(top + BAND_H - 6 - ((i * 17 + ((this.time / 3) | 0)) % (BAND_H - 12)));
        g.fillRect(bx - 1, by - 2, 3, 1);
        g.fillRect(bx - 2, by - 1, 1, 3);
        g.fillRect(bx + 2, by - 1, 1, 3);
        g.fillRect(bx - 1, by + 2, 3, 1);
      }
    }
    g.globalAlpha = 1;
  }
  drawPath(g, cam, max) {
    for (let i = 1; i < this.nodes.length; i++) {
      const a = this.nodes[i - 1], b = this.nodes[i];
      const ay = a.y - cam, by = b.y - cam;
      if (Math.max(ay, by) < -8 || Math.min(ay, by) > VIEW_H + 8) continue;
      g.fillStyle = i <= max ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.14)';
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const steps = Math.max(1, (len / 5) | 0);
      for (let s = 1; s < steps; s++) {
        g.fillRect(Math.round(a.x + dx * s / steps) - 1, Math.round(ay + dy * s / steps) - 1, 2, 2);
      }
    }
  }
  drawNodes(g, cam, max) {
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const y = n.y - cam;
      if (y < -20 || y > VIEW_H + 20) continue;
      const accent = WORLDS[n.world].color;
      const cleared = i < max;
      const unlocked = i <= max;
      if (n.boss) {
        // accent glow behind the keep
        g.globalAlpha = unlocked ? 0.35 : 0.1;
        g.fillStyle = accent;
        g.fillRect(n.x - 10, y - 12, 20, 16);
        g.globalAlpha = unlocked ? 1 : 0.35;
        const spr = S.mapCastle;
        g.drawImage(spr, Math.round(n.x - spr.width / 2), Math.round(y - spr.height + 5));
        g.globalAlpha = 1;
      } else if (cleared) {
        g.fillStyle = accent;
        g.fillRect(n.x - 4, y - 4, 8, 8);
      } else if (unlocked) {
        g.strokeStyle = accent;
        g.lineWidth = 1;
        g.strokeRect(n.x - 3.5, y - 3.5, 7, 7);
      } else {
        g.fillStyle = '#2c2c36';
        g.fillRect(n.x - 3, y - 3, 6, 6);
      }
      if (i === this.cursor && this.walkFrom < 0) {
        const r = Math.round(8 + Math.sin(this.time * 0.15) * 1.5);
        const color = (this.time / 15 | 0) % 2 ? '#fff' : '#ffd23e';
        g.fillStyle = color;
        const x1 = Math.round(n.x - r), y1 = Math.round(y - r);
        const size = r * 2;
        g.fillRect(x1, y1, size, 1); // top
        g.fillRect(x1, y1 + size, size + 1, 1); // bottom
        g.fillRect(x1, y1, 1, size); // left
        g.fillRect(x1 + size, y1, 1, size); // right
      }
    }
  }
  drawPlayer(g, cam) {
    const p = this.playerPos();
    let spr;
    if (this.walkFrom >= 0) {
      const from = this.nodes[this.walkFrom], to = this.nodes[this.cursor];
      const facing = to.x < from.x ? 'l' : 'r';
      spr = S.playerSmall.run[((this.walkT / 5) | 0) % 2][facing];
    } else {
      spr = S.playerSmall.idle.r;
    }
    g.drawImage(spr, Math.round(p.x - spr.width / 2), Math.round(p.y - cam - spr.height + 2));
  }
  drawLabels(g) {
    const { world, li, def } = LEVELS[this.cursor];
    const accent = WORLDS[world].color;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, 0, VIEW_W, 22);
    g.fillRect(0, VIEW_H - 14, VIEW_W, 14);
    drawTextCentered(g, WORLDS[world].name, VIEW_W / 2, 3, accent, 2);
    const tag = def.meta.boss ? `${world + 1}-BOSS` : `${world + 1}-${li + 1}`;
    drawText(g, tag, 6, 6, '#fff');
    drawTextCentered(g, 'ENTER TO PLAY', VIEW_W / 2, VIEW_H - 10, '#9aa4b5');
  }
}
