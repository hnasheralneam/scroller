import {
  TILE, SOLID_TILES, T_PLATFORM,
  GRAVITY_UP, GRAVITY_DOWN, MAX_FALL, APEX_VY, APEX_GRAVITY,
} from './constants.js';

// One frame of player vertical integration: returns the next vy.
//
// The single source of truth for the player's jump arc. test/reach.js proves
// flag reachability by simulating this exact stepping to derive a jump
// envelope, so it imports this rather than re-implementing it — a second copy
// would silently stop matching the moment the arc is retuned.
//
// Variable jump height lives here: releasing jump mid-rise swaps GRAVITY_UP
// for the much heavier GRAVITY_DOWN, which is a complete implementation on its
// own and needs no velocity cut on top of it.
export function stepPlayerGravity(vy, jumpHeld) {
  let g = vy < 0 && jumpHeld ? GRAVITY_UP : GRAVITY_DOWN;
  if (Math.abs(vy) < APEX_VY) g *= APEX_GRAVITY;
  return Math.min(vy + g, MAX_FALL);
}

// Move an entity {x, y, w, h, vx, vy} against the tilemap, axis by axis.
//
// This is a discrete move-then-resolve, not a swept test: it only checks the
// destination row/column, which is safe solely because every speed in the game
// stays below TILE (MAX_FALL 9 < 16). A dash, a spring, or a higher terminal
// velocity would tunnel straight through geometry with no warning.
//
// Sets e.onGround, e.hitWall, e.hitCeiling, e.justLanded, and e.headBumpTile
// {tx, ty} when the entity knocks its head on a tile while moving up.
export function moveAndCollide(e, level, opts = {}) {
  const wasOnGround = e.onGround;
  e.onGround = false;
  e.hitWall = false;
  e.hitCeiling = false;
  e.headBumpTile = null;

  // --- horizontal ---
  e.x += e.vx;
  if (e.vx !== 0) {
    const dir = Math.sign(e.vx);
    const edgeX = dir > 0 ? e.x + e.w : e.x;
    const tx = Math.floor(edgeX / TILE);
    const ty0 = Math.floor(e.y / TILE);
    const ty1 = Math.floor((e.y + e.h - 0.01) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (SOLID_TILES.has(level.tileAt(tx, ty))) {
        e.x = dir > 0 ? tx * TILE - e.w : (tx + 1) * TILE;
        e.vx = 0;
        e.hitWall = true;
        break;
      }
    }
  }

  // --- vertical ---
  // e.y is still the pre-move position here, so the bottom before this move is
  // just e.y + e.h. This used to subtract e.vy as well, which rewound it an
  // extra frame and made the one-way check below re-catch anything that had
  // only just passed through a platform: a drop-through moved the player ~0.5px
  // clear on frame 1 and got yanked back up onto the platform on frame 2.
  const prevBottom = e.y + e.h;
  e.y += e.vy;
  if (e.vy > 0) {
    const ty = Math.floor((e.y + e.h - 0.01) / TILE);
    const tx0 = Math.floor((e.x + 1) / TILE);
    const tx1 = Math.floor((e.x + e.w - 1) / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = level.tileAt(tx, ty);
      const solid = SOLID_TILES.has(t);
      const oneWay = t === T_PLATFORM && !opts.dropThrough && prevBottom <= ty * TILE + 0.01;
      if (solid || oneWay) {
        e.y = ty * TILE - e.h;
        e.vy = 0;
        e.onGround = true;
        break;
      }
    }
  } else if (e.vy < 0) {
    const ty = Math.floor(e.y / TILE);
    const tx0 = Math.floor((e.x + 1) / TILE);
    const tx1 = Math.floor((e.x + e.w - 1) / TILE);
    for (let tx = tx0; tx <= tx1; tx++) {
      if (SOLID_TILES.has(level.tileAt(tx, ty))) {
        e.y = (ty + 1) * TILE;
        e.vy = 0;
        e.hitCeiling = true;
        // Bump the tile closest to the entity's center
        if (!e.headBumpTile || Math.abs((tx + 0.5) * TILE - (e.x + e.w / 2)) <
            Math.abs((e.headBumpTile.tx + 0.5) * TILE - (e.x + e.w / 2))) {
          e.headBumpTile = { tx, ty };
        }
      }
    }
  }

  // Keep inside level horizontally
  if (e.x < 0) { e.x = 0; e.vx = Math.max(0, e.vx); }
  const maxX = level.pxWidth - e.w;
  if (e.x > maxX) { e.x = maxX; e.vx = Math.min(0, e.vx); }

  e.justLanded = e.onGround && !wasOnGround;
}

// Would this box be inside solid geometry? For validating a teleport or a
// carried displacement, neither of which goes through moveAndCollide.
export function overlapsSolid(e, level) {
  const tx0 = Math.floor(e.x / TILE);
  const tx1 = Math.floor((e.x + e.w - 0.01) / TILE);
  const ty0 = Math.floor(e.y / TILE);
  const ty1 = Math.floor((e.y + e.h - 0.01) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (SOLID_TILES.has(level.tileAt(tx, ty))) return true;
    }
  }
  return false;
}

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Does the entity stand on solid ground one pixel below?
export function groundAhead(e, level, dir) {
  const px = dir > 0 ? e.x + e.w + 1 : e.x - 1;
  const tx = Math.floor(px / TILE);
  const ty = Math.floor((e.y + e.h + 2) / TILE);
  const t = level.tileAt(tx, ty);
  return SOLID_TILES.has(t) || t === T_PLATFORM;
}
