/** Main-thread wrapper around the solver worker: promise API, latest-request-wins, readiness. */
import { parseOrThrow } from '../cube/notation';
import type { FaceletString, Move, SolveMode, StageId } from '../cube/types';
import type { SolverRequest, SolverResponse } from './protocol';

export interface SolveResult {
  mode: SolveMode;
  moves: Move[];
  stages?: { id: StageId; startIndex: number; length: number }[];
  elapsedMs: number;
}

export class SolverError extends Error {
  constructor(
    readonly code: 'invalid-state' | 'verification-failed' | 'internal' | 'superseded',
    message: string,
  ) {
    super(message);
  }
}

type Pending = { resolve: (r: SolveResult) => void; reject: (e: SolverError) => void };

export class SolverClient {
  private worker: Worker;
  private pending = new Map<string, Pending>();
  private latest: string | null = null;
  private seq = 0;
  private readyListeners = new Set<(ready: boolean) => void>();
  private waitListeners = new Set<(waiting: boolean) => void>();
  ready = false;
  initMs: number | null = null;
  readonly startedAt = performance.now();

  constructor(worker?: Worker) {
    this.worker = worker ?? new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<SolverResponse>) => this.onMessage(e.data);
    this.post({ type: 'init' });
  }

  onReady(fn: (ready: boolean) => void): () => void {
    this.readyListeners.add(fn);
    fn(this.ready);
    return () => this.readyListeners.delete(fn);
  }

  /** Fires true while a solve is waiting for the short solver's tables. */
  onWaiting(fn: (waiting: boolean) => void): () => void {
    this.waitListeners.add(fn);
    return () => this.waitListeners.delete(fn);
  }

  solve(facelets: FaceletString, mode: SolveMode): Promise<SolveResult> {
    const id = `s${++this.seq}`;
    if (this.latest) this.cancel(this.latest);
    this.latest = id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.post({ type: 'solve', id, facelets, mode });
    });
  }

  private cancel(id: string) {
    this.post({ type: 'cancel', id });
    this.pending.get(id)?.reject(new SolverError('superseded', 'Superseded by a newer request'));
    this.pending.delete(id);
  }

  private post(req: SolverRequest) {
    this.worker.postMessage(req);
  }

  private onMessage(r: SolverResponse) {
    if (r.type === 'ready') {
      this.ready = true;
      this.initMs = r.initMs;
      this.readyListeners.forEach((fn) => fn(true));
      this.waitListeners.forEach((fn) => fn(false));
      return;
    }
    if (r.type === 'progress') {
      if (r.phase === 'waiting-for-init') this.waitListeners.forEach((fn) => fn(true));
      return;
    }
    const p = this.pending.get(r.id);
    if (!p) return; // superseded
    this.pending.delete(r.id);
    if (r.id === this.latest) this.latest = null;
    if (r.type === 'error') p.reject(new SolverError(r.code, r.message));
    else
      p.resolve({
        mode: r.mode,
        moves: r.moves.map((m) => parseOrThrow(m)[0]!),
        ...(r.stages ? { stages: r.stages } : {}),
        elapsedMs: r.elapsedMs,
      });
  }
}
