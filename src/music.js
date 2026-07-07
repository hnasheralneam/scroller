// Procedural chiptune music: a tiny lookahead pattern sequencer over
// WebAudio. Songs are hand-authored 16th-note patterns; each track is a
// comma-separated step string where '' = rest, '-' = tie (extends the
// previous note) and a number = semitones above the track's base note.
// Drum tracks use k (kick), s (snare), x (hat).
import { ac, musicGain, isUnlocked, onUnlock } from './audio.js';

const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);
const S = str => str.split(',');

// --- songs -----------------------------------------------------------------
const SONGS = {
  title: {
    bpm: 112,
    tracks: [
      { wave: 'square', vol: 0.055, base: 72, steps: S(
        '0,-,4,-,7,-,12,-,9,-,7,-,4,-,7,-,' +
        '2,-,5,-,9,-,12,-,14,-,12,-,9,-,5,-,' +
        '0,-,4,-,7,-,12,-,16,-,14,-,12,-,7,-,' +
        '9,-,7,-,5,-,4,-,2,-,-,-,0,-,-,-') },
      { wave: 'triangle', vol: 0.10, base: 48, steps: S(
        '0,,,0,,,7,,5,,,5,,,12,,' +
        '2,,,2,,,9,,7,,,7,,,2,,' +
        '0,,,0,,,7,,4,,,4,,,9,,' +
        '5,,,5,,,7,,0,,,0,,,-5,,') },
      { wave: 'drum', vol: 0.5, steps: S('k,,x,,s,,x,,k,,x,,s,,x,x,') },
    ],
  },
  map: {
    bpm: 100,
    tracks: [
      { wave: 'triangle', vol: 0.09, base: 72, steps: S(
        '0,,4,,7,,4,,9,,7,,4,,2,,' +
        '0,,4,,7,,4,,5,,4,,2,,0,,') },
      { wave: 'square', vol: 0.04, base: 48, steps: S(
        '0,,,,7,,,,5,,,,7,,,,' +
        '0,,,,7,,,,5,,,,-2,,,,') },
    ],
  },
  meadows: {
    bpm: 126,
    tracks: [
      { wave: 'square', vol: 0.05, base: 76, steps: S(
        '0,,0,,3,,5,,7,-,-,,5,,3,,' +
        '5,,3,,0,,3,,-2,-,-,,,,,,' +
        '0,,0,,3,,5,,7,-,-,,10,,7,,' +
        '12,-,10,,7,,5,,3,-,-,,0,,,') },
      { wave: 'triangle', vol: 0.10, base: 52, steps: S(
        '0,,,7,,,0,,5,,,12,,,5,,' +
        '3,,,10,,,3,,7,,,7,,-5,,,,' ) },
      { wave: 'drum', vol: 0.45, steps: S('k,,,,x,,,,k,,k,,x,,,,') },
    ],
  },
  caverns: {
    bpm: 80,
    tracks: [
      { wave: 'triangle', vol: 0.10, base: 69, steps: S(
        '0,-,-,-,,,3,-,-,-,,,2,-,-,-,' +
        ',,,,7,-,-,-,5,-,3,-,2,-,-,-,' +
        '0,-,-,-,,,-2,-,-,-,,,0,-,-,-,' +
        ',,,,,,,,,,,,,,,,') },
      { wave: 'sine', vol: 0.12, base: 45, steps: S(
        '0,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,' +
        '-4,-,-,-,-,-,-,-,-2,-,-,-,-,-,-,-') },
    ],
  },
  sky: {
    bpm: 108,
    tracks: [
      { wave: 'triangle', vol: 0.08, base: 76, steps: S(
        '0,4,7,12,7,4,0,4,7,12,16,12,7,4,0,4,' +
        '-1,4,7,12,7,4,-1,4,5,9,12,17,12,9,5,9') },
      { wave: 'sine', vol: 0.10, base: 52, steps: S(
        '0,-,-,-,-,-,-,-,5,-,-,-,-,-,-,-,' +
        '4,-,-,-,-,-,-,-,2,-,-,-,7,-,-,-') },
    ],
  },
  cyber: {
    bpm: 140,
    tracks: [
      { wave: 'sawtooth', vol: 0.05, base: 40, steps: S(
        '0,0,12,0,0,10,0,12,0,0,12,0,3,3,15,3,' +
        '5,5,17,5,5,15,5,17,3,3,15,3,2,2,14,2') },
      { wave: 'square', vol: 0.045, base: 67, steps: S(
        ',,,,0,-,,,,,3,-,,,5,-,' +
        ',,,,7,-,,,5,,3,,0,-,-,,') },
      { wave: 'drum', vol: 0.5, steps: S('k,,x,x,s,,x,,k,k,x,x,s,,x,x,') },
    ],
  },
  keep: {
    bpm: 132,
    tracks: [
      { wave: 'square', vol: 0.055, base: 43, steps: S(
        '0,-,0,,3,-,0,,5,-,3,-,1,-,0,,' +
        '0,-,0,,3,-,0,,-2,-,-,-,1,-,3,,') },
      { wave: 'sawtooth', vol: 0.04, base: 62, steps: S(
        ',,,,,,,,12,-,-,-,10,-,8,-,' +
        ',,,,,,,,7,-,-,-,6,-,7,-') },
      { wave: 'drum', vol: 0.55, steps: S('k,,,k,s,,,,k,,k,,s,,,x,') },
    ],
  },
  jungle: {
    bpm: 116,
    tracks: [
      { wave: 'square', vol: 0.05, base: 69, steps: S(
        '0,,3,,,5,,,7,,5,,3,,0,,' +
        ',3,,5,,,10,-,7,,5,,3,-,-,,' +
        '0,,3,,,5,,,12,,10,,7,,5,,' +
        ',7,,5,,,3,-,0,-,-,-,,,,,') },
      { wave: 'triangle', vol: 0.10, base: 45, steps: S(
        '0,,,0,,7,,,0,,,0,,7,5,,' +
        '3,,,3,,10,,,0,,,0,,7,,,') },
      { wave: 'drum', vol: 0.45, steps: S('k,,x,,k,,,x,,k,,x,k,,x,,') },
    ],
  },
  depths: {
    bpm: 84,
    tracks: [
      { wave: 'triangle', vol: 0.09, base: 67, steps: S(
        '0,-,-,-,3,-,-,-,7,-,-,-,5,-,3,-,' +
        '2,-,-,-,5,-,-,-,3,-,-,-,0,-,-,-,' +
        '0,-,-,-,3,-,-,-,8,-,-,-,7,-,5,-,' +
        '3,-,-,-,2,-,-,-,0,-,-,-,-,-,-,-') },
      { wave: 'sine', vol: 0.12, base: 43, steps: S(
        '0,-,-,-,-,-,-,-,-,-,-,-,-,-,-,-,' +
        '-2,-,-,-,-,-,-,-,-4,-,-,-,-2,-,-,-') },
      { wave: 'sine', vol: 0.05, base: 84, steps: S(
        ',,,,,,0,,,,,,,,,,,,,,3,,,,,,,,,,,,') },
    ],
  },
  boss: {
    bpm: 150,
    tracks: [
      { wave: 'sawtooth', vol: 0.05, base: 41, steps: S(
        '0,0,,0,1,,0,,0,0,,0,3,,1,,' +
        '0,0,,0,1,,0,,6,,5,,3,,1,,') },
      { wave: 'square', vol: 0.05, base: 65, steps: S(
        ',,,,,,,,12,-,,,11,-,,,' +
        ',,,,,,,,6,,8,,11,-,12,-') },
      { wave: 'drum', vol: 0.6, steps: S('k,,x,,s,,k,k,,,x,,s,,x,x,') },
    ],
  },
};

