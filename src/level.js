import {
  TILE, VIEW_W, VIEW_H, SOLID_TILES,
  T_EMPTY, T_GROUND, T_BRICK, T_QBLOCK, T_USED, T_SPIKE, T_PLATFORM, T_LAVA, T_GLITCHBLOCK, T_PILLAR,
} from './constants.js';
import { makeTileSkin, drawText } from './sprites.js';

export const TILE_CHARS = {
  '#': T_GROUND,
  'B': T_BRICK,
  '|': T_PILLAR,
  '^': T_SPIKE,
  '-': T_PLATFORM,
  '~': T_LAVA,
};

// Blocks with contents
export const BLOCK_CHARS = {
  '?': { tile: T_QBLOCK, content: 'coin' },
  'U': { tile: T_QBLOCK, content: 'power' },
  '*': { tile: T_GLITCHBLOCK, content: 'glitch' },
  '1': { tile: T_BRICK, content: 'oneup' },
};

// Everything else becomes an entity spawn. Kept in sync with ENEMY_FACTORY
// (enemies.js) and the special cases in PlayState.spawnFromChar by
// test/content.js — an unlisted char is silently dropped at load.
export const SPAWN_CHARS = new Set([
  'P', 'C', 'F', 'o', 'M', 'V', '%', 'X',
  'b', 'h', 'n', 'a', 's', 'k', 'p', 't', 'd', 'f', 'g', 'i', 'l', 'r',
  'e', 'w', 'j', 'q', 'y', 'z', 'u',
]);

const tileSkins = [];
function skin(world) {
  if (!tileSkins[world]) tileSkins[world] = makeTileSkin(world);
  return tileSkins[world];
}

// --- baked background sprites (opaque — no alpha-overlap banding) ----------
function bakeCloud(seed, body, shade, big = false) {
  const rnd = lcg(seed);
  const w = (big ? 66 : 44) + ((rnd() * (big ? 40 : 30)) | 0);
  const bands = (big ? 5 : 4) + ((rnd() * 3) | 0);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = bands * 3 + 2;
  const g = c.getContext('2d');
  let l = 0, r = w;
  const extents = [];
  for (let i = 0; i < bands && r - l >= 10; i++) {
    extents.push([l, r]);
    l += 1 + ((rnd() * 6) | 0);
    r -= 1 + ((rnd() * 6) | 0);
  }
  g.fillStyle = body;
  extents.forEach(([a, b], i) => {
    g.fillRect(a, c.height - 2 - (i + 1) * 3, b - a, 3);
  });
  g.fillStyle = shade;
  g.fillRect(extents[0][0] + 2, c.height - 2, extents[0][1] - extents[0][0] - 4, 2);
  return c;
}

function bakeIsland(seed) {
  const rnd = lcg(seed);
  const w = 44 + ((rnd() * 26) | 0);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = 18;
  const g = c.getContext('2d');
  g.fillStyle = '#8fc186';                     // grass slab
  g.fillRect(2, 3, w - 4, 4);
  g.fillStyle = '#a5d19a';                     // top highlight
  g.fillRect(4, 2, w - 8, 1);
  g.fillStyle = '#9a8a6a';                     // rocky underside, tapering
  g.fillRect(5, 7, w - 10, 4);
  g.fillRect(10, 11, w - 20, 4);
  g.fillRect((w / 2 - 5) | 0, 15, 10, 3);
  return c;
}

// bake a pre-scaled copy of an already-baked sprite so the downscale is frozen
// once (rather than re-run every frame by a scaled runtime drawImage).
function bakeScaled(src, sx, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, (src.width * sx) | 0);
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// overgrown jungle ruin: broken columns + a collapsed wall, moss-capped
function bakeRuin(seed) {
  const rnd = lcg(seed);
  const c = document.createElement('canvas');
  c.width = 72;
  c.height = 40;
  const g = c.getContext('2d');
  g.fillStyle = '#3a4a34';
  const h1 = 22 + ((rnd() * 12) | 0);
  g.fillRect(4, 40 - h1, 8, h1);              // broken column
  g.fillRect(2, 40 - h1 - 3, 12, 3);
  const h2 = 14 + ((rnd() * 8) | 0);
  g.fillRect(22, 40 - h2, 26, h2);            // collapsed wall
  g.fillRect(26, 40 - h2 - 6, 10, 6);
  g.fillRect(56, 40 - 16, 7, 16);             // stump column
  g.fillStyle = '#2a3826';                    // cracked shading
  g.fillRect(24, 40 - h2 + 4, 3, h2 - 4);
  g.fillRect(38, 40 - 6, 6, 6);
  g.fillStyle = '#2f6b3e';                    // moss creeping over the tops
  g.fillRect(2, 40 - h1 - 4, 9, 2);
  g.fillRect(26, 40 - h2 - 7, 12, 2);
  g.fillRect(44, 40 - h2, 4, 5);
  return c;
}

const BG = {
  clouds: [0, 1, 2, 3].map(i => bakeCloud(i * 131 + 7, '#ffffff', '#dce8f4')),
  cloudsBig: [0, 1, 2].map(i => bakeCloud(i * 271 + 31, '#ffffff', '#d2e0ee', true)),
  cloudsPale: [0, 1, 2, 3].map(i => bakeCloud(i * 173 + 59, '#dcecf8', '#c4d8ea')),
  islands: [0, 1, 2].map(i => bakeIsland(i * 419 + 11)),
  // pre-scaled tiny variants for the deepest horizon layer — baked once so the
  // downscale can't "boil" (a runtime scaled drawImage re-decimates every frame
  // as the layer scrolls, shifting which source pixels survive).
  islandsFar: [0, 1, 2].map(i => bakeScaled(bakeIsland(i * 419 + 11), 0.55, 10)),
  ruins: [0, 1].map(i => bakeRuin(i * 613 + 29)),
};

// How much of the camera's vertical travel the backdrop takes, in tall levels.
const BG_PARALLAX_Y = 0.35;
// Each world's sky, indexed like WORLDS. Matches the top stop of that world's
// background gradient (or its flat fill, for the two unlit worlds); it fills in
// above the backdrop once vertical parallax shifts it down.
const SKY_TOP = [
  '#7ec8f0', // meadows
  '#0c0e1a', // caverns
  '#3a7ac8', // sky
  '#020604', // cyber
  '#1a0a10', // keep
  '#1c5a3a', // jungle
  '#2a6aa8', // depths
];

// deterministic wrap-around scroll position
function scrollX(base, offset, span) {
  return ((base - offset) % span + span) % span - 100;
}

