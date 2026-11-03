#!/usr/bin/env node
// Validates packages/core/src/palette.json and every packages/core/src/characters/*.json.
//
//   node scripts/pixel-validate.mjs            # all characters
//   node scripts/pixel-validate.mjs a.json ... # only these files
//
// Checks: palette has 16 entries in index order (0 = transparent); each character has
// size 32, a positive fps, at least one frame, every frame is 32 rows x 32 chars, and
// every char is "." or a hex digit pointing at a non-transparent palette entry.
// anims: an object with non-empty integer arrays, idle/blink/wave/walk present, every index < frames.length,
// and idle never contains a frame that blink uses (blink timing belongs to the player).
// Exits 1 on any failure.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const SIZE = 32;
const PALETTE_SIZE = 16;
const REQUIRED_ANIMS = ["idle", "blink", "wave", "walk"];

const errors = [];
const fail = (msg) => errors.push(msg);

// ---------- palette ----------
const palettePath = resolve(root, "packages/core/src/palette.json");
let palette;
try {
  palette = JSON.parse(readFileSync(palettePath, "utf8"));
} catch (e) {
  fail(`palette: cannot read ${palettePath}: ${e.message}`);
}
const colors = palette?.colors ?? [];
if (colors.length !== PALETTE_SIZE) fail(`palette: expected ${PALETTE_SIZE} colors, got ${colors.length}`);
colors.forEach((c, i) => {
  if (c.index !== i) fail(`palette: entry ${i} has index ${c.index}`);
  if (typeof c.name !== "string" || !c.name) fail(`palette: entry ${i} has no name`);
  if (i === 0) {
    if (c.hex !== null) fail(`palette: entry 0 must be transparent (hex null)`);
  } else if (!/^#[0-9a-fA-F]{6}$/.test(c.hex ?? "")) fail(`palette: entry ${i} (${c.name}) has bad hex ${c.hex}`);
});

// ---------- characters ----------
const charDir = resolve(root, "packages/core/src/characters");
const files =
  process.argv.length > 2
    ? process.argv.slice(2)
    : readdirSync(charDir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => join(charDir, f));

for (const file of files) {
  const name = basename(file, ".json");
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    fail(`${name}: cannot parse: ${e.message}`);
    continue;
  }
  if (data.id !== name) fail(`${name}: id "${data.id}" does not match filename`);
  if (data.size !== SIZE) fail(`${name}: size must be ${SIZE}, got ${data.size}`);
  if (!(Number.isFinite(data.fps) && data.fps > 0)) fail(`${name}: fps must be a positive number`);
  if (!Array.isArray(data.frames) || data.frames.length === 0) {
    fail(`${name}: frames must be a non-empty array`);
    continue;
  }
  data.frames.forEach((frame, fi) => {
    if (!Array.isArray(frame) || frame.length !== SIZE) {
      fail(`${name}: frame ${fi} has ${frame?.length ?? "no"} rows, expected ${SIZE}`);
      return;
    }
    frame.forEach((row, ri) => {
      if (typeof row !== "string" || row.length !== SIZE) {
        fail(`${name}: frame ${fi} row ${ri} has length ${row?.length ?? "n/a"}, expected ${SIZE}`);
        return;
      }
      for (let ci = 0; ci < row.length; ci++) {
        const ch = row[ci];
        if (ch === ".") continue;
        if (!/^[0-9a-f]$/.test(ch)) {
          fail(`${name}: frame ${fi} row ${ri} col ${ci}: invalid char "${ch}"`);
          continue;
        }
        const idx = parseInt(ch, 16);
        if (idx === 0 || !colors[idx] || !colors[idx].hex)
          fail(`${name}: frame ${fi} row ${ri} col ${ci}: palette index ${idx} is transparent/undefined (use ".")`);
      }
    });
  });

  // ---------- anims ----------
  const anims = data.anims;
  if (!anims || typeof anims !== "object" || Array.isArray(anims)) {
    fail(`${name}: anims must be an object of frame-index arrays`);
    continue;
  }
  for (const key of REQUIRED_ANIMS) if (!(key in anims)) fail(`${name}: anims.${key} is missing`);
  for (const [key, seq] of Object.entries(anims)) {
    if (!Array.isArray(seq) || seq.length === 0) {
      fail(`${name}: anims.${key} must be a non-empty array`);
      continue;
    }
    seq.forEach((i, pos) => {
      if (!Number.isInteger(i) || i < 0 || i >= data.frames.length)
        fail(`${name}: anims.${key}[${pos}] = ${i} is not a frame index (0..${data.frames.length - 1})`);
    });
  }
  if (Array.isArray(anims.idle) && Array.isArray(anims.blink)) {
    const blinkFrames = new Set(anims.blink);
    for (const i of anims.idle) if (blinkFrames.has(i)) fail(`${name}: anims.idle must not contain blink frame ${i}`);
  }
}

if (errors.length) {
  for (const e of errors) console.error("FAIL " + e);
  console.error(`${errors.length} problem(s)`);
  process.exit(1);
}
console.log(`ok: palette (${colors.length} colors), ${files.length} character file(s) with anims: ${files.map((f) => basename(f, ".json")).join(", ")}`);
