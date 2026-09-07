/**
 * Generate the PWA icons.
 *
 * The mark is the platform's subject drawn literally: a closed loop with an
 * arrowhead — feedback, returning to itself. Rasterising it here (rather than
 * committing binaries produced by some other tool) keeps the icons reproducible
 * and the repository free of unexplained blobs: `npm run icons` rebuilds them.
 *
 * A minimal PNG encoder, since the only dependency available is zlib from Node.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../public/icons');

// -- PNG encoding -----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** RGBA pixel buffer → PNG. */
function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  // 10..12 stay zero: deflate, adaptive filtering, no interlace.

  // Each scanline is prefixed with a filter byte; filter 0 (none) is plenty for
  // flat, synthetic artwork and keeps this encoder short.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// -- The mark ---------------------------------------------------------------

const mix = (a, b, t) => a.map((channel, i) => Math.round(channel + (b[i] - channel) * t));

/** The break in the ring: the signal enters at the tail and leaves at the head. */
const HEAD_ANGLE = -Math.PI * 0.08;
const TAIL_ANGLE = -Math.PI * 0.42;
const GAP_WIDTH = HEAD_ANGLE - TAIL_ANGLE;
const mod2pi = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

const BG_TOP = [17, 24, 46];
const BG_BOTTOM = [8, 12, 24];
const CYAN = [53, 224, 208];
const VIOLET = [124, 108, 255];

/**
 * @param size    pixel dimensions
 * @param padding fraction of the canvas kept clear around the mark; maskable
 *                icons need a wide safe area because launchers crop them.
 */
function drawIcon(size, padding) {
  const rgba = Buffer.alloc(size * size * 4);
  const centre = size / 2;
  const radius = size * (0.5 - padding) * 0.78;
  const thickness = size * 0.085;
  const corner = size * 0.22;

  // Supersample: 3×3 samples per pixel, which is enough to keep the ring smooth.
  const SAMPLES = 3;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const px = x + (sx + 0.5) / SAMPLES;
          const py = y + (sy + 0.5) / SAMPLES;
          const sample = shade(px, py, { size, centre, radius, thickness, corner, padding });
          r += sample[0];
          g += sample[1];
          b += sample[2];
          a += sample[3];
        }
      }

      const n = SAMPLES * SAMPLES;
      const offset = (y * size + x) * 4;
      rgba[offset] = Math.round(r / n);
      rgba[offset + 1] = Math.round(g / n);
      rgba[offset + 2] = Math.round(b / n);
      rgba[offset + 3] = Math.round(a / n);
    }
  }

  return encodePng(size, size, rgba);
}

function shade(px, py, { size, centre, radius, thickness, corner, padding }) {
  // Rounded-square background, or full bleed for maskable icons.
  const inset = padding > 0.1 ? 0 : size * 0.04;
  if (!insideRoundedRect(px, py, inset, size - inset, corner)) return [0, 0, 0, 0];

  const background = mix(BG_TOP, BG_BOTTOM, py / size);

  const dx = px - centre;
  const dy = py - centre;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  // The ring, open at the top-right so the arrowhead reads as motion. The
  // signal travels from TAIL to HEAD by decreasing angle, which is why the
  // colour parameter is measured that way — it leaves no seam on the ring.
  const onRing = Math.abs(distance - radius) < thickness / 2;
  const inGap = angle > TAIL_ANGLE && angle < HEAD_ANGLE;
  if (onRing && !inGap) {
    const travelled = mod2pi(TAIL_ANGLE - angle) / (2 * Math.PI - GAP_WIDTH);
    return [...mix(VIOLET, CYAN, Math.min(1, travelled)), 255];
  }

  // Arrowhead sitting on the ring at the head end, pointing the way the signal
  // is going (tangent, in the direction of decreasing angle).
  const hx = centre + Math.cos(HEAD_ANGLE) * radius;
  const hy = centre + Math.sin(HEAD_ANGLE) * radius;
  if (insideTriangle(px, py, hx, hy, thickness * 1.15, HEAD_ANGLE - Math.PI / 2)) {
    return [...CYAN, 255];
  }

  return [...background, 255];
}

function insideRoundedRect(px, py, min, max, corner) {
  const cx = Math.min(Math.max(px, min + corner), max - corner);
  const cy = Math.min(Math.max(py, min + corner), max - corner);
  if (px < min || py < min || px > max || py > max) return false;
  const inCornerX = px < min + corner || px > max - corner;
  const inCornerY = py < min + corner || py > max - corner;
  if (inCornerX && inCornerY) return Math.hypot(px - cx, py - cy) <= corner;
  return true;
}

/** Equilateral-ish triangle centred on (cx, cy), rotated by `rotation`. */
function insideTriangle(px, py, cx, cy, size, rotation) {
  const points = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((offset) => [
    cx + Math.cos(rotation + offset) * size,
    cy + Math.sin(rotation + offset) * size,
  ]);
  const sign = (ax, ay, bx, by, qx, qy) => (ax - qx) * (by - qy) - (bx - qx) * (ay - qy);
  const d1 = sign(points[0][0], points[0][1], points[1][0], points[1][1], px, py);
  const d2 = sign(points[1][0], points[1][1], points[2][0], points[2][1], px, py);
  const d3 = sign(points[2][0], points[2][1], points[0][0], points[0][1], px, py);
  const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNegative && hasPositive);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'icon-192.png'), drawIcon(192, 0.06));
writeFileSync(resolve(OUT, 'icon-512.png'), drawIcon(512, 0.06));
// Maskable icons are cropped to a circle of 80% width by some launchers.
writeFileSync(resolve(OUT, 'icon-maskable-512.png'), drawIcon(512, 0.16));
console.log(`icons written to ${OUT}`);
