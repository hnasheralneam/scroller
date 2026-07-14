import { LEVELS } from './levels/index.js';

const KEY = 'pixel-scroller-save-v2';
const VERSION = 2;

const DEFAULTS = { version: VERSION, unlocked: 0, musicVol: 7, sfxVol: 7 };

// Strict on purpose: Number() coerces null, '', [] and false to 0, so a
// musicVol of null would quietly mute the game instead of falling back to the
// default. Only a real, finite number is accepted.
const clampInt = (v, lo, hi, fallback) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, Math.floor(v)));
};

// Coerce every field independently. The old code validated `unlocked` and then
// spread the rest of the stored object over the defaults unchecked, so a save
// with e.g. musicVol:"loud" set musicLevel = NaN. That survives boot (the gain
// buses don't exist yet), and then on the first user gesture ac() throws
// TypeError setting a non-finite AudioParam — after creating musicBus but
// before connecting it. unlock() swallows the throw, the next gesture skips
// construction and "succeeds", and the game plays on with music permanently
// silent through an orphaned node. Nothing surfaces; the music just never
// starts. Anything unparseable falls back to its default instead.
function sanitize(data) {
  return {
    version: VERSION,
    // `unlocked` is a count, not an index: main.js stores `levelIndex + 1`, so
    // clearing the final level legitimately stores LEVELS.length. Clamping to
    // length - 1 here would quietly revoke a completed game.
    unlocked: clampInt(data.unlocked, 0, LEVELS.length, DEFAULTS.unlocked),
    musicVol: clampInt(data.musicVol, 0, 10, DEFAULTS.musicVol),
    sfxVol: clampInt(data.sfxVol, 0, 10, DEFAULTS.sfxVol),
  };
}

// v1 had no `version` field. It shares this key's shape closely enough that
// sanitize() alone migrates it; the field exists so the next change has a hook.
function migrate(data) {
  return sanitize(data);
}

export function loadSave() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data && typeof data === 'object') return migrate(data);
  } catch (e) { /* corrupted save or storage unavailable */ }
  return { ...DEFAULTS };
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitize(data)));
  } catch (e) { /* storage unavailable (private mode, blocked iframe) */ }
}
