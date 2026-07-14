// Camera follow behaviour.
//
// Exercised against a synthetic TALL level, because all 35 shipped levels are
// exactly one screen high (pxHeight === VIEW_H), which pins camera.y to 0 via
// clampY and makes every vertical assertion below vacuous. The vertical
// behaviour is real code with no content asking for it yet.
import { Camera } from '../src/camera.js';
import { VIEW_W, VIEW_H, TILE } from '../src/constants.js';

const out = [];
let failures = 0;
function check(name, ok, detail = '') {
  out.push(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const level = (wTiles, hTiles) => ({
  pxWidth: wTiles * TILE,
  pxHeight: hTiles * TILE,
});
const actor = (x, y, { facing = 1, onGround = true } = {}) =>
  ({ x, y, w: 12, h: 16, facing, onGround });

const settle = (cam, a, n = 200) => { for (let i = 0; i < n; i++) cam.follow(a); };

try {
  // A tall level, so clampY isn't pinning everything to 0.
  const tall = level(40, 60); // 640 x 960 px
  check('the test level is actually taller than the view', tall.pxHeight > VIEW_H);

  // --- vertical: a jump must not move the camera ---------------------------
  {
    const cam = new Camera(tall);
    const a = actor(200, 500);
    cam.snapTo(a);
    settle(cam, a);
    const restY = cam.y;

    // Arc the player up ~3.5 tiles (a full jump) and back down, airborne.
    let moved = 0;
    for (const dy of [-8, -20, -36, -50, -56, -50, -36, -20, -8, 0]) {
      a.y = 500 + dy;
      a.onGround = false;
      cam.follow(a);
      moved = Math.max(moved, Math.abs(cam.y - restY));
    }
    check('a full jump does not bob the camera', moved < 1, `camera moved ${moved.toFixed(1)}px`);
  }

  // --- vertical: a real fall must still be tracked -------------------------
  {
    const cam = new Camera(tall);
    const a = actor(200, 200);
    cam.snapTo(a);
    settle(cam, a);
    const startY = cam.y;

    a.onGround = false;
    for (let i = 0; i < 60; i++) { a.y += 8; cam.follow(a); } // fall ~24 tiles
    check('a long fall is tracked', cam.y - startY > 200, `camera moved ${(cam.y - startY).toFixed(1)}px`);
  }

  // --- vertical: landing re-anchors ---------------------------------------
  {
    const cam = new Camera(tall);
    const a = actor(200, 500);
    cam.snapTo(a);
    settle(cam, a);

    a.y = 380; // landed two tiles higher up a staircase
    a.onGround = true;
    settle(cam, a);
    const want = a.y + a.h / 2 - VIEW_H / 2 - 12;
    check('landing re-anchors the camera', Math.abs(cam.y - want) < 1.5,
      `camera y=${cam.y.toFixed(1)}, want ~${want.toFixed(1)}`);
  }

  // --- horizontal: lookahead eases instead of whipping ---------------------
  {
    const cam = new Camera(tall);
    const a = actor(300, 500, { facing: 1 });
    cam.snapTo(a);
    settle(cam, a);
    const before = cam.x;

    a.facing = -1;               // tap the other way, don't actually move
    const step1 = Math.abs((cam.follow(a), cam.x) - before);
    check('a facing flip does not whip the camera', step1 < 3,
      `camera jumped ${step1.toFixed(1)}px in one frame`);

    settle(cam, a);              // ...but it does get there eventually
    check('the lookahead still swings to the new facing', cam.x < before - 20,
      `camera x moved ${(cam.x - before).toFixed(1)}px`);
  }

  // --- horizontal: the camera comes to rest --------------------------------
  {
    const cam = new Camera(tall);
    const a = actor(300, 500);
    cam.snapTo(a);
    settle(cam, a);
    const a1 = cam.x;
    cam.follow(a);
    check('a stationary player leaves the camera at rest', cam.x === a1);
  }

  // --- clamping still holds ------------------------------------------------
  {
    const cam = new Camera(tall);
    const a = actor(0, 0);
    cam.snapTo(a);
    settle(cam, a);
    check('camera clamps to the top-left', cam.x >= 0 && cam.y >= 0,
      `x=${cam.x.toFixed(1)} y=${cam.y.toFixed(1)}`);

    const b = actor(tall.pxWidth, tall.pxHeight);
    cam.snapTo(b);
    settle(cam, b);
    check('camera clamps to the bottom-right',
      cam.x <= tall.pxWidth - VIEW_W + 0.01 && cam.y <= tall.pxHeight - VIEW_H + 0.01,
      `x=${cam.x.toFixed(1)} y=${cam.y.toFixed(1)}`);
  }

  // --- a one-screen-tall level still pins y to 0 ---------------------------
  {
    const flat = level(120, 15); // exactly the shipped level shape
    const cam = new Camera(flat);
    const a = actor(300, 190);
    cam.snapTo(a);
    a.onGround = false;
    a.y = 40;
    settle(cam, a);
    check('a one-screen-tall level keeps y pinned at 0', cam.y === 0, `y=${cam.y}`);
  }
} catch (e) {
  out.push(`ERROR: ${e.message}\n${e.stack}`);
  failures++;
}

document.title = failures === 0 ? 'ALLPASS' : 'FAIL';
document.body.textContent = out.join('\n') + `\n\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'}`;
document.body.style.whiteSpace = 'pre';
