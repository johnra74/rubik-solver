/** App shell: layout, 3D/net views, screen switching and wiring (T022, T035, T045, T058, T074). */
import type { Face, Move, Sticker } from '../cube/types';
import { createAnimator } from '../render/animator';
import type { Animator } from '../render/animator';
import type { CubeMesh } from '../render/cubeMesh';
import { createCubeMesh } from '../render/cubeMesh';
import { pickSticker } from '../render/picking';
import type { CubeScene } from '../render/scene';
import { createScene } from '../render/scene';
import { VIEW_MS, holdingView, peekView } from '../render/views';
import { isWebGLAvailable } from '../render/webgl';
import type { Session } from '../state/session';
import { currentWalkthroughFace, displayedStickers, paintSticker, sessionStore, toggleLetters } from '../state/session';
import { h, setPressed } from './dom';
import { createInputPanel } from './inputPanel';
import { installKeyboard } from './keyboard';
import { createNetView } from './netView';
import { openNotationGuide } from './notationGuide';
import { createPlayer } from './player';
import { createSolutionPanel } from './solutionPanel';

export function mountApp(root: HTMLElement, opts: { webgl?: boolean } = {}) {
  const webgl = opts.webgl ?? isWebGLAvailable();

  const lettersBtn = h('button', { type: 'button', class: 'btn btn-small', onclick: () => toggleLetters() }, 'Show letters');
  const guideBtn = h(
    'button',
    { type: 'button', class: 'btn btn-small', 'aria-label': 'Notation guide', onclick: () => openNotationGuide() },
    '? Notation',
  );
  const header = h(
    'header',
    { class: 'app-header' },
    h('h1', {}, "Rubik's Cube Solver"),
    h('div', { class: 'header-actions' }, lettersBtn, guideBtn),
  );

  const stage3d = h('div', { class: 'stage3d' });
  const net = createNetView();
  const viewer = h('section', { class: 'viewer', 'aria-label': 'Cube' });
  const panelHost = h('section', { class: 'panel', 'aria-label': 'Controls' });
  root.replaceChildren(header, h('div', { class: 'layout' }, viewer, panelHost));

  let scene: CubeScene | null = null;
  let mesh: CubeMesh | null = null;
  let animator: Animator | null = null;
  let backToHoldingBtn: HTMLButtonElement | null = null;
  /** Face currently being peeked at (feature 002), for diagnostics. */
  let peeking: Face | null = null;

  if (webgl) {
    viewer.append(stage3d);
    scene = createScene(stage3d);
    mesh = createCubeMesh(scene.cubeGroup);
    animator = createAnimator(scene, mesh);
    const s3 = scene;
    // Feature 002 FR-006: explicit return to the holding view; Reset view goes there on the solution screen.
    backToHoldingBtn = h(
      'button',
      {
        type: 'button',
        class: 'icon-btn wide',
        'aria-label': 'Back to holding view',
        onclick: () => void s3.rotateTo(holdingView(), VIEW_MS.returnToHolding),
      },
      'Back to holding view',
    );
    const resetViewForScreen = () => {
      if (sessionStore.getState().screen === 'solution') void s3.rotateTo(holdingView(), VIEW_MS.returnToHolding);
      else s3.resetView();
    };
    const viewControls = h(
      'div',
      { class: 'view-controls', role: 'group', 'aria-label': 'Rotate view' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Rotate view left', onclick: () => s3.rotateBy(-90, 0) }, '⟲'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Rotate view up', onclick: () => s3.rotateBy(0, -45) }, '↑'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Rotate view down', onclick: () => s3.rotateBy(0, 45) }, '↓'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Rotate view right', onclick: () => s3.rotateBy(90, 0) }, '⟳'),
      h('button', { type: 'button', class: 'icon-btn wide', 'aria-label': 'Reset view', onclick: () => resetViewForScreen() }, 'Reset view'),
      backToHoldingBtn,
    );
    viewer.append(viewControls);
  } else {
    viewer.append(
      h(
        'p',
        { class: 'notice', role: 'status', 'data-testid': 'webgl-notice' },
        "3D view isn't available on this device — using the flat view instead.",
      ),
    );
    viewer.classList.add('no-webgl');
  }
  viewer.append(h('div', { class: 'net-wrap' }, net.el));

  const inputPanel = createInputPanel();

  // --- rendering of the cube (3D + net) ---
  let shown: readonly Sticker[] = [];
  let letters = false;
  let highlight: readonly number[] = [];
  let activeFace: ReturnType<typeof currentWalkthroughFace> = null;
  const show = (stickers: readonly Sticker[]) => {
    shown = stickers;
    mesh?.setStickers(stickers);
    net.update(stickers, { letters, highlight, activeFace });
    scene?.requestRender();
  };

  // Holding-view hooks (feature 002). Postcondition: toHolding/unpeek end in the holding view unless
  // the user dragged during the rotation (contracts/view-behavior.md). No-ops without 3D (FR-010).
  const snapHolding = () => {
    peeking = null;
    scene?.snapTo(holdingView());
  };
  const rotateToHolding = async (ms: number) => {
    if (!scene) return;
    if (scene.isAt(holdingView())) return;
    const r = await scene.rotateTo(holdingView(), ms);
    if (r === 'cancelled') scene.snapTo(holdingView());
  };
  const player = createPlayer({
    show,
    finish: () => animator?.finishImmediately(),
    async animate(move: Move, ms: number) {
      if (animator) return animator.animateMove(move, ms);
      net.flashFace(move.face, ms);
      await new Promise((r) => setTimeout(r, ms));
    },
    toHolding: rotateToHolding,
    snapHolding,
    async peek(face: Face) {
      if (!scene) return;
      peeking = face;
      await scene.rotateTo(peekView(face), VIEW_MS.peekIn);
    },
    async unpeek() {
      if (!scene) return;
      const r = await scene.rotateTo(holdingView(), VIEW_MS.peekOut);
      if (r === 'cancelled') scene.snapTo(holdingView());
      peeking = null;
    },
  });
  // A drag during a step completes it immediately and leaves the view to the user.
  scene?.onUserRotate(() => {
    if (sessionStore.getState().screen !== 'solution') return;
    peeking = null;
    player.interrupt();
  });
  const solutionPanel = createSolutionPanel(player);
  solutionPanel.bind(() => sessionStore.getState());

  // --- input: taps on the 3D cube and clicks on the net ---
  const onPaint = async (index: number) => {
    if (sessionStore.getState().screen !== 'input') return;
    const r = await paintSticker(index);
    if (r === 'wrong-face') inputPanel.showHint('Finish this face, or switch to Free edit to paint other faces.');
    if (r === 'center') inputPanel.showHint('Center stickers are fixed — they tell you which way to hold the cube.');
  };
  scene?.onTap((x, y) => {
    if (!scene || !mesh) return;
    const idx = pickSticker(scene, mesh, x, y);
    if (idx !== null) void onPaint(idx);
  });
  net.onStickerClick((i) => void onPaint(i));
  installKeyboard(player);

  // --- store → view ---
  const render = (s: Session, prev?: Session) => {
    letters = s.prefs.showLetters;
    setPressed(lettersBtn, letters);
    mesh?.setShowLetters(letters);
    activeFace = currentWalkthroughFace(s);
    highlight = s.screen === 'input' && s.lastValidation && !s.lastValidation.ok ? (s.lastValidation.stickerIndices ?? []) : [];
    mesh?.setHighlight(highlight);

    const screenChanged = !prev || prev.screen !== s.screen;
    if (screenChanged) panelHost.replaceChildren(s.screen === 'input' ? inputPanel.el : solutionPanel.el);
    if (s.screen === 'input') inputPanel.update(s);
    else solutionPanel.update(s);

    if (!player.busy) show(displayedStickers(s));
    else net.update(shown, { letters, highlight, activeFace });

    if (backToHoldingBtn) backToHoldingBtn.hidden = s.screen !== 'solution';

    if (scene) {
      if (s.screen === 'solution') {
        const newSolution = !!prev && !!s.solution && s.solution !== prev.solution;
        if (!prev) {
          // Restored mid-solution on load: start in the holding view (contract "restored on load").
          scene.snapTo(holdingView());
        } else if (screenChanged && !newSolution) {
          void rotateToHolding(VIEW_MS.present);
        }
      } else {
        // Input screen: the camera follows the walkthrough pose (unchanged by feature 002).
        const faceChanged = prev ? currentWalkthroughFace(prev) !== activeFace : true;
        if (faceChanged) {
          if (activeFace) scene.setViewToFace(activeFace, !!prev);
          else if (prev && prev.screen === 'input') scene.resetView();
        }
      }
    }

    // A new solution: move to the holding view, then play step 1.
    if (prev && s.solution && s.solution !== prev.solution && s.screen === 'solution') void player.begin();
  };
  sessionStore.subscribe((s, prev) => render(s, prev));
  render(sessionStore.getState());

  // Diagnostics for end-to-end tests (read-only; nothing is sent anywhere).
  (globalThis as { __view?: { state(): { holding: boolean; peeking: Face | null; screen: string } } }).__view = {
    state: () => ({
      holding: scene ? scene.isAt(holdingView()) : true,
      peeking,
      screen: sessionStore.getState().screen,
    }),
  };

  return { player };
}
