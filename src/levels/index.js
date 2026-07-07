import { world1 } from './world1.js';
import { world2 } from './world2.js';
import { world3 } from './world3.js';
import { world4 } from './world4.js';
import { world5 } from './world5.js';
import { world6 } from './world6.js';
import { world7 } from './world7.js';

// Flat list of levels. Each entry records its world and its position within
// that world (`li`), so nothing else in the game needs to assume a fixed
// number of levels per world.
export const LEVELS = [];
[world1, world2, world3, world4, world5, world6, world7].forEach((levels, w) => {
  levels.forEach((def, li) => LEVELS.push({ world: w, li, def }));
});

// First flat index of each world (for map screens / world grouping)
export const WORLD_STARTS = [];
LEVELS.forEach(({ world }, i) => {
  if (WORLD_STARTS[world] === undefined) WORLD_STARTS[world] = i;
});
