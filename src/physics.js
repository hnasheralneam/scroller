import { TILE, SOLID_TILES, T_PLATFORM } from './constants.js';

// Sweep an entity {x, y, w, h, vx, vy} against the tilemap, axis by axis.
// Sets e.onGround, e.hitWall, e.hitCeiling, and e.headBumpTile {tx, ty} when
// the entity knocks its head on a tile while moving up.
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
  const prevBottom = e.y + e.h - e.vy; // bottom before this move
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
