import { mk, G, BR } from './util.js';

// World 6: Jungle Ruins (overgrown temple, vines, serpent idols)
// Enemies: e dart frog, w howler (vine-swinger), j idol turret. Boss: Coatl.
export const world6 = [
  {
    // Rolling terraced jungle floor: a low mesa, a raised ruin block, and a
    // short pit bridged by a plank walkway. Gentle intro platforming.
    name: 'CANOPY PATH',
    meta: {},
    map: mk(130, {
      0:  [[0, BR(130)]],
      1:  [[0, BR(130)]],
      4:  [[64, '*']],
      7:  [[106, 'U']],
      8:  [[55, 'w'], [78, 'oooo'], [108, 'w'], [126, 'F']],
      9:  [[24, '?'], [26, '?'], [40, 'e'], [44, 'ooo'], [104, 'ooo'], [118, '1']],
      10: [[34, G(16)], [101, G(13)]],
      11: [[16, 'ooo'], [26, 'e'], [34, G(16)], [70, 'ooo'], [90, 'e'], [101, G(13)]],
      12: [[3, 'P'], [20, G(42)], [65, 'C'], [70, 'e'], [78, '----'], [82, G(32)]],
      13: [[0, G(78)], [82, G(32)], [114, G(16)]],
      14: [[0, G(78)], [82, G(32)], [114, G(16)]],
    }),
  },
  {
    // A true ziggurat climb: a staircase of stacked stone terraces rising to
    // the right, serpent idols guarding each landing, a moving lift over a
    // pit, and the checkpoint set on a solid terrace so respawns are safe.
    name: 'TEMPLE STEPS',
    meta: {},
    map: mk(130, {
      0:  [[0, BR(130)]],
      1:  [[0, BR(130)]],
      5:  [[126, 'F']],
      6:  [[66, 'w'], [88, 'oo']],
      7:  [[84, '%%%%'], [122, 'j']],
      8:  [[54, '?'], [56, '?'], [88, 'j'], [96, G(16)], [112, '----'], [116, G(14)]],
      9:  [[34, 'U'], [50, 'C'], [56, 'j'], [72, 'e'], [82, G(30)], [116, G(14)]],
      10: [[38, 'e'], [46, G(14)], [61, 'M'], [64, G(48)], [116, G(14)]],
      11: [[24, 'j'], [32, G(28)], [64, G(48)], [116, G(14)]],
      12: [[3, 'P'], [10, 'e'], [18, G(42)], [64, G(48)], [116, G(14)]],
      13: [[0, G(60)], [64, G(48)], [116, G(14)]],
      14: [[0, G(60)], [64, G(48)], [116, G(14)]],
    }),
  },
  {
    // Terraced hollow under the canopy: dart frogs and idol turrets set up
    // crossfire over spike trenches between the stone terraces.
    name: "SERPENT'S HOLLOW",
    meta: {},
    map: mk(130, {
      0:  [[0, BR(130)]],
      1:  [[0, BR(130)]],
      4:  [[74, '*']],
      6:  [[34, 'w'], [96, 'w']],
      7:  [[52, 'ooo'], [116, 'j']],
      8:  [[51, '?'], [55, '?'], [80, 'oo'], [124, 'F']],
      9:  [[12, 'U'], [24, 'j'], [44, 'e'], [54, G(10)], [79, '%%%%'], [104, 'ooo']],
      10: [[16, 'ooo'], [30, G(12)], [54, G(10)], [66, 'j'], [90, 'e'], [100, G(14)]],
      11: [[15, 'e'], [30, G(12)], [54, G(10)], [100, G(14)]],
      12: [[3, 'P'], [10, 'e'], [22, '^^^'], [30, G(12)], [45, 'e'], [54, G(10)], [66, 'C'],
           [70, '^^^'], [86, 'e'], [93, '^^^'], [100, G(14)], [118, 'e']],
      13: [[0, G(46)], [50, G(28)], [82, G(48)]],
      14: [[0, G(46)], [50, G(28)], [82, G(48)]],
    }),
  },
  {
    // The great ascent to the shrine: a rising staircase of ruined terraces,
    // howlers swinging over the climbs, idols guarding each landing.
    name: 'VINE ASCENT',
    meta: {},
    map: mk(130, {
      0:  [[0, BR(130)]],
      1:  [[0, BR(130)]],
      3:  [[46, '*']],
      5:  [[70, 'w'], [126, 'F']],
      6:  [[90, 'oo']],
      7:  [[44, 'w'], [89, '%%%%']],
      8:  [[30, '?'], [32, '?'], [104, 'oo'], [122, G(8)]],
      9:  [[16, 'w'], [61, 'oo'], [114, 'j'], [116, G(14)]],
      10: [[8, 'U'], [26, 'oo'], [40, 'e'], [60, '%%%%'], [66, G(12)], [106, 'j'], [108, G(22)]],
      11: [[25, '%%%%'], [49, 'j'], [66, G(12)], [98, 'e'], [100, G(30)]],
      12: [[3, 'P'], [12, 'e'], [20, 'C'], [36, G(10)], [66, G(12)], [74, 'e'], [86, 'C'], [92, G(38)]],
      13: [[0, G(50)], [54, G(26)], [84, G(46)]],
      14: [[0, G(50)], [54, G(26)], [84, G(46)]],
    }),
  },
  {
    // A collapsed shrine, not an empty box. Two things here are load-bearing:
    //
    //  * The broken pillars. Coatl's coil-charge already ends the instant it
    //    hits a wall — that counterplay has existed in the code the whole time
    //    and could never once fire, because the arena was a flat rectangle with
    //    nothing to hit. Put a pillar between you and the charge and it breaks.
    //  * The stepped terraces. Its whipping vines erupt from whatever ground is
    //    actually beneath them now, so they climb the steps instead of all
    //    sprouting from one flat line.
    //
    // Modelled on GOLEM'S HOLLOW, the one arena whose geometry its boss's
    // mechanic depends on — and, not coincidentally, the best fight in the game.
    name: "COATL'S LAIR",
    meta: { boss: 'coatl' },
    map: mk(48, {
      0:  [[0, BR(48)]],
      1:  [[0, BR(48)]],
      4:  [[21, 'oooo']],
      8:  [[24, 'U']],
      9:  [[2, G(6)], [40, G(6)]],
      10: [[2, G(6)], [17, '||'], [30, '||'], [36, 'X'], [40, G(6)]],
      11: [[2, G(6)], [10, 'P'], [17, '||'], [30, '||'], [40, G(6)]],
      12: [[0, G(48)]],
      13: [[0, G(48)]],
      14: [[0, G(48)]],
    }),
  },
];
