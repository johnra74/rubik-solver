import { describe, expect, it } from 'vitest';
import { describe as describeMove, displayPrime, format } from '../../src/cube/notation';

describe('notation format', () => {
  it('formats canonical notation', () => {
    expect(format({ face: 'R', turn: -1 })).toBe("R'");
    expect(format({ face: 'U', turn: 2 })).toBe('U2');
    expect(format({ face: 'F', turn: 1 })).toBe('F');
    expect(displayPrime("R'")).toBe('R′');
  });

  it('describes moves in plain language', () => {
    expect(describeMove({ face: 'R', turn: -1 })).toBe('Turn the right face a quarter turn counter-clockwise');
    expect(describeMove({ face: 'U', turn: 2 })).toBe('Turn the top face a half turn');
    expect(describeMove({ face: 'B', turn: 1 })).toBe('Turn the back face a quarter turn clockwise');
  });
});
