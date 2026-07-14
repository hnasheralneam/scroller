// Save load/write hardening.
//
// loadSave used to check only `typeof data.unlocked === 'number'` and then
// spread the rest of the stored object over the defaults unchecked. A save with
// musicVol:"loud" therefore set musicLevel = NaN, which later made ac() throw
// while wiring the gain buses — leaving music permanently silent through a
// node that was created but never connected, with nothing surfaced to the
// player. Every field is coerced independently now.
import { loadSave, writeSave } from '../src/save.js';
import { LEVELS } from '../src/levels/index.js';

const KEY = 'pixel-scroller-save-v2';
const out = [];
let failures = 0;
function check(name, ok, detail = '') {
  out.push(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}
const put = v => localStorage.setItem(KEY, typeof v === 'string' ? v : JSON.stringify(v));
const numeric = s => ['unlocked', 'musicVol', 'sfxVol'].every(k => Number.isFinite(s[k]));

try {
  // --- the payload that used to brick boot --------------------------------
  put({ unlocked: 0, musicVol: 'loud' });
  let s = loadSave();
  check('a non-numeric volume never survives load', numeric(s), JSON.stringify(s));
  check('a non-numeric volume falls back to the default', s.musicVol === 7, `got ${s.musicVol}`);

  put({ unlocked: 3, musicVol: null, sfxVol: undefined });
  s = loadSave();
  check('null/undefined volumes fall back', numeric(s) && s.musicVol === 7 && s.sfxVol === 7);

  put({ unlocked: 2, musicVol: NaN }); // serialises to null
  s = loadSave();
  check('NaN volume falls back', Number.isFinite(s.musicVol));

  // --- range clamping ------------------------------------------------------
  put({ unlocked: 9999, musicVol: 99, sfxVol: -5 });
  s = loadSave();
  check('unlocked clamps to the level count', s.unlocked === LEVELS.length, `got ${s.unlocked}`);
  check('volumes clamp into 0..10', s.musicVol === 10 && s.sfxVol === 0,
    `music=${s.musicVol} sfx=${s.sfxVol}`);

  put({ unlocked: -5 });
  check('negative unlocked clamps to 0', loadSave().unlocked === 0);

  // A completed game stores unlocked === LEVELS.length (main.js writes
  // index + 1), so that value has to round-trip intact.
  put({ unlocked: LEVELS.length, musicVol: 7, sfxVol: 7 });
  check('a completed game round-trips', loadSave().unlocked === LEVELS.length);

  // --- corrupt / absent data ----------------------------------------------
  put('}{ not json');
  s = loadSave();
  check('unparseable json falls back to defaults', s.unlocked === 0 && numeric(s));

  localStorage.removeItem(KEY);
  s = loadSave();
  check('absent save falls back to defaults', s.unlocked === 0 && s.musicVol === 7);

  put('null');
  check('literal null falls back to defaults', loadSave().unlocked === 0);

  put([1, 2, 3]);
  check('an array payload falls back to defaults', loadSave().unlocked === 0);

  // --- write path ----------------------------------------------------------
  writeSave({ unlocked: 'garbage', musicVol: 4, sfxVol: 200 });
  s = loadSave();
  check('writeSave sanitises before persisting', numeric(s) && s.sfxVol === 10 && s.musicVol === 4,
    JSON.stringify(s));
  check('written saves carry a version', loadSave().version === 2);

  localStorage.removeItem(KEY);
} catch (e) {
  out.push(`ERROR: ${e.message}\n${e.stack}`);
  failures++;
}

document.title = failures === 0 ? 'ALLPASS' : 'FAIL';
document.body.textContent = out.join('\n') + `\n\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'}`;
document.body.style.whiteSpace = 'pre';
