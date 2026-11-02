/** Global keyboard shortcuts (research R12). */
import { pause, play, selectColor, sessionStore } from '../state/session';
import { isDialogOpen } from './dialogs';
import { PALETTE_ORDER } from './palette';
import type { Player } from './player';

export function installKeyboard(player: Player): void {
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isDialogOpen()) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const s = sessionStore.getState();
    if (s.screen === 'input') {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= 6) {
        selectColor(PALETTE_ORDER[n - 1]!);
        e.preventDefault();
      }
      return;
    }
    // Solution screen
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      void player.next();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      void player.prev();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      void player.replay();
    } else if (e.key === ' ' && !(t && t.tagName === 'BUTTON')) {
      e.preventDefault();
      if (s.playback.playing) pause();
      else play();
    }
  });
}
