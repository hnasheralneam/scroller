import { world1 } from './world1.js';
import { world2 } from './world2.js';
import { world3 } from './world3.js';
import { world4 } from './world4.js';
import { world5 } from './world5.js';

// Flat list of 15 levels: index = world * 3 + level
export const LEVELS = [];
[world1, world2, world3, world4, world5].forEach((levels, w) => {
  for (const def of levels) LEVELS.push({ world: w, def });
});
