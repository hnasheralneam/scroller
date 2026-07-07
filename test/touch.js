// Touch-control test: builds the overlay with a stub game, dispatches
// synthetic PointerEvents, and asserts the input singleton tracks them
// the same way keydown/keyup would. Reports into the DOM.
import { initTouch, isTouchUI } from '../src/touch.js';
import { input } from '../src/input.js';

const out = [];
let failures = 0;
function check(name, ok) {
  out.push(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failures++;
}

const gameStub = { paused: false };
initTouch(gameStub);

const root = document.getElementById('touch-ui');
function pev(type, id, x, y) {
  root.dispatchEvent(new PointerEvent(type, {
    pointerId: id, pointerType: 'touch', clientX: x, clientY: y,
    bubbles: true, isPrimary: id === 1,
  }));
}
function centerOf(cls) {
  const r = document.querySelector(`.tbtn.${cls}`).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

try {
  check('overlay hidden before any touch', !isTouchUI() || matchMedia('(pointer: coarse)').matches);

  // First touch shows the UI and, landing on empty space, acts as confirm.
  pev('pointerdown', 1, innerWidth / 2, 40);
  check('touch UI shown after first touch', isTouchUI());
  check('empty-space tap presses confirm', !!input.pressed.confirm && !!input.held.confirm);
  input.endFrame();
  check('confirm pressed cleared by endFrame', !input.justPressed('confirm'));
  pev('pointerup', 1, innerWidth / 2, 40);
  check('confirm released on pointerup', !input.held.confirm);

  // Multi-touch: hold left + jump with two pointers.
  const L = centerOf('b-left'), J = centerOf('b-jump'), R = centerOf('b-right');
  pev('pointerdown', 2, L.x, L.y);
  pev('pointerdown', 3, J.x, J.y);
  check('multi-touch: left held', input.isHeld('left'));
  check('multi-touch: jump held simultaneously', input.isHeld('jump'));
  check('jump justPressed on press', input.justPressed('jump'));
  input.endFrame();
  check('jump justPressed one tick only', !input.justPressed('jump') && input.isHeld('jump'));

  // Slide the movement thumb from left to right.
  pev('pointermove', 2, R.x, R.y);
  check('slide releases left', !input.isHeld('left'));
  check('slide presses right', input.isHeld('right') && input.justPressed('right'));
  input.endFrame();

  // Sliding must not re-fire justPressed while held.
  pev('pointermove', 2, R.x + 2, R.y + 2);
  check('no justPressed re-fire while held', !input.justPressed('right') && input.isHeld('right'));

  // pointercancel drops everything for that pointer.
  pev('pointercancel', 2, R.x, R.y);
  check('pointercancel releases right', !input.isHeld('right'));
  check('other pointer unaffected by cancel', input.isHeld('jump'));
  pev('pointerup', 3, J.x, J.y);
  check('jump released on pointerup', !input.isHeld('jump'));

  // Two pointers on the same button: releasing one keeps it held.
  pev('pointerdown', 4, J.x, J.y);
  pev('pointerdown', 5, J.x + 4, J.y + 4);
  pev('pointerup', 4, J.x, J.y);
  check('refcount: jump still held with second finger', input.isHeld('jump'));
  pev('pointerup', 5, J.x + 4, J.y + 4);
  check('refcount: jump released when both lift', !input.isHeld('jump'));

  // Tap while paused must not confirm.
  gameStub.paused = true;
  pev('pointerdown', 6, innerWidth / 2, 40);
  check('paused: empty tap does not confirm', !input.held.confirm);
  pev('pointerup', 6, innerWidth / 2, 40);
  gameStub.paused = false;

  // Pause button maps to pause action.
  const P = centerOf('b-pause');
  pev('pointerdown', 7, P.x, P.y);
  check('pause button presses pause', input.justPressed('pause'));
  pev('pointerup', 7, P.x, P.y);
  input.endFrame();

  // window blur clears touch holds (keeps refcounts in sync with input.js).
  pev('pointerdown', 8, L.x, L.y);
  window.dispatchEvent(new Event('blur'));
  check('blur clears touch holds', !input.isHeld('left'));
} catch (e) {
  out.push(`ERROR: ${e.message}\n${e.stack}`);
  failures++;
}

document.title = failures === 0 ? 'OK' : 'FAIL';
document.body.textContent = out.join('\n') + `\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'}`;
document.body.style.whiteSpace = 'pre';
