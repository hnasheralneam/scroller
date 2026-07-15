import { mk, G, BR } from './util.js';

// World 7: Sunken Depths (flooded ruins — every level is fully underwater).
// Enemies: q pufferfish, y jellyfish, z snapperfish, u urchin.
// Boss: Abyssal Leviathan.
export const world7 = [
  {
    // Open shallows to learn the swim stroke: reef mounds with urchins on
    // top, lazy pufferfish, and coin arcs tracing the safe swim lines.
    name: 'CORAL SHALLOWS',
    meta: { water: true },
    map: mk(120, {
      0:  [[0, BR(120)]],
      1:  [[0, BR(120)]],
      4:  [[30, 'ooo'], [70, 'ooo']],
      5:  [[52, 'q'], [96, 'q']],
      6:  [[20, 'o'], [40, 'o'], [84, 'ooo'], [114, 'F']],
      7:  [[24, 'q'], [64, 'o'], [108, 'o']],
      8:  [[16, 'ooo'], [46, 'u'], [66, 'U'], [78, 'u']],
      9:  [[44, G(6)], [76, G(6)]],
      10: [[10, 'o'], [44, G(6)], [60, 'C'], [76, G(6)], [100, 'u']],
      11: [[28, 'u'], [98, G(8)]],
      12: [[3, 'P'], [26, G(10)], [98, G(8)]],
      13: [[0, G(120)]],
      14: [[0, G(120)]],
    }),
  },
  {
    // A swaying kelp forest: tall pillar trunks split the water into lanes
    // while jellyfish drift up between them. Weave over and under.
    name: 'KELP FOREST',
    meta: { water: true },
    map: mk(126, {
      0:  [[0, BR(126)]],
      1:  [[0, BR(126)]],
      3:  [[24, 'o'], [56, 'ooo'], [90, 'o']],
      4:  [[16, '|'], [48, '|'], [80, '|'], [104, '|']],
      5:  [[16, '|'], [36, 'y'], [48, '|'], [68, 'y'], [80, '|'], [104, '|'], [120, 'F']],
      6:  [[16, '|'], [30, 'o'], [48, '|'], [80, '|'], [96, 'y'], [104, '|']],
      7:  [[16, '|'], [48, '|'], [60, 'q'], [80, '|'], [104, '|']],
      8:  [[8, 'y'], [16, '|'], [42, 'o'], [48, '|'], [68, 'U'], [80, '|'], [104, '|'], [112, 'q']],
      9:  [[16, '|'], [48, '|'], [64, 'C'], [80, '|'], [104, '|']],
      10: [[16, '|'], [26, 'q'], [48, '|'], [62, G(6)], [80, '|'], [104, '|']],
      11: [[16, '|'], [48, '|'], [80, '|'], [88, 'u'], [104, '|']],
      12: [[3, 'P'], [16, '|'], [40, 'u'], [48, '|'], [80, '|'], [104, '|']],
      13: [[0, G(126)]],
      14: [[0, G(126)]],
    }),
  },
  {
    // Collapsed lava-tube tunnels: a winding passage with spiked walls and
    // snapperfish lunging out of alcoves. Precision swimming.
    name: 'TIDE TUNNELS',
    meta: { water: true },
    map: mk(130, {
      0:  [[0, BR(130)]],
      1:  [[0, BR(130)]],
      2:  [[30, G(40)], [90, G(24)]],
      3:  [[30, '^'.repeat(8)], [50, G(20)], [90, G(10)], [112, 'o']],
      4:  [[54, G(16)], [66, 'z'], [92, G(8)], [124, 'F']],
      5:  [[20, 'o'], [40, 'z'], [93, '^^^'], [108, 'y']],
      6:  [[10, 'o'], [56, 'oo'], [84, 'C'], [88, 'U']],
      7:  [[26, 'z'], [70, 'q'], [100, 'z']],
      8:  [[8, 'o'], [46, 'oo'], [116, 'o']],
      9:  [[36, G(8)], [60, 'u'], [90, G(12)]],
      10: [[16, 'u'], [36, G(8)], [39, '^^'], [58, G(10)], [90, G(12)], [110, 'u']],
      11: [[52, 'u'], [58, G(10)], [96, '^^^']],
      12: [[3, 'P'], [22, G(8)], [78, 'u'], [94, G(8)]],
      13: [[0, G(130)]],
      14: [[0, G(130)]],
    }),
  },
  {
    // The lightless abyss: a long dark descent through a urchin minefield
    // with jellyfish rising through the gloom and snapperfish crossfire.
    name: 'THE ABYSS',
    meta: { water: true, dark: true },
    map: mk(130, {
      0:  [[0, BR(130)]],
      1:  [[0, BR(130)]],
      3:  [[36, 'o'], [66, 'ooo'], [100, 'o']],
      4:  [[20, 'z'], [52, 'u'], [88, 'z'], [124, 'F']],
      5:  [[32, 'u'], [76, 'o'], [110, 'u']],
      6:  [[12, 'o'], [44, 'y'], [64, 'u'], [70, 'U'], [96, 'y']],
      7:  [[26, 'u'], [56, 'C'], [84, 'u'], [116, 'z']],
      8:  [[8, 'y'], [38, 'o'], [54, G(6)], [72, 'y'], [104, 'o']],
      9:  [[18, 'u'], [48, 'u'], [92, 'u'], [120, 'u']],
      10: [[30, 'z'], [66, 'u'], [108, 'y']],
      11: [[14, 'u'], [42, 'o'], [80, 'u'], [114, 'o']],
      12: [[3, 'P'], [24, 'u'], [58, 'u'], [98, 'z']],
      13: [[0, G(130)]],
      14: [[0, G(130)]],
    }),
  },
  {
    // A drowned trench with something to hold onto. The rock spires are the
    // point: the vortex drags you in with a steady pull, and bracing against
    // solid geometry kills that pull dead — so the spires are cover you can
    // actually wedge behind instead of open water with nothing in it.
    //
    // Pearls spawn at fixed spots (6 tiles in from each side, 5 tiles up), and
    // the phase-3 geysers vent 4 tiles in from each edge, so those four columns
    // are deliberately left clear.
    name: "LEVIATHAN'S TRENCH",
    meta: { water: true, boss: 'leviathan' },
    map: mk(48, {
      0:  [[0, BR(48)]],
      1:  [[0, BR(48)]],
      6:  [[6, 'U']],
      8:  [[22, 'oooo']],
      10: [[34, 'X']],
      11: [[14, '||'], [31, '||']],
      12: [[3, 'P'], [14, '||'], [31, '||'], [42, 'oo']],
      13: [[0, G(48)]],
      14: [[0, G(48)]],
    }),
  },
];
