// Sparse level-map builder. `rows` maps a row index (0 = top) to a list of
// [column, string] placements. Unspecified cells are empty.
export function mk(width, rows, height = 15) {
  const map = [];
  for (let y = 0; y < height; y++) {
    const a = new Array(width).fill('.');
    for (const [col, str] of (rows[y] || [])) {
      for (let i = 0; i < str.length; i++) {
        if (col + i < width) a[col + i] = str[i];
      }
    }
    map.push(a.join(''));
  }
  return map;
}

export const G = n => '#'.repeat(n); // ground run
export const BR = n => 'B'.repeat(n); // brick run
export const LV = n => '~'.repeat(n); // lava run
