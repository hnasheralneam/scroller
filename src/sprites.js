import { TILE, T_GROUND, T_BRICK, T_QBLOCK, T_USED, T_SPIKE, T_PLATFORM, T_LAVA, T_GLITCHBLOCK, T_PILLAR } from './constants.js';

// ---------------------------------------------------------------------------
// Sprite builder: ASCII rows + palette -> offscreen canvas.
// `outline` stamps the silhouette in dark ink at 4 offsets so sprites pop.
// ---------------------------------------------------------------------------
const OUTLINE_COLOR = '#1a1a24';

function rawSprite(rows, pal, scale) {
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      g.fillStyle = pal[ch] || '#f0f';
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return c;
}

export function makeSprite(rows, pal, scale = 1, outline = false) {
  const base = rawSprite(rows, pal, scale);
  if (!outline) return base;
  // silhouette in outline color
  const sil = document.createElement('canvas');
  sil.width = base.width; sil.height = base.height;
  const sg = sil.getContext('2d');
  sg.drawImage(base, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = OUTLINE_COLOR;
  sg.fillRect(0, 0, sil.width, sil.height);
  const out = document.createElement('canvas');
  out.width = base.width + 2 * scale;
  out.height = base.height + 2 * scale;
  const g = out.getContext('2d');
  for (const [dx, dy] of [[0, scale], [2 * scale, scale], [scale, 0], [scale, 2 * scale]]) {
    g.drawImage(sil, dx, dy);
  }
  g.drawImage(base, scale, scale);
  return out;
}

export function flipH(src) {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d');
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

// A facing pair {r, l} from right-facing art. Characters get outlines.
function pair(rows, pal, scale = 1, outline = true) {
  const r = makeSprite(rows, pal, scale, outline);
  return { r, l: flipH(r) };
}

// ---------------------------------------------------------------------------
// Pixel font (3x5), uppercase
// ---------------------------------------------------------------------------
const FONT = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '#.#', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['###', '#.#', '#.#', '#.#', '###'], P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['###', '#.#', '#.#', '###', '..#'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '#.#', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'], '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'], '9': ['###', '#.#', '###', '..#', '##.'],
  '-': ['...', '...', '###', '...', '...'], '.': ['...', '...', '...', '...', '.#.'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'], '?': ['###', '..#', '.##', '...', '.#.'],
  ':': ['...', '.#.', '...', '.#.', '...'], '/': ['..#', '..#', '.#.', '#..', '#..'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'], '<': ['..#', '.#.', '#..', '.#.', '..#'],
  'x': ['...', '#.#', '.#.', '#.#', '...'], '+': ['...', '.#.', '###', '.#.', '...'],
  ',': ['...', '...', '...', '.#.', '#..'], "'": ['.#.', '.#.', '...', '...', '...'],
  '(': ['.#.', '#..', '#..', '#..', '.#.'], ')': ['.#.', '..#', '..#', '..#', '.#.'],
};

export function drawText(g, str, x, y, color = '#fff', scale = 1) {
  g.fillStyle = color;
  let cx = x;
  for (const raw of String(str)) {
    const ch = raw === raw.toLowerCase() && FONT[raw] ? raw : raw.toUpperCase();
    if (raw === ' ') { cx += 4 * scale; continue; }
    const glyph = FONT[ch];
    if (!glyph) { cx += 4 * scale; continue; }
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        if (glyph[gy][gx] === '#') g.fillRect(cx + gx * scale, y + gy * scale, scale, scale);
      }
    }
    cx += 4 * scale;
  }
  return cx;
}

export function textWidth(str, scale = 1) {
  return String(str).length * 4 * scale - scale;
}

export function drawTextCentered(g, str, cx, y, color = '#fff', scale = 1) {
  drawText(g, str, Math.round(cx - textWidth(str, scale) / 2), y, color, scale);
}

// ---------------------------------------------------------------------------
// Player art: a scout with a teal cap and a red scarf that trails behind.
// T cap, U cap shade, F skin, K ink, S scarf, s scarf shade,
// O shirt, b satchel, D pants, k boots, W white
// ---------------------------------------------------------------------------
const PLAYER_PAL = {
  T: '#1fb8a6', U: '#12756c', F: '#f2c088', K: '#20242c',
  S: '#e04343', s: '#9c2626', O: '#c8973a', b: '#7a4c22',
  D: '#3a4a8c', k: '#4a3020', W: '#ffffff',
};
const FIRE_PAL = {
  T: '#e04040', U: '#9c2626', F: '#f2c088', K: '#20242c',
  S: '#ffd23e', s: '#c99a1e', O: '#f2f2f2', b: '#7a4c22',
  D: '#c03030', k: '#4a3020', W: '#ffffff',
};

const HEAD = [
  '...TTTTTT...',
  '..TTTTTTTT..',
  '..TTTTTUUU..',
  '..FFFFFFFF..',
  '..FFKFFFKF..',
  '..FFFFFFFF..',
];

const SMALL_IDLE = [...HEAD,
  '.SSSSSSSS...',
  'sSOObOOOOO..',
  '.sOOObOOOO..',
  '..OOOObOOO..',
  '..DDD..DDD..',
  '..DDD..DDD..',
  '..kkk..kkk..',
  '.kkkk..kkkk.',
];
const SMALL_RUN = [...HEAD,
  'SSSSSSSSS...',
  'sSOObOOOOO..',
  '.sOOObOOOO..',
  '..OOOObOOO..',
  '...DDDDDD...',
  '..DDD.DDD...',
  '..kkk..kkk..',
  '.kkk....kkk.',
];
const SMALL_JUMP = [...HEAD,
  'SSSSSSSSS...',
  'SSOObOOOOF..',
  '.sOOObOOOO..',
  '..OOOObOOO..',
  '..DDDDDDDD..',
  '.kkkk..kkkk.',
  '............',
  '............',
];

const BIG_TORSO = [
  '.SSSSSSSS...',
  'sSSSSSSSSS..',
  '.sOObOOOOO..',
  '.OOOObOOOO..',
  '.FOOOObOOF..',
  '.FOOOOObOF..',
  '..OOOOObbb..',
  '..OOOOObbb..',
  '..OOOOOOOO..',
  '..DDDDDDDD..',
];
const BIG_IDLE = [...HEAD, ...BIG_TORSO,
  '..DDD..DDD..',
  '..DDD..DDD..',
  '..DDD..DDD..',
  '..DD....DD..',
  '..DD....DD..',
  '..DD....DD..',
  '.kkk....kkk.',
  '.kkkk..kkkk.',
];
const BIG_RUN = [...HEAD, ...BIG_TORSO,
  '...DDDDDD...',
  '..DDD.DDD...',
  '..DDD.DDD...',
  '.DDD...DDD..',
  '.DD.....DD..',
  '.DD.....DD..',
  'kkkk...kkkk.',
  '............',
];
const BIG_JUMP = [...HEAD,
  'SSSSSSSSS...',
  'SSSSSSSSSF..',
  'sSOObOOOOF..',
  '.OOOObOOOO..',
  '.OOOOObOOO..',
  '..OOOOObbb..',
  '..OOOOObbb..',
  '..OOOOOOOO..',
  '..DDDDDDDD..',
  '..DDDDDDDD..',
  '..DDD..DDD..',
  '.DDD....DDD.',
  '.kkk....kkk.',
  '.kkk....kkk.',
  '............',
  '............',
  '............',
  '............',
];

const GLITCH_COLORS = ['#00ff88', '#ff00ff', '#ffff00', '#00ffff', '#ff3333', '#4444ff', '#ffffff'];
function glitchPal() {
  const p = {};
  for (const key of Object.keys(PLAYER_PAL)) {
    p[key] = GLITCH_COLORS[(Math.random() * GLITCH_COLORS.length) | 0];
  }
  return p;
}

// ---------------------------------------------------------------------------
// World 1 enemies: Shellsnail, Bumblebore, Snapdragon
// ---------------------------------------------------------------------------
const snailPal = { R: '#b06a32', r: '#7a4520', G: '#c2dc86', g: '#8fae56', K: '#20242c', W: '#fff' };
const SNAIL_1 = [
  '.........K.K',
  '.........G.G',
  '..RRRRR..G.G',
  '.RrrrrRR.GGG',
  '.RrRRrrR.GGG',
  '.RrRrRrRGGGG',
  '.RrrRrrRGGGG',
  '..RRRRRGGGGG',
  '..gGGGGGGGg.',
];
const SNAIL_2 = [
  '.........K.K',
  '.........G.G',
  '..RRRRR..G.G',
  '.RrrrrRR.GGG',
  '.RrRRrrR.GGG',
  '.RrRrRrRGGGG',
  '.RrrRrrRGGGG',
  '..RRRRRGGGGG',
  '..GgGGGGGgG.',
];
const SHELL = [
  '..RRRRRR..',
  '.RrrrrrrR.',
  'RrRRRRrrRR',
  'RrRrrRrrRR',
  'RrRRRrrrRR',
  '.RrrrrrrR.',
  '..RRRRRR..',
];

const beePal = { Y: '#ffce3e', y: '#d19a1e', K: '#20242c', W: '#f4f7ff', w: '#c9d4ea', R: '#e04343' };
const BEE_1 = [
  '..WW....WW..',
  '..WWW..WWW..',
  '...WW..WW...',
  'K.YYKKYYYY..',
  'KKYYKKYYWK..',
  'KKYYKKYYYY..',
  'K.yYKKyYYY..',
  '..yYYKYYy...',
  '............',
];
const BEE_2 = [
  '............',
  '............',
  '..ww....ww..',
  'K.YYKKYYYY..',
  'KKYYKKYYWK..',
  'KKYYKKYYYY..',
  'K.yYKKyYYY..',
  '..yYYKYYy...',
  '..ww....ww..',
];

const snapPal = { R: '#e0559a', r: '#a83070', G: '#4a9e3c', g: '#2f6b26', K: '#30101c', W: '#fff' };
const SNAP_IDLE = [
  '....RRR...',
  '...RRRRR..',
  '...RrRrR..',
  '....RrR...',
  '.....G....',
  '..G..G....',
  '..GG.G.G..',
  '...GGGGG..',
  '.....G....',
  '.....G....',
  '....gGg...',
  '...ggggg..',
];
const SNAP_LUNGE = [
  '..RRRRRR....',
  '.RRWRWRRR...',
  '.RrRRRRRr...',
  '.RKKKKKKR...',
  '.RrWRWRWr...',
  '..RRRRRR....',
  '....G.......',
  '..G.G.......',
  '..GGG.G.....',
  '...GGGG.....',
  '....gGg.....',
  '...ggggg....',
];

// ---------------------------------------------------------------------------
// World 2 enemies
// ---------------------------------------------------------------------------
const batPal = { P: '#8a5adf', p: '#5c3a9e', W: '#fff', K: '#111' };
const BAT_1 = [
  'PP........PP',
  'PPP..PP..PPP',
  '.PPPPPPPPPP.',
  '..PWKPPWKP..',
  '..pPPPPPPp..',
  '...PP..PP...',
];
const BAT_2 = [
  '............',
  '.....PP.....',
  '.PPPPPPPPPP.',
  'PPPWKPPWKPPP',
  'P.pPPPPPPp.P',
  '...PP..PP...',
];

const stalPal = { S: '#b9c2cf', s: '#8792a3', K: '#111' };
const STALACTITE = [
  'SSSSSSSS',
  'SsSSSSsS',
  '.SSSSSS.',
  '.SsSSsS.',
  '..SSSS..',
  '..SsSS..',
  '..SSSS..',
  '...SS...',
  '...SS...',
  '...sS...',
  '....S...',
  '....S...',
];

const crawlPal = { S: '#cfd6e0', B: '#5c3a3a', b: '#402828', W: '#fff', K: '#111' };
const CRAWLER = [
  '.S..S..S..S.',
  '.SS.SS.SS.SS',
  'BBBBBBBBBBBB',
  'BWKBBBBBBBBB',
  'BBBBBBBBBBBB',
  'bBBBBBBBBBBb',
  '.bb.bb.bb.b.',
];

// ---------------------------------------------------------------------------
// World 3 enemies
// ---------------------------------------------------------------------------
const puffPal = { W: '#f4f7ff', w: '#c9d4ea', K: '#111', R: '#e88' };
const PUFF = [
  '..WWWWWW..',
  '.WWWWWWWW.',
  'WWKWWWWKWW',
  'WWWWWWWWWW',
  'WWWRRRRWWW',
  '.wWWWWWWw.',
  '..wwwwww..',
];

const cturPal = { W: '#eef2fb', w: '#b9c6e2', K: '#242833', k: '#40485c' };
const CLOUDTURRET = [
  '....WWWWWW....',
  '..WWWWWWWWWW..',
  '.WWWkKKKKkWWW.',
  'WWWWKKKKKKWWWW',
  'WWWWkKKKKkWWWW',
  '.WWWWWWWWWWWW.',
  '..wWWWWWWWWw..',
  '...wwwwwwww...',
];

// ---------------------------------------------------------------------------
// World 4 enemies
// ---------------------------------------------------------------------------
const dronePal = { S: '#9aa4b5', s: '#6b7382', G: '#39ff7a', K: '#111' };
const DRONE_1 = [
  'ss..ssss..ss',
  '.sSSSSSSSSs.',
  '.SSSSSSSSSS.',
  '.SSGGGGGSSS.',
  '.SSGKKKGSSS.',
  '.sSSSSSSSSs.',
  '..sSSSSSSs..',
  '....ssss....',
];
const DRONE_2 = [
  '..ssssssss..',
  '.sSSSSSSSSs.',
  '.SSSSSSSSSS.',
  '.SSGGGGGSSS.',
  '.SSGKKKGSSS.',
  '.sSSSSSSSSs.',
  '..sSSSSSSs..',
  '....ssss....',
];

const fwallPal = { K: '#1a2430', k: '#2c3c50', R: '#ff3344', r: '#8a1c26', G: '#39ff7a' };
const FIREWALL = [
  'kKKKKKKKKk',
  'KGKKKKKKGK',
  'KKKrrrrKKK',
  'KKrRRRRrKK',
  'KKrRRRRrKK',
  'KKKrrrrKKK',
  'KGKKKKKKGK',
  'kKKKKKKKKk',
  'kkKKKKKKkk',
  '.kkKKKKkk.',
  '.kkKKKKkk.',
  'kkkKKKKkkk',
];

const minePal = { G: '#39ff7a', g: '#1f8a44', K: '#111', W: '#fff' };
const MINE_1 = [
  '...GG...',
  '..GGGG..',
  '.GGWWGG.',
  'GGWKKWGG',
  'GGWKKWGG',
  '.GGWWGG.',
  '..GGGG..',
  '...GG...',
];
const MINE_2 = [
  '...gg...',
  '..gggg..',
  '.ggWWgg.',
  'ggWKKWgg',
  'ggWKKWgg',
  '.ggWWgg.',
  '..gggg..',
  '...gg...',
];

// ---------------------------------------------------------------------------
// World 5 enemies
// ---------------------------------------------------------------------------
const impPal = { R: '#e04a30', r: '#9e2f1c', Y: '#ffd23e', W: '#fff', K: '#111' };
const IMP_1 = [
  'r..........r',
  '.r........r.',
  '..RRRRRRRR..',
  '.RRWKRRWKRR.',
  '.RRRRRRRRRR.',
  '.RRYYYYYYRR.',
  '..RrRRRRrR..',
  '..rr....rr..',
  '.rrr....rrr.',
];
const IMP_2 = [
  'r..........r',
  '.r........r.',
  '..RRRRRRRR..',
  '.RRWKRRWKRR.',
  '.RRRRRRRRRR.',
  '.RRYYYYYYRR.',
  '..RrRRRRrR..',
  '...rrrrrr...',
  '..rrr..rrr..',
];

const flamePal = { Y: '#ffe14a', O: '#ff8c1a', R: '#e33e1c' };
const FLAME_1 = [
  '...R....',
  '..ROR...',
  '.RROOR..',
  '.ROYYOR.',
  'RROYYORR',
  'ROYYYYOR',
  '.ROYYOR.',
  '..ROOR..',
];
const FLAME_2 = [
  '....R...',
  '...ROR..',
  '..ROORR.',
  '.ROYYOR.',
  'ROYYYYOR',
  'RROYYORR',
  '.ROYYOR.',
  '..RROR..',
];

const FIREBALL = [
  '.ROO.',
  'ROYYO',
  'OYYYO',
  'ROYYO',
  '.ROO.',
];

// ---------------------------------------------------------------------------
// World 6 enemies: Dart Frog, Howler, Idol Turret
// ---------------------------------------------------------------------------
const dfrogPal = { G: '#2fae7a', g: '#1c7a52', Y: '#e8c85a', W: '#fff', K: '#111' };
const DFROG_1 = [
  '..GGGGGG..',
  '.GWKGGWKG.',
  '.GGGGGGGG.',
  '.GYYYYYYG.',
  'gGGGGGGGGg',
  '.gg....gg.',
  '.ggg..ggg.',
];
const DFROG_2 = [
  '..GGGGGG..',
  '.GWKGGWKG.',
  '.GGGGGGGG.',
  '.GYYYYYYG.',
  'gGGGGGGGGg',
  'gGG....GGg',
  '.g......g.',
];

const howlPal = { B: '#8a5a2b', b: '#5c3a1a', F: '#e0b088', W: '#fff', K: '#111' };
const HOWL_1 = [
  '..BB....BB..',
  '.BBBB..BBBB.',
  '.BBFFFFFFBB.',
  '.BFWKFFWKFB.',
  '.BFFFFFFFFB.',
  '.BBFFFFFFBB.',
  '..BBBBBBBB..',
  '...b....b...',
  '..b......b..',
];
const HOWL_2 = [
  'BB........BB',
  '.BB......BB.',
  '.BBFFFFFFBB.',
  '.BFWKFFWKFB.',
  '.BFFFFFFFFB.',
  '.BBFFFFFFBB.',
  '..BBBBBBBB..',
  '..bb....bb..',
  '...b....b...',
];

const idolPal = { S: '#8a9a6a', s: '#566040', T: '#1fb8a6', Y: '#e0a838', R: '#c0392b', K: '#111', W: '#fff' };
const IDOL = [
  '.SSSSSSSSSS.',
  'SSSSSSSSSSSS',
  'STTTTTTTTTTS',
  'STWKTTTTWKTS',
  'STTTTTTTTTTS',
  'STYYYYYYYYTS',
  'SSRRRRRRRRSS',
  'SSsKKKKKKsSS',
  '.SSsssssSSSS',
  '..SSSSSSSS..',
  '..sSSSSSSs..',
  '...ssssss...',
];

const dartPal = { G: '#3f8f34', Y: '#b6e05a', W: '#eaffd0' };
const DART = [
  '.GGG.',
  'GGYYG',
  'GYWYG',
  'GGYYG',
  '.GGG.',
];

const sparkPal = { Y: '#fff2a0', O: '#ffb020', W: '#ffffff' };
const SPARK = [
  '.OYO.',
  'OYWYO',
  'YWWWY',
  'OYWYO',
  '.OYO.',
];

const shardPal = { P: '#b48cff', p: '#7a5adf', W: '#fff' };
const SHARD = [
  '..PP..',
  '.PWWP.',
  '.PWWP.',
  'pPPPPp',
  '.pPPp.',
  '..pp..',
];

// Boss projectiles / minions
const featherPal = { W: '#f4f7ff', B: '#5a8ad0', b: '#3a5f96' };
const FEATHER = [
  '..WWB..',
  '.WWWBB.',
  'WWWBBb.',
  '.WWBb..',
  '..Wb...',
];

const bitPal = { G: '#39ff7a', g: '#1f8a44', W: '#eafff2' };
const BIT = [
  '.gGGg.',
  'gGWWGg',
  'GWWWWG',
  'GWWWWG',
  'gGWWGg',
  '.gGGg.',
];

const toadletPal = { G: '#4ea83e', g: '#33702a', W: '#fff', K: '#111', R: '#c0392b' };
const TOADLET_1 = [
  '..GGGGGG..',
  '.GWKGGWKG.',
  '.GGGGGGGG.',
  '.GRRRRRRG.',
  'gGGGGGGGGg',
  '.gg....gg.',
  '.ggg..ggg.',
];
const TOADLET_2 = [
  '..GGGGGG..',
  '.GWKGGWKG.',
  '.GGGGGGGG.',
  '.GRRRRRRG.',
  'gGGGGGGGGg',
  'gGGGGGGGGg',
  '.gg.gg.gg.',
];

// ---------------------------------------------------------------------------
// Item art
// ---------------------------------------------------------------------------
const coinPal = { Y: '#ffd23e', y: '#c99a1e', W: '#fff7d0' };
const COIN_1 = [
  '..YYYY..',
  '.YyyyyY.',
  'YyWWyyyY',
  'YyWyyyyY',
  'YyWyyyyY',
  'YyWWyyyY',
  '.YyyyyY.',
  '..YYYY..',
];
const COIN_2 = [
  '...YY...',
  '..YyyY..',
  '..YyWY..',
  '..YyWY..',
  '..YyWY..',
  '..YyWY..',
  '..YyyY..',
  '...YY...',
];

const berryPal = { R: '#e0342c', r: '#9e1f1a', G: '#4ec04e', W: '#ffd9d6' };
const BERRY = [
  '....GG....',
  '...GG.....',
  '..RRRRRR..',
  '.RRWRRRRR.',
  'RRWRRRRRRR',
  'RRRRRRRRRR',
  'RRRRRRRRrr',
  'rRRRRRRRrr',
  '.rRRRRRr..',
  '..rrrrr...',
];
const ONEUP_PAL = { R: '#3ecb5a', r: '#1f8a38', G: '#2a6e2a', W: '#d9ffd9' };

const orbPal = { O: '#ff8c1a', o: '#c05a10', W: '#ffffff', Y: '#ffe14a' };
const ORB = [
  '...OOOO...',
  '..OYYYYO..',
  '.OYWWYYYO.',
  'OYWWYYYYYO',
  'OYWYYYYYYO',
  'OYYYYYYYYO',
  '.OYYYYYYO.',
  '..OYYYYO..',
  '...OOOO...',
  '....oo....',
];

const GLITCHCUBE = [
  'AABBAABBAA',
  'ABCCABCCAB',
  'BCAABCAABC',
  'CABBCABBCA',
  'AABBAABBAA',
  'ABCCABCCAB',
  'BCAABCAABC',
  'CABBCABBCA',
  'AABBAABBAA',
  'ABCCABCCAB',
];

// ---------------------------------------------------------------------------
// Boss art (16x16, rendered at scale 2 -> 32x32)
// ---------------------------------------------------------------------------
const toadPal = { G: '#4ea83e', g: '#33702a', Y: '#ffd23e', W: '#fff', K: '#111', R: '#c0392b', B: '#e8f4d8' };
const TOADKING = [
  '....Y.Y.Y.......',
  '....YYYYY.......',
  '..GGGGGGGGGG....',
  '.GGGGGGGGGGGG...',
  'GGWWKGGGGWWKGG..',
  'GGWWKGGGGWWKGG..',
  'GGGGGGGGGGGGGG..',
  'GRRRRRRRRRRRRG..',
  'GGGGGGGGGGGGGG..',
  'GBBBBBBBBBBBBG..',
  'GBBBBBBBBBBBBG..',
  'gGBBBBBBBBBBGg..',
  'gGGGGGGGGGGGGg..',
  'ggGGGGGGGGGGgg..',
  '.ggg..gg..ggg...',
  '.gggg.gg.gggg...',
];

const golemPal = { S: '#8a7fb8', s: '#5c5480', K: '#111', C: '#4affd7', W: '#fff' };
const GOLEM = [
  '..SSSSSSSSSS....',
  '.SSSSSSSSSSSS...',
  '.SKKSSSSSSKKS...',
  '.SKKSSSSSSKKS...',
  '.SSSSSSSSSSSS...',
  'SSssSSSSSSssSS..',
  'SS.SSSSSSSS.SS..',
  'SS.SSCCCCSS.SS..',
  'SS.SSCCCCSS.SS..',
  'ss.SSSSSSSS.ss..',
  '...SSSSSSSS.....',
  '...SSssssSS.....',
  '...SS....SS.....',
  '..SSS....SSS....',
  '..ss......ss....',
  '................',
];

const birdPal = { B: '#5a8ad0', b: '#3a5f96', Y: '#ffd23e', W: '#fff', K: '#111' };
const BIRD_1 = [
  'BB............BB',
  'BBBB........BBBB',
  '.BBBBB....BBBBB.',
  '..BBBBBBBBBBBB..',
  '...BBBBBBBBBB...',
  '...BBWKBBBBBB...',
  '...BBBBBBBYYY...',
  '...BBBBBBBBYY...',
  '..bBBBBBBBBb....',
  '..bbBBBBBBbb....',
  '...bBBBBBBb.....',
  '....bbBBbb......',
  '.....Y..Y.......',
  '.....Y..Y.......',
  '................',
  '................',
];
const BIRD_2 = [
  '................',
  '................',
  '..B..........B..',
  '..BBB......BBB..',
  '..BBBBBBBBBBBB..',
  '...BBBBBBBBBB...',
  '...BBWKBBBBBB...',
  '...BBBBBBBYYY...',
  '...BBBBBBBBYY...',
  '..bBBBBBBBBb....',
  '..bbBBBBBBbb....',
  '...bBBBBBBb.....',
  '....bbBBbb......',
  '.....Y..Y.......',
  '................',
  '................',
];

const kernelPal = { K: '#101820', k: '#22303e', G: '#39ff7a', g: '#1f8a44', W: '#eafff2', R: '#ff3344' };
const KERNEL = [
  '..kKKKKKKKKKKk..',
  '.kKgKKKKKKKKgKk.',
  'kKKKGGKKKKGGKKKk',
  'KKgKKKKKKKKKKgKK',
  'KKKKGGGGGGGGKKKK',
  'KKKGWWGGGGWWGKKK',
  'KKKGWWGGGGWWGKKK',
  'KKKKGGGGGGGGKKKK',
  'KKgKKGGGGGGKKgKK',
  'KKKKKKGGGGKKKKKK',
  'kKKKGKKKKKKGKKKk',
  '.kKKKGgKKgGKKKk.',
  '..kKKKKKKKKKKk..',
  '...kkKKKKKKkk...',
  '.....kKKKKk.....',
  '................',
];

const fkingPal = { Y: '#ffe14a', O: '#ff8c1a', R: '#e33e1c', r: '#8a1c26', K: '#111', W: '#fff', C: '#ffd23e' };
const FLAMEKING = [
  '..C..C..C..C....',
  '..CCCCCCCCCC....',
  '..RRRRRRRRRR....',
  '.RRRRRRRRRRRR...',
  'RRWWKRRRRWWKRR..',
  'RRWWKRRRRWWKRR..',
  'RRRRRRRRRRRRRR..',
  'RROOOOOOOOOORR..',
  'ROOYYYYYYYYOORR.',
  'ROYYYYYYYYYYOR..',
  'ROYYYYYYYYYYOR..',
  'RROYYYYYYYYORr..',
  '.ROOYYYYYYOOr...',
  '..RROOOOOORr....',
  '...rRROORRr.....',
  '....rrrrrr......',
];

const coatlPal = { T: '#1fb8a6', t: '#12756c', Y: '#e0a838', y: '#a8781c', R: '#c0392b', r: '#8a2820', K: '#111', W: '#fff' };
const COATL = [
  '....YRY.........',
  '...YRYRY........',
  '..YYRRRYY.......',
  '..TTTTTTTT......',
  '.TTTTTTTTTT.....',
  'TTWKTTTTTTTT....',
  'TTWKTTTTTTTT....',
  '.TTTTTTTTTTR....',
  '.TTRRRRRRRRr....',
  '..TTTTTTTTT.....',
  '...tTTTTTt......',
  '....tTTTt.......',
  '...tTTTTTt......',
  '..tTTTTTTTt.....',
  '..tTTTTTTTt.....',
  '...ttTTTtt......',
];

// ---------------------------------------------------------------------------
// World 7 (Sunken Depths) enemies
// ---------------------------------------------------------------------------
const pufferPal = { O: '#e8a13c', o: '#a86c1c', W: '#fff', K: '#111', S: '#f4d488' };
const PUFFER = [
  '..OOOOOO..',
  '.OOOOOOOO.',
  'OOWKOOOOOO',
  'OOOOOOOSSO',
  '.oOOOOOOo.',
  '..oooooo..',
];
const PUFFER_BIG = [
  '.S..OO..S.',
  '.OOOOOOOO.',
  'SOOOOOOOOS',
  'OOWKOOOOOO',
  'OOOOOOOOOO',
  'SOOOOOOOOS',
  '.OOOOOOOO.',
  '.S..oo..S.',
];
const jellyPal = { P: '#d48ae8', p: '#8a4aa8', W: '#f4e0ff', K: '#111' };
const JELLY_1 = [
  '..PPPPPP..',
  '.PPWWPPPP.',
  'PPWKPPKPPP',
  'PPPPPPPPPP',
  '.p.p.p.p..',
  '.p.p.p.p..',
  '..p..p..p.',
];
const JELLY_2 = [
  '..PPPPPP..',
  '.PPWWPPPP.',
  'PPWKPPKPPP',
  'PPPPPPPPPP',
  '..p.p.p.p.',
  '..p.p.p.p.',
  '.p..p..p..',
];
const snapperPal = { B: '#4a9ad4', b: '#2c6a9a', W: '#fff', K: '#111', T: '#e8ecf4' };
const SNAPPER_1 = [
  '..BBBBBB.b.',
  '.BBBBBBBBbb',
  'BWKBBBBBBBb',
  'BTTBBBBBBbb',
  '.BBBBBBBB.b',
  '..bBBBBb...',
];
const SNAPPER_2 = [
  '..BBBBBB.b.',
  '.BBBBBBBBb.',
  'BWKBBBBBBbb',
  'BTTBBBBBBBb',
  '.BBBBBBBBb.',
  '..bBBBBb.b.',
];
const urchinPal = { K: '#1c1428', k: '#3a2c50', R: '#d44a6a' };
const URCHIN = [
  '..k..K..k..',
  '.k.kKKKk.k.',
  '..kKKKKKk..',
  'KKKKRRKKKKK',
  '..kKKKKKk..',
  '.k.kKKKk.k.',
  '..k..K..k..',
];
const bubblePal = { B: '#bfe6ff', W: '#f4fbff' };
const BUBBLE = [
  '.BBB.',
  'BWBBB',
  'BBBBB',
  '.BBB.',
];

const leviPal = { T: '#2f7fd4', t: '#1c528a', F: '#54e0c8', f: '#2a9a86', W: '#fff', K: '#111', R: '#d44a6a' };
const LEVIATHAN = [
  '....FFF.........',
  '...FFFFF........',
  '..TTTTTTTT......',
  '.TTTTTTTTTTT....',
  'TTWKTTTTTTTTT...',
  'TTWKTTTTTTTTTT..',
  'TTRRTTTTTTTTTT..',
  '.TTTTTTTTTTTTt..',
  '..tTTTTTTTTTt...',
  '...fFFfTTTTt....',
  '....FF.tTTTTt...',
  '.......tTTTTTt..',
  '......tTTTTTt...',
  '.....tTTTTt.....',
  '....fFFft.......',
  '.....FF.........',
];

// ---------------------------------------------------------------------------
// Tile skins (procedural, per world) with ground variants + grass fringe
// ---------------------------------------------------------------------------
const WORLD_TILE_COLORS = [
  { top: '#7bd94a', topDark: '#4a8f3c', body: '#8a5a2b', dark: '#6b431f', light: '#a5713a',
    brick: '#c8703a', brickLine: '#8a4a22', brickHi: '#e08a50', plat: '#b98648', pillar: '#9a7a4a' },
  { top: '#8a9ec4', topDark: '#5c6f94', body: '#4a5568', dark: '#333c4c', light: '#5e6b80',
    brick: '#6b7a99', brickLine: '#454f66', brickHi: '#8494b4', plat: '#7a88a8', pillar: '#5c6880' },
  { top: '#ffffff', topDark: '#cfd9ea', body: '#dfe8f4', dark: '#b9c6de', light: '#f4f8ff',
    brick: '#e8d9b0', brickLine: '#c0ac7a', brickHi: '#f6ecd0', plat: '#f0f4fc', pillar: '#cfd9ea' },
  { top: '#39ff7a', topDark: '#1f8a44', body: '#12241a', dark: '#0a160f', light: '#1c3626',
    brick: '#1c3626', brickLine: '#39ff7a', brickHi: '#2a5038', plat: '#1f4430', pillar: '#16301f' },
  { top: '#c05a3a', topDark: '#8a3c28', body: '#5c3038', dark: '#40202a', light: '#744048',
    brick: '#7a3c40', brickLine: '#4a2028', brickHi: '#96505a', plat: '#8a4c44', pillar: '#6b3438' },
  { top: '#4ec26a', topDark: '#2f8a44', body: '#6b7a4a', dark: '#48542f', light: '#8a9a5e',
    brick: '#8a9a6a', brickLine: '#566040', brickHi: '#a8b884', plat: '#9a7a4a', pillar: '#7a8a5a' },
  // Sunken Depths: barnacled sandstone ruins under a blue cast
  { top: '#54b8a0', topDark: '#2f8a7a', body: '#3c5a7a', dark: '#28405c', light: '#4e7094',
    brick: '#5a7494', brickLine: '#3a4e6b', brickHi: '#7290b0', plat: '#6a84a4', pillar: '#4a6284' },
];

function lcg(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function tileCanvas(draw, w = TILE, h = TILE) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  return c;
}

function drawGroundBody(g, col, rnd, oy = 0) {
  g.fillStyle = col.body;
  g.fillRect(0, oy, 16, 16);
  // clumps and speckles
  for (let i = 0; i < 5; i++) {
    g.fillStyle = col.dark;
    g.fillRect((rnd() * 14) | 0, oy + 2 + ((rnd() * 13) | 0), 2 + ((rnd() * 2) | 0), 2);
  }
  for (let i = 0; i < 4; i++) {
    g.fillStyle = col.light;
    g.fillRect((rnd() * 15) | 0, oy + 2 + ((rnd() * 13) | 0), 1, 1);
  }
}

export function makeTileSkin(world) {
  const col = WORLD_TILE_COLORS[world];
  const tiles = {};

  // 3 plain ground variants (used when covered by another tile above)
  tiles.ground = [0, 1, 2].map(v => tileCanvas(g => {
    drawGroundBody(g, col, lcg(1000 + world * 91 + v * 17));
  }));

  // 3 "surface" variants: grass/edge fringe, drawn 3px taller and rendered
  // 3px above the tile so blades poke into the empty tile above.
  tiles.groundTop = [0, 1, 2].map(v => tileCanvas(g => {
    const rnd = lcg(2000 + world * 91 + v * 17);
    drawGroundBody(g, col, rnd, 3);
    g.fillStyle = col.top;
    g.fillRect(0, 3, 16, 4);
    g.fillStyle = col.topDark;
    for (let i = 0; i < 5; i++) g.fillRect((rnd() * 15) | 0, 5 + ((rnd() * 2) | 0), 1, 1);
    if (world === 0 || world === 1 || world === 4 || world === 5) {
      // blades / rough edge poking up
      for (let x = 0; x < 16; x += 2) {
        if (rnd() < (world === 5 ? 0.7 : 0.55)) {
          const h = 1 + ((rnd() * (world === 5 ? 4 : 3)) | 0);
          g.fillStyle = rnd() < 0.3 ? col.topDark : col.top;
          g.fillRect(x + ((rnd() * 2) | 0), 3 - h, 1, h);
        }
      }
    } else if (world === 2) {
      // puffy cloud lip
      g.fillStyle = col.top;
      for (let x = 0; x < 16; x += 4) g.fillRect(x + 1, 1, 3, 3);
    } else if (world === 3) {
      // neon edge with circuit dashes
      g.fillStyle = col.top;
      g.fillRect(0, 3, 16, 2);
      for (let x = 0; x < 16; x += 5) g.fillRect(x, 1, 2, 2);
    }
  }, TILE, TILE + 3));

  tiles[T_GROUND] = tiles.ground[0];

  tiles[T_BRICK] = tileCanvas(g => {
    g.fillStyle = col.brick; g.fillRect(0, 0, 16, 16);
    g.fillStyle = col.brickHi;
    g.fillRect(0, 1, 16, 1); g.fillRect(0, 9, 16, 1);
    g.fillStyle = col.brickLine;
    g.fillRect(0, 0, 16, 1); g.fillRect(0, 7, 16, 2); g.fillRect(0, 15, 16, 1);
    g.fillRect(7, 1, 2, 6); g.fillRect(0, 9, 2, 6); g.fillRect(12, 9, 2, 6);
    if (world === 3) {
      g.fillStyle = 'rgba(57,255,122,0.35)';
      g.fillRect(3, 3, 3, 1); g.fillRect(10, 11, 3, 1);
    }
  });

  tiles[T_QBLOCK] = tileCanvas(g => {
    g.fillStyle = '#8a5a10'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#ffd23e'; g.fillRect(1, 1, 14, 14);
    g.fillStyle = '#fff2a0'; g.fillRect(1, 1, 14, 2); g.fillRect(1, 1, 2, 14);
    g.fillStyle = '#e8a820'; g.fillRect(3, 13, 12, 2); g.fillRect(13, 3, 2, 12);
    g.fillStyle = '#8a5a10';
    g.fillRect(1, 1, 2, 2); g.fillRect(13, 1, 2, 2); g.fillRect(1, 13, 2, 2); g.fillRect(13, 13, 2, 2);
    drawText(g, '?', 6, 5, '#8a5a10', 1);
  });

  tiles[T_USED] = tileCanvas(g => {
    g.fillStyle = '#55555c'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#8a8a92'; g.fillRect(1, 1, 14, 14);
    g.fillStyle = '#6b6b73'; g.fillRect(3, 3, 10, 10);
    g.fillStyle = '#55555c';
    g.fillRect(1, 1, 2, 2); g.fillRect(13, 1, 2, 2); g.fillRect(1, 13, 2, 2); g.fillRect(13, 13, 2, 2);
  });

  tiles[T_SPIKE] = tileCanvas(g => {
    for (let i = 0; i < 4; i++) {
      g.fillStyle = '#8792a3';
      g.beginPath();
      g.moveTo(i * 4, 16); g.lineTo(i * 4 + 2, 6); g.lineTo(i * 4 + 4, 16);
      g.fill();
      g.fillStyle = '#dfe6f0';
      g.fillRect(i * 4 + 1, 8, 1, 7);
    }
    g.fillStyle = '#5c6470'; g.fillRect(0, 14, 16, 2);
  });

  tiles[T_PLATFORM] = tileCanvas(g => {
    g.fillStyle = col.plat; g.fillRect(0, 0, 16, 5);
    g.fillStyle = col.light || '#fff'; g.fillRect(0, 0, 16, 1);
    g.fillStyle = col.dark; g.fillRect(0, 4, 16, 1);
    g.fillRect(2, 5, 2, 4); g.fillRect(12, 5, 2, 4);
    if (world === 0) { // wooden plank: grain + nails
      g.fillStyle = col.dark;
      g.fillRect(4, 2, 3, 1); g.fillRect(10, 1, 3, 1);
      g.fillRect(1, 1, 1, 1); g.fillRect(14, 1, 1, 1);
    }
  });

  tiles[T_LAVA] = tileCanvas(g => {
    g.fillStyle = '#c22e12'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#e33e1c'; g.fillRect(0, 0, 16, 10);
    g.fillStyle = '#ff8c1a'; g.fillRect(0, 0, 16, 4);
    g.fillStyle = '#ffe14a'; g.fillRect(2, 0, 3, 2); g.fillRect(10, 1, 4, 2);
    g.fillStyle = '#ff8c1a'; g.fillRect(5, 6, 2, 2); g.fillRect(12, 12, 2, 2);
  });

  tiles[T_GLITCHBLOCK] = tileCanvas(g => {
    g.fillStyle = '#101820'; g.fillRect(0, 0, 16, 16);
    const rnd = lcg(777 + world);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = GLITCH_COLORS[(rnd() * GLITCH_COLORS.length) | 0];
      g.fillRect((rnd() * 15) | 0, (rnd() * 15) | 0, 2, 2);
    }
  });

  tiles[T_PILLAR] = tileCanvas(g => {
    g.fillStyle = col.pillar; g.fillRect(0, 0, 16, 16);
    g.fillStyle = col.light; g.fillRect(2, 0, 2, 16);
    g.fillStyle = col.dark; g.fillRect(0, 0, 2, 16); g.fillRect(14, 0, 2, 16);
    g.fillRect(4, 3, 3, 2); g.fillRect(9, 10, 3, 2);
  });

  return tiles;
}

// ---------------------------------------------------------------------------
// Build all sprites
// ---------------------------------------------------------------------------
function playerSet(pal) {
  return {
    idle: pair(SMALL_IDLE, pal),
    run: [pair(SMALL_IDLE, pal), pair(SMALL_RUN, pal)],
    jump: pair(SMALL_JUMP, pal),
  };
}
function playerBigSet(pal) {
  return {
    idle: pair(BIG_IDLE, pal),
    run: [pair(BIG_IDLE, pal), pair(BIG_RUN, pal)],
    jump: pair(BIG_JUMP, pal),
  };
}

// Small keep for boss nodes on the world map (~16x16)
const MAPCASTLE = [
  '..F.............',
  '..FF............',
  '..F.............',
  '..W......W.W.W..',
  '.WWW.....WWWWW..',
  '.WwW.....WwWWw..',
  '.WWW.W.W.WWWWW..',
  '.WWWWWWWWWWWWW..',
  '.WwWWwWWWwWWwW..',
  '.WWWWWDDWWWWWW..',
  '.WWwWWDdWWwWWW..',
  '.WWWWWDdWWWWWW..',
  'WWWWWWDdWWWWWWW.',
];
const mapCastlePal = { W: '#c0c0d0', w: '#8a8a9e', D: '#3a2a1a', d: '#241a10', F: '#ff3344' };

function buildAll() {
  const S = {};

  S.playerSmall = playerSet(PLAYER_PAL);
  S.playerBig = playerBigSet(PLAYER_PAL);
  S.playerFire = playerBigSet(FIRE_PAL);
  S.glitchSmall = [0, 1, 2].map(() => playerSet(glitchPal()));
  S.glitchBig = [0, 1, 2].map(() => playerBigSet(glitchPal()));

  S.snail = [pair(SNAIL_1, snailPal), pair(SNAIL_2, snailPal)];
  S.shell = pair(SHELL, snailPal);
  S.bee = [pair(BEE_1, beePal), pair(BEE_2, beePal)];
  S.snapIdle = pair(SNAP_IDLE, snapPal);
  S.snapLunge = pair(SNAP_LUNGE, snapPal);

  S.bat = [pair(BAT_1, batPal), pair(BAT_2, batPal)];
  S.stalactite = makeSprite(STALACTITE, stalPal, 1, true);
  S.crawler = [pair(CRAWLER, crawlPal), pair(CRAWLER.map(r => r.split('').reverse().join('')), crawlPal)];
  S.puff = [pair(PUFF, puffPal), pair(PUFF, puffPal)];
  S.cloudTurret = makeSprite(CLOUDTURRET, cturPal, 1, true);
  S.drone = [pair(DRONE_1, dronePal), pair(DRONE_2, dronePal)];
  S.firewall = makeSprite(FIREWALL, fwallPal, 1, true);
  S.mine = [makeSprite(MINE_1, minePal, 1, true), makeSprite(MINE_2, minePal, 1, true)];
  S.imp = [pair(IMP_1, impPal), pair(IMP_2, impPal)];
  S.flame = [makeSprite(FLAME_1, flamePal, 1, true), makeSprite(FLAME_2, flamePal, 1, true)];
  S.fireball = makeSprite(FIREBALL, flamePal, 1, true);
  S.dfrog = [pair(DFROG_1, dfrogPal), pair(DFROG_2, dfrogPal)];
  S.howler = [pair(HOWL_1, howlPal), pair(HOWL_2, howlPal)];
  S.idol = makeSprite(IDOL, idolPal, 1, true);
  S.dart = makeSprite(DART, dartPal, 1, true);
  S.puffer = [pair(PUFFER, pufferPal), pair(PUFFER, pufferPal)];
  S.pufferBig = [pair(PUFFER_BIG, pufferPal), pair(PUFFER_BIG, pufferPal)];
  S.jelly = [makeSprite(JELLY_1, jellyPal, 1, true), makeSprite(JELLY_2, jellyPal, 1, true)];
  S.snapper = [pair(SNAPPER_1, snapperPal), pair(SNAPPER_2, snapperPal)];
  S.urchin = makeSprite(URCHIN, urchinPal, 1, true);
  S.bubble = makeSprite(BUBBLE, bubblePal, 1, true);
  S.spark = makeSprite(SPARK, sparkPal, 1, true);
  S.shard = makeSprite(SHARD, shardPal, 1, true);
  S.feather = makeSprite(FEATHER, featherPal, 1, true);
  S.bit = makeSprite(BIT, bitPal, 1, true);
  S.toadlet = [pair(TOADLET_1, toadletPal), pair(TOADLET_2, toadletPal)];

  S.coin = [makeSprite(COIN_1, coinPal, 1, true), makeSprite(COIN_2, coinPal, 1, true)];
  S.berry = makeSprite(BERRY, berryPal, 1, true);
  S.oneup = makeSprite(BERRY, ONEUP_PAL, 1, true);
  S.orb = makeSprite(ORB, orbPal, 1, true);
  S.glitchCube = [0, 1, 2].map(() => {
    const [a, b, c] = [0, 0, 0].map(() => GLITCH_COLORS[(Math.random() * GLITCH_COLORS.length) | 0]);
    return makeSprite(GLITCHCUBE, { A: a, B: b, C: c }, 1, true);
  });

  S.toadking = pair(TOADKING, toadPal, 2);
  S.golem = pair(GOLEM, golemPal, 2);
  S.golemOpen = pair(GOLEM.map(r => r.replace(/C/g, 'W')), golemPal, 2);
  S.bird = [pair(BIRD_1, birdPal, 2), pair(BIRD_2, birdPal, 2)];
  S.kernel = makeSprite(KERNEL, kernelPal, 2, true);
  S.kernelHot = makeSprite(KERNEL, { ...kernelPal, G: '#ff3344', g: '#8a1c26' }, 2, true);
  S.flameking = pair(FLAMEKING, fkingPal, 2);
  S.coatl = pair(COATL, coatlPal, 2);
  S.leviathan = pair(LEVIATHAN, leviPal, 2);

  S.mapCastle = makeSprite(MAPCASTLE, mapCastlePal, 1, true);

  return S;
}

export const S = buildAll();
