// Music scheduler resilience.
//
// The sequencer uses the correct lookahead pattern (setInterval drives, the
// WebAudio clock times), but two failure modes hid in it:
//   - a throttled background tab let nextTime fall behind currentTime, and the
//     catch-up loop then scheduled every missed step in the past, which
//     WebAudio fires all at once;
//   - tick()'s catch stopped the scheduler without clearing `current`, so
//     play(sameName) early-returned forever after.
import { music } from '../src/music.js';
import { ac, isUnlocked } from '../src/audio.js';

const out = [];
let failures = 0;
function check(name, ok, detail = '') {
  out.push(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const SONG = 'meadows';

try {
  // music.play() defers until audio is unlocked, and only a real gesture event
  // sets that flag — calling ac() directly is not enough.
  window.dispatchEvent(new Event('keydown'));
  check('audio unlocks on a gesture', isUnlocked());
  const a = ac(); // --autoplay-policy=no-user-gesture-required in the runner

  // Guard against a vacuous pass: tick() bails immediately on an unknown song
  // name, which would make every "nothing was scheduled" assertion below
  // trivially true. (It did — this test first ran against a name that didn't
  // exist and reported green.)
  music.play(SONG);
  check(`the song under test (${SONG}) actually exists`, music.timer !== null);
  music.stop();

  // --- backlog is dropped, not drained ------------------------------------
  music.current = SONG;
  music.step = 0;
  music.timer = 1; // pretend the scheduler is live; we drive tick() by hand

  let scheduled = [];
  const realSchedule = music.scheduleStep.bind(music);
  music.scheduleStep = (song, step, t0, dur) => { scheduled.push(t0); };

  // Sanity: a normal tick must schedule something, or the assertions about
  // *not* scheduling are meaningless.
  music.nextTime = a.currentTime + 0.06;
  music.tick();
  check('a normal tick fills the lookahead', scheduled.length > 0, `${scheduled.length} steps`);

  // Simulate 10s of throttled background: nextTime stuck far in the past.
  scheduled = [];
  music.nextTime = a.currentTime - 10;
  music.tick();

  const inPast = scheduled.filter(t => t < a.currentTime).length;
  check('no notes are scheduled in the past after a throttle', inPast === 0,
    `${inPast} of ${scheduled.length} were past-dated`);
  // 10s at 126bpm/16th ≈ 84 steps; a sane tick schedules only ~LOOKAHEAD worth
  // (a handful), never the whole backlog.
  check('the missed backlog is dropped rather than drained', scheduled.length < 20,
    `${scheduled.length} steps scheduled in one tick`);

  music.scheduleStep = realSchedule;
  music.stop();

  // --- a stopped scheduler can be revived ---------------------------------
  // Reproduce the dead state: `current` set, scheduler stopped (what tick()'s
  // catch leaves behind).
  music.current = SONG;
  music.timer = null;
  music.play(SONG);
  check('play() revives a song whose scheduler died', music.timer !== null);

  // And the normal no-op guard still holds: replaying a live song is a no-op.
  const liveTimer = music.timer;
  music.play(SONG);
  check('play() on an already-playing song is still a no-op', music.timer === liveTimer);

  music.stop();
  check('stop() clears current and the timer', music.current === null && music.timer === null);
} catch (e) {
  out.push(`ERROR: ${e.message}\n${e.stack}`);
  failures++;
}

document.title = failures === 0 ? 'ALLPASS' : 'FAIL';
document.body.textContent = out.join('\n') + `\n\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'}`;
document.body.style.whiteSpace = 'pre';
