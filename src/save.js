const KEY = 'pixel-scroller-save-v2';

const DEFAULTS = { unlocked: 0, musicVol: 7, sfxVol: 7 };

export function loadSave() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data && typeof data.unlocked === 'number') return { ...DEFAULTS, ...data };
  } catch (e) { /* corrupted save */ }
  return { ...DEFAULTS };
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable */ }
}
