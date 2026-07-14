// On-screen touch controls: a DOM overlay whose buttons drive the input
// singleton exactly like keydown/keyup does. Button faces are pixel-art
// canvases (makeSprite + the game palette) scaled up with
// image-rendering: pixelated so they match the game's art.
import { input } from './input.js';
import { makeSprite, drawText, textWidth } from './sprites.js';

// Chunky 7px arrow / glyph art, one color key: g = gold accent.
const GLYPHS = {
  left: [
    '.....gg',
    '...gggg',
    '.gggggg',
    'ggggggg',
    '.gggggg',
    '...gggg',
    '.....gg',
  ],
  right: [
    'gg.....',
    'gggg...',
    'gggggg.',
    'ggggggg',
    'gggggg.',
    'gggg...',
    'gg.....',
  ],
  down: [
    'ggggggg',
    'ggggggg',
    '.ggggg.',
    '..ggg..',
    '...g...',
  ],
  // A / B in the same 3x5 grid as the game font, drawn 2x
  jump: ['.g.', 'g.g', 'ggg', 'g.g', 'g.g'],
  shoot: ['gg.', 'g.g', 'gg.', 'g.g', 'gg.'],
  pause: ['gg.gg', 'gg.gg', 'gg.gg', 'gg.gg', 'gg.gg'],
};

const GOLD = '#ffd23e';
const SLATE = '#9aa4b5';
const INK = 'rgba(10,12,20,0.6)';

// Build a 16x16 pixel button face: notched-corner bezel, dark fill,
// glyph stamped in the middle. Returned canvas is CSS-scaled by the caller.
function makeButtonFace(glyphRows, glyphScale, glyphColor = GOLD) {
  const SZ = 16;
  const c = document.createElement('canvas');
  c.width = SZ;
  c.height = SZ;
  const g = c.getContext('2d');
  // interior fill (skip the 1px frame)
  g.fillStyle = INK;
  g.fillRect(1, 1, SZ - 2, SZ - 2);
  // bezel with notched corners, pixel-rounded
  g.fillStyle = SLATE;
  g.fillRect(2, 0, SZ - 4, 1);
  g.fillRect(2, SZ - 1, SZ - 4, 1);
  g.fillRect(0, 2, 1, SZ - 4);
  g.fillRect(SZ - 1, 2, 1, SZ - 4);
  g.fillRect(1, 1, 1, 1);
  g.fillRect(SZ - 2, 1, 1, 1);
  g.fillRect(1, SZ - 2, 1, 1);
  g.fillRect(SZ - 2, SZ - 2, 1, 1);
  const spr = makeSprite(glyphRows, { g: glyphColor }, glyphScale);
  g.drawImage(spr, Math.round((SZ - spr.width) / 2), Math.round((SZ - spr.height) / 2));
  return c;
}

// Pixel-font text rendered to a canvas so DOM hints use the game font.
function makeTextCanvas(str, color = '#fff') {
  const c = document.createElement('canvas');
  c.width = textWidth(str) + 2;
  c.height = 7;
  const g = c.getContext('2d');
  drawText(g, str, 1, 1, color);
  return c;
}

const CSS = `
#touch-ui {
  position: fixed;
  inset: 0;
  display: none;
  z-index: 10;
  touch-action: none;
}
#touch-ui.on { display: block; }
#touch-ui .tbtn {
  position: absolute;
  pointer-events: none;
  opacity: 0.45;
}
#touch-ui .tbtn.pressed { opacity: 0.9; }
#touch-ui .tbtn canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}
#touch-ui .tbtn.b-left  { left:  calc(14px + env(safe-area-inset-left));  bottom: calc(16px + env(safe-area-inset-bottom)); width: 64px; height: 64px; }
#touch-ui .tbtn.b-down  { left:  calc(86px + env(safe-area-inset-left));  bottom: calc(16px + env(safe-area-inset-bottom)); width: 64px; height: 64px; }
#touch-ui .tbtn.b-right { left:  calc(158px + env(safe-area-inset-left)); bottom: calc(16px + env(safe-area-inset-bottom)); width: 64px; height: 64px; }
#touch-ui .tbtn.b-jump  { right: calc(14px + env(safe-area-inset-right)); bottom: calc(16px + env(safe-area-inset-bottom)); width: 80px; height: 80px; }
#touch-ui .tbtn.b-shoot { right: calc(102px + env(safe-area-inset-right)); bottom: calc(44px + env(safe-area-inset-bottom)); width: 64px; height: 64px; }
#touch-ui .tbtn.b-pause { right: calc(10px + env(safe-area-inset-right)); top: calc(10px + env(safe-area-inset-top)); width: 48px; height: 48px; }
@media (max-width: 519px) {
  #touch-ui .tbtn.b-left  { left: calc(8px + env(safe-area-inset-left)); width: 48px; height: 48px; }
  #touch-ui .tbtn.b-down  { left: calc(62px + env(safe-area-inset-left)); width: 48px; height: 48px; }
  #touch-ui .tbtn.b-right { left: calc(116px + env(safe-area-inset-left)); width: 48px; height: 48px; }
  #touch-ui .tbtn.b-jump  { right: calc(8px + env(safe-area-inset-right)); width: 64px; height: 64px; }
  #touch-ui .tbtn.b-shoot { right: calc(78px + env(safe-area-inset-right)); bottom: calc(36px + env(safe-area-inset-bottom)); width: 48px; height: 48px; }
}
#rotate-hint {
  position: fixed;
  left: 50%;
  top: 12px;
  transform: translateX(-50%);
  display: none;
  z-index: 11;
  padding: 6px 10px;
  background: rgba(0,0,0,0.65);
  border: 2px solid ${SLATE};
  pointer-events: none;
}
#rotate-hint.on { display: block; }
#rotate-hint canvas { display: block; height: 14px; image-rendering: pixelated; }
`;

