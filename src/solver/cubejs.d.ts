declare module 'cubejs' {
  export default class Cube {
    constructor(other?: Cube);
    static fromString(str: string): Cube;
    static random(): Cube;
    static initSolver(): void;
    move(alg: string): this;
    asString(): string;
    isSolved(): boolean;
    solve(maxDepth?: number): string;
  }
}
declare module 'cubejs/lib/solve.js';
