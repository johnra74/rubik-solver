/// <reference lib="webworker" />
/** Solver Web Worker entry. All logic lives in handler.ts. */
import { solveBeginner } from './beginner';
import { createHandler } from './handler';
import type { SolverRequest, SolverResponse } from './protocol';
import { shortSolver } from './short';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const handle = createHandler({ short: shortSolver, beginner: solveBeginner });
const post = (r: SolverResponse) => ctx.postMessage(r);

// Messages are processed one at a time; 'init' blocks while tables are built, and any
// 'solve' that arrives meanwhile is handled (queued or run) right after.
ctx.onmessage = (e: MessageEvent<SolverRequest>) => handle(e.data, post);