const BUTTONS = [
  { cls: 'b-left', action: 'left', glyph: GLYPHS.left, scale: 1 },
  { cls: 'b-down', action: 'down', glyph: GLYPHS.down, scale: 1 },
  { cls: 'b-right', action: 'right', glyph: GLYPHS.right, scale: 1 },
  { cls: 'b-jump', action: 'jump', glyph: GLYPHS.jump, scale: 2 },
  { cls: 'b-shoot', action: 'shoot', glyph: GLYPHS.shoot, scale: 2 },
  { cls: 'b-pause', action: 'pause', glyph: GLYPHS.pause, scale: 2, color: SLATE },
];

const HIT_SLOP = 10; // px of forgiveness around each button

let touchUI = false;
export function isTouchUI() { return touchUI; }

export function initTouch(game) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'touch-ui';
  const btnEls = {}; // action -> element
  for (const def of BUTTONS) {
    const el = document.createElement('div');
    el.className = `tbtn ${def.cls}`;
    el.appendChild(makeButtonFace(def.glyph, def.scale, def.color || GOLD));
    root.appendChild(el);
    btnEls[def.action] = el;
  }
  document.body.appendChild(root);

  const hint = document.createElement('div');
  hint.id = 'rotate-hint';
  hint.appendChild(makeTextCanvas('ROTATE FOR BEST VIEW', GOLD));
  document.body.appendChild(hint);

  // ---- hit rects (cached; recomputed on layout changes) -------------------
  let rects = null;
  function computeRects() {
    rects = BUTTONS.map(def => {
      const r = btnEls[def.action].getBoundingClientRect();
      return {
        action: def.action,
        x0: r.left - HIT_SLOP, y0: r.top - HIT_SLOP,
        x1: r.right + HIT_SLOP, y1: r.bottom + HIT_SLOP,
      };
    });
  }
  function hitTest(x, y) {
    if (!rects) computeRects();
    const out = new Set();
    for (const r of rects) {
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) out.add(r.action);
    }
    return out;
  }

  // ---- action press/release, ref-counted across pointers ------------------
  // Counts pointers per action locally (for the button highlight), and defers
  // the actual held/pressed bookkeeping to input.js, which counts across every
  // source — so a key and a touch holding the same action can't clear it out
  // from under each other.
  const holdCounts = {};
  function press(a) {
    holdCounts[a] = (holdCounts[a] || 0) + 1;
    if (holdCounts[a] === 1) {
      input.press(a);
      btnEls[a] && btnEls[a].classList.add('pressed');
    }
  }
  function release(a) {
    holdCounts[a] = Math.max(0, (holdCounts[a] || 0) - 1);
    if (holdCounts[a] === 0) {
      input.release(a);
      btnEls[a] && btnEls[a].classList.remove('pressed');
    }
  }

  const pointerActions = new Map(); // pointerId -> Set(action)
  function setPointerActions(id, next) {
    const prev = pointerActions.get(id) || new Set();
    for (const a of next) if (!prev.has(a)) press(a);
    for (const a of prev) if (!next.has(a)) release(a);
    pointerActions.set(id, next);
  }
  function dropPointer(id) {
    const prev = pointerActions.get(id);
    if (!prev) return;
    for (const a of prev) release(a);
    pointerActions.delete(id);
  }
  function dropAll() {
    for (const id of [...pointerActions.keys()]) dropPointer(id);
  }

  root.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    try { root.setPointerCapture(e.pointerId); } catch { /* detached */ }
    const actions = hitTest(e.clientX, e.clientY);
    // A tap on empty screen acts as confirm (advance title / skip intros).
    // Gated while paused so stray taps don't activate menu items.
    if (actions.size === 0 && !game.paused) actions.add('confirm');
    setPointerActions(e.pointerId, actions);
  });
  root.addEventListener('pointermove', (e) => {
    if (!pointerActions.has(e.pointerId)) return;
    const prev = pointerActions.get(e.pointerId);
    const next = hitTest(e.clientX, e.clientY);
    // confirm is tap-scoped: keep it for the life of its pointer, and never
    // acquire it by sliding.
    if (prev.has('confirm')) next.add('confirm');
    setPointerActions(e.pointerId, next);
  });
  const end = (e) => dropPointer(e.pointerId);
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  root.addEventListener('lostpointercapture', end);

  // input.js drops all held state on blur/hide; release our pointers too so the
  // local refcounts (and the button highlights) don't survive the reset.
  window.addEventListener('blur', dropAll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') dropAll();
  });
  window.addEventListener('contextmenu', (e) => {
    if (touchUI) e.preventDefault();
  });

  // ---- show/hide + rotate hint --------------------------------------------
  function updateHint() {
    const portrait = matchMedia('(orientation: portrait)').matches;
    hint.classList.toggle('on', touchUI && portrait);
  }
  function show() {
    if (touchUI) return;
    touchUI = true;
    root.classList.add('on');
    computeRects();
    updateHint();
  }
  // #touch is a dev shortcut to preview the overlay on desktop.
  if (matchMedia('(pointer: coarse)').matches || location.hash.includes('touch')) show();
  // Hybrid devices: a fine primary pointer but the user touches the screen.
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') show();
  }, { capture: true });

  const relayout = () => { rects = null; updateHint(); };
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
}
