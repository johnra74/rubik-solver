import './styles/app.css';
import { SolverClient } from './solver/client';
import { createSaver, load } from './state/persist';
import { configureSession, sessionStore } from './state/session';
import { mountApp } from './ui/app';
import { confirmDialog } from './ui/dialogs';
import { registerServiceWorker } from './ui/sw';

// Restore saved state synchronously before the first render (FR-023).
sessionStore.setState(load());

// Start the solver worker immediately so its tables are ready by the time the cube is entered.
const solver = new SolverClient();
solver.onWaiting((waiting) => {
  const s = sessionStore.getState();
  if (waiting && s.solving === 'solving') sessionStore.setState({ solving: 'waiting' });
  if (!waiting && s.solving === 'waiting') sessionStore.setState({ solving: 'solving' });
});

configureSession({
  confirm: confirmDialog,
  solve: (facelets, mode) => solver.solve(facelets, mode),
  isSolverReady: () => solver.ready,
});

const saver = createSaver(250);
sessionStore.subscribe((s) => saver.schedule(s));
addEventListener('pagehide', saver.flush);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saver.flush();
});

mountApp(document.getElementById('app')!);
registerServiceWorker();

// Expose solver readiness for diagnostics and end-to-end timing checks.
(globalThis as { __solver?: { ready: () => boolean; initMs: () => number | null } }).__solver = {
  ready: () => solver.ready,
  initMs: () => solver.initMs,
};
