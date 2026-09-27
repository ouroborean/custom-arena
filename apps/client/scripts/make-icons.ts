// Draws the app icons (the favicon's star, flat red on ink) as PNGs for the web app manifest and
// iOS, with no image dependencies: a supersampled polygon fill and a minimal PNG encoder.
//
//   npm run icons -w @arena/client      (writes public/icons/; commit the results)

import { mkdirSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';

// The favicon's star on its 32×32 grid.
const STAR: [number, number][] = [
  [16, 2], [20, 12], [30, 12], [22, 18], [25, 29], [16, 22], [7, 29], [10, 18], [2, 12], [12, 12],
];
const INK: [number, number, number] = [0x0c, 0x0c, 0x10];
const RED: [number, number, number] = [0xe8, 0x11, 0x2d];

function inside(x: number, y: number, poly: [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** RGB pixels: ink background, the star scaled so its 32-unit grid spans `scale` of the icon. */
function draw(size: number, scale: number): Buffer {
  const px = Buffer.alloc(size * size * 3);
  const unit = (size * scale) / 32;
  const offset = (size - size * scale) / 2;
  const SS = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cover = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const gx = (x + (sx + 0.5) / SS - offset) / unit;
          const gy = (y + (sy + 0.5) / SS - offset) / unit;
          if (inside(gx, gy, STAR)) cover++;
        }
      }
      const a = cover / (SS * SS);
      for (let c = 0; c < 3; c++) px[(y * size + x) * 3 + c] = Math.round(INK[c]! * (1 - a) + RED[c]! * a);
    }
  }
  return px;
}

function png(size: number, rgb: Buffer): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolor RGB
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3); // filter byte 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
// Maskable icons keep the art inside the central 80% safe zone; the others fill more of the square.
for (const [name, size, scale] of [
  ['icon-192.png', 192, 0.86],
  ['icon-512.png', 512, 0.86],
  ['maskable-512.png', 512, 0.66],
  ['apple-touch-icon.png', 180, 0.72],
] as const) {
  writeFileSync(new URL(name, out), png(size, draw(size, scale)));
  console.log(`public/icons/${name}`);
}
