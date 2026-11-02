/** Merge adjacent same-face turns (mod 4) within each stage; never across stage boundaries. */
import type { Move, StageId, Turn } from '../cube/types';

export interface StageSpan {
  id: StageId;
  startIndex: number;
  length: number;
}

const toQuarters = (t: Turn) => (t === -1 ? 3 : t);
const fromQuarters = (q: number): Turn | null => (q === 0 ? null : q === 3 ? -1 : (q as Turn));

export function simplify(moves: readonly Move[]): Move[] {
  const out: Move[] = [];
  for (const m of moves) {
    const top = out[out.length - 1];
    if (top && top.face === m.face) {
      out.pop();
      const t = fromQuarters((toQuarters(top.turn) + toQuarters(m.turn)) % 4);
      if (t !== null) out.push({ face: m.face, turn: t });
    } else {
      out.push(m);
    }
  }
  return out;
}

export function simplifyWithinStages(
  stageMoves: readonly { id: StageId; moves: readonly Move[] }[],
): { moves: Move[]; stages: StageSpan[] } {
  const moves: Move[] = [];
  const stages: StageSpan[] = [];
  for (const st of stageMoves) {
    const simplified = simplify(st.moves);
    stages.push({ id: st.id, startIndex: moves.length, length: simplified.length });
    moves.push(...simplified);
  }
  return { moves, stages };
}
