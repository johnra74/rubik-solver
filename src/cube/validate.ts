/** Validation pipeline (research R6). Stops at the first failing check. */
import type { Color, Face, ValidationErrorKind } from './types';
import { COLORS, COLOR_NAME, FACE_COLOR } from './types';
import type { FaceletState } from './facelets';
import { colorCounts } from './facelets';
import { CORNER_COLORS, CORNER_FACELETS, EDGE_COLORS, EDGE_FACELETS, fromFacelets, permutationParity } from './cubie';
import { COLOR_FACE } from './types';

export interface ValidationResult {
  readonly ok: boolean;
  readonly kind?: ValidationErrorKind;
  readonly message?: string;
  readonly stickerIndices?: readonly number[];
  readonly colors?: readonly { color: Color; count: number }[];
}

const OK: ValidationResult = { ok: true };

function names(list: { color: Color; count: number }[]): string {
  return list.map((c) => `${COLOR_NAME[c.color]} (${c.count})`).join(', ');
}

export function validate(state: FaceletState): ValidationResult {
  const st = state.stickers;

  // 1. Incomplete
  const blanks = st.flatMap((s, i) => (s === 'X' ? [i] : []));
  if (blanks.length > 0) {
    return {
      ok: false,
      kind: 'incomplete',
      message: `${blanks.length} sticker${blanks.length === 1 ? '' : 's'} still need${blanks.length === 1 ? 's' : ''} a color.`,
      stickerIndices: blanks,
    };
  }

  // 2. Color counts
  const counts = colorCounts(state);
  const bad = COLORS.filter((c) => counts[c] !== 9).map((color) => ({ color, count: counts[color] }));
  if (bad.length > 0) {
    const over = bad.filter((c) => c.count > 9);
    const under = bad.filter((c) => c.count < 9);
    const parts: string[] = [];
    if (over.length) parts.push(`Too many: ${names(over)}`);
    if (under.length) parts.push(`too few: ${names(under)}`);
    return {
      ok: false,
      kind: 'colorCount',
      message: `Each color must appear exactly 9 times. ${parts.join('; ')}.`,
      stickerIndices: [],
      colors: bad,
    };
  }

  const faces = st.map((s) => COLOR_FACE[s as Color]).join('');

  // 3. Piece identity
  const badStickers = new Set<number>();
  const cornerSeen = new Map<number, number[]>();
  for (let i = 0; i < 8; i++) {
    const idx = CORNER_FACELETS[i]!;
    const cols = idx.map((k) => faces[k] as Face);
    let found = -1;
    for (let j = 0; j < 8 && found < 0; j++) {
      const cc = CORNER_COLORS[j]!;
      for (let r = 0; r < 3; r++) {
        if (cols[r] === cc[0] && cols[(r + 1) % 3] === cc[1] && cols[(r + 2) % 3] === cc[2]) {
          found = j;
          break;
        }
      }
    }
    if (found < 0) idx.forEach((k) => badStickers.add(k));
    else cornerSeen.set(found, [...(cornerSeen.get(found) ?? []), i]);
  }
  for (const positions of cornerSeen.values()) {
    if (positions.length > 1) positions.forEach((p) => CORNER_FACELETS[p]!.forEach((k) => badStickers.add(k)));
  }
  const edgeSeen = new Map<number, number[]>();
  for (let i = 0; i < 12; i++) {
    const idx = EDGE_FACELETS[i]!;
    const a = faces[idx[0]];
    const b = faces[idx[1]];
    const found = EDGE_COLORS.findIndex((ec) => (a === ec[0] && b === ec[1]) || (a === ec[1] && b === ec[0]));
    if (found < 0) idx.forEach((k) => badStickers.add(k));
    else edgeSeen.set(found, [...(edgeSeen.get(found) ?? []), i]);
  }
  for (const positions of edgeSeen.values()) {
    if (positions.length > 1) positions.forEach((p) => EDGE_FACELETS[p]!.forEach((k) => badStickers.add(k)));
  }
  if (badStickers.size > 0) {
    return {
      ok: false,
      kind: 'invalidPiece',
      message:
        "Some pieces have color combinations that can't exist on a real cube — check the highlighted stickers.",
      stickerIndices: [...badStickers].sort((x, y) => x - y),
    };
  }

  const cubie = fromFacelets(faces);

  // 4. Corner twist
  const twist = cubie.co.reduce((s, v) => s + v, 0);
  if (twist % 3 !== 0) {
    const idx = cubie.co.flatMap((o, i) => (o !== 0 ? [...CORNER_FACELETS[i]!] : []));
    return {
      ok: false,
      kind: 'cornerTwist',
      message:
        'One corner is twisted. Check the highlighted corners — a sticker may be misread, or the cube may have been reassembled incorrectly.',
      stickerIndices: idx,
    };
  }

  // 5. Edge flip
  const flip = cubie.eo.reduce((s, v) => s + v, 0);
  if (flip % 2 !== 0) {
    const idx = cubie.eo.flatMap((o, i) => (o !== 0 ? [...EDGE_FACELETS[i]!] : []));
    return {
      ok: false,
      kind: 'edgeFlip',
      message:
        'One edge is flipped. Check the highlighted edges — a sticker may be misread, or the cube may have been reassembled incorrectly.',
      stickerIndices: idx,
    };
  }

  // 6. Permutation parity
  if (permutationParity(cubie.cp) !== permutationParity(cubie.ep)) {
    return {
      ok: false,
      kind: 'parity',
      message:
        'Two pieces appear swapped. Re-check your stickers — if they are right, the cube may have been reassembled incorrectly.',
      stickerIndices: [],
    };
  }

  return OK;
}

/** Validate a complete facelet string (used by the worker). */
export function validateFaceletString(str: string): ValidationResult {
  if (str.length !== 54 || /[^URFDLB]/.test(str)) {
    return { ok: false, kind: 'incomplete', message: 'Cube state is incomplete or malformed.' };
  }
  const stickers = [...str].map((c) => FACE_COLOR[c as Face]);
  return validate({ stickers });
}
