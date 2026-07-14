// Keyboard input with held / just-pressed tracking.
// A key may map to several actions (ArrowUp is both jump and menu-up).
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down',
  ArrowUp: ['jump', 'up'], KeyW: ['jump', 'up'], Space: 'jump', KeyZ: 'jump',
  KeyX: 'shoot', KeyK: 'shoot', ShiftLeft: 'shoot', ShiftRight: 'shoot',
  Enter: 'confirm',
  Escape: 'pause', KeyP: 'pause',
};

class Input {
  constructor() {
    this.held = {};
    this.pressed = {};
    // How many sources currently hold each action. Several keys map to one
    // action (ArrowLeft and KeyA are both `left`), and touch.js presses the
    // same actions from its own pointers — without counting, releasing any one
    // of them would clear an action the others are still holding.
    this.counts = {};

    window.addEventListener('keydown', (e) => {
      const mapped = KEYMAP[e.code];
      if (!mapped) return;
      e.preventDefault();
      if (e.repeat) return; // auto-repeat must not inflate the count
      for (const action of [].concat(mapped)) this.press(action);
    });
    window.addEventListener('keyup', (e) => {
      const mapped = KEYMAP[e.code];
      if (!mapped) return;
      for (const action of [].concat(mapped)) this.release(action);
    });
    // Focus loss never delivers the matching keyup, so drop everything rather
    // than leave an action stuck on. `pressed` has to go too: a justPressed
    // latched on the frame we lost focus would otherwise fire on return.
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') this.clear();
    });
  }

  press(action) {
    this.counts[action] = (this.counts[action] || 0) + 1;
    if (this.counts[action] === 1) {
      if (!this.held[action]) this.pressed[action] = true;
      this.held[action] = true;
    }
  }

  release(action) {
    this.counts[action] = Math.max(0, (this.counts[action] || 0) - 1);
    if (this.counts[action] === 0) this.held[action] = false;
  }

  clear() {
    this.held = {};
    this.pressed = {};
    this.counts = {};
  }

  // Call once at the end of each update tick.
  endFrame() {
    this.pressed = {};
  }

  isHeld(action) { return !!this.held[action]; }
  justPressed(action) { return !!this.pressed[action]; }
}

export const input = new Input();
