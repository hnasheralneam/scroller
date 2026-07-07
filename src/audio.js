// Chiptune sound effects generated with WebAudio oscillators. No assets.
// Two gain buses (sfx / music) hang off the destination so the settings
// menu can control volumes independently.
let ctx = null;
let sfxBus = null;
let musicBus = null;

let sfxLevel = 0.49;   // (7/10)^2 defaults; overwritten from the save at boot
let musicLevel = 0.49;
let musicDuck = 1;     // 0.5 while paused

let unlocked = false;
const unlockCbs = [];

export function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxLevel;
    sfxBus.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = musicLevel * musicDuck;
    musicBus.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function musicGain() { ac(); return musicBus; }

// Perceptual volume curve: v in 0..10 -> gain
const curve = v => (Math.max(0, Math.min(10, v)) / 10) ** 2;

export function setSfxVolume(v) {
  sfxLevel = curve(v);
  if (sfxBus) sfxBus.gain.value = sfxLevel;
}
export function setMusicVolume(v) {
  musicLevel = curve(v);
  if (musicBus) musicBus.gain.value = musicLevel * musicDuck;
}
export function setMusicDuck(d) {
  musicDuck = d;
  if (musicBus) musicBus.gain.value = musicLevel * musicDuck;
}

export function isUnlocked() { return unlocked; }
export function onUnlock(cb) {
  if (unlocked) cb();
  else unlockCbs.push(cb);
}

// Unlock audio on first user interaction (browser autoplay policy)
const unlockEvents = ['keydown', 'mousedown', 'touchstart', 'pointerdown', 'click'];
function unlock() {
  try { ac(); } catch (e) { return; }
  unlocked = true;
  for (const cb of unlockCbs) cb();
  unlockCbs.length = 0;
  unlockEvents.forEach(e => window.removeEventListener(e, unlock));
}
unlockEvents.forEach(e => window.addEventListener(e, unlock));

function beep(freq, dur, { type = 'square', vol = 0.12, slide = 0, delay = 0 } = {}) {
  try {
    const a = ac();
    const t0 = a.currentTime + delay;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch (e) { /* audio unavailable */ }
}

function noise(dur, { vol = 0.1, delay = 0 } = {}) {
  try {
    const a = ac();
    const t0 = a.currentTime + delay;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const gain = a.createGain();
    gain.gain.setValueAtTime(vol, t0);
    src.connect(gain).connect(sfxBus);
    src.start(t0);
  } catch (e) { /* audio unavailable */ }
}

export const sfx = {
  jump()       { beep(300, 0.12, { slide: 300 }); },
  doubleJump() { beep(400, 0.12, { slide: 380, type: 'triangle', vol: 0.16 }); },
  swim()       { beep(340, 0.1, { slide: 160, type: 'sine', vol: 0.12 }); },
  coin()       { beep(988, 0.06, { vol: 0.09 }); beep(1319, 0.14, { vol: 0.09, delay: 0.06 }); },
  stomp()      { noise(0.1, { vol: 0.14 }); beep(180, 0.1, { slide: -120 }); },
  shoot()      { beep(700, 0.08, { slide: -300, type: 'sawtooth', vol: 0.08 }); },
  bounce()     { beep(240, 0.08, { slide: 120 }); },
  powerup()    { [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.1, { delay: i * 0.07, vol: 0.1 })); },
  oneUp()      { [659, 784, 1319, 1568].forEach((f, i) => beep(f, 0.12, { delay: i * 0.09, vol: 0.1 })); },
  hurt()       { beep(280, 0.2, { slide: -180, type: 'sawtooth', vol: 0.12 }); },
  die()        { [520, 392, 330, 262, 196].forEach((f, i) => beep(f, 0.14, { delay: i * 0.1, vol: 0.1 })); },
  breakBlock() { noise(0.15, { vol: 0.16 }); },
  bump()       { beep(140, 0.08, { vol: 0.1 }); },
  glitch()     { for (let i = 0; i < 10; i++) beep(200 + Math.random() * 1400, 0.05, { delay: i * 0.045, type: 'sawtooth', vol: 0.07 }); },
  glitchEnd()  { [900, 700, 500, 300].forEach((f, i) => beep(f, 0.08, { delay: i * 0.07, type: 'sawtooth', vol: 0.07 })); },
  zap()        { beep(1200, 0.15, { slide: -900, type: 'sawtooth', vol: 0.1 }); },
  explode()    { noise(0.35, { vol: 0.2 }); beep(90, 0.3, { slide: -50, vol: 0.14 }); },
  bossHit()    { beep(220, 0.15, { slide: -100, type: 'sawtooth', vol: 0.14 }); noise(0.1, { vol: 0.1 }); },
  bossDie()    { for (let i = 0; i < 6; i++) { noise(0.2, { delay: i * 0.15, vol: 0.15 }); beep(160 - i * 15, 0.18, { delay: i * 0.15, vol: 0.1 }); } },
  roar()       { beep(90, 0.5, { slide: 60, type: 'sawtooth', vol: 0.16 }); },
  warn()       { beep(520, 0.09, { slide: -160, type: 'triangle', vol: 0.1 }); },
  flag()       { [523, 587, 659, 784, 880, 1047].forEach((f, i) => beep(f, 0.11, { delay: i * 0.08, vol: 0.1 })); },
  checkpoint() { beep(659, 0.1); beep(880, 0.16, { delay: 0.08 }); },
  select()     { beep(660, 0.06, { vol: 0.08 }); },
  confirm()    { beep(523, 0.07); beep(784, 0.12, { delay: 0.06 }); },
};
