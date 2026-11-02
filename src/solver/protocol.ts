/** Message protocol between the main thread and the solver worker. See contracts/solver-worker.md. */
import type { SolveMode, StageId } from '../cube/types';

export type SolverRequest =
  | { type: 'init' }
  | { type: 'solve'; id: string; facelets: string; mode: SolveMode }
  | { type: 'cancel'; id: string };

export type SolverResponse =
  | { type: 'ready'; initMs: number }
  | { type: 'progress'; id: string; phase: 'waiting-for-init' | 'solving' }
  | {
      type: 'solved';
      id: string;
      mode: SolveMode;
      moves: string[];
      stages?: { id: StageId; startIndex: number; length: number }[];
      elapsedMs: number;
    }
  | { type: 'error'; id: string; code: 'invalid-state' | 'verification-failed' | 'internal'; message: string };
