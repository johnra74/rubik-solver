/** Beginner stage definitions: titles, goal text and cumulative goal predicates (white on U, yellow on D). */
import type { CubieState } from '../../cube/cubie';
import { isSolved } from '../../cube/cubie';
import type { StageId } from '../../cube/types';

export interface StageDef {
  readonly id: StageId;
  readonly title: string;
  readonly goal: string;
  readonly isDone: (s: CubieState) => boolean;
}

const edgesHome = (s: CubieState, from: number, to: number) => {
  for (let i = from; i <= to; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
};
const cornersHome = (s: CubieState, from: number, to: number) => {
  for (let i = from; i <= to; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  return true;
};

export const crossDone = (s: CubieState) => edgesHome(s, 0, 3);
export const f1Done = (s: CubieState) => crossDone(s) && cornersHome(s, 0, 3);
export const middleDone = (s: CubieState) => f1Done(s) && edgesHome(s, 8, 11);
export const ycrossDone = (s: CubieState) =>
  middleDone(s) && s.eo[4] === 0 && s.eo[5] === 0 && s.eo[6] === 0 && s.eo[7] === 0;
export const yedgesDone = (s: CubieState) => middleDone(s) && edgesHome(s, 4, 7);
export const ycornersPosDone = (s: CubieState) =>
  yedgesDone(s) && s.cp[4] === 4 && s.cp[5] === 5 && s.cp[6] === 6 && s.cp[7] === 7;

export const STAGES: readonly StageDef[] = [
  {
    id: 'cross',
    title: 'White cross',
    goal: 'Line up the four white edges with the side centers to make a white plus on top.',
    isDone: crossDone,
  },
  {
    id: 'f1corners',
    title: 'First-layer corners',
    goal: 'Put the four white corners in place to complete the white layer.',
    isDone: f1Done,
  },
  {
    id: 'middle',
    title: 'Middle-layer edges',
    goal: 'Fill the four middle-layer edges so the top two layers are solved.',
    isDone: middleDone,
  },
  {
    id: 'ycross',
    title: 'Yellow cross',
    goal: 'Make a yellow plus on the bottom face (edge colors on the sides may not match yet).',
    isDone: ycrossDone,
  },
  {
    id: 'yedges',
    title: 'Yellow edges aligned',
    goal: 'Match the bottom edges to the side centers.',
    isDone: yedgesDone,
  },
  {
    id: 'ycornersPos',
    title: 'Yellow corners positioned',
    goal: 'Put each bottom corner in its home spot (it may still be twisted).',
    isDone: ycornersPosDone,
  },
  {
    id: 'ycornersOri',
    title: 'Yellow corners oriented',
    goal: 'Twist the bottom corners so yellow faces down. The cube is solved!',
    isDone: isSolved,
  },
];

export function stageDef(id: StageId): StageDef {
  return STAGES.find((s) => s.id === id)!;
}
