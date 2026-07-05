export const TILE = 16;
export const VIEW_W = 320;
export const VIEW_H = 240;

// Physics (per 60Hz frame)
export const GRAVITY = 0.35;        // enemies & objects
// Ascent height is kept close to the original ~3.75 tiles (JUMP_VEL raised
// alongside gravity to compensate) so authored gaps stay crossable, while
// time-to-peak is trimmed for less hang time; the fall is much heavier still
// ("falls like a brick") for the biggest chunk of the weight fix.
export const GRAVITY_UP = 0.40;     // player rising while holding jump
export const GRAVITY_DOWN = 0.85;   // player falling (falls like a brick)
export const MAX_FALL = 9;
export const RUN_ACCEL = 0.30;
export const RUN_DECEL = 0.35;
export const SKID_DECEL = 0.30;     // extra decel when reversing at speed
export const AIR_ACCEL = 0.22;
export const MAX_RUN = 2.5;
export const JUMP_VEL = -6.9;
export const DOUBLE_JUMP_VEL = -6.1;
// Rescaled to preserve the original ~1.56-tile bounce height now that
// GRAVITY_DOWN is much steeper (0.85) — without this the pop after a stomp
// decays almost instantly and reads as barely bouncing, especially against
// a tall, actively-moving boss.
export const STOMP_BOUNCE = -6.5;
export const COYOTE_FRAMES = 6;
export const JUMP_BUFFER_FRAMES = 6;

export const GLITCH_DURATION = 600;   // 10s at 60Hz
export const INVULN_FRAMES = 90;
export const COINS_PER_LIFE = 100;
export const START_LIVES = 3;

// Tile ids
export const T_EMPTY = 0;
export const T_GROUND = 1;
export const T_BRICK = 2;
export const T_QBLOCK = 3;
export const T_USED = 4;
export const T_SPIKE = 5;
export const T_PLATFORM = 6;   // one-way
export const T_LAVA = 7;
export const T_GLITCHBLOCK = 8;
export const T_PILLAR = 9;     // solid decorative (firebar pivot, arena walls)

export const SOLID_TILES = new Set([T_GROUND, T_BRICK, T_QBLOCK, T_USED, T_GLITCHBLOCK, T_PILLAR]);

// World ids / names
export const WORLDS = [
  { name: 'GREEN MEADOWS',   color: '#4ec04e' },
  { name: 'CRYSTAL CAVERNS', color: '#7a6cff' },
  { name: 'SKY ISLANDS',     color: '#6fd7ff' },
  { name: 'THE MAINFRAME',   color: '#00ff66' },
  { name: 'MOLTEN KEEP',     color: '#ff5a30' },
];
