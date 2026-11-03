#!/usr/bin/env node
// Renders the palette plus any character JSONs to a single PNG, zero dependencies.
//
//   node scripts/pixel-preview.mjs packages/core/src/characters/ENFP.json --out docs/ref/preview.png
//   node scripts/pixel-preview.mjs --all --out docs/ref/preview-sheet.png
//
// Options:
//   --out <path>       output PNG (required)
//   --all              every packages/core/src/characters/*.json except _base, sorted (16-row sheet)
//   --scale <n>        integer pixel scale, default 8
//   --palette <path>   palette JSON, default packages/core/src/palette.json
//   --no-palette       skip the swatch strip
//
// Layout: palette swatches on top, then one row per character (id label on the left) with all of its
// frames side by side.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve, basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// --all sheet order: temperament groups NT, NF, SJ, SP (SPEC §10) so body colours sit together.
const TYPE_ORDER = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
];

// ---------- args ----------
const args = process.argv.slice(2);
const opts = { out: null, scale: 8, palette: resolve(root, "packages/core/src/palette.json"), showPalette: true };
const files = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--out") opts.out = args[++i];
  else if (a === "--scale") opts.scale = Number(args[++i]);
  else if (a === "--palette") opts.palette = args[++i];
  else if (a === "--no-palette") opts.showPalette = false;
  else if (a === "--all") {
    const dir = resolve(root, "packages/core/src/characters");
    const rank = (f) => {
      const i = TYPE_ORDER.indexOf(basename(f, ".json"));
      return i === -1 ? TYPE_ORDER.length : i;
    };
    const all = readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
    all.sort((p, q) => rank(p) - rank(q) || p.localeCompare(q));
    for (const f of all) files.push(join(dir, f));
  } else files.push(a);
}
if (!opts.out || files.length === 0) {
  console.error("usage: pixel-preview.mjs (<character.json ...> | --all) --out <file.png> [--scale 8] [--palette palette.json] [--no-palette]");
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

// ---------- 3x5 label font ----------
const FONT = {
  A: ["010", "101", "111", "101", "101"], B: ["110", "101", "110", "101", "110"], C: ["011", "100", "100", "100", "011"],
  D: ["110", "101", "101", "101", "110"], E: ["111", "100", "110", "100", "111"], F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"], H: ["101", "101", "111", "101", "101"], I: ["111", "010", "010", "010", "111"],
  J: ["001", "001", "001", "101", "010"], K: ["101", "101", "110", "101", "101"], L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"], N: ["110", "101", "101", "101", "101"], O: ["010", "101", "101", "101", "010"],
  P: ["110", "101", "110", "100", "100"], Q: ["010", "101", "101", "011", "001"], R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"], T: ["111", "010", "010", "010", "010"], U: ["101", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "010"], W: ["101", "101", "111", "111", "101"], X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"], Z: ["111", "001", "010", "100", "111"], _: ["000", "000", "000", "000", "111"],
  "-": ["000", "000", "111", "000", "000"], 0: ["111", "101", "101", "101", "111"], 1: ["010", "110", "010", "010", "111"],
  2: ["111", "001", "111", "100", "111"], 3: ["111", "001", "011", "001", "111"], 4: ["101", "101", "111", "001", "001"],
  5: ["111", "100", "111", "001", "111"], 6: ["111", "100", "111", "101", "111"], 7: ["111", "001", "001", "001", "001"],
  8: ["111", "101", "111", "101", "111"], 9: ["111", "101", "111", "001", "111"],
};
const LABEL = hexToRgb("#D0D0D0");
function drawText(cv, text, x, y, s) {
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch];
    if (g)
      g.forEach((row, r) => {
        for (let c = 0; c < 3; c++) if (row[c] === "1") cv.rect(x + c * s, y + r * s, s, s, LABEL);
      });
    x += 4 * s;
  }
}

// ---------- layout ----------
const S = opts.scale;
const PAD = 16;
const GAP = 16;
const SWATCH = 4 * S;
const FS = Math.max(2, Math.floor(S / 2)); // label font pixel size
const LABEL_W = 5 * 4 * FS + GAP; // room for 5 glyphs on the left
const chars = files.map((f) => ({ name: basename(f, ".json"), json: JSON.parse(readFileSync(f, "utf8")) }));

const paletteW = opts.showPalette ? colors.length * (SWATCH + 4) - 4 : 0;
const paletteH = opts.showPalette ? SWATCH : 0;
let maxRowW = paletteW;
let totalH = PAD + (opts.showPalette ? paletteH + GAP : 0);
const rows = [];
for (const c of chars) {
  const size = c.json.size;
  const frames = c.json.frames;
  const w = LABEL_W + frames.length * (size * S + GAP) - GAP;
  const h = size * S;
  rows.push({ y: totalH, w, h, c });
  maxRowW = Math.max(maxRowW, w);
  totalH += h + GAP;
}
const W = PAD * 2 + maxRowW;
const H = totalH - GAP + PAD;
const cv = new Canvas(W, H, BG);

// palette strip
if (opts.showPalette)
  colors.forEach((rgb, i) => {
    const x = PAD + i * (SWATCH + 4);
    if (rgb) cv.rect(x, PAD, SWATCH, SWATCH, rgb);
    else cv.checker(x, PAD, SWATCH, SWATCH, Math.max(2, S / 2));
    cv.outline(x, PAD, SWATCH, SWATCH, BORDER);
  });

// characters
for (const row of rows) {
  const size = row.c.json.size;
  drawText(cv, row.c.name, PAD, row.y + 2, FS);
  row.c.json.frames.forEach((frame, fi) => {
    const ox = PAD + LABEL_W + fi * (size * S + GAP);
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
