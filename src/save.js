const KEY = 'pixel-scroller-save-v1';

export function loadSave() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data && typeof data.unlocked === 'number') return data;
  } catch (e) { /* corrupted save */ }
  return { unlocked: 0 };
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable */ }
}