// terraced pixel-art hills: quantized steps + a lighter top cap
function drawHills(g, camX, parallax, colors, baseH, amp1, freq1, amp2, freq2, phase) {
  const off = Math.round(camX * parallax);
  for (let x = 0; x < VIEW_W; x += 4) {
    const wx = x + off;
    let h = baseH + Math.sin(wx * freq1 + phase) * amp1 + Math.sin(wx * freq2 + phase * 2 + 2) * amp2;
    h = Math.max(6, Math.round(h / 3) * 3);
    g.fillStyle = colors[0];
    g.fillRect(x, VIEW_H - h, 4, h);
    g.fillStyle = colors[1];
    g.fillRect(x, VIEW_H - h, 4, 2);
  }
}

// (x, y) is the top-left of the ground tile the decoration sits on.
function drawDecorItem(g, d, x, y, time) {
  switch (d.type) {
    case 'flower': {
      g.fillStyle = '#3f8f34';
      g.fillRect(x + 7, y - 5, 1, 5);
      g.fillStyle = ['#e0559a', '#ffd23e', '#f4f7ff'][d.v];
      g.fillRect(x + 5, y - 8, 5, 3);
      g.fillRect(x + 6, y - 9, 3, 5);
      g.fillStyle = '#ffe14a';
      g.fillRect(x + 7, y - 7, 1, 1);
      break;
    }
    case 'tuft': {
      g.fillStyle = d.v === 0 ? '#4a8f3c' : '#5aa848';
      g.fillRect(x + 3, y - 3, 1, 3); g.fillRect(x + 6, y - 4, 1, 4);
      g.fillRect(x + 9, y - 2, 1, 2); g.fillRect(x + 12, y - 4, 1, 4);
      break;
    }
    case 'bush': {
      g.fillStyle = '#3f8f34';
      g.fillRect(x + 1, y - 6, 14, 6); g.fillRect(x + 3, y - 8, 10, 3);
      g.fillStyle = '#4fae44';
      g.fillRect(x + 2, y - 7, 4, 3); g.fillRect(x + 8, y - 6, 4, 2);
      g.fillStyle = '#2f6b26';
      g.fillRect(x + 5, y - 4, 2, 2); g.fillRect(x + 11, y - 3, 2, 2);
      break;
    }
    case 'fence': {
      g.fillStyle = '#9a7a4a';
      g.fillRect(x + 2, y - 10, 2, 10); g.fillRect(x + 12, y - 10, 2, 10);
      g.fillStyle = '#b98648';
      g.fillRect(x, y - 8, 16, 2); g.fillRect(x, y - 4, 16, 2);
      break;
    }
    case 'butterfly': {
      const bx = Math.round(x + 8 + Math.sin(time * 0.03 + d.ph) * 8);
      const by = Math.round(y - 16 + Math.sin(time * 0.045 + d.ph * 2) * 5);
      const open = (((time / 8) | 0) + d.v) % 2 === 0;
      g.fillStyle = ['#ff8ac2', '#8ac6ff', '#ffd23e'][d.v];
      if (open) { g.fillRect(bx - 2, by, 2, 2); g.fillRect(bx + 1, by, 2, 2); }
      else { g.fillRect(bx - 1, by - 1, 1, 2); g.fillRect(bx + 1, by - 1, 1, 2); }
      g.fillStyle = '#20242c';
      g.fillRect(bx, by, 1, 2);
      break;
    }
    case 'stalagmite': {
      g.fillStyle = '#5c6880';
      g.fillRect(x + 5, y - 3, 6, 3); g.fillRect(x + 6, y - 6, 4, 3); g.fillRect(x + 7, y - 9, 2, 3);
      g.fillStyle = '#8a9ec4';
      g.fillRect(x + 6, y - 6, 1, 5);
      break;
    }
    case 'crystal': {
      g.globalAlpha = 0.55 + Math.sin(time * 0.05 + d.ph) * 0.3;
      g.fillStyle = ['#7a6cff', '#4affd7', '#b48cff'][d.v];
      g.fillRect(x + 4, y - 6, 3, 6); g.fillRect(x + 8, y - 9, 3, 9); g.fillRect(x + 12, y - 4, 2, 4);
      g.globalAlpha = 1;
      g.fillStyle = '#fff';
      g.fillRect(x + 9, y - 8, 1, 2);
      break;
    }
    case 'mushroom': {
      g.fillStyle = '#d9c8a0';
      g.fillRect(x + 6, y - 4, 2, 4);
      g.fillStyle = ['#7a6cff', '#4a9e3c', '#c05a3a'][d.v];
      g.fillRect(x + 4, y - 7, 6, 3);
      g.fillStyle = '#fff';
      g.fillRect(x + 5, y - 6, 1, 1); g.fillRect(x + 8, y - 6, 1, 1);
      break;
    }
    case 'cloudtuft': {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(x + 2, y - 3, 12, 3); g.fillRect(x + 4, y - 5, 7, 2);
      break;
    }
    case 'led': {
      const on = (((time / 30) | 0) + d.v) % 2 === 0;
      g.fillStyle = '#22303e';
      g.fillRect(x + 6, y - 4, 4, 4);
      g.fillStyle = on ? '#39ff7a' : '#0a4a22';
      g.fillRect(x + 7, y - 3, 2, 2);
      break;
    }
    case 'cable': {
      g.fillStyle = '#22303e';
      g.fillRect(x, y - 2, 6, 2); g.fillRect(x + 5, y - 4, 2, 3); g.fillRect(x + 6, y - 5, 8, 2);
      g.fillStyle = '#39ff7a';
      g.fillRect(x + 13, y - 5, 1, 1);
      break;
    }
    case 'antenna': {
      g.fillStyle = '#6b7382';
      g.fillRect(x + 8, y - 10, 1, 10);
      g.fillStyle = (((time / 40) | 0) + d.v) % 2 ? '#ff3344' : '#8a1c26';
      g.fillRect(x + 7, y - 12, 3, 3);
      break;
    }
    case 'torch': {
      g.fillStyle = '#7a4c22';
      g.fillRect(x + 7, y - 8, 2, 8);
      const f = (((time / 6) | 0) + d.v) % 2;
      g.fillStyle = f ? '#ffe14a' : '#ff8c1a';
      g.fillRect(x + 6, y - 12, 4, 4);
      g.fillStyle = f ? '#ff8c1a' : '#e33e1c';
      g.fillRect(x + 7, y - 13, 2, 2);
      break;
    }
    case 'rubble': {
      g.fillStyle = '#40202a';
      g.fillRect(x + 2, y - 2, 4, 2); g.fillRect(x + 8, y - 3, 5, 3); g.fillRect(x + 5, y - 1, 3, 1);
      g.fillStyle = '#744048';
      g.fillRect(x + 9, y - 2, 2, 1);
      break;
    }
    case 'chain': {
      const len = 10 + d.v * 6;
      g.fillStyle = '#5c6470';
      for (let i = 0; i < len; i += 3) g.fillRect(x + 7 + ((i / 3) % 2), y + i, 2, 2);
      break;
    }
    case 'fern': {
      // fanned fronds sprouting from the ground
      g.fillStyle = '#2f8a44';
      g.fillRect(x + 7, y - 4, 2, 4);
      g.fillStyle = '#4ec26a';
      for (const dxo of [-5, -2, 2, 5]) {
        const th = 5 + ((Math.abs(dxo) === 5 ? 0 : 3));
        g.fillRect(x + 8 + dxo, y - th, 1, th);
        g.fillRect(x + 8 + (dxo > 0 ? dxo - 1 : dxo + 1), y - th, 1, 2);
      }
      g.fillStyle = '#8ad98a';
      g.fillRect(x + 8, y - 9, 1, 2);
      break;
    }
    case 'idol': {
      // small carved serpent statuette on the ground
      g.fillStyle = '#8a9a6a';
      g.fillRect(x + 4, y - 3, 8, 3);
      g.fillRect(x + 5, y - 8, 6, 5);
      g.fillStyle = '#1fb8a6';
      g.fillRect(x + 6, y - 7, 4, 3);
      g.fillStyle = '#e0a838';
      g.fillRect(x + 6, y - 8, 4, 1);
      g.fillStyle = '#c0392b';
      g.fillRect(x + 7, y - 5, 2, 1);
      break;
    }
    case 'firefly': {
      const fx = Math.round(x + 8 + Math.sin(time * 0.035 + d.ph) * 9);
      const fy = Math.round(y - 14 + Math.sin(time * 0.05 + d.ph * 2) * 6);
      const on = Math.sin(time * 0.12 + d.ph) > -0.2;
      if (on) {
        g.globalAlpha = 0.5 + Math.sin(time * 0.12 + d.ph) * 0.4;
        g.fillStyle = '#eaff7a';
        g.fillRect(fx - 1, fy - 1, 3, 3);
        g.globalAlpha = 1;
        g.fillStyle = '#fffbc0';
        g.fillRect(fx, fy, 1, 1);
      }
      break;
    }
    case 'hangvine': {
      const len = 12 + d.v * 7;
      const sway = Math.sin(time * 0.03 + d.ph) * 2;
      g.fillStyle = '#2f8a44';
      for (let i = 0; i < len; i += 2) {
        g.fillRect(x + 7 + Math.round(sway * (i / len)), y + i, 2, 2);
      }
      g.fillStyle = '#4ec26a';
      g.fillRect(x + 5 + Math.round(sway), y + len - 2, 6, 3);
      break;
    }
    case 'seaweed': {
      const len = 8 + d.v * 5;
      g.fillStyle = d.v === 0 ? '#2a9a86' : '#1f7a6a';
      for (let i = 0; i < len; i += 2) {
        const sway = Math.sin(time * 0.04 + d.ph + i * 0.3) * (i / len) * 3;
        g.fillRect(x + 6 + Math.round(sway), y - i - 2, 2, 2);
      }
      break;
    }
    case 'coral': {
      g.fillStyle = ['#d44a6a', '#e8a13c', '#d48ae8'][d.v];
      g.fillRect(x + 4, y - 5, 3, 5); g.fillRect(x + 9, y - 8, 3, 8);
      g.fillRect(x + 2, y - 3, 2, 3); g.fillRect(x + 12, y - 4, 2, 4);
      g.fillStyle = '#fff';
      g.fillRect(x + 10, y - 7, 1, 1);
      break;
    }
    case 'shell': {
      g.fillStyle = '#f4d4b8';
      g.fillRect(x + 5, y - 4, 6, 4);
      g.fillStyle = '#e0a888';
      g.fillRect(x + 7, y - 4, 1, 4); g.fillRect(x + 9, y - 3, 1, 3);
      break;
    }
  }
}

