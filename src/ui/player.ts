/**
 * Step player. `cursor` = number of moves applied; the "current step" is move `cursor` (1-based),
 * i.e. the move just shown. Next animates the next move; Previous animates the inverse; Replay
 * re-animates the current move from the state before it. A new action first finishes (and commits)
 * any running animation, so rapid presses never skip or repeat a move.
 *
 * Feature 002: every step starts from the holding view (returning to it if the user rotated away),
 * hidden-face moves (B, D, L) briefly peek at that face, and a step completes only once the view is
 * back in the holding view. See specs/002-solve-holding-view/contracts/view-behavior.md.
 */
import { inverse } from '../cube/notation';
import type { Face, Move, Sticker } from '../cube/types';
import { SPEED_MS } from '../cube/types';
import { HIDDEN_FACES, VIEW_MS } from '../render/views';
import type { Session } from '../state/session';
import { displayedStickers, pause, sessionStore, setCursor } from '../state/session';

export interface PlayerView {
  animate(move: Move, ms: number): Promise<void>;
  /** Complete the running move animation immediately. */
  finish(): void;
  /** Show these stickers without animation. */
  show(stickers: readonly Sticker[]): void;
  /** Rotate to the holding view (no-op if already there). Resolves in the holding view unless the user dragged. */
  toHolding(durationMs: number): Promise<void>;
  /** Instantly set the holding view and clear any peek. */
  snapHolding(): void;
  /** Tilt to show a hidden face. */
  peek(face: Face): Promise<void>;
  /** Return from a peek to the holding view (same postcondition as toHolding). */
  unpeek(): Promise<void>;
}

export function createPlayer(view: PlayerView) {
  let chain: Promise<void> = Promise.resolve();
  let pending = 0;
  /** The user grabbed the view (drag): finish the running step now and leave the view where it is. */
  let interrupted = false;
  /** A new action or Pause arrived: finish the running step now and end it in the holding view. */
  let rush = false;
  const get = () => sessionStore.getState();
  const ms = () => SPEED_MS[get().playback.speed];

  /**
   * Queue `fn` behind any running action. If something is running, it is completed immediately
   * (move finished, view snapped to holding). While more actions are waiting, moves are committed
   * without animation. When the queue drains, the view is re-synced from the session.
   */
  const exclusive = (fn: () => Promise<void> | void): Promise<void> => {
    if (pending > 0) rushRunning();
    pending++;
    const run = chain.then(async () => {
      try {
        await fn();
      } finally {
        pending--;
        if (pending === 0) view.show(displayedStickers(get()));
      }
    });
    chain = run.catch((err: unknown) => console.error(err));
    return run;
  };
  const skipping = () => pending > 1 || interrupted || rush;
  const rushRunning = () => {
    rush = true;
    view.finish();
    view.snapHolding();
  };

  /** Holding view → (peek) → move → (unpeek). Returns when the step may be committed. */
  const playMove = async (move: Move) => {
    interrupted = false;
    rush = false;
    if (skipping()) {
      view.snapHolding();
      return;
    }
    await view.toHolding(VIEW_MS.returnToHolding);
    const hidden = HIDDEN_FACES.has(move.face);
    if (hidden && !skipping()) await view.peek(move.face);
    if (!skipping()) await view.animate(move, ms());
    if (hidden) {
      if (skipping()) {
        if (!interrupted) view.snapHolding();
      } else {
        await view.unpeek();
      }
    }
  };

  const step = (dir: 1 | -1) =>
    exclusive(async () => {
      const s = get();
      if (!s.solution) return;
      const c = s.cursor;
      if (dir === 1 && c >= s.solution.moves.length) return;
      if (dir === -1 && c <= 0) return;
      const move = dir === 1 ? s.solution.moves[c]! : inverse(s.solution.moves[c - 1]!);
      view.show(displayedStickers(s));
      await playMove(move);
      setCursor(c + dir);
    });

  const player = {
    get busy() {
      return pending > 0;
    },
    next: () => step(1),
    prev: () => {
      pause();
      return step(-1);
    },
    replay: () => {
      pause();
      return exclusive(async () => {
        const s = get();
        if (!s.solution || s.cursor === 0) return;
        view.show(displayedStickers({ ...s, cursor: s.cursor - 1 }));
        await playMove(s.solution.moves[s.cursor - 1]!);
      });
    },
    jumpTo: (k: number) => {
      pause();
      return exclusive(() => {
        view.snapHolding();
        setCursor(k);
        view.show(displayedStickers(get()));
      });
    },
    /** Called for a freshly presented solution: move to the holding view, then show step 1. */
    begin: async () => {
      await exclusive(async () => {
        await view.toHolding(VIEW_MS.present);
        view.show(displayedStickers(get()));
      });
      const s = get();
      if (s.solution && s.solution.moves.length > 0 && s.cursor === 0) await step(1);
    },
    /** The user grabbed the view (drag): complete the running step now and leave the view to them. */
    interrupt: () => {
      if (pending === 0) return;
      interrupted = true;
      view.finish();
    },
  };

  // Auto-play loop (FR-019). A step only completes back in the holding view, so auto-play never
  // advances while the view is tilted.
  let looping = false;
  const loop = async () => {
    if (looping) return;
    looping = true;
    while (get().playback.playing) {
      const s = get();
      if (!s.solution || s.cursor >= s.solution.moves.length) {
        pause();
        break;
      }
      await step(1);
      await new Promise((r) => setTimeout(r, 150));
    }
    looping = false;
  };
  sessionStore.subscribe((s: Session, prev: Session) => {
    if (s.playback.playing && !prev.playback.playing) void loop();
    // Pausing completes the move in flight immediately and ends it in the holding view.
    if (!s.playback.playing && prev.playback.playing && pending > 0) rushRunning();
  });

  return player;
}

export type Player = ReturnType<typeof createPlayer>;