// --- sequencer ---------------------------------------------------------------
const LOOKAHEAD = 0.3;     // seconds scheduled ahead of currentTime
const TICK_MS = 30;

class MusicPlayer {
  constructor() {
    this.current = null;   // song name
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
  }

  play(name) {
    if (this.current === name) return;
    this.current = name;
    if (!SONGS[name]) { this.stopScheduler(); return; }
    if (!isUnlocked()) return; // will start on unlock
    this.start();
  }

  start() {
    this.stopScheduler();
    try {
      const a = ac();
      this.step = 0;
      this.nextTime = a.currentTime + 0.06;
      this.timer = setInterval(() => this.tick(), TICK_MS);
    } catch (e) { /* audio unavailable */ }
  }

  stop() {
    this.current = null;
    this.stopScheduler();
  }

  stopScheduler() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  tick() {
    const song = SONGS[this.current];
    if (!song) { this.stopScheduler(); return; }
    try {
      const a = ac();
      const stepDur = 60 / song.bpm / 4;
      while (this.nextTime < a.currentTime + LOOKAHEAD) {
        this.scheduleStep(song, this.step, this.nextTime, stepDur);
        this.step++;
        this.nextTime += stepDur;
      }
    } catch (e) { this.stopScheduler(); }
  }

  scheduleStep(song, step, t0, stepDur) {
    for (const tr of song.tracks) {
      const s = tr.steps[step % tr.steps.length];
      if (!s || s === '-') continue;
      if (tr.wave === 'drum') this.drum(s, t0, tr.vol);
      else {
        // count ties to get the note's full duration
        let ties = 0;
        while (tr.steps[(step + ties + 1) % tr.steps.length] === '-') ties++;
        this.note(tr, parseInt(s, 10), t0, stepDur * (1 + ties));
      }
    }
  }

  note(tr, semis, t0, dur) {
    const a = ac();
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = tr.wave;
    osc.frequency.setValueAtTime(midiFreq(tr.base + semis), t0);
    gain.gain.setValueAtTime(tr.vol, t0);
    gain.gain.setValueAtTime(tr.vol, t0 + dur * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur * 0.95);
    osc.connect(gain).connect(musicGain());
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  drum(kind, t0, vol) {
    const a = ac();
    if (kind === 'k') {
      const osc = a.createOscillator();
      const gain = a.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, t0);
      osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.09);
      gain.gain.setValueAtTime(0.28 * vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
      osc.connect(gain).connect(musicGain());
      osc.start(t0);
      osc.stop(t0 + 0.11);
    } else {
      const dur = kind === 's' ? 0.09 : 0.03;
      const len = Math.max(1, Math.floor(a.sampleRate * dur));
      const buf = a.createBuffer(1, len, a.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = a.createBufferSource();
      src.buffer = buf;
      const gain = a.createGain();
      gain.gain.setValueAtTime((kind === 's' ? 0.22 : 0.12) * vol, t0);
      src.connect(gain).connect(musicGain());
      src.start(t0);
    }
  }
}

export const music = new MusicPlayer();

// If a song was requested before the first keypress, start it on unlock.
onUnlock(() => { if (music.current) music.start(); });

// Names for per-world themes, indexed by world id.
export const WORLD_THEMES = ['meadows', 'caverns', 'sky', 'cyber', 'keep', 'jungle', 'depths'];
