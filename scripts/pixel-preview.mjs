#!/usr/bin/env node
// Renders the palette plus any character JSONs to a single PNG, zero dependencies.
//
//   node scripts/pixel-preview.mjs packages/core/src/characters/*.json --out docs/ref/preview.png
//
// Options:
//   --out <path>       output PNG (required)
//   --scale <n>        integer pixel scale, default 8
//   --palette <path>   palette JSON, default packages/core/src/palette.json
//
// Layout: palette swatches on top, then one row per character with its frames side by side.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// ---------- args ----------
const args = process.argv.slice(2);
const opts = { out: null, scale: 8, palette: resolve(root, "packages/core/src/palette.json") };
const files = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--out") opts.out = args[++i];
  else if (a === "--scale") opts.scale = Number(args[++i]);
  else if (a === "--palette") opts.palette = args[++i];
  else files.push(a);
}
if (!opts.out) {
  console.error("usage: pixel-preview.mjs <character.json ...> --out <file.png> [--scale 8] [--palette palette.json]");
  process.exit(2);
}
if (!Number.isInteger(opts.scale) || opts.scale < 1) {
  console.error("--scale must be a positive integer");
  process.exit(2);
}

// ---------- palette ----------
const palette = JSON.parse(readFileSync(opts.palette, "utf8"));
const colors = palette.colors.map((c) => (c.hex ? hexToRgb(c.hex) : null));

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// ---------- canvas ----------
const BG = hexToRgb("#1a1a1a");
const CHECK_A = hexToRgb("#262626");
const CHECK_B = hexToRgb("#303030");
const BORDER = hexToRgb("#3a3a3a");

class Canvas {
  constructor(w, h, bg) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 3);
    for (let i = 0; i < w * h; i++) this.data.set(bg, i * 3);
  }
  set(x, y, rgb) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data.set(rgb, (y * this.w + x) * 3);
  }
  rect(x, y, w, h, rgb) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, rgb);
  }
  outline(x, y, w, h, rgb) {
    for (let xx = x; xx < x + w; xx++) {
      this.set(xx, y, rgb);
      this.set(xx, y + h - 1, rgb);
    }
    for (let yy = y; yy < y + h; yy++) {
      this.set(x, yy, rgb);
      this.set(x + w - 1, yy, rgb);
    }
  }
  checker(x, y, w, h, cell) {
    for (let yy = 0; yy < h; yy++)
      for (let xx = 0; xx < w; xx++)
        this.set(x + xx, y + yy, ((xx / cell) | 0) + ((yy / cell) | 0) & 1 ? CHECK_B : CHECK_A);
  }
}

// ---------- layout ----------
const S = opts.scale;
const PAD = 16;
const GAP = 16;
const SWATCH = 4 * S;
const chars = files.map((f) => ({ name: basename(f, ".json"), json: JSON.parse(readFileSync(f, "utf8")) }));

const paletteW = colors.length * (SWATCH + 4) - 4;
const paletteH = SWATCH;
let maxRowW = paletteW;
let totalH = PAD + paletteH + GAP;
const rows = [];
for (const c of chars) {
  const size = c.json.size;
  const frames = c.json.frames;
  const w = frames.length * (size * S + GAP) - GAP;
  const h = size * S;
  rows.push({ y: totalH, w, h, c });
  maxRowW = Math.max(maxRowW, w);
  totalH += h + GAP;
}
const W = PAD * 2 + maxRowW;
const H = totalH - GAP + PAD;
const cv = new Canvas(W, H, BG);

// palette strip
colors.forEach((rgb, i) => {
  const x = PAD + i * (SWATCH + 4);
  if (rgb) cv.rect(x, PAD, SWATCH, SWATCH, rgb);
  else cv.checker(x, PAD, SWATCH, SWATCH, Math.max(2, S / 2));
  cv.outline(x, PAD, SWATCH, SWATCH, BORDER);
});

// characters
for (const row of rows) {
  const size = row.c.json.size;
  row.c.json.frames.forEach((frame, fi) => {
    const ox = PAD + fi * (size * S + GAP);
    const oy = row.y;
    cv.checker(ox, oy, size * S, size * S, S);
    for (let y = 0; y < size; y++) {
      const line = frame[y] ?? "";
      for (let x = 0; x < size; x++) {
        const ch = line[x] ?? ".";
        if (ch === ".") continue;
        const idx = parseInt(ch, 16);
        const rgb = colors[idx];
        if (!rgb) continue;
        cv.rect(ox + x * S, oy + y * S, S, S, rgb);
      }
    }
    cv.outline(ox - 1, oy - 1, size * S + 2, size * S + 2, BORDER);
  });
}

// ---------- PNG encoding ----------
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(canvas) {
  const { w, h, data } = canvas;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; // filter: none
    data.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(dirname(resolve(opts.out)), { recursive: true });
writeFileSync(opts.out, encodePng(cv));
console.log(`wrote ${opts.out} (${W}x${H}) palette=${colors.length} chars=${chars.map((c) => c.name).join(",")}`);
