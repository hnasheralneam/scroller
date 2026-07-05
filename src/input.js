// Keyboard input with held / just-pressed tracking.
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowDown: 'down', KeyS: 'down',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump',
  KeyX: 'shoot', KeyK: 'shoot', ShiftLeft: 'shoot', ShiftRight: 'shoot',
  Enter: 'confirm',
  Escape: 'pause', KeyP: 'pause',
};

class Input {
  constructor() {
    this.held = {};
    this.pressed = {};
    window.addEventListener('keydown', (e) => {
      const action = KEYMAP[e.code];
      if (!action) return;
      e.preventDefault();
      if (!this.held[action]) this.pressed[action] = true;
      this.held[action] = true;
    });
    window.addEventListener('keyup', (e) => {
      const action = KEYMAP[e.code];
      if (!action) return;
      this.held[action] = false;
    });
    window.addEventListener('blur', () => { this.held = {}; });
  }

  // Call once at the end of each update tick.
  endFrame() {
    this.pressed = {};
  }

  isHeld(action) { return !!this.held[action]; }
  justPressed(action) { return !!this.pressed[action]; }
}

export const input = new Input();
