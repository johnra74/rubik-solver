// One-off icon generator: draws a flat 3×3 cube face (front + top hint) and writes PNGs with zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function png(size, padRatio) {
  const bg = hex('#1d2433');
  const colors = ['#b71234', '#ffffff', '#009b48', '#ffd500', '#009b48', '#ff5800', '#0046ad', '#009b48', '#ffffff'].map(hex);
  const px = Buffer.alloc(size * size * 4);
  const pad = Math.round(size * padRatio);
  const inner = size - 2 * pad;
  const cell = inner / 3;
  const gap = Math.max(2, Math.round(cell * 0.08));
  const radius = cell * 0.18;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let c = bg;
      const lx = x - pad;
      const ly = y - pad;
      if (lx >= 0 && ly >= 0 && lx < inner && ly < inner) {
        const col = Math.min(2, Math.floor(lx / cell));
        const row = Math.min(2, Math.floor(ly / cell));
        const cx = lx - col * cell;
        const cy = ly - row * cell;
        const inX = cx >= gap && cx <= cell - gap;
        const inY = cy >= gap && cy <= cell - gap;
        if (inX && inY) {
          // rounded corners
          const dx = Math.max(gap + radius - cx, cx - (cell - gap - radius), 0);
          const dy = Math.max(gap + radius - cy, cy - (cell - gap - radius), 0);
          if (dx * dx + dy * dy <= radius * radius) c = colors[row * 3 + col];
        }
      }
      const i = (y * size + x) * 4;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = 255;
    }
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/icons/icon-192.png', png(192, 0.1));
writeFileSync('public/icons/icon-512.png', png(512, 0.1));
writeFileSync('public/icons/icon-maskable-512.png', png(512, 0.22)); // safe zone for maskable
writeFileSync('public/icons/apple-touch-icon-180.png', png(180, 0.12));
console.log('icons written');
