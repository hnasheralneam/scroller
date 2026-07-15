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
    // The one level in the game that goes UP.
    //
    // mk() has always taken a height and camera.clampY has always worked, but
    // all 35 levels used the 15-tile default, so pxHeight === VIEW_H, camera.y
    // was pinned at 0 forever, and the whole vertical axis sat unused. This is
    // 30 tiles tall: two screens of switchback climb up a collapsed shrine
    // shaft, and the level this one was always named for.
    //
    // The climb is one-way platforms on purpose — you jump up through them from
    // underneath, so the route never bonks its own ceiling. The summit has to be
    // real ground rather than a platform (Flag's pole scans down for solid tiles
    // and would otherwise stretch 25 tiles to the floor), so it's set off to the
    // left and taken from the side.
    //
    // Steps are 3 rows apart and <=2 columns offset, which is what test/reach.js
    // derives as the real jump envelope. It BFSes this and proves the flag is
    // reachable; note it does NOT model ceilings, so the headroom above each
    // launch column is checked by hand.
    name: 'VINE ASCENT',
    meta: {},
    map: mk(26, {
      0:  [[0, BR(26)]],
      1:  [[0, BR(26)]],
      // summit shrine — solid ground, entered from the right
      3:  [[6, 'F']],
      4:  [[4, G(8)]],
      6:  [[17, 'w']],
      7:  [[12, '----'], [20, 'oo']],
      9:  [[9, '?'], [11, '?']],
      10: [[13, '----']],
      12: [[22, '*']],
      13: [[16, '----'], [8, 'oo']],
      15: [[20, 'C'], [23, 'o']],
      16: [[19, '----']],
      18: [[15, 'j']],
      19: [[14, '----']],
      20: [[9, '??'], [18, 'oo']],
      21: [[10, 'e']],
      22: [[9, '----']],
      23: [[16, 'oo']],
      24: [[5, 'e']],
      25: [[4, '----']],
      26: [[10, 'U'], [19, 'oo']],
      27: [[3, 'P'], [21, 'e']],
      28: [[0, G(26)]],
      29: [[0, G(26)]],
    }, 30),
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
