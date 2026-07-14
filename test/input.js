// Keyboard input + pause menu navigation.
//
// Both areas had bugs that a synthetic keypress catches instantly:
//   - several keys map to one action, and releasing any one of them used to
//     clear the action even while another was still physically held;
//   - ArrowUp means both `up` and `jump`, so pressing it in the pause menu
//     moved the cursor AND confirmed the item it landed on.
import { input } from '../src/input.js';
import { PauseMenu } from '../src/pausemenu.js';

const out = [];
let failures = 0;
function check(name, ok, detail = '') {
  out.push(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const key = (type, code, repeat = false) =>
  window.dispatchEvent(new KeyboardEvent(type, { code, repeat, bubbles: true }));

try {
  // --- aliased keys are ref-counted ---------------------------------------
  input.clear();
  key('keydown', 'ArrowRight');
  key('keydown', 'KeyD');            // same action, second source
  key('keyup', 'KeyD');              // release one...
  check('holding ArrowRight survives releasing KeyD', input.isHeld('right'));
  key('keyup', 'ArrowRight');        // ...release the other
  check('releasing both clears the action', !input.isHeld('right'));

  // The jump case that collapsed a jump mid-ascent: Space held, ArrowUp tapped.
  input.clear();
  key('keydown', 'Space');
  key('keydown', 'ArrowUp');
  key('keyup', 'ArrowUp');
  check('holding Space survives a tapped ArrowUp', input.isHeld('jump'));

  // Auto-repeat must not inflate the count (or one keyup would never clear it).
  input.clear();
  key('keydown', 'KeyA');
  key('keydown', 'KeyA', true);
  key('keydown', 'KeyA', true);
  key('keyup', 'KeyA');
  check('auto-repeat does not stick the action on', !input.isHeld('left'));

  // --- focus loss ----------------------------------------------------------
  input.clear();
  key('keydown', 'ArrowLeft');
  window.dispatchEvent(new Event('blur'));
  check('blur clears held', !input.isHeld('left'));

  input.clear();
  key('keydown', 'Space');           // latches pressed AND held
  window.dispatchEvent(new Event('blur'));
  check('blur clears pressed too', !input.justPressed('jump'));

  // A key still down across a blur must not be stuck when focus returns.
  input.clear();
  key('keydown', 'ArrowRight');
  window.dispatchEvent(new Event('blur'));
  key('keydown', 'ArrowRight');      // fresh press after refocus
  key('keyup', 'ArrowRight');
  check('a key held across blur is not stuck after refocus', !input.isHeld('right'));

  // --- pause menu navigation ----------------------------------------------
  // Main screen, cursor on SETTINGS (1). ArrowUp should land on RESUME (0)
  // and NOT activate it — update() returning false means "close the menu".
  const menu = new PauseMenu({ save: { musicVol: 7, sfxVol: 7 }, paused: true });
  menu.screen = 'main';
  menu.cursor = 1;
  input.clear();
  key('keydown', 'ArrowUp');
  const stayedOpen = menu.update();
  check('ArrowUp moves the pause cursor without confirming',
    stayedOpen !== false && menu.cursor === 0,
    `update()=${stayedOpen}, cursor=${menu.cursor}`);

  // Space (jump only, never `up`) must still confirm RESUME.
  input.clear();
  key('keydown', 'Space');
  const closed = menu.update();
  check('Space still confirms the pause selection', closed === false, `update()=${closed}`);

  // Enter must still confirm too.
  menu.screen = 'main';
  menu.cursor = 0;
  input.clear();
  key('keydown', 'Enter');
  check('Enter still confirms the pause selection', menu.update() === false);
} catch (e) {
  out.push(`ERROR: ${e.message}\n${e.stack}`);
  failures++;
}

document.title = failures === 0 ? 'ALLPASS' : 'FAIL';
document.body.textContent = out.join('\n') + `\n\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'}`;
document.body.style.whiteSpace = 'pre';
