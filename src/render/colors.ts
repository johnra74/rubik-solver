/** Sticker palette shared by the 3D view and the SVG net. */
import type { Sticker } from '../cube/types';

export const STICKER_HEX: Readonly<Record<Sticker, string>> = {
  W: '#ffffff',
  Y: '#ffd500',
  G: '#009b48',
  B: '#0046ad',
  R: '#b71234',
  O: '#ff5800',
  X: '#8a8a8a',
};

/** Letter shown in "Show letters" mode; dark text on light stickers. */
export const STICKER_TEXT: Readonly<Record<Sticker, string>> = {
  W: '#1d2433',
  Y: '#1d2433',
  G: '#ffffff',
  B: '#ffffff',
  R: '#ffffff',
  O: '#1d2433',
  X: '#1d2433',
};
