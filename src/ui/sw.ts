/** Service worker registration (FR-001a). Shows an "update ready" banner mid-solve. */
import { registerSW } from 'virtual:pwa-register';
import { sessionStore } from '../state/session';
import { updateBanner } from './dialogs';

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      const s = sessionStore.getState();
      if (s.screen === 'solution' && s.cursor > 0) {
        // Don't interrupt a solve in progress; saved state survives the reload either way.
        updateBanner(() => void updateSW(true));
      } else {
        void updateSW(true);
      }
    },
  });
}
