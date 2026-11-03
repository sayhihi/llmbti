#!/usr/bin/env node
// Composes packages/core/src/characters/*.json from the layer sources in packages/core/pixelsrc/.
// Zero dependencies.
//
//   node scripts/pixel-compose.mjs            # all recipes in pixelsrc/characters.json
//   node scripts/pixel-compose.mjs ENFP ISTP  # only these ids
//
// Layer file: { x, y, rows } or { parts: [{ x, y, rows, slot? }] }. '.' is transparent, hex digits are
// palette indices, and 5/6 mean "body base/shadow" and are remapped per temperament.
// Output per type: { id, size, fps, frames: [6 frames], anims: { idle, wave, walk } }.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const srcDir = resolve(root, "packages/core/pixelsrc");
const outDir = resolve(root, "packages/core/src/characters");

const HEAD_MAX_W = 10;
const HEAD_MAX_H = 8;
const HEAD_MAX_ROW = 8; // head accessories live in rows 0-8 so they never push the body down

const recipes = JSON.parse(readFileSync(join(srcDir, "characters.json"), "utf8"));
const SIZE = recipes.size;
const only = process.argv.slice(2);

const layerCache = new Map();
function loadLayer(group, name) {
  const key = `${group}/${name}`;
  if (layerCache.has(key)) return layerCache.get(key);
  const file = join(srcDir, group, `${name}.json`);
  if (!existsSync(file)) throw new Error(`layer not found: ${key} (${file})`);
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const parts = (raw.parts ?? [raw]).map((p, i) => {
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || !Array.isArray(p.rows))
      throw new Error(`${key} part ${i}: needs integer x, y and a rows array`);
    const w = p.rows[0]?.length ?? 0;
    p.rows.forEach((row, r) => {
      if (typeof row !== "string" || row.length !== w)
        throw new Error(`${key} part ${i} row ${r}: ragged width (expected ${w}, got ${row?.length})`);
      if (!/^[.0-9a-f]*$/.test(row)) throw new Error(`${key} part ${i} row ${r}: invalid char in "${row}"`);
      if (row.includes("0")) throw new Error(`${key} part ${i} row ${r}: use "." for transparent, not 0`);
    });
    return { x: p.x, y: p.y, rows: p.rows, slot: p.slot ?? "back", w, h: p.rows.length };
  });
  const layer = { key, parts };
  if (group === "head") checkHead(layer);
  layerCache.set(key, layer);
  return layer;
}

function bounds(layer) {
  let minX = SIZE, minY = SIZE, maxX = -1, maxY = -1;
  for (const p of layer.parts)
    p.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] === ".") continue;
        minX = Math.min(minX, p.x + c);
        maxX = Math.max(maxX, p.x + c);
        minY = Math.min(minY, p.y + r);
        maxY = Math.max(maxY, p.y + r);
      }
    });
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function checkHead(layer) {
  const b = bounds(layer);
  if (b.w > HEAD_MAX_W || b.h > HEAD_MAX_H)
    throw new Error(`${layer.key}: head accessory is ${b.w}x${b.h}, max ${HEAD_MAX_W}x${HEAD_MAX_H}`);
  if (b.maxY > HEAD_MAX_ROW) throw new Error(`${layer.key}: head accessory reaches row ${b.maxY}, max row ${HEAD_MAX_ROW}`);
}

function blit(canvas, layer, remap, slotFilter) {
  for (const p of layer.parts) {
    if (slotFilter && p.slot !== slotFilter) continue;
    p.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === ".") continue;
        const x = p.x + c;
        const y = p.y + r;
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE)
          throw new Error(`${layer.key}: pixel at (${x},${y}) is outside the ${SIZE}x${SIZE} canvas`);
        canvas[y][x] = remap[ch] ?? ch;
      }
    });
  }
}

function composeFrame(id, recipe, pose) {
  const remap = recipes.temperaments[recipe.temperament];
  if (!remap) throw new Error(`${id}: unknown temperament "${recipe.temperament}"`);
  const canvas = Array.from({ length: SIZE }, () => Array(SIZE).fill("."));

  // which layer name to use per group for this frame
  const pick = (group) => {
    if (group === "body") return "base";
    if (group === "arms") return pose.arms;
    if (group === "legs") return pose.legs;
    if (pose.blink) {
      const ov = { ...recipes.defaultBlink, ...(recipe.blink ?? {}) };
      if (group in ov) return ov[group];
    }
    return recipe[group] ?? null;
  };

  for (const step of recipes.order) {
    const [group, slot] = step.split(":");
    const name = pick(group);
    if (!name) continue;
    const layer = loadLayer(group, name);
    if (group === "back") blit(canvas, layer, remap, slot ?? "back");
    else blit(canvas, layer, remap, null);
  }
  return canvas.map((row) => row.join(""));
}

const ids = Object.keys(recipes.types).filter((id) => only.length === 0 || only.includes(id));
if (ids.length === 0) {
  console.error(`no recipes matched: ${only.join(", ")}`);
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

for (const id of ids) {
  const recipe = recipes.types[id];
  const frames = recipes.frames.map((pose) => composeFrame(id, recipe, pose));
  for (const [anim, idxs] of Object.entries(recipes.anims))
    for (const i of idxs) if (!(Number.isInteger(i) && i >= 0 && i < frames.length)) throw new Error(`${id}: anim "${anim}" index ${i} out of range`);
  writeFileSync(join(outDir, `${id}.json`), format({ id, size: SIZE, fps: recipes.fps, frames, anims: recipes.anims }));
}

// Same shape as JSON.stringify(x, null, 2) but anims arrays stay on one line each.
function format(out) {
  const frames = out.frames
    .map((f) => "    [\n" + f.map((row) => `      ${JSON.stringify(row)}`).join(",\n") + "\n    ]")
    .join(",\n");
  const anims = Object.entries(out.anims)
    .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(",\n");
  return `{\n  "id": ${JSON.stringify(out.id)},\n  "size": ${out.size},\n  "fps": ${out.fps},\n  "frames": [\n${frames}\n  ],\n  "anims": {\n${anims}\n  }\n}\n`;
}
console.log(`composed ${ids.length} character(s) into ${outDir}: ${ids.join(", ")}`);
