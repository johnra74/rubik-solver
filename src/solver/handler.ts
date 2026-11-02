/** Pure worker message handler (testable without a Worker). See contracts/solver-worker.md. */
import { applyAll, fromFacelets, isSolved } from '../cube/cubie';
import { format } from '../cube/notation';
import type { Move, SolveMode } from '../cube/types';
import { validateFaceletString } from '../cube/validate';
import type { BeginnerSolution } from './beginner';
import { verifyBeginner } from './beginner';
import type { SolverRequest, SolverResponse } from './protocol';
import type { ShortSolver } from './short';

export interface HandlerDeps {
  short: ShortSolver;
  beginner: (facelets: string) => BeginnerSolution;
}

type Post = (r: SolverResponse) => void;

export function createHandler(deps: HandlerDeps) {
  const queue: { id: string; facelets: string; mode: SolveMode }[] = [];
  let ready = false;
  const cancelled = new Set<string>();

  const run = (id: string, facelets: string, mode: SolveMode, post: Post) => {
    if (cancelled.delete(id)) return;
    const t0 = performance.now();
    const v = validateFaceletString(facelets);
    if (!v.ok) {
      post({ type: 'error', id, code: 'invalid-state', message: v.message ?? 'Invalid cube state' });
      return;
    }
    try {
      const start = fromFacelets(facelets);
      let moves: Move[];
      let stages: BeginnerSolution['stages'] | undefined;
      if (mode === 'short') {
        moves = deps.short.solve(facelets);
      } else {
        const sol = deps.beginner(facelets);
        moves = sol.moves;
        stages = sol.stages;
      }
      let verified = isSolved(applyAll(start, moves));
      if (verified && stages) {
        try {
          verifyBeginner(start, { moves, stages });
        } catch {
          verified = false;
        }
      }
      if (!verified) {
        console.error('Solver verification failed for', facelets, mode);
        post({
          type: 'error',
          id,
          code: 'verification-failed',
          message: 'Something went wrong computing a solution. Please try again.',
        });
        return;
      }
      post({
        type: 'solved',
        id,
        mode,
        moves: moves.map(format),
        ...(stages ? { stages } : {}),
        elapsedMs: Math.round(performance.now() - t0),
      });
    } catch (err) {
      console.error('Solver error for', facelets, mode, err);
      post({ type: 'error', id, code: 'internal', message: 'Something went wrong computing a solution. Please try again.' });
    }
  };

  return function handleMessage(req: SolverRequest, post: Post): void {
    switch (req.type) {
      case 'init': {
        const { initMs } = deps.short.init();
        ready = true;
        post({ type: 'ready', initMs });
        for (const q of queue.splice(0)) run(q.id, q.facelets, q.mode, post);
        break;
      }
      case 'solve': {
        if (req.mode === 'short' && !ready) {
          queue.push({ id: req.id, facelets: req.facelets, mode: req.mode });
          post({ type: 'progress', id: req.id, phase: 'waiting-for-init' });
          return;
        }
        post({ type: 'progress', id: req.id, phase: 'solving' });
        run(req.id, req.facelets, req.mode, post);
        break;
      }
      case 'cancel': {
        const i = queue.findIndex((q) => q.id === req.id);
        if (i >= 0) queue.splice(i, 1);
        break;
      }
    }
  };
}