function lcg(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export class Level {
  constructor(def, worldIdx, levelIdx) {
    this.def = def;
    this.world = worldIdx;
    this.levelIdx = levelIdx;
    this.meta = def.meta || {};

    const rows = def.map;
    this.h = rows.length;
    this.w = Math.max(...rows.map(r => r.length));
    this.pxWidth = this.w * TILE;
    this.pxHeight = this.h * TILE;
    this.tiles = new Uint8Array(this.w * this.h);
    this.contents = new Map(); // "tx,ty" -> content string
    this.spawns = [];
    this.playerStart = { x: 2 * TILE, y: 2 * TILE };

    for (let ty = 0; ty < this.h; ty++) {
      const row = rows[ty];
      for (let tx = 0; tx < row.length; tx++) {
        const ch = row[tx];
        if (ch === '.' || ch === ' ') continue;
        if (TILE_CHARS[ch] !== undefined) {
          this.tiles[ty * this.w + tx] = TILE_CHARS[ch];
        } else if (BLOCK_CHARS[ch]) {
          this.tiles[ty * this.w + tx] = BLOCK_CHARS[ch].tile;
          this.contents.set(`${tx},${ty}`, BLOCK_CHARS[ch].content);
        } else if (SPAWN_CHARS.has(ch)) {
          const x = tx * TILE, y = ty * TILE;
          if (ch === 'P') this.playerStart = { x, y };
          else this.spawns.push({ type: ch, x, y });
        }
      }
    }

    this.time = 0;
    this.matrixCols = null; // lazily built for cyber world
    this.decor = this.buildDecor();
  }

  // Non-interactive scenery seeded deterministically onto walkable surfaces.
  buildDecor() {
    const rnd = lcg(this.world * 977 + this.levelIdx * 131 + 7);
    const decor = [];
    const tables = [
      ['flower', 'flower', 'tuft', 'tuft', 'bush', 'fence', 'butterfly', 'tuft'],
      ['crystal', 'stalagmite', 'mushroom', 'crystal'],
      ['cloudtuft', 'flower', 'cloudtuft'],
      ['led', 'cable', 'antenna'],
      ['torch', 'rubble', 'torch'],
      ['fern', 'fern', 'idol', 'firefly', 'fern', 'mushroom'],
      ['seaweed', 'coral', 'seaweed', 'shell', 'coral'],
    ];
    const density = [0.5, 0.34, 0.3, 0.32, 0.3, 0.5, 0.45][this.world];
    const table = tables[this.world];
    for (let tx = 0; tx < this.w; tx++) {
      for (let ty = 1; ty < this.h; ty++) {
        if (this.tileAt(tx, ty) === T_GROUND && this.tileAt(tx, ty - 1) === T_EMPTY && rnd() < density) {
          decor.push({
            x: tx * TILE, y: ty * TILE,
            type: table[(rnd() * table.length) | 0],
            v: (rnd() * 3) | 0, ph: rnd() * Math.PI * 2,
          });
        }
      }
    }
    // molten keep: chains hanging from brick ceilings
    if (this.world === 4) {
      for (let tx = 0; tx < this.w; tx++) {
        if (this.tileAt(tx, 1) === T_BRICK && this.tileAt(tx, 2) === T_EMPTY && rnd() < 0.09) {
          decor.push({ x: tx * TILE, y: 2 * TILE, type: 'chain', v: (rnd() * 3) | 0, ph: 0 });
        }
      }
    }
    // jungle ruins: vines dangling from brick ceilings
    if (this.world === 5) {
      for (let tx = 0; tx < this.w; tx++) {
        if (this.tileAt(tx, 1) === T_BRICK && this.tileAt(tx, 2) === T_EMPTY && rnd() < 0.14) {
          decor.push({ x: tx * TILE, y: 2 * TILE, type: 'hangvine', v: (rnd() * 3) | 0, ph: rnd() * Math.PI * 2 });
        }
      }
    }
    return decor;
  }

  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.w) return T_GROUND; // solid side walls
    if (ty < 0 || ty >= this.h) return T_EMPTY;
    return this.tiles[ty * this.w + tx];
  }

  setTile(tx, ty, t) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
    this.tiles[ty * this.w + tx] = t;
  }

  // Player bumped a tile from below. Returns what happened.
  bumpTile(tx, ty, power) {
    const t = this.tileAt(tx, ty);
    const key = `${tx},${ty}`;
    if (t === T_QBLOCK || t === T_GLITCHBLOCK || (t === T_BRICK && this.contents.has(key))) {
      const content = this.contents.get(key) || 'coin';
      this.contents.delete(key);
      this.setTile(tx, ty, T_USED);
      return { type: content, tx, ty };
    }
    if (t === T_BRICK) {
      if (power !== 'small') {
        this.setTile(tx, ty, T_EMPTY);
        return { type: 'break', tx, ty };
      }
      return { type: 'bump', tx, ty };
    }
    return null;
  }

  // Does entity bbox touch a harmful tile? Returns 'spike'|'lava'|null.
  hazardAt(e) {
    const tx0 = Math.floor(e.x / TILE), tx1 = Math.floor((e.x + e.w - 1) / TILE);
    const ty0 = Math.floor(e.y / TILE), ty1 = Math.floor((e.y + e.h - 1) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = this.tileAt(tx, ty);
        if (t === T_LAVA) return 'lava';
        // spikes only occupy the bottom 10px of their tile
        if (t === T_SPIKE && e.y + e.h > ty * TILE + 6) return 'spike';
      }
    }
    return null;
  }

  // Y of the first standable surface at or below `fromY`, at world-x `x`.
  // Falls back to the bottom of the level if there's nothing to stand on.
  //
  // Bosses use this to place ground-anchored attacks (erupting columns, floor
  // beams, dive-crash checks). They all used to hardcode `pxHeight - 3 * TILE`
  // instead — an unwritten, unenforced invariant that every arena's floor sits
  // at exactly tile row 12, which is *why* every arena is a flat 48x15 box.
  // Give an arena a terrace with that hardcode in place and the flame pillars
  // erupt out of thin air.
  //
  // `fromY` is required, and must be a point already in open space — typically
  // the querying entity's own y. Nearly every arena is roofed with brick, so
  // scanning from 0 would find the *ceiling* and anchor the attack to the sky.
  floorYAt(x, fromY) {
    const tx = Math.floor(x / TILE);
    if (tx < 0 || tx >= this.w) return this.pxHeight;
    for (let ty = Math.max(0, Math.floor(fromY / TILE)); ty < this.h; ty++) {
      const t = this.tileAt(tx, ty);
      if (SOLID_TILES.has(t) || t === T_PLATFORM) return ty * TILE;
    }
    return this.pxHeight;
  }

  update() {
    this.time++;
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------
  draw(g, cam) {
    const sk = skin(this.world);
    const ox = cam.ox(), oy = cam.oy();

    // scenery first, so grass fringes overlap stems (grounded look)
    for (const d of this.decor) {
      if (d.x < ox - 32 || d.x > ox + VIEW_W + 32) continue;
      drawDecorItem(g, d, d.x - ox, d.y - oy, this.time);
    }

    const tx0 = Math.max(0, Math.floor(ox / TILE));
    const tx1 = Math.min(this.w - 1, Math.floor((ox + VIEW_W) / TILE));
    const ty0 = Math.max(0, Math.floor(oy / TILE));
    const ty1 = Math.min(this.h - 1, Math.floor((oy + VIEW_H) / TILE));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = this.tiles[ty * this.w + tx];
        if (t === T_EMPTY) continue;
        const px = tx * TILE - ox, py = ty * TILE - oy;
        if (t === T_GROUND) {
          const v = (tx * 7 + ty * 13) % 3;
          if (this.tileAt(tx, ty - 1) === T_EMPTY) g.drawImage(sk.groundTop[v], px, py - 3);
          else g.drawImage(sk.ground[v], px, py);
          continue;
        }
        g.drawImage(sk[t], px, py);
        if (t === T_LAVA) {
          // animated lava surface
          const glow = Math.sin(this.time * 0.08 + tx) > 0.3;
          if (glow) {
            g.fillStyle = '#ffe14a';
            g.fillRect(px + ((this.time / 8 + tx * 5) % 12) | 0, py, 3, 2);
          }
        }
      }
    }
  }

  drawBackground(g, cam) {
    const w = this.world;
    // Snap the camera to whole pixels for background parallax: the scene is a
    // low-res buffer scaled up nearest-neighbor, so a fractional camera makes
    // background edges crawl/shimmer. The bg* helpers only read cam.x.
    const c = { x: Math.round(cam.x) };
    g.imageSmoothingEnabled = false;

    // Vertical parallax for levels taller than the view.
    //
    // Every bg* helper is written in screen space against VIEW_H — the backdrop
    // is a frame around the view, not a thing at a world position — so rather
    // than thread y through ~500 lines of them, the whole backdrop is shifted
    // and the strip it uncovers is painted with that world's sky.
    //
    // Anchored at the *bottom* of the level: there, offset is 0 and the
    // backdrop is exactly what it has always been, so every one-screen-tall
    // level renders bit-for-bit unchanged. Climbing pushes the horizon down and
    // opens up sky above it, which is the way round that reads as height.
    const scrollY = Math.max(0, this.pxHeight - VIEW_H);
    const oy = scrollY > 0
      ? Math.round((scrollY - Math.max(0, Math.min(cam.y, scrollY))) * BG_PARALLAX_Y)
      : 0;

    if (oy > 0) {
      g.fillStyle = SKY_TOP[w];
      g.fillRect(0, 0, VIEW_W, oy);
      g.save();
      g.translate(0, oy);
    }

    if (w === 0) this.bgMeadows(g, c);
    else if (w === 1) this.bgCaverns(g, c);
    else if (w === 2) this.bgSky(g, c);
    else if (w === 3) this.bgCyber(g, c);
    else if (w === 4) this.bgKeep(g, c);
    else if (w === 5) this.bgJungle(g, c);
    else this.bgWater(g, c);

    if (oy > 0) g.restore();
  }

  bgMeadows(g, cam) {
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#7ec8f0');
    grad.addColorStop(1, '#c8ecff');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    // sun
    g.fillStyle = '#fff2a0';
    g.fillRect(264, 24, 20, 20);
    g.fillStyle = '#ffe14a';
    g.fillRect(266, 26, 16, 16);
    // faint rays fanning down from the sun
    g.globalAlpha = 0.05 + Math.sin(this.time * 0.015) * 0.02;
    g.fillStyle = '#fff2a0';
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(270 + i * 5, 40);
      g.lineTo(276 + i * 5, 40);
      g.lineTo(160 + i * 46, VIEW_H);
      g.lineTo(130 + i * 46, VIEW_H);
      g.fill();
    }
    g.globalAlpha = 1;
    // clouds (baked opaque sprites)
    for (let i = 0; i < 5; i++) {
      const spr = BG.clouds[i % BG.clouds.length];
      const cx = scrollX(i * 103 + 40, cam.x * 0.2 - this.time * 0.05, VIEW_W + 140);
      g.drawImage(spr, Math.round(cx), 14 + ((i * 37) % 62));
    }
    // birds gliding by
    g.fillStyle = '#3a4a5c';
    for (let i = 0; i < 3; i++) {
      const bx = Math.round(((this.time * (0.4 + i * 0.15) + i * 140) % (VIEW_W + 60)) - 30);
      const by = Math.round(28 + i * 20 + Math.sin(this.time * 0.05 + i * 2) * 4);
      const flap = (((this.time / 9) | 0) + i) % 2 ? -1 : 1;
      g.fillRect(bx, by, 2, 1); g.fillRect(bx + 3, by, 2, 1);
      g.fillRect(bx + 1, by + flap, 1, 1); g.fillRect(bx + 4, by + flap, 1, 1);
    }
    // far hills (hazy, terraced)
    drawHills(g, cam.x, 0.3, ['#7cbb8e', '#92cfa2'], 58, 24, 0.01, 12, 0.023, 0);
    // tree line
    const tp = cam.x * 0.45;
    for (let ix = Math.floor(tp / 56) - 1; ix <= Math.floor((tp + VIEW_W) / 56) + 1; ix++) {
      const x = ix * 56 - tp;
      const hvar = ((ix * 37) % 11 + 11) % 11;
      const baseY = VIEW_H - 46 - hvar;
      g.fillStyle = '#5c4326';
      g.fillRect(x + 10, baseY + 14, 4, 20);
      g.fillStyle = '#3f8f34';
      g.fillRect(x, baseY, 24, 16);
      g.fillRect(x + 4, baseY - 8, 16, 10);
      g.fillStyle = '#4fae44';
      g.fillRect(x + 3, baseY - 5, 8, 6);
    }
    // near hills (terraced with highlight cap)
    drawHills(g, cam.x, 0.55, ['#4a8f3c', '#5fae4d'], 34, 18, 0.017, 8, 0.031, 5);
    // nearest hill rim, a shade darker for depth
    drawHills(g, cam.x, 0.75, ['#3a7830', '#478a3a'], 16, 9, 0.026, 5, 0.041, 9);
    // cloud shadows sweeping the ground line (drift matches cloud speed)
    g.fillStyle = 'rgba(20,50,30,0.12)';
    for (let i = 0; i < 3; i++) {
      const sx = scrollX(i * 151 + 60, cam.x * 0.55 - this.time * 0.05, VIEW_W + 200);
      g.fillRect(Math.round(sx), VIEW_H - 24 + ((i * 7) % 10), 84 + i * 14, 7);
    }
  }

  bgCaverns(g, cam) {
    g.fillStyle = '#0c0e1a';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    // far stalactite row, barely lighter than the void
    g.fillStyle = '#111428';
    for (let x = 0; x < VIEW_W; x += 8) {
      const wx = x + cam.x * 0.25;
      const h = 34 + Math.abs(Math.sin(wx * 0.028 + 1.3)) * 26;
      g.fillRect(x, 0, 8, h);
    }
    const rnd = lcg(99 + this.levelIdx);
    // glinting crystals
    for (let i = 0; i < 26; i++) {
      const cx = Math.round(((rnd() * 800 - cam.x * 0.35) % 400 + 400) % 400 - 40);
      const cy = Math.round(rnd() * VIEW_H);
      const tw = Math.sin(this.time * 0.05 + i * 1.7);
      const cols = ['#4a3f7a', '#5c4f96', '#7a6cff'];
      g.fillStyle = cols[(i % 3)];
      const s = 2 + (i % 3);
      g.globalAlpha = 0.5 + tw * 0.3;
      g.fillRect(cx, cy, s, s * 2);
      g.fillRect(cx - (s >> 1), cy + (s >> 1), s * 2, s);
      g.globalAlpha = 1;
    }
    // stalactite silhouettes
    g.fillStyle = '#141830';
    for (let x = 0; x < VIEW_W; x += 8) {
      const wx = x + cam.x * 0.5;
      const h = 20 + Math.abs(Math.sin(wx * 0.05)) * 30;
      g.fillRect(x, 0, 8, h);
    }
    // floor stalagmite silhouettes
    for (let x = 0; x < VIEW_W; x += 8) {
      const wx = x + cam.x * 0.5;
      const h = 10 + Math.abs(Math.sin(wx * 0.043 + 3)) * 24;
      g.fillRect(x, VIEW_H - h, 8, h);
    }
    // rare one-frame white glints on the crystal field
    const grnd = lcg(41 + this.levelIdx);
    g.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) {
      const gx = (((grnd() * 800 - cam.x * 0.35) % 400 + 400) % 400 - 40) | 0;
      const gy = (grnd() * VIEW_H) | 0;
      if ((this.time + i * 47) % 160 < 3) {
        g.fillRect(gx, gy - 1, 1, 3);
        g.fillRect(gx - 1, gy, 3, 1);
      }
    }
    // water drips: a drop falls from a stalactite every few seconds, then splashes
    g.fillStyle = '#8ac6ff';
    for (let i = 0; i < 2; i++) {
      const sx = (((i * 213 + 90 - cam.x * 0.5) % (VIEW_W + 40) + VIEW_W + 40) % (VIEW_W + 40) - 20) | 0;
      const h = 20 + Math.abs(Math.sin((sx + cam.x * 0.5) * 0.05)) * 30; // matches stalactite length
      const t = (this.time + i * 83) % 190;
      if (t < 36) {
        const dy = h + (t / 36) * (t / 36) * (VIEW_H - 14 - h);
        g.fillRect(sx, dy | 0, 1, 2);
      } else if (t < 42) {
        g.fillRect(sx - 2, VIEW_H - 14, 1, 1);
        g.fillRect(sx + 2, VIEW_H - 14, 1, 1);
      }
    }
  }

  bgSky(g, cam) {
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#3a7ac8');
    grad.addColorStop(1, '#a8dcf8');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    // soft god-rays slanting from above
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const sx = ((i * 92 - cam.x * 0.1) % (VIEW_W + 120) + VIEW_W + 120) % (VIEW_W + 120) - 60;
      g.globalAlpha = 0.045 + Math.sin(this.time * 0.018 + i * 1.7) * 0.02;
      g.beginPath();
      g.moveTo(sx, 0); g.lineTo(sx + 28, 0);
      g.lineTo(sx + 62, VIEW_H); g.lineTo(sx + 24, VIEW_H);
      g.fill();
    }
    g.globalAlpha = 1;
    // tiny far islands on the horizon haze (deepest layer)
    for (let i = 0; i < 3; i++) {
      const spr = BG.islandsFar[i % BG.islandsFar.length];
      const cx = scrollX(i * 149 + 90, cam.x * 0.2, VIEW_W + 180);
      g.drawImage(spr, Math.round(cx), 44 + ((i * 47) % 56));
    }
    // far cloud sea (pale baked sprites)
    for (let i = 0; i < 7; i++) {
      const spr = BG.cloudsPale[i % BG.cloudsPale.length];
      const cx = scrollX(i * 89 + 20, cam.x * 0.25 - this.time * 0.08, VIEW_W + 140);
      g.drawImage(spr, Math.round(cx), 26 + ((i * 53) % 140));
    }
    // distant floating islands
    for (let i = 0; i < 4; i++) {
      const spr = BG.islands[i % BG.islands.length];
      const cx = scrollX(i * 137 + 60, cam.x * 0.4, VIEW_W + 160);
      g.drawImage(spr, Math.round(cx), 56 + ((i * 61) % 110));
    }
    // near cloud sea drifting below
    for (let i = 0; i < 5; i++) {
      const spr = BG.cloudsBig[i % BG.cloudsBig.length];
      const cx = scrollX(i * 121 + 30, cam.x * 0.55 - this.time * 0.25, VIEW_W + 160);
      g.drawImage(spr, Math.round(cx), 182 + ((i * 43) % 44));
    }
    // rolling cloud sea lapping along the bottom edge
    for (let x = 0; x < VIEW_W; x += 4) {
      const wx = x + cam.x * 0.6;
      const h = 12 + Math.sin(wx * 0.028 + this.time * 0.012) * 4
        + Math.sin(wx * 0.011 - this.time * 0.007) * 5;
      g.fillStyle = '#f2f9ff';
      g.fillRect(x, VIEW_H - h, 4, h);
      g.fillStyle = '#ffffff';
      g.fillRect(x, VIEW_H - h, 4, 2);
    }
  }

  bgCyber(g, cam) {
    g.fillStyle = '#020604';
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    // far data columns: dim pixel trickles behind the glyph rain
    const crnd = lcg(77);
    g.fillStyle = 'rgba(24,96,48,0.55)';
    for (let i = 0; i < 12; i++) {
      const colx = (((crnd() * 600 - cam.x * 0.15) % (VIEW_W + 40) + VIEW_W + 40) % (VIEW_W + 40) - 20) | 0;
      const off = crnd() * 200;
      const spd = 0.2 + crnd() * 0.3;
      for (let j = 0; j < 4; j++) {
        const py = ((this.time * spd + off + j * 34) % (VIEW_H + 20)) - 10;
        g.fillRect(colx, py | 0, 2, 2);
      }
    }
    // matrix glyph rain
    if (!this.matrixCols) {
      this.matrixCols = [];
      const rnd = lcg(1337);
      for (let i = 0; i < 40; i++) {
        this.matrixCols.push({ x: i * 8, y: rnd() * VIEW_H, speed: 0.4 + rnd() * 1.4, len: 4 + (rnd() * 8 | 0), seed: rnd() * 1000 });
      }
    }
    // Characters restricted to the game's own pixel font (src/sprites.js) so
    // this renders with hard-edged fillRects, not anti-aliased canvas text.
    const CHARS = '01<>/+?x:.';
    for (const col of this.matrixCols) {
      col.y += col.speed;
      if (col.y - col.len * 8 > VIEW_H) col.y = -8;
      for (let i = 0; i < col.len; i++) {
        const cy = Math.round(col.y - i * 8);
        if (cy < -8 || cy > VIEW_H) continue;
        const ch = CHARS[((col.seed + i * 7 + ((this.time / 12) | 0)) | 0) % CHARS.length];
        const alpha = i === 0 ? 0.9 : 0.5 * (1 - i / col.len);
        g.globalAlpha = alpha;
        drawText(g, ch, col.x, cy, i === 0 ? '#c8ffdc' : '#39ff7a', 1);
      }
    }
    g.globalAlpha = 1;
    // perspective floor grid receding under the racks
    g.strokeStyle = 'rgba(57,255,122,0.14)';
    g.beginPath();
    const gy0 = VIEW_H - 22;
    const gshift = (cam.x * 0.35) % 28;
    for (let i = -6; i <= 6; i++) {
      g.moveTo(VIEW_W / 2 + i * 28 - gshift, gy0);
      g.lineTo(VIEW_W / 2 + (i * 28 - gshift) * 3.4, VIEW_H);
    }
    g.moveTo(0, gy0 + 0.5); g.lineTo(VIEW_W, gy0 + 0.5);
    g.moveTo(0, gy0 + 7.5); g.lineTo(VIEW_W, gy0 + 7.5);
    g.moveTo(0, gy0 + 16.5); g.lineTo(VIEW_W, gy0 + 16.5);
    g.stroke();
    // server rack silhouettes along the floor
    const rp = cam.x * 0.35;
    for (let ix = Math.floor(rp / 44) - 1; ix <= Math.floor((rp + VIEW_W) / 44) + 1; ix++) {
      const x = ix * 44 - rp;
      const h = 52 + ((ix * 23) % 17 + 17) % 17;
      g.fillStyle = '#08130c';
      g.fillRect(x, VIEW_H - h, 30, h);
      g.fillStyle = '#0e2416';
      g.fillRect(x + 2, VIEW_H - h + 2, 26, 3);
      for (let r = 0; r < 4; r++) {
        const on = (((this.time / 25) | 0) + ix + r) % 3 === 0;
        g.fillStyle = on ? '#39ff7a' : '#123a20';
        g.fillRect(x + 4 + r * 6, VIEW_H - h + 8, 2, 2);
      }
    }
    // faint horizontal scan glow
    const scanY = (this.time * 0.7) % VIEW_H;
    g.fillStyle = 'rgba(57,255,122,0.06)';
    g.fillRect(0, scanY, VIEW_W, 3);
  }

  bgKeep(g, cam) {
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#1a0a10');
    grad.addColorStop(1, '#4a1414');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    // castle silhouette with glowing window slits
    for (let x = -16; x < VIEW_W + 16; x += 48) {
      const wx = x - ((cam.x * 0.3) % 48);
      g.fillStyle = '#26080c';
      g.fillRect(wx, 90, 30, VIEW_H);
      g.fillRect(wx + 4, 78, 6, 14);
      g.fillRect(wx + 14, 78, 6, 14);
      g.fillRect(wx + 24, 78, 6, 14);
      const flicker = 0.35 + Math.sin(this.time * 0.07 + wx * 0.3) * 0.15;
      g.fillStyle = `rgba(255,140,26,${flicker.toFixed(2)})`;
      g.fillRect(wx + 8, 108, 3, 7);
      g.fillRect(wx + 19, 128, 3, 7);
      g.fillRect(wx + 13, 152, 3, 7);
    }
    // rising embers
    const rnd = lcg(500 + this.levelIdx);
    for (let i = 0; i < 18; i++) {
      const px = Math.round(((rnd() * 700 - cam.x * 0.5) % 380 + 380) % 380 - 30);
      const py = Math.round(VIEW_H - ((this.time * (0.3 + rnd() * 0.7) + rnd() * 400) % (VIEW_H + 20)));
      const flick = Math.sin(this.time * 0.2 + i * 2.4) > 0;
      g.fillStyle = flick ? '#ff8c1a' : '#e33e1c';
      g.fillRect(px, py, 2, 2);
    }
    // pulsing lava glow at the bottom, breathing slowly
    const pulse = 0.11 + Math.sin(this.time * 0.028) * 0.05;
    g.fillStyle = `rgba(255,90,30,${pulse.toFixed(3)})`;
    g.fillRect(0, VIEW_H - 40, VIEW_W, 40);
    g.fillStyle = `rgba(255,140,26,${(pulse * 0.7).toFixed(3)})`;
    g.fillRect(0, VIEW_H - 16, VIEW_W, 16);
    // heat shimmer: thin translucent strips wobbling sideways
    g.fillStyle = 'rgba(255,150,50,0.09)';
    for (let i = 0; i < 3; i++) {
      const wob = Math.round(Math.sin(this.time * 0.09 + i * 2.1) * 3);
      g.fillRect(wob - 4, VIEW_H - 32 + i * 9, VIEW_W + 8, 2);
    }
  }

  bgJungle(g, cam) {
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#1c5a3a');
    grad.addColorStop(0.55, '#2f7a48');
    grad.addColorStop(1, '#4a3a24');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    // dappled light shafts slanting through the canopy
    for (let i = 0; i < 5; i++) {
      const sx = ((i * 74 - cam.x * 0.15) % (VIEW_W + 120) + VIEW_W + 120) % (VIEW_W + 120) - 60;
      g.globalAlpha = 0.06 + Math.sin(this.time * 0.02 + i) * 0.02;
      g.fillStyle = '#eaffb0';
      g.beginPath();
      g.moveTo(sx, 0); g.lineTo(sx + 26, 0); g.lineTo(sx - 30, VIEW_H); g.lineTo(sx - 56, VIEW_H);
      g.fill();
    }
    g.globalAlpha = 1;

    // distant stepped pyramids with overgrown ruins between them (baked)
    const pp = cam.x * 0.25;
    // ground line for these props: aligned with the far canopy ridge
    // so their bases sit naturally on the terrain layer.
    const gy = VIEW_H - 48;
    for (let ix = Math.floor(pp / 220) - 1; ix <= Math.floor((pp + VIEW_W) / 220) + 1; ix++) {
      const px = ix * 220 - pp + 40;
      g.fillStyle = '#3a4a34';
      for (let s = 0; s < 5; s++) {
        const w = 90 - s * 16;
        g.fillRect(px + s * 8, gy - (12 + s * 12), w, 12);
      }
      g.fillRect(px, gy, 90, 60); // extend pyramid base down
      g.fillStyle = '#2a3826';
      g.fillRect(px + 34, gy - 68, 12, 8); // temple crown
      g.drawImage(BG.ruins[((ix % 2) + 2) % 2], px + 118, gy - 40);
      g.fillStyle = '#3a4a34';
      g.fillRect(px + 118, gy, 72, 60); // extend ruin base down
    }

    // far canopy silhouette (terraced leaf line)
    drawHills(g, cam.x, 0.35, ['#245c38', '#2f7346'], 70, 26, 0.012, 12, 0.026, 1);
    // mid canopy band, cooler teal for a third depth step
    drawHills(g, cam.x, 0.47, ['#1f6a4c', '#2a805c'], 50, 20, 0.015, 10, 0.03, 7);

    // low mist band drifting slowly through the mid-ground
    g.globalAlpha = 0.09 + Math.sin(this.time * 0.012) * 0.045;
    g.fillStyle = '#cfe8c0';
    g.fillRect(0, 152, VIEW_W, 13);
    const mx = (this.time * 0.14) % (VIEW_W + 160);
    g.fillRect(Math.round(mx) - 160, 148, 120, 20);
    g.fillRect(Math.round((mx * 0.7 + 150) % (VIEW_W + 160)) - 160, 155, 90, 11);
    g.globalAlpha = 1;

    // hanging leaf fronds from the top edge
    const lp = cam.x * 0.5;
    for (let ix = Math.floor(lp / 40) - 1; ix <= Math.floor((lp + VIEW_W) / 40) + 1; ix++) {
      const x = ix * 40 - lp;
      const h = 20 + ((ix * 29) % 13);
      g.fillStyle = '#1c4a2c';
      g.fillRect(x, 0, 22, h);
      g.fillStyle = '#2f6b3e';
      g.fillRect(x + 4, h - 4, 14, 6);
      g.fillRect(x + 8, h, 6, 5);
    }
    // long background vines swaying below the frond line (sparse)
    g.fillStyle = '#17402a';
    for (let ix = Math.floor(lp / 40) - 1; ix <= Math.floor((lp + VIEW_W) / 40) + 1; ix++) {
      if (((ix * 31) % 7 + 7) % 7 > 2) continue;
      const x = ix * 40 - lp + 10;
      const len = 26 + ((ix * 53) % 22 + 22) % 22;
      const ph = ix * 1.7;
      for (let iy = 0; iy < len; iy += 3) {
        const sway = Math.sin(this.time * 0.024 + ph) * 3 * (iy / len);
        g.fillRect(x + Math.round(sway), 16 + iy, 2, 3);
      }
    }

    // fireflies blinking in the dusky understory
    const frnd = lcg(910 + this.levelIdx);
    for (let i = 0; i < 6; i++) {
      const fx = ((frnd() * 700 - cam.x * 0.45) % 380 + 380) % 380 - 30;
      const fy = 118 + frnd() * 88;
      const blink = Math.sin(this.time * 0.045 + i * 2.3);
      if (blink > 0.2) {
        g.globalAlpha = (blink - 0.2) * 0.9;
        g.fillStyle = '#eaff7a';
        g.fillRect(fx | 0, (fy + Math.sin(this.time * 0.02 + i) * 4) | 0, 2, 2);
      }
    }
    g.globalAlpha = 1;

    // near canopy floor foliage
    drawHills(g, cam.x, 0.6, ['#1c4a2c', '#2f6b3e'], 30, 16, 0.02, 8, 0.033, 4);

    // drifting pollen / spores
    const rnd = lcg(600 + this.levelIdx);
    for (let i = 0; i < 16; i++) {
      const px = ((rnd() * 700 - cam.x * 0.5 + this.time * 0.2) % 380 + 380) % 380 - 30;
      const py = (rnd() * VIEW_H + Math.sin(this.time * 0.03 + i) * 6) % VIEW_H;
      g.fillStyle = i % 3 === 0 ? '#eaff7a' : 'rgba(200,240,160,0.5)';
      g.fillRect(px | 0, py | 0, 1, 1);
    }
  }

  bgWater(g, cam) {
    // depth gradient: pale surface light fading into the abyss
    const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#2a6aa8');
    grad.addColorStop(0.5, '#1c4a80');
    grad.addColorStop(1, '#0e2448');
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    // shafts of light wavering down from the surface
    for (let i = 0; i < 5; i++) {
      const sx = ((i * 78 - cam.x * 0.12) % (VIEW_W + 120) + VIEW_W + 120) % (VIEW_W + 120) - 60;
      const sway = Math.sin(this.time * 0.015 + i * 2) * 8;
      g.globalAlpha = 0.05 + Math.sin(this.time * 0.02 + i) * 0.025;
      g.fillStyle = '#bfe6ff';
      g.beginPath();
      g.moveTo(sx, 0); g.lineTo(sx + 22, 0);
      g.lineTo(sx + 8 + sway, VIEW_H); g.lineTo(sx - 20 + sway, VIEW_H);
      g.fill();
    }
    g.globalAlpha = 1;

    // sunken ruin silhouettes on the far seabed
    const rp = cam.x * 0.25;
    for (let ix = Math.floor(rp / 190) - 1; ix <= Math.floor((rp + VIEW_W) / 190) + 1; ix++) {
      const px = ix * 190 - rp + 30;
      g.fillStyle = '#152f52';
      g.fillRect(px, VIEW_H - 74, 10, 74);            // broken column
      g.fillRect(px - 3, VIEW_H - 78, 16, 5);
      g.fillRect(px + 42, VIEW_H - 46, 34, 46);       // collapsed wall
      g.fillRect(px + 48, VIEW_H - 56, 14, 10);
      g.fillRect(px + 104, VIEW_H - 60, 8, 60);       // leaning column
      g.fillRect(px + 100, VIEW_H - 64, 16, 5);
    }

    // fish silhouettes gliding past
    g.fillStyle = '#122a4c';
    for (let i = 0; i < 4; i++) {
      const dir = i % 2 ? 1 : -1;
      const fx = Math.round(((this.time * (0.3 + i * 0.12) * dir + i * 130) % (VIEW_W + 40) + VIEW_W + 40) % (VIEW_W + 40) - 20);
      const fy = Math.round(36 + i * 34 + Math.sin(this.time * 0.03 + i * 2) * 5);
      g.fillRect(fx, fy, 7, 3);
      g.fillRect(fx + (dir > 0 ? -3 : 7), fy, 3, 1);
      g.fillRect(fx + (dir > 0 ? -3 : 7), fy + 2, 3, 1);
    }

    // reef band along the bottom
    drawHills(g, cam.x, 0.4, ['#173a63', '#1f4a78'], 34, 16, 0.02, 8, 0.03, 2);

    // rising bubble columns
    const rnd = lcg(700 + this.levelIdx);
    for (let i = 0; i < 14; i++) {
      const bx = ((rnd() * 700 - cam.x * 0.5) % 380 + 380) % 380 - 30;
      const by = (VIEW_H + 20 - (this.time * (0.4 + rnd() * 0.4) + rnd() * 240) % (VIEW_H + 40));
      const wob = Math.sin(this.time * 0.06 + i) * 2;
      g.fillStyle = i % 3 === 0 ? 'rgba(223,244,255,0.8)' : 'rgba(160,210,255,0.4)';
      g.fillRect((bx + wob) | 0, by | 0, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
    }
  }
}
