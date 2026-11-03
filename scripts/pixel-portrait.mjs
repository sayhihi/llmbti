// 캐릭터 초상 PNG. README 도감 표와 웹 /characters/{TYPE}.png 에 쓴다.
//   node scripts/pixel-portrait.mjs --out apps/web/public/characters [--scale 3]
// idle 첫 프레임만, 배경 #1a1a1a, 의존성 0 (zlib + CRC32 직접).
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const args = process.argv.slice(2);
let out = "apps/web/public/characters";
let scale = 3;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--out") out = args[++i];
  else if (args[i] === "--scale") scale = Number(args[++i]);
}
const root = new URL("..", import.meta.url).pathname;
const palette = JSON.parse(readFileSync(join(root, "packages/core/src/palette.json"), "utf8"))
  .colors.sort((a, b) => a.index - b.index)
  .map((c) => (c.hex ? [parseInt(c.hex.slice(1, 3), 16), parseInt(c.hex.slice(3, 5), 16), parseInt(c.hex.slice(5, 7), 16)] : null));
const BG = [0x1a, 0x1a, 0x1a];

const crcTable = new Uint32Array(256).map((_, n) => {
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
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(out, { recursive: true });
const dir = join(root, "packages/core/src/characters");
let n = 0;
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_"))) {
  const c = JSON.parse(readFileSync(join(dir, f), "utf8"));
  const frame = c.frames[c.anims?.idle?.[0] ?? 0];
  const size = c.size * scale;
  const rgb = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const ch = frame[Math.floor(y / scale)][Math.floor(x / scale)];
    const col = ch === "." ? BG : (palette[parseInt(ch, 16)] ?? BG);
    rgb.set(col, (y * size + x) * 3);
  }
  writeFileSync(join(out, `${c.id}.png`), png(size, size, rgb));
  n++;
}
console.log(`ok: ${n} portraits → ${out} (${32 * scale}px)`);
