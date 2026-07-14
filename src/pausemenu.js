// In-game pause menu with an audio settings submenu.
import { VIEW_W, VIEW_H } from './constants.js';
import { input } from './input.js';
import { drawText, drawTextCentered } from './sprites.js';
import { sfx, setMusicVolume, setSfxVolume } from './audio.js';
import { music } from './music.js';
import { writeSave } from './save.js';

const MAIN_ITEMS = ['RESUME', 'SETTINGS', 'QUIT TO MAP'];
const SET_ITEMS = ['MUSIC', 'SFX', 'BACK'];

export class PauseMenu {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.screen = 'main';
    this.cursor = 0;
  }

  // Returns false when the menu wants to close (resume play).
  update() {
    const items = this.screen === 'main' ? MAIN_ITEMS : SET_ITEMS;
    if (input.justPressed('down')) { this.cursor = (this.cursor + 1) % items.length; sfx.select(); }
    if (input.justPressed('up')) { this.cursor = (this.cursor + items.length - 1) % items.length; sfx.select(); }

    // ArrowUp/W are mapped to both `up` and `jump`, so a single press would
    // move the cursor and then activate whatever it landed on — pressing Up on
    // the main screen selected RESUME and instantly closed the menu. A press
    // that moved the cursor is navigation, never confirmation; Space/Z/Enter
    // (which don't mean `up`) still confirm.
    const navigated = input.justPressed('up') || input.justPressed('down');
    const confirmed = !navigated &&
      (input.justPressed('confirm') || input.justPressed('jump'));

    if (this.screen === 'settings') {
      const save = this.game.save;
      const dir = (input.justPressed('right') ? 1 : 0) - (input.justPressed('left') ? 1 : 0);
      if (dir && this.cursor < 2) {
        const key = this.cursor === 0 ? 'musicVol' : 'sfxVol';
        const v = Math.max(0, Math.min(10, save[key] + dir));
        if (v !== save[key]) {
          save[key] = v;
          if (key === 'musicVol') setMusicVolume(v);
          else setSfxVolume(v);
          writeSave(save);
          sfx.select(); // audible feedback at the new volume
        }
      }
      if (input.justPressed('pause')) { this.screen = 'main'; this.cursor = 1; sfx.select(); return true; }
      if (confirmed) {
        if (this.cursor === 2) { this.screen = 'main'; this.cursor = 1; sfx.select(); }
      }
      return true;
    }

    // main screen
    if (input.justPressed('pause')) return false;
    if (confirmed) {
      const item = MAIN_ITEMS[this.cursor];
      if (item === 'RESUME') { sfx.confirm(); return false; }
      if (item === 'SETTINGS') { this.screen = 'settings'; this.cursor = 0; sfx.confirm(); return true; }
      if (item === 'QUIT TO MAP') {
        sfx.confirm();
        music.stop();
        this.game.paused = false;
        this.game.toWorldMap();
        return false;
      }
    }
    return true;
  }

  draw(g) {
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    if (this.screen === 'main') {
      drawTextCentered(g, 'PAUSED', VIEW_W / 2, 66, '#fff', 3);
      MAIN_ITEMS.forEach((item, i) => {
        const y = 112 + i * 20;
        const sel = i === this.cursor;
        if (sel) drawText(g, '>', VIEW_W / 2 - 58, y, '#ffd23e');
        drawTextCentered(g, item, VIEW_W / 2, y, sel ? '#ffd23e' : '#9aa4b5');
      });
    } else {
      drawTextCentered(g, 'SETTINGS', VIEW_W / 2, 66, '#fff', 3);
      const save = this.game.save;
      const vols = [save.musicVol, save.sfxVol];
      SET_ITEMS.forEach((item, i) => {
        const y = 112 + i * 22;
        const sel = i === this.cursor;
        if (sel) drawText(g, '>', VIEW_W / 2 - 92, y, '#ffd23e');
        if (i < 2) {
          drawText(g, item, VIEW_W / 2 - 80, y, sel ? '#ffd23e' : '#9aa4b5');
          // volume bar: 10 cells
          const bx = VIEW_W / 2 - 10;
          for (let c = 0; c < 10; c++) {
            g.fillStyle = c < vols[i] ? (sel ? '#ffd23e' : '#6fd7ff') : '#2a2a36';
            g.fillRect(bx + c * 9, y, 7, 8);
          }
          if (sel) {
            drawText(g, '<', bx - 10, y, '#fff');
            drawText(g, '>', bx + 92, y, '#fff');
          }
        } else {
          drawTextCentered(g, item, VIEW_W / 2, y + 4, sel ? '#ffd23e' : '#9aa4b5');
        }
      });
      drawTextCentered(g, 'LEFT/RIGHT TO ADJUST', VIEW_W / 2, 196, '#6b7382');
    }
  }
}
